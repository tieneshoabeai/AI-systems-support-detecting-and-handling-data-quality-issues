import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, NotImplementedException } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { AllExceptionsFilter } from '../../../src/shared/interfaces/filters/all-exceptions.filter';
import { TransformInterceptor } from '../../../src/shared/interfaces/interceptors/transform.interceptor';
import { StatusError } from '../../../src/shared/application/errors';
import { AuthController } from '../../../src/modules/auth/presentation/controllers/auth.controller';
import { LoginWithGoogleHandler } from '../../../src/modules/auth/application/commands/login-with-google.handler';
import { ChangePasswordHandler } from '../../../src/modules/auth/application/commands/change-password.handler';
import { ForgotPasswordHandler } from '../../../src/modules/auth/application/commands/forgot-password.handler';
import { LoginHandler } from '../../../src/modules/auth/application/commands/login.handler';
import { LogoutHandler } from '../../../src/modules/auth/application/commands/logout.handler';
import { RefreshAccessTokenHandler } from '../../../src/modules/auth/application/commands/refresh-access-token.handler';
import { RegisterHandler } from '../../../src/modules/auth/application/commands/register.handler';
import { ResetPasswordHandler } from '../../../src/modules/auth/application/commands/reset-password.handler';
import { RevokeSessionHandler } from '../../../src/modules/auth/application/commands/revoke-session.handler';
import { GetSessionByIdHandler } from '../../../src/modules/auth/application/queries/get-session-by-id.handler';
import { GetSessionsHandler } from '../../../src/modules/auth/application/queries/get-sessions.handler';
import { ConfigService } from '@nestjs/config';

/**
 * E2E — AUTH-03 cookie `google_oauth_state` (Buoc 6 / Nhom B — P1 gap analysis).
 *
 * Kiem tra vong doi cookie day du:
 *   1. `GET /auth/google`  -> 302 + Set-Cookie `google_oauth_state` (HttpOnly, SameSite=Lax, Path=/)
 *   2. `GET /auth/google/callback` kem cookie hop le -> 200, cookie bi xoa
 *   3. `GET /auth/google/callback` kem cookie SAI     -> 401, cookie van bi xoa
 *   4. `GET /auth/google/callback` kem `error=`        -> 401, cookie bi xoa
 *
 * DIEN DANH: middleware `cookieParser()` phai duoc dang ky — `req.cookies` chi co
 * gia tri khi co middleware nay (Express 5 chi co `res.cookie()` native).
 */
