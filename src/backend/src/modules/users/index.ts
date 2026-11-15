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
