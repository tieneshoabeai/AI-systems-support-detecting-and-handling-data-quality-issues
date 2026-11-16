import { Test, TestingModule } from '@nestjs/testing';
import {
  ConflictException,
  ForbiddenException,
  NotImplementedException,
  UnauthorizedException,
} from '@nestjs/common';
import {
  AUTH_SESSION_POLICY_PORT,
  AUTH_SESSION_PORT,
  AUTH_TOKEN_ISSUER_PORT,
  AUTH_USER_LOOKUP_PORT,
  type AuthSessionRecord,
  type AuthUserLookup,
} from '../src/modules/auth/domain/ports/auth-session.port';
import {
  GOOGLE_OAUTH_PORT,
  type GoogleProfile,
} from '../src/modules/auth/domain/ports/google-oauth.port';
import { LoginWithGoogleHandler } from '../src/modules/auth/application/commands/login-with-google.handler';
import { GoogleOAuthAdapter } from '../src/modules/auth/infrastructure/security/google-oauth.adapter';

const DAY = 24 * 60 * 60 * 1000;

const STATE = 'state-nonce-123';
const PROFILE: GoogleProfile = {
  googleId: 'google-sub-1',
  email: 'user@gmail.com',
  emailVerified: true,
  firstName: 'Nguyen',
  lastName: 'Van A',
  avatarUrl: 'https://lh3.googleusercontent.com/a/avatar',
};

function userRecord(overrides: Partial<AuthUserLookup> = {}): AuthUserLookup {
  return {
    id: 'user-1',
    email: 'user@gmail.com',
    role: 'analyst',
    status: 'active',
    passwordHash: null,
    googleId: 'google-sub-1',
    deletedAt: null,
    ...overrides,
  };
}

function sessionRecord(overrides: Partial<AuthSessionRecord> = {}): AuthSessionRecord {
  return {
    id: 'sess-google-1',
    userId: 'user-1',
    refreshTokenHash: 'hash',
    deviceName: 'Chrome on Linux',
    ipAddress: '127.0.0.1',
    userAgent: 'UA',
    isRevoked: false,
    rememberMe: false,
    lastUsedAt: null,
    expiresAt: new Date(Date.now() + 7 * DAY),
    createdAt: new Date(),
    ...overrides,
  };
}

