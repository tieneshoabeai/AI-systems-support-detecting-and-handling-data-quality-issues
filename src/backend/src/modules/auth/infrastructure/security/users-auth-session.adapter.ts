import { Inject, Injectable } from '@nestjs/common';
import { AUTH_SESSION_PORT, type AuthSessionPort, type AuthSessionRecord } from '../../domain/ports/auth-session.port';
import { USER_REPOSITORY_PORT, type UserRepositoryPort } from '../../../users/domain/ports/user.repository.port';

/** Adapter AUTH_SESSION_PORT -> USER_REPOSITORY_PORT (sessions sống trong Users aggregate). */
@Injectable()
export class UsersAuthSessionAdapter implements AuthSessionPort {
  constructor(@Inject(USER_REPOSITORY_PORT) private readonly users: UserRepositoryPort) {}
  async createSession(data: { userId: string; refreshTokenHash: string; deviceName?: string | null; ipAddress?: string | null; userAgent?: string | null; expiresAt: Date }): Promise<AuthSessionRecord> {
    const s = await this.users.createSession({
      userId: data.userId,
      refreshTokenHash: data.refreshTokenHash,
      deviceName: data.deviceName,
      ipAddress: data.ipAddress,
      userAgent: data.userAgent,
      expiresAt: data.expiresAt,
    });
    return { id: s.id, userId: s.userId, refreshTokenHash: s.refreshTokenHash, deviceName: s.deviceName ?? null, ipAddress: s.ipAddress ?? null, userAgent: s.userAgent ?? null, isRevoked: s.isRevoked, expiresAt: s.expiresAt };
  }
  findSessionByTokenHashIncludingRevoked(refreshTokenHash: string): Promise<AuthSessionRecord | null> {
    return this.users.findSessionByTokenHashIncludingRevoked(refreshTokenHash) as unknown as Promise<AuthSessionRecord | null>;
  }
  findSessionByTokenHash(refreshTokenHash: string): Promise<AuthSessionRecord | null> {
    return this.users.findSessionByTokenHash(refreshTokenHash) as unknown as Promise<AuthSessionRecord | null>;
  }
  findActiveSessions(userId: string): Promise<AuthSessionRecord[]> {
    return this.users.findActiveSessions(userId) as unknown as Promise<AuthSessionRecord[]>;
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
