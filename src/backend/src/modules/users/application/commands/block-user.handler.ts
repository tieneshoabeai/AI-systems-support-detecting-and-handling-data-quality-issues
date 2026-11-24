/**
 * BlockUserHandler — Use case: khoá tài khoản (`status = 'blocked'`).
 *
 * **OPEN-08 — thu hồi realtime tức thì.** Khi tài khoản bị khoá:
 * 1. Ghi trạng thái `blocked` vào DB.
 * 2. **Đóng mọi socket realtime đang mở** của user (qua event `USER_BLOCKED`).
 * 3. Thu hồi toàn bộ phiên đăng nhập ⇒ access token cũ không dùng được nữa.
 *
 * Vì sao phải thu hồi phiên: access token còn hạn (mặc định 15 phút) thì vẫn
 * gọi được API. `JwtStrategy` chặn theo `user.status`, nhưng token đã cấp vẫn
 * có thể đã lọt tới cache/gateway — thu hồi phiên + đóng socket là lớp phòng
 * thủ bổ sung.
 *
 * Handler không biết HTTP: trả về kết quả hoặc ném lỗi nghiệp vụ.
 */
import { Inject, Injectable } from '@nestjs/common';
import {
  USER_REPOSITORY_PORT,
  type UserRepositoryPort,
} from '../../domain/ports/user.repository.port';
import { NotFoundError } from '../../../../shared/domain/errors';
import { UserAccessRevocationService } from '../services/user-access-revocation.service';

@Injectable()
export class BlockUserHandler {
  constructor(
    @Inject(USER_REPOSITORY_PORT)
    private readonly users: UserRepositoryPort,
    private readonly revocation: UserAccessRevocationService,
  ) {}

  async execute(userId: string): Promise<boolean> {
    const current = await this.users.findById(userId);
    if (!current) {
      throw new NotFoundError('Không tìm thấy tài khoản người dùng');
    }
    if (current.isBlocked()) {
      // Đã bị khoá rồi ⇒ không phát lại event (tránh spam thu hồi socket).
      return false;
    }
    const ok = await this.users.setStatus(userId, 'blocked');
    if (!ok) {
      throw new NotFoundError('Không tìm thấy tài khoản người dùng');
    }
    // Thu hồi realtime **tức thì** (OPEN-08).
    await this.revocation.revoke(userId, 'blocked');
    await this.users.revokeAllUserSessions(userId);
    return true;
  }
}
