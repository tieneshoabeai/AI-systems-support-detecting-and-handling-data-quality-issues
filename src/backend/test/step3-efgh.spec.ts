import { Test, TestingModule } from '@nestjs/testing';
import { Types } from 'mongoose';
import { WORKSPACE_REPOSITORY_PORT } from '../src/modules/workspaces/domain/ports/workspace.repository.port';
import { USER_REPOSITORY_PORT } from '../src/modules/users/domain/ports/user.repository.port';
import { UserAccessRevocationService } from '../src/modules/users/application/services/user-access-revocation.service';
import { TRANSACTION_PORT } from '../src/shared/application/ports/transaction.port';
import { fakeTransaction } from './helpers/transaction';
import { User } from '../src/modules/users/domain/entities/user.entity';
import { PROJECT_REPOSITORY_PORT } from '../src/modules/projects/domain/ports/project.repository.port';
import { OUTBOX_PORT } from '../src/shared/application/ports/outbox.port';
import { CursorCodec } from '../src/shared/domain/pagination/cursor-codec';
import {
  compareGeneric,
  genericSortValue,
  isAfterGenericCursor,
} from '../src/shared/domain/pagination/keyset-generic-memory.util';
import { CreateWorkspaceSchema } from '../src/modules/workspaces/presentation/dtos/create-workspace.dto';
import { CreateProjectSchema } from '../src/modules/projects/presentation/dtos/create-project.dto';
import { UpdateUserSchema } from '../src/modules/users/presentation/dtos/update-user.dto';
import { createHandlerProxy, type ProxyOf } from './helpers/handler-proxy';
import { overviewHandlers } from './helpers/module-handlers';
import { projectsHandlers } from './helpers/module-handlers';
import { usersHandlers } from './helpers/module-handlers';
import { workspacesHandlers } from './helpers/module-handlers';
import { ConflictError, NotFoundError, ValidationError } from '../src/shared/domain/errors';


// ─────────────────────────────────────────────────────────────────────────────
// Nhóm E — Tìm kiếm/lọc thành viên + endpoint tổng quan
// ─────────────────────────────────────────────────────────────────────────────

