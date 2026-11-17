export declare const COLUMN_DATA_TYPES: readonly ['string', 'number', 'boolean', 'date'];
export type ColumnDataType = (typeof COLUMN_DATA_TYPES)[number];
export declare function stableColumnKey(index: number): string;
