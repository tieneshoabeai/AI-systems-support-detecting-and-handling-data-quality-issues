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
exports.UsersAuthLookupAdapter = void 0;
const common_1 = require("@nestjs/common");
const user_repository_port_1 = require("../../../users/domain/ports/user.repository.port");
let UsersAuthLookupAdapter = class UsersAuthLookupAdapter {
    users;
    constructor(users) {
        this.users = users;
    }
    async findByEmail(email, includePassword) {
        const u = await this.users.findByEmail(email, includePassword);
        if (!u)
            return null;
        return { id: u.id, email: u.email, role: u.role, status: u.status, passwordHash: u.passwordHash ?? null, deletedAt: u.deletedAt };
    }
    async findById(id) {
        const u = await this.users.findById(id);
        if (!u)
            return null;
        return { id: u.id, email: u.email, role: u.role, status: u.status, passwordHash: u.passwordHash ?? null, deletedAt: u.deletedAt };
    }
    async create(data) {
        const u = await this.users.create(data);
        return { id: u.id, email: u.email, role: u.role, status: u.status, passwordHash: u.passwordHash ?? null, deletedAt: u.deletedAt };
    }
    async findByEmailWithResetSecret(email) {
        return this.users.findByEmailWithResetSecret(email);
    }
    async findByIdWithResetSecret(id) {
        return this.users.findByIdWithResetSecret(id);
    }
    async setPasswordResetOtp(email, tokenHash, expiresAt, sentCount, windowStart) {
        return this.users.setPasswordResetOtp(email, tokenHash, expiresAt, sentCount, windowStart);
    }
    async incrementResetAttempts(email) {
        return this.users.incrementResetAttempts(email);
    }
    async clearPasswordReset(email) {
        return this.users.clearPasswordReset(email);
    }
    async setPasswordHash(userId, passwordHash) {
        return this.users.setPasswordHash(userId, passwordHash);
    }
};
exports.UsersAuthLookupAdapter = UsersAuthLookupAdapter;
exports.UsersAuthLookupAdapter = UsersAuthLookupAdapter = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(user_repository_port_1.USER_REPOSITORY_PORT)),
    __metadata("design:paramtypes", [Object])
], UsersAuthLookupAdapter);
//# sourceMappingURL=users-auth-lookup.adapter.js.map