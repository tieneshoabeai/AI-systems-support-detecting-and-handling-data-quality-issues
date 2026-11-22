import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import request from 'supertest';
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
 * E2E — REGRESSION P1 (gap analysis 2026-11-18).
 *
 * `GET /auth/google/callback` doc `req.cookies.google_oauth_state` de doi chieu CSRF.
 * Express 5 chi co `res.cookie()` native — `req.cookies` chi co gia tri khi middleware
 * `cookieParser()` duoc dang ky. THIEU middleware => moi callback hop le bi reject 401.
 *
 * File nay kiem tra **hai** kich ban:
 *   - KHONG co `cookieParser()`  -> `req.cookies` undefined -> `expectedState = ''` (bug P1).
 *   - CO   `cookieParser()`  -> `req.cookies` doc dung cookie -> `expectedState` khop.
 *
 * Cach chay: `pnpm run test:e2e`
 */
describe('E2E — REGRESSION P1: cookieParser giup `req.cookies` doc duoc', () => {
  /** Tao app moi voi tuy chon dang ky middleware. */
  async function createApp(withCookieParser: boolean): Promise<INestApplication> {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        { provide: LoginWithGoogleHandler, useValue: { buildAuthorizationUrl: jest.fn(), execute: jest.fn() } },
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

    const app = module.createNestApplication();
    // `main.ts` DANG ky `app.use(cookieParser())` — test phai mo phong dung thu tu.
    if (withCookieParser) app.use(cookieParser());
    await app.init();
    return app;
  }

  it('KHONG cookieParser -> `req.cookies` undefined -> expectedState rong (bug P1)', async () => {
    const app = await createApp(false);
    const execute = jest.fn().mockResolvedValue({ access_token: 'a' });
    // Ghi de provider sau khi compile de quan sat tham so truyền vào.
    const loginWithGoogle = app.get(LoginWithGoogleHandler, { strict: false });
    (loginWithGoogle as unknown as { execute: jest.Mock }).execute = execute;

    await request(app.getHttpServer())
      .get('/auth/google/callback?code=abc&state=state-1')
      .set('Cookie', ['google_oauth_state=state-1']);

    // Khong co middleware -> controller doc `req.cookies` ra undefined -> ''.
    expect(execute.mock.calls[0]?.[2]).toBe('');

    await app.close();
  });

  it('CO cookieParser -> `req.cookies` doc dung -> expectedState khop cookie', async () => {
    const app = await createApp(true);
    const execute = jest.fn().mockResolvedValue({ access_token: 'a' });
    const loginWithGoogle = app.get(LoginWithGoogleHandler, { strict: false });
    (loginWithGoogle as unknown as { execute: jest.Mock }).execute = execute;

    const res = await request(app.getHttpServer())
      .get('/auth/google/callback?code=abc&state=state-1')
      .set('Cookie', ['google_oauth_state=state-1']);

    expect(res.status).toBe(200);
    // expectedState = 'state-1' — khop voi `state` trong query -> adapter cho phep.
    expect(execute.mock.calls[0]?.[2]).toBe('state-1');

    await app.close();
  });

  it('GUARD: `main.ts` phai dang ky `app.use(cookieParser())`', async () => {
    // Doc source `main.ts` — middleware dang ky sai cho/vi tri se lam vo cookie.
    // Chi kiem tra *su ton tai* cua lenh dang ky; thu tu duoc bao dam boi test tren.
    const fs = await import('fs');
    const path = await import('path');
    const mainPath = path.join(__dirname, '../../../src/main.ts');
    const source = fs.readFileSync(mainPath, 'utf8');

    expect(source).toMatch(/app\.use\(\s*cookieParser\(\)\s*\)/);
    // Phai import `cookieParser` tu `cookie-parser`.
    expect(source).toMatch(/import\s+cookieParser\s+from\s+['"]cookie-parser['"]/);
  });
});
