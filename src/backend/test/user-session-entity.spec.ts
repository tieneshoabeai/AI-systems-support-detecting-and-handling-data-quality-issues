/**
 * Unit test thuần cho aggregate `UserSession` (Bước 3 — Rich Domain Model).
 */
import { UserSession } from '../src/modules/users/domain/entities/user-session.entity';
import {
  ConflictError,
  ForbiddenError,
} from '../src/shared/domain/errors';

const NOW = new Date('2026-01-01T00:00:00.000Z');

function buildSession(
  overrides: Partial<Parameters<typeof UserSession.reconstitute>[0]> = {},
): UserSession {
  return UserSession.reconstitute({
    id: 's-1',
    userId: 'u-1',
    refreshTokenHash: 'hash',
    deviceName: 'Chrome',
    ipAddress: '127.0.0.1',
    userAgent: 'UA',
    isRevoked: false,
    rememberMe: false,
    lastUsedAt: NOW,
    expiresAt: new Date('2026-01-08T00:00:00.000Z'),
    createdAt: NOW,
    updatedAt: NOW,
    deletedAt: null,
    version: 1,
    ...overrides,
  });
}

describe('UserSession entity — factory', () => {
  it('create() mặc định hạn 7 ngày (không remember-me)', () => {
    const session = UserSession.create({
      id: 's-1',
      userId: 'u-1',
      refreshTokenHash: 'hash',
      now: NOW,
    });

    const days = (session.expiresAt.getTime() - NOW.getTime()) / (24 * 60 * 60 * 1000);
    expect(days).toBeCloseTo(7, 5);
    expect(session.rememberMe).toBe(false);
    expect(session.isRevoked).toBe(false);
  });

  it('create() có rememberMe → hạn 30 ngày', () => {
    const session = UserSession.create({
      id: 's-1',
      userId: 'u-1',
      refreshTokenHash: 'hash',
      rememberMe: true,
      now: NOW,
    });

    const days = (session.expiresAt.getTime() - NOW.getTime()) / (24 * 60 * 60 * 1000);
    expect(days).toBeCloseTo(30, 5);
    expect(session.rememberMe).toBe(true);
  });

  it('create() truyền expiresAt → dùng giá trị đó', () => {
    const expiresAt = new Date('2026-06-01T00:00:00.000Z');
    const session = UserSession.create({
      id: 's-1',
      userId: 'u-1',
      refreshTokenHash: 'hash',
      expiresAt,
      now: NOW,
    });

    expect(session.expiresAt).toBe(expiresAt);
  });

  it('create() không phát domain event', () => {
    const session = UserSession.create({
      id: 's-1',
      userId: 'u-1',
      refreshTokenHash: 'hash',
      now: NOW,
    });
    expect(session.domainEvents).toHaveLength(0);
  });

  it('reconstitute() không phát domain event', () => {
    expect(buildSession().domainEvents).toHaveLength(0);
  });
});

describe('UserSession entity — truy vấn', () => {
  it('isActive(): chưa thu hồi + chưa hết hạn → true', () => {
    expect(buildSession().isActive(new Date('2026-01-02T00:00:00.000Z'))).toBe(true);
  });

  it('isActive(): đã thu hồi → false', () => {
    expect(buildSession({ isRevoked: true }).isActive(new Date('2026-01-02T00:00:00.000Z'))).toBe(false);
  });

  it('isActive(): đã hết hạn → false', () => {
    expect(buildSession().isActive(new Date('2026-02-01T00:00:00.000Z'))).toBe(false);
  });

  it('isExpired(): hết hạn khi now >= expiresAt', () => {
    const s = buildSession();
    expect(s.isExpired(new Date('2026-01-07T23:59:59.000Z'))).toBe(false);
    expect(s.isExpired(new Date('2026-01-08T00:00:00.000Z'))).toBe(true);
  });
});

describe('UserSession entity — touch()', () => {
  it('cập nhật lastUsedAt', () => {
    const session = buildSession();
    const at = new Date('2026-01-05T10:00:00.000Z');
    session.touch(at);

    expect(session.lastUsedAt).toBe(at);
    expect(session.updatedAt).toBe(at);
  });
});

describe('UserSession entity — revoke()', () => {
  it('đánh dấu thu hồi', () => {
    const session = buildSession();
    session.revoke();

    expect(session.isRevoked).toBe(true);
    expect(session.isActive(new Date('2026-01-02T00:00:00.000Z'))).toBe(false);
  });

  it('thu hồi 2 lần → ConflictError', () => {
    expect(() => buildSession({ isRevoked: true }).revoke()).toThrow(ConflictError);
  });
});

describe('UserSession entity — assertUsable()', () => {
  it('phiên hợp lệ → không ném', () => {
    expect(() =>
      buildSession().assertUsable(new Date('2026-01-02T00:00:00.000Z')),
    ).not.toThrow();
  });

  it('phiên đã thu hồi → ForbiddenError', () => {
    expect(() =>
      buildSession({ isRevoked: true }).assertUsable(new Date('2026-01-02T00:00:00.000Z')),
    ).toThrow(ForbiddenError);
  });

  it('phiên hết hạn → ForbiddenError', () => {
    expect(() =>
      buildSession().assertUsable(new Date('2026-02-01T00:00:00.000Z')),
    ).toThrow(ForbiddenError);
  });
});

describe('UserSession entity — toProps()', () => {
  it('toProps() trả bản chụp props đầy đủ', () => {
    const props = buildSession().toProps();
    expect(props.id).toBe('s-1');
    expect(props.userId).toBe('u-1');
    expect(props.refreshTokenHash).toBe('hash');
    expect(props.version).toBe(1);
  });
});
