/**
 * UpdateProfileHandler — Use case: `updateProfile()`
 * (thay đổi trạng thái) — theo §3.10 Command/Query pattern.
 *
 * Handler không biết HTTP: trả về kết quả hoặc ném lỗi nghiệp vụ.
 * Dependency chỉ qua port token — không inject adapter cụ thể.
 */
import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  USER_REPOSITORY_PORT,
  type UpdateProfileInput,
  type UserRecord,
  type UserRepositoryPort,
} from '../../domain/ports/user.repository.port';

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
  ): Promise<UserRecord> {
    // Số điện thoại phải duy nhất trong hệ thống (nếu được cung cấp).
    if (data.phone !== undefined && data.phone !== null && data.phone !== '') {
      const owner = await this.users.findByPhone(data.phone);
      if (owner && owner.id !== userId) {
        throw new ConflictException('Số điện thoại này đã được sử dụng bởi một tài khoản khác');
      }
    }
    const input: UpdateProfileInput = {
      ...(data.first_name !== undefined ? { firstName: data.first_name } : {}),
      ...(data.last_name !== undefined ? { lastName: data.last_name } : {}),
      ...(data.avatar_url !== undefined ? { avatarUrl: data.avatar_url } : {}),
      ...(data.phone !== undefined ? { phone: data.phone === '' ? null : data.phone } : {}),
      ...(data.bio !== undefined ? { bio: data.bio === '' ? null : data.bio } : {}),
    };
    const updated = await this.users.updateProfile(userId, input);
    if (!updated) {
      throw new NotFoundException('Không tìm thấy tài khoản người dùng');
    }
    return updated;
  }
}
