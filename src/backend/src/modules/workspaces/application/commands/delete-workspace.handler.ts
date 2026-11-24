/**
 * DeleteWorkspaceHandler — Use case: `deleteWorkspace()`
 * (thay đổi trạng thái) — theo §3.10 Command/Query pattern.
 *
 * Handler không biết HTTP: trả về kết quả hoặc ném lỗi nghiệp vụ.
 * Dependency chỉ qua port token — không inject adapter cụ thể.
 *
 * ── Cascade xóa ────────────────────────────────────────────────────────────
 * Xóa workspace phải **kéo theo** project bên trong. Trước đây chỉ workspace
 * bị soft-delete → project mồ côi vẫn còn và vẫn hiện trong `GET /projects`.
 *
 * Module `workspaces` **không được** import module `projects` (CA9 — đồ thị
 * phụ thuộc module không có chu trình; `projects` đã import `workspaces`).
 * → Dùng domain event: handler **phát** `WORKSPACE_DELETED` vào outbox, module
 * `projects` **tiêu thụ** và tự xóa project của mình (mô hình sagá).
 *
 * Ngoài ra vẫn có **lớp phòng thủ ở tầng query**: `findAllPaged` loại project
 * có workspace cha đã xoá, nên người dùng không thấy project mồ côi dù event
 * chưa được xử lý.
 *
 * ── OPEN-09 (Conflict #4): nguyên tử + nghiêm ──────────────────────────────
 * Ghi event `WORKSPACE_DELETED` **không còn là best-effort**. Nếu ghi event
 * thất bại ⇒ **rollback** luôn việc xoá mềm workspace ⇒ không bao giờ rơi vào
 * trạng thái "workspace đã xoá nhưng project bên trong không được dọn".
 */
import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  WORKSPACE_REPOSITORY_PORT,
  type WorkspaceRepositoryPort,
} from '../../domain/ports/workspace.repository.port';
import { GetWorkspaceByIdHandler } from '../queries/get-workspace-by-id.handler';
import { OUTBOX_PORT, type OutboxPort } from '../../../../shared/application/ports/outbox.port';
import { TRANSACTION_PORT, type TransactionPort } from '../../../../shared/application/ports/transaction.port';
import { WORKSPACE_EVENTS } from '../../domain/events/workspace-events';

@Injectable()
export class DeleteWorkspaceHandler {
  private readonly logger = new Logger(DeleteWorkspaceHandler.name);
  constructor(
    @Inject(WORKSPACE_REPOSITORY_PORT)
    private readonly workspaces: WorkspaceRepositoryPort,
    @Inject(OUTBOX_PORT)
    private readonly outbox: OutboxPort,
    @Inject(TRANSACTION_PORT)
    private readonly tx: TransactionPort,
    private readonly getWorkspaceByIdHandler: GetWorkspaceByIdHandler,
  ) {}

  async execute(id: string): Promise<boolean> {
    const workspace = await this.getWorkspaceByIdHandler.execute(id);

    // ── Ghi event + xoá mềm trong CÙNG một transaction ──────────────────
    const deleted = await this.tx.runInTransaction(async () => {
      const ok = await this.workspaces.softDelete(id);
      if (!ok) {
        this.logger.log(`Workspace ID: ${id} đã bị xóa trước đó — bỏ qua`);
        return false;
      }

      // Nghiêm (strict): lỗi ghi outbox ⇒ ném ra ⇒ rollback cả `softDelete`.
      await this.outbox.recordEvent({
        aggregate_type: 'WORKSPACE',
        aggregate_id: id,
        event_type: WORKSPACE_EVENTS.DELETED,
        payload: {
          workspace_id: id,
          workspace_name: workspace.name,
        },
        workspace_id: id,
      });

      return true;
    });

    if (deleted) {
      this.logger.log(`Đã xóa mềm Workspace ID: ${id} (đã phát event cascade)`);
    }
    return deleted;
  }
}
