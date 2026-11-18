import { type AuthSessionPort, type AuthSessionRecord } from '../../domain/ports/auth-session.port';
import { type UserRepositoryPort } from '../../../users/domain/ports/user.repository.port';
export declare class UsersAuthSessionAdapter implements AuthSessionPort {
    private readonly users;
    constructor(users: UserRepositoryPort);
    createSession(data: {
        userId: string;
        refreshTokenHash: string;
        deviceName?: string | null;
        ipAddress?: string | null;
        userAgent?: string | null;
        expiresAt: Date;
    }): Promise<AuthSessionRecord>;
    findSessionByTokenHashIncludingRevoked(refreshTokenHash: string): Promise<AuthSessionRecord | null>;
    findSessionByTokenHash(refreshTokenHash: string): Promise<AuthSessionRecord | null>;
    findActiveSessions(userId: string): Promise<AuthSessionRecord[]>;
    revokeSession(userId: string, sessionId: string): Promise<boolean>;
    revokeSessionById(sessionId: string): Promise<boolean>;
    revokeAllUserSessions(userId: string): Promise<number>;
}
