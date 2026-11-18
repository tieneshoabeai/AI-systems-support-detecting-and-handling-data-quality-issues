"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SAMPLE_ROWS_CAP = exports.IMPORT_BATCH_SIZE = exports.MAX_COLUMNS = exports.MAX_FILE_BYTES = void 0;
exports.isCsvFile = isCsvFile;
exports.assertCsvFile = assertCsvFile;
exports.assertColumnLimit = assertColumnLimit;
exports.assertFileSize = assertFileSize;
exports.datasetNameFromFile = datasetNameFromFile;
exports.storageKeyForDataset = storageKeyForDataset;
exports.MAX_FILE_BYTES = 50 * 1024 * 1024;
exports.MAX_COLUMNS = 1000;
exports.IMPORT_BATCH_SIZE = 5000;
exports.SAMPLE_ROWS_CAP = 500;
function isCsvFile(fileName) {
    return fileName.toLowerCase().endsWith('.csv');
}
function assertCsvFile(fileName) {
    if (!isCsvFile(fileName)) {
        throw new Error(`Chi ho tro file .csv (nhan duoc: ${fileName})`);
    }
}
function assertColumnLimit(columnCount) {
    if (columnCount > exports.MAX_COLUMNS) {
        throw new Error(`So cot vuot qua gioi han ${exports.MAX_COLUMNS} (nhan duoc ${columnCount})`);
    }
}
function assertFileSize(contentLength) {
    if (contentLength > exports.MAX_FILE_BYTES) {
        throw new Error(`File vuot qua gioi han ${exports.MAX_FILE_BYTES} bytes`);
    }
}
function datasetNameFromFile(fileName) {
    return fileName.replace(/\.[^/.]+$/, '') || 'dataset';
}
function storageKeyForDataset(datasetId) {
    return `raw_files/${datasetId}.csv`;
}
//# sourceMappingURL=dataset-limits.vo.js.map