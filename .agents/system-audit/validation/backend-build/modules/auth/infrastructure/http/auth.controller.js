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
exports.AuthController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const throttler_1 = require("@nestjs/throttler");
const auth_service_1 = require("../../application/auth.service");
const register_dto_1 = require("./dtos/register.dto");
const login_dto_1 = require("./dtos/login.dto");
const refresh_token_dto_1 = require("./dtos/refresh-token.dto");
const password_reset_dto_1 = require("./dtos/password-reset.dto");
const zod_validation_pipe_1 = require("../../../../shared/pipes/zod-validation.pipe");
const jwt_auth_guard_1 = require("../../../../shared/guards/jwt-auth.guard");
const public_decorator_1 = require("../../../../shared/decorators/public.decorator");
const current_user_decorator_1 = require("../../../../shared/decorators/current-user.decorator");
const api_zod_decorator_1 = require("../../../../shared/swagger/api-zod.decorator");
let AuthController = class AuthController {
    authService;
    constructor(authService) {
        this.authService = authService;
    }
    async register(dto) {
        return this.authService.register(dto);
    }
    async login(dto, req) {
        const ipAddress = req.ip || req.socket.remoteAddress;
        const userAgent = req.headers['user-agent'];
        return this.authService.login(dto, ipAddress, userAgent);
    }
    async refresh(dto) {
        return this.authService.refreshAccessToken(dto.refresh_token);
    }
    async forgotPassword(dto) {
        return this.authService.forgotPassword(dto.email);
    }
    async resetPassword(dto) {
        return this.authService.resetPassword(dto.email, dto.otp, dto.new_password);
    }
    async changePassword(user, dto) {
        return this.authService.changePassword(user.userId, user.sessionId, dto.current_password, dto.new_password, dto.confirm_password);
    }
    async googleStart() {
        throw new common_1.HttpException({ message: 'Đăng nhập Google (AUTH-03) thuộc Đợt 2, chưa khả dụng ở Đợt 1. Cần GOOGLE_CLIENT_ID/SECRET + HTTPS redirect URI.', error: 'DEPENDENCY_UNAVAILABLE' }, common_1.HttpStatus.NOT_IMPLEMENTED);
    }
    async googleCallback() {
        throw new common_1.HttpException({ message: 'Đăng nhập Google (AUTH-03) thuộc Đợt 2, chưa khả dụng ở Đợt 1.', error: 'DEPENDENCY_UNAVAILABLE' }, common_1.HttpStatus.NOT_IMPLEMENTED);
    }
    async logout(user) {
        return this.authService.logout(user.sessionId);
    }
    async getSessions(user) {
        return this.authService.getSessions(user.userId);
    }
    async revokeSession(user, sessionId) {
        return this.authService.revokeSession(user.userId, sessionId);
    }
};
exports.AuthController = AuthController;
__decorate([
    (0, public_decorator_1.Public)(),
    (0, throttler_1.Throttle)({ default: { limit: 5, ttl: 3600000 } }),
    (0, common_1.Post)('register'),
    (0, swagger_1.ApiOperation)({ summary: 'Đăng ký tài khoản mới (F1.1)' }),
    (0, api_zod_decorator_1.ApiZodBody)(register_dto_1.RegisterSchema, 'Thông tin đăng ký tài khoản mới'),
    (0, swagger_1.ApiResponse)({ status: 201, description: 'Tài khoản được tạo thành công' }),
    __param(0, (0, common_1.Body)(new zod_validation_pipe_1.ZodValidationPipe(register_dto_1.RegisterSchema))),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "register", null);
__decorate([
    (0, public_decorator_1.Public)(),
    (0, throttler_1.Throttle)({ default: { limit: 10, ttl: 3600000 } }),
    (0, common_1.Post)('login'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, swagger_1.ApiOperation)({ summary: 'Đăng nhập hệ thống (F1.2)' }),
    (0, api_zod_decorator_1.ApiZodBody)(login_dto_1.LoginSchema, 'Thông tin đăng nhập hệ thống'),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Đăng nhập thành công, trả về JWT Access Token và Refresh Token' }),
    __param(0, (0, common_1.Body)(new zod_validation_pipe_1.ZodValidationPipe(login_dto_1.LoginSchema))),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "login", null);
__decorate([
    (0, public_decorator_1.Public)(),
    (0, throttler_1.Throttle)({ default: { limit: 10, ttl: 3600000 } }),
    (0, common_1.Post)('refresh'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, swagger_1.ApiOperation)({ summary: 'Cấp mới Access Token bằng Refresh Token (F1.3)' }),
    (0, api_zod_decorator_1.ApiZodBody)(refresh_token_dto_1.RefreshTokenSchema, 'Refresh token dùng để gia hạn access token'),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Cấp mới Access Token thành công' }),
    __param(0, (0, common_1.Body)(new zod_validation_pipe_1.ZodValidationPipe(refresh_token_dto_1.RefreshTokenSchema))),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "refresh", null);
__decorate([
    (0, public_decorator_1.Public)(),
    (0, throttler_1.Throttle)({ default: { limit: 5, ttl: 3600000 } }),
    (0, common_1.Post)('forgot-password'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, swagger_1.ApiOperation)({ summary: 'AUTH-05: Quên mật khẩu — gửi OTP 6 số (TTL 10 phút)' }),
    (0, api_zod_decorator_1.ApiZodBody)(password_reset_dto_1.ForgotPasswordSchema, 'Email nhận mã OTP'),
    __param(0, (0, common_1.Body)(new zod_validation_pipe_1.ZodValidationPipe(password_reset_dto_1.ForgotPasswordSchema))),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "forgotPassword", null);
__decorate([
    (0, public_decorator_1.Public)(),
    (0, throttler_1.Throttle)({ default: { limit: 10, ttl: 3600000 } }),
    (0, common_1.Post)('reset-password'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, swagger_1.ApiOperation)({ summary: 'AUTH-06: Đặt lại mật khẩu bằng OTP' }),
    (0, api_zod_decorator_1.ApiZodBody)(password_reset_dto_1.ResetPasswordSchema, 'Email + OTP + mật khẩu mới'),
    __param(0, (0, common_1.Body)(new zod_validation_pipe_1.ZodValidationPipe(password_reset_dto_1.ResetPasswordSchema))),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "resetPassword", null);
__decorate([
    (0, common_1.Post)('change-password'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, swagger_1.ApiBearerAuth)(),
    (0, throttler_1.Throttle)({ default: { limit: 5, ttl: 3600000 } }),
    (0, swagger_1.ApiOperation)({ summary: 'AUTH-07: Đổi mật khẩu (giữ phiên hiện tại)' }),
    (0, api_zod_decorator_1.ApiZodBody)(password_reset_dto_1.ChangePasswordSchema, 'Mật khẩu hiện tại + mật khẩu mới 2 lần nhập'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)(new zod_validation_pipe_1.ZodValidationPipe(password_reset_dto_1.ChangePasswordSchema))),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "changePassword", null);
__decorate([
    (0, public_decorator_1.Public)(),
    (0, common_1.Get)('google'),
    (0, swagger_1.ApiOperation)({ summary: 'AUTH-03: Đăng nhập Google — chuyển sang Đợt 2 (chưa khả dụng)' }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "googleStart", null);
__decorate([
    (0, public_decorator_1.Public)(),
    (0, common_1.Get)('google/callback'),
    (0, swagger_1.ApiOperation)({ summary: 'AUTH-03: Google callback — chuyển sang Đợt 2 (chưa khả dụng)' }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "googleCallback", null);
__decorate([
    (0, common_1.Post)('logout'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, swagger_1.ApiBearerAuth)(),
    (0, swagger_1.ApiOperation)({ summary: 'Đăng xuất tài khoản và thu hồi session hiện hành (F1.4)' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Đăng xuất thành công' }),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "logout", null);
__decorate([
    (0, common_1.Get)('sessions'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, swagger_1.ApiBearerAuth)(),
    (0, swagger_1.ApiOperation)({ summary: 'Xem danh sách các phiên đăng nhập đang hoạt động (F1.8)' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Danh sách các phiên đăng nhập' }),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "getSessions", null);
__decorate([
    (0, common_1.Delete)('sessions/:id'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, swagger_1.ApiBearerAuth)(),
    (0, swagger_1.ApiOperation)({ summary: 'Thu hồi phiên đăng nhập từ xa (F1.10)' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Thu hồi phiên thành công' }),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "revokeSession", null);
exports.AuthController = AuthController = __decorate([
    (0, swagger_1.ApiTags)('Auth'),
    (0, common_1.Controller)('auth'),
    __metadata("design:paramtypes", [auth_service_1.AuthService])
], AuthController);
//# sourceMappingURL=auth.controller.js.map