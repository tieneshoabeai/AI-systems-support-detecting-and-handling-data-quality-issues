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
exports.AnalysisController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const analysis_service_1 = require("../../application/analysis.service");
const run_analysis_dto_1 = require("./dtos/run-analysis.dto");
const analysis_config_dto_1 = require("./dtos/analysis-config.dto");
const jwt_auth_guard_1 = require("../../../../shared/guards/jwt-auth.guard");
const policies_guard_1 = require("../../../../shared/casl/policies.guard");
const check_policies_decorator_1 = require("../../../../shared/casl/check-policies.decorator");
const actions_enum_1 = require("../../../../shared/casl/actions.enum");
const current_user_decorator_1 = require("../../../../shared/decorators/current-user.decorator");
const zod_validation_pipe_1 = require("../../../../shared/pipes/zod-validation.pipe");
const api_zod_decorator_1 = require("../../../../shared/swagger/api-zod.decorator");
let AnalysisController = class AnalysisController {
    analysisService;
    constructor(analysisService) {
        this.analysisService = analysisService;
    }
    async saveConfig(projectId, dto) {
        return this.analysisService.saveConfig(projectId, dto);
    }
    async getConfig(projectId) {
        return this.analysisService.getConfig(projectId);
    }
    async runAnalysis(projectId, user, dto) {
        const data = await this.analysisService.runAnalysis(projectId, dto, user.userId);
        return data;
    }
    async getResult(projectId) {
        return this.analysisService.getResult(projectId);
    }
    async getJob(jobId) {
        return this.analysisService.getJob(jobId);
    }
    async retryJob(jobId) {
        return this.analysisService.retryJob(jobId);
    }
    async ingestAiResult(jobId, body) {
        const raw = (body?.result ?? {});
        const modelId = typeof body?.modelId === 'string' ? body.modelId : undefined;
        return this.analysisService.ingestAiResult(jobId, raw, modelId);
    }
};
exports.AnalysisController = AnalysisController;
__decorate([
    (0, common_1.Post)('projects/:projectId/analysis/config'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, swagger_1.ApiOperation)({ summary: 'ANALYSIS-01: Lưu cấu hình cột phân tích (selected/label/time/value + phương pháp)', operationId: 'saveAnalysisConfig' }),
    (0, api_zod_decorator_1.ApiZodBody)(analysis_config_dto_1.AnalysisConfigSchema),
    (0, check_policies_decorator_1.CheckPolicies)((ability) => ability.can(actions_enum_1.Action.Execute, 'Analysis')),
    __param(0, (0, common_1.Param)('projectId')),
    __param(1, (0, common_1.Body)(new zod_validation_pipe_1.ZodValidationPipe(analysis_config_dto_1.AnalysisConfigSchema))),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], AnalysisController.prototype, "saveConfig", null);
__decorate([
    (0, common_1.Get)('projects/:projectId/analysis/config'),
    (0, swagger_1.ApiOperation)({ summary: 'ANALYSIS-01: Xem cấu hình cột phân tích', operationId: 'getAnalysisConfig' }),
    (0, check_policies_decorator_1.CheckPolicies)((ability) => ability.can(actions_enum_1.Action.Read, 'Analysis')),
    __param(0, (0, common_1.Param)('projectId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], AnalysisController.prototype, "getConfig", null);
__decorate([
    (0, common_1.Post)('projects/:projectId/analysis'),
    (0, swagger_1.ApiOperation)({ summary: 'ANALYSIS-02: Chạy phân tích hệ thống (đồng bộ) + tạo AI job corr-v1 (bất đồng bộ)', operationId: 'runAnalysis' }),
    (0, api_zod_decorator_1.ApiZodBody)(run_analysis_dto_1.RunAnalysisSchema),
    (0, check_policies_decorator_1.CheckPolicies)((ability) => ability.can(actions_enum_1.Action.Execute, 'Analysis')),
    __param(0, (0, common_1.Param)('projectId')),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __param(2, (0, common_1.Body)(new zod_validation_pipe_1.ZodValidationPipe(run_analysis_dto_1.RunAnalysisSchema))),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Object]),
    __metadata("design:returntype", Promise)
], AnalysisController.prototype, "runAnalysis", null);
__decorate([
    (0, common_1.Get)('projects/:projectId/analysis/result'),
    (0, swagger_1.ApiOperation)({ summary: 'ANALYSIS-03: Kết quả phân tích (DQ-05 có điều kiện + ma trận tương quan + VIF + nhận xét AI)', operationId: 'getAnalysisResult' }),
    (0, check_policies_decorator_1.CheckPolicies)((ability) => ability.can(actions_enum_1.Action.Read, 'Analysis')),
    __param(0, (0, common_1.Param)('projectId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], AnalysisController.prototype, "getResult", null);
__decorate([
    (0, common_1.Get)('analysis/jobs/:jobId'),
    (0, swagger_1.ApiOperation)({ summary: 'AI-01: Trạng thái AI job corr-v1', operationId: 'getAiJob' }),
    (0, check_policies_decorator_1.CheckPolicies)((ability) => ability.can(actions_enum_1.Action.Read, 'Analysis')),
    __param(0, (0, common_1.Param)('jobId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], AnalysisController.prototype, "getJob", null);
__decorate([
    (0, common_1.Post)('analysis/jobs/:jobId/retry'),
    (0, common_1.HttpCode)(common_1.HttpStatus.ACCEPTED),
    (0, swagger_1.ApiOperation)({ summary: 'AI-01: Thử lại AI job (tối đa 2 retry)', operationId: 'retryAiJob' }),
    (0, check_policies_decorator_1.CheckPolicies)((ability) => ability.can(actions_enum_1.Action.Execute, 'Analysis')),
    __param(0, (0, common_1.Param)('jobId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], AnalysisController.prototype, "retryJob", null);
__decorate([
    (0, common_1.Post)('analysis/jobs/:jobId/result'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, swagger_1.ApiOperation)({ summary: 'AI nội bộ: Gắn kết quả AI corr-v1 đã grounding vào analysis_result', operationId: 'ingestAiResult' }),
    (0, check_policies_decorator_1.CheckPolicies)((ability) => ability.can(actions_enum_1.Action.Execute, 'Analysis')),
    __param(0, (0, common_1.Param)('jobId')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], AnalysisController.prototype, "ingestAiResult", null);
exports.AnalysisController = AnalysisController = __decorate([
    (0, swagger_1.ApiTags)('Analysis'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, policies_guard_1.PoliciesGuard),
    (0, common_1.Controller)(),
    __metadata("design:paramtypes", [analysis_service_1.AnalysisService])
], AnalysisController);
//# sourceMappingURL=analysis.controller.js.map