/**
 * DeleteWorkspaceHandler — Use case: `deleteWorkspace()`
 * (thay đổi trạng thái) — theo §3.10 Command/Query pattern.
 *
 * Handler không biết HTTP: trả về kết quả hoặc ném lỗi nghiệp vụ.
 * Dependency chỉ qua port token — không inject adapter cụ thể.
 */
import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  WORKSPACE_REPOSITORY_PORT,
  type WorkspaceRepositoryPort,
} from '../../domain/ports/workspace.repository.port';
import { GetWorkspaceByIdHandler } from '../queries/get-workspace-by-id.handler';

@Injectable()
export class DeleteWorkspaceHandler {
  private readonly logger = new Logger(DeleteWorkspaceHandler.name);
  constructor(
    @Inject(WORKSPACE_REPOSITORY_PORT)
    private readonly workspaces: WorkspaceRepositoryPort,
    private readonly getWorkspaceByIdHandler: GetWorkspaceByIdHandler,
  ) {}

  async execute(id: string): Promise<boolean> {
    await this.getWorkspaceByIdHandler.execute(id);
    const deleted = await this.workspaces.softDelete(id);
    this.logger.log(`Đã xóa mềm Workspace ID: ${id}`);
    return deleted;
  }
}
