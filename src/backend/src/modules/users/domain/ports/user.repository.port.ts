/**
 * USER — Domain repository port (chuẩn hexagonal như dự án mẫu).
 * Application chỉ phụ thuộc port này, không import persistence/schema.
 * Mọi id là string (hex ObjectId), không dùng ObjectId ở tầng domain/application.
 */

export const USER_REPOSITORY_PORT = Symbol('UserRepositoryPort');

export interface UserRecord {
  id: string;
  email: string;
  passwordHash?: string | null;
  googleId?: string | null;
  firstName: string;
  lastName: string;
  avatarUrl?: string | null;
  role: 'admin' | 'analyst';
  notificationsEnabled: boolean;
  status: 'active' | 'blocked';
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserSessionRecord {
  id: string;
  userId: string;
  refreshTokenHash: string;
  deviceName?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  isRevoked: boolean;
  expiresAt: Date;
  createdAt: Date;
}

export interface CreateUserInput {
  email: string;
  passwordHash: string;
  firstName: string;
  lastName: string;
  role?: 'admin' | 'analyst';
}

export interface UpdateProfileInput {
  firstName?: string;
  lastName?: string;
  avatarUrl?: string | null;
}

export interface CreateSessionInput {
  userId: string;
  refreshTokenHash: string;
  deviceName?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  expiresAt: Date;
}

export interface PasswordResetState {
  tokenHash: string | null;
  expiresAt: Date | null;
  attempts: number;
  sentCount: number;
  windowStart: Date | null;
}

export interface UserRepositoryPort {
  findByEmail(email: string, includePassword?: boolean): Promise<UserRecord | null>;
  findById(id: string): Promise<UserRecord | null>;
  findByIdWithResetSecret(id: string): Promise<(UserRecord & PasswordResetState) | null>;
  findByEmailWithResetSecret(email: string): Promise<(UserRecord & PasswordResetState) | null>;
  setPasswordResetOtp(email: string, tokenHash: string, expiresAt: Date, sentCount: number, windowStart: Date | null): Promise<boolean>;
  incrementResetAttempts(email: string): Promise<number>;
  clearPasswordReset(email: string): Promise<boolean>;
  setPasswordHash(userId: string, passwordHash: string): Promise<boolean>;
  findPaged(opts: { search?: string; role?: string; status?: string; page: number; limit: number }): Promise<{ items: UserRecord[]; total: number }>;

  create(data: CreateUserInput): Promise<UserRecord>;
  updateProfile(userId: string, data: UpdateProfileInput): Promise<UserRecord | null>;
  updateNotificationPreferences(userId: string, enabled: boolean): Promise<boolean>;
  softDeleteUser(userId: string): Promise<boolean>;

  createSession(data: CreateSessionInput): Promise<UserSessionRecord>;
  findSessionByTokenHashIncludingRevoked(refreshTokenHash: string): Promise<UserSessionRecord | null>;
  findActiveSessions(userId: string): Promise<UserSessionRecord[]>;
  findSessionByTokenHash(refreshTokenHash: string): Promise<UserSessionRecord | null>;
  revokeSession(userId: string, sessionId: string): Promise<boolean>;
  revokeSessionById(sessionId: string): Promise<boolean>;
  revokeAllUserSessions(userId: string): Promise<number>;
}
