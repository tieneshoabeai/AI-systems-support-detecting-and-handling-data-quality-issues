/**
 * CreateReportHandler — Use case: `createReport()`
 * (thay đổi trạng thái) — theo §3.10 Command/Query pattern.
 *
 * Handler không biết HTTP: trả về kết quả hoặc ném lỗi nghiệp vụ.
 * Dependency chỉ qua port token — không inject adapter cụ thể.
 *
 * **Bước 3 — Rich Domain Model:** dùng `IssueReport.create()` để áp dụng
 * invariant (loại hợp lệ, title ≤ 200, description ≤ 5000) — handler chỉ
 * chuẩn hoá input thô (workspaceId/occurredAt) rồi giao cho domain.
 */
import { Inject, Injectable } from '@nestjs/common';
import {
  ISSUE_REPORT_REPOSITORY_PORT,
  type CreateIssueRecord,
  type IssueReportRepositoryPort,
} from '../../domain/ports/issue-report.repository.port';
import { IssueReport } from '../../domain/entities/issue-report.entity';
import { isObjectIdHex, newObjectIdHex } from '../../../../shared/domain/utils/object-id.util';
import { CreateIssueInput } from '../issues.types';
import { toResponse } from '../issues.utils';
import { ValidationError } from '../../../../shared/domain/errors';

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
        throw new ValidationError('workspaceId không hợp lệ');
      }
      workspaceId = dto.workspaceId;
    }
    let occurredAt: Date | null = null;
    if (dto.occurredAt) {
      const d = new Date(dto.occurredAt);
      if (Number.isNaN(d.getTime())) throw new ValidationError('occurredAt không hợp lệ');
      occurredAt = d;
    }

    // Entity kiểm tra invariant nghiệp vụ.
    const entity = IssueReport.create({
      id: newObjectIdHex(),
      userId,
      workspaceId,
      issueType: dto.issueType,
      title: dto.title,
      description: dto.description,
      context: {
        apiPath: dto.apiPath ?? null,
        errorMessage: dto.errorMessage ?? null,
        occurredAt,
      },
    });

    const input: CreateIssueRecord = {
      userId: entity.userId,
      workspaceId: entity.workspaceId,
      issueType: entity.issueType,
      title: entity.title,
      description: entity.description,
      context: entity.context,
    };
    const doc = await this.repo.create(input);
    return toResponse(doc);
  }
}
