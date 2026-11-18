/**
 * CheckWorkspaceUploadQuotaHandler — Use case: `checkWorkspaceUploadQuota()`
 * (chỉ đọc) — theo §3.10 Command/Query pattern.
 *
 * Handler không biết HTTP: trả về kết quả hoặc ném lỗi nghiệp vụ.
 * Dependency chỉ qua port token — không inject adapter cụ thể.
 */
import { Injectable } from '@nestjs/common';
import { GetWorkspaceByIdHandler } from '../queries/get-workspace-by-id.handler';
import { RateLimitExceededError } from '../../../../shared/domain/errors';

@Injectable()
export class CheckWorkspaceUploadQuotaHandler {
  constructor(private readonly getWorkspaceByIdHandler: GetWorkspaceByIdHandler) {}

  async execute(workspaceId: string, incomingBytes: number, quotaBytes: number): Promise<void> {
    const ws = await this.getWorkspaceByIdHandler.execute(workspaceId);
    const used = ws.storageUsedBytes ?? 0;
    if (used + incomingBytes > quotaBytes) {
      throw new RateLimitExceededError(
        `Vượt quota workspace: đã dùng ${used}B + thêm ${incomingBytes}B > giới hạn ${quotaBytes}B (§3.8: 500 MB/workspace)`,
        { usedBytes: used, incomingBytes, quotaBytes },
      );
    }
  }
}
