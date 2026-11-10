export const AUTH_EVENTS = {
  LOGGED_IN: 'auth.logged_in',
  LOGGED_OUT: 'auth.logged_out',
  REFRESHED: 'auth.refreshed',
  PASSWORD_RESET_REQUESTED: 'auth.password_reset_requested',
} as const;

export type AuthEventName = (typeof AUTH_EVENTS)[keyof typeof AUTH_EVENTS];

export interface AuthEventPayload {
  userId: string;
  sessionId?: string;
  occurredAt: Date;
}
