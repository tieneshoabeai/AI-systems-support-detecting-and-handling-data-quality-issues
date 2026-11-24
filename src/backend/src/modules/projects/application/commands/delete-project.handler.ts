/**
 * DeleteProjectHandler — Use case: `deleteProject()`
 * (thay đổi trạng thái) — theo §3.10 Command/Query pattern.
 *
 * Handler không biết HTTP: trả về kết quả hoặc ném lỗi nghiệp vụ.
 * Dependency chỉ qua port token — không inject adapter cụ thể.
 *
 * ── Cascade xóa ────────────────────────────────────────────────────────────
 * Xóa project phải **kéo theo** dataset (và bản ghi + file R2). Module
 * `projects` không được import ngược module `datasets` (CA9) → dùng domain
 * event `PROJECT_DELETED`, module `datasets` tiêu thụ và tự xóa dữ liệu mình.
 *
 * ── OPEN-09 (Conflict #4): nguyên tử ─────────────────────────────────────
 * Ghi event `PROJECT_DELETED` **không còn là best-effort**. Nếu ghi event
 * thất bại ⇒ **rollback** luôn việc xoá mềm project ⇒ không bao giờ rơi vào
 * trạng thái "project đã xoá nhưng dataset mồ côi không được dọn".
 */
import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  PROJECT_REPOSITORY_PORT,
  type ProjectRepositoryPort,
} from '../../domain/ports/project.repository.port';
import { GetProjectByIdHandler } from '../queries/get-project-by-id.handler';
import { OUTBOX_PORT, type OutboxPort } from '../../../../shared/application/ports/outbox.port';
import { TRANSACTION_PORT, type TransactionPort } from '../../../../shared/application/ports/transaction.port';
import { PROJECT_EVENTS } from '../../domain/events/project-events';

@Injectable()
export class DeleteProjectHandler {
  private readonly logger = new Logger(DeleteProjectHandler.name);
  constructor(
    @Inject(PROJECT_REPOSITORY_PORT)
    private readonly projects: ProjectRepositoryPort,
    @Inject(OUTBOX_PORT)
    private readonly outbox: OutboxPort,
    @Inject(TRANSACTION_PORT)
    private readonly tx: TransactionPort,
    private readonly getProjectByIdHandler: GetProjectByIdHandler,
  ) {}

  async execute(id: string): Promise<boolean> {
    const project = await this.getProjectByIdHandler.execute(id);

    // ── Ghi event + xoá mềm trong CÙNG một transaction ──────────────────
    // `withTransaction` của MongoDB tự rollback toàn bộ khi `fn` ném lỗi.
    const deleted = await this.tx.runInTransaction(async () => {
      const ok = await this.projects.softDelete(id);
      if (!ok) {
        this.logger.log(`Project ID: ${id} đã bị xóa trước đó — bỏ qua`);
        return false;
      }

      // Nghiêm (strict): lỗi ghi event ⇒ ném ra ⇒ rollback cả `softDelete`.
      await this.outbox.recordEvent({
        aggregate_type: 'PROJECT',
        aggregate_id: id,
        event_type: PROJECT_EVENTS.DELETED_CASCADE,
        payload: {
          project_id: id,
          project_name: project.name,
          workspace_id: project.workspaceId,
        },
        workspace_id: project.workspaceId,
        project_id: id,
      });

      return true;
    });

    if (deleted) {
      this.logger.log(`Đã xóa mềm Project ID: ${id} (đã phát event cascade)`);
    }
    return deleted;
  }
}
