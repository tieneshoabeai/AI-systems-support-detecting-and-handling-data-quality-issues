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
var WorkspacesService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.WorkspacesService = void 0;
const common_1 = require("@nestjs/common");
const workspace_repository_port_1 = require("../domain/ports/workspace.repository.port");
const workspace_entity_1 = require("../domain/entities/workspace.entity");
const user_repository_port_1 = require("../../users/domain/ports/user.repository.port");
const object_id_util_1 = require("../../../shared/utils/object-id.util");
let WorkspacesService = WorkspacesService_1 = class WorkspacesService {
    workspaces;
    users;
    logger = new common_1.Logger(WorkspacesService_1.name);
    constructor(workspaces, users) {
        this.workspaces = workspaces;
        this.users = users;
    }
    async createWorkspace(userId, dto) {
        const workspace = await this.workspaces.create({
            name: dto.name,
            description: dto.description ?? '',
            ownerId: userId,
        });
        this.logger.log(`Tạo Workspace mới: ${workspace.name} (ID: ${workspace.id}) bởi User: ${userId}`);
        return workspace;
    }
    async getWorkspaces(user) {
        if (user.role === 'admin')
            return this.workspaces.findAllActive();
        return this.workspaces.findByUser(user.userId);
    }
    async listWorkspaces(user, q) {
        const page = Math.max(1, Number(q.page) || 1);
        const limit = Math.min(100, Math.max(1, Number(q.limit) || 15));
        if (user.role === 'admin') {
            const all = await this.workspaces.findAllActive();
            let items = all;
            if (q.search?.trim()) {
                const s = q.search.trim().toLowerCase();
                items = items.filter((w) => w.name.toLowerCase().includes(s));
            }
            if (q.role === 'owner')
                items = items.filter((w) => w.ownerId === user.userId);
            if (q.role === 'member')
                items = items.filter((w) => w.ownerId !== user.userId);
            const sort = q.sort || 'last_accessed';
            items = [...items].sort((a, b) => {
                if (sort === 'name_asc')
                    return a.name.localeCompare(b.name);
                if (sort === 'name_desc')
                    return b.name.localeCompare(a.name);
                const av = sort === 'updated' ? a.updatedAt?.getTime() ?? 0 : (a.lastAccessedAt?.getTime() ?? a.updatedAt?.getTime() ?? 0);
                const bv = sort === 'updated' ? b.updatedAt?.getTime() ?? 0 : (b.lastAccessedAt?.getTime() ?? b.updatedAt?.getTime() ?? 0);
                return bv - av;
            });
            const total = items.length;
            return { items: items.slice((page - 1) * limit, page * limit), total, page, limit };
        }
        const { items, total } = await this.workspaces.findByUserPaged(user.userId, q);
        return { items, total, page, limit };
    }
    async getWorkspaceById(id, touch = false) {
        if (!(0, object_id_util_1.isObjectIdHex)(id))
            throw new common_1.BadRequestException('ID Không gian làm việc không hợp lệ');
        const workspace = await this.workspaces.findById(id);
        if (!workspace)
            throw new common_1.NotFoundException('Không tìm thấy không gian làm việc hoặc đã bị xóa');
        if (touch)
            await this.workspaces.touchLastAccessed(id).catch(() => undefined);
        return workspace;
    }
    async updateWorkspace(id, dto) {
        const existing = await this.getWorkspaceById(id);
        const { expectedVersion, ...patch } = dto;
        const updated = await this.workspaces.updateById(id, patch, expectedVersion);
        if (!updated) {
            if (expectedVersion !== undefined && existing.version !== expectedVersion) {
                throw new common_1.ConflictException({
                    message: 'Bản ghi đã bị thay đổi bởi người khác. Vui lòng tải lại (version lệch)',
                    error: 'CONFLICT',
                    details: { expectedVersion, actualVersion: (await this.getWorkspaceById(id).catch(() => existing)).version },
                });
            }
            throw new common_1.NotFoundException('Không tìm thấy không gian làm việc để cập nhật');
        }
        return updated;
    }
    async deleteWorkspace(id) {
        await this.getWorkspaceById(id);
        const deleted = await this.workspaces.softDelete(id);
        this.logger.log(`Đã xóa mềm Workspace ID: ${id}`);
        return deleted;
    }
    async addMember(workspaceId, dto) {
        const workspace = await this.getWorkspaceById(workspaceId);
        const targetUser = await this.users.findByEmail(dto.email);
        if (!targetUser)
            throw new common_1.NotFoundException(`Không tìm thấy người dùng với email: ${dto.email}`);
        const targetUserIdStr = targetUser.id;
        if (workspace.members.some((m) => m.userId === targetUserIdStr)) {
            throw new common_1.ConflictException('Người dùng này đã là thành viên của không gian làm việc');
        }
        await this.workspaces.addMember(workspaceId, { userId: targetUserIdStr, role: dto.role ?? 'member', joinedAt: new Date() });
        return this.getWorkspaceById(workspaceId);
    }
    async removeMember(workspaceId, memberUserId) {
        const workspace = await this.getWorkspaceById(workspaceId);
        if (workspace.ownerId === memberUserId) {
            throw new common_1.BadRequestException('Không thể xóa chủ sở hữu chính của không gian làm việc');
        }
        if (!workspace.members.some((m) => m.userId === memberUserId)) {
            throw new common_1.NotFoundException('Người dùng không thuộc danh sách thành viên của không gian này');
        }
        await this.workspaces.removeMember(workspaceId, memberUserId);
        return this.getWorkspaceById(workspaceId);
    }
    async transferOwner(workspaceId, actorUserId, dto) {
        const workspace = await this.getWorkspaceById(workspaceId);
        const targetUser = await this.users.findByEmail(dto.email);
        if (!targetUser)
            throw new common_1.NotFoundException(`Không tìm thấy người dùng với email: ${dto.email}`);
        const targetId = targetUser.id;
        try {
            workspace_entity_1.Workspace.create({
                id: workspace.id, name: workspace.name, ownerId: workspace.ownerId,
                members: workspace.members.map((m) => ({ userId: m.userId, role: m.role, joinedAt: m.joinedAt })),
            }).assertCanTransfer(actorUserId, targetId);
        }
        catch (e) {
            const message = e instanceof Error ? e.message : String(e);
            if (message.includes('nhượng quyền') || message.includes('chính mình') || message.includes('thành viên')) {
                if (message.includes('Owner'))
                    throw new common_1.ForbiddenException(message);
                throw new common_1.BadRequestException(message);
            }
            throw e;
        }
        const ok = await this.workspaces.transferOwner(workspaceId, targetId, dto.expectedVersion);
        if (ok === null) {
            const actual = (await this.getWorkspaceById(workspaceId)).version;
            throw new common_1.ConflictException({
                message: 'Bản ghi đã bị thay đổi bởi người khác. Vui lòng tải lại (version lệch)',
                error: 'CONFLICT',
                details: { expectedVersion: dto.expectedVersion, actualVersion: actual },
            });
        }
        if (!ok)
            throw new common_1.NotFoundException('Nhượng quyền thất bại');
        this.logger.log(`WS-09 transfer owner ${workspaceId}: ${actorUserId} -> ${targetId}`);
        return this.getWorkspaceById(workspaceId);
    }
    async leaveWorkspace(workspaceId, userId) {
        const workspace = await this.getWorkspaceById(workspaceId);
        if (workspace.ownerId === userId)
            throw new common_1.BadRequestException('Workspace Owner phải nhượng quyền trước khi rời (WS-09)');
        if (!workspace.members.some((m) => m.userId === userId))
            throw new common_1.NotFoundException('Bạn không phải thành viên workspace này');
        await this.workspaces.removeMember(workspaceId, userId);
        return { left: true };
    }
    async incrementStorageUsed(workspaceId, deltaBytes) {
        await this.workspaces.addStorageUsed(workspaceId, deltaBytes).catch(() => undefined);
    }
    async checkWorkspaceUploadQuota(workspaceId, incomingBytes, quotaBytes) {
        const ws = await this.getWorkspaceById(workspaceId);
        const used = ws.storageUsedBytes ?? 0;
        if (used + incomingBytes > quotaBytes) {
            throw new common_1.HttpException({
                message: `Vượt quota workspace: đã dùng ${used}B + thêm ${incomingBytes}B > giới hạn ${quotaBytes}B (§3.8: 500 MB/workspace)`,
                error: 'LIMIT_EXCEEDED',
                details: { usedBytes: used, incomingBytes, quotaBytes },
            }, common_1.HttpStatus.TOO_MANY_REQUESTS);
        }
    }
    async resolveUserWorkspaceRole(workspaceId, userId) {
        if (!(0, object_id_util_1.isObjectIdHex)(workspaceId))
            return null;
        const workspace = await this.workspaces.findById(workspaceId);
        if (!workspace)
            return null;
        if (workspace.ownerId === userId)
            return 'owner';
        const member = workspace.members.find((m) => m.userId === userId);
        if (!member)
            return null;
        if (member.role === 'editor' || member.role === 'viewer')
            return 'member';
        return member.role;
    }
};
exports.WorkspacesService = WorkspacesService;
exports.WorkspacesService = WorkspacesService = WorkspacesService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(workspace_repository_port_1.WORKSPACE_REPOSITORY_PORT)),
    __param(1, (0, common_1.Inject)(user_repository_port_1.USER_REPOSITORY_PORT)),
    __metadata("design:paramtypes", [Object, Object])
], WorkspacesService);
//# sourceMappingURL=workspaces.service.js.map