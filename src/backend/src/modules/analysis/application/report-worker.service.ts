import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ANALYSIS_REPOSITORY_PORT, type AnalysisRepositoryPort } from '../domain/ports/analysis.repository.port';
import { STORAGE_PORT, type StoragePort } from '../../../shared/application/ports/storage.port';
import { Readable } from 'stream';
import { buildReportPdfAsync } from './pdf-builder.util';
import { buildReportSections } from './report-content.util';
import { resolveTopN } from '../domain/top-n.util';

/** Tối đa số dòng bằng chứng in trong PDF (phân trang tự động). */
const REPORT_EVIDENCE_LIMIT = 500;

@Injectable()
export class ReportWorkerService implements OnModuleInit {
  private readonly logger = new Logger(ReportWorkerService.name);
  private timer: ReturnType<typeof setInterval> | null = null;
  private busy = false;

  constructor(
    @Inject(ANALYSIS_REPOSITORY_PORT)
    private readonly repository: AnalysisRepositoryPort,
    @Inject(STORAGE_PORT)
    private readonly storage: StoragePort,
    private readonly config: ConfigService,
  ) {}

  onModuleInit(): void {
    const mode = ((this.config.get<string>('WORKER_MODE') ?? 'all') as string).toLowerCase();
    if (mode === 'api') { this.logger.log('Report worker tat trong API process (WORKER_MODE=api) - worker rieng dam nhan'); return; }
    const raw = this.config.get<boolean | string>('REPORT_WORKER_ENABLED') ?? false;
    const on = raw === true || String(raw).toLowerCase() === 'true' || String(raw) === '1';
    if (!on) {
      this.logger.log('Report worker tat (REPORT_WORKER_ENABLED != true). PDF sinh khi worker bat.');
      return;
    }
    this.timer = setInterval(() => {
      void this.tick().catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : String(err);
        this.logger.error(`Report worker tick loi: ${msg}`);
      });
    }, 10000);
    const t = this.timer as unknown as { unref?: () => void };
    if (typeof t.unref === 'function' && this.config.get<string>('NODE_ENV') === 'test') t.unref();
  }

  async tick(): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    try {
      const job = await this.repository.claimPendingReport();
      if (!job) return;
      await this.buildPdf(job.id);
    } finally {
      this.busy = false;
    }
  }

  async buildPdf(reportId: string): Promise<void> {
    const job = await this.repository.findReportById(reportId);
    if (!job) return;
    try {
      // Dùng **đúng bản Tổng kết đã yêu cầu** (không lấy bản mới nhất lúc
      // worker chạy) → nội dung PDF nhất quán với yêu cầu của người dùng.
      const save = job.projectSaveId ? await this.repository.findSaveById(job.projectSaveId) : null;
      if (!save || save.projectId !== job.projectId) {
        throw new Error('REPORT_PREREQUISITE_MISSING: khong tim thay ban Tong ket da yeu cau');
      }
      const result = save.analysisRunId
        ? await this.repository.findResultByRun(save.analysisRunId)
        : null;
      const evidences = save.analysisRunId
        ? await this.repository.findEvidencesByRun(save.analysisRunId, REPORT_EVIDENCE_LIMIT)
        : [];
      const summary = (save.summary ?? {}) as Record<string, unknown>;
      const topN = resolveTopN(summary.top_n);
      const pdf = await buildReportPdfAsync({
        title: 'Báo cáo Tổng kết Chất lượng Dữ liệu',
        sections: buildReportSections({
          projectId: job.projectId,
          save,
          result,
          evidences,
          topN,
        }),
      });
      const key = `reports/${job.projectId}/${reportId}.pdf`;
      await this.storage.uploadStream(key, Readable.from(pdf), 'application/pdf');
      await this.repository.updateReportById(reportId, {
        status: 'succeeded',
        storageKey: key,
        storage_key: key,
        fileSizeBytes: pdf.length,
        file_size_bytes: pdf.length,
        error: null,
      });
      this.logger.log(`Report worker sinh PDF xong: ${key} (${pdf.length} bytes)`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      await this.repository.updateReportById(reportId, {
        status: 'failed',
        error: { code: 'REPORT_BUILD_FAILED', message: message.slice(0, 500) },
      });
    }
  }
}
