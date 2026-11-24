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
  type CreateUserWithGoogleInput,
  type UpdateProfileInput,
  type PasswordResetState,
  type UserRepositoryPort,
  type UserWithResetSecret,
} from './domain/ports/user.repository.port';

// ── Events (OPEN-08) ─────────────────────────────────────────────
export {
  USER_EVENTS,
  USER_OUTBOX_EVENTS,
  type UserEventName,
  type UserOutboxEventName,
} from './domain/events/user-events';

// ── Entities (Bước 3 — Rich Domain Model) ──────────────────────
export {
  User,
  type AuthProvider,
  type UserProps,
  MAX_BIO_LENGTH,
  MAX_NAME_LENGTH,
} from './domain/entities/user.entity';
export {
  UserSession,
  type UserSessionProps,
} from './domain/entities/user-session.entity';
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

// ── Presentation ──────────────────────────────────────────────
export {
  toUserResponse,
  toUserResponses,
  type UserResponse,
} from './presentation/responses/user.response';

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
export { BlockUserHandler } from './application/commands/block-user.handler';
export { UnblockUserHandler } from './application/commands/unblock-user.handler';
export { RevokeAllUserSessionsHandler } from './application/commands/revoke-all-user-sessions.handler';
export { RevokeSessionByIdHandler } from './application/commands/revoke-session-by-id.handler';
export { RevokeSessionHandler } from './application/commands/revoke-session.handler';
export { SoftDeleteUserHandler } from './application/commands/soft-delete-user.handler';
export { TouchSessionHandler } from './application/commands/touch-session.handler';
export { UpdateNotificationPreferencesHandler } from './application/commands/update-notification-preferences.handler';
export { UpdateProfileHandler } from './application/commands/update-profile.handler';

// ── Services (OPEN-08 — thu hồi realtime) ─────────────────────────
export {
  UserAccessRevocationService,
  type UserRevocationStatus,
} from './application/services/user-access-revocation.service';
