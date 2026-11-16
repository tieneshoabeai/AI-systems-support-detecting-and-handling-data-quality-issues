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
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { CreateProjectSchema, CreateProjectDto } from './dtos/create-project.dto';
import { UpdateProjectSchema, UpdateProjectDto } from './dtos/update-project.dto';
import { ListProjectsQuerySchema } from './dtos/list-projects-query.dto';
import { ListProjectMembersQuerySchema } from './dtos/list-project-members-query.dto';
import {
  AddProjectMemberSchema,
  AddProjectMemberDto,
  UpdateProjectMemberSchema,
  UpdateProjectMemberDto,
  TransferProjectOwnerSchema,
  TransferProjectOwnerDto,
  MarkCompletedSchema,
  MarkCompletedDto,
} from './dtos/project-member.dto';
import { JwtAuthGuard } from '../../../../shared/guards/jwt-auth.guard';
import { PoliciesGuard } from '../../../../shared/casl/policies.guard';
import { CheckPolicies } from '../../../../shared/casl/check-policies.decorator';
import { Action } from '../../../../shared/casl/actions.enum';
import {
  CurrentUser,
  CurrentUserPayload,
} from '../../../../shared/decorators/current-user.decorator';
import { ZodValidationPipe } from '../../../../shared/pipes/zod-validation.pipe';
import { ApiZodBody, ApiZodQuery } from '../../../../shared/swagger/api-zod.decorator';
import { AddProjectMemberHandler } from '../../application/commands/add-project-member.handler';
import { CreateProjectHandler } from '../../application/commands/create-project.handler';
import { DeleteProjectHandler } from '../../application/commands/delete-project.handler';
import { GetProjectByIdHandler } from '../../application/queries/get-project-by-id.handler';
import { GetWorkspaceNameHandler } from '../../application/queries/get-workspace-name.handler';
import { ListMembersHandler } from '../../application/queries/list-members.handler';
import { ListProjectsByWorkspaceHandler } from '../../application/queries/list-projects-by-workspace.handler';
import { MarkCompletedHandler } from '../../application/commands/mark-completed.handler';
import { RemoveProjectMemberHandler } from '../../application/commands/remove-project-member.handler';
import { TransferProjectOwnerHandler } from '../../application/commands/transfer-project-owner.handler';
import { UpdateProjectHandler } from '../../application/commands/update-project.handler';
import { UpdateProjectMemberRoleHandler } from '../../application/commands/update-project-member-role.handler';
import type { ProjectMemberRecord, ProjectRecord, ProjectStatus } from '../..';
import type { CursorMeta } from '../../../../shared/pagination/cursor-paginated.response';
import type { ProjectMemberView } from '../../domain/ports/project.repository.port';

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
  ) {}

  @Post('workspaces/:workspaceId/projects')
  @ApiOperation({ summary: 'PROJ-01: Tạo dự án mới trong không gian làm việc' })
  @ApiZodBody(CreateProjectSchema)
  @CheckPolicies((ability) => ability.can(Action.Create, 'Project'))
  async createProject(
    @Param('workspaceId') workspaceId: string,
    @CurrentUser() user: CurrentUserPayload,
    @Body(new ZodValidationPipe(CreateProjectSchema)) dto: CreateProjectDto,
  ): Promise<{ message: string; project: ProjectRecord; }> {
    const project = await this.createProjectHandler.execute(workspaceId, user.userId, dto);
    return {
      message: 'Tạo dự án thành công',
      project,
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
  @CheckPolicies((ability) => ability.can(Action.Read, 'Project'))
  async listByWorkspace(
    @Param('workspaceId') workspaceId: string,
    @Query(new ZodValidationPipe(ListProjectsQuerySchema)) query: Record<string, unknown>,
  ): Promise<{ items: ProjectRecord[]; meta: CursorMeta; }> {
    const result = await this.listProjectsByWorkspaceHandler.execute(workspaceId, query as never);
    return { ...result };
  }

  @Get('projects/:id')
  @ApiOperation({ summary: 'PROJ-03: Xem chi tiết dự án' })
  @CheckPolicies((ability) => ability.can(Action.Read, 'Project'))
  async getProjectById(@Param('id') id: string): Promise<{ project: { workspaceName: string | null; id: string; workspaceId: string; name: string; description: string; hasDataset: boolean; status: ProjectStatus; members: ProjectMemberRecord[]; lastAccessedAt: Date | null; version: number; createdBy: string; createdAt: Date; updatedAt: Date; }; }> {
    const project = await this.getProjectByIdHandler.execute(id, true);
    // H3 — kèm tên workspace để frontend không cần gọi thêm 1 request.
    const workspaceName = await this.getWorkspaceNameHandler.execute(project.workspaceId);
    return {
      project: { ...project, workspaceName },
    };
  }

  @Patch('projects/:id')
  @ApiOperation({ summary: 'PROJ-04: Cập nhật thông tin dự án' })
  @ApiZodBody(UpdateProjectSchema)
  @CheckPolicies((ability) => ability.can(Action.Update, 'Project'))
  async updateProject(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(UpdateProjectSchema)) dto: UpdateProjectDto,
  ): Promise<{ message: string; project: ProjectRecord; }> {
    const project = await this.updateProjectHandler.execute(id, dto);
    return {
      message: 'Cập nhật dự án thành công',
      project,
    };
  }

  @Delete('projects/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'PROJ-05: Xóa mềm dự án' })
  @CheckPolicies((ability) => ability.can(Action.Delete, 'Project'))
  async deleteProject(@Param('id') id: string): Promise<void> {
    await this.deleteProjectHandler.execute(id);
  }

  @Put('projects/:id/snapshot')
  @ApiOperation({ summary: 'PROJ-12: Lưu trạng thái project (optimistic locking)' })
  @ApiZodBody(MarkCompletedSchema)
  @CheckPolicies((ability) => ability.can(Action.Update, 'Project'))
  async markCompleted(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(MarkCompletedSchema)) dto: MarkCompletedDto,
  ): Promise<{ project: ProjectRecord; }> {
    await this.markCompletedHandler.execute(id, dto.expectedVersion);
    const project = await this.getProjectByIdHandler.execute(id);
    return { project };
  }

  @Get('projects/:id/members')
  @ApiOperation({
    summary: 'PROJ-09: Danh sách thành viên project (tìm kiếm/lọc/phân trang cursor)',
    description:
      'Phân trang keyset: dùng `meta.nextCursor` làm tham số `cursor` của request kế tiếp. ' +
      'Response: `{ items, meta: { nextCursor, hasMore, limit } }` — không có `total`/`page`.',
  })
  @ApiZodQuery(ListProjectMembersQuerySchema)
  @CheckPolicies((ability) => ability.can(Action.Read, 'Project'))
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
  @CheckPolicies((ability) => ability.can(Action.Update, 'Project'))
  async addMember(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(AddProjectMemberSchema)) dto: AddProjectMemberDto,
  ): Promise<{ message: string; project: ProjectRecord; }> {
    const project = await this.addProjectMemberHandler.execute(id, dto);
    return { message: 'Thêm thành viên project thành công', project };
  }

  @Patch('projects/:id/members/:userId')
  @ApiOperation({ summary: 'PROJ-10: Đổi vai trò thành viên project' })
  @ApiZodBody(UpdateProjectMemberSchema)
  @CheckPolicies((ability) => ability.can(Action.Update, 'Project'))
  async updateMember(
    @Param('id') id: string,
    @Param('userId') userId: string,
    @Body(new ZodValidationPipe(UpdateProjectMemberSchema)) dto: UpdateProjectMemberDto,
  ): Promise<{ message: string; project: ProjectRecord; }> {
    const project = await this.updateProjectMemberRoleHandler.execute(id, userId, dto);
    return { message: 'Cập nhật vai trò thành viên thành công', project };
  }

  @Delete('projects/:id/members/:userId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Xóa thành viên khỏi project' })
  @CheckPolicies((ability) => ability.can(Action.Update, 'Project'))
  async removeMember(@Param('id') id: string, @Param('userId') userId: string): Promise<{ message: string; project: ProjectRecord; }> {
    const project = await this.removeProjectMemberHandler.execute(id, userId);
    return { message: 'Xóa thành viên project thành công', project };
  }

  @Post('projects/:id/transfer-owner')
  @ApiOperation({ summary: 'PROJ-11: Nhượng quyền Project Owner' })
  @ApiZodBody(TransferProjectOwnerSchema)
  @CheckPolicies((ability) => ability.can(Action.Update, 'Project'))
  async transferOwner(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserPayload,
    @Body(new ZodValidationPipe(TransferProjectOwnerSchema)) dto: TransferProjectOwnerDto,
  ): Promise<{ message: string; project: ProjectRecord; }> {
    const project = await this.transferProjectOwnerHandler.execute(id, user.userId, dto);
    return { message: 'Nhượng quyền Project Owner thành công', project };
  }
}
