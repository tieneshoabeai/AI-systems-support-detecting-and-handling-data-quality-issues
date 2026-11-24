import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext, INestApplication } from '@nestjs/common';
import request from 'supertest';
import cookieParser from 'cookie-parser';
import { AllExceptionsFilter } from '../../src/shared/interfaces/filters/all-exceptions.filter';
import { TransformInterceptor } from '../../src/shared/interfaces/interceptors/transform.interceptor';
import { RequestIdMiddleware } from '../../src/shared/interfaces/middleware/request-id.middleware';
import { AuthController } from '../../src/modules/auth/presentation/controllers/auth.controller';
import { JwtAuthGuard } from '../../src/shared/interfaces/guards/jwt-auth.guard';
import { LoginHandler } from '../../src/modules/auth/application/commands/login.handler';
import { RegisterHandler } from '../../src/modules/auth/application/commands/register.handler';
import { RefreshAccessTokenHandler } from '../../src/modules/auth/application/commands/refresh-access-token.handler';
import { ForgotPasswordHandler } from '../../src/modules/auth/application/commands/forgot-password.handler';
import { ResetPasswordHandler } from '../../src/modules/auth/application/commands/reset-password.handler';
import { ChangePasswordHandler } from '../../src/modules/auth/application/commands/change-password.handler';
import { LogoutHandler } from '../../src/modules/auth/application/commands/logout.handler';
import { RevokeSessionHandler } from '../../src/modules/auth/application/commands/revoke-session.handler';
import { GetSessionByIdHandler } from '../../src/modules/auth/application/queries/get-session-by-id.handler';
import { GetSessionsHandler } from '../../src/modules/auth/application/queries/get-sessions.handler';
import { LoginWithGoogleHandler } from '../../src/modules/auth/application/commands/login-with-google.handler';

/**
 * E2E — AUTH full flow (13 endpoint auth).
 * Controller thật + handler mock — không cần Mongo/Google thật.
 * Phủ: register/login (remember_me + alias rememberMe)/refresh/forgot/reset/change/logout/sessions.
 */
