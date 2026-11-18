import { Schema, Document, Types } from 'mongoose';
import { BaseEntity } from '../../../../shared/database/base-mongo.repository';
import type { IssueType } from '../../domain/value-objects/issue-type.vo';
export type { IssueType };
export declare const IssueTypes: readonly ['function_error', 'display_error', 'data_error', 'feature_feedback', 'other'];
import type { IssueStatus } from '../../domain/value-objects/issue-status.vo';
export type { IssueStatus };
export declare const IssueStatuses: readonly ['new', 'in_progress', 'resolved', 'closed'];
export interface IIssueAttachment {
    id: Types.ObjectId;
    filename: string;
    storage_key: string;
    size_bytes: number;
    content_type: string;
}
export interface IIssueContext {
    api_path?: string | null;
    error_message?: string | null;
    occurred_at?: Date | null;
}
export interface IIssueReport extends Document, BaseEntity {
    _id: Types.ObjectId;
    user_id: Types.ObjectId;
    workspace_id?: Types.ObjectId | null;
    issue_type: IssueType;
    title: string;
    description: string;
    status: IssueStatus;
    attachments: IIssueAttachment[];
    context?: IIssueContext;
    version: number;
    deleted_at: Date | null;
    created_at: Date;
    updated_at: Date;
}
export declare const IssueReportSchema: Schema<IIssueReport, import("mongoose").Model<IIssueReport, any, any, any, any, any, IIssueReport & Required<{
    _id: Types.ObjectId;
}> & {
    __v: number;
}>, {}, {}, {}, {}, import("mongoose").DefaultSchemaOptions, IIssueReport, Document<unknown, {}, IIssueReport, {
    id: string;
}, import("mongoose").DefaultSchemaOptions> & Omit<IIssueReport & Required<{
    _id: Types.ObjectId;
}> & {
    __v: number;
}, "id"> & import("mongoose").HydratedDocumentOverrides<{
    id: string;
}>, {
    _id?: import("mongoose").SchemaDefinitionProperty<Types.ObjectId, IIssueReport, Document<unknown, {}, IIssueReport, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<IIssueReport & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & import("mongoose").HydratedDocumentOverrides<{
        id: string;
    }>> | undefined;
    user_id?: import("mongoose").SchemaDefinitionProperty<Types.ObjectId, IIssueReport, Document<unknown, {}, IIssueReport, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<IIssueReport & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & import("mongoose").HydratedDocumentOverrides<{
        id: string;
    }>> | undefined;
    workspace_id?: import("mongoose").SchemaDefinitionProperty<Types.ObjectId | null | undefined, IIssueReport, Document<unknown, {}, IIssueReport, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<IIssueReport & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & import("mongoose").HydratedDocumentOverrides<{
        id: string;
    }>> | undefined;
    issue_type?: import("mongoose").SchemaDefinitionProperty<"data_error" | "display_error" | "feature_feedback" | "function_error" | "other", IIssueReport, Document<unknown, {}, IIssueReport, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<IIssueReport & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & import("mongoose").HydratedDocumentOverrides<{
        id: string;
    }>> | undefined;
    title?: import("mongoose").SchemaDefinitionProperty<string, IIssueReport, Document<unknown, {}, IIssueReport, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<IIssueReport & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & import("mongoose").HydratedDocumentOverrides<{
        id: string;
    }>> | undefined;
    description?: import("mongoose").SchemaDefinitionProperty<string, IIssueReport, Document<unknown, {}, IIssueReport, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<IIssueReport & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & import("mongoose").HydratedDocumentOverrides<{
        id: string;
    }>> | undefined;
    status?: import("mongoose").SchemaDefinitionProperty<"closed" | "in_progress" | "new" | "resolved", IIssueReport, Document<unknown, {}, IIssueReport, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<IIssueReport & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & import("mongoose").HydratedDocumentOverrides<{
        id: string;
    }>> | undefined;
    attachments?: import("mongoose").SchemaDefinitionProperty<IIssueAttachment[], IIssueReport, Document<unknown, {}, IIssueReport, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<IIssueReport & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & import("mongoose").HydratedDocumentOverrides<{
        id: string;
    }>> | undefined;
    context?: import("mongoose").SchemaDefinitionProperty<IIssueContext | undefined, IIssueReport, Document<unknown, {}, IIssueReport, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<IIssueReport & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & import("mongoose").HydratedDocumentOverrides<{
        id: string;
    }>> | undefined;
    version?: import("mongoose").SchemaDefinitionProperty<number, IIssueReport, Document<unknown, {}, IIssueReport, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<IIssueReport & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & import("mongoose").HydratedDocumentOverrides<{
        id: string;
    }>> | undefined;
    deleted_at?: import("mongoose").SchemaDefinitionProperty<Date | null, IIssueReport, Document<unknown, {}, IIssueReport, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<IIssueReport & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & import("mongoose").HydratedDocumentOverrides<{
        id: string;
    }>> | undefined;
    created_at?: import("mongoose").SchemaDefinitionProperty<Date, IIssueReport, Document<unknown, {}, IIssueReport, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<IIssueReport & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & import("mongoose").HydratedDocumentOverrides<{
        id: string;
    }>> | undefined;
    updated_at?: import("mongoose").SchemaDefinitionProperty<Date, IIssueReport, Document<unknown, {}, IIssueReport, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<IIssueReport & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & import("mongoose").HydratedDocumentOverrides<{
        id: string;
    }>> | undefined;
}, IIssueReport>;
