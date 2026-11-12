import { Inject, Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { normalizeEmail } from '../domain/value-objects/user-role.vo';
import {
  USER_REPOSITORY_PORT,
  type CreateSessionInput,
  type CreateUserInput,
  type UpdateProfileInput,
  type UserRecord,
  type UserRepositoryPort,
  type UserSessionRecord,
} from '../domain/ports/user.repository.port';

/**
 * USERS — Application service (orchestrator).
 * Chỉ phụ thuộc UserRepositoryPort (domain), không chạm Mongoose/schema.
 * Trả về domain Records (camelCase). Controller là nơi map ra HTTP response.
 */
@Injectable()
export class UsersService {
  constructor(
    @Inject(USER_REPOSITORY_PORT)
    private readonly users: UserRepositoryPort,
  ) {}

  async findByEmail(email: string, includePassword = false): Promise<UserRecord | null> {
    return this.users.findByEmail(normalizeEmail(email), includePassword);
  }

  async findById(id: string): Promise<UserRecord | null> {
    return this.users.findById(id);
  }

  async findPaged(opts: { search?: string; role?: string; status?: string; page: number; limit: number }) {
    return (this.users as unknown as { findPaged(o: unknown): Promise<{ items: UserRecord[]; total: number }> }).findPaged(opts);
  }

  async createUser(data: {
    email: string;
    password_hash: string;
    first_name: string;
    last_name: string;
    role?: 'admin' | 'analyst';
  }): Promise<UserRecord> {
    const email = normalizeEmail(data.email);
    const existing = await this.users.findByEmail(email);
    if (existing) {
      throw new ConflictException('Email này đã được sử dụng bởi một tài khoản khác');
    }
    const input: CreateUserInput = {
      email,
      passwordHash: data.password_hash,
      firstName: data.first_name,
      lastName: data.last_name,
      role: data.role,
    };
    return this.users.create(input);
  }

  async updateProfile(
    userId: string,
    data: { first_name?: string; last_name?: string; avatar_url?: string },
  ): Promise<UserRecord> {
    const input: UpdateProfileInput = {
      ...(data.first_name !== undefined ? { firstName: data.first_name } : {}),
      ...(data.last_name !== undefined ? { lastName: data.last_name } : {}),
      ...(data.avatar_url !== undefined ? { avatarUrl: data.avatar_url } : {}),
    };
    const updated = await this.users.updateProfile(userId, input);
    if (!updated) {
      throw new NotFoundException('Không tìm thấy tài khoản người dùng');
    }
    return updated;
  }

  async updateNotificationPreferences(userId: string, enabled: boolean): Promise<boolean> {
    const ok = await this.users.updateNotificationPreferences(userId, enabled);
    if (!ok) {
      throw new NotFoundException('Không tìm thấy tài khoản người dùng');
    }
    return enabled;
  }

  async softDeleteUser(userId: string): Promise<boolean> {
    const ok = await this.users.softDeleteUser(userId);
    if (!ok) {
      throw new NotFoundException('Không tìm thấy tài khoản hoặc tài khoản đã bị xóa');
    }
    return true;
  }

  async createSession(data: {
    user_id: string;
    refresh_token_hash: string;
    device_name?: string;
    ip_address?: string;
    user_agent?: string;
    expires_at: Date;
  }): Promise<UserSessionRecord> {
    const input: CreateSessionInput = {
      userId: data.user_id,
      refreshTokenHash: data.refresh_token_hash,
      deviceName: data.device_name,
      ipAddress: data.ip_address,
      userAgent: data.user_agent,
      expiresAt: data.expires_at,
    };
    return this.users.createSession(input);
  }

  async findActiveSessions(userId: string): Promise<UserSessionRecord[]> {
    return this.users.findActiveSessions(userId);
  }

  async revokeSession(userId: string, sessionId: string): Promise<boolean> {
    return this.users.revokeSession(userId, sessionId);
  }

  async revokeAllUserSessions(userId: string): Promise<number> {
    return this.users.revokeAllUserSessions(userId);
  }

  async findSessionByTokenHash(refreshTokenHash: string): Promise<UserSessionRecord | null> {
    return this.users.findSessionByTokenHash(refreshTokenHash);
  }

  async revokeSessionById(sessionId: string): Promise<boolean> {
    return this.users.revokeSessionById(sessionId);
  }
}
