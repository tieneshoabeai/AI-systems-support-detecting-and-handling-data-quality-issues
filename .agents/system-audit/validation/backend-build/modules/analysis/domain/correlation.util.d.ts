export type CorrelationKind = 'pearson' | 'spearman' | 'cramers_v' | 'eta_squared';
export interface ICorrelationCell {
    colA: string;
    colB: string;
    coef: number | null;
    kind: CorrelationKind;
    n: number;
    totalScanned: number;
    missingAOnly: number;
    missingBOnly: number;
    missingBoth: number;
    computable: boolean;
    reason: string | null;
}
export type ColumnRole = 'numeric' | 'categorical' | 'excluded';
export interface AnalyzableColumn {
    key: string;
    role: ColumnRole;
    reason: string | null;
}
export declare function isMissingValue(val: unknown): boolean;
export declare function toFiniteNumber(val: unknown): number | null;
export declare function toCategory(val: unknown): string | null;
export interface PairMissing {
    n: number;
    totalScanned: number;
    missingAOnly: number;
    missingBOnly: number;
    missingBoth: number;
}
export declare function classifyColumn(dataType: string): ColumnRole;
export interface PairInput {
    colA: string;
    roleA: ColumnRole;
    colB: string;
    roleB: ColumnRole;
    rows: Record<string, unknown>[];
}
export declare function computePairCell(input: PairInput, method: 'pearson' | 'spearman'): ICorrelationCell;
export declare function buildCorrelationMatrix(columns: AnalyzableColumn[], rows: Record<string, unknown>[], method: 'pearson' | 'spearman'): {
    cells: ICorrelationCell[];
    notes: string[];
};
export declare function round4(v: number): number;
