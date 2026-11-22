import { Inject, Injectable } from '@nestjs/common';
import { type AuthSessionPort, type AuthSessionRecord } from '../../domain/ports/auth-session.port';
import {
  USER_REPOSITORY_PORT,
  type UserRepositoryPort,
  type UserSession,
} from '../../../users';

/**
 * Adapter AUTH_SESSION_PORT -> USER_REPOSITORY_PORT (sessions sống trong Users aggregate).
 *
 * **Bước 3 — Rich Domain Model:** repository trả entity `UserSession` →
 * adapter ánh xạ entity → shape phẳng `AuthSessionRecord` mà tầng auth
 * mong đợi (tầng auth không phụ thuộc cấu trúc entity).
 */
@Injectable()
export class UsersAuthSessionAdapter implements AuthSessionPort {
  constructor(@Inject(USER_REPOSITORY_PORT) private readonly users: UserRepositoryPort) {}

  /** Entity `UserSession` → shape phẳng cho tầng auth. */
  private toRecord(s: UserSession): AuthSessionRecord {
    return {
      id: s.id,
      userId: s.userId,
      refreshTokenHash: s.refreshTokenHash,
      deviceName: s.deviceName ?? null,
      ipAddress: s.ipAddress ?? null,
      userAgent: s.userAgent ?? null,
      isRevoked: s.isRevoked,
      rememberMe: s.rememberMe,
      lastUsedAt: s.lastUsedAt ?? null,
      expiresAt: s.expiresAt,
      createdAt: s.createdAt,
    };
  }

  async createSession(data: { userId: string; refreshTokenHash: string; deviceName?: string | null; ipAddress?: string | null; userAgent?: string | null; rememberMe?: boolean; expiresAt: Date }): Promise<AuthSessionRecord> {
    const s = await this.users.createSession({
      userId: data.userId,
      refreshTokenHash: data.refreshTokenHash,
      deviceName: data.deviceName,
      ipAddress: data.ipAddress,
      userAgent: data.userAgent,
      rememberMe: data.rememberMe === true,
      expiresAt: data.expiresAt,
    });
    return this.toRecord(s);
  }

  async findSessionByTokenHashIncludingRevoked(refreshTokenHash: string): Promise<AuthSessionRecord | null> {
    const s = await this.users.findSessionByTokenHashIncludingRevoked(refreshTokenHash);
    return s ? this.toRecord(s) : null;
  }

  async findSessionByTokenHash(refreshTokenHash: string): Promise<AuthSessionRecord | null> {
    const s = await this.users.findSessionByTokenHash(refreshTokenHash);
    return s ? this.toRecord(s) : null;
  }

  async findActiveSessions(userId: string): Promise<AuthSessionRecord[]> {
    const sessions = await this.users.findActiveSessions(userId);
    return sessions.map((s) => this.toRecord(s));
  }

  async findSessionById(sessionId: string): Promise<AuthSessionRecord | null> {
    const s = await this.users.findSessionById(sessionId);
    return s ? this.toRecord(s) : null;
  }

  touchSession(sessionId: string, lastUsedAt: Date): Promise<boolean> {
    return this.users.touchSession(sessionId, lastUsedAt);
  }

  revokeSession(userId: string, sessionId: string): Promise<boolean> {
    return this.users.revokeSession(userId, sessionId);
  }

  revokeSessionById(sessionId: string): Promise<boolean> {
    return this.users.revokeSessionById(sessionId);
  }

  revokeAllUserSessions(userId: string): Promise<number> {
    return this.users.revokeAllUserSessions(userId);
  }
}
