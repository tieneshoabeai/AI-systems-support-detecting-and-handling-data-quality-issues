import { Schema, Document, Types } from 'mongoose';
import { BaseEntity } from '../../../../shared/database/base-mongo.repository';
export type CorrelationKind = 'pearson' | 'spearman' | 'cramers_v' | 'eta_squared';
export type VifFlag = 'ok' | 'review' | 'high';
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
export interface IVifRow {
    column: string;
    vif: number | null;
    flag: VifFlag;
    computable: boolean;
    reason: string | null;
}
export interface IAiCorrelationAssessment {
    status: 'pending' | 'succeeded' | 'failed';
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
export interface IAnalysisResult extends Document, BaseEntity {
    _id: Types.ObjectId;
    analysis_run_id: Types.ObjectId;
    project_id: Types.ObjectId;
    dataset_id: Types.ObjectId;
    input_fingerprint: string;
    is_stale: boolean;
    stale_reason: string | null;
    dq05: {
        status: 'unassessed' | 'assessed';
        reason: string | null;
        rules: unknown[];
        violations: unknown[];
    };
    correlationMatrix: {
        method: 'pearson' | 'spearman';
        columns: string[];
        cells: ICorrelationCell[];
        notes: string[];
        excludedColumns: {
            column: string;
            reason: string;
        }[];
        totalScanned: number;
    } | null;
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
    aiCorrelationAssessment: IAiCorrelationAssessment | null;
    dq_summary: {
        totalScanned: number;
        columns: {
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
        }[];
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
    } | null;
    descriptive: unknown | null;
    imbalance: unknown | null;
    timeAnalysis: unknown | null;
    evidenceSummary: {
        total: number;
        byKind: Record<string, number>;
        byColumn: Record<string, number>;
        capped: boolean;
    } | null;
    deleted_at: Date | null;
    created_at: Date;
    updated_at: Date;
}
export declare const AnalysisResultSchema: Schema<IAnalysisResult, import("mongoose").Model<IAnalysisResult, any, any, any, any, any, IAnalysisResult & Required<{
    _id: Types.ObjectId;
}> & {
    __v: number;
}>, {}, {}, {}, {}, import("mongoose").DefaultSchemaOptions, IAnalysisResult, Document<unknown, {}, IAnalysisResult, {
    id: string;
}, import("mongoose").DefaultSchemaOptions> & Omit<IAnalysisResult & Required<{
    _id: Types.ObjectId;
}> & {
    __v: number;
}, "id"> & import("mongoose").HydratedDocumentOverrides<{
    id: string;
}>, {
    _id?: import("mongoose").SchemaDefinitionProperty<Types.ObjectId, IAnalysisResult, Document<unknown, {}, IAnalysisResult, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<IAnalysisResult & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & import("mongoose").HydratedDocumentOverrides<{
        id: string;
    }>> | undefined;
    analysis_run_id?: import("mongoose").SchemaDefinitionProperty<Types.ObjectId, IAnalysisResult, Document<unknown, {}, IAnalysisResult, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<IAnalysisResult & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & import("mongoose").HydratedDocumentOverrides<{
        id: string;
    }>> | undefined;
    project_id?: import("mongoose").SchemaDefinitionProperty<Types.ObjectId, IAnalysisResult, Document<unknown, {}, IAnalysisResult, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<IAnalysisResult & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & import("mongoose").HydratedDocumentOverrides<{
        id: string;
    }>> | undefined;
    dataset_id?: import("mongoose").SchemaDefinitionProperty<Types.ObjectId, IAnalysisResult, Document<unknown, {}, IAnalysisResult, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<IAnalysisResult & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & import("mongoose").HydratedDocumentOverrides<{
        id: string;
    }>> | undefined;
    input_fingerprint?: import("mongoose").SchemaDefinitionProperty<string, IAnalysisResult, Document<unknown, {}, IAnalysisResult, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<IAnalysisResult & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & import("mongoose").HydratedDocumentOverrides<{
        id: string;
    }>> | undefined;
    is_stale?: import("mongoose").SchemaDefinitionProperty<boolean, IAnalysisResult, Document<unknown, {}, IAnalysisResult, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<IAnalysisResult & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & import("mongoose").HydratedDocumentOverrides<{
        id: string;
    }>> | undefined;
    stale_reason?: import("mongoose").SchemaDefinitionProperty<string | null, IAnalysisResult, Document<unknown, {}, IAnalysisResult, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<IAnalysisResult & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & import("mongoose").HydratedDocumentOverrides<{
        id: string;
    }>> | undefined;
    dq05?: import("mongoose").SchemaDefinitionProperty<{
        status: 'unassessed' | 'assessed';
        reason: string | null;
        rules: unknown[];
        violations: unknown[];
    }, IAnalysisResult, Document<unknown, {}, IAnalysisResult, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<IAnalysisResult & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & import("mongoose").HydratedDocumentOverrides<{
        id: string;
    }>> | undefined;
    correlationMatrix?: import("mongoose").SchemaDefinitionProperty<{
        method: 'pearson' | 'spearman';
        columns: string[];
        cells: ICorrelationCell[];
        notes: string[];
        excludedColumns: {
            column: string;
            reason: string;
        }[];
        totalScanned: number;
    } | null, IAnalysisResult, Document<unknown, {}, IAnalysisResult, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<IAnalysisResult & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & import("mongoose").HydratedDocumentOverrides<{
        id: string;
    }>> | undefined;
    vif?: import("mongoose").SchemaDefinitionProperty<{
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
    } | null, IAnalysisResult, Document<unknown, {}, IAnalysisResult, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<IAnalysisResult & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & import("mongoose").HydratedDocumentOverrides<{
        id: string;
    }>> | undefined;
    aiCorrelationAssessment?: import("mongoose").SchemaDefinitionProperty<IAiCorrelationAssessment | null, IAnalysisResult, Document<unknown, {}, IAnalysisResult, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<IAnalysisResult & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & import("mongoose").HydratedDocumentOverrides<{
        id: string;
    }>> | undefined;
    dq_summary?: import("mongoose").SchemaDefinitionProperty<{
        totalScanned: number;
        columns: {
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
        }[];
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
    } | null, IAnalysisResult, Document<unknown, {}, IAnalysisResult, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<IAnalysisResult & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & import("mongoose").HydratedDocumentOverrides<{
        id: string;
    }>> | undefined;
    descriptive?: import("mongoose").SchemaDefinitionProperty<unknown, IAnalysisResult, Document<unknown, {}, IAnalysisResult, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<IAnalysisResult & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & import("mongoose").HydratedDocumentOverrides<{
        id: string;
    }>> | undefined;
    imbalance?: import("mongoose").SchemaDefinitionProperty<unknown, IAnalysisResult, Document<unknown, {}, IAnalysisResult, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<IAnalysisResult & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & import("mongoose").HydratedDocumentOverrides<{
        id: string;
    }>> | undefined;
    timeAnalysis?: import("mongoose").SchemaDefinitionProperty<unknown, IAnalysisResult, Document<unknown, {}, IAnalysisResult, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<IAnalysisResult & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & import("mongoose").HydratedDocumentOverrides<{
        id: string;
    }>> | undefined;
    evidenceSummary?: import("mongoose").SchemaDefinitionProperty<{
        total: number;
        byKind: Record<string, number>;
        byColumn: Record<string, number>;
        capped: boolean;
    } | null, IAnalysisResult, Document<unknown, {}, IAnalysisResult, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<IAnalysisResult & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & import("mongoose").HydratedDocumentOverrides<{
        id: string;
    }>> | undefined;
    deleted_at?: import("mongoose").SchemaDefinitionProperty<Date | null, IAnalysisResult, Document<unknown, {}, IAnalysisResult, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<IAnalysisResult & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & import("mongoose").HydratedDocumentOverrides<{
        id: string;
    }>> | undefined;
    created_at?: import("mongoose").SchemaDefinitionProperty<Date, IAnalysisResult, Document<unknown, {}, IAnalysisResult, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<IAnalysisResult & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & import("mongoose").HydratedDocumentOverrides<{
        id: string;
    }>> | undefined;
    updated_at?: import("mongoose").SchemaDefinitionProperty<Date, IAnalysisResult, Document<unknown, {}, IAnalysisResult, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<IAnalysisResult & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & import("mongoose").HydratedDocumentOverrides<{
        id: string;
    }>> | undefined;
}, IAnalysisResult>;
