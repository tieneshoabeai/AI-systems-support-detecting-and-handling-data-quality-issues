export interface DqColumnFinding {
    column: string;
    missingCount: number;
    missingRate: number | null;
    invalidCount: number;
    invalidRate: number | null;
    outlierCount: number;
    outlierRate: number | null;
    checkedRows: number;
    excludedRows: number;
    method: string;
    reason: string | null;
}
export interface DqSummary {
    totalScanned: number;
    columns: DqColumnFinding[];
    duplicateGroups: {
        key: string;
        rowIndexes: number[];
        count: number;
        hasPartialMissing: boolean;
    }[];
    duplicateRowCount: number;
    fullyMissingRows: number;
    partiallyMissingRows: number;
    notes: string[];
}
export declare function isMissingCell(val: unknown): boolean;
export declare function computeDq0102(columns: string[], rows: {
    rowIndex: number;
    values: Record<string, unknown>;
}[]): Pick<DqSummary, 'columns' | 'duplicateGroups' | 'duplicateRowCount' | 'fullyMissingRows' | 'partiallyMissingRows'>;
export declare function isValidByType(val: unknown, dataType: string): {
    valid: boolean;
    reason: string | null;
};
export declare function computeDq03(colTypes: {
    column: string;
    dataType: string;
}[], rows: {
    rowIndex: number;
    values: Record<string, unknown>;
}[]): {
    column: string;
    validCount: number;
    invalidCount: number;
    invalidRate: number | null;
    reasons: Record<string, number>;
}[];
export interface OutlierResult {
    column: string;
    method: 'iqr' | 'modified_zscore' | 'both';
    iqrOutliers: number[];
    iqrExtremeOutliers: number[];
    zOutliers: number[];
    union: number[];
    intersection: number[];
    usedRows: number;
    excludedRows: number;
    iqrDispersionOk: boolean;
    madDispersionOk: boolean;
    reason: string | null;
}
export declare function detectOutliers(column: string, values: {
    rowIndex: number;
    value: number;
}[], method?: 'iqr' | 'modified_zscore' | 'both'): OutlierResult;
