/**
 * Gap analysis P2 + P3 (2026-11-18) — hợp đồng §3.4 / §3.5.
 *
 * P2: thêm route `GET /auth/sessions/me` — trả phiên đăng nhập hiện tại.
 *     Route PHẢI khai báo TRƯỚC `GET /auth/sessions/:id` (NestJS match theo thứ tự).
 * P3: `GET /admin/users` chuyển từ offset pagination (`page`/`total`) sang
 *     **keyset cursor** + `sortBy`/`sortOrder` để khớp §3.4.
 */
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, CanActivate, ExecutionContext } from '@nestjs/common';
import request from 'supertest';
import { AllExceptionsFilter } from '../src/shared/interfaces/filters/all-exceptions.filter';
import { TransformInterceptor } from '../src/shared/interfaces/interceptors/transform.interceptor';
import { AuthController } from '../src/modules/auth/presentation/controllers/auth.controller';
import { AdminUsersController } from '../src/modules/users/presentation/controllers/admin-users.controller';
import { JwtAuthGuard } from '../src/shared/interfaces/guards/jwt-auth.guard';
import { RolesGuard } from '../src/shared/interfaces/guards/roles.guard';
import { GetSessionByIdHandler } from '../src/modules/auth/application/queries/get-session-by-id.handler';
import { FindPagedHandler } from '../src/modules/users/application/queries/find-paged.handler';
import { USER_REPOSITORY_PORT } from '../src/modules/users/domain/ports/user.repository.port';
import { FindByIdHandler } from '../src/modules/users/application/queries/find-by-id.handler';
import { LoginWithGoogleHandler } from '../src/modules/auth/application/commands/login-with-google.handler';
import { ChangePasswordHandler } from '../src/modules/auth/application/commands/change-password.handler';
import { ForgotPasswordHandler } from '../src/modules/auth/application/commands/forgot-password.handler';
import { LoginHandler } from '../src/modules/auth/application/commands/login.handler';
import { LogoutHandler } from '../src/modules/auth/application/commands/logout.handler';
import { RefreshAccessTokenHandler } from '../src/modules/auth/application/commands/refresh-access-token.handler';
import { RegisterHandler } from '../src/modules/auth/application/commands/register.handler';
import { ResetPasswordHandler } from '../src/modules/auth/application/commands/reset-password.handler';
import { RevokeSessionHandler } from '../src/modules/auth/application/commands/revoke-session.handler';
import { GetSessionsHandler } from '../src/modules/auth/application/queries/get-sessions.handler';
import { encodeKeysetCursor } from '../src/shared/domain/pagination/keyset-cursor';
import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * Guard giả — gắn `request.user` cố định, bỏ qua Passport.
 * Dùng để test controller mà không cần hạ tầng xác thực thật.
 */
function fakeAuthGuard(user: Record<string, unknown>): CanActivate {
  return {
    canActivate(context: ExecutionContext): boolean {
      const req = context.switchToHttp().getRequest<{ user?: unknown }>();
      req.user = user;
      return true;
    },
  };
}

/** Guard giả cho `RolesGuard` — luôn cho qua (quyền đã kiểm ở test khác). */
const fakeRolesGuard: CanActivate = {
  canActivate(): boolean {
    return true;
  },
};

