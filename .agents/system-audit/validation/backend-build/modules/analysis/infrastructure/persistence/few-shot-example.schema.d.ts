import { Schema, Document, Types } from 'mongoose';
import { BaseEntity } from '../../../../shared/database/base-mongo.repository';
export type FewShotLabel = 'correct' | 'false_positive' | 'missed_issue';
export interface IFewShotExample extends Document, BaseEntity {
    _id: Types.ObjectId;
    workspace_id: Types.ObjectId;
    project_id: Types.ObjectId | null;
    error_type: string;
    column_traits: string;
    description: string;
    label: FewShotLabel;
    embedding: number[];
    trust_score: number;
    language: string;
    agreement_count: number;
    deleted_at: Date | null;
    created_at: Date;
    updated_at: Date;
}
export declare const FewShotExampleSchema: Schema<IFewShotExample, import("mongoose").Model<IFewShotExample, any, any, any, any, any, IFewShotExample & Required<{
    _id: Types.ObjectId;
}> & {
    __v: number;
}>, {}, {}, {}, {}, import("mongoose").DefaultSchemaOptions, IFewShotExample, Document<unknown, {}, IFewShotExample, {
    id: string;
}, import("mongoose").DefaultSchemaOptions> & Omit<IFewShotExample & Required<{
    _id: Types.ObjectId;
}> & {
    __v: number;
}, "id"> & import("mongoose").HydratedDocumentOverrides<{
    id: string;
}>, {
    _id?: import("mongoose").SchemaDefinitionProperty<Types.ObjectId, IFewShotExample, Document<unknown, {}, IFewShotExample, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<IFewShotExample & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & import("mongoose").HydratedDocumentOverrides<{
        id: string;
    }>> | undefined;
    workspace_id?: import("mongoose").SchemaDefinitionProperty<Types.ObjectId, IFewShotExample, Document<unknown, {}, IFewShotExample, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<IFewShotExample & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & import("mongoose").HydratedDocumentOverrides<{
        id: string;
    }>> | undefined;
    project_id?: import("mongoose").SchemaDefinitionProperty<Types.ObjectId | null, IFewShotExample, Document<unknown, {}, IFewShotExample, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<IFewShotExample & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & import("mongoose").HydratedDocumentOverrides<{
        id: string;
    }>> | undefined;
    error_type?: import("mongoose").SchemaDefinitionProperty<string, IFewShotExample, Document<unknown, {}, IFewShotExample, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<IFewShotExample & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & import("mongoose").HydratedDocumentOverrides<{
        id: string;
    }>> | undefined;
    column_traits?: import("mongoose").SchemaDefinitionProperty<string, IFewShotExample, Document<unknown, {}, IFewShotExample, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<IFewShotExample & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & import("mongoose").HydratedDocumentOverrides<{
        id: string;
    }>> | undefined;
    description?: import("mongoose").SchemaDefinitionProperty<string, IFewShotExample, Document<unknown, {}, IFewShotExample, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<IFewShotExample & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & import("mongoose").HydratedDocumentOverrides<{
        id: string;
    }>> | undefined;
    label?: import("mongoose").SchemaDefinitionProperty<FewShotLabel, IFewShotExample, Document<unknown, {}, IFewShotExample, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<IFewShotExample & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & import("mongoose").HydratedDocumentOverrides<{
        id: string;
    }>> | undefined;
    embedding?: import("mongoose").SchemaDefinitionProperty<number[], IFewShotExample, Document<unknown, {}, IFewShotExample, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<IFewShotExample & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & import("mongoose").HydratedDocumentOverrides<{
        id: string;
    }>> | undefined;
    trust_score?: import("mongoose").SchemaDefinitionProperty<number, IFewShotExample, Document<unknown, {}, IFewShotExample, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<IFewShotExample & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & import("mongoose").HydratedDocumentOverrides<{
        id: string;
    }>> | undefined;
    language?: import("mongoose").SchemaDefinitionProperty<string, IFewShotExample, Document<unknown, {}, IFewShotExample, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<IFewShotExample & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & import("mongoose").HydratedDocumentOverrides<{
        id: string;
    }>> | undefined;
    agreement_count?: import("mongoose").SchemaDefinitionProperty<number, IFewShotExample, Document<unknown, {}, IFewShotExample, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<IFewShotExample & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & import("mongoose").HydratedDocumentOverrides<{
        id: string;
    }>> | undefined;
    deleted_at?: import("mongoose").SchemaDefinitionProperty<Date | null, IFewShotExample, Document<unknown, {}, IFewShotExample, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<IFewShotExample & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & import("mongoose").HydratedDocumentOverrides<{
        id: string;
    }>> | undefined;
    created_at?: import("mongoose").SchemaDefinitionProperty<Date, IFewShotExample, Document<unknown, {}, IFewShotExample, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<IFewShotExample & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & import("mongoose").HydratedDocumentOverrides<{
        id: string;
    }>> | undefined;
    updated_at?: import("mongoose").SchemaDefinitionProperty<Date, IFewShotExample, Document<unknown, {}, IFewShotExample, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<IFewShotExample & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & import("mongoose").HydratedDocumentOverrides<{
        id: string;
    }>> | undefined;
}, IFewShotExample>;
