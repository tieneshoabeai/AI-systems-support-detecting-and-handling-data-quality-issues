import { Test, TestingModule } from '@nestjs/testing';
import { AddMemberHandler } from '../src/modules/workspaces/application/commands/add-member.handler';
import { CreateWorkspaceHandler } from '../src/modules/workspaces/application/commands/create-workspace.handler';
import { WORKSPACE_REPOSITORY_PORT } from '../src/modules/workspaces/domain/ports/workspace.repository.port';
import { USER_REPOSITORY_PORT } from '../src/modules/users/domain/ports/user.repository.port';
import { EMAIL_SENDER_PORT } from '../src/shared/application/ports/email.port';
import { MAX_WORKSPACES_PER_USER } from '../src/modules/workspaces/domain/value-objects/workspace-quota.vo';
import { Workspace } from '../src/modules/workspaces/domain/entities/workspace.entity';
import { ConflictError } from '../src/shared/domain/errors';
import { RateLimitExceededError } from '../src/shared/domain/errors';
import { httpStatusForErrorCode } from '../src/shared/interfaces/errors/error-http-mapping';

/**
 * Nhóm 4 — WS-01/WS-07: lời mời workspace qua email.
 *
 * Quy tắc kiểm thử:
 *   - Email đã có tài khoản → thêm thành viên trực tiếp, KHÔNG gửi email.
 *   - Email chưa có tài khoản → gửi lời mời, KHÔNG ném lỗi.
 *   - Lỗi gửi email → KHÔNG làm fail thao tác chính.
 *   - Chưa cấu hình SMTP → bỏ qua email, KHÔNG ném lỗi.
 */

/**
 * Bước 3 — Rich Domain Model: repository trả **entity** `Workspace`.
 * Mỗi lần gọi dựng entity mới để tránh state bị mutate giữa các ca test.
 */
const buildWorkspace = (): Workspace =>
  Workspace.reconstitute({
    id: 'ws-1',
    name: 'Data Team',
    description: '',
    ownerId: 'owner-1',
    members: [{ userId: 'owner-1', role: 'owner' as const, joinedAt: new Date() }],
    storageUsedBytes: 0,
    lastAccessedAt: null,
    version: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
  });

describe('WS-07 — lời mời workspace qua email', () => {
  let handler: AddMemberHandler;
  let email: { isConfigured: jest.Mock; send: jest.Mock };
  let users: { findByEmail: jest.Mock; findById: jest.Mock };
  let workspaces: { addMember: jest.Mock };

  beforeEach(async () => {
    email = { isConfigured: jest.fn().mockReturnValue(true), send: jest.fn().mockResolvedValue(true) };
    users = {
      findByEmail: jest.fn().mockResolvedValue(null),
      findById: jest
        .fn()
        .mockResolvedValue({ id: 'owner-1', email: 'owner@x.com', firstName: 'Chủ', lastName: 'X' }),
    };
    workspaces = { addMember: jest.fn().mockResolvedValue(true) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AddMemberHandler,
        { provide: USER_REPOSITORY_PORT, useValue: users },
        { provide: WORKSPACE_REPOSITORY_PORT, useValue: workspaces },
        {
          provide: (await import('../src/modules/workspaces/application/queries/get-workspace-by-id.handler')).GetWorkspaceByIdHandler,
          useValue: { execute: jest.fn().mockImplementation(() => Promise.resolve(buildWorkspace())) },
        },
        { provide: EMAIL_SENDER_PORT, useValue: email },
      ],
    }).compile();

    handler = module.get<AddMemberHandler>(AddMemberHandler);
  });

  it('email đã có tài khoản → thêm thành viên trực tiếp, KHÔNG gửi email', async () => {
    users.findByEmail.mockResolvedValue({ id: 'user-9', email: 'a@b.com' });

    const result = await handler.execute('ws-1', { email: 'a@b.com', role: 'member' }, 'owner-1');

    expect(result.invited).toBe(false);
    expect(workspaces.addMember).toHaveBeenCalledTimes(1);
    expect(email.send).not.toHaveBeenCalled();
  });

  it('email CHƯA có tài khoản → gửi lời mời, KHÔNG ném lỗi', async () => {
    users.findByEmail.mockResolvedValue(null);

    const result = await handler.execute('ws-1', { email: 'new@b.com', role: 'member' }, 'owner-1');

    expect(result.invited).toBe(true);
    expect(email.send).toHaveBeenCalledTimes(1);
    const sent = email.send.mock.calls[0][0];
    expect(sent.to).toBe('new@b.com');
    expect(sent.template).toBe('workspace_invitation');
    expect(String(sent.html)).toContain('Data Team');
    // Chưa có tài khoản → không thêm vào members.
    expect(workspaces.addMember).not.toHaveBeenCalled();
  });

  it('gửi email lỗi → KHÔNG làm fail thao tác chính', async () => {
    email.send.mockRejectedValue(new Error('SMTP down'));

    const result = await handler.execute('ws-1', { email: 'new@b.com', role: 'member' }, 'owner-1');

    expect(result.invited).toBe(true);
  });

  it('chưa cấu hình SMTP → bỏ qua email, KHÔNG ném lỗi', async () => {
    email.isConfigured.mockReturnValue(false);

    const result = await handler.execute('ws-1', { email: 'new@b.com', role: 'member' }, 'owner-1');

    expect(result.invited).toBe(true);
    expect(email.send).not.toHaveBeenCalled();
  });

  it('người đã là thành viên → ConflictError', async () => {
    users.findByEmail.mockResolvedValue({ id: 'owner-1', email: 'owner@x.com' });

    await expect(
      handler.execute('ws-1', { email: 'owner@x.com', role: 'member' }, 'owner-1'),
    ).rejects.toBeInstanceOf(ConflictError);
  });
});

