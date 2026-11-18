import type { IUser } from './user.schema';
import type { IUserSession } from './user-session.schema';
import { User } from '../../domain/entities/user.entity';
import { UserSession } from '../../domain/entities/user-session.entity';
import type {
  PasswordResetState,
  UserWithResetSecret,
} from '../../domain/ports/user.repository.port';

/**
 * USERS — Mapper infrastructure ↔ domain entity.
 *
 * **Bước 3 — Rich Domain Model:** chiều document → entity dùng
 * `reconstitute()` (không phát domain event).
 */

/** Document Mongoose → entity `User`. */
export function toUserEntity(doc: IUser): User {
  return User.reconstitute({
    id: doc._id.toString(),
    email: doc.email,
    passwordHash: doc.password_hash ?? null,
    googleId: doc.google_id ?? null,
    authProvider: doc.auth_provider ?? 'local',
    firstName: doc.first_name,
    lastName: doc.last_name,
    avatarUrl: doc.avatar_url ?? null,
    phone: doc.phone ?? null,
    bio: doc.bio ?? null,
    role: doc.role,
    notificationsEnabled: doc.notifications_enabled !== false,
    status: doc.status,
    createdAt: doc.created_at,
    updatedAt: doc.updated_at,
    deletedAt: doc.deleted_at ?? null,
    version: 1,
  });
}

/** Document Mongoose → entity `User` + trạng thái reset mật khẩu. */
export function toUserWithResetSecret(doc: IUser): UserWithResetSecret {
  const base = toUserEntity(doc);
  const state: PasswordResetState = {
    tokenHash: doc.password_reset_token_hash ?? null,
    expiresAt: doc.password_reset_expires_at ?? null,
    attempts: doc.password_reset_attempts ?? 0,
    sentCount: doc.password_reset_sent_count ?? 0,
    windowStart: doc.password_reset_sent_window_start ?? null,
  };
  return Object.assign(base, state);
}

/** Document Mongoose → entity `UserSession`. */
export function toUserSessionEntity(doc: IUserSession): UserSession {
  return UserSession.reconstitute({
    id: doc._id.toString(),
    userId: doc.user_id.toString(),
    refreshTokenHash: doc.refresh_token_hash,
    deviceName: doc.device_name ?? null,
    ipAddress: doc.ip_address ?? null,
    userAgent: doc.user_agent ?? null,
    isRevoked: doc.is_revoked,
    rememberMe: doc.remember_me === true,
    lastUsedAt: doc.last_used_at ?? null,
    expiresAt: doc.expires_at,
    createdAt: doc.created_at,
    updatedAt: doc.updated_at,
    deletedAt: null,
    version: 1,
  });
}
