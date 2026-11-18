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
var AdminUsersController_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdminUsersController = exports.AdminListUsersQuerySchema = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const jwt_auth_guard_1 = require("../../../../shared/guards/jwt-auth.guard");
const roles_guard_1 = require("../../../../shared/guards/roles.guard");
const roles_decorator_1 = require("../../../../shared/decorators/roles.decorator");
const current_user_decorator_1 = require("../../../../shared/decorators/current-user.decorator");
const zod_validation_pipe_1 = require("../../../../shared/pipes/zod-validation.pipe");
const users_service_1 = require("../../application/users.service");
const zod_1 = require("zod");
exports.AdminListUsersQuerySchema = zod_1.z.object({
    search: zod_1.z.string().trim().max(200).optional(),
    role: zod_1.z.enum(['admin', 'analyst']).optional(),
    status: zod_1.z.enum(['active', 'blocked']).optional(),
    page: zod_1.z.coerce.number().int().min(1).default(1),
    limit: zod_1.z.coerce.number().int().min(1).max(100).default(15),
});
function toSafeProfile(u) {
    const { passwordHash, password_hash, googleId, google_id, ...rest } = u;
    void passwordHash;
    void password_hash;
    void googleId;
    void google_id;
    return rest;
}
let AdminUsersController = AdminUsersController_1 = class AdminUsersController {
    usersService;
    logger = new common_1.Logger(AdminUsersController_1.name);
    constructor(usersService) {
        this.usersService = usersService;
    }
    async list(actor, query) {
        const q = query;
        const { items, total } = await this.usersService.findPaged({ search: q.search, role: q.role, status: q.status, page: q.page, limit: q.limit });
        this.logger.log(`[ADMIN-01] actor=${actor.userId} action=admin.users.list target=users filter=${JSON.stringify({ search: q.search ?? null, role: q.role ?? null, status: q.status ?? null, page: q.page, limit: q.limit })} at=${new Date().toISOString()}`);
        return { items: items.map((u) => toSafeProfile(u)), total, page: q.page, limit: q.limit };
    }
    async detail(actor, id) {
        const u = await this.usersService.findById(id);
        if (!u)
            throw new common_1.NotFoundException('Không tìm thấy tài khoản người dùng');
        this.logger.log(`[ADMIN-01] actor=${actor.userId} action=admin.users.detail target=${id} at=${new Date().toISOString()}`);
        return toSafeProfile(u);
    }
};
exports.AdminUsersController = AdminUsersController;
__decorate([
    (0, common_1.Get)(),
    (0, roles_decorator_1.Roles)('admin'),
    (0, swagger_1.ApiOperation)({ summary: 'ADMIN-01: Danh sách hồ sơ (chỉ đọc, có audit log)' }),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Query)(new zod_validation_pipe_1.ZodValidationPipe(exports.AdminListUsersQuerySchema))),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], AdminUsersController.prototype, "list", null);
__decorate([
    (0, common_1.Get)(':id'),
    (0, roles_decorator_1.Roles)('admin'),
    (0, swagger_1.ApiOperation)({ summary: 'ADMIN-01: Chi tiết hồ sơ (chỉ đọc, có audit log)' }),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], AdminUsersController.prototype, "detail", null);
exports.AdminUsersController = AdminUsersController = AdminUsersController_1 = __decorate([
    (0, swagger_1.ApiTags)('Admin'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, common_1.Controller)('admin/users'),
    __metadata("design:paramtypes", [users_service_1.UsersService])
], AdminUsersController);
//# sourceMappingURL=admin-users.controller.js.map