import { Model } from 'mongoose';
import { IUser } from './user.schema';
import { IUserSession } from './user-session.schema';
import { type CreateSessionInput, type CreateUserInput, type UpdateProfileInput, type PasswordResetState, type UserRecord, type UserRepositoryPort, type UserSessionRecord } from '../../domain/ports/user.repository.port';
export declare class UsersRepository implements UserRepositoryPort {
    private readonly userModel;
    private readonly sessionModel;
    constructor(userModel: Model<IUser>, sessionModel: Model<IUserSession>);
    findByEmail(email: string, includePassword?: boolean): Promise<UserRecord | null>;
    findById(id: string): Promise<UserRecord | null>;
    findByIdWithResetSecret(id: string): Promise<(UserRecord & PasswordResetState) | null>;
    findByEmailWithResetSecret(email: string): Promise<(UserRecord & PasswordResetState) | null>;
    setPasswordResetOtp(email: string, tokenHash: string, expiresAt: Date, sentCount: number, windowStart: Date | null): Promise<boolean>;
    incrementResetAttempts(email: string): Promise<number>;
    clearPasswordReset(email: string): Promise<boolean>;
    setPasswordHash(userId: string, passwordHash: string): Promise<boolean>;
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
    create(data: CreateUserInput): Promise<UserRecord>;
    updateProfile(userId: string, data: UpdateProfileInput): Promise<UserRecord | null>;
    updateNotificationPreferences(userId: string, enabled: boolean): Promise<boolean>;
    softDeleteUser(userId: string): Promise<boolean>;
    createSession(data: CreateSessionInput): Promise<UserSessionRecord>;
    findActiveSessions(userId: string): Promise<UserSessionRecord[]>;
    findSessionByTokenHashIncludingRevoked(refreshTokenHash: string): Promise<UserSessionRecord | null>;
    findSessionByTokenHash(refreshTokenHash: string): Promise<UserSessionRecord | null>;
    revokeSession(userId: string, sessionId: string): Promise<boolean>;
    revokeSessionById(sessionId: string): Promise<boolean>;
    revokeAllUserSessions(userId: string): Promise<number>;
}
