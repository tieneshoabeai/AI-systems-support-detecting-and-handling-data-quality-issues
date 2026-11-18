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
exports.UsersAuthSessionAdapter = void 0;
const common_1 = require("@nestjs/common");
const user_repository_port_1 = require("../../../users/domain/ports/user.repository.port");
let UsersAuthSessionAdapter = class UsersAuthSessionAdapter {
    users;
    constructor(users) {
        this.users = users;
    }
    async createSession(data) {
        const s = await this.users.createSession({
            userId: data.userId,
            refreshTokenHash: data.refreshTokenHash,
            deviceName: data.deviceName,
            ipAddress: data.ipAddress,
            userAgent: data.userAgent,
            expiresAt: data.expiresAt,
        });
        return { id: s.id, userId: s.userId, refreshTokenHash: s.refreshTokenHash, deviceName: s.deviceName ?? null, ipAddress: s.ipAddress ?? null, userAgent: s.userAgent ?? null, isRevoked: s.isRevoked, expiresAt: s.expiresAt };
    }
    findSessionByTokenHashIncludingRevoked(refreshTokenHash) {
        return this.users.findSessionByTokenHashIncludingRevoked(refreshTokenHash);
    }
    findSessionByTokenHash(refreshTokenHash) {
        return this.users.findSessionByTokenHash(refreshTokenHash);
    }
    findActiveSessions(userId) {
        return this.users.findActiveSessions(userId);
    }
    revokeSession(userId, sessionId) {
        return this.users.revokeSession(userId, sessionId);
    }
    revokeSessionById(sessionId) {
        return this.users.revokeSessionById(sessionId);
    }
    revokeAllUserSessions(userId) {
        return this.users.revokeAllUserSessions(userId);
    }
};
exports.UsersAuthSessionAdapter = UsersAuthSessionAdapter;
exports.UsersAuthSessionAdapter = UsersAuthSessionAdapter = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(user_repository_port_1.USER_REPOSITORY_PORT)),
    __metadata("design:paramtypes", [Object])
], UsersAuthSessionAdapter);
//# sourceMappingURL=users-auth-session.adapter.js.map