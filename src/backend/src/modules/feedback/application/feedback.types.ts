/**
 * FEEDBACK — Kiểu dữ liệu tầng application (input/output contract).
 *
 * Tách ra khỏi service gốc khi áp dụng §3.10 Command/Query pattern.
 * Không import HTTP, không import infrastructure.
 */

export interface CreateFeedbackInput {
  label: string;
  reason?: string | null;
  suggestedSeverity?: string | null;
}

export interface UpdateFeedbackInput {
  label?: string;
  reason?: string | null;
  suggestedSeverity?: string | null;
}

export interface ListFeedbackQueryInput {
  limit: number;
  cursor?: string;
  label?: string;
  sortOrder: 'asc' | 'desc';
}
