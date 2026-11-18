export declare const AUTH_EVENTS: {
    readonly LOGGED_IN: 'auth.logged_in';
    readonly LOGGED_OUT: 'auth.logged_out';
    readonly REFRESHED: 'auth.refreshed';
    readonly PASSWORD_RESET_REQUESTED: 'auth.password_reset_requested';
};
export type AuthEventName = (typeof AUTH_EVENTS)[keyof typeof AUTH_EVENTS];
export interface AuthEventPayload {
    userId: string;
    sessionId?: string;
    occurredAt: Date;
}
