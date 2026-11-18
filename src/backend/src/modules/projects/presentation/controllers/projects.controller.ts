import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { CreateProjectSchema, CreateProjectDto } from '../dtos/create-project.dto';
import { UpdateProjectSchema, UpdateProjectDto } from '../dtos/update-project.dto';
import { ListProjectsQuerySchema } from '../dtos/list-projects-query.dto';
import { ListProjectMembersQuerySchema } from '../dtos/list-project-members-query.dto';
import {
  AddProjectMemberSchema,
  AddProjectMemberDto,
  UpdateProjectMemberSchema,
  UpdateProjectMemberDto,
  TransferProjectOwnerSchema,
  TransferProjectOwnerDto,
  MarkCompletedSchema,
  MarkCompletedDto,
} from '../dtos/project-member.dto';
import { JwtAuthGuard } from '../../../../shared/interfaces/guards/jwt-auth.guard';
import { PoliciesGuard } from '../../../../shared/interfaces/casl/policies.guard';
import { CheckPolicies } from '../../../../shared/interfaces/casl/check-policies.decorator';
import { PolicyResource } from '../../../../shared/interfaces/casl/policy-resource.decorator';
import { Action } from '../../../../shared/domain/security/action';
import {
  CurrentUser,
  CurrentUserPayload,
} from '../../../../shared/interfaces/decorators/current-user.decorator';
import type { CurrentUser as CurrentUserWithScope } from '../../../../shared/domain/security/current-user';
import { ZodValidationPipe } from '../../../../shared/interfaces/pipes/zod-validation.pipe';
import { ApiZodBody, ApiZodQuery } from '../../../../shared/interfaces/swagger/api-zod.decorator';
import { AddProjectMemberHandler } from '../../application/commands/add-project-member.handler';
import { CreateProjectHandler } from '../../application/commands/create-project.handler';
import { DeleteProjectHandler } from '../../application/commands/delete-project.handler';
import { GetProjectByIdHandler } from '../../application/queries/get-project-by-id.handler';
import { GetWorkspaceNameHandler } from '../../application/queries/get-workspace-name.handler';
import { ListMembersHandler } from '../../application/queries/list-members.handler';
import { ListProjectsByWorkspaceHandler } from '../../application/queries/list-projects-by-workspace.handler';
import { ListAllProjectsHandler } from '../../application/queries/list-all-projects.handler';
import { MarkCompletedHandler } from '../../application/commands/mark-completed.handler';
import { RemoveProjectMemberHandler } from '../../application/commands/remove-project-member.handler';
import { TransferProjectOwnerHandler } from '../../application/commands/transfer-project-owner.handler';
import { UpdateProjectHandler } from '../../application/commands/update-project.handler';
import { UpdateProjectMemberRoleHandler } from '../../application/commands/update-project-member-role.handler';
import { ProjectPolicyLoader } from '../../application/policy-loaders/project-policy.loader';
import { WorkspaceScopePolicyLoader } from '../../application/policy-loaders/workspace-scope-policy.loader';
import type { ProjectMemberView } from '../..';
import type { CursorMeta } from '../../../../shared/domain/pagination/cursor-paginated.response';
import {
  toProjectResponse,
  toProjectResponses,
  type ProjectResponse,
} from '../responses/project.response';

@ApiTags('Projects')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PoliciesGuard)
@Controller()
export class ProjectsController {
  constructor(
    private readonly addProjectMemberHandler: AddProjectMemberHandler,

    private readonly createProjectHandler: CreateProjectHandler,

    private readonly deleteProjectHandler: DeleteProjectHandler,

    private readonly getProjectByIdHandler: GetProjectByIdHandler,

    private readonly markCompletedHandler: MarkCompletedHandler,

    private readonly removeProjectMemberHandler: RemoveProjectMemberHandler,

    private readonly transferProjectOwnerHandler: TransferProjectOwnerHandler,

    private readonly updateProjectMemberRoleHandler: UpdateProjectMemberRoleHandler,

    private readonly updateProjectHandler: UpdateProjectHandler,

    private readonly getWorkspaceNameHandler: GetWorkspaceNameHandler,

    private readonly listMembersHandler: ListMembersHandler,

    private readonly listProjectsByWorkspaceHandler: ListProjectsByWorkspaceHandler,

    private readonly listAllProjectsHandler: ListAllProjectsHandler,
  ) {}

