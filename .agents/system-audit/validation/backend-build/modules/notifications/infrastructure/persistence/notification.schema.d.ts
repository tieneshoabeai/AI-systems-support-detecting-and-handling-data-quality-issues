import { Schema, Document, Types } from 'mongoose';
import { BaseEntity } from '../../../../shared/database/base-mongo.repository';
export declare const NotificationTypes: readonly ['project_created', 'project_deleted', 'project_member_added', 'issue_needs_info', 'issue_resolved', 'analysis_completed', 'analysis_failed', 'ai_analysis_ready', 'report_ready', 'security_alert'];
export type NotificationType = (typeof NotificationTypes)[number];
export declare const MandatoryNotificationTypes: NotificationType[];
export interface INotificationPayload {
    targetType?: string | null;
    targetId?: string | null;
    actionUrl?: string | null;
}
export interface INotification extends Document, BaseEntity {
    _id: Types.ObjectId;
    user_id: Types.ObjectId;
    type: NotificationType;
    is_mandatory: boolean;
    title: string;
    summary?: string | null;
    payload?: INotificationPayload;
    source_event_id?: string | null;
    read_at: Date | null;
    expires_at?: Date | null;
    created_at: Date;
    updated_at: Date;
}
export declare const NotificationSchema: Schema<INotification, import("mongoose").Model<INotification, any, any, any, any, any, INotification & Required<{
    _id: Types.ObjectId;
}> & {
    __v: number;
}>, {}, {}, {}, {}, import("mongoose").DefaultSchemaOptions, INotification, Document<unknown, {}, INotification, {
    id: string;
}, import("mongoose").DefaultSchemaOptions> & Omit<INotification & Required<{
    _id: Types.ObjectId;
}> & {
    __v: number;
}, "id"> & import("mongoose").HydratedDocumentOverrides<{
    id: string;
}>, {
    deleted_at?: import("mongoose").SchemaDefinitionProperty<Date | null | undefined, INotification, Document<unknown, {}, INotification, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<INotification & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & import("mongoose").HydratedDocumentOverrides<{
        id: string;
    }>> | undefined;
    _id?: import("mongoose").SchemaDefinitionProperty<Types.ObjectId, INotification, Document<unknown, {}, INotification, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<INotification & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & import("mongoose").HydratedDocumentOverrides<{
        id: string;
    }>> | undefined;
    user_id?: import("mongoose").SchemaDefinitionProperty<Types.ObjectId, INotification, Document<unknown, {}, INotification, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<INotification & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & import("mongoose").HydratedDocumentOverrides<{
        id: string;
    }>> | undefined;
    type?: import("mongoose").SchemaDefinitionProperty<"ai_analysis_ready" | "analysis_completed" | "analysis_failed" | "issue_needs_info" | "issue_resolved" | "project_created" | "project_deleted" | "project_member_added" | "report_ready" | "security_alert", INotification, Document<unknown, {}, INotification, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<INotification & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & import("mongoose").HydratedDocumentOverrides<{
        id: string;
    }>> | undefined;
    is_mandatory?: import("mongoose").SchemaDefinitionProperty<boolean, INotification, Document<unknown, {}, INotification, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<INotification & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & import("mongoose").HydratedDocumentOverrides<{
        id: string;
    }>> | undefined;
    title?: import("mongoose").SchemaDefinitionProperty<string, INotification, Document<unknown, {}, INotification, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<INotification & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & import("mongoose").HydratedDocumentOverrides<{
        id: string;
    }>> | undefined;
    summary?: import("mongoose").SchemaDefinitionProperty<string | null | undefined, INotification, Document<unknown, {}, INotification, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<INotification & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & import("mongoose").HydratedDocumentOverrides<{
        id: string;
    }>> | undefined;
    payload?: import("mongoose").SchemaDefinitionProperty<INotificationPayload | undefined, INotification, Document<unknown, {}, INotification, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<INotification & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & import("mongoose").HydratedDocumentOverrides<{
        id: string;
    }>> | undefined;
    source_event_id?: import("mongoose").SchemaDefinitionProperty<string | null | undefined, INotification, Document<unknown, {}, INotification, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<INotification & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & import("mongoose").HydratedDocumentOverrides<{
        id: string;
    }>> | undefined;
    read_at?: import("mongoose").SchemaDefinitionProperty<Date | null, INotification, Document<unknown, {}, INotification, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<INotification & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & import("mongoose").HydratedDocumentOverrides<{
        id: string;
    }>> | undefined;
    expires_at?: import("mongoose").SchemaDefinitionProperty<Date | null | undefined, INotification, Document<unknown, {}, INotification, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<INotification & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & import("mongoose").HydratedDocumentOverrides<{
        id: string;
    }>> | undefined;
    created_at?: import("mongoose").SchemaDefinitionProperty<Date, INotification, Document<unknown, {}, INotification, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<INotification & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & import("mongoose").HydratedDocumentOverrides<{
        id: string;
    }>> | undefined;
    updated_at?: import("mongoose").SchemaDefinitionProperty<Date, INotification, Document<unknown, {}, INotification, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<INotification & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & import("mongoose").HydratedDocumentOverrides<{
        id: string;
    }>> | undefined;
}, INotification>;
