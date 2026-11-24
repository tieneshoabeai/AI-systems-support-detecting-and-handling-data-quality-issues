/**
 * SoftDeleteUserHandler — Use case: `softDeleteUser()`
 * (thay đổi trạng thái) — theo §3.10 Command/Query pattern.
 *
 * Handler không biết HTTP: trả về kết quả hoặc ném lỗi nghiệp vụ.
 * Dependency chỉ qua port token — không inject adapter cụ thể.
 *
 * **Bước 3 — Rich Domain Model:** gọi `user.softDelete()` để entity tự bảo vệ
 * (xoá 2 lần → `ConflictError`; xoá mềm đồng thời chặn đăng nhập).
 * Việc **thu hồi toàn bộ phiên** vẫn ở repository (thao tác hàng loạt trên
 * collection `user_sessions` — không thuộc aggregate `User`).
 *
 * **OPEN-08 — thu hồi realtime tức thì.** Tài khoản bị xoá ⇒ mọi socket
 * realtime đang mở của user phải bị đóng ngay lập tức (không đợi access token
 * hết hạn).
 *
 * **OPEN-09 (Conflict #4) — nguyên tử.** Xoá mềm tài khoản + ghi event thu hồi
 * nằm trong **cùng một transaction**: nếu ghi event thất bại ⇒ rollback xoá mềm
 * ⇒ không rơi vào trạng thái "tài khoản đã xoá nhưng socket cũ vẫn sống".
 * Đóng socket tức thì chỉ chạy **sau khi** transaction commit.
 */
import { Inject, Injectable } from '@nestjs/common';
import {
  USER_REPOSITORY_PORT,
  type UserRepositoryPort,
} from '../../domain/ports/user.repository.port';
import { NotFoundError } from '../../../../shared/domain/errors';
import {
  TRANSACTION_PORT,
  type TransactionPort,
} from '../../../../shared/application/ports/transaction.port';
import { UserAccessRevocationService } from '../services/user-access-revocation.service';

@Injectable()
export class SoftDeleteUserHandler {
  constructor(
    @Inject(USER_REPOSITORY_PORT)
    private readonly users: UserRepositoryPort,
    @Inject(TRANSACTION_PORT)
    private readonly tx: TransactionPort,
    private readonly revocation: UserAccessRevocationService,
  ) {}

  async execute(userId: string): Promise<boolean> {
    const current = await this.users.findById(userId);
    if (!current) {
      throw new NotFoundError('Không tìm thấy tài khoản hoặc tài khoản đã bị xóa');
    }
    current.softDelete();

    // ── Xoá mềm + ghi event thu hồi trong CÙNG một transaction ──────────
    await this.tx.runInTransaction(async () => {
      const ok = await this.users.softDeleteUser(userId);
      if (!ok) {
        throw new NotFoundError('Không tìm thấy tài khoản hoặc tài khoản đã bị xóa');
      }
      // Nghiêm (strict): lỗi ghi outbox ⇒ ném ra ⇒ rollback cả `softDeleteUser`.
      await this.revocation.revokeStrict(userId, 'removed');
    });

    // Chỉ sau khi commit mới đóng socket (OPEN-08).
    await this.revocation.publishImmediateNow(userId, 'removed');
    return true;
  }
}
