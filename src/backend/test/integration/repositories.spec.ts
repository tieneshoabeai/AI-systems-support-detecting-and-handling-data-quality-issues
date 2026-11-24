/**
 * B2.3 — Test tích hợp cho các **Mongoose repository** (adapter hạ tầng).
 *
 * ── Vì sao cần test tích hợp? ─────────────────────────────────────────────
 * Repository là **tầng duy nhất chạm Mongoose**: filter, projection, index,
 * soft-delete, keyset pagination, optimistic-lock (`version`) — những thứ
 * **không thể chứng minh** bằng unit test với model giả, vì chúng phụ thuộc
 * hành vi thật của MongoDB (ví dụ partial unique index, `$pull` với điều kiện
 * lồng, sort theo ObjectId).
 *
 * Yêu cầu hạ tầng:
 * ```bash
 * pnpm run test:infra:up   # mongo replica set rs0 @27018
 * ```
 */
import { Test, TestingModule } from '@nestjs/testing';
import { getConnectionToken } from '@nestjs/mongoose';
import { Connection, Model, Types } from 'mongoose';
import { UserSchema, type IUser } from '../../src/modules/users/infrastructure/persistence/user.schema';
import { UserSessionSchema, type IUserSession } from '../../src/modules/users/infrastructure/persistence/user-session.schema';
import {
  WorkspaceSchema,
  type IWorkspace,
} from '../../src/modules/workspaces/infrastructure/persistence/workspace.schema';
import {
  NotificationSchema,
  type INotification,
} from '../../src/modules/notifications/notifications.schema';
import {
  IssueReportSchema,
  type IIssueReport,
} from '../../src/modules/issues/infrastructure/persistence/issue-report.schema';
import { UsersRepository } from '../../src/modules/users/infrastructure/persistence/users.repository';
import { WorkspacesRepository } from '../../src/modules/workspaces/infrastructure/persistence/workspaces.repository';
import { NotificationsRepository } from '../../src/modules/notifications/notifications.repository';
import { IssuesRepository } from '../../src/modules/issues/infrastructure/persistence/issues.repository';
import { parseListCursor } from '../../src/shared/domain/pagination/keyset-cursor';
import { detectInfra, openTestConnection } from '../helpers/test-infra';

