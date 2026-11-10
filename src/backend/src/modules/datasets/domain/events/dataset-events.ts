export const DATASET_EVENTS = {
  INGESTED: 'dataset.ingested',
  FAILED: 'dataset.failed',
  RENAMED: 'dataset.renamed',
} as const;

export type DatasetEventName = (typeof DATASET_EVENTS)[keyof typeof DATASET_EVENTS];
