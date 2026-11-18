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
 * có workspace cha đã xóa, nên người dùng không thấy project mồ côi dù event
 * chưa được xử lý.
 */
import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  WORKSPACE_REPOSITORY_PORT,
  type WorkspaceRepositoryPort,
} from '../../domain/ports/workspace.repository.port';
import { GetWorkspaceByIdHandler } from '../queries/get-workspace-by-id.handler';
import { OUTBOX_PORT, type OutboxPort } from '../../../../shared/application/ports/outbox.port';
import { WORKSPACE_EVENTS } from '../../domain/events/workspace-events';

@Injectable()
export class DeleteWorkspaceHandler {
  private readonly logger = new Logger(DeleteWorkspaceHandler.name);
  constructor(
    @Inject(WORKSPACE_REPOSITORY_PORT)
    private readonly workspaces: WorkspaceRepositoryPort,
    @Inject(OUTBOX_PORT)
    private readonly outbox: OutboxPort,
    private readonly getWorkspaceByIdHandler: GetWorkspaceByIdHandler,
  ) {}

  async execute(id: string): Promise<boolean> {
    const workspace = await this.getWorkspaceByIdHandler.execute(id);
    const deleted = await this.workspaces.softDelete(id);
    if (!deleted) {
      this.logger.log(`Workspace ID: ${id} đã bị xóa trước đó — bỏ qua`);
      return false;
    }

    // Phát event để cascade xóa project (và dataset) của workspace này.
    // Lỗi ghi outbox không được làm hỏng việc xóa workspace.
    try {
      await this.outbox.recordEvent({
        aggregate_type: 'WORKSPACE',
        aggregate_id: id,
        event_type: 'WORKSPACE_DELETED',
        payload: {
          workspace_id: id,
          workspace_name: workspace.name,
        },
        workspace_id: id,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Không ghi được event ${WORKSPACE_EVENTS.DELETED}: ${msg}`);
    }

    this.logger.log(`Đã xóa mềm Workspace ID: ${id} (đã phát event cascade)`);
    return true;
  }
}
