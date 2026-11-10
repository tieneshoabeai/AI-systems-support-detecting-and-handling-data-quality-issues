export const COLUMN_DATA_TYPES = ['string', 'number', 'boolean', 'date'] as const;

export type ColumnDataType = (typeof COLUMN_DATA_TYPES)[number];

export function stableColumnKey(index: number): string {
  return `c${index}`;
}
