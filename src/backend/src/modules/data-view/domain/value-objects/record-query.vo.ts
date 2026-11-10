export const DEFAULT_RECORD_LIMIT = 50;

export const MAX_RECORD_LIMIT = 500;

export function normalizeRecordLimit(limit: number | undefined): number {
  if (!Number.isFinite(limit) || (limit as number) <= 0) return DEFAULT_RECORD_LIMIT;
  return Math.min(Math.floor(limit as number), MAX_RECORD_LIMIT);
}