  @Post('workspaces/:workspaceId/projects')
  @ApiOperation({ summary: 'PROJ-01: Tạo dự án mới trong không gian làm việc' })
  @ApiZodBody(CreateProjectSchema)
  // UC-05: chỉ WS-OWNER tạo project → instance check theo `workspace_id`.
  @PolicyResource('Project', WorkspaceScopePolicyLoader, 'workspaceId')
  @CheckPolicies((ability) => ability.can(Action.Create, 'Project'))
  @ApiResponse({ status: 201, description: 'Tạo mới thành công' })
  async createProject(
    @Param('workspaceId') workspaceId: string,
    @CurrentUser() user: CurrentUserPayload,
    @Body(new ZodValidationPipe(CreateProjectSchema)) dto: CreateProjectDto,
  ): Promise<{ message: string; project: ProjectResponse; }> {
    const project = await this.createProjectHandler.execute(workspaceId, user.userId, dto);
    return {
      message: 'Tạo dự án thành công',
      project: toProjectResponse(project),
    };
  }

  @Get('workspaces/:workspaceId/projects')
  @ApiOperation({
    summary: 'PROJ-02: Danh sách project (phân trang cursor/tìm kiếm/lọc status/sắp xếp)',
    description:
      'Phân trang keyset: dùng `meta.nextCursor` làm tham số `cursor` của request kế tiếp. ' +
      'Response: `{ items, meta: { nextCursor, hasMore, limit } }` — không có `total`/`page`.',
  })
  @ApiZodQuery(ListProjectsQuerySchema)
  // PROJ-02: WS-OWNER và WS-MEMBER đều xem được danh sách project.
  @PolicyResource('Project', WorkspaceScopePolicyLoader, 'workspaceId')
  @CheckPolicies((ability) => ability.can(Action.Read, 'Project'))
  @ApiResponse({ status: 200, description: 'Thành công' })
  async listByWorkspace(
    @Param('workspaceId') workspaceId: string,
    @Query(new ZodValidationPipe(ListProjectsQuerySchema)) query: Record<string, unknown>,
  ): Promise<{ items: ProjectResponse[]; meta: CursorMeta; }> {
    const result = await this.listProjectsByWorkspaceHandler.execute(workspaceId, query as never);
    return { items: toProjectResponses(result.items), meta: result.meta };
  }

  /**
   * PROJ-02b — Danh sách project **toàn hệ thống** (không giới hạn theo workspace).
   *
   * Khác `GET /workspaces/:workspaceId/projects` (PROJ-02) ở chỗ endpoint này
   * **không** gắn với một workspace cụ thể: trả về mọi project mà người dùng
   * có quyền đọc, gom từ mọi workspace (project thuộc workspace user làm chủ /
   * thành viên, hoặc project user trực tiếp là thành viên / người tạo).
   *
   * Dùng cho màn hình "Danh sách dự án" — người dùng chọn project mà không cần
   * biết nó nằm ở workspace nào.
   *
   * Phân trang keyset giống PROJ-02: `{ items, meta: { nextCursor, hasMore, limit } }`.
   */
  @Get('projects')
  @ApiOperation({
    summary: 'PROJ-02b: Danh sách project toàn hệ thống (không theo workspace)',
    description:
      'Trả về mọi project người dùng có quyền đọc, gom từ tất cả workspace. ' +
      'Phân trang keyset: dùng `meta.nextCursor` làm tham số `cursor` của request kế tiếp. ' +
      'Response: `{ items, meta: { nextCursor, hasMore, limit } }`.',
  })
  @ApiResponse({ status: 200, description: 'Danh sách project + cursor phân trang' })
  @ApiZodQuery(ListProjectsQuerySchema)
  // PROJ-02b: đọc project — không cần instance check (đã lọc theo quyền ở query).
  @CheckPolicies((ability) => ability.can(Action.Read, 'Project'))
  async listAllProjects(
    @CurrentUser() user: CurrentUserWithScope,
    @Query(new ZodValidationPipe(ListProjectsQuerySchema)) query: Record<string, unknown>,
  ): Promise<{ items: ProjectResponse[]; meta: CursorMeta; }> {
    // Admin (`can(Action.Manage, 'all')`) xem được toàn bộ project → không lọc.
    const isAdmin = user.role === 'admin';
    const workspaceIds = isAdmin
      ? []
      : [...(user.ownedWorkspaceIds ?? []), ...(user.workspaceIds ?? [])];
    const result = await this.listAllProjectsHandler.execute(
      user.userId,
      workspaceIds,
      query as never,
      isAdmin,
    );
    return { items: toProjectResponses(result.items), meta: result.meta };
  }

