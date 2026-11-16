/**
 * FindByIdHandler — Use case: `findById()`
 * (chỉ đọc) — theo §3.10 Command/Query pattern.
 *
 * Handler không biết HTTP: trả về kết quả hoặc ném lỗi nghiệp vụ.
 * Dependency chỉ qua port token — không inject adapter cụ thể.
 */
import { Inject, Injectable } from '@nestjs/common';
import {
  USER_REPOSITORY_PORT,
  type UserRecord,
  type UserRepositoryPort,
} from '../../domain/ports/user.repository.port';

@Injectable()
export class FindByIdHandler {
  constructor(
    @Inject(USER_REPOSITORY_PORT)
    private readonly users: UserRepositoryPort,
  ) {}

  async execute(id: string): Promise<UserRecord | null> {
    return this.users.findById(id);
  }
}
