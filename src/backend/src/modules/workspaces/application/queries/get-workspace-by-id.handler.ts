/**
 * GetWorkspaceByIdHandler — Use case: `getWorkspaceById()`
 * (chỉ đọc) — theo §3.10 Command/Query pattern.
 *
 * Handler không biết HTTP: trả về kết quả hoặc ném lỗi nghiệp vụ.
 * Dependency chỉ qua port token — không inject adapter cụ thể.
 */
import { Inject, Injectable } from '@nestjs/common';
import {
  WORKSPACE_REPOSITORY_PORT,
  type WorkspaceRepositoryPort,
} from '../../domain/ports/workspace.repository.port';
import type { Workspace } from '../../domain/entities/workspace.entity';
import { isObjectIdHex } from '../../../../shared/domain/utils/object-id.util';
import { NotFoundError, ValidationError } from '../../../../shared/domain/errors';

@Injectable()
export class GetWorkspaceByIdHandler {
  constructor(
    @Inject(WORKSPACE_REPOSITORY_PORT)
    private readonly workspaces: WorkspaceRepositoryPort,
  ) {}

  async execute(id: string, touch = false): Promise<Workspace> {
    if (!isObjectIdHex(id)) throw new ValidationError('ID Không gian làm việc không hợp lệ');
    const workspace = await this.workspaces.findById(id);
    if (!workspace)
      throw new NotFoundError('Không tìm thấy không gian làm việc hoặc đã bị xóa');
    if (touch) await this.workspaces.touchLastAccessed(id).catch(() => undefined);
    return workspace;
  }
}
