/**
 * GetWorkspaceNameHandler — Use case: `getWorkspaceName()`
 * (chỉ đọc) — theo §3.10 Command/Query pattern.
 *
 * Handler không biết HTTP: trả về kết quả hoặc ném lỗi nghiệp vụ.
 * Dependency chỉ qua port token — không inject adapter cụ thể.
 */
import { Inject, Injectable } from '@nestjs/common';
import { WORKSPACE_REPOSITORY_PORT, type WorkspaceRepositoryPort } from '../../../workspaces';

@Injectable()
export class GetWorkspaceNameHandler {
  constructor(
    @Inject(WORKSPACE_REPOSITORY_PORT)
    private readonly workspaces: WorkspaceRepositoryPort,
  ) {}

  async execute(workspaceId: string): Promise<string | null> {
    const ws = await this.workspaces.findById(workspaceId);
    return ws?.name ?? null;
  }
}
