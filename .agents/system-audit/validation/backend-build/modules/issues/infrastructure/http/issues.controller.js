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
exports.IssuesController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const jwt_auth_guard_1 = require("../../../../shared/guards/jwt-auth.guard");
const roles_guard_1 = require("../../../../shared/guards/roles.guard");
const roles_decorator_1 = require("../../../../shared/decorators/roles.decorator");
const current_user_decorator_1 = require("../../../../shared/decorators/current-user.decorator");
const zod_validation_pipe_1 = require("../../../../shared/pipes/zod-validation.pipe");
const api_zod_decorator_1 = require("../../../../shared/swagger/api-zod.decorator");
const issues_service_1 = require("../../application/issues.service");
const audit_service_1 = require("../../../audit/application/audit.service");
const busboy_1 = __importDefault(require("busboy"));
const stream_1 = require("stream");
const create_issue_dto_1 = require("./dtos/create-issue.dto");
let IssuesController = class IssuesController {
    issuesService;
    audit;
    constructor(issuesService, audit) {
        this.issuesService = issuesService;
        this.audit = audit;
    }
    async createReport(user, dto) {
        return this.issuesService.createReport(user.userId, dto);
    }
    async listMine(user, query) {
        return this.issuesService.listMine(user.userId, query);
    }
    async uploadAttachment(user, id, req) {
        const file = await new Promise((resolve, reject) => {
            const bb = (0, busboy_1.default)({ headers: req.headers, limits: { fileSize: 10 * 1024 * 1024 } });
            let done = false;
            bb.on('file', (_field, stream, info) => {
                const chunks = [];
                let size = 0;
                stream.on('data', (c) => { size += c.length; chunks.push(c); });
                stream.on('end', () => {
                    done = true;
                    resolve({ filename: info.filename || 'attachment', mimeType: info.mimeType, size, stream: stream_1.Readable.from(Buffer.concat(chunks)) });
                });
                stream.on('error', (e) => reject(e));
            });
            bb.on('error', (e) => reject(e));
            bb.on('finish', () => { if (!done)
                reject(new common_1.BadRequestException('Không tìm thấy tệp đính kèm trong yêu cầu')); });
            req.pipe(bb);
        });
        const result = await this.issuesService.uploadAttachment(user.userId, user.role, id, file);
        await this.audit.log({
            actorId: user.userId,
            actorRole: user.role,
            action: 'ISSUE_ATTACHMENT_UPLOADED',
            targetType: 'issue_report',
            targetId: id,
            ipAddress: (req.ip ?? null),
            userAgent: (req.headers['user-agent'] ?? null),
            metadata: { filename: file.filename, sizeBytes: file.size, contentType: file.mimeType },
        });
        return result;
    }
    async downloadAttachment(user, id, attachmentId, req, res) {
        const file = await this.issuesService.downloadAttachment(user.userId, user.role, id, attachmentId);
        res.setHeader('Content-Type', file.contentType);
        const safe = encodeURIComponent(file.filename).replace(/['()]/g, escape);
        res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${safe}`);
        if (typeof file.sizeBytes === 'number' && file.sizeBytes > 0)
            res.setHeader('Content-Length', String(file.sizeBytes));
        await this.audit.log({
            actorId: user.userId,
            actorRole: user.role,
            action: 'ISSUE_ATTACHMENT_DOWNLOADED',
            targetType: 'issue_report',
            targetId: id,
            workspaceId: file.workspaceId,
            ipAddress: (req.ip ?? null),
            userAgent: (req.headers['user-agent'] ?? null),
            metadata: { attachmentId, filename: file.filename, sizeBytes: file.sizeBytes },
        });
        file.stream.pipe(res);
    }
    async getMine(user, id) {
        return this.issuesService.getMine(user.userId, id);
    }
    async listForAdmin(query) {
        return this.issuesService.listForAdmin(query);
    }
    async getForAdmin(user, id) {
        return this.issuesService.getForAdmin(id, user.role);
    }
    async updateStatus(user, id, dto) {
        return this.issuesService.updateStatus(id, user.role, dto.status, dto.expectedVersion);
    }
};
exports.IssuesController = IssuesController;
__decorate([
    (0, common_1.Post)('issues'),
    (0, swagger_1.ApiOperation)({ summary: 'ISSUE-01: Tạo báo cáo sự cố' }),
    (0, api_zod_decorator_1.ApiZodBody)(create_issue_dto_1.CreateIssueSchema),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)(new zod_validation_pipe_1.ZodValidationPipe(create_issue_dto_1.CreateIssueSchema))),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], IssuesController.prototype, "createReport", null);
__decorate([
    (0, common_1.Get)('issues'),
    (0, swagger_1.ApiOperation)({ summary: 'ISSUE-02: Danh sách báo cáo của tôi' }),
    (0, api_zod_decorator_1.ApiZodQuery)(create_issue_dto_1.ListIssuesQuerySchema),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Query)(new zod_validation_pipe_1.ZodValidationPipe(create_issue_dto_1.ListIssuesQuerySchema))),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], IssuesController.prototype, "listMine", null);
__decorate([
    (0, common_1.Post)('issues/:id/attachments'),
    (0, swagger_1.ApiOperation)({ summary: 'ISSUE-01: Upload tệp đính kèm (png/jpg/pdf, <=10MB, tối đa 3 tệp)' }),
    (0, swagger_1.ApiConsumes)('multipart/form-data'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, Object]),
    __metadata("design:returntype", Promise)
], IssuesController.prototype, "uploadAttachment", null);
__decorate([
    (0, common_1.Get)('issues/:id/attachments/:attachmentId'),
    (0, swagger_1.ApiOperation)({ summary: 'Tải tệp đính kèm báo cáo (kiểm tra quyền, có audit log)' }),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Param)('attachmentId')),
    __param(3, (0, common_1.Req)()),
    __param(4, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String, Object, Object]),
    __metadata("design:returntype", Promise)
], IssuesController.prototype, "downloadAttachment", null);
__decorate([
    (0, common_1.Get)('issues/:id'),
    (0, swagger_1.ApiOperation)({ summary: 'ISSUE-03: Chi tiết báo cáo của tôi' }),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], IssuesController.prototype, "getMine", null);
__decorate([
    (0, common_1.Get)('admin/issues'),
    (0, roles_decorator_1.Roles)('admin'),
    (0, swagger_1.ApiOperation)({ summary: 'ISSUE-04: Danh sách báo cáo (quản trị)' }),
    (0, api_zod_decorator_1.ApiZodQuery)(create_issue_dto_1.AdminListIssuesQuerySchema),
    __param(0, (0, common_1.Query)(new zod_validation_pipe_1.ZodValidationPipe(create_issue_dto_1.AdminListIssuesQuerySchema))),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], IssuesController.prototype, "listForAdmin", null);
__decorate([
    (0, common_1.Get)('admin/issues/:id'),
    (0, roles_decorator_1.Roles)('admin'),
    (0, swagger_1.ApiOperation)({ summary: 'ISSUE-04: Chi tiết báo cáo (quản trị)' }),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], IssuesController.prototype, "getForAdmin", null);
__decorate([
    (0, common_1.Patch)('admin/issues/:id/status'),
    (0, roles_decorator_1.Roles)('admin'),
    (0, swagger_1.ApiOperation)({ summary: 'ISSUE-04: Đổi trạng thái báo cáo (optimistic locking)' }),
    (0, api_zod_decorator_1.ApiZodBody)(create_issue_dto_1.UpdateIssueStatusSchema),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)(new zod_validation_pipe_1.ZodValidationPipe(create_issue_dto_1.UpdateIssueStatusSchema))),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, Object]),
    __metadata("design:returntype", Promise)
], IssuesController.prototype, "updateStatus", null);
exports.IssuesController = IssuesController = __decorate([
    (0, swagger_1.ApiTags)('Issues'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, common_1.Controller)(),
    __metadata("design:paramtypes", [issues_service_1.IssuesService, audit_service_1.AuditService])
], IssuesController);
//# sourceMappingURL=issues.controller.js.map