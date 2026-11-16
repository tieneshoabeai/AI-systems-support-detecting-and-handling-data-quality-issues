/**
 * AUTH — Domain ports (hexagonal chuẩn).
 * Application chỉ phụ thuộc ports, không import schema/jwt trực tiếp.
 * - AuthSessionPort: quản lý phiên đăng nhập (secondary/driven port).
 * - AuthUserLookupPort: tra cứu + tạo user cho login/register/refresh (do Users module cung cấp).
 * - PasswordHasherPort + AuthTokenIssuerPort: capability ports để test/fake dễ dàng.
 */

export interface AuthSessionRecord {
  id: string;
  userId: string;
  refreshTokenHash: string;
  deviceName?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  isRevoked: boolean;
  expiresAt: Date;
}

export interface AuthUserLookup {
  id: string;
  email: string;
  role: 'admin' | 'analyst';
  status: 'active' | 'blocked';
  passwordHash?: string | null;
  deletedAt: Date | null;
}

export interface AuthPasswordResetState {
  tokenHash: string | null;
  expiresAt: Date | null;
  attempts: number;
  sentCount: number;
  windowStart: Date | null;
}

export interface AuthUserCreateInput {
  email: string;
  passwordHash: string;
  firstName: string;
  lastName: string;
  role?: 'admin' | 'analyst';
}

export const AUTH_SESSION_PORT = Symbol('AuthSessionPort');

export interface AuthSessionPort {
  createSession(data: {
    userId: string;
    refreshTokenHash: string;
    deviceName?: string | null;
    ipAddress?: string | null;
    userAgent?: string | null;
    expiresAt: Date;
  }): Promise<AuthSessionRecord>;
  findSessionByTokenHash(refreshTokenHash: string): Promise<AuthSessionRecord | null>;
  findSessionByTokenHashIncludingRevoked(refreshTokenHash: string): Promise<AuthSessionRecord | null>;
  findActiveSessions(userId: string): Promise<AuthSessionRecord[]>;
  revokeSession(userId: string, sessionId: string): Promise<boolean>;
  revokeSessionById(sessionId: string): Promise<boolean>;
  revokeAllUserSessions(userId: string): Promise<number>;
}

export const AUTH_USER_LOOKUP_PORT = Symbol('AuthUserLookupPort');

export interface AuthUserLookupPort {
  findByEmail(email: string, includePassword?: boolean): Promise<AuthUserLookup | null>;
  findById(id: string): Promise<AuthUserLookup | null>;
  findByEmailWithResetSecret(email: string): Promise<(AuthUserLookup & AuthPasswordResetState) | null>;
  findByIdWithResetSecret(id: string): Promise<(AuthUserLookup & AuthPasswordResetState) | null>;
  setPasswordResetOtp(email: string, tokenHash: string, expiresAt: Date, sentCount: number, windowStart: Date | null): Promise<boolean>;
  incrementResetAttempts(email: string): Promise<number>;
  clearPasswordReset(email: string): Promise<boolean>;
  setPasswordHash(userId: string, passwordHash: string): Promise<boolean>;
  create(data: AuthUserCreateInput): Promise<AuthUserLookup>;
}

export const PASSWORD_HASHER_PORT = Symbol('PasswordHasherPort');

export interface PasswordHasherPort {
  hash(plain: string): Promise<string>;
  compare(plain: string, hash: string): Promise<boolean>;
}

export const AUTH_TOKEN_ISSUER_PORT = Symbol('AuthTokenIssuerPort');

export interface AuthTokenPayload {
  sub: string;
  email: string;
  role: string;
  sessionId?: string;
}

export interface AuthTokenIssuerPort {
  sign(payload: AuthTokenPayload): string;
  verify(token: string): AuthTokenPayload;
}
