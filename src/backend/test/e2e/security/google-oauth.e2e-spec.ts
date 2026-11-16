import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, NotImplementedException } from '@nestjs/common';
import request from 'supertest';
import { AllExceptionsFilter } from '../../../src/shared/filters/all-exceptions.filter';
import { TransformInterceptor } from '../../../src/shared/interceptors/transform.interceptor';
import { AuthController } from '../../../src/modules/auth/infrastructure/http/auth.controller';
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
 * E2E — AUTH-03 (Buoc 6 / Nhom B).
 *
 * Kiem tra hop dong HTTP cua 2 endpoint Google:
 *   - `GET /auth/google`         → 501 DEPENDENCY_UNAVAILABLE khi chua cau hinh credential;
 *                                  302 redirect sang Google kem `state` khi da cau hinh.
 *   - `GET /auth/google/callback`→ 401 khi Google tra `error=access_denied`.
 *
 * Dung controller that voi handler mock — khong can Mongo/Google that.
 */
describe('E2E — AUTH-03 Google OAuth (GET /auth/google)', () => {
  let app: INestApplication;

  const handlerStub = {
    buildAuthorizationUrl: jest.fn((state: string) => `https://accounts.google.com/o/oauth2/v2/auth?state=${state}`),
    execute: jest.fn(),
  };

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
    app.useGlobalFilters(new AllExceptionsFilter());
    app.useGlobalInterceptors(new TransformInterceptor());
    await app.init();
  });

  afterAll(async () => {
    await app?.close();
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

  it('GET /auth/google -> redirect 302 sang Google kem state', async () => {
    handlerStub.buildAuthorizationUrl.mockImplementationOnce(
      (state: string) => `https://accounts.google.com/o/oauth2/v2/auth?state=${state}`,
    );

    const res = await request(app.getHttpServer()).get('/auth/google');

    expect(res.status).toBe(302);
    expect(res.headers.location).toContain('https://accounts.google.com/o/oauth2/v2/auth');
    expect(res.headers.location).toContain('state=');
    // Cookie state phai httpOnly (chong CSRF).
    const cookie = res.headers['set-cookie']?.[0] ?? '';
    expect(cookie).toContain('google_oauth_state=');
    expect(cookie).toContain('HttpOnly');
  });

  it('GET /auth/google/callback khi Google tra error -> 401 VALIDATION_ERROR', async () => {
    const res = await request(app.getHttpServer()).get('/auth/google/callback?error=access_denied');

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });
});
