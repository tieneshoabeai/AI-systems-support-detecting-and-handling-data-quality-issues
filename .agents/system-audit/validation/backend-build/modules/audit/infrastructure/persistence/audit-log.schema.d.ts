import { Schema, Document, Types } from 'mongoose';
export interface IAuditLog extends Document {
    _id: Types.ObjectId;
    actor_id: Types.ObjectId | null;
    actor_role: string | null;
    action: string;
    target_type: string;
    target_id: string | null;
    target_label: string | null;
    workspace_id: Types.ObjectId | null;
    project_id: Types.ObjectId | null;
    ip_address: string | null;
    user_agent: string | null;
    metadata: Record<string, unknown>;
    created_at: Date;
    expires_at: Date;
}
export declare const AuditLogSchema: Schema<IAuditLog, import("mongoose").Model<IAuditLog, any, any, any, any, any, IAuditLog & Required<{
    _id: Types.ObjectId;
}> & {
    __v: number;
}>, {}, {}, {}, {}, import("mongoose").DefaultSchemaOptions, IAuditLog, Document<unknown, {}, IAuditLog, {
    id: string;
}, import("mongoose").DefaultSchemaOptions> & Omit<IAuditLog & Required<{
    _id: Types.ObjectId;
}> & {
    __v: number;
}, "id"> & import("mongoose").HydratedDocumentOverrides<{
    id: string;
}>, {
    _id?: import("mongoose").SchemaDefinitionProperty<Types.ObjectId, IAuditLog, Document<unknown, {}, IAuditLog, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<IAuditLog & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & import("mongoose").HydratedDocumentOverrides<{
        id: string;
    }>> | undefined;
    actor_id?: import("mongoose").SchemaDefinitionProperty<Types.ObjectId | null, IAuditLog, Document<unknown, {}, IAuditLog, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<IAuditLog & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & import("mongoose").HydratedDocumentOverrides<{
        id: string;
    }>> | undefined;
    actor_role?: import("mongoose").SchemaDefinitionProperty<string | null, IAuditLog, Document<unknown, {}, IAuditLog, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<IAuditLog & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & import("mongoose").HydratedDocumentOverrides<{
        id: string;
    }>> | undefined;
    action?: import("mongoose").SchemaDefinitionProperty<string, IAuditLog, Document<unknown, {}, IAuditLog, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<IAuditLog & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & import("mongoose").HydratedDocumentOverrides<{
        id: string;
    }>> | undefined;
    target_type?: import("mongoose").SchemaDefinitionProperty<string, IAuditLog, Document<unknown, {}, IAuditLog, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<IAuditLog & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & import("mongoose").HydratedDocumentOverrides<{
        id: string;
    }>> | undefined;
    target_id?: import("mongoose").SchemaDefinitionProperty<string | null, IAuditLog, Document<unknown, {}, IAuditLog, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<IAuditLog & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & import("mongoose").HydratedDocumentOverrides<{
        id: string;
    }>> | undefined;
    target_label?: import("mongoose").SchemaDefinitionProperty<string | null, IAuditLog, Document<unknown, {}, IAuditLog, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<IAuditLog & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & import("mongoose").HydratedDocumentOverrides<{
        id: string;
    }>> | undefined;
    workspace_id?: import("mongoose").SchemaDefinitionProperty<Types.ObjectId | null, IAuditLog, Document<unknown, {}, IAuditLog, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<IAuditLog & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & import("mongoose").HydratedDocumentOverrides<{
        id: string;
    }>> | undefined;
    project_id?: import("mongoose").SchemaDefinitionProperty<Types.ObjectId | null, IAuditLog, Document<unknown, {}, IAuditLog, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<IAuditLog & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & import("mongoose").HydratedDocumentOverrides<{
        id: string;
    }>> | undefined;
    ip_address?: import("mongoose").SchemaDefinitionProperty<string | null, IAuditLog, Document<unknown, {}, IAuditLog, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<IAuditLog & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & import("mongoose").HydratedDocumentOverrides<{
        id: string;
    }>> | undefined;
    user_agent?: import("mongoose").SchemaDefinitionProperty<string | null, IAuditLog, Document<unknown, {}, IAuditLog, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<IAuditLog & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & import("mongoose").HydratedDocumentOverrides<{
        id: string;
    }>> | undefined;
    metadata?: import("mongoose").SchemaDefinitionProperty<Record<string, unknown>, IAuditLog, Document<unknown, {}, IAuditLog, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<IAuditLog & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & import("mongoose").HydratedDocumentOverrides<{
        id: string;
    }>> | undefined;
    created_at?: import("mongoose").SchemaDefinitionProperty<Date, IAuditLog, Document<unknown, {}, IAuditLog, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<IAuditLog & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & import("mongoose").HydratedDocumentOverrides<{
        id: string;
    }>> | undefined;
    expires_at?: import("mongoose").SchemaDefinitionProperty<Date, IAuditLog, Document<unknown, {}, IAuditLog, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<IAuditLog & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & import("mongoose").HydratedDocumentOverrides<{
        id: string;
    }>> | undefined;
}, IAuditLog>;
export interface IAuditChange extends Document {
    _id: Types.ObjectId;
    audit_log_id: Types.ObjectId;
    field: string;
    before_value: unknown;
    after_value: unknown;
    created_at: Date;
    expires_at: Date;
}
export declare const AuditChangeSchema: Schema<IAuditChange, import("mongoose").Model<IAuditChange, any, any, any, any, any, IAuditChange & Required<{
    _id: Types.ObjectId;
}> & {
    __v: number;
}>, {}, {}, {}, {}, import("mongoose").DefaultSchemaOptions, IAuditChange, Document<unknown, {}, IAuditChange, {
    id: string;
}, import("mongoose").DefaultSchemaOptions> & Omit<IAuditChange & Required<{
    _id: Types.ObjectId;
}> & {
    __v: number;
}, "id"> & import("mongoose").HydratedDocumentOverrides<{
    id: string;
}>, {
    _id?: import("mongoose").SchemaDefinitionProperty<Types.ObjectId, IAuditChange, Document<unknown, {}, IAuditChange, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<IAuditChange & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & import("mongoose").HydratedDocumentOverrides<{
        id: string;
    }>> | undefined;
    audit_log_id?: import("mongoose").SchemaDefinitionProperty<Types.ObjectId, IAuditChange, Document<unknown, {}, IAuditChange, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<IAuditChange & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & import("mongoose").HydratedDocumentOverrides<{
        id: string;
    }>> | undefined;
    field?: import("mongoose").SchemaDefinitionProperty<string, IAuditChange, Document<unknown, {}, IAuditChange, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<IAuditChange & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & import("mongoose").HydratedDocumentOverrides<{
        id: string;
    }>> | undefined;
    before_value?: import("mongoose").SchemaDefinitionProperty<unknown, IAuditChange, Document<unknown, {}, IAuditChange, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<IAuditChange & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & import("mongoose").HydratedDocumentOverrides<{
        id: string;
    }>> | undefined;
    after_value?: import("mongoose").SchemaDefinitionProperty<unknown, IAuditChange, Document<unknown, {}, IAuditChange, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<IAuditChange & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & import("mongoose").HydratedDocumentOverrides<{
        id: string;
    }>> | undefined;
    created_at?: import("mongoose").SchemaDefinitionProperty<Date, IAuditChange, Document<unknown, {}, IAuditChange, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<IAuditChange & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & import("mongoose").HydratedDocumentOverrides<{
        id: string;
    }>> | undefined;
    expires_at?: import("mongoose").SchemaDefinitionProperty<Date, IAuditChange, Document<unknown, {}, IAuditChange, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<IAuditChange & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & import("mongoose").HydratedDocumentOverrides<{
        id: string;
    }>> | undefined;
}, IAuditChange>;
