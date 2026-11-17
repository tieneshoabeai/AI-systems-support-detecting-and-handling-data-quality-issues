import { isCsvFile, storageKeyForDataset } from '../value-objects/dataset-limits.vo';
export { isCsvFile, storageKeyForDataset };
export interface DatasetColumnProps {
    key: string;
    index: number;
    name: string;
}
export interface DatasetProps {
    id: string;
    projectId: string;
    name: string;
    fileName: string;
    columns: DatasetColumnProps[];
}
export declare class Dataset {
    private readonly props;
    private constructor();
    static create(props: DatasetProps): Dataset;
    static columnKeys(count: number): string[];
    assertIngestible(): void;
}
