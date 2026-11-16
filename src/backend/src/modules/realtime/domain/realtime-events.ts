/**
 * REALTIME-01 — Danh mục sự kiện realtime (Phần 7 v6 §3.17.2, Phần 9 v4).
 * Quy tắc: server là nguồn sự thật; chỉ đẩy id + trạng thái + số liệu tổng hợp.
 * TUYỆT ĐỐI không đẩy: giá trị ô lỗi, nội dung nhận xét, email.
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

export function assertNoSensitiveData(payload: Record<string, unknown>): void {
  for (const key of SENSITIVE_KEYS) {
    if (key in payload) {
      throw new Error(`Payload realtime chứa trường nhạy cảm bị cấm: ${key}`);
    }
  }
}

export function buildEnvelope(event: RealtimeEventName, fields: Omit<RealtimeEnvelope, 'event' | 'occurredAt'> & { occurredAt?: string }): RealtimeEnvelope {
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
