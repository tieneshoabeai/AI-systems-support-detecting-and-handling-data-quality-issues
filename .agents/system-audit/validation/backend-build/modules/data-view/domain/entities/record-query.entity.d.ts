export interface RecordQueryProps {
    datasetId: string;
    limit: number;
}
export declare class RecordQuery {
    private readonly props;
    private constructor();
    static create(props: RecordQueryProps): RecordQuery;
    get limit(): number;
    static fieldPath(columnKey: string): string;
}
