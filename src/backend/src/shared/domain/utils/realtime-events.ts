/**
 * REALTIME — Danh mục sự kiện realtime + envelope (Phần 7 v6 §3.17.2, Phần 9 v4).
 *
 * Vì sao nằm ở `shared/utils/`?
 * ---------------------------------
 * Đây là hợp đồng **thuần** (không framework, không framework DI, không I/O):
 * tên sự kiện, shape envelope, tên room, và hàm dựng envelope.
 *
 * Nó phải nằm ở `shared/` vì:
 *   - `shared/events/event-dispatcher.service.ts` (lớp cross-cutting) cần dùng,
 *     mà `shared/` KHÔNG được import từ `modules/` (quy tắc CA5).
 *   - `modules/realtime/domain/...` cần dùng, mà `domain/` chỉ được import
 *     `shared/` ở các thư mục thuần (quy tắc CA11 — `utils|validation|crypto`).
 *
 * → `shared/utils/` là nơi duy nhất thỏa cả hai ràng buộc.
 *
 * Quy tắc nội dung (bắt buộc):
 * - Chỉ đẩy id + trạng thái + số liệu tổng hợp.
 * - TUYỆT ĐỐI không đẩy giá trị ô lỗi, nội dung nhận xét, email.
 */

export const RealtimeRooms = {
  user: (userId: string): string => `user:${userId}`,
  project: (projectId: string): string => `project:${projectId}`,
  analysis: (analysisId: string): string => `analysis:${analysisId}`,
} as const;

export type RealtimeEventName =
  | 'notification.created'
  | 'ai.quality.updated'
  | 'analysis.progress'
  | 'analysis.completed'
  | 'analysis.failed'
  | 'ai.job.status'
  | 'feedback.created';

export interface RealtimeEnvelope {
  event: RealtimeEventName;
  occurredAt: string;
  projectId?: string;
  analysisId?: string;
  status?: string;
  progress?: number;
  stage?: string;
  notificationId?: string;
  notificationType?: string;
  jobId?: string;
  attempt?: number;
  feedbackId?: string;
  label?: string;
}

export type RealtimeFields = Omit<RealtimeEnvelope, 'event' | 'occurredAt'> & { occurredAt?: string };

const SENSITIVE_KEYS = [
  'reason',
  'email',
  'value',
  'cell_value',
  'finding',
  'description',
  'summary_detail',
  'password',
  'token',
] as const;

/** Chặn payload chứa trường nhạy cảm (giá trị ô lỗi, nhận xét, email…). */
export function assertNoSensitiveData(payload: Record<string, unknown>): void {
  for (const key of SENSITIVE_KEYS) {
    if (key in payload) {
      throw new Error(`Payload realtime chứa trường nhạy cảm bị cấm: ${key}`);
    }
  }
}

export function buildEnvelope(
  event: RealtimeEventName,
  fields: Omit<RealtimeEnvelope, 'event' | 'occurredAt'> & { occurredAt?: string },
): RealtimeEnvelope {
  const envelope: RealtimeEnvelope = {
    event,
    occurredAt: fields.occurredAt ?? new Date().toISOString(),
    ...stripUndefined(fields),
  };
  assertNoSensitiveData(envelope as unknown as Record<string, unknown>);
  return envelope;
}

function stripUndefined(fields: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(fields)) {
    if (k === 'occurredAt') continue;
    if (v !== undefined) out[k] = v;
  }
  return out;
}