  @Get('projects/:id')
  @ApiOperation({ summary: 'PROJ-03: Xem chi tiết dự án' })
  @PolicyResource('Project', ProjectPolicyLoader)
  @CheckPolicies((ability) => ability.can(Action.Read, 'Project'))
  @ApiResponse({ status: 200, description: 'Thành công' })
  async getProjectById(@Param('id') id: string): Promise<{ project: ProjectResponse & { workspaceName: string | null; }; }> {
    const project = await this.getProjectByIdHandler.execute(id, true);
    // H3 — kèm tên workspace để frontend không cần gọi thêm 1 request.
    const workspaceName = await this.getWorkspaceNameHandler.execute(project.workspaceId);
    return {
      project: { ...toProjectResponse(project), workspaceName },
    };
  }

  @Patch('projects/:id')
  @ApiOperation({ summary: 'PROJ-04: Cập nhật thông tin dự án' })
  @ApiZodBody(UpdateProjectSchema)
  // PROJ-04: chỉ PROJ-OWNER hoặc WS-OWNER được sửa thông tin project.
  @PolicyResource('Project', ProjectPolicyLoader)
  @CheckPolicies((ability) => ability.can(Action.Update, 'Project'))
  @ApiResponse({ status: 200, description: 'Thành công' })
  async updateProject(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(UpdateProjectSchema)) dto: UpdateProjectDto,
  ): Promise<{ message: string; project: ProjectResponse; }> {
    const project = await this.updateProjectHandler.execute(id, dto);
    return {
      message: 'Cập nhật dự án thành công',
      project: toProjectResponse(project),
    };
  }

  @Delete('projects/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'PROJ-05: Xóa mềm dự án' })
  // PROJ-05: chỉ WS-OWNER được xoá project.
  @PolicyResource('Project', ProjectPolicyLoader)
  @CheckPolicies((ability) => ability.can(Action.Delete, 'Project'))
  @ApiResponse({ status: 204, description: 'Thành công, không có nội dung phản hồi' })
  async deleteProject(@Param('id') id: string): Promise<void> {
    await this.deleteProjectHandler.execute(id);
  }

  @Put('projects/:id/snapshot')
  @ApiOperation({ summary: 'PROJ-12: Lưu trạng thái project (optimistic locking)' })
  @ApiZodBody(MarkCompletedSchema)
  // PROJ-12 / UC-25: PROJ-MEMBER trở lên đều được lưu trạng thái project.
  @PolicyResource('Project', ProjectPolicyLoader)
  @CheckPolicies((ability) => ability.can(Action.Execute, 'Project'))
  @ApiResponse({ status: 200, description: 'Thành công' })
  async markCompleted(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(MarkCompletedSchema)) dto: MarkCompletedDto,
  ): Promise<{ project: ProjectResponse; }> {
    await this.markCompletedHandler.execute(id, dto.expectedVersion);
    const project = await this.getProjectByIdHandler.execute(id);
    return { project: toProjectResponse(project) };
  }

  @Get('projects/:id/members')
  @ApiOperation({
    summary: 'PROJ-09: Danh sách thành viên project (tìm kiếm/lọc/phân trang cursor)',
    description:
      'Phân trang keyset: dùng `meta.nextCursor` làm tham số `cursor` của request kế tiếp. ' +
      'Response: `{ items, meta: { nextCursor, hasMore, limit } }` — không có `total`/`page`.',
  })
  @ApiZodQuery(ListProjectMembersQuerySchema)
  @PolicyResource('Project', ProjectPolicyLoader)
  @CheckPolicies((ability) => ability.can(Action.Read, 'Project'))
  @ApiResponse({ status: 200, description: 'Thành công' })
  async listMembers(
    @Param('id') id: string,
    @Query(new ZodValidationPipe(ListProjectMembersQuerySchema)) query: Record<string, unknown>,
  ): Promise<{ items: ProjectMemberView[]; meta: CursorMeta; }> {
    const result = await this.listMembersHandler.execute(id, query as never);
    return { ...result };
  }

  @Post('projects/:id/members')
  @ApiOperation({ summary: 'PROJ-09: Thêm thành viên project' })
  @ApiZodBody(AddProjectMemberSchema)
  // UC-06: quản lý thành viên project chỉ PROJ-OWNER hoặc WS-OWNER.
  @PolicyResource('Project', ProjectPolicyLoader)
  @CheckPolicies((ability) => ability.can(Action.Update, 'Project'))
  @ApiResponse({ status: 201, description: 'Tạo mới thành công' })
  async addMember(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(AddProjectMemberSchema)) dto: AddProjectMemberDto,
  ): Promise<{ message: string; project: ProjectResponse; }> {
    const project = await this.addProjectMemberHandler.execute(id, dto);
    return {
      message: 'Thêm thành viên project thành công',
      project: toProjectResponse(project),
    };
  }

  @Patch('projects/:id/members/:userId')
  @ApiOperation({ summary: 'PROJ-10: Đổi vai trò thành viên project' })
  @ApiZodBody(UpdateProjectMemberSchema)
  // PROJ-10: chỉ PROJ-OWNER (hoặc WS-OWNER tiếp quản).
  @PolicyResource('Project', ProjectPolicyLoader)
  @CheckPolicies((ability) => ability.can(Action.Update, 'Project'))
  @ApiResponse({ status: 200, description: 'Thành công' })
  async updateMember(
    @Param('id') id: string,
    @Param('userId') userId: string,
    @Body(new ZodValidationPipe(UpdateProjectMemberSchema)) dto: UpdateProjectMemberDto,
  ): Promise<{ message: string; project: ProjectResponse; }> {
    const project = await this.updateProjectMemberRoleHandler.execute(id, userId, dto);
    return {
      message: 'Cập nhật vai trò thành viên thành công',
      project: toProjectResponse(project),
    };
  }

  @Delete('projects/:id/members/:userId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Xóa thành viên khỏi project' })
  // Quản lý thành viên project chỉ PROJ-OWNER hoặc WS-OWNER.
  @PolicyResource('Project', ProjectPolicyLoader)
  @CheckPolicies((ability) => ability.can(Action.Update, 'Project'))
  @ApiResponse({ status: 200, description: 'Thành công' })
  async removeMember(@Param('id') id: string, @Param('userId') userId: string): Promise<{ message: string; project: ProjectResponse; }> {
    const project = await this.removeProjectMemberHandler.execute(id, userId);
    return {
      message: 'Xóa thành viên project thành công',
      project: toProjectResponse(project),
    };
  }

  @Post('projects/:id/transfer-owner')
  @ApiOperation({ summary: 'PROJ-11: Nhượng quyền Project Owner' })
  @ApiZodBody(TransferProjectOwnerSchema)
  // PROJ-11: chỉ PROJ-OWNER (hoặc WS-OWNER tiếp quản) được nhượng quyền.
  @PolicyResource('Project', ProjectPolicyLoader)
  @CheckPolicies((ability) => ability.can(Action.Update, 'Project'))
  @ApiResponse({ status: 201, description: 'Tạo mới thành công' })
  async transferOwner(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserPayload,
    @Body(new ZodValidationPipe(TransferProjectOwnerSchema)) dto: TransferProjectOwnerDto,
  ): Promise<{ message: string; project: ProjectResponse; }> {
    const project = await this.transferProjectOwnerHandler.execute(id, user.userId, dto);
    return {
      message: 'Nhượng quyền Project Owner thành công',
      project: toProjectResponse(project),
    };
  }
}
