/**
 * DownloadReportFileHandler — Use case: `downloadReportFile()`
 * (chỉ đọc) — theo §3.10 Command/Query pattern.
 *
 * Handler không biết HTTP: trả về kết quả hoặc ném lỗi nghiệp vụ.
 * Dependency chỉ qua port token — không inject adapter cụ thể.
 */
import { Inject, Injectable } from '@nestjs/common';
import type { Readable } from 'stream';
import {
  ANALYSIS_REPOSITORY_PORT,
  type AnalysisRepositoryPort,
} from '../../domain/ports/analysis.repository.port';
import { STORAGE_PORT, type StoragePort } from '../../../../shared/application/ports/storage.port';
import { NotFoundError } from '../../../../shared/domain/errors';

@Injectable()
export class DownloadReportFileHandler {
  constructor(
    @Inject(ANALYSIS_REPOSITORY_PORT)
    private readonly analysisRepository: AnalysisRepositoryPort,
    @Inject(STORAGE_PORT)
    private readonly storage: StoragePort,
  ) {}

  async execute(
    projectId: string,
    reportId: string,
  ): Promise<{ stream: Readable; fileSizeBytes: number | null }> {
    const job = await this.analysisRepository.findReportById(reportId);
    if (!job || job.projectId !== projectId || !job.storageKey) {
      throw new NotFoundError('Không tìm thấy báo cáo');
    }
    if (job.status !== 'succeeded') {
      throw new NotFoundError('Báo cáo chưa sẵn sàng');
    }
    const stream = await this.storage.downloadStream(job.storageKey);
    return { stream, fileSizeBytes: job.fileSizeBytes ?? null };
  }
}
