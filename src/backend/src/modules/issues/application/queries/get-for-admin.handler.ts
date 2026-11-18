/**
 * GetForAdminHandler — Use case: `getForAdmin()`
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
import { ForbiddenError, NotFoundError } from '../../../../shared/domain/errors';

@Injectable()
export class GetForAdminHandler {
  constructor(
    @Inject(ISSUE_REPORT_REPOSITORY_PORT)
    private readonly repo: IssueReportRepositoryPort,
  ) {}

  async execute(id: string, role: string): Promise<Record<string, unknown>> {
    if (role !== 'admin')
      throw new ForbiddenError('Chỉ quản trị viên được xem báo cáo của người khác');
    const doc = await this.repo.findById(id);
    if (!doc) throw new NotFoundError('Không tìm thấy báo cáo sự cố');
    return toResponse(doc);
  }
}
