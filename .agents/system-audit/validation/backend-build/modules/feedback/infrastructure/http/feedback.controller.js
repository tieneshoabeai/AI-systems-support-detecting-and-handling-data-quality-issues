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
exports.FeedbackController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const jwt_auth_guard_1 = require("../../../../shared/guards/jwt-auth.guard");
const current_user_decorator_1 = require("../../../../shared/decorators/current-user.decorator");
const zod_validation_pipe_1 = require("../../../../shared/pipes/zod-validation.pipe");
const api_zod_decorator_1 = require("../../../../shared/swagger/api-zod.decorator");
const feedback_service_1 = require("../../application/feedback.service");
const feedback_dto_1 = require("./dtos/feedback.dto");
let FeedbackController = class FeedbackController {
    feedbackService;
    constructor(feedbackService) {
        this.feedbackService = feedbackService;
    }
    async createFindingFeedback(user, analysisId, findingId, dto) {
        return this.feedbackService.createFindingFeedback(user.userId, user.role, analysisId, findingId, dto);
    }
    async createRunFeedback(user, analysisId, dto) {
        return this.feedbackService.createRunFeedback(user.userId, user.role, analysisId, dto);
    }
    async listFindingFeedback(user, analysisId, findingId, query) {
        return this.feedbackService.listFindingFeedback(user.userId, user.role, analysisId, findingId, query);
    }
    async listRunFeedback(user, analysisId, query) {
        return this.feedbackService.listRunFeedback(user.userId, user.role, analysisId, query);
    }
    async updateMine(user, id, dto) {
        return this.feedbackService.updateMine(user.userId, id, dto);
    }
    async remove(user, id) {
        return this.feedbackService.remove(user.userId, user.role, id);
    }
    async aiQualityMetrics(user, projectId) {
        return this.feedbackService.aiQualityMetrics(user.userId, user.role, projectId);
    }
};
exports.FeedbackController = FeedbackController;
__decorate([
    (0, common_1.Post)('analyses/:analysisId/findings/:findingId/feedback'),
    (0, swagger_1.ApiOperation)({ summary: 'FB-01: Nhận xét một phát hiện' }),
    (0, api_zod_decorator_1.ApiZodBody)(feedback_dto_1.CreateFeedbackSchema),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('analysisId')),
    __param(2, (0, common_1.Param)('findingId')),
    __param(3, (0, common_1.Body)(new zod_validation_pipe_1.ZodValidationPipe(feedback_dto_1.CreateFeedbackSchema))),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String, Object]),
    __metadata("design:returntype", Promise)
], FeedbackController.prototype, "createFindingFeedback", null);
__decorate([
    (0, common_1.Post)('analyses/:analysisId/feedback'),
    (0, swagger_1.ApiOperation)({ summary: 'FB-02: Nhận xét cả lần phân tích' }),
    (0, api_zod_decorator_1.ApiZodBody)(feedback_dto_1.CreateFeedbackSchema),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('analysisId')),
    __param(2, (0, common_1.Body)(new zod_validation_pipe_1.ZodValidationPipe(feedback_dto_1.CreateFeedbackSchema))),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, Object]),
    __metadata("design:returntype", Promise)
], FeedbackController.prototype, "createRunFeedback", null);
__decorate([
    (0, common_1.Get)('analyses/:analysisId/findings/:findingId/feedback'),
    (0, swagger_1.ApiOperation)({ summary: 'FB-03: Xem nhận xét của một phát hiện' }),
    (0, api_zod_decorator_1.ApiZodQuery)(feedback_dto_1.ListFeedbackQuerySchema),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('analysisId')),
    __param(2, (0, common_1.Param)('findingId')),
    __param(3, (0, common_1.Query)(new zod_validation_pipe_1.ZodValidationPipe(feedback_dto_1.ListFeedbackQuerySchema))),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String, Object]),
    __metadata("design:returntype", Promise)
], FeedbackController.prototype, "listFindingFeedback", null);
__decorate([
    (0, common_1.Get)('analyses/:analysisId/feedback'),
    (0, swagger_1.ApiOperation)({ summary: 'FB-04: Xem nhận xét của một lần phân tích' }),
    (0, api_zod_decorator_1.ApiZodQuery)(feedback_dto_1.ListFeedbackQuerySchema),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('analysisId')),
    __param(2, (0, common_1.Query)(new zod_validation_pipe_1.ZodValidationPipe(feedback_dto_1.ListFeedbackQuerySchema))),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, Object]),
    __metadata("design:returntype", Promise)
], FeedbackController.prototype, "listRunFeedback", null);
__decorate([
    (0, common_1.Patch)('feedback/:id'),
    (0, swagger_1.ApiOperation)({ summary: 'FB-05: Sửa nhận xét của chính mình' }),
    (0, api_zod_decorator_1.ApiZodBody)(feedback_dto_1.UpdateFeedbackSchema),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)(new zod_validation_pipe_1.ZodValidationPipe(feedback_dto_1.UpdateFeedbackSchema))),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, Object]),
    __metadata("design:returntype", Promise)
], FeedbackController.prototype, "updateMine", null);
__decorate([
    (0, common_1.Delete)('feedback/:id'),
    (0, swagger_1.ApiOperation)({ summary: 'FB-05: Xoá nhận xét (chủ hoặc Owner xử lý vi phạm)' }),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], FeedbackController.prototype, "remove", null);
__decorate([
    (0, common_1.Get)('projects/:projectId/ai-quality-metrics'),
    (0, swagger_1.ApiOperation)({ summary: 'FB-06: Thống kê chất lượng AI theo project' }),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('projectId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], FeedbackController.prototype, "aiQualityMetrics", null);
exports.FeedbackController = FeedbackController = __decorate([
    (0, swagger_1.ApiTags)('Feedback'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, common_1.Controller)(),
    __metadata("design:paramtypes", [feedback_service_1.FeedbackService])
], FeedbackController);
//# sourceMappingURL=feedback.controller.js.map