import { Schema, Document, Types } from 'mongoose';
import { BaseEntity } from '../../../../shared/database/base-mongo.repository';
export type AiJobStatus = 'pending' | 'running' | 'succeeded' | 'failed' | 'skipped';
export interface IAiJob extends Document, BaseEntity {
    _id: Types.ObjectId;
    analysis_run_id: Types.ObjectId;
    project_id: Types.ObjectId;
    dataset_id: Types.ObjectId;
    input_fingerprint: string;
    status: AiJobStatus;
    attempt: number;
    model_id: string | null;
    prompt_version: string | null;
    error: {
        code: string;
        message: string;
        retryable: boolean;
    } | null;
    started_at: Date | null;
    finished_at: Date | null;
    duration_ms: number | null;
    heartbeat_at: Date | null;
    lease_expires_at: Date | null;
    deleted_at: Date | null;
    created_at: Date;
    updated_at: Date;
}
export declare const AiJobSchema: Schema<IAiJob, import("mongoose").Model<IAiJob, any, any, any, any, any, IAiJob & Required<{
    _id: Types.ObjectId;
}> & {
    __v: number;
}>, {}, {}, {}, {}, import("mongoose").DefaultSchemaOptions, IAiJob, Document<unknown, {}, IAiJob, {
    id: string;
}, import("mongoose").DefaultSchemaOptions> & Omit<IAiJob & Required<{
    _id: Types.ObjectId;
}> & {
    __v: number;
}, "id"> & import("mongoose").HydratedDocumentOverrides<{
    id: string;
}>, {
    _id?: import("mongoose").SchemaDefinitionProperty<Types.ObjectId, IAiJob, Document<unknown, {}, IAiJob, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<IAiJob & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & import("mongoose").HydratedDocumentOverrides<{
        id: string;
    }>> | undefined;
    analysis_run_id?: import("mongoose").SchemaDefinitionProperty<Types.ObjectId, IAiJob, Document<unknown, {}, IAiJob, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<IAiJob & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & import("mongoose").HydratedDocumentOverrides<{
        id: string;
    }>> | undefined;
    project_id?: import("mongoose").SchemaDefinitionProperty<Types.ObjectId, IAiJob, Document<unknown, {}, IAiJob, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<IAiJob & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & import("mongoose").HydratedDocumentOverrides<{
        id: string;
    }>> | undefined;
    dataset_id?: import("mongoose").SchemaDefinitionProperty<Types.ObjectId, IAiJob, Document<unknown, {}, IAiJob, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<IAiJob & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & import("mongoose").HydratedDocumentOverrides<{
        id: string;
    }>> | undefined;
    input_fingerprint?: import("mongoose").SchemaDefinitionProperty<string, IAiJob, Document<unknown, {}, IAiJob, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<IAiJob & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & import("mongoose").HydratedDocumentOverrides<{
        id: string;
    }>> | undefined;
    status?: import("mongoose").SchemaDefinitionProperty<AiJobStatus, IAiJob, Document<unknown, {}, IAiJob, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<IAiJob & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & import("mongoose").HydratedDocumentOverrides<{
        id: string;
    }>> | undefined;
    attempt?: import("mongoose").SchemaDefinitionProperty<number, IAiJob, Document<unknown, {}, IAiJob, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<IAiJob & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & import("mongoose").HydratedDocumentOverrides<{
        id: string;
    }>> | undefined;
    model_id?: import("mongoose").SchemaDefinitionProperty<string | null, IAiJob, Document<unknown, {}, IAiJob, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<IAiJob & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & import("mongoose").HydratedDocumentOverrides<{
        id: string;
    }>> | undefined;
    prompt_version?: import("mongoose").SchemaDefinitionProperty<string | null, IAiJob, Document<unknown, {}, IAiJob, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<IAiJob & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & import("mongoose").HydratedDocumentOverrides<{
        id: string;
    }>> | undefined;
    error?: import("mongoose").SchemaDefinitionProperty<{
        code: string;
        message: string;
        retryable: boolean;
    } | null, IAiJob, Document<unknown, {}, IAiJob, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<IAiJob & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & import("mongoose").HydratedDocumentOverrides<{
        id: string;
    }>> | undefined;
    started_at?: import("mongoose").SchemaDefinitionProperty<Date | null, IAiJob, Document<unknown, {}, IAiJob, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<IAiJob & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & import("mongoose").HydratedDocumentOverrides<{
        id: string;
    }>> | undefined;
    finished_at?: import("mongoose").SchemaDefinitionProperty<Date | null, IAiJob, Document<unknown, {}, IAiJob, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<IAiJob & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & import("mongoose").HydratedDocumentOverrides<{
        id: string;
    }>> | undefined;
    duration_ms?: import("mongoose").SchemaDefinitionProperty<number | null, IAiJob, Document<unknown, {}, IAiJob, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<IAiJob & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & import("mongoose").HydratedDocumentOverrides<{
        id: string;
    }>> | undefined;
    heartbeat_at?: import("mongoose").SchemaDefinitionProperty<Date | null, IAiJob, Document<unknown, {}, IAiJob, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<IAiJob & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & import("mongoose").HydratedDocumentOverrides<{
        id: string;
    }>> | undefined;
    lease_expires_at?: import("mongoose").SchemaDefinitionProperty<Date | null, IAiJob, Document<unknown, {}, IAiJob, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<IAiJob & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & import("mongoose").HydratedDocumentOverrides<{
        id: string;
    }>> | undefined;
    deleted_at?: import("mongoose").SchemaDefinitionProperty<Date | null, IAiJob, Document<unknown, {}, IAiJob, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<IAiJob & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & import("mongoose").HydratedDocumentOverrides<{
        id: string;
    }>> | undefined;
    created_at?: import("mongoose").SchemaDefinitionProperty<Date, IAiJob, Document<unknown, {}, IAiJob, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<IAiJob & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & import("mongoose").HydratedDocumentOverrides<{
        id: string;
    }>> | undefined;
    updated_at?: import("mongoose").SchemaDefinitionProperty<Date, IAiJob, Document<unknown, {}, IAiJob, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<IAiJob & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & import("mongoose").HydratedDocumentOverrides<{
        id: string;
    }>> | undefined;
}, IAiJob>;
