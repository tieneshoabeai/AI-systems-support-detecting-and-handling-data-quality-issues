/**
 * FindPagedHandler — Use case: `findPaged()`
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
export class FindPagedHandler {
  constructor(
    @Inject(USER_REPOSITORY_PORT)
    private readonly users: UserRepositoryPort,
  ) {}

  async execute(opts: {
    search?: string;
    role?: string;
    status?: string;
    page: number;
    limit: number;
  }) {
    return (
      this.users as unknown as {
        findPaged(o: unknown): Promise<{ items: UserRecord[]; total: number }>;
      }
    ).findPaged(opts);
  }
}
