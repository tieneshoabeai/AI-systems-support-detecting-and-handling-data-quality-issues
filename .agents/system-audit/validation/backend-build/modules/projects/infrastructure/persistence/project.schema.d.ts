import { Schema, Document, Types } from 'mongoose';
import { BaseEntity } from '../../../../shared/database/base-mongo.repository';
import type { ProjectStatus } from '../../domain/value-objects/project-status.vo';
import type { ProjectMemberRole } from '../../domain/value-objects/project-role.vo';
export type { ProjectStatus, ProjectMemberRole };
export interface IProjectMember {
    user_id: Types.ObjectId;
    role: ProjectMemberRole;
    joined_at: Date;
}
export interface IProject extends Document, BaseEntity {
    _id: Types.ObjectId;
    workspace_id: Types.ObjectId;
    name: string;
    description?: string;
    has_dataset: boolean;
    status: ProjectStatus;
    members: IProjectMember[];
    last_accessed_at: Date | null;
    created_by: Types.ObjectId;
    deleted_at: Date | null;
    version: number;
    created_at: Date;
    updated_at: Date;
}
export declare const ProjectMemberSchema: Schema<IProjectMember, import("mongoose").Model<IProjectMember, any, any, any, any, any, IProjectMember & {
    _id: Types.ObjectId;
} & {
    __v: number;
}>, {}, {}, {}, {}, import("mongoose").DefaultSchemaOptions, IProjectMember, Document<unknown, {}, IProjectMember, {
    id: string;
}, import("mongoose").DefaultSchemaOptions> & Omit<IProjectMember & {
    _id: Types.ObjectId;
} & {
    __v: number;
}, "id"> & import("mongoose").HydratedDocumentOverrides<{
    id: string;
}>, {
    user_id?: import("mongoose").SchemaDefinitionProperty<Types.ObjectId, IProjectMember, Document<unknown, {}, IProjectMember, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<IProjectMember & {
        _id: Types.ObjectId;
    } & {
        __v: number;
    }, "id"> & import("mongoose").HydratedDocumentOverrides<{
        id: string;
    }>> | undefined;
    role?: import("mongoose").SchemaDefinitionProperty<"member" | "owner" | "viewer", IProjectMember, Document<unknown, {}, IProjectMember, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<IProjectMember & {
        _id: Types.ObjectId;
    } & {
        __v: number;
    }, "id"> & import("mongoose").HydratedDocumentOverrides<{
        id: string;
    }>> | undefined;
    joined_at?: import("mongoose").SchemaDefinitionProperty<Date, IProjectMember, Document<unknown, {}, IProjectMember, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<IProjectMember & {
        _id: Types.ObjectId;
    } & {
        __v: number;
    }, "id"> & import("mongoose").HydratedDocumentOverrides<{
        id: string;
    }>> | undefined;
}, IProjectMember>;
export declare const ProjectSchema: Schema<IProject, import("mongoose").Model<IProject, any, any, any, any, any, IProject & Required<{
    _id: Types.ObjectId;
}> & {
    __v: number;
}>, {}, {}, {}, {}, import("mongoose").DefaultSchemaOptions, IProject, Document<unknown, {}, IProject, {
    id: string;
}, import("mongoose").DefaultSchemaOptions> & Omit<IProject & Required<{
    _id: Types.ObjectId;
}> & {
    __v: number;
}, "id"> & import("mongoose").HydratedDocumentOverrides<{
    id: string;
}>, {
    _id?: import("mongoose").SchemaDefinitionProperty<Types.ObjectId, IProject, Document<unknown, {}, IProject, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<IProject & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & import("mongoose").HydratedDocumentOverrides<{
        id: string;
    }>> | undefined;
    workspace_id?: import("mongoose").SchemaDefinitionProperty<Types.ObjectId, IProject, Document<unknown, {}, IProject, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<IProject & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & import("mongoose").HydratedDocumentOverrides<{
        id: string;
    }>> | undefined;
    name?: import("mongoose").SchemaDefinitionProperty<string, IProject, Document<unknown, {}, IProject, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<IProject & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & import("mongoose").HydratedDocumentOverrides<{
        id: string;
    }>> | undefined;
    description?: import("mongoose").SchemaDefinitionProperty<string | undefined, IProject, Document<unknown, {}, IProject, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<IProject & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & import("mongoose").HydratedDocumentOverrides<{
        id: string;
    }>> | undefined;
    has_dataset?: import("mongoose").SchemaDefinitionProperty<boolean, IProject, Document<unknown, {}, IProject, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<IProject & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & import("mongoose").HydratedDocumentOverrides<{
        id: string;
    }>> | undefined;
    status?: import("mongoose").SchemaDefinitionProperty<"completed" | "in_progress" | "not_started", IProject, Document<unknown, {}, IProject, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<IProject & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & import("mongoose").HydratedDocumentOverrides<{
        id: string;
    }>> | undefined;
    members?: import("mongoose").SchemaDefinitionProperty<IProjectMember[], IProject, Document<unknown, {}, IProject, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<IProject & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & import("mongoose").HydratedDocumentOverrides<{
        id: string;
    }>> | undefined;
    last_accessed_at?: import("mongoose").SchemaDefinitionProperty<Date | null, IProject, Document<unknown, {}, IProject, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<IProject & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & import("mongoose").HydratedDocumentOverrides<{
        id: string;
    }>> | undefined;
    created_by?: import("mongoose").SchemaDefinitionProperty<Types.ObjectId, IProject, Document<unknown, {}, IProject, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<IProject & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & import("mongoose").HydratedDocumentOverrides<{
        id: string;
    }>> | undefined;
    deleted_at?: import("mongoose").SchemaDefinitionProperty<Date | null, IProject, Document<unknown, {}, IProject, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<IProject & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & import("mongoose").HydratedDocumentOverrides<{
        id: string;
    }>> | undefined;
    version?: import("mongoose").SchemaDefinitionProperty<number, IProject, Document<unknown, {}, IProject, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<IProject & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & import("mongoose").HydratedDocumentOverrides<{
        id: string;
    }>> | undefined;
    created_at?: import("mongoose").SchemaDefinitionProperty<Date, IProject, Document<unknown, {}, IProject, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<IProject & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & import("mongoose").HydratedDocumentOverrides<{
        id: string;
    }>> | undefined;
    updated_at?: import("mongoose").SchemaDefinitionProperty<Date, IProject, Document<unknown, {}, IProject, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<IProject & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & import("mongoose").HydratedDocumentOverrides<{
        id: string;
    }>> | undefined;
}, IProject>;
