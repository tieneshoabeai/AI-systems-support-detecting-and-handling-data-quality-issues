/**
 * IncrementStorageUsedHandler — Use case: `incrementStorageUsed()`
 * (thay đổi trạng thái) — theo §3.10 Command/Query pattern.
 *
 * Handler không biết HTTP: trả về kết quả hoặc ném lỗi nghiệp vụ.
 * Dependency chỉ qua port token — không inject adapter cụ thể.
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
    await this.workspaces.addStorageUsed(workspaceId, deltaBytes).catch(() => undefined);
  }
}
