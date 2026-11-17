import { type AuthUserCreateInput, type AuthUserLookup, type AuthUserLookupPort } from '../../domain/ports/auth-session.port';
import { type PasswordResetState, type UserRecord, type UserRepositoryPort } from '../../../users/domain/ports/user.repository.port';
export declare class UsersAuthLookupAdapter implements AuthUserLookupPort {
    private readonly users;
    constructor(users: UserRepositoryPort);
    findByEmail(email: string, includePassword?: boolean): Promise<AuthUserLookup | null>;
    findById(id: string): Promise<AuthUserLookup | null>;
    create(data: AuthUserCreateInput): Promise<AuthUserLookup>;
    findByEmailWithResetSecret(email: string): Promise<((UserRecord & PasswordResetState) | null)>;
    findByIdWithResetSecret(id: string): Promise<((UserRecord & PasswordResetState) | null)>;
    setPasswordResetOtp(email: string, tokenHash: string, expiresAt: Date, sentCount: number, windowStart: Date | null): Promise<boolean>;
    incrementResetAttempts(email: string): Promise<number>;
    clearPasswordReset(email: string): Promise<boolean>;
    setPasswordHash(userId: string, passwordHash: string): Promise<boolean>;
}
