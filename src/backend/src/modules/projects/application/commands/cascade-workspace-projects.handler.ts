/**
 * CASCADE — consumer của event `WORKSPACE_DELETED` (module `projects`).
 *
 * Vì sao cần:
 * Khi xóa workspace, các project bên trong **phải** bị xóa theo. Trước đây
 * `DeleteWorkspaceHandler` chỉ soft-delete chính workspace → project mồ côi vẫn
 * còn `deleted_at = null` và vẫn xuất hiện trong `GET /projects`.
 *
 * Vì sao dùng event mà không gọi trực tiếp:
 * Module `workspaces` **không được** import module `projects` (quy tắc CA8 —
 * cross-module import phải qua public contract, và CA9 — đồ thị phụ thuộc
 * module không được có chu trình; `projects` đã import `workspaces` nên chiều
 * ngược sẽ tạo chu trình).
 *
 * → Dùng mô hình sagá: module `workspaces` **phát** event, module `projects`
 * (chủ sở hữu collection `projects`) **tiêu thụ** và tự xóa dữ liệu của mình.
 *
 * Idempotent: chạy lại nhiều lần vẫn cho kết quả đúng (chỉ xóa project còn
 * sống), nên worker retry an toàn.
 */
import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  PROJECT_REPOSITORY_PORT,
  type ProjectRepositoryPort,
} from '../../domain/ports/project.repository.port';
import { WORKSPACE_OUTBOX_EVENTS } from '../../../../shared/domain/utils/outbox-events';

@Injectable()
export class CascadeWorkspaceProjectsHandler {
  private readonly logger = new Logger(CascadeWorkspaceProjectsHandler.name);

  constructor(
    @Inject(PROJECT_REPOSITORY_PORT)
    private readonly projects: ProjectRepositoryPort,
  ) {}

  /**
   * Xóa mềm toàn bộ project thuộc workspace đã bị xóa.
   *
   * @returns Số project bị đánh dấu xóa (0 nếu workspace không có project
   *          hoặc đã xóa hết trước đó).
   */
  async execute(workspaceId: string): Promise<number> {
    if (!/^[0-9a-fA-F]{24}$/.test(workspaceId)) {
      this.logger.warn(`Bo qua cascade: workspaceId khong hop le (${workspaceId})`);
      return 0;
    }
    const deleted = await this.projects.softDeleteByWorkspace(workspaceId);
    if (deleted > 0) {
      this.logger.log(
        `Cascade xoa ${deleted} project thuoc workspace ${workspaceId}`,
      );
    }
    return deleted;
  }

  /** Xử lý trực tiếp từ envelope event. */
  async handleEvent(eventType: string, payload: Record<string, unknown>): Promise<number> {
    if (eventType !== WORKSPACE_OUTBOX_EVENTS.DELETED) return 0;
    const raw = payload['workspace_id'] ?? payload['workspaceId'];
    const workspaceId = typeof raw === 'string' ? raw : '';
    if (!workspaceId) return 0;
    return this.execute(workspaceId);
  }
}