/** Danh tính giả: admin có `sessionId` để test `GET /auth/sessions/me`. */
const FAKE_ADMIN = {
  userId: 'user-1',
  email: 'admin@test.local',
  role: 'admin',
  sessionId: 'sess-1',
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// P2 — GET /auth/sessions/me
// ─────────────────────────────────────────────────────────────────────────────

describe('P2 — GET /auth/sessions/me', () => {
  let app: INestApplication;

  const executeSpy = jest.fn();

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        { provide: GetSessionByIdHandler, useValue: { execute: executeSpy } },
        { provide: LoginWithGoogleHandler, useValue: {} },
        { provide: ChangePasswordHandler, useValue: {} },
        { provide: ForgotPasswordHandler, useValue: {} },
        { provide: LoginHandler, useValue: {} },
        { provide: LogoutHandler, useValue: {} },
        { provide: RefreshAccessTokenHandler, useValue: {} },
        { provide: RegisterHandler, useValue: {} },
        { provide: ResetPasswordHandler, useValue: {} },
        { provide: RevokeSessionHandler, useValue: {} },
        { provide: GetSessionsHandler, useValue: {} },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue(fakeAuthGuard({ ...FAKE_ADMIN }))
      .compile();

    app = module.createNestApplication();
    app.useGlobalFilters(new AllExceptionsFilter());
    app.useGlobalInterceptors(new TransformInterceptor());
    await app.init();
  });

  afterAll(async () => {
    await app?.close();
  });

  beforeEach(() => {
    executeSpy.mockReset();
  });

  it('route `/auth/sessions/me` khai báo TRƯỚC `/auth/sessions/:id`', () => {
    // Đọc source controller để kiểm tra **thứ tự khai báo** (NestJS match theo thứ tự).
    // Chỉ xét dòng decorator thực sự (`@Get(...)` ở đầu dòng), không tính comment.
    const source = readFileSync(
      join(__dirname, '../src/modules/auth/presentation/controllers/auth.controller.ts'),
      'utf8',
    );
    const lines = source.split('\n');
    const meIdx = lines.findIndex((l) => /^\s*@Get\('sessions\/me'\)/.test(l));
    const byIdIdx = lines.findIndex((l) => /^\s*@Get\('sessions\/:id'\)/.test(l));
    expect(meIdx).toBeGreaterThan(-1);
    expect(byIdIdx).toBeGreaterThan(-1);
    expect(meIdx).toBeLessThan(byIdIdx);
  });

  it('gọi handler với sessionId từ JWT (không nhận sessionId từ client)', async () => {
    executeSpy.mockResolvedValue({ id: 'sess-1' });

    const res = await request(app.getHttpServer()).get('/auth/sessions/me');

    expect(res.status).toBe(200);
    // `sessionId` lấy từ `request.user.sessionId` — KHÔNG phải từ query/path.
    expect(executeSpy).toHaveBeenCalledWith('user-1', 'sess-1');
  });

  it('không nhận `sessionId` từ query string (chống truy cập phiên người khác)', async () => {
    executeSpy.mockResolvedValue({ id: 'sess-1' });

    await request(app.getHttpServer()).get('/auth/sessions/me?sessionId=sess-khac');

    // Vẫn phải dùng sessionId trong JWT, không phải giá trị client gửi lên.
    expect(executeSpy).toHaveBeenCalledWith('user-1', 'sess-1');
  });

  it('route `/auth/sessions/:id` vẫn hoạt động (không bị `:id` nuốt mất)', async () => {
    executeSpy.mockResolvedValue({ id: 'sess-2' });

    const res = await request(app.getHttpServer()).get('/auth/sessions/sess-2');

    expect(res.status).toBe(200);
    expect(executeSpy).toHaveBeenCalledWith('user-1', 'sess-2');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// P3 — GET /admin/users dùng keyset cursor + sortBy/sortOrder
// ─────────────────────────────────────────────────────────────────────────────

describe('P3 — GET /admin/users keyset cursor + sortBy/sortOrder', () => {
  let app: INestApplication;

  // Dùng handler THẬT + repository giả → validation logic (sortBy/cursor) được
  // kiểm đúng như production, chỉ thay lớp truy cập dữ liệu.
  const findPaged = jest.fn();
  const findById = jest.fn();

  const makeUser = (id: string, createdAt: string) => ({
    id,
    email: `${id}@example.com`,
    firstName: 'A',
    lastName: 'B',
    role: 'analyst' as const,
    status: 'active' as const,
    authProvider: 'local' as const,
    googleId: null,
    phone: null,
    bio: null,
    avatarUrl: null,
    passwordHash: null,
    notificationsEnabled: true,
    deletedAt: null,
    version: 1,
    createdAt: new Date(createdAt),
    updatedAt: new Date(createdAt),
    lastLoginAt: null,
  });

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AdminUsersController],
      providers: [
        FindPagedHandler,
        { provide: FindByIdHandler, useValue: { execute: findById } },
        { provide: USER_REPOSITORY_PORT, useValue: { findPaged } },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue(fakeAuthGuard({ ...FAKE_ADMIN }))
      .overrideGuard(RolesGuard)
      .useValue(fakeRolesGuard)
      .compile();

    app = module.createNestApplication();
    app.useGlobalFilters(new AllExceptionsFilter());
    app.useGlobalInterceptors(new TransformInterceptor());
    await app.init();
  });

  afterAll(async () => {
    await app?.close();
  });

  beforeEach(() => {
    findPaged.mockReset();
    // Repository trả `{ items, nextCursor, hasMore }` — handler bọc thành `{ items, meta }`.
    findPaged.mockResolvedValue({ items: [], nextCursor: null, hasMore: false });
  });

  it('mặc định: sortBy=createdAt, sortOrder=desc, limit=15', async () => {
    const res = await request(app.getHttpServer()).get('/admin/users');

    expect(res.status).toBe(200);
    expect(findPaged).toHaveBeenCalledWith(
      expect.objectContaining({ sort: 'created_at', sortOrder: 'desc', limit: 15 }),
    );
  });

  it('response có `items` + `meta` và KHÔNG có `total`/`page`', async () => {
    const items = [makeUser('u1', '2026-01-01T00:00:00.000Z')];
    findPaged.mockResolvedValue({ items, nextCursor: 'abc', hasMore: true });

    const res = await request(app.getHttpServer()).get('/admin/users');

    expect(res.status).toBe(200);
    const data = res.body.data ?? res.body;
    expect(data.items).toHaveLength(1);
    expect(data.meta).toEqual({ nextCursor: 'abc', hasMore: true, limit: 15 });
    expect(data.total).toBeUndefined();
    expect(data.page).toBeUndefined();
  });

  it('sortBy không hợp lệ → 400 VALIDATION_ERROR (không fallback im lặng)', async () => {
    const res = await request(app.getHttpServer()).get('/admin/users?sortBy=khongTonTai');

    expect(res.status).toBe(400);
    const body = res.body.error ?? res.body;
    expect(body.code).toBe('VALIDATION_ERROR');
    // Handler không được gọi.
    expect(findPaged).not.toHaveBeenCalled();
  });

  it('limit vượt 100 → 400 VALIDATION_ERROR', async () => {
    const res = await request(app.getHttpServer()).get('/admin/users?limit=101');
    expect(res.status).toBe(400);
    expect(findPaged).not.toHaveBeenCalled();
  });

  it('truyền `sortBy`/`sortOrder` hợp lệ → chuyển tiếp cho repository', async () => {
    const res = await request(app.getHttpServer()).get(
      '/admin/users?sortBy=email&sortOrder=asc&limit=20',
    );

    expect(res.status).toBe(200);
    expect(findPaged).toHaveBeenCalledWith(
      expect.objectContaining({ sort: 'email', sortOrder: 'asc', limit: 20 }),
    );
  });

  it('cursor sinh với sortBy khác → 400 VALIDATION_ERROR', async () => {
    // Con trỏ sinh với `created_at_desc` nhưng request dùng `email` → không khớp.
    const cursor = encodeKeysetCursor({
      s: 'created_at_desc',
      k: '2026-01-01T00:00:00.000Z',
      n: 0,
      id: '507f1f77bcf86cd799439011',
    });

    const res = await request(app.getHttpServer()).get(
      `/admin/users?sortBy=email&sortOrder=desc&cursor=${encodeURIComponent(cursor)}`,
    );

    expect(res.status).toBe(400);
    const body = res.body.error ?? res.body;
    expect(body.code).toBe('VALIDATION_ERROR');
  });

  it('cursor hỏng → 400 VALIDATION_ERROR', async () => {
    const res = await request(app.getHttpServer()).get('/admin/users?cursor=garbage');

    expect(res.status).toBe(400);
    const body = res.body.error ?? res.body;
    expect(body.code).toBe('VALIDATION_ERROR');
  });

  it('cursor khớp sort → truyền con trỏ đã giải mã cho repository', async () => {
    const cursor = encodeKeysetCursor({
      s: 'email_desc',
      k: 'a@example.com',
      n: 0,
      id: '507f1f77bcf86cd799439011',
    });

    const res = await request(app.getHttpServer()).get(
      `/admin/users?sortBy=email&sortOrder=desc&cursor=${encodeURIComponent(cursor)}`,
    );

    expect(res.status).toBe(200);
    expect(findPaged).toHaveBeenCalledWith(
      expect.objectContaining({
        cursor: expect.objectContaining({ value: 'a@example.com', id: '507f1f77bcf86cd799439011' }),
      }),
    );
  });
});
