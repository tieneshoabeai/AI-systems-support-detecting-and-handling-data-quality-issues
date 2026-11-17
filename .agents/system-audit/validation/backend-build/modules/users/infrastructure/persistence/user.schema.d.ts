import { Schema, Document, Types } from 'mongoose';
export interface IUser extends Document {
    _id: Types.ObjectId;
    email: string;
    password_hash?: string;
    google_id?: string;
    first_name: string;
    last_name: string;
    avatar_url?: string;
    role: 'admin' | 'analyst';
    notifications_enabled: boolean;
    status: 'active' | 'blocked';
    password_reset_token_hash?: string;
    password_reset_expires_at?: Date;
    password_reset_attempts?: number;
    password_reset_sent_count?: number;
    password_reset_sent_window_start?: Date;
    deleted_at: Date | null;
    created_at: Date;
    updated_at: Date;
}
export declare const UserSchema: Schema<IUser, import("mongoose").Model<IUser, any, any, any, any, any, IUser & Required<{
    _id: Types.ObjectId;
}> & {
    __v: number;
}>, {}, {}, {}, {}, import("mongoose").DefaultSchemaOptions, IUser, Document<unknown, {}, IUser, {
    id: string;
}, import("mongoose").DefaultSchemaOptions> & Omit<IUser & Required<{
    _id: Types.ObjectId;
}> & {
    __v: number;
}, "id"> & import("mongoose").HydratedDocumentOverrides<{
    id: string;
}>, {
    _id?: import("mongoose").SchemaDefinitionProperty<Types.ObjectId, IUser, Document<unknown, {}, IUser, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<IUser & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & import("mongoose").HydratedDocumentOverrides<{
        id: string;
    }>> | undefined;
    email?: import("mongoose").SchemaDefinitionProperty<string, IUser, Document<unknown, {}, IUser, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<IUser & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & import("mongoose").HydratedDocumentOverrides<{
        id: string;
    }>> | undefined;
    password_hash?: import("mongoose").SchemaDefinitionProperty<string | undefined, IUser, Document<unknown, {}, IUser, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<IUser & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & import("mongoose").HydratedDocumentOverrides<{
        id: string;
    }>> | undefined;
    google_id?: import("mongoose").SchemaDefinitionProperty<string | undefined, IUser, Document<unknown, {}, IUser, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<IUser & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & import("mongoose").HydratedDocumentOverrides<{
        id: string;
    }>> | undefined;
    first_name?: import("mongoose").SchemaDefinitionProperty<string, IUser, Document<unknown, {}, IUser, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<IUser & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & import("mongoose").HydratedDocumentOverrides<{
        id: string;
    }>> | undefined;
    last_name?: import("mongoose").SchemaDefinitionProperty<string, IUser, Document<unknown, {}, IUser, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<IUser & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & import("mongoose").HydratedDocumentOverrides<{
        id: string;
    }>> | undefined;
    avatar_url?: import("mongoose").SchemaDefinitionProperty<string | undefined, IUser, Document<unknown, {}, IUser, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<IUser & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & import("mongoose").HydratedDocumentOverrides<{
        id: string;
    }>> | undefined;
    role?: import("mongoose").SchemaDefinitionProperty<"admin" | "analyst", IUser, Document<unknown, {}, IUser, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<IUser & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & import("mongoose").HydratedDocumentOverrides<{
        id: string;
    }>> | undefined;
    notifications_enabled?: import("mongoose").SchemaDefinitionProperty<boolean, IUser, Document<unknown, {}, IUser, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<IUser & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & import("mongoose").HydratedDocumentOverrides<{
        id: string;
    }>> | undefined;
    status?: import("mongoose").SchemaDefinitionProperty<"active" | "blocked", IUser, Document<unknown, {}, IUser, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<IUser & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & import("mongoose").HydratedDocumentOverrides<{
        id: string;
    }>> | undefined;
    password_reset_token_hash?: import("mongoose").SchemaDefinitionProperty<string | undefined, IUser, Document<unknown, {}, IUser, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<IUser & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & import("mongoose").HydratedDocumentOverrides<{
        id: string;
    }>> | undefined;
    password_reset_expires_at?: import("mongoose").SchemaDefinitionProperty<Date | undefined, IUser, Document<unknown, {}, IUser, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<IUser & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & import("mongoose").HydratedDocumentOverrides<{
        id: string;
    }>> | undefined;
    password_reset_attempts?: import("mongoose").SchemaDefinitionProperty<number | undefined, IUser, Document<unknown, {}, IUser, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<IUser & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & import("mongoose").HydratedDocumentOverrides<{
        id: string;
    }>> | undefined;
    password_reset_sent_count?: import("mongoose").SchemaDefinitionProperty<number | undefined, IUser, Document<unknown, {}, IUser, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<IUser & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & import("mongoose").HydratedDocumentOverrides<{
        id: string;
    }>> | undefined;
    password_reset_sent_window_start?: import("mongoose").SchemaDefinitionProperty<Date | undefined, IUser, Document<unknown, {}, IUser, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<IUser & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & import("mongoose").HydratedDocumentOverrides<{
        id: string;
    }>> | undefined;
    deleted_at?: import("mongoose").SchemaDefinitionProperty<Date | null, IUser, Document<unknown, {}, IUser, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<IUser & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & import("mongoose").HydratedDocumentOverrides<{
        id: string;
    }>> | undefined;
    created_at?: import("mongoose").SchemaDefinitionProperty<Date, IUser, Document<unknown, {}, IUser, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<IUser & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & import("mongoose").HydratedDocumentOverrides<{
        id: string;
    }>> | undefined;
    updated_at?: import("mongoose").SchemaDefinitionProperty<Date, IUser, Document<unknown, {}, IUser, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<IUser & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & import("mongoose").HydratedDocumentOverrides<{
        id: string;
    }>> | undefined;
}, IUser>;
