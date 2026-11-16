/**
 * ChangePasswordHandler — Use case: `changePassword()`
 * (thay đổi trạng thái) — theo §3.10 Command/Query pattern.
 *
 * Handler không biết HTTP: trả về kết quả hoặc ném lỗi nghiệp vụ.
 * Dependency chỉ qua port token — không inject adapter cụ thể.
 */
import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { isAccountLocked } from '../../domain/value-objects/auth-policy.vo';
import {
  AUTH_USER_LOOKUP_PORT,
  PASSWORD_HASHER_PORT,
  type AuthUserLookupPort,
  type PasswordHasherPort,
} from '../../domain/ports/auth-session.port';
import { AUTH_SESSION_PORT, type AuthSessionPort } from '../../domain/ports/auth-session.port';

@Injectable()
export class ChangePasswordHandler {
  private readonly logger = new Logger(ChangePasswordHandler.name);
  constructor(
    @Inject(AUTH_USER_LOOKUP_PORT)
    private readonly users: AuthUserLookupPort,
    @Inject(PASSWORD_HASHER_PORT)
    private readonly hasher: PasswordHasherPort,
    @Inject(AUTH_SESSION_PORT)
    private readonly sessions: AuthSessionPort,
  ) {}

  async execute(
    userId: string,
    currentSessionId: string | undefined,
    currentPassword: string,
    newPassword: string,
    confirmPassword: string,
  ): Promise<{ message: string }> {
    if (newPassword !== confirmPassword)
      throw new BadRequestException('Hai lần nhập mật khẩu mới không khớp.');
    const u = await (
      this.users as unknown as {
        findByIdWithResetSecret(
          id: string,
        ): Promise<{ id: string; status: string; passwordHash?: string | null } | null>;
        setPasswordHash(id: string, h: string): Promise<boolean>;
      }
    ).findByIdWithResetSecret(userId);
    if (!u || !u.passwordHash)
      throw new BadRequestException('Không xác minh được mật khẩu hiện tại.');
    if (isAccountLocked(u.status))
      throw new UnauthorizedException(
        'Tài khoản của bạn đã bị khóa. Vui lòng liên hệ quản trị viên.',
      );
    const ok = await this.hasher.compare(currentPassword, u.passwordHash);
    if (!ok) throw new BadRequestException('Mật khẩu hiện tại không đúng.');
    const same = await this.hasher.compare(newPassword, u.passwordHash);
    if (same) throw new BadRequestException('Mật khẩu mới phải khác mật khẩu hiện tại.');
    const hash = await this.hasher.hash(newPassword);
    await (
      this.users as unknown as { setPasswordHash(id: string, h: string): Promise<boolean> }
    ).setPasswordHash(userId, hash);
    // Giữ phiên hiện tại, thu hồi các phiên khác
    try {
      const actives = await this.sessions.findActiveSessions(userId);
      for (const s of actives) {
        if (currentSessionId && s.id === currentSessionId) continue;
        await this.sessions.revokeSession(userId, s.id).catch(() => undefined);
      }
    } catch {
      /* không chặn đổi mật khẩu vì lỗi thu hồi phiên */
    }
    this.logger.log(`[AUTH-07] Đổi mật khẩu thành công cho user ${userId}; giữ phiên hiện tại.`);
    return { message: 'Đổi mật khẩu thành công.' };
  }
}
