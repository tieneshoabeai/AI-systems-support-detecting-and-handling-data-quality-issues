/**
 * RetryJobHandler — Use case: `retryJob()`
 * (thay đổi trạng thái) — theo §3.10 Command/Query pattern.
 *
 * Handler không biết HTTP: trả về kết quả hoặc ném lỗi nghiệp vụ.
 * Dependency chỉ qua port token — không inject adapter cụ thể.
 *
 * OPEN-07 + Conflict #5 — **không giới hạn số lần retry**, và **retry được cả
 * khi job đang chạy**:
 *
 * - Retry **tạo job MỚI** (giữ nguyên `analysis_run_id` / `input_fingerprint`),
 *   job cũ được đánh dấu `skipped` (đã bị thay thế).
 * - Kết quả trễ của job cũ **không ghi đè** kết quả của job mới — xem
 *   `IngestAiResultHandler` (bỏ qua job có trạng thái `skipped`).
 * - Việc chặn "quá nhiều lần retry" do **quota** đảm nhiệm, không phải logic ở
 *   đây.
 */
import { Inject, Injectable } from '@nestjs/common';
import {
  ANALYSIS_REPOSITORY_PORT,
  type AnalysisRepositoryPort,
} from '../../domain/ports/analysis.repository.port';
import { NotFoundError } from '../../../../shared/domain/errors';

@Injectable()
export class RetryJobHandler {
  constructor(
    @Inject(ANALYSIS_REPOSITORY_PORT)
    private readonly analysisRepository: AnalysisRepositoryPort,
  ) {}

  async execute(jobId: string): Promise<Record<string, unknown>> {
    const job = await this.analysisRepository.findJobById(jobId);
    if (!job) throw new NotFoundError('Không tìm thấy AI job');

    // OPEN-07 — **không giới hạn số lần retry** (quota mới là giới hạn).
    // Job mới kế thừa `attempt` của job cũ để vẫn truy vết được lịch sử thử.
    const created = await this.analysisRepository.createJob({
      analysisRunId: job.analysisRunId,
      projectId: job.projectId,
      datasetId: job.datasetId,
      inputFingerprint: job.inputFingerprint,
      status: 'pending',
      attempt: job.attempt + 1,
      modelId: job.modelId,
      promptVersion: job.promptVersion,
      error: null,
      startedAt: null,
      finishedAt: null,
    });

    // Job cũ → `skipped` (đã bị thay thế). Nếu job cũ đang `running`, worker
    // có thể còn đang xử lý → khi nó trả kết quả, `IngestAiResultHandler` sẽ
    // bỏ qua (job `skipped`) nên **không ghi đè** kết quả của job mới.
    await this.analysisRepository
      .updateJobById(jobId, {
        status: 'skipped',
        finished_at: new Date(),
        error: {
          code: 'SUPERSEDED_BY_RETRY',
          message: `Job bị thay thế bởi job mới ${created.id}`,
          retryable: true,
        },
      })
      .catch(() => undefined);

    return {
      /** Job mới — client nên poll job này. */
      jobId: created.id,
      /** Job cũ đã bị thay thế. */
      previousJobId: jobId,
      status: created.status ?? 'pending',
      attempt: created.attempt ?? job.attempt + 1,
    };
  }
}
