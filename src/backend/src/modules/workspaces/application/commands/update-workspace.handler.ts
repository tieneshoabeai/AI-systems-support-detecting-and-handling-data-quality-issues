/**
 * UpdateWorkspaceHandler — Use case: `updateWorkspace()`
 * (thay đổi trạng thái) — theo §3.10 Command/Query pattern.
 *
 * Handler không biết HTTP: trả về kết quả hoặc ném lỗi nghiệp vụ.
 * Dependency chỉ qua port token — không inject adapter cụ thể.
 *
 * **Bước 3 — Rich Domain Model:** invariant "tên không được rỗng / quá dài"
 * do entity `Workspace.rename()` bảo vệ.
 */
import { Inject, Injectable } from '@nestjs/common';
import {
  WORKSPACE_REPOSITORY_PORT,
  type WorkspaceRepositoryPort,
} from '../../domain/ports/workspace.repository.port';
import type { Workspace } from '../../domain/entities/workspace.entity';
import { UpdateWorkspaceInput } from '../workspaces.types';
import { GetWorkspaceByIdHandler } from '../queries/get-workspace-by-id.handler';
import { ConflictError, NotFoundError } from '../../../../shared/domain/errors';

@Injectable()
export class UpdateWorkspaceHandler {
  constructor(
    @Inject(WORKSPACE_REPOSITORY_PORT)
    private readonly workspaces: WorkspaceRepositoryPort,
    private readonly getWorkspaceByIdHandler: GetWorkspaceByIdHandler,
  ) {}

  async execute(id: string, dto: UpdateWorkspaceInput): Promise<Workspace> {
    const existing = await this.getWorkspaceByIdHandler.execute(id);
    const { expectedVersion, ...patch } = dto;

    // Entity kiểm tra invariant trước khi ghi → ValidationError nếu tên rỗng/quá dài.
    existing.rename(patch.name, patch.description);

    const updated = await this.workspaces.updateById(id, patch, expectedVersion);
    if (!updated) {
      if (expectedVersion !== undefined && existing.version !== expectedVersion) {
        throw new ConflictError(
          'Bản ghi đã bị thay đổi bởi người khác. Vui lòng tải lại (version lệch)',
          {
            expectedVersion,
            actualVersion: (await this.getWorkspaceByIdHandler.execute(id).catch(() => existing))
              .version,
          },
        );
      }
      throw new NotFoundError('Không tìm thấy không gian làm việc để cập nhật');
    }
    return updated;
  }
}
