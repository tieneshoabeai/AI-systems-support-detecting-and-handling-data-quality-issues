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
exports.ProjectsController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const projects_service_1 = require("../../application/projects.service");
const create_project_dto_1 = require("./dtos/create-project.dto");
const update_project_dto_1 = require("./dtos/update-project.dto");
const list_projects_query_dto_1 = require("./dtos/list-projects-query.dto");
const project_member_dto_1 = require("./dtos/project-member.dto");
const jwt_auth_guard_1 = require("../../../../shared/guards/jwt-auth.guard");
const policies_guard_1 = require("../../../../shared/casl/policies.guard");
const check_policies_decorator_1 = require("../../../../shared/casl/check-policies.decorator");
const actions_enum_1 = require("../../../../shared/casl/actions.enum");
const current_user_decorator_1 = require("../../../../shared/decorators/current-user.decorator");
const zod_validation_pipe_1 = require("../../../../shared/pipes/zod-validation.pipe");
const api_zod_decorator_1 = require("../../../../shared/swagger/api-zod.decorator");
let ProjectsController = class ProjectsController {
    projectsService;
    constructor(projectsService) {
        this.projectsService = projectsService;
    }
    async createProject(workspaceId, user, dto) {
        const project = await this.projectsService.createProject(workspaceId, user.userId, dto);
        return {
            message: 'Tạo dự án thành công',
            project,
        };
    }
    async listByWorkspace(workspaceId, query) {
        const result = await this.projectsService.listProjectsByWorkspace(workspaceId, query);
        return { ...result };
    }
    async getProjectById(id) {
        const project = await this.projectsService.getProjectById(id, true);
        return { project };
    }
    async updateProject(id, dto) {
        const project = await this.projectsService.updateProject(id, dto);
        return {
            message: 'Cập nhật dự án thành công',
            project,
        };
    }
    async deleteProject(id) {
        await this.projectsService.deleteProject(id);
    }
    async markCompleted(id, dto) {
        await this.projectsService.markCompleted(id, dto.expectedVersion);
        const project = await this.projectsService.getProjectById(id);
        return { project };
    }
    async listMembers(id) {
        const p = await this.projectsService.getProjectById(id);
        return { members: p.members ?? [], total: (p.members ?? []).length };
    }
    async addMember(id, dto) {
        const project = await this.projectsService.addProjectMember(id, dto);
        return { message: 'Thêm thành viên project thành công', project };
    }
    async updateMember(id, userId, dto) {
        const project = await this.projectsService.updateProjectMemberRole(id, userId, dto);
        return { message: 'Cập nhật vai trò thành viên thành công', project };
    }
    async removeMember(id, userId) {
        const project = await this.projectsService.removeProjectMember(id, userId);
        return { message: 'Xóa thành viên project thành công', project };
    }
    async transferOwner(id, user, dto) {
        const project = await this.projectsService.transferProjectOwner(id, user.userId, dto);
        return { message: 'Nhượng quyền Project Owner thành công', project };
    }
};
exports.ProjectsController = ProjectsController;
__decorate([
    (0, common_1.Post)('workspaces/:workspaceId/projects'),
    (0, swagger_1.ApiOperation)({ summary: 'PROJ-01: Tạo dự án mới trong không gian làm việc' }),
    (0, api_zod_decorator_1.ApiZodBody)(create_project_dto_1.CreateProjectSchema),
    (0, check_policies_decorator_1.CheckPolicies)((ability) => ability.can(actions_enum_1.Action.Create, 'Project')),
    __param(0, (0, common_1.Param)('workspaceId')),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __param(2, (0, common_1.Body)(new zod_validation_pipe_1.ZodValidationPipe(create_project_dto_1.CreateProjectSchema))),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Object]),
    __metadata("design:returntype", Promise)
], ProjectsController.prototype, "createProject", null);
__decorate([
    (0, common_1.Get)('workspaces/:workspaceId/projects'),
    (0, swagger_1.ApiOperation)({ summary: 'PROJ-02: Danh sách project (phân trang/tìm kiếm/lọc status/sắp xếp)' }),
    (0, check_policies_decorator_1.CheckPolicies)((ability) => ability.can(actions_enum_1.Action.Read, 'Project')),
    __param(0, (0, common_1.Param)('workspaceId')),
    __param(1, (0, common_1.Query)(new zod_validation_pipe_1.ZodValidationPipe(list_projects_query_dto_1.ListProjectsQuerySchema))),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], ProjectsController.prototype, "listByWorkspace", null);
__decorate([
    (0, common_1.Get)('projects/:id'),
    (0, swagger_1.ApiOperation)({ summary: 'PROJ-03: Xem chi tiết dự án' }),
    (0, check_policies_decorator_1.CheckPolicies)((ability) => ability.can(actions_enum_1.Action.Read, 'Project')),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], ProjectsController.prototype, "getProjectById", null);
