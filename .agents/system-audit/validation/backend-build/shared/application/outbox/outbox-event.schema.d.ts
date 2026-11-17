import { Schema, Document, Types } from 'mongoose';
export type OutboxStatus = 'PENDING' | 'PUBLISHING' | 'PUBLISHED' | 'PROCESSED' | 'FAILED';
export interface IOutboxEvent extends Document {
    _id: Types.ObjectId;
    aggregate_type: string;
    aggregate_id: string;
    event_type: string;
    payload: Record<string, unknown>;
    status: OutboxStatus;
    retry_count: number;
    error_message?: string | null;
    processed_at?: Date | null;
    published_at?: Date | null;
    lease_expires_at?: Date | null;
    workspace_id?: string | null;
    project_id?: string | null;
    actor_id?: string | null;
    created_at: Date;
    updated_at: Date;
}
export declare const OutboxEventSchema: Schema<IOutboxEvent, import("mongoose").Model<IOutboxEvent, any, any, any, any, any, IOutboxEvent & Required<{
    _id: Types.ObjectId;
}> & {
    __v: number;
}>, {}, {}, {}, {}, import("mongoose").DefaultSchemaOptions, IOutboxEvent, Document<unknown, {}, IOutboxEvent, {
    id: string;
}, import("mongoose").DefaultSchemaOptions> & Omit<IOutboxEvent & Required<{
    _id: Types.ObjectId;
}> & {
    __v: number;
}, "id"> & import("mongoose").HydratedDocumentOverrides<{
    id: string;
}>, {
    _id?: import("mongoose").SchemaDefinitionProperty<Types.ObjectId, IOutboxEvent, Document<unknown, {}, IOutboxEvent, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<IOutboxEvent & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & import("mongoose").HydratedDocumentOverrides<{
        id: string;
    }>> | undefined;
    aggregate_type?: import("mongoose").SchemaDefinitionProperty<string, IOutboxEvent, Document<unknown, {}, IOutboxEvent, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<IOutboxEvent & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & import("mongoose").HydratedDocumentOverrides<{
        id: string;
    }>> | undefined;
    aggregate_id?: import("mongoose").SchemaDefinitionProperty<string, IOutboxEvent, Document<unknown, {}, IOutboxEvent, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<IOutboxEvent & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & import("mongoose").HydratedDocumentOverrides<{
        id: string;
    }>> | undefined;
    event_type?: import("mongoose").SchemaDefinitionProperty<string, IOutboxEvent, Document<unknown, {}, IOutboxEvent, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<IOutboxEvent & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & import("mongoose").HydratedDocumentOverrides<{
        id: string;
    }>> | undefined;
    payload?: import("mongoose").SchemaDefinitionProperty<Record<string, unknown>, IOutboxEvent, Document<unknown, {}, IOutboxEvent, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<IOutboxEvent & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & import("mongoose").HydratedDocumentOverrides<{
        id: string;
    }>> | undefined;
    status?: import("mongoose").SchemaDefinitionProperty<OutboxStatus, IOutboxEvent, Document<unknown, {}, IOutboxEvent, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<IOutboxEvent & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & import("mongoose").HydratedDocumentOverrides<{
        id: string;
    }>> | undefined;
    retry_count?: import("mongoose").SchemaDefinitionProperty<number, IOutboxEvent, Document<unknown, {}, IOutboxEvent, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<IOutboxEvent & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & import("mongoose").HydratedDocumentOverrides<{
        id: string;
    }>> | undefined;
    error_message?: import("mongoose").SchemaDefinitionProperty<string | null | undefined, IOutboxEvent, Document<unknown, {}, IOutboxEvent, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<IOutboxEvent & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & import("mongoose").HydratedDocumentOverrides<{
        id: string;
    }>> | undefined;
    processed_at?: import("mongoose").SchemaDefinitionProperty<Date | null | undefined, IOutboxEvent, Document<unknown, {}, IOutboxEvent, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<IOutboxEvent & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & import("mongoose").HydratedDocumentOverrides<{
        id: string;
    }>> | undefined;
    published_at?: import("mongoose").SchemaDefinitionProperty<Date | null | undefined, IOutboxEvent, Document<unknown, {}, IOutboxEvent, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<IOutboxEvent & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & import("mongoose").HydratedDocumentOverrides<{
        id: string;
    }>> | undefined;
    lease_expires_at?: import("mongoose").SchemaDefinitionProperty<Date | null | undefined, IOutboxEvent, Document<unknown, {}, IOutboxEvent, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<IOutboxEvent & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & import("mongoose").HydratedDocumentOverrides<{
        id: string;
    }>> | undefined;
    workspace_id?: import("mongoose").SchemaDefinitionProperty<string | null | undefined, IOutboxEvent, Document<unknown, {}, IOutboxEvent, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<IOutboxEvent & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & import("mongoose").HydratedDocumentOverrides<{
        id: string;
    }>> | undefined;
    project_id?: import("mongoose").SchemaDefinitionProperty<string | null | undefined, IOutboxEvent, Document<unknown, {}, IOutboxEvent, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<IOutboxEvent & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & import("mongoose").HydratedDocumentOverrides<{
        id: string;
    }>> | undefined;
    actor_id?: import("mongoose").SchemaDefinitionProperty<string | null | undefined, IOutboxEvent, Document<unknown, {}, IOutboxEvent, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<IOutboxEvent & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & import("mongoose").HydratedDocumentOverrides<{
        id: string;
    }>> | undefined;
    created_at?: import("mongoose").SchemaDefinitionProperty<Date, IOutboxEvent, Document<unknown, {}, IOutboxEvent, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<IOutboxEvent & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & import("mongoose").HydratedDocumentOverrides<{
        id: string;
    }>> | undefined;
    updated_at?: import("mongoose").SchemaDefinitionProperty<Date, IOutboxEvent, Document<unknown, {}, IOutboxEvent, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<IOutboxEvent & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & import("mongoose").HydratedDocumentOverrides<{
        id: string;
    }>> | undefined;
}, IOutboxEvent>;
