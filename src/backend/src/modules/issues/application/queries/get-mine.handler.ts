/**
 * GetMineHandler — Use case: `getMine()`
 * (chỉ đọc) — theo §3.10 Command/Query pattern.
 *
 * Handler không biết HTTP: trả về kết quả hoặc ném lỗi nghiệp vụ.
 * Dependency chỉ qua port token — không inject adapter cụ thể.
 */
import { Inject, Injectable } from '@nestjs/common';
import {
  ISSUE_REPORT_REPOSITORY_PORT,
  type IssueReportRepositoryPort,
} from '../../domain/ports/issue-report.repository.port';
import { toResponse } from '../issues.utils';
import { NotFoundError } from '../../../../shared/domain/errors';

@Injectable()
export class GetMineHandler {
  constructor(
    @Inject(ISSUE_REPORT_REPOSITORY_PORT)
    private readonly repo: IssueReportRepositoryPort,
  ) {}

  async execute(userId: string, id: string): Promise<Record<string, unknown>> {
    const doc = await this.repo.findByIdForUser(id, userId);
    if (!doc) throw new NotFoundError('Không tìm thấy báo cáo sự cố');
    return toResponse(doc);
  }
}
