/**
 * AnalysisNotifierService — thông báo cho người chạy phân tích (K6).
 *
 * Phần 9 v7 mục 3.14, Phần 7 v16 mục 3.26 NT-1…NT-7:
 *  - `analysis_completed` / `analysis_failed` khi lần phân tích kết thúc;
 *  - `ai_analysis_ready` khi job AI kết thúc (thành công hoặc thất bại — summary nêu rõ).
 *
 * Người nhận: `analysis_run.started_by`. Tạo qua port theo cách module `issues`
 * (`dispatchNotificationViaPorts`): kiểm công tắc, chống trùng theo
 * `source_event_id`, realtime `notification.created`; không gửi email.
 * Mọi lỗi chỉ ghi cảnh báo — thông báo **không bao giờ** làm hỏng luồng phân tích.
 */
import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import {
  NOTIFICATION_REPOSITORY_PORT,
  dispatchNotificationViaPorts,
  type DispatchViaPortsInput,
  type NotificationRepositoryPort,
} from '../../../notifications';
import { USER_REPOSITORY_PORT, type UserRepositoryPort } from '../../../users';
import { REALTIME_PORT, type RealtimePort } from '../../../realtime';
import {
  ANALYSIS_REPOSITORY_PORT,
  type AnalysisRepositoryPort,
} from '../../domain/ports/analysis.repository.port';

/** `targetType` của `payload` cho 3 loại thông báo phân tích (NT-4). */
export const ANALYSIS_NOTIFICATION_TARGET = 'analysis_run';

export interface RunNotice {
  runId: string;
  projectId: string;
  startedBy: string | null | undefined;
  datasetName?: string | null;
}

export interface AiJobNotice {
  jobId: string;
  runId: string;
  attempt: number;
  outcome: 'succeeded' | 'failed';
  /** Mã lỗi khi `outcome = failed` (`AI_GROUNDING_FAILED`, `AI_FAILED`). */
  errorCode?: string | null;
}

@Injectable()
export class AnalysisNotifierService {
  private readonly logger = new Logger(AnalysisNotifierService.name);

  constructor(
    @Inject(NOTIFICATION_REPOSITORY_PORT)
    private readonly notifications: NotificationRepositoryPort,
    @Inject(USER_REPOSITORY_PORT)
    private readonly users: UserRepositoryPort,
    @Inject(ANALYSIS_REPOSITORY_PORT)
    private readonly analysisRepository: AnalysisRepositoryPort,
    @Optional()
    @Inject(REALTIME_PORT)
    private readonly realtime?: RealtimePort,
  ) {}

  /** NT-1 — lần phân tích `succeeded`. */
  async runCompleted(run: RunNotice): Promise<void> {
    await this.send(run.startedBy, {
      type: 'analysis_completed',
      title: 'Phân tích dữ liệu đã xong',
      summary: run.datasetName
        ? `Kết quả phân tích chất lượng dữ liệu cho "${run.datasetName}" đã sẵn sàng.`
        : 'Kết quả phân tích chất lượng dữ liệu đã sẵn sàng.',
      payload: { targetType: ANALYSIS_NOTIFICATION_TARGET, targetId: run.runId, actionUrl: null },
      sourceEventId: `analysis_completed:${run.runId}`,
    });
  }

  /** NT-2 — lần phân tích `failed`. Summary chỉ nêu mã lỗi, không chứa thông điệp lỗi nội bộ. */
  async runFailed(run: RunNotice): Promise<void> {
    await this.send(run.startedBy, {
      type: 'analysis_failed',
      title: 'Phân tích dữ liệu thất bại',
      summary: run.datasetName
        ? `Lần phân tích "${run.datasetName}" không hoàn tất (mã lỗi ANALYSIS_FAILED). Bạn có thể chạy lại.`
        : 'Lần phân tích không hoàn tất (mã lỗi ANALYSIS_FAILED). Bạn có thể chạy lại.',
      payload: { targetType: ANALYSIS_NOTIFICATION_TARGET, targetId: run.runId, actionUrl: null },
      sourceEventId: `analysis_failed:${run.runId}`,
    });
  }

  /** NT-3 — job AI kết thúc (người nhận tra qua `analysis_run_id`). */
  async aiFinished(job: AiJobNotice): Promise<void> {
    try {
      const run = await this.analysisRepository.findById(job.runId);
      const ok = job.outcome === 'succeeded';
      await this.send(run?.startedBy, {
        type: 'ai_analysis_ready',
        title: ok ? 'Nhận xét AI đã sẵn sàng' : 'Phần nhận xét AI thất bại',
        summary: ok
          ? 'AI đã nhận xét xong tương quan giữa các cột.'
          : `Phần AI không hoàn tất (mã lỗi ${job.errorCode ?? 'AI_FAILED'}). Kết quả phân tích hệ thống vẫn dùng được; bạn có thể thử lại phần AI.`,
        payload: { targetType: ANALYSIS_NOTIFICATION_TARGET, targetId: job.runId, actionUrl: null },
        sourceEventId: `ai_analysis_ready:${job.jobId}:${job.attempt}`,
      });
    } catch (err: unknown) {
      this.warn('ai_analysis_ready', err);
    }
  }

  private async send(
    userId: string | null | undefined,
    input: Omit<DispatchViaPortsInput, 'userId'>,
  ): Promise<void> {
    if (!userId) return;
    try {
      await dispatchNotificationViaPorts(this.notifications, this.users, this.realtime, { ...input, userId });
    } catch (err: unknown) {
      this.warn(input.type, err);
    }
  }

  private warn(type: string, err: unknown): void {
    const message = err instanceof Error ? err.message : String(err);
    this.logger.warn(`Bo qua thong bao ${type} (khong chan luong phan tich): ${message}`);
  }
}
