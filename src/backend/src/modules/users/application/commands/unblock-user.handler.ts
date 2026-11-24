/**
 * UnblockUserHandler — Use case: mở khoá tài khoản (`status = 'active'`).
 *
 * **Mở khoá KHÔNG mở lại socket cũ** — socket đã bị đóng ở lúc khoá (OPEN-08).
 * Client phải kết nối lại (handshake sẽ được chấp nhận vì tài khoản đã active).
 *
 * Handler không biết HTTP: trả về kết quả hoặc ném lỗi nghiệp vụ.
 */
import { Inject, Injectable } from '@nestjs/common';
import {
  USER_REPOSITORY_PORT,
  type UserRepositoryPort,
} from '../../domain/ports/user.repository.port';
import { NotFoundError } from '../../../../shared/domain/errors';

@Injectable()
export class UnblockUserHandler {
  constructor(
    @Inject(USER_REPOSITORY_PORT)
    private readonly users: UserRepositoryPort,
  ) {}

  async execute(userId: string): Promise<boolean> {
    const current = await this.users.findById(userId);
    if (!current) {
      throw new NotFoundError('Không tìm thấy tài khoản người dùng');
    }
    if (!current.isBlocked()) {
      return false;
    }
    const ok = await this.users.setStatus(userId, 'active');
    if (!ok) {
      throw new NotFoundError('Không tìm thấy tài khoản người dùng');
    }
    return true;
  }
}
