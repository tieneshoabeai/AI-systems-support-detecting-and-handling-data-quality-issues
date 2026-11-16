/**
 * Public contract của module AUTH.
 *
 * Các module khác chỉ được import qua file này (quy tắc CA8 — cross-module
 * import phải đi qua public contract), không import sâu vào
 * `domain/ports/...` hay `application/...`.
 */

export {
  AUTH_SESSION_POLICY_PORT,
  AUTH_SESSION_PORT,
  AUTH_TOKEN_ISSUER_PORT,
  AUTH_USER_LOOKUP_PORT,
  PASSWORD_HASHER_PORT,
  type AuthPasswordResetState,
  type AuthSessionPolicyPort,
  type AuthSessionPort,
  type AuthSessionRecord,
  type AuthTokenIssuerPort,
  type AuthTokenPayload,
  type AuthUserCreateInput,
  type AuthUserCreateWithGoogleInput,
  type AuthUserLookup,
  type AuthUserLookupPort,
  type PasswordHasherPort,
} from './domain/ports/auth-session.port';

export {
  GOOGLE_OAUTH_PORT,
  type GoogleOAuthPort,
  type GoogleProfile,
} from './domain/ports/google-oauth.port';

export {
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  isPasswordLengthValid,
} from './domain/value-objects/password-policy.vo';

export {
  AUTH_EVENTS,
  type AuthEventName,
  type AuthEventPayload,
} from './domain/events/auth-events';

// ── Handlers (Command/Query) ──────────────────────────
// ── Queries (đọc) ──────────────────────────────────────────────
export { GetSessionByIdHandler } from './application/queries/get-session-by-id.handler';
export { GetSessionsHandler } from './application/queries/get-sessions.handler';

// ── Commands (ghi) ─────────────────────────────────────────────
export { ChangePasswordHandler } from './application/commands/change-password.handler';
export { ForgotPasswordHandler } from './application/commands/forgot-password.handler';
export { LoginHandler } from './application/commands/login.handler';
export { LoginWithGoogleHandler } from './application/commands/login-with-google.handler';
export { LogoutHandler } from './application/commands/logout.handler';
export { RefreshAccessTokenHandler } from './application/commands/refresh-access-token.handler';
export { RegisterHandler } from './application/commands/register.handler';
export { ResetPasswordHandler } from './application/commands/reset-password.handler';
export { RevokeSessionHandler } from './application/commands/revoke-session.handler';
