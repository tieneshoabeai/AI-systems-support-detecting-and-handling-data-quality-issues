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
exports.DataViewController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const data_view_service_1 = require("../../application/data-view.service");
const query_records_dto_1 = require("./dtos/query-records.dto");
const query_records_body_dto_1 = require("./dtos/query-records-body.dto");
const jwt_auth_guard_1 = require("../../../../shared/guards/jwt-auth.guard");
const policies_guard_1 = require("../../../../shared/casl/policies.guard");
const check_policies_decorator_1 = require("../../../../shared/casl/check-policies.decorator");
const actions_enum_1 = require("../../../../shared/casl/actions.enum");
const zod_validation_pipe_1 = require("../../../../shared/pipes/zod-validation.pipe");
const api_zod_decorator_1 = require("../../../../shared/swagger/api-zod.decorator");
let DataViewController = class DataViewController {
    dataViewService;
    constructor(dataViewService) {
        this.dataViewService = dataViewService;
    }
    async getRecords(datasetId, query) {
        return this.dataViewService.getRecords(datasetId, query);
    }
    async queryRecords(datasetId, body) {
        return this.dataViewService.queryRecords(datasetId, body);
    }
    async getColumnStats(datasetId, columnKey) {
        const stats = await this.dataViewService.getColumnStats(datasetId, columnKey);
        return { stats };
    }
};
exports.DataViewController = DataViewController;
__decorate([
    (0, common_1.Get)('records'),
    (0, swagger_1.ApiOperation)({ summary: 'F5.1 (Wave 4): Keyset pagination cho Virtual Grid - { items, meta: { nextCursor, hasMore } }' }),
    (0, api_zod_decorator_1.ApiZodQuery)(query_records_dto_1.QueryRecordsSchema),
    (0, check_policies_decorator_1.CheckPolicies)((ability) => ability.can(actions_enum_1.Action.Read, 'DataRecord')),
    __param(0, (0, common_1.Param)('datasetId')),
    __param(1, (0, common_1.Query)(new zod_validation_pipe_1.ZodValidationPipe(query_records_dto_1.QueryRecordsSchema))),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], DataViewController.prototype, "getRecords", null);
__decorate([
    (0, common_1.Post)('records/query'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, swagger_1.ApiOperation)({
        summary: 'F5.4 (Wave 4): Truy van loc/sap xep/tim kiem tren props.cN + keyset pagination',
    }),
    (0, api_zod_decorator_1.ApiZodBody)(query_records_body_dto_1.QueryRecordsBodySchema),
    (0, check_policies_decorator_1.CheckPolicies)((ability) => ability.can(actions_enum_1.Action.Read, 'DataRecord')),
    __param(0, (0, common_1.Param)('datasetId')),
    __param(1, (0, common_1.Body)(new zod_validation_pipe_1.ZodValidationPipe(query_records_body_dto_1.QueryRecordsBodySchema))),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], DataViewController.prototype, "queryRecords", null);
__decorate([
    (0, common_1.Get)('columns/:columnKey/stats'),
    (0, swagger_1.ApiOperation)({ summary: 'F5.3 (Wave 4): Thong ke cot theo key on dinh c{i} (chap nhan ca ten hien thi)' }),
    (0, check_policies_decorator_1.CheckPolicies)((ability) => ability.can(actions_enum_1.Action.Read, 'Dataset')),
    __param(0, (0, common_1.Param)('datasetId')),
    __param(1, (0, common_1.Param)('columnKey')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], DataViewController.prototype, "getColumnStats", null);
exports.DataViewController = DataViewController = __decorate([
    (0, swagger_1.ApiTags)('Data View (Virtual Grid)'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, policies_guard_1.PoliciesGuard),
    (0, common_1.Controller)('datasets/:datasetId'),
    __metadata("design:paramtypes", [data_view_service_1.DataViewService])
], DataViewController);
//# sourceMappingURL=data-view.controller.js.map