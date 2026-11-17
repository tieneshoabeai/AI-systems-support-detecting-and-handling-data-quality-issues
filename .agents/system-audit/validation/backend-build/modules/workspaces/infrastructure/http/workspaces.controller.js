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
exports.WorkspacesController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const workspaces_service_1 = require("../../application/workspaces.service");
const create_workspace_dto_1 = require("./dtos/create-workspace.dto");
const update_workspace_dto_1 = require("./dtos/update-workspace.dto");
const add_member_dto_1 = require("./dtos/add-member.dto");
const transfer_owner_dto_1 = require("./dtos/transfer-owner.dto");
const list_workspaces_query_dto_1 = require("./dtos/list-workspaces-query.dto");
const jwt_auth_guard_1 = require("../../../../shared/guards/jwt-auth.guard");
const policies_guard_1 = require("../../../../shared/casl/policies.guard");
const check_policies_decorator_1 = require("../../../../shared/casl/check-policies.decorator");
const actions_enum_1 = require("../../../../shared/casl/actions.enum");
const current_user_decorator_1 = require("../../../../shared/decorators/current-user.decorator");
const zod_validation_pipe_1 = require("../../../../shared/pipes/zod-validation.pipe");
const api_zod_decorator_1 = require("../../../../shared/swagger/api-zod.decorator");
let WorkspacesController = class WorkspacesController {
    workspacesService;
    constructor(workspacesService) {
        this.workspacesService = workspacesService;
    }
    async createWorkspace(user, dto) {
        const workspace = await this.workspacesService.createWorkspace(user.userId, dto);
        return {
            message: 'Tạo không gian làm việc thành công',
            workspace,
        };
    }
    async listWorkspaces(user, query) {
        const result = await this.workspacesService.listWorkspaces(user, query);
        return { ...result };
    }
    async getWorkspaceById(id) {
        const workspace = await this.workspacesService.getWorkspaceById(id, true);
        return { workspace };
    }
    async updateWorkspace(id, dto) {
        const workspace = await this.workspacesService.updateWorkspace(id, dto);
        return {
            message: 'Cập nhật không gian làm việc thành công',
            workspace,
        };
    }
    async deleteWorkspace(id) {
        await this.workspacesService.deleteWorkspace(id);
    }
    async listMembers(id) {
        const ws = await this.workspacesService.getWorkspaceById(id);
        return { members: ws.members, total: ws.members.length };
    }
    async addMember(id, dto) {
        const workspace = await this.workspacesService.addMember(id, dto);
        return {
            message: 'Thêm thành viên vào không gian làm việc thành công',
            workspace,
        };
    }
    async removeMember(id, userId) {
        const workspace = await this.workspacesService.removeMember(id, userId);
        return {
            message: 'Xóa thành viên khỏi không gian làm việc thành công',
            workspace,
        };
    }
    async transferOwner(id, user, dto) {
        const workspace = await this.workspacesService.transferOwner(id, user.userId, dto);
        return { message: 'Nhượng quyền Owner thành công', workspace };
    }
    async leave(id, user) {
        const r = await this.workspacesService.leaveWorkspace(id, user.userId);
        return { message: 'Rời workspace thành công', ...r };
    }
};
exports.WorkspacesController = WorkspacesController;
__decorate([
    (0, common_1.Post)(),
    (0, swagger_1.ApiOperation)({ summary: 'WS-01: Tạo không gian làm việc mới' }),
    (0, api_zod_decorator_1.ApiZodBody)(create_workspace_dto_1.CreateWorkspaceSchema),
    (0, check_policies_decorator_1.CheckPolicies)((ability) => ability.can(actions_enum_1.Action.Create, 'Workspace')),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)(new zod_validation_pipe_1.ZodValidationPipe(create_workspace_dto_1.CreateWorkspaceSchema))),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], WorkspacesController.prototype, "createWorkspace", null);
__decorate([
    (0, common_1.Get)(),
    (0, swagger_1.ApiOperation)({ summary: 'WS-02: Lấy danh sách workspace (phân trang/tìm kiếm/lọc/sắp xếp)' }),
    (0, check_policies_decorator_1.CheckPolicies)((ability) => ability.can(actions_enum_1.Action.Read, 'Workspace')),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Query)(new zod_validation_pipe_1.ZodValidationPipe(list_workspaces_query_dto_1.ListWorkspacesQuerySchema))),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], WorkspacesController.prototype, "listWorkspaces", null);
