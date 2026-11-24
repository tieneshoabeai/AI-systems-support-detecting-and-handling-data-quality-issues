/**
 * FindByIdHandler — Use case: `findById()`
 * (chỉ đọc) — theo §3.10 Command/Query pattern.
 *
 * Handler không biết HTTP: trả về kết quả hoặc ném lỗi nghiệp vụ.
 * Dependency chỉ qua port token — không inject adapter cụ thể.
 *
 * **Bước 3 — Rich Domain Model:** trả entity `User`.
 */
import { Inject, Injectable } from '@nestjs/common';
import {
  USER_REPOSITORY_PORT,
  type UserRepositoryPort,
} from '../../domain/ports/user.repository.port';
import type { User } from '../../domain/entities/user.entity';

@Injectable()
export class FindByIdHandler {
  constructor(
    @Inject(USER_REPOSITORY_PORT)
    private readonly users: UserRepositoryPort,
  ) {}

  async execute(id: string): Promise<User | null> {
    return this.users.findById(id);
  }
}
