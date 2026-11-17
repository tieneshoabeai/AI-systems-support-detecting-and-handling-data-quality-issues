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
var RealtimeAuthService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.RealtimeAuthService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const jwt_1 = require("@nestjs/jwt");
const users_service_1 = require("../../users/application/users.service");
let RealtimeAuthService = RealtimeAuthService_1 = class RealtimeAuthService {
    jwtService;
    config;
    usersService;
    logger = new common_1.Logger(RealtimeAuthService_1.name);
    constructor(jwtService, config, usersService) {
        this.jwtService = jwtService;
        this.config = config;
        this.usersService = usersService;
    }
    extractToken(handshake) {
        const fromAuth = handshake.auth?.['token'];
        if (typeof fromAuth === 'string' && fromAuth.trim().length > 0)
            return fromAuth.trim();
        const fromQuery = handshake.query?.['token'];
        if (typeof fromQuery === 'string' && fromQuery.trim().length > 0)
            return fromQuery.trim();
        if (Array.isArray(fromQuery) && typeof fromQuery[0] === 'string' && fromQuery[0].trim().length > 0) {
            return fromQuery[0].trim();
        }
        return null;
    }
    async verifyToken(token) {
        const secret = this.config.get('JWT_ACCESS_SECRET') ?? 'default_jwt_secret';
        let payload;
        try {
            const decoded = await this.jwtService.verifyAsync(token, { secret });
            payload = decoded;
        }
        catch {
            throw new Error('4401: token không hợp lệ hoặc đã hết hạn');
        }
        const sub = payload['sub'];
        if (typeof sub !== 'string' || sub.trim().length === 0) {
            throw new Error('4401: token thiếu định danh người dùng');
        }
        const user = await this.usersService.findById(sub);
        if (!user || user.status === 'blocked' || user.deletedAt !== null) {
            throw new Error('4401: tài khoản không tồn tại, đã bị khóa hoặc đã xóa');
        }
        return {
            userId: user.id,
            email: user.email,
            role: user.role,
        };
    }
};
exports.RealtimeAuthService = RealtimeAuthService;
exports.RealtimeAuthService = RealtimeAuthService = RealtimeAuthService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [jwt_1.JwtService, config_1.ConfigService, users_service_1.UsersService])
], RealtimeAuthService);
//# sourceMappingURL=realtime-auth.service.js.map