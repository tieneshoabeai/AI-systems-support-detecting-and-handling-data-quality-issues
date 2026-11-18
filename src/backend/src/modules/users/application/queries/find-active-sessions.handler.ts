/**
 * FindActiveSessionsHandler — Use case: `findActiveSessions()`
 * (chỉ đọc) — theo §3.10 Command/Query pattern.
 *
 * Handler không biết HTTP: trả về kết quả hoặc ném lỗi nghiệp vụ.
 * Dependency chỉ qua port token — không inject adapter cụ thể.
 *
 * **Bước 3 — Rich Domain Model:** trả entity `UserSession[]`.
 */
import { Inject, Injectable } from '@nestjs/common';
import {
  USER_REPOSITORY_PORT,
  type UserRepositoryPort,
} from '../../domain/ports/user.repository.port';
import type { UserSession } from '../../domain/entities/user-session.entity';

@Injectable()
export class FindActiveSessionsHandler {
  constructor(
    @Inject(USER_REPOSITORY_PORT)
    private readonly users: UserRepositoryPort,
  ) {}

  async execute(userId: string): Promise<UserSession[]> {
    return this.users.findActiveSessions(userId);
  }
}
