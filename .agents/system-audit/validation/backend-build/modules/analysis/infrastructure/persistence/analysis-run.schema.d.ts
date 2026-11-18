import { Schema, Document, Types } from 'mongoose';
import { BaseEntity } from '../../../../shared/database/base-mongo.repository';
export type AnalysisRunStatus = 'pending' | 'running' | 'succeeded' | 'failed';
export interface IAnalysisConfigSnapshot {
    selected_column_keys: string[];
    correlation_method: 'pearson' | 'spearman';
    outlier_method: 'iqr' | 'modified_zscore' | 'both';
    top_n: number;
}
export interface IAnalysisRun extends Document, BaseEntity {
    _id: Types.ObjectId;
    project_id: Types.ObjectId;
    workspace_id: Types.ObjectId;
    dataset_id: Types.ObjectId;
    status: AnalysisRunStatus;
    input_fingerprint: string;
    config: IAnalysisConfigSnapshot;
    started_by: Types.ObjectId | null;
    started_at: Date | null;
    finished_at: Date | null;
    duration_ms: number | null;
    error: {
        code: string;
        message: string;
    } | null;
    deleted_at: Date | null;
    created_at: Date;
    updated_at: Date;
}
export declare const AnalysisRunSchema: Schema<IAnalysisRun, import("mongoose").Model<IAnalysisRun, any, any, any, any, any, IAnalysisRun & Required<{
    _id: Types.ObjectId;
}> & {
    __v: number;
}>, {}, {}, {}, {}, import("mongoose").DefaultSchemaOptions, IAnalysisRun, Document<unknown, {}, IAnalysisRun, {
    id: string;
}, import("mongoose").DefaultSchemaOptions> & Omit<IAnalysisRun & Required<{
    _id: Types.ObjectId;
}> & {
    __v: number;
}, "id"> & import("mongoose").HydratedDocumentOverrides<{
    id: string;
}>, {
    _id?: import("mongoose").SchemaDefinitionProperty<Types.ObjectId, IAnalysisRun, Document<unknown, {}, IAnalysisRun, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<IAnalysisRun & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & import("mongoose").HydratedDocumentOverrides<{
        id: string;
    }>> | undefined;
    project_id?: import("mongoose").SchemaDefinitionProperty<Types.ObjectId, IAnalysisRun, Document<unknown, {}, IAnalysisRun, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<IAnalysisRun & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & import("mongoose").HydratedDocumentOverrides<{
        id: string;
    }>> | undefined;
    workspace_id?: import("mongoose").SchemaDefinitionProperty<Types.ObjectId, IAnalysisRun, Document<unknown, {}, IAnalysisRun, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<IAnalysisRun & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & import("mongoose").HydratedDocumentOverrides<{
        id: string;
    }>> | undefined;
    dataset_id?: import("mongoose").SchemaDefinitionProperty<Types.ObjectId, IAnalysisRun, Document<unknown, {}, IAnalysisRun, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<IAnalysisRun & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & import("mongoose").HydratedDocumentOverrides<{
        id: string;
    }>> | undefined;
    status?: import("mongoose").SchemaDefinitionProperty<AnalysisRunStatus, IAnalysisRun, Document<unknown, {}, IAnalysisRun, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<IAnalysisRun & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & import("mongoose").HydratedDocumentOverrides<{
        id: string;
    }>> | undefined;
    input_fingerprint?: import("mongoose").SchemaDefinitionProperty<string, IAnalysisRun, Document<unknown, {}, IAnalysisRun, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<IAnalysisRun & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & import("mongoose").HydratedDocumentOverrides<{
        id: string;
    }>> | undefined;
    config?: import("mongoose").SchemaDefinitionProperty<IAnalysisConfigSnapshot, IAnalysisRun, Document<unknown, {}, IAnalysisRun, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<IAnalysisRun & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & import("mongoose").HydratedDocumentOverrides<{
        id: string;
    }>> | undefined;
    started_by?: import("mongoose").SchemaDefinitionProperty<Types.ObjectId | null, IAnalysisRun, Document<unknown, {}, IAnalysisRun, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<IAnalysisRun & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & import("mongoose").HydratedDocumentOverrides<{
        id: string;
    }>> | undefined;
    started_at?: import("mongoose").SchemaDefinitionProperty<Date | null, IAnalysisRun, Document<unknown, {}, IAnalysisRun, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<IAnalysisRun & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & import("mongoose").HydratedDocumentOverrides<{
        id: string;
    }>> | undefined;
    finished_at?: import("mongoose").SchemaDefinitionProperty<Date | null, IAnalysisRun, Document<unknown, {}, IAnalysisRun, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<IAnalysisRun & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & import("mongoose").HydratedDocumentOverrides<{
        id: string;
    }>> | undefined;
    duration_ms?: import("mongoose").SchemaDefinitionProperty<number | null, IAnalysisRun, Document<unknown, {}, IAnalysisRun, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<IAnalysisRun & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & import("mongoose").HydratedDocumentOverrides<{
        id: string;
    }>> | undefined;
    error?: import("mongoose").SchemaDefinitionProperty<{
        code: string;
        message: string;
    } | null, IAnalysisRun, Document<unknown, {}, IAnalysisRun, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<IAnalysisRun & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & import("mongoose").HydratedDocumentOverrides<{
        id: string;
    }>> | undefined;
    deleted_at?: import("mongoose").SchemaDefinitionProperty<Date | null, IAnalysisRun, Document<unknown, {}, IAnalysisRun, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<IAnalysisRun & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & import("mongoose").HydratedDocumentOverrides<{
        id: string;
    }>> | undefined;
    created_at?: import("mongoose").SchemaDefinitionProperty<Date, IAnalysisRun, Document<unknown, {}, IAnalysisRun, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<IAnalysisRun & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & import("mongoose").HydratedDocumentOverrides<{
        id: string;
    }>> | undefined;
    updated_at?: import("mongoose").SchemaDefinitionProperty<Date, IAnalysisRun, Document<unknown, {}, IAnalysisRun, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<IAnalysisRun & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & import("mongoose").HydratedDocumentOverrides<{
        id: string;
    }>> | undefined;
}, IAnalysisRun>;
