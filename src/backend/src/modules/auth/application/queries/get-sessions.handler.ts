/**
 * GetSessionsHandler — Use case: `getSessions()`
 * (chỉ đọc) — theo §3.10 Command/Query pattern.
 *
 * Handler không biết HTTP: trả về kết quả hoặc ném lỗi nghiệp vụ.
 * Dependency chỉ qua port token — không inject adapter cụ thể.
 */
import { Inject, Injectable } from '@nestjs/common';
import { AUTH_SESSION_PORT, type AuthSessionPort } from '../../domain/ports/auth-session.port';

@Injectable()
export class GetSessionsHandler {
  constructor(
    @Inject(AUTH_SESSION_PORT)
    private readonly sessions: AuthSessionPort,
  ) {}

  async execute(userId: string) {
    const sessions = await this.sessions.findActiveSessions(userId);
    return sessions.map((s) => ({
      id: s.id,
      device_name: s.deviceName ?? null,
      ip_address: s.ipAddress ?? null,
      user_agent: s.userAgent ?? null,
      is_revoked: s.isRevoked,
      remember_me: s.rememberMe === true,
      last_used_at: s.lastUsedAt ? new Date(s.lastUsedAt).toISOString() : null,
      expires_at: new Date(s.expiresAt).toISOString(),
      created_at: s.createdAt ? new Date(s.createdAt).toISOString() : null,
    }));
  }
}
