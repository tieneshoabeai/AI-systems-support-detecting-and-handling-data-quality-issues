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
  /** Cờ "ghi nhớ đăng nhập" — phiên sống 30 ngày thay vì 7 ngày. */
  rememberMe: boolean;
  /** Lần cuối phiên được dùng (refresh). */
  lastUsedAt: Date | null;
  expiresAt: Date;
  createdAt: Date;
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
    /** Phiên "ghi nhớ đăng nhập" — hạn 30 ngày. */
    rememberMe?: boolean;
    expiresAt: Date;
  }): Promise<AuthSessionRecord>;
  findSessionByTokenHash(refreshTokenHash: string): Promise<AuthSessionRecord | null>;
  findSessionByTokenHashIncludingRevoked(refreshTokenHash: string): Promise<AuthSessionRecord | null>;
  findActiveSessions(userId: string): Promise<AuthSessionRecord[]>;
  /** Tra cứu 1 phiên theo id (dùng cho `GET /auth/sessions/:id`, chống IDOR). */
  findSessionById(sessionId: string): Promise<AuthSessionRecord | null>;
  /** Đánh dấu phiên vừa được dùng (cập nhật `last_used_at`). */
  touchSession(sessionId: string, lastUsedAt: Date): Promise<boolean>;
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

/**
 * Policy hạn phiên đăng nhập — đọc từ biến môi trường (infrastructure adapter).
 *
 * Lý do tách port: tầng `application` không được chạm `process.env`/ConfigService
 * trực tiếp (nguyên tắc Dependency Rule — xem test/clean-architecture.spec.ts).
 */
export const AUTH_SESSION_POLICY_PORT = Symbol('AuthSessionPolicyPort');

export interface AuthSessionPolicyPort {
  /** Hạn phiên (mili giây) cho từng trường hợp: thường (7 ngày) hoặc "ghi nhớ đăng nhập" (30 ngày). */
  refreshTtlMs(rememberMe: boolean): number;
}
