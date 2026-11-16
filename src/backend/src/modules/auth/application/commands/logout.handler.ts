/**
 * LogoutHandler — Use case: `logout()`
 * (thay đổi trạng thái) — theo §3.10 Command/Query pattern.
 *
 * Handler không biết HTTP: trả về kết quả hoặc ném lỗi nghiệp vụ.
 * Dependency chỉ qua port token — không inject adapter cụ thể.
 */
import { Inject, Injectable } from '@nestjs/common';
import { AUTH_SESSION_PORT, type AuthSessionPort } from '../../domain/ports/auth-session.port';

@Injectable()
export class LogoutHandler {
  constructor(
    @Inject(AUTH_SESSION_PORT)
    private readonly sessions: AuthSessionPort,
  ) {}

  async execute(sessionId?: string): Promise<{ message: string; }> {
    if (sessionId) await this.sessions.revokeSessionById(sessionId);
    return { message: 'Đăng xuất thành công' };
  }
}
