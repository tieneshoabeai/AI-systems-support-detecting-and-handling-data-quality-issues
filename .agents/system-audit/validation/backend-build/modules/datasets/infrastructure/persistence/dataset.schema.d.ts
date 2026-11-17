import { Schema, Document, Types } from 'mongoose';
import { BaseEntity } from '../../../../shared/database/base-mongo.repository';
export type ColumnDataType = 'string' | 'number' | 'boolean' | 'date';
export interface IColumnDefinition {
    key: string;
    index: number;
    name: string;
    data_type: ColumnDataType;
    original_name: string;
    missing_count: number;
    is_pii: boolean;
}
export interface IColumnIssue {
    column_key: string | null;
    issue: 'empty_name' | 'duplicate_name' | 'whitespace_only';
    message: string;
}
export interface IDataset extends Document, BaseEntity {
    _id: Types.ObjectId;
    project_id: Types.ObjectId;
    workspace_id: Types.ObjectId;
    name: string;
    original_file_name: string;
    file_format: 'csv';
    file_size_bytes: number;
    file_checksum: string;
    storage_key: string;
    row_count: number;
    column_count: number;
    columns: IColumnDefinition[];
    column_issues: IColumnIssue[];
    has_header: boolean;
    delimiter: ',' | ';' | '\t' | '|';
    current_version: number;
    status: 'INGESTING' | 'READY' | 'FAILED';
    deleted_at: Date | null;
    created_at: Date;
    updated_at: Date;
}
export declare const ColumnDefinitionSchema: Schema<IColumnDefinition, import("mongoose").Model<IColumnDefinition, any, any, any, any, any, IColumnDefinition & {
    _id: Types.ObjectId;
} & {
    __v: number;
}>, {}, {}, {}, {}, import("mongoose").DefaultSchemaOptions, IColumnDefinition, Document<unknown, {}, IColumnDefinition, {
    id: string;
}, import("mongoose").DefaultSchemaOptions> & Omit<IColumnDefinition & {
    _id: Types.ObjectId;
} & {
    __v: number;
}, "id"> & import("mongoose").HydratedDocumentOverrides<{
    id: string;
}>, {
    key?: import("mongoose").SchemaDefinitionProperty<string, IColumnDefinition, Document<unknown, {}, IColumnDefinition, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<IColumnDefinition & {
        _id: Types.ObjectId;
    } & {
        __v: number;
    }, "id"> & import("mongoose").HydratedDocumentOverrides<{
        id: string;
    }>> | undefined;
    index?: import("mongoose").SchemaDefinitionProperty<number, IColumnDefinition, Document<unknown, {}, IColumnDefinition, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<IColumnDefinition & {
        _id: Types.ObjectId;
    } & {
        __v: number;
    }, "id"> & import("mongoose").HydratedDocumentOverrides<{
        id: string;
    }>> | undefined;
    name?: import("mongoose").SchemaDefinitionProperty<string, IColumnDefinition, Document<unknown, {}, IColumnDefinition, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<IColumnDefinition & {
        _id: Types.ObjectId;
    } & {
        __v: number;
    }, "id"> & import("mongoose").HydratedDocumentOverrides<{
        id: string;
    }>> | undefined;
    data_type?: import("mongoose").SchemaDefinitionProperty<ColumnDataType, IColumnDefinition, Document<unknown, {}, IColumnDefinition, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<IColumnDefinition & {
        _id: Types.ObjectId;
    } & {
        __v: number;
    }, "id"> & import("mongoose").HydratedDocumentOverrides<{
        id: string;
    }>> | undefined;
    original_name?: import("mongoose").SchemaDefinitionProperty<string, IColumnDefinition, Document<unknown, {}, IColumnDefinition, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<IColumnDefinition & {
        _id: Types.ObjectId;
    } & {
        __v: number;
    }, "id"> & import("mongoose").HydratedDocumentOverrides<{
        id: string;
    }>> | undefined;
    missing_count?: import("mongoose").SchemaDefinitionProperty<number, IColumnDefinition, Document<unknown, {}, IColumnDefinition, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<IColumnDefinition & {
        _id: Types.ObjectId;
    } & {
        __v: number;
    }, "id"> & import("mongoose").HydratedDocumentOverrides<{
        id: string;
    }>> | undefined;
    is_pii?: import("mongoose").SchemaDefinitionProperty<boolean, IColumnDefinition, Document<unknown, {}, IColumnDefinition, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<IColumnDefinition & {
        _id: Types.ObjectId;
    } & {
        __v: number;
    }, "id"> & import("mongoose").HydratedDocumentOverrides<{
        id: string;
    }>> | undefined;
}, IColumnDefinition>;
export declare const ColumnIssueSchema: Schema<IColumnIssue, import("mongoose").Model<IColumnIssue, any, any, any, any, any, IColumnIssue & {
    _id: Types.ObjectId;
} & {
    __v: number;
}>, {}, {}, {}, {}, import("mongoose").DefaultSchemaOptions, IColumnIssue, Document<unknown, {}, IColumnIssue, {
    id: string;
}, import("mongoose").DefaultSchemaOptions> & Omit<IColumnIssue & {
    _id: Types.ObjectId;
} & {
    __v: number;
}, "id"> & import("mongoose").HydratedDocumentOverrides<{
    id: string;
}>, {
    column_key?: import("mongoose").SchemaDefinitionProperty<string | null, IColumnIssue, Document<unknown, {}, IColumnIssue, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<IColumnIssue & {
        _id: Types.ObjectId;
    } & {
        __v: number;
    }, "id"> & import("mongoose").HydratedDocumentOverrides<{
        id: string;
    }>> | undefined;
    issue?: import("mongoose").SchemaDefinitionProperty<"duplicate_name" | "empty_name" | "whitespace_only", IColumnIssue, Document<unknown, {}, IColumnIssue, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<IColumnIssue & {
        _id: Types.ObjectId;
    } & {
        __v: number;
    }, "id"> & import("mongoose").HydratedDocumentOverrides<{
        id: string;
    }>> | undefined;
    message?: import("mongoose").SchemaDefinitionProperty<string, IColumnIssue, Document<unknown, {}, IColumnIssue, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<IColumnIssue & {
        _id: Types.ObjectId;
    } & {
        __v: number;
    }, "id"> & import("mongoose").HydratedDocumentOverrides<{
        id: string;
    }>> | undefined;
}, IColumnIssue>;
export declare const DatasetSchema: Schema<IDataset, import("mongoose").Model<IDataset, any, any, any, any, any, IDataset & Required<{
    _id: Types.ObjectId;
}> & {
    __v: number;
}>, {}, {}, {}, {}, import("mongoose").DefaultSchemaOptions, IDataset, Document<unknown, {}, IDataset, {
    id: string;
}, import("mongoose").DefaultSchemaOptions> & Omit<IDataset & Required<{
    _id: Types.ObjectId;
}> & {
    __v: number;
}, "id"> & import("mongoose").HydratedDocumentOverrides<{
    id: string;
}>, {
    _id?: import("mongoose").SchemaDefinitionProperty<Types.ObjectId, IDataset, Document<unknown, {}, IDataset, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<IDataset & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & import("mongoose").HydratedDocumentOverrides<{
        id: string;
    }>> | undefined;
    project_id?: import("mongoose").SchemaDefinitionProperty<Types.ObjectId, IDataset, Document<unknown, {}, IDataset, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<IDataset & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & import("mongoose").HydratedDocumentOverrides<{
        id: string;
    }>> | undefined;
    workspace_id?: import("mongoose").SchemaDefinitionProperty<Types.ObjectId, IDataset, Document<unknown, {}, IDataset, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<IDataset & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & import("mongoose").HydratedDocumentOverrides<{
        id: string;
    }>> | undefined;
    name?: import("mongoose").SchemaDefinitionProperty<string, IDataset, Document<unknown, {}, IDataset, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<IDataset & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & import("mongoose").HydratedDocumentOverrides<{
        id: string;
    }>> | undefined;
    original_file_name?: import("mongoose").SchemaDefinitionProperty<string, IDataset, Document<unknown, {}, IDataset, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<IDataset & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & import("mongoose").HydratedDocumentOverrides<{
        id: string;
    }>> | undefined;
    file_format?: import("mongoose").SchemaDefinitionProperty<"csv", IDataset, Document<unknown, {}, IDataset, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<IDataset & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & import("mongoose").HydratedDocumentOverrides<{
        id: string;
    }>> | undefined;
    file_size_bytes?: import("mongoose").SchemaDefinitionProperty<number, IDataset, Document<unknown, {}, IDataset, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<IDataset & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & import("mongoose").HydratedDocumentOverrides<{
        id: string;
    }>> | undefined;
    file_checksum?: import("mongoose").SchemaDefinitionProperty<string, IDataset, Document<unknown, {}, IDataset, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<IDataset & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & import("mongoose").HydratedDocumentOverrides<{
        id: string;
    }>> | undefined;
    storage_key?: import("mongoose").SchemaDefinitionProperty<string, IDataset, Document<unknown, {}, IDataset, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<IDataset & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & import("mongoose").HydratedDocumentOverrides<{
        id: string;
    }>> | undefined;
    row_count?: import("mongoose").SchemaDefinitionProperty<number, IDataset, Document<unknown, {}, IDataset, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<IDataset & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & import("mongoose").HydratedDocumentOverrides<{
        id: string;
    }>> | undefined;
    column_count?: import("mongoose").SchemaDefinitionProperty<number, IDataset, Document<unknown, {}, IDataset, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<IDataset & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & import("mongoose").HydratedDocumentOverrides<{
        id: string;
    }>> | undefined;
    columns?: import("mongoose").SchemaDefinitionProperty<IColumnDefinition[], IDataset, Document<unknown, {}, IDataset, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<IDataset & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & import("mongoose").HydratedDocumentOverrides<{
        id: string;
    }>> | undefined;
    column_issues?: import("mongoose").SchemaDefinitionProperty<IColumnIssue[], IDataset, Document<unknown, {}, IDataset, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<IDataset & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & import("mongoose").HydratedDocumentOverrides<{
        id: string;
    }>> | undefined;
    has_header?: import("mongoose").SchemaDefinitionProperty<boolean, IDataset, Document<unknown, {}, IDataset, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<IDataset & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & import("mongoose").HydratedDocumentOverrides<{
        id: string;
    }>> | undefined;
    delimiter?: import("mongoose").SchemaDefinitionProperty<"\t" | "," | ";" | "|", IDataset, Document<unknown, {}, IDataset, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<IDataset & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & import("mongoose").HydratedDocumentOverrides<{
        id: string;
    }>> | undefined;
    current_version?: import("mongoose").SchemaDefinitionProperty<number, IDataset, Document<unknown, {}, IDataset, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<IDataset & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & import("mongoose").HydratedDocumentOverrides<{
        id: string;
    }>> | undefined;
    status?: import("mongoose").SchemaDefinitionProperty<"FAILED" | "INGESTING" | "READY", IDataset, Document<unknown, {}, IDataset, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<IDataset & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & import("mongoose").HydratedDocumentOverrides<{
        id: string;
    }>> | undefined;
    deleted_at?: import("mongoose").SchemaDefinitionProperty<Date | null, IDataset, Document<unknown, {}, IDataset, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<IDataset & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & import("mongoose").HydratedDocumentOverrides<{
        id: string;
    }>> | undefined;
    created_at?: import("mongoose").SchemaDefinitionProperty<Date, IDataset, Document<unknown, {}, IDataset, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<IDataset & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & import("mongoose").HydratedDocumentOverrides<{
        id: string;
    }>> | undefined;
    updated_at?: import("mongoose").SchemaDefinitionProperty<Date, IDataset, Document<unknown, {}, IDataset, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<IDataset & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & import("mongoose").HydratedDocumentOverrides<{
        id: string;
    }>> | undefined;
}, IDataset>;
