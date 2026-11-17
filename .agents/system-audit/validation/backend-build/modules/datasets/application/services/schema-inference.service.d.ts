import type { DatasetColumnIssueRecord, DatasetColumnRecord } from '../../domain/ports/dataset.repository.port';
export interface InferredSchema {
    columns: DatasetColumnRecord[];
    issues: DatasetColumnIssueRecord[];
}
export declare class SchemaInferenceService {
    inferSchema(headers: string[], sampleRows: Record<string, unknown>[]): DatasetColumnRecord[];
    inferSchemaWithIssues(headers: string[], sampleRows: Record<string, unknown>[]): InferredSchema;
    detectColumnIssues(headers: string[]): DatasetColumnIssueRecord[];
    private isNullOrEmpty;
    private detectDataType;
    private isBooleanString;
    private isNumericString;
    private isDateString;
}
