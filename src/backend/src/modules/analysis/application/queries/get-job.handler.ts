/**
 * GetJobHandler — Use case: `getJob()`
 * (chỉ đọc) — theo §3.10 Command/Query pattern.
 *
 * Handler không biết HTTP: trả về kết quả hoặc ném lỗi nghiệp vụ.
 * Dependency chỉ qua port token — không inject adapter cụ thể.
 */
import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  ANALYSIS_REPOSITORY_PORT,
  type AnalysisRepositoryPort,
} from '../../domain/ports/analysis.repository.port';

@Injectable()
export class GetJobHandler {
  constructor(
    @Inject(ANALYSIS_REPOSITORY_PORT)
    private readonly analysisRepository: AnalysisRepositoryPort,
  ) {}

  async execute(jobId: string): Promise<Record<string, unknown>> {
    const job = await this.analysisRepository.findJobById(jobId);
    if (!job) throw new NotFoundException('Không tìm thấy AI job');
    return {
      jobId: job.id,
      analysisRunId: (job.analysisRunId as string).toString(),
      status: job.status,
      attempt: job.attempt,
      modelId: job.modelId,
      promptVersion: job.promptVersion,
      error: job.error,
      heartbeatAt: job.heartbeatAt ?? null,
      leaseExpiresAt: job.leaseExpiresAt ?? null,
    };
  }
}
