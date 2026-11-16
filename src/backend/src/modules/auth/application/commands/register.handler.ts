/**
 * RegisterHandler — Use case: `register()`
 * (thay đổi trạng thái) — theo §3.10 Command/Query pattern.
 *
 * Handler không biết HTTP: trả về kết quả hoặc ném lỗi nghiệp vụ.
 * Dependency chỉ qua port token — không inject adapter cụ thể.
 */
import { ConflictException, Inject, Injectable } from '@nestjs/common';
import {
  AUTH_USER_LOOKUP_PORT,
  PASSWORD_HASHER_PORT,
  type AuthUserLookupPort,
  type PasswordHasherPort,
} from '../../domain/ports/auth-session.port';
import { RegisterInput } from '../auth.types';

@Injectable()
export class RegisterHandler {
  constructor(
    @Inject(AUTH_USER_LOOKUP_PORT)
    private readonly users: AuthUserLookupPort,
    @Inject(PASSWORD_HASHER_PORT)
    private readonly hasher: PasswordHasherPort,
  ) {}

  async execute(dto: RegisterInput): Promise<{ id: string; email: string; first_name: string; last_name: string; role: "admin" | "analyst"; created_at: Date; }> {
    const email = dto.email.toLowerCase().trim();
    const existing = await this.users.findByEmail(email);
    if (existing) {
      throw new ConflictException('Email này đã được sử dụng bởi một tài khoản khác');
    }
    const passwordHash = await this.hasher.hash(dto.password);
    // Đặc tả §3.34.1: không có endpoint công khai để tự phong admin — ép analyst.
    const created = await this.users.create({
      email,
      passwordHash,
      firstName: dto.first_name,
      lastName: dto.last_name,
      role: 'analyst',
    });
    return {
      id: created.id,
      email: created.email,
      first_name: dto.first_name,
      last_name: dto.last_name,
      role: created.role,
      created_at: (created as unknown as { createdAt?: Date }).createdAt ?? new Date(),
    };
  }
}
