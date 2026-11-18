import { type UserRecord, type UserRepositoryPort, type UserSessionRecord } from '../domain/ports/user.repository.port';
export declare class UsersService {
    private readonly users;
    constructor(users: UserRepositoryPort);
    findByEmail(email: string, includePassword?: boolean): Promise<UserRecord | null>;
    findById(id: string): Promise<UserRecord | null>;
    findPaged(opts: {
        search?: string;
        role?: string;
        status?: string;
        page: number;
        limit: number;
    }): Promise<{
        items: UserRecord[];
        total: number;
    }>;
    createUser(data: {
        email: string;
        password_hash: string;
        first_name: string;
        last_name: string;
        role?: 'admin' | 'analyst';
    }): Promise<UserRecord>;
    updateProfile(userId: string, data: {
        first_name?: string;
        last_name?: string;
        avatar_url?: string;
    }): Promise<UserRecord>;
    updateNotificationPreferences(userId: string, enabled: boolean): Promise<boolean>;
    softDeleteUser(userId: string): Promise<boolean>;
    createSession(data: {
        user_id: string;
        refresh_token_hash: string;
        device_name?: string;
        ip_address?: string;
        user_agent?: string;
        expires_at: Date;
    }): Promise<UserSessionRecord>;
    findActiveSessions(userId: string): Promise<UserSessionRecord[]>;
    revokeSession(userId: string, sessionId: string): Promise<boolean>;
    revokeAllUserSessions(userId: string): Promise<number>;
    findSessionByTokenHash(refreshTokenHash: string): Promise<UserSessionRecord | null>;
    revokeSessionById(sessionId: string): Promise<boolean>;
}
