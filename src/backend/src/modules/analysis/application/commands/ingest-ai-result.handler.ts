/**
 * IngestAiResultHandler — Use case: `ingestAiResult()`
 * (thay đổi trạng thái) — theo §3.10 Command/Query pattern.
 *
 * Handler không biết HTTP: trả về kết quả hoặc ném lỗi nghiệp vụ.
 * Dependency chỉ qua port token — không inject adapter cụ thể.
 */
import { Inject, Injectable, Optional } from '@nestjs/common';
import { REALTIME_PORT, type RealtimePort } from '../../../realtime';
import {
  ANALYSIS_REPOSITORY_PORT,
  type AnalysisRepositoryPort,
} from '../../domain/ports/analysis.repository.port';
import { groundAiAssessment, RawAiAssessment } from '../../domain/ai-grounding.util';
import { NotFoundError } from '../../../../shared/domain/errors';
import { AUDIT_LOGGER_PORT, type AuditLoggerPort } from '../../../audit';
import { AnalysisNotifierService } from '../services/analysis-notifier.service';

/** Người gọi qua HTTP (Phần 7 v15 §3.25 VA-2). Worker nội bộ gọi KHÔNG kèm actor → không ghi audit. */
export interface AiJobActor {
  userId: string;
  role: string | null;
}

@Injectable()
export class IngestAiResultHandler {
  constructor(
    @Inject(ANALYSIS_REPOSITORY_PORT)
    private readonly analysisRepository: AnalysisRepositoryPort,
    @Optional()
    @Inject(REALTIME_PORT)
    private readonly realtime: RealtimePort,
    @Optional()
    @Inject(AUDIT_LOGGER_PORT)
    private readonly audit?: AuditLoggerPort,
    /** K6 — `ai_analysis_ready` cho người chạy phân tích (Phần 9 v7 mục 3.14). */
    @Optional()
    private readonly notifier?: AnalysisNotifierService,
  ) {}

  async execute(
    jobId: string,
    raw: unknown,
    modelId?: string,
    actor?: AiJobActor,
  ): Promise<Record<string, unknown>> {
    const job = await this.analysisRepository.findJobById(jobId);
    if (!job) throw new NotFoundError('Không tìm thấy AI job');
    const auditIngest = async (status: string): Promise<void> => {
      if (!actor) return;
      // Phần 6 v9 §3.22 — audit nạp kết quả AI thủ công (actor, jobId, projectId).
      await this.audit?.log({
        actorId: actor.userId,
        actorRole: actor.role,
        action: 'AI_RESULT_INGESTED',
        targetType: 'ai_job',
        targetId: jobId,
        projectId: (job.projectId as string).toString(),
        metadata: { analysisRunId: (job.analysisRunId as string).toString(), status, modelId: modelId ?? null },
      });
    };

    // OPEN-07 / Conflict #5 — job đã bị **thay thế** bởi một lần retry mới ⇒
    // kết quả trễ của job cũ **không được ghi đè** kết quả của job mới.
    if (job.status === 'skipped') {
      await auditIngest('skipped');
      return {
        jobId,
        status: 'skipped',
        skipped: true,
        reason: 'superseded_by_retry',
      };
    }

    const result = await this.analysisRepository.findResultByRun(
      (job.analysisRunId as string).toString(),
    );
    if (!result || !result.correlationMatrix || !result.vif) {
      throw new NotFoundError('Kết quả hệ thống chưa sẵn sàng để gắn nhận xét AI');
    }
    const grounded = groundAiAssessment(
      raw as RawAiAssessment,
      result.correlationMatrix.cells,
      result.vif.rows,
      modelId ?? job.modelId ?? null,
    );
    const status = grounded.status === 'succeeded' ? 'succeeded' : 'failed';
    await this.analysisRepository.updateJobById(jobId, {
      status,
      finished_at: new Date(),
      error: grounded.error
        ? { code: 'AI_GROUNDING_FAILED', message: grounded.error, retryable: true }
        : null,
    });
    const updated = await this.analysisRepository.updateResultById(result.id, {
      aiCorrelationAssessment: grounded,
    });
    try {
      const runId = (job.analysisRunId as string).toString();
      const projectId = (job.projectId as string).toString();
      this.realtime?.emitAnalysisLifecycle(projectId, runId, 'ai.job.status', {
        status,
        jobId,
        attempt: job.attempt,
      });
    } catch {
      // realtime không bao giờ làm hỏng luồng nghiệp vụ chính
    }
    await auditIngest(status);
    // K6 (NT-3): thành công hoặc grounding không đạt đều báo; notifier tự nuốt lỗi.
    await this.notifier?.aiFinished({
      jobId,
      runId: (job.analysisRunId as string).toString(),
      attempt: job.attempt ?? 0,
      outcome: status,
      errorCode: status === 'failed' ? 'AI_GROUNDING_FAILED' : null,
    });
    return {
      jobId,
      status,
      assessment: updated?.aiCorrelationAssessment ?? grounded,
    };
  }
}
