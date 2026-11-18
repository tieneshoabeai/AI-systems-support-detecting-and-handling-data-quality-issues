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

@Injectable()
export class IngestAiResultHandler {
  constructor(
    @Inject(ANALYSIS_REPOSITORY_PORT)
    private readonly analysisRepository: AnalysisRepositoryPort,
    @Optional()
    @Inject(REALTIME_PORT)
    private readonly realtime: RealtimePort,
  ) {}

  async execute(jobId: string, raw: unknown, modelId?: string): Promise<Record<string, unknown>> {
    const job = await this.analysisRepository.findJobById(jobId);
    if (!job) throw new NotFoundError('Không tìm thấy AI job');
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
    return {
      jobId,
      status,
      assessment: updated?.aiCorrelationAssessment ?? grounded,
    };
  }
}
