import { Schema, Document, Types } from 'mongoose';
import { BaseEntity } from '../../../../shared/database/base-mongo.repository';
export interface IProjectSave extends Document, BaseEntity {
    _id: Types.ObjectId;
    project_id: Types.ObjectId;
    workspace_id: Types.ObjectId;
    analysis_run_id: Types.ObjectId | null;
    analysis_result_id: Types.ObjectId | null;
    input_fingerprint: string | null;
    is_stale: boolean;
    summary: {
        overview: string;
        issues: {
            dq: string;
            column: string | null;
            count: number;
            rate: number | null;
        }[];
        evidence_refs: number;
        recommendations: string[];
        ai_section: unknown | null;
    };
    deleted_at: Date | null;
    created_at: Date;
    updated_at: Date;
}
export declare const ProjectSaveSchema: Schema<IProjectSave, import("mongoose").Model<IProjectSave, any, any, any, any, any, IProjectSave & Required<{
    _id: Types.ObjectId;
}> & {
    __v: number;
}>, {}, {}, {}, {}, import("mongoose").DefaultSchemaOptions, IProjectSave, Document<unknown, {}, IProjectSave, {
    id: string;
}, import("mongoose").DefaultSchemaOptions> & Omit<IProjectSave & Required<{
    _id: Types.ObjectId;
}> & {
    __v: number;
}, "id"> & import("mongoose").HydratedDocumentOverrides<{
    id: string;
}>, {
    _id?: import("mongoose").SchemaDefinitionProperty<Types.ObjectId, IProjectSave, Document<unknown, {}, IProjectSave, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<IProjectSave & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & import("mongoose").HydratedDocumentOverrides<{
        id: string;
    }>> | undefined;
    project_id?: import("mongoose").SchemaDefinitionProperty<Types.ObjectId, IProjectSave, Document<unknown, {}, IProjectSave, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<IProjectSave & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & import("mongoose").HydratedDocumentOverrides<{
        id: string;
    }>> | undefined;
    workspace_id?: import("mongoose").SchemaDefinitionProperty<Types.ObjectId, IProjectSave, Document<unknown, {}, IProjectSave, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<IProjectSave & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & import("mongoose").HydratedDocumentOverrides<{
        id: string;
    }>> | undefined;
    analysis_run_id?: import("mongoose").SchemaDefinitionProperty<Types.ObjectId | null, IProjectSave, Document<unknown, {}, IProjectSave, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<IProjectSave & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & import("mongoose").HydratedDocumentOverrides<{
        id: string;
    }>> | undefined;
    analysis_result_id?: import("mongoose").SchemaDefinitionProperty<Types.ObjectId | null, IProjectSave, Document<unknown, {}, IProjectSave, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<IProjectSave & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & import("mongoose").HydratedDocumentOverrides<{
        id: string;
    }>> | undefined;
    input_fingerprint?: import("mongoose").SchemaDefinitionProperty<string | null, IProjectSave, Document<unknown, {}, IProjectSave, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<IProjectSave & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & import("mongoose").HydratedDocumentOverrides<{
        id: string;
    }>> | undefined;
    is_stale?: import("mongoose").SchemaDefinitionProperty<boolean, IProjectSave, Document<unknown, {}, IProjectSave, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<IProjectSave & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & import("mongoose").HydratedDocumentOverrides<{
        id: string;
    }>> | undefined;
    summary?: import("mongoose").SchemaDefinitionProperty<{
        overview: string;
        issues: {
            dq: string;
            column: string | null;
            count: number;
            rate: number | null;
        }[];
        evidence_refs: number;
        recommendations: string[];
        ai_section: unknown | null;
    }, IProjectSave, Document<unknown, {}, IProjectSave, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<IProjectSave & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & import("mongoose").HydratedDocumentOverrides<{
        id: string;
    }>> | undefined;
    deleted_at?: import("mongoose").SchemaDefinitionProperty<Date | null, IProjectSave, Document<unknown, {}, IProjectSave, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<IProjectSave & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & import("mongoose").HydratedDocumentOverrides<{
        id: string;
    }>> | undefined;
    created_at?: import("mongoose").SchemaDefinitionProperty<Date, IProjectSave, Document<unknown, {}, IProjectSave, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<IProjectSave & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & import("mongoose").HydratedDocumentOverrides<{
        id: string;
    }>> | undefined;
    updated_at?: import("mongoose").SchemaDefinitionProperty<Date, IProjectSave, Document<unknown, {}, IProjectSave, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<IProjectSave & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & import("mongoose").HydratedDocumentOverrides<{
        id: string;
    }>> | undefined;
}, IProjectSave>;
