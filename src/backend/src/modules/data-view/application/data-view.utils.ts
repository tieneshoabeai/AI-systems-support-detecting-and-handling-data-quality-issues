/**
 * DATA-VIEW — Hàm thuần dùng chung cho handlers.
 *
 * Tách ra khỏi service gốc khi áp dụng §3.10 Command/Query pattern.
 */

import { CursorCodec } from '../../../shared/domain/pagination/cursor-codec';
import { type DomainError, ValidationError } from '../../../shared/domain/errors';
import type { ColumnStatsResult as DomainColumnStats } from '../../datasets';
import type { ColumnStatsResult } from './data-view.types';

export function validationError(message: string): DomainError {
  return new ValidationError( message);
}

export function isObjectIdHex(id: string): boolean {
  return /^[a-fA-F0-9]{24}$/.test(id);
}

export function decodeRowCursor(cursor: string | undefined): number | undefined {
  if (!cursor) return undefined;
  const decoded = CursorCodec.decode<{ row_index: number }>(cursor);
  if (
    !decoded ||
    typeof decoded.row_index !== 'number' ||
    !Number.isInteger(decoded.row_index) ||
    decoded.row_index < 0
  ) {
    throw validationError('Cursor khong hop le (opaque cursor sai dinh dang)');
  }
  return decoded.row_index;
}

export function toSnakeStats(domain: DomainColumnStats): ColumnStatsResult {
  return {
    column_key: domain.columnKey,
    column_name: domain.columnName,
    total_records: domain.totalRecords,
    null_count: domain.nullCount,
    missing_ratio: domain.missingRatio,
    min: domain.min,
    max: domain.max,
    average: domain.average,
    histogram: (domain.histogram ?? []).map((b) => ({
      bucket_start: b.bucketStart,
      bucket_end: b.bucketEnd,
      count: b.count,
    })),
  };
}

export function resolveColumnKey(
  input: string,
  byKey: Map<string, string>,
  byName: Map<string, string>,
): string {
  const hitKey = byKey.get(input);
  if (hitKey) return hitKey;
  const hitName = byName.get(input);
  if (hitName) return hitName;
  throw validationError(`Cot khong ton tai trong dataset: ${input}`);
}
