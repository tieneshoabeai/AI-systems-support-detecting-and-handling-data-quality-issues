export const MAX_FILE_BYTES = 50 * 1024 * 1024;

export const MAX_COLUMNS = 1000;

export const IMPORT_BATCH_SIZE = 5000;

export const SAMPLE_ROWS_CAP = 500;

export function isCsvFile(fileName: string): boolean {
  return fileName.toLowerCase().endsWith('.csv');
}

export function assertCsvFile(fileName: string): void {
  if (!isCsvFile(fileName)) {
    throw new Error(`Chi ho tro file .csv (nhan duoc: ${fileName})`);
  }
}

export function assertColumnLimit(columnCount: number): void {
  if (columnCount > MAX_COLUMNS) {
    throw new Error(`So cot vuot qua gioi han ${MAX_COLUMNS} (nhan duoc ${columnCount})`);
  }
}

export function assertFileSize(contentLength: number): void {
  if (contentLength > MAX_FILE_BYTES) {
    throw new Error(`File vuot qua gioi han ${MAX_FILE_BYTES} bytes`);
  }
}

export function datasetNameFromFile(fileName: string): string {
  return fileName.replace(/\.[^/.]+$/, '') || 'dataset';
}

export function storageKeyForDataset(datasetId: string): string {
  return `raw_files/${datasetId}.csv`;
}
