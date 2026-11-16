import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ANALYSIS_REPOSITORY_PORT, type AnalysisRepositoryPort } from '../domain/ports/analysis.repository.port';
import { STORAGE_PORT, type StoragePort } from '../../../shared/ports/storage.port';
import { Readable } from 'stream';
import { buildReportPdf } from './pdf-builder.util';

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
      if (!save) {
        throw new Error('REPORT_PREREQUISITE_MISSING: chua co Tong ket cho project nay');
      }
      const summary = (save.summary ?? {}) as Record<string, unknown>;
      const overview = typeof summary.overview === 'string' ? summary.overview : 'Tong ket chat luong du lieu.';
      const issues = Array.isArray(summary.issues) ? (summary.issues as Array<Record<string, unknown>>) : [];
      const recommendations = Array.isArray(summary.recommendations)
        ? (summary.recommendations as unknown[]).map((r) => String(r))
        : [];
      const evidenceRefs = typeof summary.evidence_refs !== 'undefined' ? String(summary.evidence_refs) : '0';
      const aiSection = summary.ai_section as Record<string, unknown> | null | undefined;
      const stale = (save as { isStale?: boolean }).isStale ? 'STALE - du lieu da thay doi sau Tong ket' : 'fresh';

      const top = issues.slice(0, 50).map((it, idx) => {
        const dq = String(it.dq ?? it.rule ?? 'DQ');
        const col = it.column === null || it.column === undefined ? 'toan bang' : String(it.column);
        const count = String(it.count ?? '?');
        const rate = it.rate === null || it.rate === undefined ? '-' : String(it.rate);
        return `${idx + 1}. [${dq}] cot=${col} so_luong=${count} ty_le=${rate}`;
      });

      const pdf = buildReportPdf({
        title: 'Bao cao Tong ket Chat luong Du lieu',
        sections: [
          {
            heading: '1. Tong quan',
            lines: [
              `project: ${job.projectId}`,
              `save: ${job.projectSaveId ?? 'none'} (trang thai: ${stale})`,
              `tong so van de: ${issues.length} (hien thi toi da 50)`,
              `evidence refs: ${evidenceRefs}`,
              `tom tat: ${overview}`.slice(0, 900),
              'He thong chi phat hien va bao cao - khong tu sua du lieu tai nguon.',
            ],
          },
          {
            heading: '2. Top van de DQ (toi da 50)',
            lines: top.length > 0 ? top : ['(khong phat hien van de nao)'],
          },
          {
            heading: '3. Khuyen nghi xu ly tai nguon',
            lines: recommendations.length > 0 ? recommendations.slice(0, 20) : ['(chua co khuyen nghi)'],
          },
          {
            heading: 'Phu luc A - Nguong va quy tac ap dung',
            lines: [
              'DQ-01 thieu du lieu: missingCount > 0 theo tung cot.',
              'DQ-02 trung lap: duplicateRowCount > 0 theo khoa dong.',
              'DQ-03 sai kieu/dinh dang: invalidCount > 0.',
              'DQ-04 ngoai le: IQR hang rao 1.5xIQR; Modified Z-score |z| > 3.5.',
              'Tuong quan Pearson/Spearman; VIF > 5 can kiem tra, VIF > 10 da cong tuyen cao.',
              'IR >= 3 canh bao mat can bang (nguong du an, khong phai chuan chung).',
              'Moi muc anh huong kem ly do + pham vi + quy tac ap dung (Phan 12).',
              `AI section: ${aiSection ? JSON.stringify(aiSection).slice(0, 600) : 'khong co / AI loi khong chan ket qua he thong'}`,
            ],
          },
        ],
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
