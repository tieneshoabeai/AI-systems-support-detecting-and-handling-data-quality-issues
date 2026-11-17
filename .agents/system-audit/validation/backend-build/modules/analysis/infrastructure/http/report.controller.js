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
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReportController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const jwt_auth_guard_1 = require("../../../../shared/guards/jwt-auth.guard");
const policies_guard_1 = require("../../../../shared/casl/policies.guard");
const check_policies_decorator_1 = require("../../../../shared/casl/check-policies.decorator");
const actions_enum_1 = require("../../../../shared/casl/actions.enum");
const report_service_1 = require("../../application/report.service");
const audit_service_1 = require("../../../audit/application/audit.service");
const current_user_decorator_1 = require("../../../../shared/decorators/current-user.decorator");
let ReportController = class ReportController {
    reportService;
    audit;
    constructor(reportService, audit) {
        this.reportService = reportService;
        this.audit = audit;
    }
    async request(projectId) {
        return this.reportService.requestReport(projectId);
    }
    async download(projectId, reportId, actor, req, res) {
        const meta = await this.reportService.getReportFileMeta(projectId, reportId);
        if (meta.status !== 'succeeded') {
            res.status(202).json(meta);
            return;
        }
        try {
            const { stream, fileSizeBytes } = await this.reportService.downloadReportFile(projectId, reportId);
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''report-${reportId}.pdf`);
            if (typeof fileSizeBytes === 'number')
                res.setHeader('Content-Length', String(fileSizeBytes));
            await this.audit.log({
                actorId: actor?.userId ?? null,
                actorRole: actor?.role ?? null,
                action: 'REPORT_FILE_DOWNLOADED',
                targetType: 'report',
                targetId: reportId,
                projectId,
                ipAddress: (req.ip ?? null),
                userAgent: (req.headers['user-agent'] ?? null),
                metadata: { projectId, reportId, fileSizeBytes: fileSizeBytes ?? null },
            });
            stream.pipe(res);
        }
        catch {
            res.status(202).json(meta);
        }
    }
};
exports.ReportController = ReportController;
__decorate([
    (0, common_1.Post)('projects/:projectId/report'),
    (0, common_1.HttpCode)(common_1.HttpStatus.ACCEPTED),
    (0, swagger_1.ApiOperation)({ summary: 'REPORT-01: Yêu cầu sinh PDF ở worker (202, không sinh tại API)', operationId: 'requestReport' }),
    (0, check_policies_decorator_1.CheckPolicies)((ability) => ability.can(actions_enum_1.Action.Execute, 'Analysis')),
    __param(0, (0, common_1.Param)('projectId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], ReportController.prototype, "request", null);
__decorate([
    (0, common_1.Get)('projects/:projectId/report/:reportId/file'),
    (0, swagger_1.ApiOperation)({ summary: 'REPORT-01: Tải file PDF do worker sinh', operationId: 'downloadReport' }),
    (0, check_policies_decorator_1.CheckPolicies)((ability) => ability.can(actions_enum_1.Action.Read, 'Analysis')),
    __param(0, (0, common_1.Param)('projectId')),
    __param(1, (0, common_1.Param)('reportId')),
    __param(2, (0, current_user_decorator_1.CurrentUser)()),
    __param(3, (0, common_1.Req)()),
    __param(4, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, Object, Object, Object]),
    __metadata("design:returntype", Promise)
], ReportController.prototype, "download", null);
exports.ReportController = ReportController = __decorate([
    (0, swagger_1.ApiTags)('Report'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, policies_guard_1.PoliciesGuard),
    (0, common_1.Controller)(),
    __metadata("design:paramtypes", [report_service_1.ReportService, audit_service_1.AuditService])
], ReportController);
//# sourceMappingURL=report.controller.js.map