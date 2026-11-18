import { Inject, Injectable } from '@nestjs/common';
import {
  type AuthUserCreateInput,
  type AuthUserCreateWithGoogleInput,
  type AuthUserLookup,
  type AuthUserLookupPort,
} from '../../domain/ports/auth-session.port';
import {
  USER_REPOSITORY_PORT,
  type User,
  type UserRepositoryPort,
  type UserWithResetSecret,
} from '../../../users';

/**
 * Adapter AUTH_USER_LOOKUP_PORT -> USER_REPOSITORY_PORT.
 * Auth application không gọi UsersService/UsersRepository trự tiếp.
 *
 * **Bước 3 — Rich Domain Model:** repository trả entity `User` → adapter
 * ánh xạ entity → shape phẳng `AuthUserLookup` mà tầng auth mong đợi.
 * Việc ánh xạ tập trung ở đây giúp tầng auth **không** phụ thuộc cấu trúc
 * entity (domain) — chỉ phụ thuộc port.
 */
@Injectable()
export class UsersAuthLookupAdapter implements AuthUserLookupPort {
  constructor(@Inject(USER_REPOSITORY_PORT) private readonly users: UserRepositoryPort) {}

  /** Entity `User` → shape phẳng cho tầng auth. */
  private toLookup(u: User): AuthUserLookup {
    return {
      id: u.id,
      email: u.email,
      role: u.role,
      status: u.status,
      passwordHash: u.passwordHash ?? null,
      googleId: u.googleId ?? null,
      deletedAt: u.deletedAt,
    };
  }

  async findByEmail(email: string, includePassword?: boolean): Promise<AuthUserLookup | null> {
    const u = await this.users.findByEmail(email, includePassword);
    return u ? this.toLookup(u) : null;
  }

  async findById(id: string): Promise<AuthUserLookup | null> {
    const u = await this.users.findById(id);
    return u ? this.toLookup(u) : null;
  }

  async findByGoogleId(googleId: string): Promise<AuthUserLookup | null> {
    const u = await this.users.findByGoogleId(googleId);
    return u ? this.toLookup(u) : null;
  }

  async create(data: AuthUserCreateInput): Promise<AuthUserLookup> {
    const u = await this.users.create({
      email: data.email,
      passwordHash: data.passwordHash,
      googleId: null,
      authProvider: 'local',
      firstName: data.firstName,
      lastName: data.lastName,
      avatarUrl: null,
      role: data.role ?? 'analyst',
    });
    return this.toLookup(u);
  }

  async createWithGoogle(data: AuthUserCreateWithGoogleInput): Promise<AuthUserLookup> {
    const u = await this.users.createWithGoogle({
      email: data.email,
      googleId: data.googleId,
      firstName: data.firstName,
      lastName: data.lastName,
      avatarUrl: data.avatarUrl ?? null,
    });
    return this.toLookup(u);
  }

  async linkGoogleId(userId: string, googleId: string): Promise<AuthUserLookup | null> {
    const u = await this.users.linkGoogleId(userId, googleId);
    return u ? this.toLookup(u) : null;
  }

  async findByEmailWithResetSecret(email: string): Promise<UserWithResetSecret | null> {
    return this.users.findByEmailWithResetSecret(email);
  }

  async findByIdWithResetSecret(id: string): Promise<UserWithResetSecret | null> {
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