describe('E2E — AUTH-03 Google OAuth cookie state', () => {
  let app: INestApplication;

  /** Config stub — `APP_URL` dùng để dựng URL redirect về frontend. */
  const configStub = {
    get: jest.fn((key: string) => {
      if (key === 'APP_URL') return 'http://localhost:5173';
      return undefined;
    }),
  };

  const handlerStub = {
    buildAuthorizationUrl: jest.fn((state: string) => `https://accounts.google.com/o/oauth2/v2/auth?state=${state}`),
    execute: jest.fn(),
  };

  /** Doc header `set-cookie` (supertest tra string[] | string). */
  const setCookieHeader = (res: request.Response): string => {
    const raw = res.headers['set-cookie'];
    return Array.isArray(raw) ? raw.join(';') : String(raw ?? '');
  };

  /** 3 tham so dau cu handler: (code, state, expectedState). */
  const firstCallArgs = (): unknown[] => handlerStub.execute.mock.calls[0] ?? [];

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        { provide: LoginWithGoogleHandler, useValue: handlerStub },
        { provide: ChangePasswordHandler, useValue: {} },
        { provide: ForgotPasswordHandler, useValue: {} },
        { provide: LoginHandler, useValue: {} },
        { provide: LogoutHandler, useValue: {} },
        { provide: RefreshAccessTokenHandler, useValue: {} },
        { provide: RegisterHandler, useValue: {} },
        { provide: ResetPasswordHandler, useValue: {} },
        { provide: RevokeSessionHandler, useValue: {} },
        { provide: GetSessionByIdHandler, useValue: {} },
        { provide: GetSessionsHandler, useValue: {} },
        { provide: ConfigService, useValue: configStub },
      ],
    }).compile();

    app = module.createNestApplication();
    // GIONG main.ts — thu tu rat quan trong: cookieParser phai truoc route.
    app.use(cookieParser());
    app.useGlobalFilters(new AllExceptionsFilter());
    app.useGlobalInterceptors(new TransformInterceptor());
    await app.init();
  });

  afterAll(async () => {
    await app?.close();
  });

  beforeEach(() => {
    handlerStub.execute.mockReset();
    handlerStub.buildAuthorizationUrl.mockReset();
    handlerStub.buildAuthorizationUrl.mockImplementation(
      (state: string) => `https://accounts.google.com/o/oauth2/v2/auth?state=${state}`,
    );
  });

  it('GET /auth/google set cookie state httpOnly + SameSite=Lax + Path=/', async () => {
    const res = await request(app.getHttpServer()).get('/auth/google');

    expect(res.status).toBe(302);
    const cookie = res.headers['set-cookie']?.[0] ?? '';
    expect(cookie).toContain('google_oauth_state=');
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('SameSite=Lax');
    expect(cookie).toContain('Path=/');
  });

  it('GET /auth/google/callback kem cookie hop le -> 200 va xoa cookie', async () => {
    handlerStub.execute.mockResolvedValue({ access_token: 'a', refresh_token: 'r' });

    const res = await request(app.getHttpServer())
      .get('/auth/google/callback?code=abc&state=state-123')
      .set('Cookie', ['google_oauth_state=state-123']);

    expect(res.status).toBe(200);
    // Handler phai nhan duoc `expectedState` tu cookie (truoc day la undefined).
    expect(firstCallArgs().slice(0, 3)).toEqual(['abc', 'state-123', 'state-123']);
    // Cookie phai bi xoa sau khi dung.
    const cleared = setCookieHeader(res);
    expect(cleared).toContain('google_oauth_state=');
    expect(cleared).toContain('Expires=Thu, 01 Jan 1970');
  });

  it('GET /auth/google/callback kem cookie SAI -> 401 va van xoa cookie', async () => {
    // Adapter so sanh `state` (query) voi `expectedState` (cookie) -> 401 khi lech.
    handlerStub.execute.mockRejectedValue(
      new StatusError(
        401,
        'VALIDATION_ERROR',
        'Phiên đăng nhập Google không hợp lệ hoặc đã hết hạn. Vui lòng thử lại.',
      ),
    );

    const res = await request(app.getHttpServer())
      .get('/auth/google/callback?code=abc&state=state-999')
      .set('Cookie', ['google_oauth_state=state-123']);

    expect(res.status).toBe(401);
    // Handler van nhan expectedState tu cookie (khong rong) de tu doi chieu.
    expect(firstCallArgs().slice(0, 3)).toEqual(['abc', 'state-999', 'state-123']);
    const cleared = setCookieHeader(res);
    expect(cleared).toContain('google_oauth_state=');
    expect(cleared).toContain('Expires=Thu, 01 Jan 1970');
  });

  it('GET /auth/google/callback kem error=access_denied -> 401 va xoa cookie', async () => {
    const res = await request(app.getHttpServer())
      .get('/auth/google/callback?error=access_denied')
      .set('Cookie', ['google_oauth_state=state-123']);

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    const cleared = setCookieHeader(res);
    expect(cleared).toContain('google_oauth_state=');
    expect(cleared).toContain('Expires=Thu, 01 Jan 1970');
  });

  it('GET /auth/google/callback KHONG kem cookie -> handler nhan expectedState rong', async () => {
    handlerStub.execute.mockResolvedValue({ access_token: 'a' });

    const res = await request(app.getHttpServer()).get('/auth/google/callback?code=abc&state=s1');

    expect(res.status).toBe(200);
    expect(firstCallArgs().slice(0, 3)).toEqual(['abc', 's1', '']);
  });

  // ── Hợp đồng response (v8.2) ───────────────────────────────────────────
  //
  // §3.5c: "Response (thành công) — JSON giống hệt `POST /auth/login`".
  // `POST /auth/login` qua `TransformInterceptor` → `{ success: true, data: {...} }`.
  // Trước đây callback dùng `res.json(result)` (bypass interceptor) → trả RAW →
  // frontend đọc `data.access_token` được `undefined` → KHÔNG đăng nhập được.

  it('GET /auth/google/callback thanh cong -> tra ENVELOPE giong POST /auth/login', async () => {
    handlerStub.execute.mockResolvedValue({
      access_token: 'acc-1',
      refresh_token: 'ref-1',
      expires_in: 900,
      user: { id: 'u1', email: 'a@b.com', role: 'analyst' },
    });

    const res = await request(app.getHttpServer())
      .get('/auth/google/callback?code=abc&state=state-123')
      .set('Cookie', ['google_oauth_state=state-123']);

    expect(res.status).toBe(200);
    // Envelope bắt buộc — frontend đọc `data.access_token`.
    expect(res.body).toEqual({
      success: true,
      data: {
        access_token: 'acc-1',
        refresh_token: 'ref-1',
        expires_in: 900,
        user: { id: 'u1', email: 'a@b.com', role: 'analyst' },
      },
    });
    expect(res.body.data.access_token).toBe('acc-1');
  });

  it('GET /auth/google/callback voi ?format=redirect -> 302 ve APP_URL kem token trong FRAGMENT', async () => {
    handlerStub.execute.mockResolvedValue({
      access_token: 'acc-1',
      refresh_token: 'ref-1',
    });

    const res = await request(app.getHttpServer())
      .get('/auth/google/callback?code=abc&state=state-123&format=redirect')
      .set('Cookie', ['google_oauth_state=state-123']);

    expect(res.status).toBe(302);
    const location = String(res.headers['location'] ?? '');
    // Origin phải đúng `APP_URL` (chống open redirect).
    expect(location.startsWith('http://localhost:5173')).toBe(true);
    // Token phải nằm trong FRAGMENT (`#`), KHÔNG phải query string —
    // fragment không bị ghi vào access log của proxy.
    expect(location).toContain('#');
    expect(location).not.toContain('?');
    const fragment = location.slice(location.indexOf('#') + 1);
    const params = new URLSearchParams(fragment);
    expect(params.get('access_token')).toBe('acc-1');
    expect(params.get('refresh_token')).toBe('ref-1');
    expect(params.get('provider')).toBe('google');
  });

  it('GET /auth/google/callback voi ?format=redirect va LOI -> 302 ve APP_URL kem ma loi', async () => {
    handlerStub.execute.mockRejectedValue(
      new StatusError(401, 'VALIDATION_ERROR', 'Google từ chối mã ủy quyền.'),
    );

    const res = await request(app.getHttpServer())
      .get('/auth/google/callback?code=abc&state=state-123&format=redirect')
      .set('Cookie', ['google_oauth_state=state-123']);

    expect(res.status).toBe(302);
    const location = String(res.headers['location'] ?? '');
    expect(location.startsWith('http://localhost:5173')).toBe(true);
    const params = new URLSearchParams(location.slice(location.indexOf('#') + 1));
    expect(params.get('error')).toBe('VALIDATION_ERROR');
    expect(params.get('error_description')).toBe('Google từ chối mã ủy quyền.');
  });

  it('GET /auth/google?format=json -> set cookie mode de callback doc lai', async () => {
    const res = await request(app.getHttpServer()).get('/auth/google?format=json');

    expect(res.status).toBe(302);
    const cookies = (res.headers['set-cookie'] ?? []) as string[];
    const formatCookie = cookies.find((c: string) => c.startsWith('google_oauth_format='));
    expect(formatCookie).toBeDefined();
    expect(formatCookie).toContain('google_oauth_format=json');
    expect(formatCookie).toContain('HttpOnly');
  });

  it('GET /auth/google KHONG truyen format -> KHONG set cookie mode (mac dinh json)', async () => {
    const res = await request(app.getHttpServer()).get('/auth/google');

    expect(res.status).toBe(302);
    const cookies = (res.headers['set-cookie'] ?? []) as string[];
    expect(cookies.find((c: string) => c.startsWith('google_oauth_format='))).toBeUndefined();
  });

  it('GET /auth/google/callback xoa cookie mode sau khi dung', async () => {
    handlerStub.execute.mockResolvedValue({ access_token: 'a' });

    const res = await request(app.getHttpServer())
      .get('/auth/google/callback?code=abc&state=state-123')
      .set('Cookie', ['google_oauth_state=state-123', 'google_oauth_format=json']);

    expect(res.status).toBe(200);
    const cleared = setCookieHeader(res);
    expect(cleared).toContain('google_oauth_format=');
    expect(cleared).toContain('Expires=Thu, 01 Jan 1970');
  });

  it('GET /auth/google khi thieu credential -> 501 DEPENDENCY_UNAVAILABLE', async () => {
    handlerStub.buildAuthorizationUrl.mockImplementationOnce(() => {
      throw new NotImplementedException({
        message:
          'Đăng nhập Google chưa được cấu hình. Cần GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET và GOOGLE_REDIRECT_URI.',
        error: 'DEPENDENCY_UNAVAILABLE',
      });
    });

    const res = await request(app.getHttpServer()).get('/auth/google');

    expect(res.status).toBe(501);
    expect(res.body.error.code).toBe('DEPENDENCY_UNAVAILABLE');
  });
});
