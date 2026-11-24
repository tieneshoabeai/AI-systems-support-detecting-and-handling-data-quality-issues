/**
 * WORKSPACES — Adapter cho facade port `WORKSPACE_ACCESS_PORT`.
 *
 * Sau khi tách `WorkspacesService` thành các handler (Command/Query pattern),
 * module khác không còn import được application service. `WorkspaceAccessPort`
 * vẫn là hợp đồng công khai của module `workspaces`; adapter này là cầu nối
 * (driving adapter) giữa port và các handler đã tách.
 */
import { Injectable } from '@nestjs/common';

import {
  WORKSPACE_ACCESS_PORT,
  type WorkspaceAccessPort,
  type WorkspaceAccessRole,
} from '../../domain/ports/workspace.access.port';
import { ResolveUserWorkspaceRoleHandler } from '../../application/queries/resolve-user-workspace-role.handler';
import { IncrementStorageUsedHandler } from '../../application/commands/increment-storage-used.handler';
import { CheckWorkspaceUploadQuotaHandler } from '../../application/queries/check-workspace-upload-quota.handler';

@Injectable()
export class WorkspaceAccessAdapter implements WorkspaceAccessPort {
  constructor(
    private readonly resolveUserWorkspaceRoleHandler: ResolveUserWorkspaceRoleHandler,
    private readonly incrementStorageUsedHandler: IncrementStorageUsedHandler,
    private readonly checkWorkspaceUploadQuotaHandler: CheckWorkspaceUploadQuotaHandler,
  ) {}

  resolveUserWorkspaceRole(workspaceId: string, userId: string): Promise<WorkspaceAccessRole | null> {
    return this.resolveUserWorkspaceRoleHandler.execute(workspaceId, userId);
  }

  incrementStorageUsed(workspaceId: string, deltaBytes: number): Promise<void> {
    return this.incrementStorageUsedHandler.execute(workspaceId, deltaBytes);
  }

  checkWorkspaceUploadQuota(
    workspaceId: string,
    incomingBytes: number,
    quotaBytes: number,
  ): Promise<void> {
    return this.checkWorkspaceUploadQuotaHandler.execute(workspaceId, incomingBytes, quotaBytes);
  }
}

export { WORKSPACE_ACCESS_PORT };
