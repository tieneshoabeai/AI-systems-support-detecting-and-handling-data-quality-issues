/**
 * FindSessionByTokenHashHandler — Use case: `findSessionByTokenHash()`
 * (chỉ đọc) — theo §3.10 Command/Query pattern.
 *
 * Handler không biết HTTP: trả về kết quả hoặc ném lỗi nghiệp vụ.
 * Dependency chỉ qua port token — không inject adapter cụ thể.
 */
import { Inject, Injectable } from '@nestjs/common';
import {
  USER_REPOSITORY_PORT,
  type UserRepositoryPort,
  type UserSessionRecord,
} from '../../domain/ports/user.repository.port';

@Injectable()
export class FindSessionByTokenHashHandler {
  constructor(
    @Inject(USER_REPOSITORY_PORT)
    private readonly users: UserRepositoryPort,
  ) {}

  async execute(refreshTokenHash: string): Promise<UserSessionRecord | null> {
    return this.users.findSessionByTokenHash(refreshTokenHash);
  }
}
