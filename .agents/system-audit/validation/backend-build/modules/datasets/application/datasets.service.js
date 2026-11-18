"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var DatasetsService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.DatasetsService = void 0;
const common_1 = require("@nestjs/common");
const stream_1 = require("stream");
const fastCsv = __importStar(require("fast-csv"));
const crypto = __importStar(require("crypto"));
const dataset_repository_port_1 = require("../domain/ports/dataset.repository.port");
const projects_service_1 = require("../../projects/application/projects.service");
const workspaces_service_1 = require("../../workspaces/application/workspaces.service");
const config_1 = require("@nestjs/config");
const storage_port_1 = require("../../../shared/ports/storage.port");
const outbox_port_1 = require("../../../shared/ports/outbox.port");
const schema_inference_service_1 = require("./services/schema-inference.service");
const dataset_limits_vo_1 = require("../domain/value-objects/dataset-limits.vo");
const object_id_util_1 = require("../../../shared/utils/object-id.util");
function validationError(message, details) {
    return new common_1.BadRequestException({
        message,
        error: 'VALIDATION_ERROR',
        details,
    });
}
function unsupportedFileType(fileName) {
    return new common_1.BadRequestException({
        message: `Chi ho tro file .csv (nhan duoc: ${fileName})`,
        error: 'UNSUPPORTED_FILE_TYPE',
    });
}
function assertCsvMagicBytes(head, fileName) {
    if (head.length === 0)
        return;
    if (head.length >= 4 && head[0] === 0x50 && head[1] === 0x4b) {
        throw new common_1.BadRequestException({
            message: 'File Excel không được chấp nhận. Vui lòng xuất sang CSV.',
            error: 'VALIDATION_ERROR',
            details: { reason: 'excel_not_allowed', fileName },
        });
    }
    if (head.length >= 8 && head[0] === 0xd0 && head[1] === 0xcf && head[2] === 0x11 && head[3] === 0xe0) {
        throw new common_1.BadRequestException({
            message: 'File Excel có mật khẩu không được hỗ trợ.',
            error: 'VALIDATION_ERROR',
            details: { reason: 'password_protected', fileName },
        });
    }
    const nul = head.includes(0x00);
    if (nul) {
        throw new common_1.BadRequestException({
            message: `Chi ho tro file .csv (nhan duoc: ${fileName})`,
            error: 'UNSUPPORTED_FILE_TYPE',
            details: { reason: 'binary_not_csv', fileName },
        });
    }
}
function newHexId() {
    return crypto.randomBytes(12).toString('hex');
}
let DatasetsService = DatasetsService_1 = class DatasetsService {
    datasets;
    projectsService;
    storage;
    outbox;
    schemaInferenceService;
    workspacesService;
    configService;
    logger = new common_1.Logger(DatasetsService_1.name);
    constructor(datasets, projectsService, storage, outbox, schemaInferenceService, workspacesService, configService) {
        this.datasets = datasets;
        this.projectsService = projectsService;
        this.storage = storage;
        this.outbox = outbox;
        this.schemaInferenceService = schemaInferenceService;
        this.workspacesService = workspacesService;
        this.configService = configService;
    }
    async ingestDatasetStream(params) {
        const { projectId, fileStream, fileName, mimeType, contentLength = 0 } = params;
        try {
            (0, dataset_limits_vo_1.assertCsvFile)(fileName);
        }
        catch {
            throw unsupportedFileType(fileName);
        }
        if (typeof mimeType === 'string' && /excel|spreadsheet|officedocument|ms-excel/i.test(mimeType)) {
            throw new common_1.BadRequestException({
                message: 'File Excel không được chấp nhận. Vui lòng xuất sang CSV.',
                error: 'VALIDATION_ERROR',
                details: { reason: 'excel_not_allowed', mimeType, fileName },
            });
        }
        if (contentLength > dataset_limits_vo_1.MAX_FILE_BYTES) {
            throw new common_1.PayloadTooLargeException({
                message: `File vuot qua gioi han 50MB (nhan duoc ${contentLength} bytes)`,
                error: 'FILE_TOO_LARGE',
            });
        }
        const project = await this.projectsService.getProjectById(projectId);
        if (project.hasDataset) {
            throw new common_1.ConflictException('Moi Project chi duoc phep lien ket toi da 1 Dataset hoat dong. Vui long xoa hoac luu tru Dataset hien tai truoc khi tai len du lieu moi.');
        }
        if (contentLength > 0) {
            const quota = await this.storage.checkUploadQuota(contentLength);
            if (!quota.allowed) {
                throw new common_1.PayloadTooLargeException('Dung luong luu tru vuot qua gioi han 10GB cua Cloudflare R2 (Hard Block 100%).');
            }
            const wsQuota = Number(this.configService.get('WORKSPACE_STORAGE_QUOTA_BYTES', 524288000));
            await this.workspacesService.checkWorkspaceUploadQuota(project.workspaceId, contentLength, wsQuota);
        }
        const datasetId = newHexId();
        const datasetName = (0, dataset_limits_vo_1.datasetNameFromFile)(fileName);
        const storageKey = (0, dataset_limits_vo_1.storageKeyForDataset)(datasetId);
        const initialDataset = await this.datasets.create({
            projectId: project.id,
            workspaceId: project.workspaceId,
            name: datasetName,
            originalFileName: fileName,
            fileFormat: 'csv',
            fileSizeBytes: contentLength,
            fileChecksum: 'calculating...',
            storageKey,
            rowCount: 0,
            columnCount: 0,
            columns: [],
            columnIssues: [],
            hasHeader: true,
            delimiter: ',',
            status: 'INGESTING',
            currentVersion: 1,
        });
        const hashStream = crypto.createHash('sha256');
        const uploadPassThrough = new stream_1.PassThrough();
        const parsePassThrough = new stream_1.PassThrough();
        let bytesTransferred = 0;
        let uploadFailed = false;
        let headChecked = false;
        let headAcc = Buffer.alloc(0);
        let magicError = null;
        fileStream.on('data', (chunk) => {
            if (magicError)
                return;
            const buf = typeof chunk === 'string' ? Buffer.from(chunk, 'utf-8') : chunk;
            if (!headChecked) {
                headAcc = Buffer.concat([headAcc, buf]).subarray(0, 32);
                if (headAcc.length >= 8) {
                    try {
                        assertCsvMagicBytes(headAcc, fileName);
                    }
                    catch (e) {
                        magicError = e;
                        uploadFailed = true;
                        uploadPassThrough.destroy(e);
                        parsePassThrough.destroy(e);
                        fileStream.destroy(e);
                        return;
                    }
                    headChecked = true;
                }
            }
            bytesTransferred += buf.length;
            if (bytesTransferred > dataset_limits_vo_1.MAX_FILE_BYTES) {
                uploadFailed = true;
                const err = new common_1.PayloadTooLargeException({
                    message: 'File vuot qua gioi han 50MB trong luc tai len',
                    error: 'FILE_TOO_LARGE',
                });
                uploadPassThrough.destroy(err);
                parsePassThrough.destroy(err);
                fileStream.destroy(err);
                return;
            }
            hashStream.update(buf);
            uploadPassThrough.write(buf);
            parsePassThrough.write(buf);
        });
        fileStream.on('end', () => {
            if (!headChecked && !magicError && headAcc.length > 0) {
                try {
                    assertCsvMagicBytes(headAcc, fileName);
                }
                catch (e) {
                    magicError = e;
                    uploadFailed = true;
                    uploadPassThrough.destroy(e);
                    parsePassThrough.destroy(e);
                    return;
                }
                headChecked = true;
            }
            uploadPassThrough.end();
            parsePassThrough.end();
        });
        fileStream.on('error', (err) => {
            const e = err instanceof Error ? err : new Error(String(err));
            uploadPassThrough.destroy(e);
            parsePassThrough.destroy(e);
        });
        const cleanupOnFailure = async () => {
            try {
                await this.storage.deleteFile(storageKey);
            }
            catch { }
            try {
                await this.datasets.softDeleteDatasetWithRecords(datasetId);
            }
            catch { }
        };
        try {
            if (magicError)
                throw magicError;
            const uploadPromise = this.storage.uploadStream(storageKey, uploadPassThrough, mimeType);
            const parsePromise = this.processCsvStream(datasetId, parsePassThrough);
            const [, { totalRows, headers, sampleRows }] = await Promise.all([
                uploadPromise,
                parsePromise,
            ]);
            if (uploadFailed || bytesTransferred > dataset_limits_vo_1.MAX_FILE_BYTES) {
                throw new common_1.PayloadTooLargeException({
                    message: 'File vuot qua gioi han 50MB',
                    error: 'FILE_TOO_LARGE',
                });
            }
            if (headers.length > dataset_limits_vo_1.MAX_COLUMNS) {
                throw validationError(`So cot vuot qua gioi han ${dataset_limits_vo_1.MAX_COLUMNS} (nhan duoc ${headers.length})`, { reason: 'too_many_columns', column_count: headers.length });
            }
            if (headers.length === 0) {
                throw validationError('File CSV khong co header', { reason: 'missing_header' });
            }
            const { columns, issues } = this.schemaInferenceService.inferSchemaWithIssues(headers, sampleRows);
            const fileChecksum = `sha256:${hashStream.digest('hex')}`;
            const finalDataset = await this.datasets.updateById(datasetId, {
                fileChecksum,
                fileSizeBytes: bytesTransferred,
                rowCount: totalRows,
                columnCount: columns.length,
                columns,
                columnIssues: issues,
                status: 'READY',
            });
            await this.projectsService.setHasDataset(projectId, true);
            await this.workspacesService.incrementStorageUsed(project.workspaceId, bytesTransferred);
            await this.outbox.recordEvent({
                aggregate_type: 'DATASET',
                aggregate_id: datasetId,
                event_type: 'DATASET_INGESTED',
                payload: {
                    dataset_id: datasetId,
                    project_id: projectId,
                    workspace_id: project.workspaceId,
                    row_count: totalRows,
                    column_count: columns.length,
                    file_checksum: fileChecksum,
                },
            });
            this.logger.log(`Hoan tat ingestion CSV: ${datasetName} (${datasetId}) - ${totalRows} dong x ${columns.length} cot`);
            return finalDataset ?? initialDataset;
        }
        catch (err) {
            await cleanupOnFailure();
            try {
                await this.datasets.updateById(datasetId, { status: 'FAILED' });
            }
            catch { }
            const msg = err instanceof Error ? err.message : String(err);
            this.logger.error(`That bai ingestion dataset ${datasetId}: ${msg}`);
            throw err;
        }
    }
    async processCsvStream(datasetId, stream) {
        return new Promise((resolve, reject) => {
            let totalRows = 0;
            let headers = [];
            const sampleRows = [];
            let currentBatch = [];
            const csvStream = fastCsv.parse({ headers: true, trim: false });
            const flushBatch = async () => {
                if (currentBatch.length > 0) {
                    const batchToInsert = currentBatch;
                    currentBatch = [];
                    await this.datasets.bulkInsertRecords(batchToInsert);
                }
            };
            csvStream.on('headers', (parsedHeaders) => {
                headers = parsedHeaders;
            });
            csvStream.on('data', (row) => {
                const rowIndex = totalRows;
                totalRows++;
                if (sampleRows.length < dataset_limits_vo_1.SAMPLE_ROWS_CAP) {
                    sampleRows.push(row);
                }
                const props = {};
                headers.forEach((h, i) => {
                    const raw = row[h];
                    props[`c${i}`] = raw === '' || raw === undefined ? null : raw;
                });
                currentBatch.push({ datasetId, rowIndex, props });
                if (currentBatch.length >= dataset_limits_vo_1.IMPORT_BATCH_SIZE) {
                    csvStream.pause();
                    flushBatch()
                        .then(() => csvStream.resume())
                        .catch((err) => csvStream.destroy(err));
                }
            });
            csvStream.on('end', () => {
                flushBatch().then(() => resolve({ totalRows, headers, sampleRows })).catch((err) => reject(err));
            });
            csvStream.on('error', (err) => reject(err));
            stream.pipe(csvStream);
        });
    }
    async getDatasetById(id) {
        if (!(0, object_id_util_1.isObjectIdHex)(id)) {
            throw new common_1.BadRequestException('ID Tap du lieu khong hop le');
        }
        const dataset = await this.datasets.findById(id);
        if (!dataset) {
            throw new common_1.NotFoundException('Khong tim thay tap du lieu hoac tap du lieu da bi xoa');
        }
        const { storageKey: _sk, ...safe } = dataset;
        void _sk;
        return safe;
    }
    async getDatasetByProjectId(projectId) {
        if (!(0, object_id_util_1.isObjectIdHex)(projectId)) {
            throw new common_1.BadRequestException('ID Du an khong hop le');
        }
        const found = await this.datasets.findByProject(projectId);
        if (!found)
            return null;
        const { storageKey: _sk2, ...safe } = found;
        void _sk2;
        return safe;
    }
    async downloadDatasetFile(id) {
        if (!(0, object_id_util_1.isObjectIdHex)(id))
            throw new common_1.BadRequestException('ID Tap du lieu khong hop le');
        const dataset = await this.datasets.findById(id);
        if (!dataset)
            throw new common_1.NotFoundException('Khong tim thay tap du lieu hoac tap du lieu da bi xoa');
        if (!dataset.storageKey)
            throw new common_1.NotFoundException('Khong tim thay file goc cua tap du lieu');
        const stream = await this.storage.downloadStream(dataset.storageKey);
        const filename = dataset.originalFileName?.endsWith('.csv') ? dataset.originalFileName : `${dataset.originalFileName || dataset.name}.csv`;
        return {
            stream,
            filename,
            fileSizeBytes: dataset.fileSizeBytes ?? 0,
            contentType: 'text/csv; charset=utf-8',
            workspaceId: dataset.workspaceId,
            projectId: dataset.projectId,
        };
    }
    async getDatasetSchema(id) {
        const dataset = await this.getDatasetById(id);
        return dataset.columns;
    }
    async updateDataset(id, dto) {
        await this.getDatasetById(id);
        const updated = await this.datasets.updateById(id, { name: dto.name });
        if (!updated) {
            throw new common_1.NotFoundException('Khong tim thay tap du lieu de cap nhat');
        }
        return updated;
    }
    async renameColumns(id, dto) {
        const dataset = await this.datasets.findById(id);
        if (!dataset) {
            throw new common_1.NotFoundException('Khong tim thay tap du lieu hoac tap du lieu da bi xoa');
        }
        const byKey = new Map(dataset.columns.map((c) => [c.key, c]));
        for (const r of dto.columns) {
            const col = byKey.get(r.key);
            if (!col) {
                throw validationError(`Cot khong ton tai: ${r.key}`, { reason: 'unknown_column_key', key: r.key });
            }
            col.name = r.name;
        }
        const names = dataset.columns.map((c) => c.name);
        const issues = this.schemaInferenceService.detectColumnIssues(names).map((iss) => {
            if (!iss.columnKey)
                return iss;
            const idx = Number(String(iss.columnKey).replace('c', ''));
            const realKey = dataset.columns[idx]?.key ?? iss.columnKey;
            return { ...iss, columnKey: realKey };
        });
        const updated = await this.datasets.updateById(id, {
            columns: dataset.columns,
            columnIssues: issues,
        });
        if (!updated)
            throw new common_1.NotFoundException('Khong tim thay tap du lieu de cap nhat');
        return updated;
    }
    async resetColumnNames(id) {
        const dataset = await this.datasets.findById(id);
        if (!dataset) {
            throw new common_1.NotFoundException('Khong tim thay tap du lieu hoac tap du lieu da bi xoa');
        }
        for (const c of dataset.columns) {
            c.name = c.originalName;
        }
        const updated = await this.datasets.updateById(id, {
            columns: dataset.columns,
            columnIssues: [],
        });
        if (!updated)
            throw new common_1.NotFoundException('Khong tim thay tap du lieu de cap nhat');
        return updated;
    }
    mapPropsToOriginalNames(columns, props) {
        const out = {};
        for (const c of columns) {
            out[c.originalName] = props[c.key] ?? null;
        }
        return out;
    }
    async deleteDataset(id) {
        const raw = await this.datasets.findById(id);
        if (!raw) {
            throw new common_1.NotFoundException('Khong tim thay tap du lieu hoac tap du lieu da bi xoa');
        }
        const deleted = await this.datasets.softDeleteDatasetWithRecords(id);
        await this.projectsService.setHasDataset(raw.projectId, false);
        await this.workspacesService.incrementStorageUsed(raw.workspaceId, -(raw.fileSizeBytes ?? 0));
        this.logger.log(`Da xoa mem Dataset ID: ${id}`);
        return deleted;
    }
};
exports.DatasetsService = DatasetsService;
exports.DatasetsService = DatasetsService = DatasetsService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(dataset_repository_port_1.DATASET_REPOSITORY_PORT)),
    __param(2, (0, common_1.Inject)(storage_port_1.STORAGE_PORT)),
    __param(3, (0, common_1.Inject)(outbox_port_1.OUTBOX_PORT)),
    __metadata("design:paramtypes", [Object, projects_service_1.ProjectsService, Object, Object, schema_inference_service_1.SchemaInferenceService, workspaces_service_1.WorkspacesService, config_1.ConfigService])
], DatasetsService);
//# sourceMappingURL=datasets.service.js.map