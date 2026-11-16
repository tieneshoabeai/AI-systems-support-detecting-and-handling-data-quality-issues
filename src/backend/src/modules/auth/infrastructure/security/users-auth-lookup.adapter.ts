import { Inject, Injectable } from '@nestjs/common';
import {
  type AuthUserCreateInput,
  type AuthUserCreateWithGoogleInput,
  type AuthUserLookup,
  type AuthUserLookupPort,
} from '../../domain/ports/auth-session.port';
import {
  USER_REPOSITORY_PORT,
  type PasswordResetState,
  type UserRecord,
  type UserRepositoryPort,
} from '../../../users';

/**
 * Adapter AUTH_USER_LOOKUP_PORT -> USER_REPOSITORY_PORT.
 * Auth application không gọi UsersService/UsersRepository trực tiếp.
 */
@Injectable()
export class UsersAuthLookupAdapter implements AuthUserLookupPort {
  constructor(@Inject(USER_REPOSITORY_PORT) private readonly users: UserRepositoryPort) {}
  async findByEmail(email: string, includePassword?: boolean): Promise<AuthUserLookup | null> {
    const u = await this.users.findByEmail(email, includePassword);
    if (!u) return null;
    return { id: u.id, email: u.email, role: u.role, status: u.status, passwordHash: u.passwordHash ?? null, googleId: u.googleId ?? null, deletedAt: u.deletedAt };
  }
  async findById(id: string): Promise<AuthUserLookup | null> {
    const u = await this.users.findById(id);
    if (!u) return null;
    return { id: u.id, email: u.email, role: u.role, status: u.status, passwordHash: u.passwordHash ?? null, googleId: u.googleId ?? null, deletedAt: u.deletedAt };
  }
  async findByGoogleId(googleId: string): Promise<AuthUserLookup | null> {
    const u = await this.users.findByGoogleId(googleId);
    if (!u) return null;
    return { id: u.id, email: u.email, role: u.role, status: u.status, passwordHash: u.passwordHash ?? null, googleId: u.googleId ?? null, deletedAt: u.deletedAt };
  }
  async create(data: AuthUserCreateInput): Promise<AuthUserLookup> {
    const u = await this.users.create(data);
    return { id: u.id, email: u.email, role: u.role, status: u.status, passwordHash: u.passwordHash ?? null, googleId: u.googleId ?? null, deletedAt: u.deletedAt };
  }
  async createWithGoogle(data: AuthUserCreateWithGoogleInput): Promise<AuthUserLookup> {
    const u = await this.users.createWithGoogle(data);
    return { id: u.id, email: u.email, role: u.role, status: u.status, passwordHash: u.passwordHash ?? null, googleId: u.googleId ?? null, deletedAt: u.deletedAt };
  }
  async findByEmailWithResetSecret(email: string): Promise<((UserRecord & PasswordResetState) | null)> {
    return this.users.findByEmailWithResetSecret(email);
  }
  async findByIdWithResetSecret(id: string): Promise<((UserRecord & PasswordResetState) | null)> {
    return this.users.findByIdWithResetSecret(id);
  }
  async setPasswordResetOtp(email: string, tokenHash: string, expiresAt: Date, sentCount: number, windowStart: Date | null): Promise<boolean> {
    return this.users.setPasswordResetOtp(email, tokenHash, expiresAt, sentCount, windowStart);
  }
  async incrementResetAttempts(email: string): Promise<number> {
    return this.users.incrementResetAttempts(email);
  }
  async clearPasswordReset(email: string): Promise<boolean> {
    return this.users.clearPasswordReset(email);
  }
  async setPasswordHash(userId: string, passwordHash: string): Promise<boolean> {
    return this.users.setPasswordHash(userId, passwordHash);
  }
}
