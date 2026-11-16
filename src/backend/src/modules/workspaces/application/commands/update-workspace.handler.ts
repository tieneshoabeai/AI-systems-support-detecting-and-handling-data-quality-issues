/**
 * UpdateWorkspaceHandler — Use case: `updateWorkspace()`
 * (thay đổi trạng thái) — theo §3.10 Command/Query pattern.
 *
 * Handler không biết HTTP: trả về kết quả hoặc ném lỗi nghiệp vụ.
 * Dependency chỉ qua port token — không inject adapter cụ thể.
 */
import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  WORKSPACE_REPOSITORY_PORT,
  type WorkspaceRecord,
  type WorkspaceRepositoryPort,
} from '../../domain/ports/workspace.repository.port';
import { UpdateWorkspaceInput } from '../workspaces.types';
import { GetWorkspaceByIdHandler } from '../queries/get-workspace-by-id.handler';

@Injectable()
export class UpdateWorkspaceHandler {
  constructor(
    @Inject(WORKSPACE_REPOSITORY_PORT)
    private readonly workspaces: WorkspaceRepositoryPort,
    private readonly getWorkspaceByIdHandler: GetWorkspaceByIdHandler,
  ) {}

  async execute(id: string, dto: UpdateWorkspaceInput): Promise<WorkspaceRecord> {
    const existing = await this.getWorkspaceByIdHandler.execute(id);
    const { expectedVersion, ...patch } = dto;
    const updated = await this.workspaces.updateById(id, patch, expectedVersion);
    if (!updated) {
      if (expectedVersion !== undefined && existing.version !== expectedVersion) {
        throw new ConflictException({
          message: 'Bản ghi đã bị thay đổi bởi người khác. Vui lòng tải lại (version lệch)',
          error: 'CONFLICT',
          details: {
            expectedVersion,
            actualVersion: (await this.getWorkspaceByIdHandler.execute(id).catch(() => existing))
              .version,
          },
        } as never);
      }
      throw new NotFoundException('Không tìm thấy không gian làm việc để cập nhật');
    }
    return updated;
  }
}
