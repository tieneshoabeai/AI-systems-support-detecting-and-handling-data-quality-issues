/**
 * CreateReportHandler — Use case: `createReport()`
 * (thay đổi trạng thái) — theo §3.10 Command/Query pattern.
 *
 * Handler không biết HTTP: trả về kết quả hoặc ném lỗi nghiệp vụ.
 * Dependency chỉ qua port token — không inject adapter cụ thể.
 */
import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import {
  ISSUE_REPORT_REPOSITORY_PORT,
  type CreateIssueRecord,
  type IssueReportRepositoryPort,
} from '../../domain/ports/issue-report.repository.port';
import { isObjectIdHex } from '../../../../shared/utils/object-id.util';
import { CreateIssueInput } from '../issues.types';
import { toResponse } from '../issues.utils';

@Injectable()
export class CreateReportHandler {
  constructor(
    @Inject(ISSUE_REPORT_REPOSITORY_PORT)
    private readonly repo: IssueReportRepositoryPort,
  ) {}

  async execute(userId: string, dto: CreateIssueInput): Promise<Record<string, unknown>> {
    let workspaceId: string | null = null;
    if (dto.workspaceId) {
      if (!isObjectIdHex(dto.workspaceId)) {
        throw new BadRequestException('workspaceId không hợp lệ');
      }
      workspaceId = dto.workspaceId;
    }
    let occurredAt: Date | null = null;
    if (dto.occurredAt) {
      const d = new Date(dto.occurredAt);
      if (Number.isNaN(d.getTime())) throw new BadRequestException('occurredAt không hợp lệ');
      occurredAt = d;
    }
    const input: CreateIssueRecord = {
      userId,
      workspaceId: workspaceId ?? null,
      issueType: dto.issueType,
      title: dto.title.trim(),
      description: dto.description.trim(),
      context: {
        apiPath: dto.apiPath ?? null,
        errorMessage: dto.errorMessage ?? null,
        occurredAt,
      },
    };
    const doc = await this.repo.create(input);
    return toResponse(doc);
  }
}
