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
exports.UsersService = void 0;
const common_1 = require("@nestjs/common");
const user_role_vo_1 = require("../domain/value-objects/user-role.vo");
const user_repository_port_1 = require("../domain/ports/user.repository.port");
let UsersService = class UsersService {
    users;
    constructor(users) {
        this.users = users;
    }
    async findByEmail(email, includePassword = false) {
        return this.users.findByEmail((0, user_role_vo_1.normalizeEmail)(email), includePassword);
    }
    async findById(id) {
        return this.users.findById(id);
    }
    async findPaged(opts) {
        return this.users.findPaged(opts);
    }
    async createUser(data) {
        const email = (0, user_role_vo_1.normalizeEmail)(data.email);
        const existing = await this.users.findByEmail(email);
        if (existing) {
            throw new common_1.ConflictException('Email này đã được sử dụng bởi một tài khoản khác');
        }
        const input = {
            email,
            passwordHash: data.password_hash,
            firstName: data.first_name,
            lastName: data.last_name,
            role: data.role,
        };
        return this.users.create(input);
    }
    async updateProfile(userId, data) {
        const input = {
            ...(data.first_name !== undefined ? { firstName: data.first_name } : {}),
            ...(data.last_name !== undefined ? { lastName: data.last_name } : {}),
            ...(data.avatar_url !== undefined ? { avatarUrl: data.avatar_url } : {}),
        };
        const updated = await this.users.updateProfile(userId, input);
        if (!updated) {
            throw new common_1.NotFoundException('Không tìm thấy tài khoản người dùng');
        }
        return updated;
    }
    async updateNotificationPreferences(userId, enabled) {
        const ok = await this.users.updateNotificationPreferences(userId, enabled);
        if (!ok) {
            throw new common_1.NotFoundException('Không tìm thấy tài khoản người dùng');
        }
        return enabled;
    }
    async softDeleteUser(userId) {
        const ok = await this.users.softDeleteUser(userId);
        if (!ok) {
            throw new common_1.NotFoundException('Không tìm thấy tài khoản hoặc tài khoản đã bị xóa');
        }
        return true;
    }
    async createSession(data) {
        const input = {
            userId: data.user_id,
            refreshTokenHash: data.refresh_token_hash,
            deviceName: data.device_name,
            ipAddress: data.ip_address,
            userAgent: data.user_agent,
            expiresAt: data.expires_at,
        };
        return this.users.createSession(input);
    }
    async findActiveSessions(userId) {
        return this.users.findActiveSessions(userId);
    }
    async revokeSession(userId, sessionId) {
        return this.users.revokeSession(userId, sessionId);
    }
    async revokeAllUserSessions(userId) {
        return this.users.revokeAllUserSessions(userId);
    }
    async findSessionByTokenHash(refreshTokenHash) {
        return this.users.findSessionByTokenHash(refreshTokenHash);
    }
    async revokeSessionById(sessionId) {
        return this.users.revokeSessionById(sessionId);
    }
};
exports.UsersService = UsersService;
exports.UsersService = UsersService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(user_repository_port_1.USER_REPOSITORY_PORT)),
    __metadata("design:paramtypes", [Object])
], UsersService);
//# sourceMappingURL=users.service.js.map