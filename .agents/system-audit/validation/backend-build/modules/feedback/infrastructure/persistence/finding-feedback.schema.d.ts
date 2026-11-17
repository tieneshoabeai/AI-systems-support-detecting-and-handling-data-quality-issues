import { Schema, Document, Types } from 'mongoose';
import { BaseEntity } from '../../../../shared/database/base-mongo.repository';
export type FeedbackLabel = 'correct' | 'partially_correct' | 'false_positive' | 'missed_issue' | 'other';
export type FeedbackSeverity = 'low' | 'medium' | 'high' | 'critical';
export declare const FeedbackLabels: FeedbackLabel[];
export declare const LabelsRequiringReason: FeedbackLabel[];
export interface IFindingFeedback extends Document, BaseEntity {
    _id: Types.ObjectId;
    analysis_run_id: Types.ObjectId;
    finding_id: string | null;
    project_id: Types.ObjectId;
    workspace_id: Types.ObjectId;
    label: FeedbackLabel;
    reason: string | null;
    suggested_severity: FeedbackSeverity | null;
    ai_confidence: number | null;
    ai_rationale: string | null;
    author_id: Types.ObjectId;
    author_role_at_time: string;
    model_id: string | null;
    prompt_version: string | null;
    deleted_at: Date | null;
    created_at: Date;
    updated_at: Date;
}
export declare const FindingFeedbackSchema: Schema<IFindingFeedback, import("mongoose").Model<IFindingFeedback, any, any, any, any, any, IFindingFeedback & Required<{
    _id: Types.ObjectId;
}> & {
    __v: number;
}>, {}, {}, {}, {}, import("mongoose").DefaultSchemaOptions, IFindingFeedback, Document<unknown, {}, IFindingFeedback, {
    id: string;
}, import("mongoose").DefaultSchemaOptions> & Omit<IFindingFeedback & Required<{
    _id: Types.ObjectId;
}> & {
    __v: number;
}, "id"> & import("mongoose").HydratedDocumentOverrides<{
    id: string;
}>, {
    _id?: import("mongoose").SchemaDefinitionProperty<Types.ObjectId, IFindingFeedback, Document<unknown, {}, IFindingFeedback, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<IFindingFeedback & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & import("mongoose").HydratedDocumentOverrides<{
        id: string;
    }>> | undefined;
    analysis_run_id?: import("mongoose").SchemaDefinitionProperty<Types.ObjectId, IFindingFeedback, Document<unknown, {}, IFindingFeedback, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<IFindingFeedback & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & import("mongoose").HydratedDocumentOverrides<{
        id: string;
    }>> | undefined;
    finding_id?: import("mongoose").SchemaDefinitionProperty<string | null, IFindingFeedback, Document<unknown, {}, IFindingFeedback, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<IFindingFeedback & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & import("mongoose").HydratedDocumentOverrides<{
        id: string;
    }>> | undefined;
    project_id?: import("mongoose").SchemaDefinitionProperty<Types.ObjectId, IFindingFeedback, Document<unknown, {}, IFindingFeedback, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<IFindingFeedback & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & import("mongoose").HydratedDocumentOverrides<{
        id: string;
    }>> | undefined;
    workspace_id?: import("mongoose").SchemaDefinitionProperty<Types.ObjectId, IFindingFeedback, Document<unknown, {}, IFindingFeedback, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<IFindingFeedback & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & import("mongoose").HydratedDocumentOverrides<{
        id: string;
    }>> | undefined;
    label?: import("mongoose").SchemaDefinitionProperty<FeedbackLabel, IFindingFeedback, Document<unknown, {}, IFindingFeedback, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<IFindingFeedback & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & import("mongoose").HydratedDocumentOverrides<{
        id: string;
    }>> | undefined;
    reason?: import("mongoose").SchemaDefinitionProperty<string | null, IFindingFeedback, Document<unknown, {}, IFindingFeedback, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<IFindingFeedback & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & import("mongoose").HydratedDocumentOverrides<{
        id: string;
    }>> | undefined;
    suggested_severity?: import("mongoose").SchemaDefinitionProperty<FeedbackSeverity | null, IFindingFeedback, Document<unknown, {}, IFindingFeedback, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<IFindingFeedback & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & import("mongoose").HydratedDocumentOverrides<{
        id: string;
    }>> | undefined;
    ai_confidence?: import("mongoose").SchemaDefinitionProperty<number | null, IFindingFeedback, Document<unknown, {}, IFindingFeedback, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<IFindingFeedback & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & import("mongoose").HydratedDocumentOverrides<{
        id: string;
    }>> | undefined;
    ai_rationale?: import("mongoose").SchemaDefinitionProperty<string | null, IFindingFeedback, Document<unknown, {}, IFindingFeedback, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<IFindingFeedback & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & import("mongoose").HydratedDocumentOverrides<{
        id: string;
    }>> | undefined;
    author_id?: import("mongoose").SchemaDefinitionProperty<Types.ObjectId, IFindingFeedback, Document<unknown, {}, IFindingFeedback, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<IFindingFeedback & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & import("mongoose").HydratedDocumentOverrides<{
        id: string;
    }>> | undefined;
    author_role_at_time?: import("mongoose").SchemaDefinitionProperty<string, IFindingFeedback, Document<unknown, {}, IFindingFeedback, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<IFindingFeedback & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & import("mongoose").HydratedDocumentOverrides<{
        id: string;
    }>> | undefined;
    model_id?: import("mongoose").SchemaDefinitionProperty<string | null, IFindingFeedback, Document<unknown, {}, IFindingFeedback, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<IFindingFeedback & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & import("mongoose").HydratedDocumentOverrides<{
        id: string;
    }>> | undefined;
    prompt_version?: import("mongoose").SchemaDefinitionProperty<string | null, IFindingFeedback, Document<unknown, {}, IFindingFeedback, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<IFindingFeedback & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & import("mongoose").HydratedDocumentOverrides<{
        id: string;
    }>> | undefined;
    deleted_at?: import("mongoose").SchemaDefinitionProperty<Date | null, IFindingFeedback, Document<unknown, {}, IFindingFeedback, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<IFindingFeedback & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & import("mongoose").HydratedDocumentOverrides<{
        id: string;
    }>> | undefined;
    created_at?: import("mongoose").SchemaDefinitionProperty<Date, IFindingFeedback, Document<unknown, {}, IFindingFeedback, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<IFindingFeedback & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & import("mongoose").HydratedDocumentOverrides<{
        id: string;
    }>> | undefined;
    updated_at?: import("mongoose").SchemaDefinitionProperty<Date, IFindingFeedback, Document<unknown, {}, IFindingFeedback, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<IFindingFeedback & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & import("mongoose").HydratedDocumentOverrides<{
        id: string;
    }>> | undefined;
}, IFindingFeedback>;
