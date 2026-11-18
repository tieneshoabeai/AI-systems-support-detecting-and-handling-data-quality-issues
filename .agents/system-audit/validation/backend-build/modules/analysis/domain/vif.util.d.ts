export interface IVifRow {
    column: string;
    vif: number | null;
    flag: 'ok' | 'review' | 'high';
    computable: boolean;
    reason: string | null;
}
export interface VifComputation {
    columns: string[];
    rows: IVifRow[];
    commonN: number;
    totalScanned: number;
    commonNRate: number | null;
    lossWarning: string | null;
    excluded: {
        column: string;
        reason: string;
    }[];
    singular: boolean;
}
export declare function computeVif(numericColumns: string[], rows: Record<string, unknown>[]): VifComputation;
