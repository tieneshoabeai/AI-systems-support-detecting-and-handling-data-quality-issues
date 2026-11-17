import { z } from 'zod';
export interface CorrCell {
    colA: string;
    colB: string;
    coef: number | null;
    kind: string;
    n: number;
    totalScanned: number;
    missingAOnly: number;
    missingBOnly: number;
    missingBoth: number;
    computable: boolean;
    reason: string | null;
}
export interface VifRow {
    column: string;
    vif: number | null;
    flag: 'ok' | 'review' | 'high';
    computable: boolean;
    reason: string | null;
}
export type ICorrelationCell = CorrCell;
export type IVifRow = VifRow;
declare const CorrV1RawSchema: z.ZodObject<{
    notablePairs: z.ZodDefault<z.ZodOptional<z.ZodArray<z.ZodObject<{
        colA: z.ZodString;
        colB: z.ZodString;
        coef: z.ZodNumber;
        kind: z.ZodOptional<z.ZodString>;
        n: z.ZodOptional<z.ZodNumber>;
    }, "strict", z.ZodTypeAny, {
        colA: string;
        colB: string;
        coef: number;
        kind?: string | undefined;
        n?: number | undefined;
    }, {
        colA: string;
        colB: string;
        coef: number;
        kind?: string | undefined;
        n?: number | undefined;
    }>, "many">>>;
    highVif: z.ZodDefault<z.ZodOptional<z.ZodArray<z.ZodString, "many">>>;
    limits: z.ZodDefault<z.ZodOptional<z.ZodArray<z.ZodString, "many">>>;
    nextSteps: z.ZodDefault<z.ZodOptional<z.ZodArray<z.ZodString, "many">>>;
}, "strict", z.ZodTypeAny, {
    notablePairs: {
        colA: string;
        colB: string;
        coef: number;
        kind?: string | undefined;
        n?: number | undefined;
    }[];
    highVif: string[];
    limits: string[];
    nextSteps: string[];
}, {
    notablePairs?: {
        colA: string;
        colB: string;
        coef: number;
        kind?: string | undefined;
        n?: number | undefined;
    }[] | undefined;
    highVif?: string[] | undefined;
    limits?: string[] | undefined;
    nextSteps?: string[] | undefined;
}>;
export type CorrV1Raw = z.infer<typeof CorrV1RawSchema>;
export type CorrV1Strict = CorrV1Raw;
export interface CorrV1Context {
    columns: {
        key: string;
        role: string;
        usedRows: number;
        excludedRows: number;
    }[];
    cells: ICorrelationCell[];
    vif: {
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
    } | null;
    maskedSamples: Record<string, string[]>;
    method: 'pearson' | 'spearman';
    excludedColumns: {
        column: string;
        reason: string;
    }[];
    fewShotBlock?: string;
}
export interface RawAiAssessment {
    notablePairs?: {
        colA: string;
        colB: string;
        coef: number;
        kind?: string;
        n?: number;
    }[];
    highVif?: string[];
    limits?: string[];
    nextSteps?: string[];
}
export interface GroundedAssessment {
    status: 'succeeded' | 'failed';
    notablePairs: {
        colA: string;
        colB: string;
        coef: number;
        kind: string;
        n: number;
    }[];
    highVif: string[];
    limits: string[];
    nextSteps: string[];
    modelId: string | null;
    promptVersion: 'corr-v1';
    error: string | null;
    droppedClaims: string[];
}
export declare function buildCorrV1Prompt(ctx: CorrV1Context): string;
export declare function groundAiAssessment(raw: unknown, cells: ICorrelationCell[], vifRows: IVifRow[], modelId: string | null): GroundedAssessment;
export {};
