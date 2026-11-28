/**
 * GetResultHandler — Use case: `getResult()`
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
import { PROJECT_ACCESS_PORT, type ProjectAccessPort } from '../../../projects';
import { isObjectIdHex } from '../../../../shared/domain/utils/object-id.util';
import { NotFoundError, ValidationError } from '../../../../shared/domain/errors';

@Injectable()
export class GetResultHandler {
  constructor(
    @Inject(PROJECT_ACCESS_PORT)
    private readonly projects: ProjectAccessPort,
    @Inject(ANALYSIS_REPOSITORY_PORT)
    private readonly analysisRepository: AnalysisRepositoryPort,
  ) {}

  private async toApiShape(
    resultId: string,
    runId: string,
    fingerprint: string,
    jobId: string | null,
    promptPreview: string | null,
  ): Promise<Record<string, unknown>> {
    const result = await this.analysisRepository.findResultByRun(runId);
    if (!result) throw new NotFoundError('Không tìm thấy kết quả phân tích');
    return {
      analysisId: resultId,
      analysisRunId: runId,
      inputFingerprint: fingerprint,
      jobId: jobId ?? undefined,
      dq05: result.dq05,
      dqSummary: (result as unknown as { dq_summary?: unknown }).dq_summary ?? null,
      descriptive: (result as unknown as { descriptive?: unknown }).descriptive ?? null,
      imbalance: (result as unknown as { imbalance?: unknown }).imbalance ?? null,
      timeAnalysis: (result as unknown as { timeAnalysis?: unknown }).timeAnalysis ?? null,
      evidenceSummary: (result as unknown as { evidenceSummary?: unknown }).evidenceSummary ?? null,
      correlationMatrix: result.correlationMatrix,
      vif: result.vif,
      aiCorrelationAssessment: result.aiCorrelationAssessment,
      pollUrl: jobId ? `/api/v1/analysis/jobs/${jobId}` : undefined,
      corrV1PromptPreview: promptPreview ?? undefined,
    };
  }

  async execute(projectId: string): Promise<Record<string, unknown>> {
    if (!isObjectIdHex(projectId)) {
      throw new ValidationError('ID Dự án không hợp lệ');
    }
    await this.projects.getProjectById(projectId);
    const run = await this.analysisRepository.findLatestRunByProject(projectId);
    if (!run) {
      throw new NotFoundError('Chưa có lần phân tích nào cho project này');
    }
    const result = await this.analysisRepository.findResultByRun(run.id);
    if (!result) {
      throw new NotFoundError('Chưa có kết quả phân tích cho lần chạy mới nhất');
    }
    const latestJob = await this.analysisRepository.findLatestJobByRun(run.id);
    return this.toApiShape(result.id, run.id, result.inputFingerprint, latestJob?.id ?? null, null);
  }
}
