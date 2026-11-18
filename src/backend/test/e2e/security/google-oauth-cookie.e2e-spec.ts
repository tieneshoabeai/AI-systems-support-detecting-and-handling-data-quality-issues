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
