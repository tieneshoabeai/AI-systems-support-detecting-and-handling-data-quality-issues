/**
 * CreateUserHandler — Use case: `createUser()`
 * (thay đổi trạng thái) — theo §3.10 Command/Query pattern.
 *
 * Handler không biết HTTP: trả về kết quả hoặc ném lỗi nghiệp vụ.
 * Dependency chỉ qua port token — không inject adapter cụ thể.
 *
 * **Bước 3 — Rich Domain Model:** dùng `User.create()` để chuẩn hoá email,
 * áp dụng mặc định role/status — handler không tự chuẩn hoá.
 */
import { Inject, Injectable } from '@nestjs/common';
import {
  USER_REPOSITORY_PORT,
  type CreateUserInput,
  type UserRepositoryPort,
} from '../../domain/ports/user.repository.port';
import type { User } from '../../domain/entities/user.entity';
import { User as UserEntity } from '../../domain/entities/user.entity';
import { ConflictError } from '../../../../shared/domain/errors';

@Injectable()
export class CreateUserHandler {
  constructor(
    @Inject(USER_REPOSITORY_PORT)
    private readonly users: UserRepositoryPort,
  ) {}

  async execute(data: {
    id: string;
    email: string;
    password_hash: string;
    first_name: string;
    last_name: string;
    role?: 'admin' | 'analyst';
  }): Promise<User> {
    // Entity chuẩn hoá email (lowercase + trim) — nguồn sự thật duy nhất.
    const entity = UserEntity.create({
      id: data.id,
      email: data.email,
      passwordHash: data.password_hash,
      firstName: data.first_name,
      lastName: data.last_name,
      role: data.role,
    });

    const existing = await this.users.findByEmail(entity.email);
    if (existing) {
      throw new ConflictError('Email này đã được sử dụng bởi một tài khoản khác');
    }

    const input: CreateUserInput = {
      email: entity.email,
      passwordHash: entity.passwordHash,
      googleId: entity.googleId,
      authProvider: entity.authProvider,
      firstName: entity.firstName,
      lastName: entity.lastName,
      avatarUrl: entity.avatarUrl,
      role: entity.role,
    };
    return this.users.create(input);
  }
}