describe('WS-01 — tạo workspace kèm email chưa có tài khoản', () => {
  let handler: CreateWorkspaceHandler;
  let email: { isConfigured: jest.Mock; send: jest.Mock };
  let users: { findById: jest.Mock; findByEmail: jest.Mock };
  let workspaces: { create: jest.Mock; addMember: jest.Mock; findById: jest.Mock; countOwnedByUser: jest.Mock };

  beforeEach(async () => {
    email = { isConfigured: jest.fn().mockReturnValue(true), send: jest.fn().mockResolvedValue(true) };
    users = {
      findById: jest.fn().mockResolvedValue({ id: 'owner-1', email: 'owner@x.com' }),
      findByEmail: jest.fn().mockResolvedValue(null),
    };
    workspaces = {
      create: jest.fn().mockImplementation(() => Promise.resolve(buildWorkspace())),
      addMember: jest.fn().mockResolvedValue(true),
      findById: jest.fn().mockImplementation(() => Promise.resolve(buildWorkspace())),
      countOwnedByUser: jest.fn().mockResolvedValue(1),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CreateWorkspaceHandler,
        { provide: USER_REPOSITORY_PORT, useValue: users },
        { provide: WORKSPACE_REPOSITORY_PORT, useValue: workspaces },
        { provide: EMAIL_SENDER_PORT, useValue: email },
      ],
    }).compile();

    handler = module.get<CreateWorkspaceHandler>(CreateWorkspaceHandler);
  });

  it('email chưa có tài khoản → gửi lời mời thay vì báo lỗi 400', async () => {
    const result = await handler.execute('owner-1', {
      name: 'Data Team',
      member_emails: ['new@b.com'],
    });

    expect(result.id).toBe('ws-1');
    expect(email.send).toHaveBeenCalledTimes(1);
    expect(email.send.mock.calls[0][0]).toMatchObject({
      to: 'new@b.com',
      template: 'workspace_invitation',
    });
  });

  it('email đã có tài khoản → thêm thành viên, KHÔNG gửi email', async () => {
    users.findByEmail.mockResolvedValue({ id: 'user-9', email: 'has@b.com' });

    await handler.execute('owner-1', { name: 'Data Team', member_emails: ['has@b.com'] });

    expect(workspaces.addMember).toHaveBeenCalledTimes(1);
    expect(email.send).not.toHaveBeenCalled();
  });
});

describe('Quota — giới hạn số workspace tối đa mỗi user (phương án B)', () => {
  let handler: CreateWorkspaceHandler;
  let users: { findById: jest.Mock; findByEmail: jest.Mock };
  let workspaces: { create: jest.Mock; addMember: jest.Mock; findById: jest.Mock; countOwnedByUser: jest.Mock };

  beforeEach(async () => {
    users = {
      findById: jest.fn().mockResolvedValue({ id: 'owner-1', email: 'owner@x.com', role: 'analyst' }),
      findByEmail: jest.fn().mockResolvedValue(null),
    };
    workspaces = {
      create: jest.fn().mockImplementation(() => Promise.resolve(buildWorkspace())),
      addMember: jest.fn().mockResolvedValue(true),
      findById: jest.fn().mockImplementation(() => Promise.resolve(buildWorkspace())),
      countOwnedByUser: jest.fn().mockResolvedValue(0),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CreateWorkspaceHandler,
        { provide: USER_REPOSITORY_PORT, useValue: users },
        { provide: WORKSPACE_REPOSITORY_PORT, useValue: workspaces },
        { provide: EMAIL_SENDER_PORT, useValue: { isConfigured: jest.fn().mockReturnValue(false), send: jest.fn() } },
      ],
    }).compile();

    handler = module.get<CreateWorkspaceHandler>(CreateWorkspaceHandler);
  });

  it(`đã đủ ${MAX_WORKSPACES_PER_USER} workspace → 429 LIMIT_EXCEEDED`, async () => {
    workspaces.countOwnedByUser.mockResolvedValue(MAX_WORKSPACES_PER_USER);

    await expect(handler.execute('owner-1', { name: 'Data Team' })).rejects.toMatchObject({
      code: 'LIMIT_EXCEEDED',
    });
    await expect(handler.execute('owner-1', { name: 'Data Team' })).rejects.toBeInstanceOf(
      RateLimitExceededError,
    );
    // HTTP status do lớp Error Mapping quyết định (không nằm trên lỗi nghiệp vụ).
    expect(httpStatusForErrorCode('LIMIT_EXCEEDED')).toBe(429);
    expect(workspaces.create).not.toHaveBeenCalled();
  });

  it('dưới giới hạn → tạo được workspace', async () => {
    workspaces.countOwnedByUser.mockResolvedValue(MAX_WORKSPACES_PER_USER - 1);

    const result = await handler.execute('owner-1', { name: 'Data Team' });

    expect(result.id).toBe('ws-1');
    expect(workspaces.create).toHaveBeenCalledTimes(1);
  });

  it('admin KHÔNG bị giới hạn', async () => {
    users.findById.mockResolvedValue({ id: 'admin-1', email: 'admin@x.com', role: 'admin' });
    workspaces.countOwnedByUser.mockResolvedValue(999);

    const result = await handler.execute('admin-1', { name: 'Data Team' });

    expect(result.id).toBe('ws-1');
    expect(workspaces.countOwnedByUser).not.toHaveBeenCalled();
  });
});
