import { Schema, Document, Types } from 'mongoose';
import { BaseEntity } from '../../../../shared/database/base-mongo.repository';
export type ReportJobStatus = 'pending' | 'running' | 'succeeded' | 'failed';
export interface IReportJob extends Document, BaseEntity {
    _id: Types.ObjectId;
    project_id: Types.ObjectId;
    workspace_id: Types.ObjectId;
    project_save_id: Types.ObjectId | null;
    status: ReportJobStatus;
    storage_key: string | null;
    file_size_bytes: number | null;
    error: {
        code: string;
        message: string;
    } | null;
    deleted_at: Date | null;
    created_at: Date;
    updated_at: Date;
}
export declare const ReportJobSchema: Schema<IReportJob, import("mongoose").Model<IReportJob, any, any, any, any, any, IReportJob & Required<{
    _id: Types.ObjectId;
}> & {
    __v: number;
}>, {}, {}, {}, {}, import("mongoose").DefaultSchemaOptions, IReportJob, Document<unknown, {}, IReportJob, {
    id: string;
}, import("mongoose").DefaultSchemaOptions> & Omit<IReportJob & Required<{
    _id: Types.ObjectId;
}> & {
    __v: number;
}, "id"> & import("mongoose").HydratedDocumentOverrides<{
    id: string;
}>, {
    _id?: import("mongoose").SchemaDefinitionProperty<Types.ObjectId, IReportJob, Document<unknown, {}, IReportJob, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<IReportJob & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & import("mongoose").HydratedDocumentOverrides<{
        id: string;
    }>> | undefined;
    project_id?: import("mongoose").SchemaDefinitionProperty<Types.ObjectId, IReportJob, Document<unknown, {}, IReportJob, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<IReportJob & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & import("mongoose").HydratedDocumentOverrides<{
        id: string;
    }>> | undefined;
    workspace_id?: import("mongoose").SchemaDefinitionProperty<Types.ObjectId, IReportJob, Document<unknown, {}, IReportJob, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<IReportJob & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & import("mongoose").HydratedDocumentOverrides<{
        id: string;
    }>> | undefined;
    project_save_id?: import("mongoose").SchemaDefinitionProperty<Types.ObjectId | null, IReportJob, Document<unknown, {}, IReportJob, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<IReportJob & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & import("mongoose").HydratedDocumentOverrides<{
        id: string;
    }>> | undefined;
    status?: import("mongoose").SchemaDefinitionProperty<ReportJobStatus, IReportJob, Document<unknown, {}, IReportJob, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<IReportJob & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & import("mongoose").HydratedDocumentOverrides<{
        id: string;
    }>> | undefined;
    storage_key?: import("mongoose").SchemaDefinitionProperty<string | null, IReportJob, Document<unknown, {}, IReportJob, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<IReportJob & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & import("mongoose").HydratedDocumentOverrides<{
        id: string;
    }>> | undefined;
    file_size_bytes?: import("mongoose").SchemaDefinitionProperty<number | null, IReportJob, Document<unknown, {}, IReportJob, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<IReportJob & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & import("mongoose").HydratedDocumentOverrides<{
        id: string;
    }>> | undefined;
    error?: import("mongoose").SchemaDefinitionProperty<{
        code: string;
        message: string;
    } | null, IReportJob, Document<unknown, {}, IReportJob, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<IReportJob & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & import("mongoose").HydratedDocumentOverrides<{
        id: string;
    }>> | undefined;
    deleted_at?: import("mongoose").SchemaDefinitionProperty<Date | null, IReportJob, Document<unknown, {}, IReportJob, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<IReportJob & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & import("mongoose").HydratedDocumentOverrides<{
        id: string;
    }>> | undefined;
    created_at?: import("mongoose").SchemaDefinitionProperty<Date, IReportJob, Document<unknown, {}, IReportJob, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<IReportJob & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & import("mongoose").HydratedDocumentOverrides<{
        id: string;
    }>> | undefined;
    updated_at?: import("mongoose").SchemaDefinitionProperty<Date, IReportJob, Document<unknown, {}, IReportJob, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<IReportJob & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & import("mongoose").HydratedDocumentOverrides<{
        id: string;
    }>> | undefined;
}, IReportJob>;
