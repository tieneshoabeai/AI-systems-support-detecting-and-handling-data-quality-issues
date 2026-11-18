import { Schema, Document, Types } from 'mongoose';
export interface IDatasetRecord extends Document {
    _id: Types.ObjectId;
    dataset_id: Types.ObjectId;
    row_index: number;
    props: Record<string, unknown>;
    created_at: Date;
    updated_at: Date;
}
export declare const DatasetRecordSchema: Schema<IDatasetRecord, import("mongoose").Model<IDatasetRecord, any, any, any, any, any, IDatasetRecord & Required<{
    _id: Types.ObjectId;
}> & {
    __v: number;
}>, {}, {}, {}, {}, import("mongoose").DefaultSchemaOptions, IDatasetRecord, Document<unknown, {}, IDatasetRecord, {
    id: string;
}, import("mongoose").DefaultSchemaOptions> & Omit<IDatasetRecord & Required<{
    _id: Types.ObjectId;
}> & {
    __v: number;
}, "id"> & import("mongoose").HydratedDocumentOverrides<{
    id: string;
}>, {
    _id?: import("mongoose").SchemaDefinitionProperty<Types.ObjectId, IDatasetRecord, Document<unknown, {}, IDatasetRecord, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<IDatasetRecord & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & import("mongoose").HydratedDocumentOverrides<{
        id: string;
    }>> | undefined;
    dataset_id?: import("mongoose").SchemaDefinitionProperty<Types.ObjectId, IDatasetRecord, Document<unknown, {}, IDatasetRecord, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<IDatasetRecord & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & import("mongoose").HydratedDocumentOverrides<{
        id: string;
    }>> | undefined;
    row_index?: import("mongoose").SchemaDefinitionProperty<number, IDatasetRecord, Document<unknown, {}, IDatasetRecord, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<IDatasetRecord & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & import("mongoose").HydratedDocumentOverrides<{
        id: string;
    }>> | undefined;
    props?: import("mongoose").SchemaDefinitionProperty<Record<string, unknown>, IDatasetRecord, Document<unknown, {}, IDatasetRecord, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<IDatasetRecord & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & import("mongoose").HydratedDocumentOverrides<{
        id: string;
    }>> | undefined;
    created_at?: import("mongoose").SchemaDefinitionProperty<Date, IDatasetRecord, Document<unknown, {}, IDatasetRecord, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<IDatasetRecord & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & import("mongoose").HydratedDocumentOverrides<{
        id: string;
    }>> | undefined;
    updated_at?: import("mongoose").SchemaDefinitionProperty<Date, IDatasetRecord, Document<unknown, {}, IDatasetRecord, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<IDatasetRecord & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & import("mongoose").HydratedDocumentOverrides<{
        id: string;
    }>> | undefined;
}, IDatasetRecord>;
