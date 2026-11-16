/**
 * GetWorkspaceByIdHandler — Use case: `getWorkspaceById()`
 * (thay đổi trạng thái) — theo §3.10 Command/Query pattern.
 *
 * Handler không biết HTTP: trả về kết quả hoặc ném lỗi nghiệp vụ.
 * Dependency chỉ qua port token — không inject adapter cụ thể.
 */
import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  WORKSPACE_REPOSITORY_PORT,
  type WorkspaceRecord,
  type WorkspaceRepositoryPort,
} from '../../domain/ports/workspace.repository.port';
import { isObjectIdHex } from '../../../../shared/utils/object-id.util';

@Injectable()
export class GetWorkspaceByIdHandler {
  constructor(
    @Inject(WORKSPACE_REPOSITORY_PORT)
    private readonly workspaces: WorkspaceRepositoryPort,
  ) {}

  async execute(id: string, touch = false): Promise<WorkspaceRecord> {
    if (!isObjectIdHex(id)) throw new BadRequestException('ID Không gian làm việc không hợp lệ');
    const workspace = await this.workspaces.findById(id);
    if (!workspace)
      throw new NotFoundException('Không tìm thấy không gian làm việc hoặc đã bị xóa');
    if (touch) await this.workspaces.touchLastAccessed(id).catch(() => undefined);
    return workspace;
  }
}
