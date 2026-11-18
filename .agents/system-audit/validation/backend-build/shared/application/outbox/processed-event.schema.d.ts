import { Schema, Document, Types } from 'mongoose';
export interface IProcessedEvent extends Document {
    _id: Types.ObjectId;
    consumer_name: string;
    event_id: string;
    status: 'processing' | 'completed' | 'failed';
    lease_id: string | null;
    lease_expires_at: Date | null;
    attempts: number;
    created_at: Date;
    updated_at: Date;
}
export declare const ProcessedEventSchema: Schema<IProcessedEvent, import("mongoose").Model<IProcessedEvent, any, any, any, any, any, IProcessedEvent & Required<{
    _id: Types.ObjectId;
}> & {
    __v: number;
}>, {}, {}, {}, {}, import("mongoose").DefaultSchemaOptions, IProcessedEvent, Document<unknown, {}, IProcessedEvent, {
    id: string;
}, import("mongoose").DefaultSchemaOptions> & Omit<IProcessedEvent & Required<{
    _id: Types.ObjectId;
}> & {
    __v: number;
}, "id"> & import("mongoose").HydratedDocumentOverrides<{
    id: string;
}>, {
    _id?: import("mongoose").SchemaDefinitionProperty<Types.ObjectId, IProcessedEvent, Document<unknown, {}, IProcessedEvent, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<IProcessedEvent & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & import("mongoose").HydratedDocumentOverrides<{
        id: string;
    }>> | undefined;
    consumer_name?: import("mongoose").SchemaDefinitionProperty<string, IProcessedEvent, Document<unknown, {}, IProcessedEvent, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<IProcessedEvent & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & import("mongoose").HydratedDocumentOverrides<{
        id: string;
    }>> | undefined;
    event_id?: import("mongoose").SchemaDefinitionProperty<string, IProcessedEvent, Document<unknown, {}, IProcessedEvent, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<IProcessedEvent & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & import("mongoose").HydratedDocumentOverrides<{
        id: string;
    }>> | undefined;
    status?: import("mongoose").SchemaDefinitionProperty<"completed" | "failed" | "processing", IProcessedEvent, Document<unknown, {}, IProcessedEvent, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<IProcessedEvent & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & import("mongoose").HydratedDocumentOverrides<{
        id: string;
    }>> | undefined;
    lease_id?: import("mongoose").SchemaDefinitionProperty<string | null, IProcessedEvent, Document<unknown, {}, IProcessedEvent, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<IProcessedEvent & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & import("mongoose").HydratedDocumentOverrides<{
        id: string;
    }>> | undefined;
    lease_expires_at?: import("mongoose").SchemaDefinitionProperty<Date | null, IProcessedEvent, Document<unknown, {}, IProcessedEvent, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<IProcessedEvent & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & import("mongoose").HydratedDocumentOverrides<{
        id: string;
    }>> | undefined;
    attempts?: import("mongoose").SchemaDefinitionProperty<number, IProcessedEvent, Document<unknown, {}, IProcessedEvent, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<IProcessedEvent & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & import("mongoose").HydratedDocumentOverrides<{
        id: string;
    }>> | undefined;
    created_at?: import("mongoose").SchemaDefinitionProperty<Date, IProcessedEvent, Document<unknown, {}, IProcessedEvent, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<IProcessedEvent & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & import("mongoose").HydratedDocumentOverrides<{
        id: string;
    }>> | undefined;
    updated_at?: import("mongoose").SchemaDefinitionProperty<Date, IProcessedEvent, Document<unknown, {}, IProcessedEvent, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<IProcessedEvent & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & import("mongoose").HydratedDocumentOverrides<{
        id: string;
    }>> | undefined;
}, IProcessedEvent>;