describe('Buoc 6 / Nhom B — Google OAuth 2.0 (AUTH-03)', () => {
  let handler: LoginWithGoogleHandler;
  let google: {
    isConfigured: jest.Mock;
    buildAuthorizationUrl: jest.Mock;
    exchangeCode: jest.Mock;
  };
  let users: {
    findByGoogleId: jest.Mock;
    findByEmail: jest.Mock;
    createWithGoogle: jest.Mock;
  };
  let sessions: { createSession: jest.Mock };

  beforeEach(async () => {
    google = {
      isConfigured: jest.fn().mockReturnValue(true),
      buildAuthorizationUrl: jest
        .fn()
        .mockImplementation((state: string) => `https://accounts.google.com/o/oauth2/v2/auth?state=${state}`),
      exchangeCode: jest.fn().mockResolvedValue(PROFILE),
    };
    users = {
      findByGoogleId: jest.fn().mockResolvedValue(null),
      findByEmail: jest.fn().mockResolvedValue(null),
      createWithGoogle: jest.fn().mockResolvedValue(userRecord()),
    };
    sessions = {
      createSession: jest.fn(async (d: Record<string, unknown>) => sessionRecord({ userId: d.userId as string })),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LoginWithGoogleHandler,
        { provide: GOOGLE_OAUTH_PORT, useValue: google },
        { provide: AUTH_USER_LOOKUP_PORT, useValue: users },
        { provide: AUTH_SESSION_PORT, useValue: sessions },
        {
          provide: AUTH_TOKEN_ISSUER_PORT,
          useValue: { sign: jest.fn().mockReturnValue('access-token'), verify: jest.fn() },
        },
        {
          provide: AUTH_SESSION_POLICY_PORT,
          useValue: { refreshTtlMs: (rememberMe: boolean) => (rememberMe ? 30 * DAY : 7 * DAY) },
        },
      ],
    }).compile();

    handler = module.get<LoginWithGoogleHandler>(LoginWithGoogleHandler);
  });

  // ── Luồng chính ────────────────────────────────────────────────────────

  it('google_id chua gan + email moi -> tao tai khoan va phat token', async () => {
    const res = await handler.execute('code-abc', STATE, STATE, '127.0.0.1', 'UA');

    expect(users.findByGoogleId).toHaveBeenCalledWith('google-sub-1');
    expect(users.createWithGoogle).toHaveBeenCalledWith({
      email: 'user@gmail.com',
      googleId: 'google-sub-1',
      firstName: 'Nguyen',
      lastName: 'Van A',
      avatarUrl: 'https://lh3.googleusercontent.com/a/avatar',
    });
    expect(res.access_token).toBe('access-token');
    expect(res.refresh_token).toEqual(expect.any(String));
    expect(res.provider).toBe('google');
    expect(res.user).toEqual({ id: 'user-1', email: 'user@gmail.com', role: 'analyst' });
    expect(sessions.createSession).toHaveBeenCalledTimes(1);
  });

  it('google_id da gan -> dang nhap tai khoan do, KHONG tao tai khoan moi', async () => {
    users.findByGoogleId.mockResolvedValue(userRecord({ id: 'user-existing' }));

    const res = await handler.execute('code-abc', STATE, STATE);

    expect(users.createWithGoogle).not.toHaveBeenCalled();
    expect(users.findByEmail).not.toHaveBeenCalled();
    expect(res.user.id).toBe('user-existing');
    expect(sessions.createSession).toHaveBeenCalledTimes(1);
  });

  it('email da co tai khoan nhung chua gan google -> CONFLICT, KHONG tu lien ket', async () => {
    users.findByEmail.mockResolvedValue(userRecord({ googleId: null, passwordHash: 'hashed' }));

    await expect(handler.execute('code-abc', STATE, STATE)).rejects.toBeInstanceOf(ConflictException);
    expect(users.createWithGoogle).not.toHaveBeenCalled();
    expect(sessions.createSession).not.toHaveBeenCalled();
  });

  // ── Luồng lỗi ──────────────────────────────────────────────────────────

  it('email chua xac minh -> Unauthorized (VALIDATION_ERROR)', async () => {
    google.exchangeCode.mockResolvedValue({ ...PROFILE, emailVerified: false });

    await expect(handler.execute('code-abc', STATE, STATE)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(users.createWithGoogle).not.toHaveBeenCalled();
  });

  it('tai khoan bi blocked -> Forbidden', async () => {
    users.findByGoogleId.mockResolvedValue(userRecord({ status: 'blocked' }));

    await expect(handler.execute('code-abc', STATE, STATE)).rejects.toBeInstanceOf(ForbiddenException);
    expect(sessions.createSession).not.toHaveBeenCalled();
  });

  it('state khong khop -> adapter nem Unauthorized, khong tao tai khoan', async () => {
    google.exchangeCode.mockRejectedValue(
      new UnauthorizedException({
        message: 'Phiên đăng nhập Google không hợp lệ hoặc đã hết hạn. Vui lòng thử lại.',
        error: 'VALIDATION_ERROR',
      }),
    );

    await expect(handler.execute('code-abc', 'state-khac', STATE)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(users.createWithGoogle).not.toHaveBeenCalled();
  });

  // ── Hạ tầng ────────────────────────────────────────────────────────────

  it('buildAuthorizationUrl truyen state cho adapter', () => {
    const url = handler.buildAuthorizationUrl(STATE);
    expect(url).toContain('state=state-nonce-123');
    expect(google.buildAuthorizationUrl).toHaveBeenCalledWith(STATE);
  });

  it('adapter: thieu credential -> NotImplementedException (501 DEPENDENCY_UNAVAILABLE)', () => {
    const adapter = new GoogleOAuthAdapter({
      get: () => undefined,
    } as never);

    expect(adapter.isConfigured()).toBe(false);
    try {
      adapter.buildAuthorizationUrl(STATE);
      throw new Error('phai nem NotImplementedException');
    } catch (err) {
      expect(err).toBeInstanceOf(NotImplementedException);
      expect((err as NotImplementedException).getStatus()).toBe(501);
      expect((err as NotImplementedException).getResponse()).toEqual(
        expect.objectContaining({ error: 'DEPENDENCY_UNAVAILABLE' }),
      );
    }
  });

  it('adapter: du credential -> build URL dung endpoint Google', () => {
    const adapter = new GoogleOAuthAdapter({
      get: (key: string) =>
        ({
          GOOGLE_CLIENT_ID: 'client-123',
          GOOGLE_CLIENT_SECRET: 'secret-456',
          GOOGLE_REDIRECT_URI: 'http://localhost:3000/api/v1/auth/google/callback',
        })[key],
    } as never);

    expect(adapter.isConfigured()).toBe(true);
    const url = adapter.buildAuthorizationUrl(STATE);
    expect(url).toContain('https://accounts.google.com/o/oauth2/v2/auth');
    expect(url).toContain('client_id=client-123');
    expect(url).toContain('state=state-nonce-123');
    expect(url).toContain(encodeURIComponent('http://localhost:3000/api/v1/auth/google/callback'));
  });

  it('adapter: state khong khop -> Unauthorized truoc khi goi Google', async () => {
    const adapter = new GoogleOAuthAdapter({
      get: (key: string) =>
        ({
          GOOGLE_CLIENT_ID: 'client-123',
          GOOGLE_CLIENT_SECRET: 'secret-456',
          GOOGLE_REDIRECT_URI: 'http://localhost:3000/api/v1/auth/google/callback',
        })[key],
    } as never);

    await expect(adapter.exchangeCode('code', 'state-a', 'state-b')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });
});
