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

export interface UserRepositoryPort {
  findByEmail(email: string, includePassword?: boolean): Promise<UserRecord | null>;
  findById(id: string): Promise<UserRecord | null>;
  create(data: CreateUserInput): Promise<UserRecord>;
  updateProfile(userId: string, data: UpdateProfileInput): Promise<UserRecord | null>;
  updateNotificationPreferences(userId: string, enabled: boolean): Promise<boolean>;
  softDeleteUser(userId: string): Promise<boolean>;

  createSession(data: CreateSessionInput): Promise<UserSessionRecord>;
  findActiveSessions(userId: string): Promise<UserSessionRecord[]>;
  findSessionByTokenHash(refreshTokenHash: string): Promise<UserSessionRecord | null>;
  revokeSession(userId: string, sessionId: string): Promise<boolean>;
  revokeSessionById(sessionId: string): Promise<boolean>;
  revokeAllUserSessions(userId: string): Promise<number>;
}
