import { Schema, Document, Types } from 'mongoose';
import { BaseEntity } from '../../../../shared/database/base-mongo.repository';
export interface IAnalysisConfig extends Document, BaseEntity {
    _id: Types.ObjectId;
    project_id: Types.ObjectId;
    workspace_id: Types.ObjectId;
    selected_columns: string[] | null;
    label_column: string | null;
    time_column: string | null;
    time_granularity: 'day' | 'week' | 'month' | 'year';
    value_column: string | null;
    correlation_method: 'pearson' | 'spearman';
    outlier_method: 'iqr' | 'modified_zscore' | 'both';
    top_n: number;
    deleted_at: Date | null;
    created_at: Date;
    updated_at: Date;
}
export declare const AnalysisConfigSchema: Schema<IAnalysisConfig, import("mongoose").Model<IAnalysisConfig, any, any, any, any, any, IAnalysisConfig & Required<{
    _id: Types.ObjectId;
}> & {
    __v: number;
}>, {}, {}, {}, {}, import("mongoose").DefaultSchemaOptions, IAnalysisConfig, Document<unknown, {}, IAnalysisConfig, {
    id: string;
}, import("mongoose").DefaultSchemaOptions> & Omit<IAnalysisConfig & Required<{
    _id: Types.ObjectId;
}> & {
    __v: number;
}, "id"> & import("mongoose").HydratedDocumentOverrides<{
    id: string;
}>, {
    _id?: import("mongoose").SchemaDefinitionProperty<Types.ObjectId, IAnalysisConfig, Document<unknown, {}, IAnalysisConfig, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<IAnalysisConfig & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & import("mongoose").HydratedDocumentOverrides<{
        id: string;
    }>> | undefined;
    project_id?: import("mongoose").SchemaDefinitionProperty<Types.ObjectId, IAnalysisConfig, Document<unknown, {}, IAnalysisConfig, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<IAnalysisConfig & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & import("mongoose").HydratedDocumentOverrides<{
        id: string;
    }>> | undefined;
    workspace_id?: import("mongoose").SchemaDefinitionProperty<Types.ObjectId, IAnalysisConfig, Document<unknown, {}, IAnalysisConfig, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<IAnalysisConfig & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & import("mongoose").HydratedDocumentOverrides<{
        id: string;
    }>> | undefined;
    selected_columns?: import("mongoose").SchemaDefinitionProperty<string[] | null, IAnalysisConfig, Document<unknown, {}, IAnalysisConfig, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<IAnalysisConfig & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & import("mongoose").HydratedDocumentOverrides<{
        id: string;
    }>> | undefined;
    label_column?: import("mongoose").SchemaDefinitionProperty<string | null, IAnalysisConfig, Document<unknown, {}, IAnalysisConfig, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<IAnalysisConfig & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & import("mongoose").HydratedDocumentOverrides<{
        id: string;
    }>> | undefined;
    time_column?: import("mongoose").SchemaDefinitionProperty<string | null, IAnalysisConfig, Document<unknown, {}, IAnalysisConfig, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<IAnalysisConfig & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & import("mongoose").HydratedDocumentOverrides<{
        id: string;
    }>> | undefined;
    time_granularity?: import("mongoose").SchemaDefinitionProperty<"day" | "month" | "week" | "year", IAnalysisConfig, Document<unknown, {}, IAnalysisConfig, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<IAnalysisConfig & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & import("mongoose").HydratedDocumentOverrides<{
        id: string;
    }>> | undefined;
    value_column?: import("mongoose").SchemaDefinitionProperty<string | null, IAnalysisConfig, Document<unknown, {}, IAnalysisConfig, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<IAnalysisConfig & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & import("mongoose").HydratedDocumentOverrides<{
        id: string;
    }>> | undefined;
    correlation_method?: import("mongoose").SchemaDefinitionProperty<"pearson" | "spearman", IAnalysisConfig, Document<unknown, {}, IAnalysisConfig, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<IAnalysisConfig & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & import("mongoose").HydratedDocumentOverrides<{
        id: string;
    }>> | undefined;
    outlier_method?: import("mongoose").SchemaDefinitionProperty<"both" | "iqr" | "modified_zscore", IAnalysisConfig, Document<unknown, {}, IAnalysisConfig, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<IAnalysisConfig & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & import("mongoose").HydratedDocumentOverrides<{
        id: string;
    }>> | undefined;
    top_n?: import("mongoose").SchemaDefinitionProperty<number, IAnalysisConfig, Document<unknown, {}, IAnalysisConfig, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<IAnalysisConfig & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & import("mongoose").HydratedDocumentOverrides<{
        id: string;
    }>> | undefined;
    deleted_at?: import("mongoose").SchemaDefinitionProperty<Date | null, IAnalysisConfig, Document<unknown, {}, IAnalysisConfig, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<IAnalysisConfig & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & import("mongoose").HydratedDocumentOverrides<{
        id: string;
    }>> | undefined;
    created_at?: import("mongoose").SchemaDefinitionProperty<Date, IAnalysisConfig, Document<unknown, {}, IAnalysisConfig, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<IAnalysisConfig & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & import("mongoose").HydratedDocumentOverrides<{
        id: string;
    }>> | undefined;
    updated_at?: import("mongoose").SchemaDefinitionProperty<Date, IAnalysisConfig, Document<unknown, {}, IAnalysisConfig, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<IAnalysisConfig & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & import("mongoose").HydratedDocumentOverrides<{
        id: string;
    }>> | undefined;
}, IAnalysisConfig>;
