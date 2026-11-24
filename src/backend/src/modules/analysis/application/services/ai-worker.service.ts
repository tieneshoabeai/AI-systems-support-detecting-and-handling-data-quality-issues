import { Inject, Injectable, Logger, OnModuleInit, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ANALYSIS_REPOSITORY_PORT, type AnalysisRepositoryPort } from '../../domain/ports/analysis.repository.port';
import { AiInferencePort, extractJsonObject } from '../ports/ai-inference.port';
import { RESOURCE_GUARD_PORT, type ResourceGuardPort } from '../ports/resource-guard.port';
import { BuildPromptForJobHandler } from '../commands/build-prompt-for-job.handler';
import { IngestAiResultHandler } from '../commands/ingest-ai-result.handler';
import { AnalysisNotifierService } from './analysis-notifier.service';

const DEFAULT_MAX_ATTEMPTS = 2;
/** Phan 10 v6: lease timeout 10 phut → job 'running' het han bi 'skipped' */
const LEASE_TIMEOUT_MS = 600000;

/**
 * Worker xu ly job corr-v1: poll pending -> running -> goi engine -> grounding -> succeeded/failed.
 * Concurrency 1 (chay tuan tu trong 1 tick). Tat mac dinh; bat bang AI_WORKER_ENABLED=true.
 * Day la buoc chay trong API process (don gian, dung cho dev/small deploy).
 * Ban Kafka (ai.jobs, consumer rieng) van la dich den theo spec Phan 9/12.
 */
@Injectable()
export class AiWorkerService implements OnModuleInit {
  private readonly logger = new Logger(AiWorkerService.name);
  private timer: ReturnType<typeof setInterval> | null = null;
  private busy = false;

  constructor(
    @Inject(ANALYSIS_REPOSITORY_PORT)
    private readonly repository: AnalysisRepositoryPort,
    private readonly buildPromptForJobHandler: BuildPromptForJobHandler,
    private readonly ingestAiResultHandler: IngestAiResultHandler,
    private readonly inference: AiInferencePort,
    private readonly config: ConfigService,
    @Inject(RESOURCE_GUARD_PORT)
    private readonly resourceGuard: ResourceGuardPort,
    /** K6 — `ai_analysis_ready` khi hết lượt thử (Phần 9 v7 mục 3.14). Thêm cuối, `@Optional`. */
    @Optional()
    private readonly notifier?: AnalysisNotifierService,
  ) {}

