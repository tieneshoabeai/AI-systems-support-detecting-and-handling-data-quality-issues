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
var ProjectsService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProjectsService = void 0;
const common_1 = require("@nestjs/common");
const project_repository_port_1 = require("../domain/ports/project.repository.port");
const workspace_repository_port_1 = require("../../workspaces/domain/ports/workspace.repository.port");
const user_repository_port_1 = require("../../users/domain/ports/user.repository.port");
const object_id_util_1 = require("../../../shared/utils/object-id.util");
let ProjectsService = ProjectsService_1 = class ProjectsService {
    projects;
    workspaces;
    users;
    logger = new common_1.Logger(ProjectsService_1.name);
    constructor(projects, workspaces, users) {
        this.projects = projects;
        this.workspaces = workspaces;
        this.users = users;
    }
    async createProject(workspaceId, userId, dto) {
        const ws = await this.workspaces.findById(workspaceId);
        if (!ws)
            throw new common_1.NotFoundException('Không tìm thấy không gian làm việc');
        const dup = await this.projects.findOneByWorkspaceAndName(workspaceId, dto.name.trim());
        if (dup)
            throw new common_1.ConflictException('Tên project đã tồn tại trong workspace');
        const project = await this.projects.create({
            workspaceId,
            name: dto.name.trim(),
            description: dto.description ?? '',
            createdBy: userId,
        });
        this.logger.log(`Tạo Project mới: ${project.name} (ID: ${project.id}) trong Workspace: ${workspaceId}`);
        return project;
    }
    async getProjectsByWorkspace(workspaceId) {
        const ws = await this.workspaces.findById(workspaceId);
        if (!ws)
            throw new common_1.NotFoundException('Không tìm thấy không gian làm việc');
        return this.projects.findByWorkspace(workspaceId);
    }
    async listProjectsByWorkspace(workspaceId, q) {
        const ws = await this.workspaces.findById(workspaceId);
        if (!ws)
            throw new common_1.NotFoundException('Không tìm thấy không gian làm việc');
        const page = Math.max(1, Number(q.page) || 1);
        const limit = Math.min(100, Math.max(1, Number(q.limit) || 15));
        const { items, total } = await this.projects.findByWorkspacePaged(workspaceId, q);
        return { items, total, page, limit };
    }
    async getProjectById(id, touch = false) {
        if (!(0, object_id_util_1.isObjectIdHex)(id))
            throw new common_1.BadRequestException('ID Dự án không hợp lệ');
        const project = await this.projects.findById(id);
        if (!project)
            throw new common_1.NotFoundException('Không tìm thấy dự án hoặc dự án đã bị xóa');
        if (touch)
            await this.projects.touchLastAccessed(id).catch(() => undefined);
        return project;
    }
    async updateProject(id, dto) {
        const existing = await this.getProjectById(id);
        if (dto.name && dto.name.trim() !== existing.name) {
            const dup = await this.projects.findOneByWorkspaceAndName(existing.workspaceId, dto.name.trim());
            if (dup && dup.id !== id)
                throw new common_1.ConflictException('Tên project đã tồn tại trong workspace');
        }
        const { expectedVersion, ...patch } = dto;
        const updated = await this.projects.updateById(id, patch, expectedVersion);
        if (!updated) {
            if (expectedVersion !== undefined) {
                const actual = (await this.getProjectById(id).catch(() => existing)).version;
                throw new common_1.ConflictException({
                    message: 'Bản ghi đã bị thay đổi bởi người khác. Vui lòng tải lại (version lệch)',
                    error: 'CONFLICT',
                    details: { expectedVersion, actualVersion: actual },
                });
            }
            throw new common_1.NotFoundException('Không tìm thấy dự án để cập nhật');
        }
        return updated;
    }
    async deleteProject(id) {
        await this.getProjectById(id);
        const deleted = await this.projects.softDelete(id);
        this.logger.log(`Đã xóa mềm Project ID: ${id}`);
        return deleted;
    }
    async setHasDataset(projectId, hasDataset) {
        const p = await this.getProjectById(projectId);
        const ok = await this.projects.setHasDataset(projectId, hasDataset);
        if (hasDataset && p.status === 'not_started')
            await this.projects.setStatus(projectId, 'in_progress');
        if (!hasDataset && p.status !== 'not_started')
            await this.projects.setStatus(projectId, 'not_started');
        return ok;
    }
    async markCompleted(projectId, expectedVersion) {
        const p = await this.getProjectById(projectId);
        if (expectedVersion === undefined) {
            throw new common_1.BadRequestException({
                message: 'Thiếu expectedVersion cho PROJ-12 (optimistic locking)',
                error: 'VALIDATION_ERROR',
            });
        }
        if (p.status !== 'in_progress')
            throw new common_1.BadRequestException('Chỉ project in_progress mới được lưu hoàn tất (completed)');
        const ok = await this.projects.markCompleted(projectId, expectedVersion);
        if (ok === null) {
            const actual = (await this.getProjectById(projectId).catch(() => p)).version;
            throw new common_1.ConflictException({
                message: 'Bản ghi đã bị thay đổi bởi người khác. Vui lòng tải lại (version lệch)',
                error: 'CONFLICT',
                details: { expectedVersion, actualVersion: actual },
            });
        }
        return !!ok;
    }
    async resolveUserProjectRole(projectId, userId, workspaceRole) {
        if (!(0, object_id_util_1.isObjectIdHex)(projectId))
            return null;
        const p = await this.projects.findById(projectId);
        if (!p)
            return null;
        const m = (p.members || []).find((x) => x.userId === userId);
        if (m)
            return m.role;
        if (workspaceRole === 'member')
            return 'viewer';
        if (workspaceRole === 'owner')
            return 'owner';
        return null;
    }
    async addProjectMember(projectId, dto) {
        const p = await this.getProjectById(projectId);
        const target = await this.users.findByEmail(dto.email.trim().toLowerCase());
        if (!target)
            throw new common_1.NotFoundException(`Không tìm thấy người dùng với email: ${dto.email}`);
        if ((p.members || []).some((m) => m.userId === target.id))
            throw new common_1.ConflictException('Người dùng đã là thành viên project');
        await this.projects.addMember(projectId, { userId: target.id, role: dto.role ?? 'viewer' });
        return this.getProjectById(projectId);
    }
    async updateProjectMemberRole(projectId, memberUserId, dto) {
        const p = await this.getProjectById(projectId);
        const m = (p.members || []).find((x) => x.userId === memberUserId);
        if (!m)
            throw new common_1.NotFoundException('Người dùng không thuộc project này');
        if (m.role === 'owner')
            throw new common_1.BadRequestException('Không đổi vai trò Owner tại đây — dùng nhượng quyền (PROJ-11)');
        const okRole = await this.projects.updateMemberRole(projectId, memberUserId, dto.role, dto.expectedVersion);
        if (okRole === null) {
            const actual = (await this.getProjectById(projectId)).version;
            throw new common_1.ConflictException({
                message: 'Bản ghi đã bị thay đổi bởi người khác. Vui lòng tải lại (version lệch)',
                error: 'CONFLICT',
                details: { expectedVersion: dto.expectedVersion, actualVersion: actual },
            });
        }
        return this.getProjectById(projectId);
    }
    async removeProjectMember(projectId, memberUserId) {
        const p = await this.getProjectById(projectId);
        const m = (p.members || []).find((x) => x.userId === memberUserId);
        if (!m)
            throw new common_1.NotFoundException('Người dùng không thuộc project này');
        if (m.role === 'owner')
            throw new common_1.BadRequestException('Không thể xóa Project Owner — hãy nhượng quyền trước (PROJ-11)');
        await this.projects.removeMember(projectId, memberUserId);
        return this.getProjectById(projectId);
    }
    async transferProjectOwner(projectId, actorUserId, dto) {
        const p = await this.getProjectById(projectId);
        const owner = (p.members || []).find((m) => m.role === 'owner');
        if (!owner || owner.userId !== actorUserId)
            throw new common_1.ForbiddenException('Chỉ Project Owner mới được nhượng quyền');
        const target = await this.users.findByEmail(dto.email.trim().toLowerCase());
        if (!target)
            throw new common_1.NotFoundException(`Không tìm thấy người dùng với email: ${dto.email}`);
        if (target.id === actorUserId)
            throw new common_1.BadRequestException('Không thể nhượng cho chính mình');
        const isMember = (p.members || []).some((m) => m.userId === target.id);
        if (!isMember)
            throw new common_1.BadRequestException('Chỉ nhượng cho thành viên project');
        const ok = await this.projects.transferOwner(projectId, target.id, dto.expectedVersion);
        if (ok === null) {
            const actual = (await this.getProjectById(projectId)).version;
            throw new common_1.ConflictException({
                message: 'Bản ghi đã bị thay đổi bởi người khác. Vui lòng tải lại (version lệch)',
                error: 'CONFLICT',
                details: { expectedVersion: dto.expectedVersion, actualVersion: actual },
            });
        }
        if (!ok)
            throw new common_1.NotFoundException('Nhượng quyền thất bại');
        this.logger.log(`PROJ-11 transfer owner ${projectId}: ${actorUserId} -> ${target.id}`);
        return this.getProjectById(projectId);
    }
};
exports.ProjectsService = ProjectsService;
exports.ProjectsService = ProjectsService = ProjectsService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(project_repository_port_1.PROJECT_REPOSITORY_PORT)),
    __param(1, (0, common_1.Inject)(workspace_repository_port_1.WORKSPACE_REPOSITORY_PORT)),
    __param(2, (0, common_1.Inject)(user_repository_port_1.USER_REPOSITORY_PORT)),
    __metadata("design:paramtypes", [Object, Object, Object])
], ProjectsService);
//# sourceMappingURL=projects.service.js.map