describe('B2.3 — Mongoose repository trên MongoDB thật', () => {
  let conn: Connection;
  let userModel: Model<IUser>;
  let sessionModel: Model<IUserSession>;
  let workspaceModel: Model<IWorkspace>;
  let notificationModel: Model<INotification>;
  let issueModel: Model<IIssueReport>;

  let users: UsersRepository;
  let workspaces: WorkspacesRepository;
  let notifications: NotificationsRepository;
  let issues: IssuesRepository;

  const oid = (): string => new Types.ObjectId().toHexString();

  beforeAll(async () => {
    const infra = await detectInfra();
    if (!infra.mongo) {
      throw new Error(
        '[B2.3] Thiếu hạ tầng test: MongoDB chưa sẵn sàng. Chạy `pnpm run test:infra:up` trước.',
      );
    }
    conn = await openTestConnection();

    userModel = conn.model('User', UserSchema) as unknown as Model<IUser>;
    sessionModel = conn.model('UserSession', UserSessionSchema) as unknown as Model<IUserSession>;
    workspaceModel = conn.model('Workspace', WorkspaceSchema) as unknown as Model<IWorkspace>;
    notificationModel = conn.model(
      'Notification',
      NotificationSchema,
    ) as unknown as Model<INotification>;
    issueModel = conn.model('IssueReport', IssueReportSchema) as unknown as Model<IIssueReport>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        { provide: getConnectionToken(), useValue: conn },
        { provide: 'UserModel', useValue: userModel },
        { provide: 'UserSessionModel', useValue: sessionModel },
        { provide: 'WorkspaceModel', useValue: workspaceModel },
        { provide: 'NotificationModel', useValue: notificationModel },
        { provide: 'IssueReportModel', useValue: issueModel },
        UsersRepository,
        WorkspacesRepository,
        NotificationsRepository,
        IssuesRepository,
      ],
    }).compile();

    // Unique index (partial) chỉ tồn tại sau khi syncIndexes() — `conn.model()`
    // KHÔNG tự tạo index ⇒ `createIfEventNotExists` cần index thật để bắt lỗi 11000.
    await Promise.all([
      userModel.syncIndexes(),
      sessionModel.syncIndexes(),
      workspaceModel.syncIndexes(),
      notificationModel.syncIndexes(),
      issueModel.syncIndexes(),
    ]);

    users = module.get(UsersRepository);
    workspaces = module.get(WorkspacesRepository);
    notifications = module.get(NotificationsRepository);
    issues = module.get(IssuesRepository);
  }, 30000);

  afterAll(async () => {
    if (conn) await conn.close().catch(() => undefined);
  });

  beforeEach(async () => {
    await userModel.deleteMany({});
    await sessionModel.deleteMany({});
    await workspaceModel.deleteMany({});
    await notificationModel.deleteMany({});
    await issueModel.deleteMany({});
  });

  // ───────────────────────────────���───────────────────────────────────────────
  // USERS
  // ───────────────────────────────────────────────────────────────────────────

  describe('UsersRepository', () => {
    it('create → findByEmail/findById trả về entity đúng', async () => {
      const created = await users.create({
        email: '  Alice@Example.COM ',
        passwordHash: 'hash-1',
        googleId: null,
        avatarUrl: null,
        firstName: 'Alice',
        lastName: 'Nguyen',
        role: 'analyst',
        authProvider: 'local',
      });

      expect(created.id).toBeTruthy();
      expect(created.email).toBe('alice@example.com'); // schema lowercase + trim

      const byEmail = await users.findByEmail('alice@example.com');
      expect(byEmail?.id).toBe(created.id);
      expect(byEmail?.firstName).toBe('Alice');

      const byId = await users.findById(created.id);
      expect(byId?.email).toBe('alice@example.com');
    });

    it('findByEmail KHÔNG kèm password_hash mặc định, có khi includePassword=true', async () => {
      await users.create({
        email: 'bob@example.com',
        passwordHash: 'secret-hash',
        googleId: null,
        avatarUrl: null,
        firstName: 'Bob',
        lastName: 'Tran',
        role: 'analyst',
        authProvider: 'local',
      });

      const without = await users.findByEmail('bob@example.com');
      expect(without?.passwordHash).toBeNull();

      const withPwd = await users.findByEmail('bob@example.com', true);
      expect(withPwd?.passwordHash).toBe('secret-hash');
    });

    it('findById với id không hợp lệ ⇒ null (không ném lỗi)', async () => {
      await expect(users.findById('not-an-objectid')).resolves.toBeNull();
      await expect(users.findById('')).resolves.toBeNull();
    });

    it('softDeleteUser ⇒ user bị ẩn + toàn bộ session bị thu hồi', async () => {
      const user = await users.create({
        email: 'carol@example.com',
        passwordHash: 'h',
        googleId: null,
        avatarUrl: null,
        firstName: 'Carol',
        lastName: 'Le',
        role: 'analyst',
        authProvider: 'local',
      });
      const session = await users.createSession({
        userId: user.id,
        refreshTokenHash: 'tok-1',
        expiresAt: new Date(Date.now() + 86400000),
      });

      const ok = await users.softDeleteUser(user.id);
      expect(ok).toBe(true);

      expect(await users.findById(user.id)).toBeNull();
      expect(await users.findByEmail('carol@example.com')).toBeNull();

      const revoked = await users.findSessionByTokenHashIncludingRevoked('tok-1');
      expect(revoked?.isRevoked).toBe(true);
      expect(await users.findSessionByTokenHash('tok-1')).toBeNull();
      expect(session.id).toBeTruthy();
    });

    it('softDeleteUser với user không tồn tại ⇒ false', async () => {
      await expect(users.softDeleteUser(oid())).resolves.toBe(false);
    });

    it('setStatus chặn / mở khóa tài khoản', async () => {
      const user = await users.create({
        email: 'dave@example.com',
        passwordHash: 'h',
        googleId: null,
        avatarUrl: null,
        firstName: 'Dave',
        lastName: 'Pham',
        role: 'analyst',
        authProvider: 'local',
      });

      expect(await users.setStatus(user.id, 'blocked')).toBe(true);
      expect((await users.findById(user.id))?.status).toBe('blocked');

      expect(await users.setStatus(user.id, 'active')).toBe(true);
      expect((await users.findById(user.id))?.status).toBe('active');

      expect(await users.setStatus('khong-hop-le', 'blocked')).toBe(false);
    });

    it('reset password: setPasswordResetOtp → incrementResetAttempts → clearPasswordReset', async () => {
      const user = await users.create({
        email: 'erin@example.com',
        passwordHash: 'h',
        googleId: null,
        avatarUrl: null,
        firstName: 'Erin',
        lastName: 'Vu',
        role: 'analyst',
        authProvider: 'local',
      });

      const expiry = new Date(Date.now() + 600000);
      const ok = await users.setPasswordResetOtp(
        'erin@example.com',
        'otp-hash',
        expiry,
        1,
        new Date(),
      );
      expect(ok).toBe(true);

      const secret = await users.findByEmailWithResetSecret('erin@example.com');
      expect(secret?.tokenHash).toBe('otp-hash');

      expect(await users.incrementResetAttempts('erin@example.com')).toBe(1);
      expect(await users.incrementResetAttempts('erin@example.com')).toBe(2);

      expect(await users.clearPasswordReset('erin@example.com')).toBe(true);
      const after = await users.findByEmailWithResetSecret('erin@example.com');
      expect(after?.tokenHash).toBeNull();
      expect(user.id).toBeTruthy();
    });

    it('createWithGoogle tạo tài khoản không mật khẩu + linkGoogleId', async () => {
      const created = await users.createWithGoogle({
        email: 'gina@example.com',
        googleId: 'google-123',
        firstName: 'Gina',
        lastName: 'Ho',
      });

      expect(created.authProvider).toBe('google');
      expect(created.passwordHash).toBeNull();
      expect((await users.findByGoogleId('google-123'))?.id).toBe(created.id);

      // google_id đã bị tài khoản khác chiếm ⇒ không liên kết được.
      const other = await users.create({
        email: 'other@example.com',
        passwordHash: 'h',
        googleId: null,
        avatarUrl: null,
        firstName: 'Other',
        lastName: 'User',
        role: 'analyst',
        authProvider: 'local',
      });
      expect(await users.linkGoogleId(other.id, 'google-123')).toBeNull();
      expect(await users.linkGoogleId('khong-hop-le', 'google-999')).toBeNull();
      expect(await users.linkGoogleId(other.id, '   ')).toBeNull();
    });

    it('findByIds bỏ qua id không hợp lệ và trả về mảng rỗng khi không có id hợp lệ', async () => {
      const a = await users.create({
        email: 'a@example.com',
        passwordHash: 'h',
        googleId: null,
        avatarUrl: null,
        firstName: 'A',
        lastName: 'A',
        role: 'analyst',
        authProvider: 'local',
      });
      const b = await users.create({
        email: 'b@example.com',
        passwordHash: 'h',
        googleId: null,
        avatarUrl: null,
        firstName: 'B',
        lastName: 'B',
        role: 'analyst',
        authProvider: 'local',
      });

      const found = await users.findByIds([a.id, b.id]);
      expect(found).toHaveLength(2);

      expect(await users.findByIds(['khong-hop-le'])).toEqual([]);
    });

    it('findByPhone trả null khi số rỗng hoặc không tồn tại', async () => {
      const user = await users.create({
        email: 'hank@example.com',
        passwordHash: 'h',
        googleId: null,
        avatarUrl: null,
        firstName: 'Hank',
        lastName: 'Do',
        role: 'analyst',
        authProvider: 'local',
      });
      await users.updateProfile(user.id, { phone: '+84900111222' });

      expect((await users.findByPhone('+84900111222'))?.id).toBe(user.id);
      expect(await users.findByPhone('   ')).toBeNull();
      expect(await users.findByPhone('+84999999999')).toBeNull();
    });

    it('updateProfile chỉ cập nhật field được truyền', async () => {
      const user = await users.create({
        email: 'ivy@example.com',
        passwordHash: 'h',
        googleId: null,
        avatarUrl: null,
        firstName: 'Ivy',
        lastName: 'Ivy',
        role: 'analyst',
        authProvider: 'local',
      });

      const updated = await users.updateProfile(user.id, { firstName: 'Ivy2', bio: 'Tiểu sử' });
      expect(updated?.firstName).toBe('Ivy2');
      expect(updated?.lastName).toBe('Ivy');
      expect(updated?.bio).toBe('Tiểu sử');
    });

    it('updateNotificationPreferences bật/tắt thông báo', async () => {
      const user = await users.create({
        email: 'jack@example.com',
        passwordHash: 'h',
        googleId: null,
        avatarUrl: null,
        firstName: 'Jack',
        lastName: 'Jack',
        role: 'analyst',
        authProvider: 'local',
      });
      expect(await users.updateNotificationPreferences(user.id, false)).toBe(true);
      expect((await users.findById(user.id))?.notificationsEnabled).toBe(false);
    });

    it('quản lý session: touch / revoke / revokeAll', async () => {
      const user = await users.create({
        email: 'kim@example.com',
        passwordHash: 'h',
        googleId: null,
        avatarUrl: null,
        firstName: 'Kim',
        lastName: 'Kim',
        role: 'analyst',
        authProvider: 'local',
      });

      const s1 = await users.createSession({
        userId: user.id,
        refreshTokenHash: 'tok-a',
        expiresAt: new Date(Date.now() + 86400000),
        deviceName: 'Chrome',
      });
      const s2 = await users.createSession({
        userId: user.id,
        refreshTokenHash: 'tok-b',
        expiresAt: new Date(Date.now() + 86400000),
      });

      expect((await users.findActiveSessions(user.id)).length).toBe(2);

      const touched = new Date();
      expect(await users.touchSession(s1.id, touched)).toBe(true);
      expect(await users.touchSession('khong-hop-le', touched)).toBe(false);

      expect(await users.revokeSession(user.id, s1.id)).toBe(true);
      expect(await users.revokeSessionById(s2.id)).toBe(true);
      expect((await users.findActiveSessions(user.id)).length).toBe(0);

      const s3 = await users.createSession({
        userId: user.id,
        refreshTokenHash: 'tok-c',
        expiresAt: new Date(Date.now() + 86400000),
      });
      expect(await users.revokeAllUserSessions(user.id)).toBeGreaterThanOrEqual(1);
      expect(await users.findSessionById(s3.id)).not.toBeNull();
    });

    it('findSessionByTokenHash bỏ qua session đã hết hạn', async () => {
      const user = await users.create({
        email: 'leo@example.com',
        passwordHash: 'h',
        googleId: null,
        avatarUrl: null,
        firstName: 'Leo',
        lastName: 'Leo',
        role: 'analyst',
        authProvider: 'local',
      });
      await users.createSession({
        userId: user.id,
        refreshTokenHash: 'tok-expired',
        expiresAt: new Date(Date.now() - 1000),
      });
      expect(await users.findSessionByTokenHash('tok-expired')).toBeNull();
    });

    it('findPaged lọc theo search + phân trang keyset', async () => {
      for (const email of ['pa@example.com', 'pb@example.com', 'pc@example.com']) {
        await users.create({
          email,
          passwordHash: 'h',
          googleId: null,
          avatarUrl: null,
          firstName: email[0]!.toUpperCase(),
          lastName: 'Page',
          role: 'analyst',
          authProvider: 'local',
        });
      }

      const page1 = await users.findPaged({ limit: 2 });
      expect(page1.items.length).toBe(2);
      expect(page1.hasMore).toBe(true);
      expect(page1.nextCursor).toBeTruthy();

      // Con trỏ phải khớp mã sort hiện tại (`created_at_desc` là mặc định).
      const cursor = parseListCursor(page1.nextCursor ?? undefined, 'created_at_desc');
      const page2 = await users.findPaged({ limit: 2, cursor });
      expect(page2.items.length).toBe(1);
      expect(page2.hasMore).toBe(false);

      const searched = await users.findPaged({ search: 'pa@' });
      expect(searched.items.length).toBe(1);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // WORKSPACES
  // ───────────────────────────────────────────────────────────────────────────

  describe('WorkspacesRepository', () => {
    it('create → findById trả entity, owner tự động là member role=owner', async () => {
      const ownerId = oid();
      const ws = await workspaces.create({ name: ' WS của tôi ', description: 'mô tả', ownerId });

      expect(ws.name).toBe('WS của tôi');
      expect(ws.ownerId).toBe(ownerId);
      expect(ws.members).toHaveLength(1);
      expect(ws.members[0]?.role).toBe('owner');
    });

    it('softDelete ⇒ findById trả null, findDeletedIds có id', async () => {
      const ws = await workspaces.create({ name: 'WS xoá', description: '', ownerId: oid() });

      expect(await workspaces.softDelete(ws.id)).toBe(true);
      expect(await workspaces.findById(ws.id)).toBeNull();
      expect(await workspaces.findDeletedIds()).toContain(ws.id);
      expect(await workspaces.softDelete('khong-hop-le')).toBe(false);
    });

    it('updateById với expectedVersion ⇒ optimistic lock', async () => {
      const ws = await workspaces.create({ name: 'WS version', description: '', ownerId: oid() });

      const ok = await workspaces.updateById(ws.id, { name: 'Tên mới' }, ws.version);
      expect(ok?.name).toBe('Tên mới');

      // version cũ ⇒ không cập nhật được.
      const stale = await workspaces.updateById(ws.id, { name: 'Tên cũ' }, ws.version);
      expect(stale).toBeNull();
    });

    it('thêm / xoá / đổi vai trò thành viên', async () => {
      const memberId = oid();
      const ws = await workspaces.create({ name: 'WS members', description: '', ownerId: oid() });

      expect(await workspaces.addMember(ws.id, { userId: memberId, role: 'member', joinedAt: new Date() })).toBe(true);
      const withMember = await workspaces.findById(ws.id);
      expect(withMember?.members).toHaveLength(2);

      expect(await workspaces.updateMemberRole(ws.id, memberId, 'owner')).toBe(true);
      expect(await workspaces.removeMember(ws.id, memberId)).toBe(true);
      expect((await workspaces.findById(ws.id))?.members).toHaveLength(1);
    });

    it('updateMemberRole với expectedVersion lệch ⇒ trả null (không phải false)', async () => {
      const memberId = oid();
      const ws = await workspaces.create({ name: 'WS role lock', description: '', ownerId: oid() });
      await workspaces.addMember(ws.id, { userId: memberId, role: 'member', joinedAt: new Date() });

      const result = await workspaces.updateMemberRole(ws.id, memberId, 'owner', ws.version + 99);
      expect(result).toBeNull();
    });

    it('addStorageUsed + touchLastAccessed cập nhật số liệu', async () => {
      const ws = await workspaces.create({ name: 'WS storage', description: '', ownerId: oid() });

      await workspaces.addStorageUsed(ws.id, 1000);
      await workspaces.addStorageUsed(ws.id, -250);
      expect((await workspaces.findById(ws.id))?.storageUsedBytes).toBe(750);

      await workspaces.touchLastAccessed(ws.id);
      expect((await workspaces.findById(ws.id))?.lastAccessedAt).not.toBeNull();
    });

    it('đếm: countActive / countOwnedByUser / countSharedByUser', async () => {
      const ownerId = oid();
      const memberId = oid();
      const ws1 = await workspaces.create({ name: 'WS đếm 1', description: '', ownerId });
      const ws2 = await workspaces.create({ name: 'WS đếm 2', description: '', ownerId });
      await workspaces.addMember(ws2.id, { userId: memberId, role: 'member', joinedAt: new Date() });

      expect(await workspaces.countActive()).toBe(2);
      expect(await workspaces.countOwnedByUser(ownerId)).toBe(2);
      expect(await workspaces.countSharedByUser(memberId)).toBe(1);

      await workspaces.softDelete(ws1.id);
      expect(await workspaces.countActive()).toBe(1);
    });

    it('findByUser thấy cả workspace sở hữu lẫn workspace được chia sẻ', async () => {
      const ownerId = oid();
      const memberId = oid();
      await workspaces.create({ name: 'WS của tôi', description: '', ownerId });
      const shared = await workspaces.create({ name: 'WS được share', description: '', ownerId: oid() });
      await workspaces.addMember(shared.id, { userId: memberId, role: 'member', joinedAt: new Date() });

      const found = await workspaces.findByUser(memberId);
      expect(found).toHaveLength(1);
      expect(found[0]?.id).toBe(shared.id);
    });

    it('findByUserPaged lọc theo role owner/member', async () => {
      const ownerId = oid();
      const memberId = oid();
      await workspaces.create({ name: 'WS owner', description: '', ownerId });
      const shared = await workspaces.create({ name: 'WS shared', description: '', ownerId: oid() });
      await workspaces.addMember(shared.id, { userId: memberId, role: 'member', joinedAt: new Date() });

      const asOwner = await workspaces.findByUserPaged(ownerId, { role: 'owner' });
      expect(asOwner.items).toHaveLength(1);

      const asMember = await workspaces.findByUserPaged(memberId, { role: 'member' });
      expect(asMember.items).toHaveLength(1);

      const all = await workspaces.findByUserPaged(memberId, {});
      expect(all.items).toHaveLength(1);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // NOTIFICATIONS
  // ───────────────────────────────────────────────────────────────────────────

  describe('NotificationsRepository', () => {
    it('create → findByIdForUser chỉ trả về thông báo của đúng user', async () => {
      const userId = oid();
      const created = await notifications.create({
        userId,
        type: 'project_created',
        isMandatory: false,
        title: 'Dự án mới',
        summary: 'mô tả',
        payload: { targetType: 'project', targetId: 'p1', actionUrl: '/projects/p1' },
      });

      expect(created.title).toBe('Dự án mới');
      expect((await notifications.findByIdForUser(created.id, userId))?.title).toBe('Dự án mới');
      expect(await notifications.findByIdForUser(created.id, oid())).toBeNull();
      expect(await notifications.findByIdForUser('khong-hop-le', userId)).toBeNull();
    });

    it('listForUser lọc theo read + phân trang con trỏ', async () => {
      const userId = oid();
      const n1 = await notifications.create({
        userId,
        type: 'project_created',
        isMandatory: false,
        title: 'N1',
      });
      const n2 = await notifications.create({
        userId,
        type: 'project_deleted',
        isMandatory: false,
        title: 'N2',
      });

      await notifications.markAsRead(n1.id, userId);

      expect(await notifications.countUnread(userId)).toBe(1);
      expect(
        await notifications.listForUser(userId, { read: 'true', limit: 10, sortOrder: 'desc' }),
      ).toHaveLength(1);
      expect(
        await notifications.listForUser(userId, { read: 'false', limit: 10, sortOrder: 'desc' }),
      ).toHaveLength(1);
      expect(
        await notifications.listForUser(userId, { read: 'all', limit: 10, sortOrder: 'desc' }),
      ).toHaveLength(2);
      expect(
        await notifications.listForUser('khong-hop-le', {
          read: 'all',
          limit: 10,
          sortOrder: 'desc',
        }),
      ).toEqual([]);

      expect(n2.id).toBeTruthy();
    });

    it('markAsRead đánh dấu đã đọc', async () => {
      const userId = oid();
      const n = await notifications.create({
        userId,
        type: 'analysis_completed',
        isMandatory: false,
        title: 'Xong',
      });

      const read = await notifications.markAsRead(n.id, userId);
      expect(read?.readAt).not.toBeNull();
      expect(await notifications.countUnread(userId)).toBe(0);
      expect(await notifications.markAsRead('khong-hop-le', userId)).toBeNull();
    });

    it('createIfEventNotExists ⇒ trùng sourceEventId trả null (unique index)', async () => {
      const userId = oid();
      const doc = {
        userId,
        type: 'analysis_completed' as const,
        isMandatory: false,
        title: 'AI xong',
        sourceEventId: 'evt-1',
      };

      const first = await notifications.createIfEventNotExists(doc);
      expect(first).not.toBeNull();

      const second = await notifications.createIfEventNotExists(doc);
      expect(second).toBeNull();

      expect(await notifications.existsByEvent(userId, 'evt-1')).toBe(true);
      expect(await notifications.existsByEvent(userId, 'evt-khong')).toBe(false);
      expect(await notifications.existsByEvent('khong-hop-le', 'evt-1')).toBe(false);
    });

    it('createIfEventNotExists không có sourceEventId ⇒ tạo bình thường', async () => {
      const created = await notifications.createIfEventNotExists({
        userId: oid(),
        type: 'report_ready',
        isMandatory: false,
        title: 'Báo cáo',
      });
      expect(created).not.toBeNull();
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // ISSUES
  // ───────────────────────────────────────────────────────────────────────────

  describe('IssuesRepository', () => {
    it('create → findById / findByIdForUser', async () => {
      const userId = oid();
      const issue = await issues.create({
        userId,
        issueType: 'function_error',
        title: 'Lỗi khi xuất',
        description: 'Không xuất được file',
      });

      expect(issue.title).toBe('Lỗi khi xuất');
      expect(issue.status).toBe('new');
      expect((await issues.findById(issue.id))?.id).toBe(issue.id);
      expect((await issues.findByIdForUser(issue.id, userId))?.id).toBe(issue.id);
      expect(await issues.findByIdForUser(issue.id, oid())).toBeNull();
      expect(await issues.findById('khong-hop-le')).toBeNull();
    });

    it('updateStatus với expectedVersion ⇒ optimistic lock + tăng version', async () => {
      const userId = oid();
      const issue = await issues.create({
        userId,
        issueType: 'other',
        title: 'T',
        description: 'D',
      });

      const updated = await issues.updateStatus(issue.id, 'needs_info', issue.version);
      expect(updated?.status).toBe('needs_info');
      expect(updated?.version).toBe(issue.version + 1);

      const stale = await issues.updateStatus(issue.id, 'resolved', issue.version);
      expect(stale).toBeNull();
    });

    it('updateByUser chỉ áp dụng cho issue status=needs_info và gỡ tệp đính kèm', async () => {
      const userId = oid();
      const issue = await issues.create({
        userId,
        issueType: 'data_error',
        title: 'Tiêu đề cũ',
        description: 'Mô tả cũ',
      });
      await issues.updateStatus(issue.id, 'needs_info', issue.version);

      const attachmentId = new Types.ObjectId();
      await issues.addAttachment(issue.id, {
        id: attachmentId.toHexString(),
        filename: 'log.txt',
        storageKey: 'issues/log.txt',
        sizeBytes: 10,
        contentType: 'text/plain',
      });
      const withAttachment = await issues.findById(issue.id);
      expect(withAttachment?.attachments).toHaveLength(1);

      const updated = await issues.updateByUser(issue.id, {
        userId,
        expectedVersion: withAttachment?.version ?? 1,
        title: 'Tiêu đề mới',
        removeAttachmentIds: [attachmentId.toHexString()],
      });

      expect(updated?.title).toBe('Tiêu đề mới');
      expect(updated?.status).toBe('in_progress');
      expect(updated?.attachments).toHaveLength(0);
    });

    it('updateByUser với user khác hoặc version sai ⇒ null', async () => {
      const userId = oid();
      const issue = await issues.create({
        userId,
        issueType: 'other',
        title: 'T',
        description: 'D',
      });
      await issues.updateStatus(issue.id, 'needs_info', issue.version);

      expect(
        await issues.updateByUser(issue.id, { userId: oid(), expectedVersion: issue.version }),
      ).toBeNull();
      expect(
        await issues.updateByUser(issue.id, {
          userId,
          expectedVersion: issue.version + 50,
        }),
      ).toBeNull();
      expect(await issues.updateByUser('khong-hop-le', { userId, expectedVersion: 1 })).toBeNull();
    });

    it('list lọc theo userId / status + phân trang con trỏ', async () => {
      const userA = oid();
      const userB = oid();
      const i1 = await issues.create({
        userId: userA,
        issueType: 'other',
        title: 'A1',
        description: 'D',
      });
      await issues.create({
        userId: userB,
        issueType: 'other',
        title: 'B1',
        description: 'D',
      });
      await issues.updateStatus(i1.id, 'resolved', i1.version);

      const baseOpts = { limit: 10, sortBy: 'createdAt', sortOrder: 'desc' } as const;
      expect(await issues.list(baseOpts)).toHaveLength(2);
      expect(await issues.list({ ...baseOpts, userId: userA })).toHaveLength(1);
      expect(await issues.list({ ...baseOpts, status: 'resolved' })).toHaveLength(1);
      expect(await issues.list({ ...baseOpts, userId: 'khong-hop-le' })).toEqual([]);
    });

    it('findStatusById trả status hiện tại', async () => {
      const issue = await issues.create({
        userId: oid(),
        issueType: 'other',
        title: 'T',
        description: 'D',
      });
      expect(await issues.findStatusById(issue.id)).toBe('new');
      expect(await issues.findStatusById('khong-hop-le')).toBeNull();
    });

    it('addAttachment với id không hợp lệ ⇒ null', async () => {
      expect(
        await issues.addAttachment('khong-hop-le', {
          id: oid(),
          filename: 'a.txt',
          storageKey: 'k',
          sizeBytes: 1,
          contentType: 'text/plain',
        }),
      ).toBeNull();
    });
  });
});
