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
exports.SummaryController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const jwt_auth_guard_1 = require("../../../../shared/guards/jwt-auth.guard");
const policies_guard_1 = require("../../../../shared/casl/policies.guard");
const check_policies_decorator_1 = require("../../../../shared/casl/check-policies.decorator");
const actions_enum_1 = require("../../../../shared/casl/actions.enum");
const summary_service_1 = require("../../application/summary.service");
let SummaryController = class SummaryController {
    summaryService;
    constructor(summaryService) {
        this.summaryService = summaryService;
    }
    async create(projectId) {
        return this.summaryService.createSummary(projectId);
    }
    async get(projectId) {
        return this.summaryService.getSummary(projectId);
    }
};
exports.SummaryController = SummaryController;
__decorate([
    (0, common_1.Post)('projects/:projectId/summary'),
    (0, common_1.HttpCode)(common_1.HttpStatus.CREATED),
    (0, swagger_1.ApiOperation)({ summary: 'SUMMARY-01: Tạo Tổng kết từ kết quả phân tích hệ thống mới nhất', operationId: 'createSummary' }),
    (0, check_policies_decorator_1.CheckPolicies)((ability) => ability.can(actions_enum_1.Action.Execute, 'Analysis')),
    __param(0, (0, common_1.Param)('projectId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], SummaryController.prototype, "create", null);
__decorate([
    (0, common_1.Get)('projects/:projectId/summary'),
    (0, swagger_1.ApiOperation)({ summary: 'SUMMARY-01: Xem Tổng kết mới nhất', operationId: 'getSummary' }),
    (0, check_policies_decorator_1.CheckPolicies)((ability) => ability.can(actions_enum_1.Action.Read, 'Analysis')),
    __param(0, (0, common_1.Param)('projectId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], SummaryController.prototype, "get", null);
exports.SummaryController = SummaryController = __decorate([
    (0, swagger_1.ApiTags)('Summary'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, policies_guard_1.PoliciesGuard),
    (0, common_1.Controller)(),
    __metadata("design:paramtypes", [summary_service_1.SummaryService])
], SummaryController);
//# sourceMappingURL=summary.controller.js.map