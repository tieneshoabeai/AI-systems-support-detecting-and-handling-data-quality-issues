/**
 * ADMIN BOOTSTRAP — OPEN-01 (chốt 2026-11-19).
 *
 * Nguyên tắc: **không có endpoint công khai để tự phong admin**.
 *
 * - `POST /auth/register` chỉ tạo tài khoản `analyst` (không nhận `role`).
 * - Tài khoản `admin` được tạo **một lần** khi ứng dụng khởi động, từ hai biến
 *   môi trường: `ADMIN_EMAIL` + `ADMIN_PASSWORD`.
 *
 * Vì sao cần:
 * - Nếu admin chỉ có thể tự tạo qua API công khai → bất kỳ ai cũng có thể tự
 *   phong mình làm admin (privilege escalation).
 * - Nếu admin phải tự nhập tay qua console → dễ quên, dễ lệch môi trường.
 *
 * Hành vi **idempotent**: chạy lại nhiều lần vẫn chỉ có **một** admin, và không
 * ghi đè mật khẩu đã đặt (tránh reset mật khẩu mỗi lần restart).
 */
import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  AUTH_USER_LOOKUP_PORT,
  PASSWORD_HASHER_PORT,
  type AuthUserLookupPort,
  type PasswordHasherPort,
} from '../domain/ports/auth-session.port';

@Injectable()
export class AdminBootstrapService implements OnModuleInit {
  private readonly logger = new Logger(AdminBootstrapService.name);

  constructor(
    @Inject(AUTH_USER_LOOKUP_PORT)
    private readonly users: AuthUserLookupPort,
    @Inject(PASSWORD_HASHER_PORT)
    private readonly hasher: PasswordHasherPort,
    private readonly configService: ConfigService,
  ) {}

  async onModuleInit(): Promise<void> {
    try {
      await this.bootstrap();
    } catch (err: unknown) {
      // Không được làm sập ứng dụng vì lỗi bootstrap — nhưng phải cảnh báo rõ.
      this.logger.error(
        `Khong tao duoc tai khoan admin tu ADMIN_EMAIL/ADMIN_PASSWORD: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
  }

  /**
   * Tạo tài khoản admin nếu chưa có.
   *
   * @returns `true` nếu **vừa tạo** tài khoản admin; `false` nếu không cần tạo.
   */
  async bootstrap(): Promise<boolean> {
    const email = this.configService.get<string>('ADMIN_EMAIL')?.trim().toLowerCase();
    const password = this.configService.get<string>('ADMIN_PASSWORD');

    // Chưa cấu hình → không làm gì (đây là trạng thái hợp lệ ở môi trường dev).
    if (!email || !password) return false;

    const existing = await this.users.findByEmail(email);
    if (existing) {
      // Đã tồn tại → KHÔNG ghi đè mật khẩu (reset mỗi lần restart là rủi ro).
      this.logger.log(
        `Tai khoan admin da ton tai (${email}) — bo qua tao moi.`,
      );
      return false;
    }

    const passwordHash = await this.hasher.hash(password);
    const created = await this.users.create({
      email,
      passwordHash,
      firstName: 'Quản trị viên',
      lastName: 'Hệ thống',
      role: 'admin',
    });

    this.logger.log(`Da tao tai khoan admin tu ADMIN_EMAIL: ${email} (id=${created.id})`);
    return true;
  }
}
