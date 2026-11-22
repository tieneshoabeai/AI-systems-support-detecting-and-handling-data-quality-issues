/**
 * RetryJobHandler — Use case: `retryJob()`
 * (thay đổi trạng thái) — theo §3.10 Command/Query pattern.
 *
 * Handler không biết HTTP: trả về kết quả hoặc ném lỗi nghiệp vụ.
 * Dependency chỉ qua port token — không inject adapter cụ thể.
 */
import { Inject, Injectable } from '@nestjs/common';
import {
  ANALYSIS_REPOSITORY_PORT,
  type AnalysisRepositoryPort,
} from '../../domain/ports/analysis.repository.port';
import { ConfigService } from '@nestjs/config';
import { NotFoundError, ValidationError } from '../../../../shared/domain/errors';

@Injectable()
export class RetryJobHandler {
  constructor(
    @Inject(ANALYSIS_REPOSITORY_PORT)
    private readonly analysisRepository: AnalysisRepositoryPort,
    private readonly configService: ConfigService,
  ) {}

  async execute(jobId: string): Promise<Record<string, unknown>> {
    const job = await this.analysisRepository.findJobById(jobId);
    if (!job) throw new NotFoundError('Không tìm thấy AI job');
    const maxAttempts = (this.configService.get<number>('AI_MAX_RETRIES') ?? 2) + 1;
    if (job.attempt >= maxAttempts) {
      throw new ValidationError(`AI job đã hết lượt thử lại (tối đa ${maxAttempts - 1} lần retry)`,);
    }
    const updated = await this.analysisRepository.updateJobById(jobId, {
      status: 'pending',
      attempt: job.attempt + 1,
      error: null,
      started_at: null,
      finished_at: null,
    });
    return {
      jobId,
      status: updated?.status ?? 'pending',
      attempt: updated?.attempt ?? job.attempt + 1,
    };
  }
}