describe('Nhóm E1/E2 — Danh sách thành viên (tìm kiếm + lọc + cursor)', () => {
  let wsService: ProxyOf<typeof workspacesHandlers>;
  let prjService: ProxyOf<typeof projectsHandlers>;
  let wsRepo: Record<string, jest.Mock>;
  let prjRepo: Record<string, jest.Mock>;
  let usersPort: Record<string, jest.Mock>;

  const wsId = new Types.ObjectId().toHexString();
  const ownerId = new Types.ObjectId().toHexString();
  const memberId = new Types.ObjectId().toHexString();

  const wsRecord = {
    id: wsId,
    name: 'WS QA',
    description: '',
    ownerId,
    members: [
      { userId: ownerId, role: 'owner' as const, joinedAt: new Date('2026-01-01T00:00:00.000Z') },
      { userId: memberId, role: 'member' as const, joinedAt: new Date('2026-02-01T00:00:00.000Z') },
    ],
    storageUsedBytes: 1234,
    lastAccessedAt: new Date('2026-03-01T00:00:00.000Z'),
    version: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const prjId = new Types.ObjectId().toHexString();
  const prjRecord = {
    id: prjId,
    workspaceId: wsId,
    name: 'P1',
    description: '',
    hasDataset: false,
    status: 'in_progress' as const,
    members: [
      { userId: ownerId, role: 'owner' as const, joinedAt: new Date('2026-01-01T00:00:00.000Z') },
      { userId: memberId, role: 'member' as const, joinedAt: new Date('2026-02-01T00:00:00.000Z') },
    ],
    lastAccessedAt: null,
    version: 1,
    createdBy: ownerId,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const profiles = [
    { id: ownerId, email: 'owner@shool.local', firstName: 'An', lastName: 'Owner', avatarUrl: null },
    { id: memberId, email: 'member@shool.local', firstName: 'Bình', lastName: 'Member', avatarUrl: null },
  ];

  beforeEach(async () => {
    wsRepo = {
      findById: jest.fn().mockResolvedValue(wsRecord),
      findByUserPaged: jest.fn().mockResolvedValue({ items: [], nextCursor: null, hasMore: false }),
    };
    prjRepo = {
      findById: jest.fn().mockResolvedValue(prjRecord),
      findByWorkspacePaged: jest.fn().mockResolvedValue({ items: [], nextCursor: null, hasMore: false }),
    };
    usersPort = {
      findByEmail: jest.fn(),
      findById: jest.fn(),
      findByIds: jest.fn().mockResolvedValue(profiles),
    };

    const wsModule: TestingModule = await Test.createTestingModule({
      providers: [
        ...Object.values(workspacesHandlers),
        { provide: WORKSPACE_REPOSITORY_PORT, useValue: wsRepo },
        { provide: USER_REPOSITORY_PORT, useValue: usersPort },
        { provide: OUTBOX_PORT, useValue: { recordEvent: jest.fn().mockResolvedValue({}) } },
        { provide: TRANSACTION_PORT, useValue: fakeTransaction() },
      ],
    }).compile();
    wsService = createHandlerProxy(wsModule, workspacesHandlers);

    const prjModule: TestingModule = await Test.createTestingModule({
      providers: [
        ...Object.values(projectsHandlers),
        { provide: PROJECT_REPOSITORY_PORT, useValue: prjRepo },
        {
          provide: WORKSPACE_REPOSITORY_PORT,
          useValue: { findById: jest.fn().mockResolvedValue(wsRecord) },
        },
        { provide: USER_REPOSITORY_PORT, useValue: usersPort },
        { provide: OUTBOX_PORT, useValue: { recordEvent: jest.fn().mockResolvedValue({}) } },
        { provide: TRANSACTION_PORT, useValue: fakeTransaction() },
      ],
    }).compile();
    prjService = createHandlerProxy(prjModule, projectsHandlers);
  });

  it('WS-06: populate hồ sơ (tên/email) cho từng thành viên', async () => {
    const r = await wsService.listMembers(wsId, { limit: 10 } as never);
    expect(r.items).toHaveLength(2);
    expect(r.items[0]).toEqual(
      expect.objectContaining({ userId: ownerId, role: 'owner', email: 'owner@shool.local' }),
    );
    expect(r.items[0]?.firstName).toBe('An');
    expect(usersPort.findByIds).toHaveBeenCalledWith([ownerId, memberId]);
  });

  it('WS-06: search theo tên (không phân biệt hoa/thường)', async () => {
    const r = await wsService.listMembers(wsId, { search: 'bình' } as never);
    expect(r.items).toHaveLength(1);
    expect(r.items[0]?.userId).toBe(memberId);
  });

  it('WS-06: search theo email (partial)', async () => {
    const r = await wsService.listMembers(wsId, { search: 'OWNER@' } as never);
    expect(r.items).toHaveLength(1);
    expect(r.items[0]?.userId).toBe(ownerId);
  });

  it('WS-06: lọc theo role', async () => {
    const r = await wsService.listMembers(wsId, { role: 'member' } as never);
    expect(r.items).toHaveLength(1);
    expect(r.items[0]?.role).toBe('member');
  });

  it('WS-06: phân trang keyset — không trả `total`/`page`', async () => {
    const r = await wsService.listMembers(wsId, { limit: 1 } as never);
    expect(r.meta).toEqual({ nextCursor: expect.any(String), hasMore: true, limit: 1 });
    expect('total' in (r as unknown as Record<string, unknown>)).toBe(false);
  });

  it('WS-06: con trỏ trang 2 không trùng với trang 1', async () => {
    const p1 = await wsService.listMembers(wsId, { limit: 1, sort: 'name_asc' } as never);
    const p2 = await wsService.listMembers(wsId, {
      limit: 1,
      sort: 'name_asc',
      cursor: p1.meta.nextCursor ?? undefined,
    } as never);
    const ids1 = p1.items.map((i) => i.userId);
    const ids2 = p2.items.map((i) => i.userId);
    expect(ids1).not.toEqual(ids2);
  });

  it('WS-06: cursor không khớp sort → 400', async () => {
    const cursor = CursorCodec.encode({ s: 'name_asc', k: 'A', n: 0, id: '507f1f77bcf86cd799439011' });
    await expect(
      wsService.listMembers(wsId, { limit: 1, sort: 'joined', cursor } as never),
    ).rejects.toThrow(ValidationError);
  });

  it('WS-06: cursor hỏng → 400', async () => {
    await expect(
      wsService.listMembers(wsId, { limit: 1, cursor: 'khong-hop-le' } as never),
    ).rejects.toThrow(ValidationError);
  });

  it('PROJ-09: tìm kiếm thành viên project theo tên/email', async () => {
    const r = await prjService.listMembers(prjId, { search: 'member@' } as never);
    expect(r.items).toHaveLength(1);
    expect(r.items[0]?.userId).toBe(memberId);
  });

  it('PROJ-09: lọc theo role owner', async () => {
    const r = await prjService.listMembers(prjId, { role: 'owner' } as never);
    expect(r.items).toHaveLength(1);
    expect(r.items[0]?.role).toBe('owner');
  });

  it('PROJ-09: không trả `total`/`page`', async () => {
    const r = await prjService.listMembers(prjId, { limit: 5 } as never);
    expect('total' in (r as unknown as Record<string, unknown>)).toBe(false);
    expect(r.meta.limit).toBe(5);
  });
});

describe('Nhóm E3/E4 — Endpoint tổng quan (Overview)', () => {
  let service: ProxyOf<typeof overviewHandlers>;
  let wsRepo: Record<string, jest.Mock>;
  let prjRepo: Record<string, jest.Mock>;

  const wsId = new Types.ObjectId().toHexString();
  const userId = new Types.ObjectId().toHexString();

  beforeEach(async () => {
    wsRepo = {
      findById: jest.fn().mockResolvedValue({
        id: wsId,
        name: 'WS QA',
        ownerId: userId,
        members: [{ userId, role: 'owner', joinedAt: new Date() }],
        storageUsedBytes: 999,
        lastAccessedAt: new Date('2026-03-01T00:00:00.000Z'),
      }),
      countOwnedByUser: jest.fn().mockResolvedValue(3),
      countSharedByUser: jest.fn().mockResolvedValue(2),
    };
    prjRepo = {
      countByWorkspace: jest.fn().mockImplementation((_id: string, status?: string) => {
        if (status === 'not_started') return Promise.resolve(2);
        if (status === 'in_progress') return Promise.resolve(1);
        if (status === 'completed') return Promise.resolve(4);
        return Promise.resolve(7);
      }),
      countByUser: jest.fn().mockResolvedValue(5),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ...Object.values(overviewHandlers),
        { provide: WORKSPACE_REPOSITORY_PORT, useValue: wsRepo },
        { provide: PROJECT_REPOSITORY_PORT, useValue: prjRepo },
      ],
    }).compile();
    service = createHandlerProxy(module, overviewHandlers);
  });

  it('E3: trả đủ 5 chỉ số tổng quan workspace', async () => {
    const r = await service.getUserOverview(userId);
    expect(r).toEqual({
      totalWorkspaces: 5,
      totalProjects: 5,
      ownedWorkspaces: 3,
      sharedWorkspaces: 2,
      myProjects: 5,
    });
  });

  it('E4: trả đủ chỉ số tổng quan 1 workspace', async () => {
    const r = await service.getWorkspaceOverview(wsId);
    expect(r).toEqual({
      workspaceId: wsId,
      projectCount: 7,
      notStartedCount: 2,
      inProgressCount: 1,
      completedCount: 4,
      memberCount: 1,
      storageUsedBytes: 999,
      lastAccessedAt: '2026-03-01T00:00:00.000Z',
    });
  });

  it('E4: workspace không tồn tại → 404', async () => {
    (wsRepo.findById as jest.Mock).mockResolvedValueOnce(null);
    await expect(service.getWorkspaceOverview(wsId)).rejects.toThrow(NotFoundError);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Nhóm F — Tạo project chỉ định Project Owner
// ─────────────────────────────────────────────────────────────────────────────

describe('Nhóm F — CreateProject chỉ định owner_id (PROJ-01)', () => {
  let service: ProxyOf<typeof projectsHandlers>;
  let prjRepo: Record<string, jest.Mock>;
  let wsRepo: Record<string, jest.Mock>;
  let usersPort: Record<string, jest.Mock>;

  const wsId = new Types.ObjectId().toHexString();
  const creatorId = new Types.ObjectId().toHexString();
  const ownerId = new Types.ObjectId().toHexString();
  const strangerId = new Types.ObjectId().toHexString();

  beforeEach(async () => {
    prjRepo = {
      create: jest.fn().mockImplementation((d: Record<string, unknown>) =>
        Promise.resolve({
          id: new Types.ObjectId().toHexString(),
          workspaceId: d.workspaceId,
          name: d.name,
          members: [{ userId: d.ownerId, role: 'owner' as const, joinedAt: new Date() }],
          createdBy: d.createdBy,
        }),
      ),
      findOneByWorkspaceAndName: jest.fn().mockResolvedValue(null),
    };
    wsRepo = {
      findById: jest.fn().mockResolvedValue({
        id: wsId,
        ownerId: creatorId,
        members: [{ userId: creatorId, role: 'owner', joinedAt: new Date() }],
      }),
    };
    usersPort = {
      findByEmail: jest.fn(),
      findById: jest.fn().mockImplementation((id: string) =>
        Promise.resolve(id === ownerId ? { id: ownerId } : null),
      ),
      findByIds: jest.fn().mockResolvedValue([]),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ...Object.values(projectsHandlers),
        { provide: PROJECT_REPOSITORY_PORT, useValue: prjRepo },
        { provide: WORKSPACE_REPOSITORY_PORT, useValue: wsRepo },
        { provide: USER_REPOSITORY_PORT, useValue: usersPort },
        { provide: OUTBOX_PORT, useValue: { recordEvent: jest.fn().mockResolvedValue({}) } },
        { provide: TRANSACTION_PORT, useValue: fakeTransaction() },
      ],
    }).compile();
    service = createHandlerProxy(module, projectsHandlers);
  });

  it('bỏ trống owner_id → người tạo làm Project Owner', async () => {
    await service.createProject(wsId, creatorId, { name: 'P1' });
    expect(prjRepo.create).toHaveBeenCalledWith(expect.objectContaining({ ownerId: creatorId }));
  });

  it('owner_id là thành viên workspace → được chấp nhận', async () => {
    (wsRepo.findById as jest.Mock).mockResolvedValue({
      id: wsId,
      ownerId: creatorId,
      members: [
        { userId: creatorId, role: 'owner', joinedAt: new Date() },
        { userId: ownerId, role: 'member', joinedAt: new Date() },
      ],
    });
    await service.createProject(wsId, creatorId, { name: 'P1', owner_id: ownerId });
    expect(prjRepo.create).toHaveBeenCalledWith(expect.objectContaining({ ownerId }));
  });

  it('owner_id KHÔNG phải thành viên workspace → 400 (F2)', async () => {
    (wsRepo.findById as jest.Mock).mockResolvedValue({
      id: wsId,
      ownerId: creatorId,
      members: [{ userId: creatorId, role: 'owner', joinedAt: new Date() }],
    });
    await expect(
      service.createProject(wsId, creatorId, { name: 'P1', owner_id: strangerId }),
    ).rejects.toThrow(ValidationError);
  });

  it('owner_id không tồn tại trong hệ thống → 400', async () => {
    (wsRepo.findById as jest.Mock).mockResolvedValue({
      id: wsId,
      ownerId: creatorId,
      members: [
        { userId: creatorId, role: 'owner', joinedAt: new Date() },
        { userId: strangerId, role: 'member', joinedAt: new Date() },
      ],
    });
    (usersPort.findById as jest.Mock).mockResolvedValue(null);
    await expect(
      service.createProject(wsId, creatorId, { name: 'P1', owner_id: strangerId }),
    ).rejects.toThrow(ValidationError);
  });

  it('DTO: owner_id phải là ObjectId hex 24 ký tự', () => {
    expect(CreateProjectSchema.safeParse({ name: 'P', owner_id: 'abc' }).success).toBe(false);
    expect(
      CreateProjectSchema.safeParse({ name: 'P', owner_id: '507f1f77bcf86cd799439011' }).success,
    ).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Nhóm G — Hồ sơ cá nhân: phone + bio
// ─────────────────────────────────────────────────────────────────────────────

describe('Nhóm G — Profile phone & bio (ProxyOf<typeof usersHandlers>)', () => {
  let usersService: ProxyOf<typeof usersHandlers>;
  let repo: Record<string, jest.Mock>;

  const userId = new Types.ObjectId().toHexString();
  const otherId = new Types.ObjectId().toHexString();

  /**
   * Bước 3 — Rich Domain Model: repository trả **entity** `User`, nên mock
   * phải dựng entity thật (hành vi `updateProfile()` do entity kiểm tra).
   */
  const buildUser = (): User =>
    User.reconstitute({
      id: userId,
      email: 'u@shool.local',
      passwordHash: null,
      googleId: null,
      authProvider: 'local',
      firstName: 'A',
      lastName: 'B',
      avatarUrl: null,
      phone: null,
      bio: null,
      role: 'analyst',
      notificationsEnabled: true,
      status: 'active',
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
      version: 1,
    });

  beforeEach(async () => {
    repo = {
      findByPhone: jest.fn().mockResolvedValue(null),
      updateProfile: jest.fn().mockImplementation((_id: string, data: Record<string, unknown>) => {
        const entity = buildUser();
        entity.updateProfile({
          firstName: data.firstName as string | undefined,
          lastName: data.lastName as string | undefined,
          avatarUrl: data.avatarUrl as string | null | undefined,
          phone: data.phone as string | null | undefined,
          bio: data.bio as string | null | undefined,
        });
        return Promise.resolve(entity);
      }),
      findById: jest.fn().mockImplementation(async () => buildUser()),
      findByEmail: jest.fn(),
      findByIds: jest.fn().mockResolvedValue([]),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ...Object.values(usersHandlers),
        // OPEN-08 — `SoftDeleteUserHandler` phụ thuộc `UserAccessRevocationService`
        // (thu hồi realtime tức thì). Service này có dependency `@Optional()`
        // nên chạy được trong test module không có event bus / outbox.
        UserAccessRevocationService,
        { provide: USER_REPOSITORY_PORT, useValue: repo },
        { provide: TRANSACTION_PORT, useValue: fakeTransaction() },
      ],
    }).compile();
    usersService = createHandlerProxy(module, usersHandlers);
  });

  it('cập nhật phone + bio thành công', async () => {
    const r = await usersService.updateProfile(userId, {
      phone: '+84901234567',
      bio: 'Kỹ sư dữ liệu',
    });
    expect(r.phone).toBe('+84901234567');
    expect(r.bio).toBe('Kỹ sư dữ liệu');
    expect(repo.updateProfile).toHaveBeenCalledWith(
      userId,
      expect.objectContaining({ phone: '+84901234567', bio: 'Kỹ sư dữ liệu' }),
    );
  });

  it('phone đã thuộc tài khoản khác → 409 Conflict', async () => {
    (repo.findByPhone as jest.Mock).mockResolvedValueOnce({ id: otherId });
    await expect(
      usersService.updateProfile(userId, { phone: '+84901234567' }),
    ).rejects.toThrow(ConflictError);
  });

  it('phone thuộc chính mình → OK (không lỗi)', async () => {
    (repo.findByPhone as jest.Mock).mockResolvedValueOnce({ id: userId });
    await expect(usersService.updateProfile(userId, { phone: '+84901234567' })).resolves.toBeDefined();
  });

  it('bio rỗng → đặt null (xóa giới thiệu)', async () => {
    await usersService.updateProfile(userId, { bio: '' });
    expect(repo.updateProfile).toHaveBeenCalledWith(userId, expect.objectContaining({ bio: null }));
  });

  it('không truyền phone → không gọi findByPhone', async () => {
    await usersService.updateProfile(userId, { first_name: 'New' });
    expect(repo.findByPhone).not.toHaveBeenCalled();
  });
});

describe('Nhóm G — DTO profile', () => {
  it('DTO: phone hợp lệ / không hợp lệ', () => {
    expect(UpdateUserSchema.safeParse({ phone: '+84901234567' }).success).toBe(true);
    expect(UpdateUserSchema.safeParse({ phone: '0901234567' }).success).toBe(true);
    expect(UpdateUserSchema.safeParse({ phone: 'abc' }).success).toBe(false);
    expect(UpdateUserSchema.safeParse({ phone: '123' }).success).toBe(false);
  });

  it('DTO: bio tối đa 500 ký tự', () => {
    expect(UpdateUserSchema.safeParse({ bio: 'a'.repeat(500) }).success).toBe(true);
    expect(UpdateUserSchema.safeParse({ bio: 'a'.repeat(501) }).success).toBe(false);
  });

  it('DTO: role KHÔNG cho user tự sửa (G3)', () => {
    const parsed = UpdateUserSchema.safeParse({ role: 'admin' });
    // Zod mặc định strip field lạ → `role` không xuất hiện trong kết quả.
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect('role' in (parsed.data as Record<string, unknown>)).toBe(false);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Nhóm H — 3 API nhỏ
// ─────────────────────────────────────────────────────────────────────────────

describe('Nhóm H — API nhỏ', () => {
  it('H2: CreateWorkspaceSchema chấp nhận member_emails hợp lệ', () => {
    const r = CreateWorkspaceSchema.safeParse({
      name: 'WS',
      member_emails: ['a@shool.local', 'b@shool.local'],
    });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.member_emails).toEqual(['a@shool.local', 'b@shool.local']);
  });

  it('H2: member_emails không phải email → validation error', () => {
    expect(CreateWorkspaceSchema.safeParse({ name: 'WS', member_emails: ['khong-phai-email'] }).success).toBe(false);
  });

  it('H2: member_emails tối đa 50 email', () => {
    const emails = Array.from({ length: 51 }, (_, i) => `u${i}@shool.local`);
    expect(CreateWorkspaceSchema.safeParse({ name: 'WS', member_emails: emails }).success).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Util keyset generic (in-memory) — dùng cho danh sách thành viên
// ─────────────────────────────────────────────────────────────────────────────

describe('Util keyset generic (in-memory)', () => {
  type Row = { id: string; name: string; role: string; joinedAt: Date };
  const spec = {
    code: 'name_asc',
    accessor: (r: Row) => r.name,
    direction: 1 as const,
  };
  const rows: Row[] = [
    { id: 'a', name: 'Alpha', role: 'member', joinedAt: new Date('2026-01-01') },
    { id: 'b', name: 'Beta', role: 'owner', joinedAt: new Date('2026-02-01') },
    { id: 'c', name: 'Gamma', role: 'member', joinedAt: new Date('2026-03-01') },
  ];

  it('compareGeneric sắp xếp tăng dần theo name', () => {
    const sorted = [...rows].sort((x, y) => compareGeneric(x, y, spec));
    expect(sorted.map((r) => r.id)).toEqual(['a', 'b', 'c']);
  });

  it('compareGeneric dùng tiebreaker id khi name bằng nhau', () => {
    const dup = [
      { id: 'z', name: 'X', role: 'member', joinedAt: new Date() },
      { id: 'a', name: 'X', role: 'member', joinedAt: new Date() },
    ];
    const sorted = [...dup].sort((x, y) => compareGeneric(x, y, spec));
    expect(sorted.map((r) => r.id)).toEqual(['a', 'z']);
  });

  it('isAfterGenericCursor lọc đúng phần còn lại', () => {
    const cursor = { sortCode: 'name_asc', value: 'Alpha', isNull: false, id: 'a' };
    expect(isAfterGenericCursor(rows[0] as Row, cursor, spec)).toBe(false);
    expect(isAfterGenericCursor(rows[1] as Row, cursor, spec)).toBe(true);
  });

  it('genericSortValue đánh dấu null', () => {
    const nullSpec = { code: 'x', accessor: () => null, direction: 1 as const };
    expect(genericSortValue(rows[0], nullSpec.accessor)).toEqual({ value: '', isNull: true });
  });
});
