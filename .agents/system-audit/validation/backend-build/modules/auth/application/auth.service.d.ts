import { type AuthTokenIssuerPort, type AuthUserLookupPort, type PasswordHasherPort } from '../domain/ports/auth-session.port';
import { type AuthSessionPort } from '../domain/ports/auth-session.port';
export interface RegisterInput {
    email: string;
    password: string;
    first_name: string;
    last_name: string;
    role?: 'admin' | 'analyst';
}
export interface LoginInput {
    email: string;
    password: string;
}
export declare class AuthService {
    private readonly users;
    private readonly sessions;
    private readonly hasher;
    private readonly tokens;
    private readonly logger;
    constructor(users: AuthUserLookupPort, sessions: AuthSessionPort, hasher: PasswordHasherPort, tokens: AuthTokenIssuerPort);
    register(dto: RegisterInput): Promise<{
        id: string;
        email: string;
        first_name: string;
        last_name: string;
        role: "admin" | "analyst";
        created_at: Date;
    }>;
    login(dto: LoginInput, ipAddress?: string, userAgent?: string): Promise<{
        access_token: string;
        refresh_token: string;
        expires_in: number;
        device_name: string;
        user: {
            id: string;
            email: string;
            role: "admin" | "analyst";
        };
    }>;
    refreshAccessToken(rawRefreshToken: string): Promise<{
        access_token: string;
        refresh_token: string;
        expires_in: number;
    }>;
    forgotPassword(emailRaw: string): Promise<{
        message: string;
    }>;
    resetPassword(emailRaw: string, otp: string, newPassword: string): Promise<{
        message: string;
    }>;
    changePassword(userId: string, currentSessionId: string | undefined, currentPassword: string, newPassword: string, confirmPassword: string): Promise<{
        message: string;
    }>;
    logout(sessionId?: string): Promise<{
        message: string;
    }>;
    getSessions(userId: string): Promise<import("../domain/ports/auth-session.port").AuthSessionRecord[]>;
    revokeSession(userId: string, sessionId: string): Promise<{
        message: string;
    }>;
}
