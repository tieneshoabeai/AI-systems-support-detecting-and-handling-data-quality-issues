/**
 * GetReportFileMetaHandler — Use case: `getReportFileMeta()`
 * (chỉ đọc) — theo §3.10 Command/Query pattern.
 *
 * Handler không biết HTTP: trả về kết quả hoặc ném lỗi nghiệp vụ.
 * Dependency chỉ qua port token — không inject adapter cụ thể.
 */
import { Inject, Injectable } from '@nestjs/common';
import {
  ANALYSIS_REPOSITORY_PORT,
  type AnalysisRepositoryPort,
} from '../../domain/ports/analysis.repository.port';
import { NotFoundError } from '../../../../shared/domain/errors';

@Injectable()
export class GetReportFileMetaHandler {
  constructor(
    @Inject(ANALYSIS_REPOSITORY_PORT)
    private readonly analysisRepository: AnalysisRepositoryPort,
  ) {}

  async execute(projectId: string, reportId: string): Promise<Record<string, unknown>> {
    const job = await this.analysisRepository.findReportById(reportId);
    if (!job || job.projectId !== projectId) throw new NotFoundError('Không tìm thấy báo cáo');
    if (job.status !== 'succeeded' || !job.storageKey) {
      return { reportId, status: job.status, error: job.error ?? null };
    }
    return {
      reportId,
      status: job.status,
      fileSizeBytes: job.fileSizeBytes,
      downloadUrl: `/api/v1/projects/${projectId}/report/${reportId}/file`,
    };
  }
}
