export declare const DATASET_EVENTS: {
    readonly INGESTED: 'dataset.ingested';
    readonly FAILED: 'dataset.failed';
    readonly RENAMED: 'dataset.renamed';
};
export type DatasetEventName = (typeof DATASET_EVENTS)[keyof typeof DATASET_EVENTS];