describe('E2E — Auth full flow (register/login/session)', () => {
  let app: INestApplication;
  const MOCK_USER = { userId: '507f1f77bcf86cd799439011', email: 'analyst@example.com', role: 'analyst' as const, sessionId: 'sess-1' };

  const login = { execute: jest.fn() };
  const register = { execute: jest.fn() };
  const refresh = { execute: jest.fn() };
  const forgot = { execute: jest.fn() };
  const reset = { execute: jest.fn() };
  const change = { execute: jest.fn() };
  const logout = { execute: jest.fn() };
  const revoke = { execute: jest.fn() };
  const getById = { execute: jest.fn() };
  const getList = { execute: jest.fn() };

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        { provide: LoginHandler, useValue: login },
        { provide: RegisterHandler, useValue: register },
        { provide: RefreshAccessTokenHandler, useValue: refresh },
        { provide: ForgotPasswordHandler, useValue: forgot },
        { provide: ResetPasswordHandler, useValue: reset },
        { provide: ChangePasswordHandler, useValue: change },
        { provide: LogoutHandler, useValue: logout },
        { provide: RevokeSessionHandler, useValue: revoke },
        { provide: GetSessionByIdHandler, useValue: getById },
        { provide: GetSessionsHandler, useValue: getList },
        { provide: LoginWithGoogleHandler, useValue: { buildAuthorizationUrl: jest.fn(), execute: jest.fn() } },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate: (ctx: ExecutionContext) => {
          ctx.switchToHttp().getRequest().user = MOCK_USER;
          return true;
        },
      })
      .compile();
    app = module.createNestApplication();
    app.use(cookieParser());
    const rid = new RequestIdMiddleware();
    app.use(rid.use.bind(rid));
    app.useGlobalFilters(new AllExceptionsFilter());
    app.useGlobalInterceptors(new TransformInterceptor());
    await app.init();
  });
  afterAll(async () => { await app?.close(); });
  beforeEach(() => jest.clearAllMocks());

  it('POST /auth/register 201 — analyst mặc định, từ chối role lạ (.strict)', async () => {
    register.execute.mockResolvedValue({ id: 'u1', email: 'a@test.local', first_name: 'An', last_name: 'Ng', role: 'analyst', created_at: new Date().toISOString() });
    const res = await request(app.getHttpServer()).post('/auth/register').send({ email: 'a@test.local', password: 'MatKhau123', first_name: 'An', last_name: 'Ng' });
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.headers['x-request-id']).toBeDefined();
    // OPEN-01: gửi role -> 400
    const bad = await request(app.getHttpServer()).post('/auth/register').send({ email: 'a@test.local', password: 'MatKhau123', first_name: 'An', last_name: 'Ng', role: 'admin' });
    expect(bad.status).toBe(400);
    expect(bad.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('POST /auth/login 200 — remember_me chuẩn; 2 field lệch nhau -> 400', async () => {
    login.execute.mockResolvedValue({ access_token: 'at', refresh_token: 'rt', expires_in: 900, device_name: 'jest', remember_me: true, expires_at: new Date().toISOString(), user: { id: MOCK_USER.userId, email: MOCK_USER.email, role: 'analyst' } });
    const ok = await request(app.getHttpServer()).post('/auth/login').send({ email: MOCK_USER.email, password: 'MatKhau123', remember_me: true });
    expect(ok.status).toBe(200);
    expect(ok.body.data.remember_me).toBe(true);
    expect(login.execute.mock.calls[0][0]).toMatchObject({ email: MOCK_USER.email, remember_me: true });
    // alias rememberMe vẫn chạy
    login.execute.mockResolvedValueOnce({ access_token: 'at', refresh_token: 'rt', expires_in: 900, device_name: 'jest', remember_me: false, expires_at: new Date().toISOString(), user: { id: 'u', email: 'e', role: 'analyst' } });
    const alias = await request(app.getHttpServer()).post('/auth/login').send({ email: MOCK_USER.email, password: 'MatKhau123', rememberMe: false });
    expect(alias.status).toBe(200);
    // lệch nhau -> 400 VALIDATION_ERROR (quy tắc đã chốt)
    const conflict = await request(app.getHttpServer()).post('/auth/login').send({ email: MOCK_USER.email, password: 'MatKhau123', remember_me: true, rememberMe: false });
    expect(conflict.status).toBe(400);
    expect(conflict.body.error.code).toBe('VALIDATION_ERROR');
    // thiếu password -> 400
    const missing = await request(app.getHttpServer()).post('/auth/login').send({ email: MOCK_USER.email });
    expect(missing.status).toBe(400);
  });

  it('POST /auth/refresh + forgot + reset (OTP 6 số) + change + logout + sessions', async () => {
    refresh.execute.mockResolvedValue({ access_token: 'at2', refresh_token: 'rt2', expires_in: 900, remember_me: false, expires_at: new Date().toISOString() });
    const rf = await request(app.getHttpServer()).post('/auth/refresh').send({ refresh_token: 'rt-old' });
    expect(rf.status).toBe(200);
    expect(rf.body.data.access_token).toBe('at2');

    forgot.execute.mockResolvedValue({ message: 'Nếu email tồn tại trong hệ thống, mã OTP đã được gửi. Mã có hiệu lực 10 phút.' });
    const fg = await request(app.getHttpServer()).post('/auth/forgot-password').send({ email: MOCK_USER.email });
    expect(fg.status).toBe(200);

    reset.execute.mockResolvedValue({ message: 'Đặt lại mật khẩu thành công. Vui lòng đăng nhập lại.' });
    const rs = await request(app.getHttpServer()).post('/auth/reset-password').send({ email: MOCK_USER.email, otp: '123456', new_password: 'MatKhauMoi123' });
    expect(rs.status).toBe(200);
    const badOtp = await request(app.getHttpServer()).post('/auth/reset-password').send({ email: MOCK_USER.email, otp: 'abc', new_password: 'MatKhauMoi123' });
    expect(badOtp.status).toBe(400);

    change.execute.mockResolvedValue({ message: 'Đổi mật khẩu thành công.' });
    const cp = await request(app.getHttpServer()).post('/auth/change-password').send({ current_password: 'MatKhau123', new_password: 'MatKhauMoi123', confirm_password: 'MatKhauMoi123' });
    expect(cp.status).toBe(200);

    logout.execute.mockResolvedValue({ message: 'Đăng xuất thành công' });
    const lo = await request(app.getHttpServer()).post('/auth/logout');
    expect(lo.status).toBe(200);

    getList.execute.mockResolvedValue([]);
    const sess = await request(app.getHttpServer()).get('/auth/sessions');
    expect(sess.status).toBe(200);
    expect(Array.isArray(sess.body.data)).toBe(true);

    getById.execute.mockResolvedValue({ id: 'sess-1', device_name: 'jest', ip_address: null, user_agent: null, is_revoked: false, remember_me: false, last_used_at: null, expires_at: new Date().toISOString(), created_at: new Date().toISOString() });
    const me = await request(app.getHttpServer()).get('/auth/sessions/me');
    expect(me.status).toBe(200);
    const one = await request(app.getHttpServer()).get('/auth/sessions/sess-1');
    expect(one.status).toBe(200);

    revoke.execute.mockResolvedValue({ message: 'Đã thu hồi phiên đăng nhập thành công' });
    const rv = await request(app.getHttpServer()).delete('/auth/sessions/sess-1');
    expect(rv.status).toBe(200);
  });

  it('envelope lỗi chuẩn {success:false, error:{code,message,timestamp,path}} + X-Request-Id', async () => {
    const res = await request(app.getHttpServer()).post('/auth/login').send({ email: 'not-an-email', password: '' });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.timestamp).toBeDefined();
    expect(res.body.error.path).toBeDefined();
    expect(res.headers['x-request-id']).toBeDefined();
  });
});
