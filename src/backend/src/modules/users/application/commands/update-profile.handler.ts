/**
 * UpdateProfileHandler — Use case: `updateProfile()`
 * (thay đổi trạng thái) — theo §3.10 Command/Query pattern.
 *
 * Handler không biết HTTP: trả về kết quả hoặc ném lỗi nghiệp vụ.
 * Dependency chỉ qua port token — không inject adapter cụ thể.
 *
 * **Bước 3 — Rich Domain Model:** gọi `user.updateProfile()` để entity kiểm tra
 * invariant (tên không rỗng / ≤ 50 ký tự, giới thiệu ≤ 500 ký tự).
 * Trách nhiệm còn lại của handler: kiểm tra **duy nhất số điện thoại**
 * (cần truy vấn DB → không thể đặt trong entity).
 */
import { Inject, Injectable } from '@nestjs/common';
import {
  USER_REPOSITORY_PORT,
  type UpdateProfileInput,
  type UserRepositoryPort,
} from '../../domain/ports/user.repository.port';
import type { User } from '../../domain/entities/user.entity';
import { ConflictError, NotFoundError } from '../../../../shared/domain/errors';

@Injectable()
export class UpdateProfileHandler {
  constructor(
    @Inject(USER_REPOSITORY_PORT)
    private readonly users: UserRepositoryPort,
  ) {}

  async execute(
    userId: string,
    data: {
      first_name?: string;
      last_name?: string;
      avatar_url?: string;
      phone?: string | null;
      bio?: string | null;
    },
  ): Promise<User> {
    const current = await this.users.findById(userId);
    if (!current) {
      throw new NotFoundError('Không tìm thấy tài khoản người dùng');
    }

    // Số điện thoại phải duy nhất trong hệ thống (nếu được cung cấp).
    if (data.phone !== undefined && data.phone !== null && data.phone !== '') {
      const owner = await this.users.findByPhone(data.phone);
      if (owner && owner.id !== userId) {
        throw new ConflictError('Số điện thoại này đã được sử dụng bởi một tài khoản khác');
      }
    }

    // Entity kiểm tra invariant định dạng/độ dài.
    current.updateProfile({
      firstName: data.first_name,
      lastName: data.last_name,
      avatarUrl: data.avatar_url,
      phone: data.phone,
      bio: data.bio,
    });

    const input: UpdateProfileInput = {
      ...(data.first_name !== undefined ? { firstName: current.firstName } : {}),
      ...(data.last_name !== undefined ? { lastName: current.lastName } : {}),
      ...(data.avatar_url !== undefined ? { avatarUrl: current.avatarUrl } : {}),
      ...(data.phone !== undefined ? { phone: current.phone } : {}),
      ...(data.bio !== undefined ? { bio: current.bio } : {}),
    };
    const updated = await this.users.updateProfile(userId, input);
    if (!updated) {
      throw new NotFoundError('Không tìm thấy tài khoản người dùng');
    }
    return updated;
  }
}
