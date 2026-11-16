/**
 * Public contract của module USERS.
 *
 * Các module khác chỉ được import qua file này (quy tắc CA8 — cross-module
 * import phải đi qua public contract), không import sâu vào
 * `domain/ports/...` hay `application/...`.
 */

export {
  USER_REPOSITORY_PORT,
  type CreateSessionInput,
  type CreateUserInput,
  type UpdateProfileInput,
  type PasswordResetState,
  type UserRecord,
  type UserRepositoryPort,
  type UserSessionRecord,
} from './domain/ports/user.repository.port';

export {
  USER_ROLES,
  USER_STATUSES,
  canUserLogin,
  isUserBlocked,
  isUserDeleted,
  normalizeEmail,
  type UserRole,
  type UserStatus,
} from './domain/value-objects/user-role.vo';

// ── Handlers (Command/Query) ──────────────────────────
// ── Queries (đọc) ──────────────────────────────────────────────
export { FindActiveSessionsHandler } from './application/queries/find-active-sessions.handler';
export { FindByEmailHandler } from './application/queries/find-by-email.handler';
export { FindByIdHandler } from './application/queries/find-by-id.handler';
export { FindPagedHandler } from './application/queries/find-paged.handler';
export { FindSessionByIdHandler } from './application/queries/find-session-by-id.handler';
export { FindSessionByTokenHashHandler } from './application/queries/find-session-by-token-hash.handler';

// ── Commands (ghi) ─────────────────────────────────────────────
export { CreateSessionHandler } from './application/commands/create-session.handler';
export { CreateUserHandler } from './application/commands/create-user.handler';
export { RevokeAllUserSessionsHandler } from './application/commands/revoke-all-user-sessions.handler';
export { RevokeSessionByIdHandler } from './application/commands/revoke-session-by-id.handler';
export { RevokeSessionHandler } from './application/commands/revoke-session.handler';
export { SoftDeleteUserHandler } from './application/commands/soft-delete-user.handler';
export { TouchSessionHandler } from './application/commands/touch-session.handler';
export { UpdateNotificationPreferencesHandler } from './application/commands/update-notification-preferences.handler';
export { UpdateProfileHandler } from './application/commands/update-profile.handler';
