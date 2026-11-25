/**
 * IncrementStorageUsedHandler — Use case: `incrementStorageUsed()`
 * (thay đổi trạng thái) — theo §3.10 Command/Query pattern.
 *
 * Handler không biết HTTP: trả về kết quả hoặc ném lỗi nghiệp vụ.
 * Dependency chỉ qua port token — không inject adapter cụ thể.
 *
 * ── Nghiêm (strict) — không nuốt lỗi ─────────────────────────────────────
 * Trước đây `execute()` nuốt lỗi (`.catch(() => undefined)`) ⇒ khi cập nhật
 * `storage_used` thất bại (MongoDB down, session hết hạn…) **không ai biết**,
 * dung lượng workspace vĩnh viễn lệch khỏi thực tế ⇒ người dùng bị chặn
 * upload oan (vượt quota giả) hoặc được phép upload vô hạn (quota lỗ).
 *
 * Nay lỗi được **ném ra** ⇒ trong luồng transaction (OPEN-09) sẽ rollback
 * toàn bộ thao tác chính; trong luồng event/cascade sẽ kích hoạt retry của
 * Inbox. Đây là hợp đồng "lỗi phải nhìn thấy được".
 */
import { Inject, Injectable } from '@nestjs/common';
import {
  WORKSPACE_REPOSITORY_PORT,
  type WorkspaceRepositoryPort,
} from '../../domain/ports/workspace.repository.port';

@Injectable()
export class IncrementStorageUsedHandler {
  constructor(
    @Inject(WORKSPACE_REPOSITORY_PORT)
    private readonly workspaces: WorkspaceRepositoryPort,
  ) {}

  async execute(workspaceId: string, deltaBytes: number): Promise<void> {
    await this.workspaces.addStorageUsed(workspaceId, deltaBytes);
  }
}
