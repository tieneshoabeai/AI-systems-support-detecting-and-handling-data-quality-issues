/**
 * RevokeSessionHandler — Use case: `revokeSession()`
 * (thay đổi trạng thái) — theo §3.10 Command/Query pattern.
 *
 * Handler không biết HTTP: trả về kết quả hoặc ném lỗi nghiệp vụ.
 * Dependency chỉ qua port token — không inject adapter cụ thể.
 */
import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { AUTH_SESSION_PORT, type AuthSessionPort } from '../../domain/ports/auth-session.port';

@Injectable()
export class RevokeSessionHandler {
  constructor(
    @Inject(AUTH_SESSION_PORT)
    private readonly sessions: AuthSessionPort,
  ) {}

  async execute(userId: string, sessionId: string) {
    const success = await this.sessions.revokeSession(userId, sessionId);
    if (!success)
      throw new BadRequestException(
        'Không tìm thấy phiên đăng nhập hoặc phiên đã bị thu hồi trước đó',
      );
    return { message: 'Đã thu hồi phiên đăng nhập thành công' };
  }
}
