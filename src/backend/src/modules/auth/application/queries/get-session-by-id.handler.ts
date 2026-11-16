/**
 * GetSessionByIdHandler — Use case: `getSessionById()`
 * (chỉ đọc) — theo §3.10 Command/Query pattern.
 *
 * Handler không biết HTTP: trả về kết quả hoặc ném lỗi nghiệp vụ.
 * Dependency chỉ qua port token — không inject adapter cụ thể.
 */
import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { AUTH_SESSION_PORT, type AuthSessionPort } from '../../domain/ports/auth-session.port';

@Injectable()
export class GetSessionByIdHandler {
  constructor(
    @Inject(AUTH_SESSION_PORT)
    private readonly sessions: AuthSessionPort,
  ) {}

  async execute(userId: string, sessionId: string): Promise<{ id: string; device_name: string | null; ip_address: string | null; user_agent: string | null; is_revoked: boolean; remember_me: boolean; last_used_at: string | null; expires_at: string; created_at: string | null; }> {
    const session = await this.sessions.findSessionById(sessionId);
    // Trả về 404 (không phải 403) để không lộ sự tồn tại của phiên của người khác.
    if (!session || session.userId !== userId) {
      throw new NotFoundException('Không tìm thấy phiên đăng nhập');
    }
    return {
      id: session.id,
      device_name: session.deviceName ?? null,
      ip_address: session.ipAddress ?? null,
      user_agent: session.userAgent ?? null,
      is_revoked: session.isRevoked,
      remember_me: session.rememberMe === true,
      last_used_at: session.lastUsedAt ? new Date(session.lastUsedAt).toISOString() : null,
      expires_at: new Date(session.expiresAt).toISOString(),
      created_at: session.createdAt ? new Date(session.createdAt).toISOString() : null,
    };
  }
}