  onModuleInit(): void {
    const mode = ((this.config.get<string>('WORKER_MODE') ?? 'all') as string).toLowerCase();
    if (mode === 'api') { this.logger.log('AI worker tat trong API process (WORKER_MODE=api) - worker rieng dam nhan'); return; }
    const enabled = this.config.get<boolean>('AI_WORKER_ENABLED') ?? false;
    if (!enabled) {
      this.logger.log('AI worker tat (AI_WORKER_ENABLED != true). Job corr-v1 cho ingest thu cong.');
      return;
    }
    const interval = this.config.get<number>('AI_WORKER_INTERVAL_MS') ?? 10000;
    this.logger.log(`AI worker bat, poll moi ${interval}ms`);
    this.timer = setInterval(() => {
      void this.tick().catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : String(err);
        this.logger.error(`AI worker tick loi: ${msg}`);
      });
    }, interval);
    const t = this.timer as unknown as { unref?: () => void };
    if (typeof t.unref === 'function' && (this.config.get<string>('NODE_ENV') === 'test')) {
      t.unref();
    }
  }

  async tick(): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    try {
      // Phan 12 v8 §3.15.4: RAM Guard — tam dung nhan job AI moi khi RAM khong du.
      // Job pending van giu nguyen; worker tiep tuc poll lai o tick sau.
      const reason = this.resourceGuard.blockReason();
      if (reason !== null) {
        this.logger.warn(`AI worker tam dung nhan job moi (RAM Guard): ${reason}`);
        return;
      }
      await this.repository.skipStaleJobs(LEASE_TIMEOUT_MS);
      const job = await this.repository.claimPendingJob(LEASE_TIMEOUT_MS);
      if (!job) return;
      await this.processJob(job.id);
    } finally {
      this.busy = false;
    }
  }

  private async processJob(jobId: string): Promise<void> {
    const timeoutMs =
      this.config.get<number>('AI_TIMEOUT_MS') ??
      this.config.get<number>('AI_JOB_TIMEOUT_MS') ??
      180000;
    const job = await this.repository.findJobById(jobId);
    if (!job) return;
    const started = Date.now();
    await this.repository.updateJobById(jobId, {
      status: 'running',
      startedAt: new Date(),
      started_at: new Date(),
      heartbeatAt: new Date(),
      heartbeat_at: new Date(),
      leaseExpiresAt: new Date(Date.now() + LEASE_TIMEOUT_MS),
      lease_expires_at: new Date(Date.now() + LEASE_TIMEOUT_MS),
      error: null,
    });
    const heartbeat = setInterval(() => {
      void this.repository
        .heartbeatJob(jobId, LEASE_TIMEOUT_MS)
        .catch(() => undefined);
    }, Math.floor(LEASE_TIMEOUT_MS / 3));
    try {
      const prompt = await this.buildPromptForJobHandler.execute(jobId);
      const out = await this.inference.complete({
        prompt,
        timeoutMs,
        modelId: job.modelId ?? this.config.get<string>('AI_MODEL_ID') ?? null,
      });
      const raw = extractJsonObject(out.text);
      if (raw === null) {
        throw new Error('AI tra ve khong phai JSON object');
      }
      await this.ingestAiResultHandler.execute(
        jobId,
        raw as Record<string, unknown>,
        out.modelId ?? job.modelId ?? undefined,
      );
      await this.repository.updateJobById(jobId, {
        finishedAt: new Date(),
        finished_at: new Date(),
        durationMs: Date.now() - started,
        duration_ms: Date.now() - started,
        heartbeatAt: new Date(),
        heartbeat_at: new Date(),
        leaseExpiresAt: null,
        lease_expires_at: null,
      });
      this.logger.log(`AI job ${jobId} succeeded in ${Date.now() - started}ms`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      const retryable = /timeout|HTTP 5|ECONN|ENOTFOUND|AI tra ve/i.test(message);
      const attempt = (job.attempt ?? 0) + 1;
      const maxAttempts =
        (this.config.get<number>('AI_MAX_RETRIES') ?? DEFAULT_MAX_ATTEMPTS) + 1;
      const exhausted = attempt >= maxAttempts;
      await this.repository.updateJobById(jobId, {
        status: exhausted ? 'failed' : 'pending',
        attempt,
        finishedAt: exhausted ? new Date() : null,
        finished_at: exhausted ? new Date() : null,
        durationMs: exhausted ? Date.now() - started : null,
        duration_ms: exhausted ? Date.now() - started : null,
        error: { code: exhausted ? 'AI_FAILED' : 'AI_RETRY', message, retryable },
      });
      // Đợt K / K1 (Phần 9 v6 mục 3.13): còn lượt → chỉ trả job về `pending`, KHÔNG ghi
      // đánh giá AI. Trước đây gọi ingest({}) ở đây → ingest ghi job `failed`, đè trạng
      // thái `pending` vừa đặt ⇒ lỗi JSON không bao giờ được thử lại.
      // Hết lượt → ghi đánh giá `failed` thẳng vào kết quả (không qua grounding: đầu vào
      // rỗng không phải kết quả AI), cho mọi loại lỗi (kể cả timeout).
      if (exhausted) {
        try {
          const result = await this.repository.findResultByRun(String(job.analysisRunId));
          if (result) {
            const prev = (result.aiCorrelationAssessment ?? {}) as Record<string, unknown>;
            await this.repository.updateResultById(result.id, {
              aiCorrelationAssessment: { ...prev, status: 'failed', error: `AI_FAILED: ${message}` },
            });
          }
        } catch {
          // bỏ qua — job đã đánh dấu failed
        }
        // K6 (NT-3): chỉ báo khi hết lượt; còn lượt (`pending`) → không báo.
        await this.notifier?.aiFinished({
          jobId,
          runId: String(job.analysisRunId),
          attempt,
          outcome: 'failed',
          errorCode: 'AI_FAILED',
        });
      }
      this.logger.warn(`AI job ${jobId} loi (attempt ${attempt}): ${message}`);
    } finally {
      clearInterval(heartbeat);
    }
  }
}
