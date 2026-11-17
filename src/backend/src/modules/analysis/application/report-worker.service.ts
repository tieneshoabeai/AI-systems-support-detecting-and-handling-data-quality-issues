import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ANALYSIS_REPOSITORY_PORT, type AnalysisRepositoryPort } from '../domain/ports/analysis.repository.port';
import { STORAGE_PORT, type StoragePort } from '../../../shared/ports/storage.port';
import { Readable } from 'stream';
import * as fs from 'fs';
import { buildReportPdf } from './pdf-builder.util';
import { buildReportSections } from './report-content.util';
import { resolveTopN } from '../domain/top-n.util';

/** Phan 9 v5 muc 3.11: lease job PDF giong ai_job (10 phut), thu lai toi da 2 lan. */
const REPORT_LEASE_MS = 600000;
const REPORT_MAX_ATTEMPTS = 3;
/** Toi da so dong bang chung in trong PDF (phan trang tu dong). */
const REPORT_EVIDENCE_LIMIT = 500;

@Injectable()
export class ReportWorkerService implements OnModuleInit {
  private readonly logger = new Logger(ReportWorkerService.name);
  private timer: ReturnType<typeof setInterval> | null = null;
  private busy = false;
  private fontCache: Buffer | null | undefined;

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
    // env.validation parse thanh boolean; van chap nhan chuoi khi chay ngoai ConfigModule validate
    const enabled = this.config.get<boolean | string>('REPORT_WORKER_ENABLED') ?? false;
    const on = enabled === true || enabled === 'true' || enabled === '1';
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
      const recovered = await this.repository.recoverStaleReports(REPORT_MAX_ATTEMPTS);
      if (recovered.requeued + recovered.failed > 0) {
        this.logger.warn(`Report worker thu hoi job ket: requeued=${recovered.requeued} failed=${recovered.failed}`);
      }
      const job = await this.repository.claimPendingReport(REPORT_LEASE_MS);
      if (!job) return;
      await this.buildPdf(job.id);
    } finally {
      this.busy = false;
    }
  }

  /** Font TrueType Unicode cho PDF tieng Viet co dau (REPORT_FONT_PATH); thieu -> ASCII. */
  private loadFont(): Buffer | null {
    if (this.fontCache !== undefined) return this.fontCache;
    const p = this.config.get<string>('REPORT_FONT_PATH');
    this.fontCache = null;
    if (p) {
      try {
        this.fontCache = fs.readFileSync(p);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        this.logger.warn(`Khong doc duoc REPORT_FONT_PATH (${msg}) — PDF dung font ASCII`);
      }
    }
    return this.fontCache;
  }

  async buildPdf(reportId: string): Promise<void> {
    const job = await this.repository.findReportById(reportId);
    if (!job) return;
    const heartbeat = setInterval(() => {
      void this.repository.heartbeatReport(reportId, REPORT_LEASE_MS).catch(() => undefined);
    }, Math.floor(REPORT_LEASE_MS / 3));
    try {
      // Phan 9 v5 muc 3.11: dung DUNG ban Tong ket da yeu cau (khong lay ban moi nhat luc worker chay)
      const save = job.projectSaveId ? await this.repository.findSaveById(job.projectSaveId) : null;
      if (!save || save.projectId !== job.projectId) {
        throw new Error('REPORT_PREREQUISITE_MISSING: khong tim thay ban Tong ket da yeu cau');
      }
      const result = save.analysisRunId ? await this.repository.findResultByRun(save.analysisRunId) : null;
      const evidences = save.analysisRunId
        ? await this.repository.findEvidencesByRun(save.analysisRunId, REPORT_EVIDENCE_LIMIT)
        : [];
      const summary = (save.summary ?? {}) as Record<string, unknown>;
      const topN = resolveTopN(summary.top_n);
      const pdf = buildReportPdf({
        title: 'Báo cáo Tổng kết Chất lượng Dữ liệu',
        sections: buildReportSections({ projectId: job.projectId, save, result, evidences, topN }),
        font: this.loadFont(),
      });
      const key = `reports/${job.projectId}/${reportId}.pdf`;
      await this.storage.uploadStream(key, Readable.from(pdf), 'application/pdf');
      await this.repository.updateReportById(reportId, {
        status: 'succeeded',
        storageKey: key,
        storage_key: key,
        fileSizeBytes: pdf.length,
        file_size_bytes: pdf.length,
        lease_expires_at: null,
        error: null,
      });
      this.logger.log(`Report worker sinh PDF xong: ${key} (${pdf.length} bytes)`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      await this.repository.updateReportById(reportId, {
        status: 'failed',
        lease_expires_at: null,
        error: { code: 'REPORT_BUILD_FAILED', message: message.slice(0, 500) },
      });
    } finally {
      clearInterval(heartbeat);
    }
  }
}
