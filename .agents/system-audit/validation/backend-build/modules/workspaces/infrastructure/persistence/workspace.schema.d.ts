import { Schema, Document, Types } from 'mongoose';
import { BaseEntity } from '../../../../shared/database/base-mongo.repository';
export type WorkspaceRole = 'owner' | 'member';
export interface IWorkspaceMember {
    user_id: Types.ObjectId;
    role: WorkspaceRole;
    joined_at: Date;
}
export interface IWorkspace extends Document, BaseEntity {
    _id: Types.ObjectId;
    name: string;
    description?: string;
    owner_id: Types.ObjectId;
    members: IWorkspaceMember[];
    storage_used_bytes: number;
    last_accessed_at: Date | null;
    deleted_at: Date | null;
    version: number;
    created_at: Date;
    updated_at: Date;
}
export declare const WorkspaceMemberSchema: Schema<IWorkspaceMember, import("mongoose").Model<IWorkspaceMember, any, any, any, any, any, IWorkspaceMember & {
    _id: Types.ObjectId;
} & {
    __v: number;
}>, {}, {}, {}, {}, import("mongoose").DefaultSchemaOptions, IWorkspaceMember, Document<unknown, {}, IWorkspaceMember, {
    id: string;
}, import("mongoose").DefaultSchemaOptions> & Omit<IWorkspaceMember & {
    _id: Types.ObjectId;
} & {
    __v: number;
}, "id"> & import("mongoose").HydratedDocumentOverrides<{
    id: string;
}>, {
    user_id?: import("mongoose").SchemaDefinitionProperty<Types.ObjectId, IWorkspaceMember, Document<unknown, {}, IWorkspaceMember, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<IWorkspaceMember & {
        _id: Types.ObjectId;
    } & {
        __v: number;
    }, "id"> & import("mongoose").HydratedDocumentOverrides<{
        id: string;
    }>> | undefined;
    role?: import("mongoose").SchemaDefinitionProperty<WorkspaceRole, IWorkspaceMember, Document<unknown, {}, IWorkspaceMember, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<IWorkspaceMember & {
        _id: Types.ObjectId;
    } & {
        __v: number;
    }, "id"> & import("mongoose").HydratedDocumentOverrides<{
        id: string;
    }>> | undefined;
    joined_at?: import("mongoose").SchemaDefinitionProperty<Date, IWorkspaceMember, Document<unknown, {}, IWorkspaceMember, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<IWorkspaceMember & {
        _id: Types.ObjectId;
    } & {
        __v: number;
    }, "id"> & import("mongoose").HydratedDocumentOverrides<{
        id: string;
    }>> | undefined;
}, IWorkspaceMember>;
export declare const WorkspaceSchema: Schema<IWorkspace, import("mongoose").Model<IWorkspace, any, any, any, any, any, IWorkspace & Required<{
    _id: Types.ObjectId;
}> & {
    __v: number;
}>, {}, {}, {}, {}, import("mongoose").DefaultSchemaOptions, IWorkspace, Document<unknown, {}, IWorkspace, {
    id: string;
}, import("mongoose").DefaultSchemaOptions> & Omit<IWorkspace & Required<{
    _id: Types.ObjectId;
}> & {
    __v: number;
}, "id"> & import("mongoose").HydratedDocumentOverrides<{
    id: string;
}>, {
    _id?: import("mongoose").SchemaDefinitionProperty<Types.ObjectId, IWorkspace, Document<unknown, {}, IWorkspace, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<IWorkspace & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & import("mongoose").HydratedDocumentOverrides<{
        id: string;
    }>> | undefined;
    name?: import("mongoose").SchemaDefinitionProperty<string, IWorkspace, Document<unknown, {}, IWorkspace, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<IWorkspace & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & import("mongoose").HydratedDocumentOverrides<{
        id: string;
    }>> | undefined;
    description?: import("mongoose").SchemaDefinitionProperty<string | undefined, IWorkspace, Document<unknown, {}, IWorkspace, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<IWorkspace & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & import("mongoose").HydratedDocumentOverrides<{
        id: string;
    }>> | undefined;
    owner_id?: import("mongoose").SchemaDefinitionProperty<Types.ObjectId, IWorkspace, Document<unknown, {}, IWorkspace, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<IWorkspace & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & import("mongoose").HydratedDocumentOverrides<{
        id: string;
    }>> | undefined;
    members?: import("mongoose").SchemaDefinitionProperty<IWorkspaceMember[], IWorkspace, Document<unknown, {}, IWorkspace, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<IWorkspace & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & import("mongoose").HydratedDocumentOverrides<{
        id: string;
    }>> | undefined;
    storage_used_bytes?: import("mongoose").SchemaDefinitionProperty<number, IWorkspace, Document<unknown, {}, IWorkspace, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<IWorkspace & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & import("mongoose").HydratedDocumentOverrides<{
        id: string;
    }>> | undefined;
    last_accessed_at?: import("mongoose").SchemaDefinitionProperty<Date | null, IWorkspace, Document<unknown, {}, IWorkspace, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<IWorkspace & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & import("mongoose").HydratedDocumentOverrides<{
        id: string;
    }>> | undefined;
    deleted_at?: import("mongoose").SchemaDefinitionProperty<Date | null, IWorkspace, Document<unknown, {}, IWorkspace, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<IWorkspace & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & import("mongoose").HydratedDocumentOverrides<{
        id: string;
    }>> | undefined;
    version?: import("mongoose").SchemaDefinitionProperty<number, IWorkspace, Document<unknown, {}, IWorkspace, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<IWorkspace & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & import("mongoose").HydratedDocumentOverrides<{
        id: string;
    }>> | undefined;
    created_at?: import("mongoose").SchemaDefinitionProperty<Date, IWorkspace, Document<unknown, {}, IWorkspace, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<IWorkspace & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & import("mongoose").HydratedDocumentOverrides<{
        id: string;
    }>> | undefined;
    updated_at?: import("mongoose").SchemaDefinitionProperty<Date, IWorkspace, Document<unknown, {}, IWorkspace, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<IWorkspace & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & import("mongoose").HydratedDocumentOverrides<{
        id: string;
    }>> | undefined;
}, IWorkspace>;
