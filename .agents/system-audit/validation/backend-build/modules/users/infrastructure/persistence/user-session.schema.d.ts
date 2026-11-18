import { Schema, Document, Types } from 'mongoose';
export interface IUserSession extends Document {
    _id: Types.ObjectId;
    user_id: Types.ObjectId;
    refresh_token_hash: string;
    device_name?: string;
    ip_address?: string;
    user_agent?: string;
    is_revoked: boolean;
    expires_at: Date;
    created_at: Date;
    updated_at: Date;
}
export declare const UserSessionSchema: Schema<IUserSession, import("mongoose").Model<IUserSession, any, any, any, any, any, IUserSession & Required<{
    _id: Types.ObjectId;
}> & {
    __v: number;
}>, {}, {}, {}, {}, import("mongoose").DefaultSchemaOptions, IUserSession, Document<unknown, {}, IUserSession, {
    id: string;
}, import("mongoose").DefaultSchemaOptions> & Omit<IUserSession & Required<{
    _id: Types.ObjectId;
}> & {
    __v: number;
}, "id"> & import("mongoose").HydratedDocumentOverrides<{
    id: string;
}>, {
    _id?: import("mongoose").SchemaDefinitionProperty<Types.ObjectId, IUserSession, Document<unknown, {}, IUserSession, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<IUserSession & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & import("mongoose").HydratedDocumentOverrides<{
        id: string;
    }>> | undefined;
    user_id?: import("mongoose").SchemaDefinitionProperty<Types.ObjectId, IUserSession, Document<unknown, {}, IUserSession, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<IUserSession & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & import("mongoose").HydratedDocumentOverrides<{
        id: string;
    }>> | undefined;
    refresh_token_hash?: import("mongoose").SchemaDefinitionProperty<string, IUserSession, Document<unknown, {}, IUserSession, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<IUserSession & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & import("mongoose").HydratedDocumentOverrides<{
        id: string;
    }>> | undefined;
    device_name?: import("mongoose").SchemaDefinitionProperty<string | undefined, IUserSession, Document<unknown, {}, IUserSession, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<IUserSession & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & import("mongoose").HydratedDocumentOverrides<{
        id: string;
    }>> | undefined;
    ip_address?: import("mongoose").SchemaDefinitionProperty<string | undefined, IUserSession, Document<unknown, {}, IUserSession, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<IUserSession & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & import("mongoose").HydratedDocumentOverrides<{
        id: string;
    }>> | undefined;
    user_agent?: import("mongoose").SchemaDefinitionProperty<string | undefined, IUserSession, Document<unknown, {}, IUserSession, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<IUserSession & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & import("mongoose").HydratedDocumentOverrides<{
        id: string;
    }>> | undefined;
    is_revoked?: import("mongoose").SchemaDefinitionProperty<boolean, IUserSession, Document<unknown, {}, IUserSession, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<IUserSession & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & import("mongoose").HydratedDocumentOverrides<{
        id: string;
    }>> | undefined;
    expires_at?: import("mongoose").SchemaDefinitionProperty<Date, IUserSession, Document<unknown, {}, IUserSession, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<IUserSession & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & import("mongoose").HydratedDocumentOverrides<{
        id: string;
    }>> | undefined;
    created_at?: import("mongoose").SchemaDefinitionProperty<Date, IUserSession, Document<unknown, {}, IUserSession, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<IUserSession & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & import("mongoose").HydratedDocumentOverrides<{
        id: string;
    }>> | undefined;
    updated_at?: import("mongoose").SchemaDefinitionProperty<Date, IUserSession, Document<unknown, {}, IUserSession, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<IUserSession & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & import("mongoose").HydratedDocumentOverrides<{
        id: string;
    }>> | undefined;
}, IUserSession>;