__decorate([
    (0, common_1.Patch)('projects/:id'),
    (0, swagger_1.ApiOperation)({ summary: 'PROJ-04: Cập nhật thông tin dự án' }),
    (0, api_zod_decorator_1.ApiZodBody)(update_project_dto_1.UpdateProjectSchema),
    (0, check_policies_decorator_1.CheckPolicies)((ability) => ability.can(actions_enum_1.Action.Update, 'Project')),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)(new zod_validation_pipe_1.ZodValidationPipe(update_project_dto_1.UpdateProjectSchema))),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], ProjectsController.prototype, "updateProject", null);
__decorate([
    (0, common_1.Delete)('projects/:id'),
    (0, common_1.HttpCode)(common_1.HttpStatus.NO_CONTENT),
    (0, swagger_1.ApiOperation)({ summary: 'PROJ-05: Xóa mềm dự án' }),
    (0, check_policies_decorator_1.CheckPolicies)((ability) => ability.can(actions_enum_1.Action.Delete, 'Project')),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], ProjectsController.prototype, "deleteProject", null);
__decorate([
    (0, common_1.Put)('projects/:id/snapshot'),
    (0, swagger_1.ApiOperation)({ summary: 'PROJ-12: Lưu trạng thái project (optimistic locking)' }),
    (0, api_zod_decorator_1.ApiZodBody)(project_member_dto_1.MarkCompletedSchema),
    (0, check_policies_decorator_1.CheckPolicies)((ability) => ability.can(actions_enum_1.Action.Update, 'Project')),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)(new zod_validation_pipe_1.ZodValidationPipe(project_member_dto_1.MarkCompletedSchema))),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], ProjectsController.prototype, "markCompleted", null);
__decorate([
    (0, common_1.Get)('projects/:id/members'),
    (0, swagger_1.ApiOperation)({ summary: 'PROJ-09: Danh sách thành viên project' }),
    (0, check_policies_decorator_1.CheckPolicies)((ability) => ability.can(actions_enum_1.Action.Read, 'Project')),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], ProjectsController.prototype, "listMembers", null);
__decorate([
    (0, common_1.Post)('projects/:id/members'),
    (0, swagger_1.ApiOperation)({ summary: 'PROJ-09: Thêm thành viên project' }),
    (0, api_zod_decorator_1.ApiZodBody)(project_member_dto_1.AddProjectMemberSchema),
    (0, check_policies_decorator_1.CheckPolicies)((ability) => ability.can(actions_enum_1.Action.Update, 'Project')),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)(new zod_validation_pipe_1.ZodValidationPipe(project_member_dto_1.AddProjectMemberSchema))),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], ProjectsController.prototype, "addMember", null);
__decorate([
    (0, common_1.Patch)('projects/:id/members/:userId'),
    (0, swagger_1.ApiOperation)({ summary: 'PROJ-10: Đổi vai trò thành viên project' }),
    (0, api_zod_decorator_1.ApiZodBody)(project_member_dto_1.UpdateProjectMemberSchema),
    (0, check_policies_decorator_1.CheckPolicies)((ability) => ability.can(actions_enum_1.Action.Update, 'Project')),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Param)('userId')),
    __param(2, (0, common_1.Body)(new zod_validation_pipe_1.ZodValidationPipe(project_member_dto_1.UpdateProjectMemberSchema))),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, Object]),
    __metadata("design:returntype", Promise)
], ProjectsController.prototype, "updateMember", null);
__decorate([
    (0, common_1.Delete)('projects/:id/members/:userId'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, swagger_1.ApiOperation)({ summary: 'Xóa thành viên khỏi project' }),
    (0, check_policies_decorator_1.CheckPolicies)((ability) => ability.can(actions_enum_1.Action.Update, 'Project')),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Param)('userId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], ProjectsController.prototype, "removeMember", null);
__decorate([
    (0, common_1.Post)('projects/:id/transfer-owner'),
    (0, swagger_1.ApiOperation)({ summary: 'PROJ-11: Nhượng quyền Project Owner' }),
    (0, api_zod_decorator_1.ApiZodBody)(project_member_dto_1.TransferProjectOwnerSchema),
    (0, check_policies_decorator_1.CheckPolicies)((ability) => ability.can(actions_enum_1.Action.Update, 'Project')),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __param(2, (0, common_1.Body)(new zod_validation_pipe_1.ZodValidationPipe(project_member_dto_1.TransferProjectOwnerSchema))),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Object]),
    __metadata("design:returntype", Promise)
], ProjectsController.prototype, "transferOwner", null);
exports.ProjectsController = ProjectsController = __decorate([
    (0, swagger_1.ApiTags)('Projects'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, policies_guard_1.PoliciesGuard),
    (0, common_1.Controller)(),
    __metadata("design:paramtypes", [projects_service_1.ProjectsService])
], ProjectsController);
//# sourceMappingURL=projects.controller.js.map