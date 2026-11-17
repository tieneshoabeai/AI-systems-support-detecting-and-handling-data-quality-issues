import { Schema, Document, Types } from 'mongoose';
import { BaseEntity } from '../../../../shared/database/base-mongo.repository';
export type CellEvidenceKind = 'missing' | 'duplicate' | 'invalid_type' | 'outlier';
export interface ICellEvidence extends Document, BaseEntity {
    _id: Types.ObjectId;
    analysis_run_id: Types.ObjectId;
    project_id: Types.ObjectId;
    dataset_id: Types.ObjectId;
    column: string;
    row_index: number;
    kind: CellEvidenceKind;
    reason: string | null;
    value_masked: string | null;
    deleted_at: Date | null;
    created_at: Date;
    updated_at: Date;
}
export declare const CellEvidenceSchema: Schema<ICellEvidence, import("mongoose").Model<ICellEvidence, any, any, any, any, any, ICellEvidence & Required<{
    _id: Types.ObjectId;
}> & {
    __v: number;
}>, {}, {}, {}, {}, import("mongoose").DefaultSchemaOptions, ICellEvidence, Document<unknown, {}, ICellEvidence, {
    id: string;
}, import("mongoose").DefaultSchemaOptions> & Omit<ICellEvidence & Required<{
    _id: Types.ObjectId;
}> & {
    __v: number;
}, "id"> & import("mongoose").HydratedDocumentOverrides<{
    id: string;
}>, {
    _id?: import("mongoose").SchemaDefinitionProperty<Types.ObjectId, ICellEvidence, Document<unknown, {}, ICellEvidence, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<ICellEvidence & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & import("mongoose").HydratedDocumentOverrides<{
        id: string;
    }>> | undefined;
    analysis_run_id?: import("mongoose").SchemaDefinitionProperty<Types.ObjectId, ICellEvidence, Document<unknown, {}, ICellEvidence, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<ICellEvidence & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & import("mongoose").HydratedDocumentOverrides<{
        id: string;
    }>> | undefined;
    project_id?: import("mongoose").SchemaDefinitionProperty<Types.ObjectId, ICellEvidence, Document<unknown, {}, ICellEvidence, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<ICellEvidence & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & import("mongoose").HydratedDocumentOverrides<{
        id: string;
    }>> | undefined;
    dataset_id?: import("mongoose").SchemaDefinitionProperty<Types.ObjectId, ICellEvidence, Document<unknown, {}, ICellEvidence, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<ICellEvidence & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & import("mongoose").HydratedDocumentOverrides<{
        id: string;
    }>> | undefined;
    column?: import("mongoose").SchemaDefinitionProperty<string, ICellEvidence, Document<unknown, {}, ICellEvidence, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<ICellEvidence & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & import("mongoose").HydratedDocumentOverrides<{
        id: string;
    }>> | undefined;
    row_index?: import("mongoose").SchemaDefinitionProperty<number, ICellEvidence, Document<unknown, {}, ICellEvidence, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<ICellEvidence & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & import("mongoose").HydratedDocumentOverrides<{
        id: string;
    }>> | undefined;
    kind?: import("mongoose").SchemaDefinitionProperty<CellEvidenceKind, ICellEvidence, Document<unknown, {}, ICellEvidence, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<ICellEvidence & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & import("mongoose").HydratedDocumentOverrides<{
        id: string;
    }>> | undefined;
    reason?: import("mongoose").SchemaDefinitionProperty<string | null, ICellEvidence, Document<unknown, {}, ICellEvidence, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<ICellEvidence & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & import("mongoose").HydratedDocumentOverrides<{
        id: string;
    }>> | undefined;
    value_masked?: import("mongoose").SchemaDefinitionProperty<string | null, ICellEvidence, Document<unknown, {}, ICellEvidence, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<ICellEvidence & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & import("mongoose").HydratedDocumentOverrides<{
        id: string;
    }>> | undefined;
    deleted_at?: import("mongoose").SchemaDefinitionProperty<Date | null, ICellEvidence, Document<unknown, {}, ICellEvidence, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<ICellEvidence & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & import("mongoose").HydratedDocumentOverrides<{
        id: string;
    }>> | undefined;
    created_at?: import("mongoose").SchemaDefinitionProperty<Date, ICellEvidence, Document<unknown, {}, ICellEvidence, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<ICellEvidence & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & import("mongoose").HydratedDocumentOverrides<{
        id: string;
    }>> | undefined;
    updated_at?: import("mongoose").SchemaDefinitionProperty<Date, ICellEvidence, Document<unknown, {}, ICellEvidence, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<ICellEvidence & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & import("mongoose").HydratedDocumentOverrides<{
        id: string;
    }>> | undefined;
}, ICellEvidence>;
