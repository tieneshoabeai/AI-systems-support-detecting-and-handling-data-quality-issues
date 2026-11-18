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
exports.UsersController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const users_service_1 = require("../../application/users.service");
const update_user_dto_1 = require("./dtos/update-user.dto");
const zod_validation_pipe_1 = require("../../../../shared/pipes/zod-validation.pipe");
const jwt_auth_guard_1 = require("../../../../shared/guards/jwt-auth.guard");
const current_user_decorator_1 = require("../../../../shared/decorators/current-user.decorator");
const api_zod_decorator_1 = require("../../../../shared/swagger/api-zod.decorator");
let UsersController = class UsersController {
    usersService;
    constructor(usersService) {
        this.usersService = usersService;
    }
    async getProfile(user) {
        const profile = await this.usersService.findById(user.userId);
        if (!profile) {
            throw new common_1.NotFoundException('Không tìm thấy tài khoản người dùng');
        }
        return profile;
    }
    async updateProfile(user, dto) {
        return this.usersService.updateProfile(user.userId, dto);
    }
    async deleteAccount(user) {
        await this.usersService.softDeleteUser(user.userId);
        return { message: 'Tài khoản đã được xóa mềm thành công' };
    }
};
exports.UsersController = UsersController;
__decorate([
    (0, common_1.Get)('me'),
    (0, swagger_1.ApiOperation)({ summary: 'Lấy thông tin tài khoản hiện tại' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Thông tin hồ sơ người dùng thành công' }),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], UsersController.prototype, "getProfile", null);
__decorate([
    (0, common_1.Patch)('me'),
    (0, swagger_1.ApiOperation)({ summary: 'Cập nhật thông tin hồ sơ cá nhân' }),
    (0, api_zod_decorator_1.ApiZodBody)(update_user_dto_1.UpdateUserSchema, 'Thông tin cập nhật hồ sơ cá nhân'),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Hồ sơ đã được cập nhật' }),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)(new zod_validation_pipe_1.ZodValidationPipe(update_user_dto_1.UpdateUserSchema))),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], UsersController.prototype, "updateProfile", null);
__decorate([
    (0, common_1.Delete)('me'),
    (0, swagger_1.ApiOperation)({ summary: 'Xóa mềm tài khoản người dùng (Soft Delete)' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Tài khoản đã được xóa mềm thành công' }),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], UsersController.prototype, "deleteAccount", null);
exports.UsersController = UsersController = __decorate([
    (0, swagger_1.ApiTags)('Users'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, common_1.Controller)('users'),
    __metadata("design:paramtypes", [users_service_1.UsersService])
], UsersController);
//# sourceMappingURL=users.controller.js.map