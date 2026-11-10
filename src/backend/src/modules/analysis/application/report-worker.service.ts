import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ANALYSIS_REPOSITORY_PORT, type AnalysisRepositoryPort } from '../domain/ports/analysis.repository.port';
import { STORAGE_PORT, type StoragePort } from '../../../shared/ports/storage.port';
import { Readable } from 'stream';

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
    const enabled = this.config.get<string>('REPORT_WORKER_ENABLED') ?? 'false';
    const on = enabled === 'true' || enabled === '1';
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
      const save = job.projectSaveId
        ? await this.repository.findLatestSaveByProject(job.projectId)
        : null;
      const lines = [
        'Bao cao Tong ket Chat luong Du lieu',
        `project: ${job.projectId}`,
        `save: ${job.projectSaveId ?? 'none'}`,
        `summary: ${JSON.stringify(save?.summary ?? {})}`.slice(0, 4000),
        'Luu y: PDF duoc sinh o worker, khong sinh tai API (I13).',
      ];
      const content = Buffer.from(lines.join('\n'), 'utf-8');
      const key = `reports/${job.projectId}/${reportId}.txt`;
      await this.storage.uploadStream(key, Readable.from(content), 'text/plain; charset=utf-8');
      await this.repository.updateReportById(reportId, {
        status: 'succeeded',
        storageKey: key,
        storage_key: key,
        fileSizeBytes: content.length,
        file_size_bytes: content.length,
        error: null,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      await this.repository.updateReportById(reportId, {
        status: 'failed',
        error: { code: 'REPORT_BUILD_FAILED', message: message.slice(0, 500) },
      });
    }
  }
}
