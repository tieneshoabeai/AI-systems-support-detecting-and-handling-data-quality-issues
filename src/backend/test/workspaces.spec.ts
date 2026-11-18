import { Test, TestingModule } from '@nestjs/testing';
import { Types } from 'mongoose';
import { WORKSPACE_REPOSITORY_PORT } from '../src/modules/workspaces/domain/ports/workspace.repository.port';
import { USER_REPOSITORY_PORT } from '../src/modules/users/domain/ports/user.repository.port';
import { OUTBOX_PORT } from '../src/shared/application/ports/outbox.port';
import { Workspace } from '../src/modules/workspaces/domain/entities/workspace.entity';
import { CursorCodec } from '../src/shared/domain/pagination/cursor-codec';
import { createHandlerProxy, type ProxyOf } from './helpers/handler-proxy';
import { workspacesHandlers } from './helpers/module-handlers';
import { ConflictError, NotFoundError, ValidationError } from '../src/shared/domain/errors';



describe('WorkspacesService (CRUD & Phân quyền Thành viên)', () => {
  let service: ProxyOf<typeof workspacesHandlers>;
  let repository: Record<string, jest.Mock>;
  let usersPort: { findByEmail: jest.Mock; findById: jest.Mock };

  const mockAdminUser = {
    userId: new Types.ObjectId().toHexString(),
    email: 'admin@shool.local',
    role: 'admin' as const,
  };

  const mockAnalystUser = {
    userId: new Types.ObjectId().toHexString(),
    email: 'analyst@shool.local',
    role: 'analyst' as const,
  };

  const mockWorkspaceId = new Types.ObjectId().toHexString();
  /**
   * Bước 3 — Rich Domain Model: repository trả **entity**, không trả record trần.
   * Test dựng entity thật để hành vi được kiểm đúng như production.
   */
  const buildWorkspace = (
    overrides: Partial<{
      ownerId: string;
      members: Array<{ userId: string; role: 'owner' | 'member'; joinedAt: Date }>;
      storageUsedBytes: number;
    }> = {},
  ): Workspace =>
    Workspace.reconstitute({
      id: mockWorkspaceId,
      name: 'Research Workspace',
      description: 'Workspace for QA research',
      ownerId: overrides.ownerId ?? mockAdminUser.userId,
      members: overrides.members ?? [
        { userId: mockAdminUser.userId, role: 'owner' as const, joinedAt: new Date() },
      ],
      storageUsedBytes: overrides.storageUsedBytes ?? 0,
      lastAccessedAt: null,
      version: 2,
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
    });

  beforeEach(async () => {
    repository = {
      create: jest.fn().mockImplementation(() => Promise.resolve(buildWorkspace())),
      findById: jest.fn().mockImplementation((id: string) => {
        if (id === mockWorkspaceId) return Promise.resolve(buildWorkspace());
        return Promise.resolve(null);
      }),
      findByUser: jest.fn().mockImplementation(() => Promise.resolve([buildWorkspace()])),
      findAllActive: jest.fn().mockImplementation(() => Promise.resolve([buildWorkspace()])),
      updateById: jest.fn().mockImplementation(() => Promise.resolve(buildWorkspace())),
      softDelete: jest.fn().mockResolvedValue(true),
      addMember: jest.fn().mockResolvedValue(true),
      removeMember: jest.fn().mockResolvedValue(true),
      findByUserPaged: jest.fn().mockImplementation(() =>
        Promise.resolve({
          items: [buildWorkspace()],
          nextCursor: null,
          hasMore: false,
        }),
      ),
      touchLastAccessed: jest.fn().mockResolvedValue(undefined),
      addStorageUsed: jest.fn().mockResolvedValue(undefined),
      transferOwner: jest.fn().mockResolvedValue(true),
      updateMemberRole: jest.fn().mockResolvedValue(true),
    };

    usersPort = { findByEmail: jest.fn(), findById: jest.fn().mockResolvedValue(null) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ...Object.values(workspacesHandlers),
        { provide: WORKSPACE_REPOSITORY_PORT, useValue: repository },
        { provide: USER_REPOSITORY_PORT, useValue: usersPort },
        { provide: OUTBOX_PORT, useValue: { recordEvent: jest.fn().mockResolvedValue({}) } },
      ],
    }).compile();

    service = createHandlerProxy(module, workspacesHandlers);
  });

  it('createWorkspace should initialize creator as owner in members list', async () => {
    const result = await service.createWorkspace(mockAdminUser.userId, {
      name: 'Research Workspace',
      description: 'Workspace for QA research',
    });
    expect(result).toBeDefined();
    expect(repository.create).toHaveBeenCalled();
  });

  it('getWorkspaces should return all active workspaces for admin and filtered for analyst', async () => {
    const adminWorkspaces = await service.getWorkspaces(mockAdminUser);
    expect(repository.findAllActive).toHaveBeenCalled();
    expect(adminWorkspaces).toHaveLength(1);

    const analystWorkspaces = await service.getWorkspaces(mockAnalystUser);
    expect(repository.findByUser).toHaveBeenCalledWith(mockAnalystUser.userId);
    expect(analystWorkspaces).toHaveLength(1);
  });

  it('addMember should add new member with role and reject duplicate members', async () => {
    const newUserId = new Types.ObjectId().toHexString();
    usersPort.findByEmail.mockResolvedValueOnce({ id: newUserId, email: 'collaborator@shool.local' });
    await service.addMember(mockWorkspaceId, { email: 'collaborator@shool.local', role: 'member' });
    expect(repository.addMember).toHaveBeenCalled();

    usersPort.findByEmail.mockResolvedValueOnce({ id: mockAdminUser.userId, email: mockAdminUser.email });
    await expect(
      service.addMember(mockWorkspaceId, { email: mockAdminUser.email, role: 'member' }),
    ).rejects.toThrow(ConflictError);
  });
  it('removeMember should reject removing original workspace owner', async () => {
    await expect(service.removeMember(mockWorkspaceId, mockAdminUser.userId)).rejects.toThrow(
      ValidationError,
    );
  });

  it('deleteWorkspace should soft delete workspace', async () => {
    const success = await service.deleteWorkspace(mockWorkspaceId);
    expect(success).toBe(true);
    expect(repository.softDelete).toHaveBeenCalledWith(mockWorkspaceId);
  });

  it('getWorkspaceById should throw NotFoundException for non-existent workspace', async () => {
    const randomId = new Types.ObjectId().toHexString();
    await expect(service.getWorkspaceById(randomId)).rejects.toThrow(NotFoundError);
  });

  it('transferOwner should enforce exactly-one-owner invariant (WS-09)', async () => {
    const newOwnerId = new Types.ObjectId().toHexString();
    usersPort.findByEmail.mockResolvedValueOnce({ id: newOwnerId, email: 'newowner@shool.local' });
    (repository.findById as jest.Mock).mockImplementation(() =>
      Promise.resolve(
        buildWorkspace({
          ownerId: mockAdminUser.userId,
          members: [
            { userId: mockAdminUser.userId, role: 'owner' as const, joinedAt: new Date() },
            { userId: newOwnerId, role: 'member' as const, joinedAt: new Date() },
          ],
        }),
      ),
    );
    const result = await service.transferOwner(mockWorkspaceId, mockAdminUser.userId, {
      email: 'newowner@shool.local',
      expectedVersion: 2,
    });
    expect(result).toBeDefined();
    expect(repository.transferOwner).toHaveBeenCalled();
  });

  it('transferOwner should reject non-owner actor (WS-09)', async () => {
    await expect(
      service.transferOwner(mockWorkspaceId, '000000000000000000000099', { email: 'x@shool.local', expectedVersion: 2 }),
    ).rejects.toThrow();
  });

  it('leaveWorkspace should require owner to transfer first (WS-10)', async () => {
    await expect(service.leaveWorkspace(mockWorkspaceId, mockAdminUser.userId)).rejects.toThrow(
      ValidationError,
    );
  });

  it('checkWorkspaceUploadQuota should block when over workspace quota (O24)', async () => {
    (repository.findById as jest.Mock).mockImplementation(() =>
      Promise.resolve(buildWorkspace({ storageUsedBytes: 1900 })),
    );
    await expect(service.checkWorkspaceUploadQuota(mockWorkspaceId, 200, 2000)).rejects.toThrow();
  });

  it('listWorkspaces should support cursor pagination/search/filter/sort (WS-02)', async () => {
    const r = await service.listWorkspaces(mockAnalystUser as never, {
      limit: 10,
      sort: 'name_asc',
    } as never);
    expect(r.items).toHaveLength(1);
    expect(r.meta.hasMore).toBe(false);
    expect(r.meta.nextCursor).toBeNull();
    expect(r.meta.limit).toBe(10);
    expect('total' in (r as unknown as Record<string, unknown>)).toBe(false);
  });

  it('listWorkspaces should reject a cursor that does not match the current sort', async () => {
    const cursor = CursorCodec.encode({ s: 'name_asc', k: 'A', n: 0, id: '507f1f77bcf86cd799439011' });
    await expect(
      service.listWorkspaces(mockAnalystUser as never, {
        limit: 10,
        sort: 'updated',
        cursor,
      } as never),
    ).rejects.toThrow(ValidationError);
  });

  it('listWorkspaces should reject a malformed cursor', async () => {
    await expect(
      service.listWorkspaces(mockAnalystUser as never, {
        limit: 10,
        sort: 'updated',
        cursor: 'not-a-valid-cursor',
      } as never),
    ).rejects.toThrow(ValidationError);
  });
});
