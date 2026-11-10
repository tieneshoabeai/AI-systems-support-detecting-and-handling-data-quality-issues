import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ANALYSIS_REPOSITORY_PORT, type AnalysisRepositoryPort } from '../../domain/ports/analysis.repository.port';
import { AnalysisService } from '../analysis.service';
import { AiInferencePort, extractJsonObject } from '../ports/ai-inference.port';

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
    private readonly analysisService: AnalysisService,
    private readonly inference: AiInferencePort,
    private readonly config: ConfigService,
  ) {}

  onModuleInit(): void {
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
      const prompt = await this.analysisService.buildPromptForJob(jobId);
      const out = await this.inference.complete({
        prompt,
        timeoutMs,
        modelId: job.modelId ?? this.config.get<string>('AI_MODEL_ID') ?? null,
      });
      const raw = extractJsonObject(out.text);
      if (raw === null) {
        throw new Error('AI tra ve khong phai JSON object');
      }
      await this.analysisService.ingestAiResult(
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
      if (/JSON/i.test(message)) {
        try {
          await this.analysisService.ingestAiResult(jobId, {} as Record<string, unknown>, job.modelId ?? undefined);
        } catch {
          // bo qua, job da danh dau
        }
      }
      this.logger.warn(`AI job ${jobId} loi (attempt ${attempt}): ${message}`);
    } finally {
      clearInterval(heartbeat);
    }
  }
}
