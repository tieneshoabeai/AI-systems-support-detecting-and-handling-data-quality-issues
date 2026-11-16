/**
 * CreateUserHandler — Use case: `createUser()`
 * (thay đổi trạng thái) — theo §3.10 Command/Query pattern.
 *
 * Handler không biết HTTP: trả về kết quả hoặc ném lỗi nghiệp vụ.
 * Dependency chỉ qua port token — không inject adapter cụ thể.
 */
import { ConflictException, Inject, Injectable } from '@nestjs/common';
import { normalizeEmail } from '../../domain/value-objects/user-role.vo';
import {
  USER_REPOSITORY_PORT,
  type CreateUserInput,
  type UserRecord,
  type UserRepositoryPort,
} from '../../domain/ports/user.repository.port';

@Injectable()
export class CreateUserHandler {
  constructor(
    @Inject(USER_REPOSITORY_PORT)
    private readonly users: UserRepositoryPort,
  ) {}

  async execute(data: {
    email: string;
    password_hash: string;
    first_name: string;
    last_name: string;
    role?: 'admin' | 'analyst';
  }): Promise<UserRecord> {
    const email = normalizeEmail(data.email);
    const existing = await this.users.findByEmail(email);
    if (existing) {
      throw new ConflictException('Email này đã được sử dụng bởi một tài khoản khác');
    }
    const input: CreateUserInput = {
      email,
      passwordHash: data.password_hash,
      firstName: data.first_name,
      lastName: data.last_name,
      role: data.role,
    };
    return this.users.create(input);
  }
}
