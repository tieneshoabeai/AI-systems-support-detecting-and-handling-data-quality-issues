"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DatasetsController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const busboy_1 = __importDefault(require("busboy"));
const datasets_service_1 = require("../../application/datasets.service");
const audit_service_1 = require("../../../audit/application/audit.service");
const current_user_decorator_1 = require("../../../../shared/decorators/current-user.decorator");
const update_dataset_dto_1 = require("./dtos/update-dataset.dto");
const rename_columns_dto_1 = require("./dtos/rename-columns.dto");
const jwt_auth_guard_1 = require("../../../../shared/guards/jwt-auth.guard");
const policies_guard_1 = require("../../../../shared/casl/policies.guard");
const check_policies_decorator_1 = require("../../../../shared/casl/check-policies.decorator");
const actions_enum_1 = require("../../../../shared/casl/actions.enum");
const zod_validation_pipe_1 = require("../../../../shared/pipes/zod-validation.pipe");
const api_zod_decorator_1 = require("../../../../shared/swagger/api-zod.decorator");
let DatasetsController = class DatasetsController {
    datasetsService;
    audit;
    constructor(datasetsService, audit) {
        this.datasetsService = datasetsService;
        this.audit = audit;
    }
    async uploadDataset(projectId, req) {
        return new Promise((resolve, reject) => {
            const bb = (0, busboy_1.default)({ headers: req.headers, limits: { fileSize: 50 * 1024 * 1024 } });
            let fileProcessed = false;
            bb.on('file', (_fieldName, fileStream, info) => {
                const { filename, mimeType } = info;
                fileProcessed = true;
                const contentLength = req.headers['content-length']
                    ? parseInt(req.headers['content-length'], 10)
                    : undefined;
                this.datasetsService
                    .ingestDatasetStream({
                    projectId,
                    fileStream,
                    fileName: filename || 'unnamed_dataset.csv',
                    mimeType,
                    contentLength,
                })
                    .then((dataset) => {
                    resolve({
                        message: 'Tai len va xu ly tap du lieu CSV thanh cong',
                        dataset,
                    });
                })
                    .catch((err) => reject(err));
            });
            bb.on('error', (err) => reject(err));
            bb.on('finish', () => {
                if (!fileProcessed) {
                    reject(new common_1.BadRequestException('Khong tim thay tep dinh kem trong yeu cau'));
                }
            });
            req.pipe(bb);
        });
    }
    async getDatasetByProject(projectId) {
        const dataset = await this.datasetsService.getDatasetByProjectId(projectId);
        return { dataset };
    }
    async getDatasetById(id) {
        const dataset = await this.datasetsService.getDatasetById(id);
        return { dataset };
    }
    async updateDataset(id, dto) {
        const dataset = await this.datasetsService.updateDataset(id, dto);
        return {
            message: 'Cap nhat tap du lieu thanh cong',
            dataset,
        };
    }
    async renameColumns(id, dto) {
        const dataset = await this.datasetsService.renameColumns(id, dto);
        return { dataset };
    }
    async resetColumnNames(id) {
        const dataset = await this.datasetsService.resetColumnNames(id);
        return { dataset };
    }
    async deleteDataset(id) {
        await this.datasetsService.deleteDataset(id);
    }
    async downloadDatasetFile(id, actor, req, res) {
        const file = await this.datasetsService.downloadDatasetFile(id);
        res.setHeader('Content-Type', file.contentType);
        const safe = encodeURIComponent(file.filename).replace(/['()]/g, escape);
        res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${safe}`);
        if (typeof file.fileSizeBytes === 'number' && file.fileSizeBytes > 0) {
            res.setHeader('Content-Length', String(file.fileSizeBytes));
        }
        await this.audit.log({
            actorId: actor?.userId ?? null,
            actorRole: actor?.role ?? null,
            action: 'DATASET_FILE_DOWNLOADED',
            targetType: 'dataset',
            targetId: id,
            workspaceId: file.workspaceId,
            projectId: file.projectId,
            ipAddress: (req.ip ?? null),
            userAgent: (req.headers['user-agent'] ?? null),
            metadata: { datasetId: id, fileSizeBytes: file.fileSizeBytes },
        });
        file.stream.pipe(res);
    }
    async getDatasetSchema(id) {
        const columns = await this.datasetsService.getDatasetSchema(id);
        return { columns };
    }
};
exports.DatasetsController = DatasetsController;
__decorate([
    (0, common_1.Post)('projects/:projectId/datasets/upload'),
    (0, swagger_1.ApiOperation)({ summary: 'F4.1 (Wave 4): Streaming upload file CSV duy nhat (1 file = 1 bang) vao Project' }),
    (0, swagger_1.ApiConsumes)('multipart/form-data'),
    (0, swagger_1.ApiBody)({
        description: 'File CSV duy nhat (field name: file)',
        required: true,
        schema: {
            type: 'object',
            properties: {
                file: { type: 'string', format: 'binary' },
            },
            required: ['file'],
        },
    }),
    (0, check_policies_decorator_1.CheckPolicies)((ability) => ability.can(actions_enum_1.Action.Create, 'Dataset')),
    __param(0, (0, common_1.Param)('projectId')),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], DatasetsController.prototype, "uploadDataset", null);
__decorate([
    (0, common_1.Get)('projects/:projectId/datasets'),
    (0, swagger_1.ApiOperation)({ summary: 'F4.2: Lay thong tin tap du lieu cua du an' }),
    (0, check_policies_decorator_1.CheckPolicies)((ability) => ability.can(actions_enum_1.Action.Read, 'Dataset')),
    __param(0, (0, common_1.Param)('projectId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], DatasetsController.prototype, "getDatasetByProject", null);
__decorate([
    (0, common_1.Get)('datasets/:id'),
    (0, swagger_1.ApiOperation)({ summary: 'F4.3: Xem chi tiet thong tin tap du lieu (khong bao gom storage_key)' }),
    (0, check_policies_decorator_1.CheckPolicies)((ability) => ability.can(actions_enum_1.Action.Read, 'Dataset')),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], DatasetsController.prototype, "getDatasetById", null);
__decorate([
    (0, common_1.Patch)('datasets/:id'),
    (0, swagger_1.ApiOperation)({ summary: 'F4.4: Cap nhat ten tap du lieu' }),
    (0, api_zod_decorator_1.ApiZodBody)(update_dataset_dto_1.UpdateDatasetSchema),
    (0, check_policies_decorator_1.CheckPolicies)((ability) => ability.can(actions_enum_1.Action.Update, 'Dataset')),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)(new zod_validation_pipe_1.ZodValidationPipe(update_dataset_dto_1.UpdateDatasetSchema))),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], DatasetsController.prototype, "updateDataset", null);
__decorate([
    (0, common_1.Patch)('datasets/:id/columns'),
    (0, swagger_1.ApiOperation)({ summary: 'Wave 4: Doi ten cot hien thi - key c{i} bat bien' }),
    (0, api_zod_decorator_1.ApiZodBody)(rename_columns_dto_1.RenameColumnsSchema),
    (0, check_policies_decorator_1.CheckPolicies)((ability) => ability.can(actions_enum_1.Action.Update, 'Dataset')),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)(new zod_validation_pipe_1.ZodValidationPipe(rename_columns_dto_1.RenameColumnsSchema))),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], DatasetsController.prototype, "renameColumns", null);
__decorate([
    (0, common_1.Post)('datasets/:id/columns/reset'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, swagger_1.ApiOperation)({ summary: 'Wave 4 (M15): Khoi phuc ten cot ve ten goc tu file CSV' }),
    (0, check_policies_decorator_1.CheckPolicies)((ability) => ability.can(actions_enum_1.Action.Update, 'Dataset')),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], DatasetsController.prototype, "resetColumnNames", null);
__decorate([
    (0, common_1.Delete)('datasets/:id'),
    (0, common_1.HttpCode)(common_1.HttpStatus.NO_CONTENT),
    (0, swagger_1.ApiOperation)({ summary: 'F4.5: Xoa mem tap du lieu va giai phong du an' }),
    (0, check_policies_decorator_1.CheckPolicies)((ability) => ability.can(actions_enum_1.Action.Delete, 'Dataset')),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], DatasetsController.prototype, "deleteDataset", null);
__decorate([
    (0, common_1.Get)('datasets/:id/file'),
    (0, swagger_1.ApiOperation)({ summary: 'FILE-01: Tải file gốc .csv (stream trực tiếp, có audit log)' }),
    (0, check_policies_decorator_1.CheckPolicies)((ability) => ability.can(actions_enum_1.Action.Read, 'Dataset')),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __param(2, (0, common_1.Req)()),
    __param(3, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Object, Object]),
    __metadata("design:returntype", Promise)
], DatasetsController.prototype, "downloadDatasetFile", null);
__decorate([
    (0, common_1.Get)('datasets/:id/schema'),
    (0, swagger_1.ApiOperation)({ summary: 'F4.6: Xem schema voi key cot on dinh c0..cN' }),
    (0, check_policies_decorator_1.CheckPolicies)((ability) => ability.can(actions_enum_1.Action.Read, 'Dataset')),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], DatasetsController.prototype, "getDatasetSchema", null);
exports.DatasetsController = DatasetsController = __decorate([
    (0, swagger_1.ApiTags)('Datasets'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, policies_guard_1.PoliciesGuard),
    (0, common_1.Controller)(),
    __metadata("design:paramtypes", [datasets_service_1.DatasetsService, audit_service_1.AuditService])
], DatasetsController);
//# sourceMappingURL=datasets.controller.js.map