__decorate([
    (0, common_1.Get)(':id'),
    (0, swagger_1.ApiOperation)({ summary: 'WS-03: Xem chi tiết không gian làm việc' }),
    (0, check_policies_decorator_1.CheckPolicies)((ability) => ability.can(actions_enum_1.Action.Read, 'Workspace')),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], WorkspacesController.prototype, "getWorkspaceById", null);
__decorate([
    (0, common_1.Patch)(':id'),
    (0, swagger_1.ApiOperation)({ summary: 'WS-04: Cập nhật thông tin không gian làm việc' }),
    (0, api_zod_decorator_1.ApiZodBody)(update_workspace_dto_1.UpdateWorkspaceSchema),
    (0, check_policies_decorator_1.CheckPolicies)((ability) => ability.can(actions_enum_1.Action.Update, 'Workspace')),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)(new zod_validation_pipe_1.ZodValidationPipe(update_workspace_dto_1.UpdateWorkspaceSchema))),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], WorkspacesController.prototype, "updateWorkspace", null);
__decorate([
    (0, common_1.Delete)(':id'),
    (0, common_1.HttpCode)(common_1.HttpStatus.NO_CONTENT),
    (0, swagger_1.ApiOperation)({ summary: 'WS-05: Xóa mềm không gian làm việc' }),
    (0, check_policies_decorator_1.CheckPolicies)((ability) => ability.can(actions_enum_1.Action.Delete, 'Workspace')),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], WorkspacesController.prototype, "deleteWorkspace", null);
__decorate([
    (0, common_1.Get)(':id/members'),
    (0, swagger_1.ApiOperation)({ summary: 'WS-06: Danh sách thành viên workspace' }),
    (0, check_policies_decorator_1.CheckPolicies)((ability) => ability.can(actions_enum_1.Action.Read, 'Workspace')),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], WorkspacesController.prototype, "listMembers", null);
__decorate([
    (0, common_1.Post)(':id/members'),
    (0, swagger_1.ApiOperation)({ summary: 'WS-07: Thêm thành viên vào không gian làm việc' }),
    (0, api_zod_decorator_1.ApiZodBody)(add_member_dto_1.AddMemberSchema),
    (0, check_policies_decorator_1.CheckPolicies)((ability) => ability.can(actions_enum_1.Action.Update, 'Workspace')),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)(new zod_validation_pipe_1.ZodValidationPipe(add_member_dto_1.AddMemberSchema))),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], WorkspacesController.prototype, "addMember", null);
__decorate([
    (0, common_1.Delete)(':id/members/:userId'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, swagger_1.ApiOperation)({ summary: 'Xóa thành viên khỏi không gian làm việc' }),
    (0, check_policies_decorator_1.CheckPolicies)((ability) => ability.can(actions_enum_1.Action.Update, 'Workspace')),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Param)('userId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], WorkspacesController.prototype, "removeMember", null);
__decorate([
    (0, common_1.Post)(':id/transfer-owner'),
    (0, swagger_1.ApiOperation)({ summary: 'WS-09: Nhượng quyền Workspace Owner' }),
    (0, api_zod_decorator_1.ApiZodBody)(transfer_owner_dto_1.TransferOwnerSchema),
    (0, check_policies_decorator_1.CheckPolicies)((ability) => ability.can(actions_enum_1.Action.Update, 'Workspace')),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __param(2, (0, common_1.Body)(new zod_validation_pipe_1.ZodValidationPipe(transfer_owner_dto_1.TransferOwnerSchema))),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Object]),
    __metadata("design:returntype", Promise)
], WorkspacesController.prototype, "transferOwner", null);
__decorate([
    (0, common_1.Post)(':id/leave'),
    (0, swagger_1.ApiOperation)({ summary: 'WS-10: Rời workspace' }),
    (0, check_policies_decorator_1.CheckPolicies)((ability) => ability.can(actions_enum_1.Action.Read, 'Workspace')),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], WorkspacesController.prototype, "leave", null);
exports.WorkspacesController = WorkspacesController = __decorate([
    (0, swagger_1.ApiTags)('Workspaces'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, policies_guard_1.PoliciesGuard),
    (0, common_1.Controller)('workspaces'),
    __metadata("design:paramtypes", [workspaces_service_1.WorkspacesService])
], WorkspacesController);
//# sourceMappingURL=workspaces.controller.js.map