/**
 * FindByEmailHandler — Use case: `findByEmail()`
 * (chỉ đọc) — theo §3.10 Command/Query pattern.
 *
 * Handler không biết HTTP: trả về kết quả hoặc ném lỗi nghiệp vụ.
 * Dependency chỉ qua port token — không inject adapter cụ thể.
 *
 * **Bước 3 — Rich Domain Model:** trả entity `User`; chuẩn hoá email do VO
 * `normalizeEmail()` đảm nhiệm (nguồn sự thật duy nhất).
 */
import { Inject, Injectable } from '@nestjs/common';
import { normalizeEmail } from '../../domain/value-objects/user-role.vo';
import {
  USER_REPOSITORY_PORT,
  type UserRepositoryPort,
} from '../../domain/ports/user.repository.port';
import type { User } from '../../domain/entities/user.entity';

@Injectable()
export class FindByEmailHandler {
  constructor(
    @Inject(USER_REPOSITORY_PORT)
    private readonly users: UserRepositoryPort,
  ) {}

  async execute(email: string, includePassword = false): Promise<User | null> {
    return this.users.findByEmail(normalizeEmail(email), includePassword);
  }
}
