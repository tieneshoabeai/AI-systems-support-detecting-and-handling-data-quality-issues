import {
  Controller,
  Get,
  Post,
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
import { ProjectsService } from '../../application/projects.service';
import { CreateProjectSchema, CreateProjectDto } from './dtos/create-project.dto';
import { UpdateProjectSchema, UpdateProjectDto } from './dtos/update-project.dto';
import { ListProjectsQuerySchema } from './dtos/list-projects-query.dto';
import {
  AddProjectMemberSchema,
  AddProjectMemberDto,
  UpdateProjectMemberSchema,
  UpdateProjectMemberDto,
  TransferProjectOwnerSchema,
  TransferProjectOwnerDto,
} from './dtos/project-member.dto';
import { JwtAuthGuard } from '../../../../shared/guards/jwt-auth.guard';
import { PoliciesGuard } from '../../../../shared/casl/policies.guard';
import { CheckPolicies } from '../../../../shared/casl/check-policies.decorator';
import { Action } from '../../../../shared/casl/actions.enum';
import { CurrentUser, CurrentUserPayload } from '../../../../shared/decorators/current-user.decorator';
import { ZodValidationPipe } from '../../../../shared/pipes/zod-validation.pipe';
import { ApiZodBody } from '../../../../shared/swagger/api-zod.decorator';

@ApiTags('Projects')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PoliciesGuard)
@Controller()
export class ProjectsController {
  constructor(
    private readonly projectsService: ProjectsService,
  ) {}

  @Post('workspaces/:workspaceId/projects')
  @ApiOperation({ summary: 'PROJ-01: Tạo dự án mới trong không gian làm việc' })
  @ApiZodBody(CreateProjectSchema)
  @CheckPolicies((ability) => ability.can(Action.Create, 'Project'))
  async createProject(
    @Param('workspaceId') workspaceId: string,
    @CurrentUser() user: CurrentUserPayload,
    @Body(new ZodValidationPipe(CreateProjectSchema)) dto: CreateProjectDto
  ) {
    const project = await this.projectsService.createProject(workspaceId, user.userId, dto);
    return {
      message: 'Tạo dự án thành công',
      project,
    };
  }

  @Get('workspaces/:workspaceId/projects')
  @ApiOperation({ summary: 'PROJ-02: Danh sách project (phân trang/tìm kiếm/lọc status/sắp xếp)' })
  @CheckPolicies((ability) => ability.can(Action.Read, 'Project'))
  async listByWorkspace(
    @Param('workspaceId') workspaceId: string,
    @Query(new ZodValidationPipe(ListProjectsQuerySchema)) query: Record<string, unknown>
  ) {
    const result = await this.projectsService.listProjectsByWorkspace(workspaceId, query as never);
    return { ...result };
  }

  @Get('projects/:id')
  @ApiOperation({ summary: 'PROJ-03: Xem chi tiết dự án' })
  @CheckPolicies((ability) => ability.can(Action.Read, 'Project'))
  async getProjectById(@Param('id') id: string) {
    const project = await this.projectsService.getProjectById(id, true);
    return { project };
  }

  @Patch('projects/:id')
  @ApiOperation({ summary: 'PROJ-04: Cập nhật thông tin dự án' })
  @ApiZodBody(UpdateProjectSchema)
  @CheckPolicies((ability) => ability.can(Action.Update, 'Project'))
  async updateProject(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(UpdateProjectSchema)) dto: UpdateProjectDto
  ) {
    const project = await this.projectsService.updateProject(id, dto);
    return {
      message: 'Cập nhật dự án thành công',
      project,
    };
  }

  @Delete('projects/:id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'PROJ-05: Xóa mềm dự án' })
  @CheckPolicies((ability) => ability.can(Action.Delete, 'Project'))
  async deleteProject(@Param('id') id: string) {
    await this.projectsService.deleteProject(id);
    return {
      message: 'Xóa dự án thành công',
    };
  }

  @Get('projects/:id/members')
  @ApiOperation({ summary: 'PROJ-09: Danh sách thành viên project' })
  @CheckPolicies((ability) => ability.can(Action.Read, 'Project'))
  async listMembers(@Param('id') id: string) {
    const p = await this.projectsService.getProjectById(id);
    return { members: p.members ?? [], total: (p.members ?? []).length };
  }

  @Post('projects/:id/members')
  @ApiOperation({ summary: 'PROJ-09: Thêm thành viên project' })
  @ApiZodBody(AddProjectMemberSchema)
  @CheckPolicies((ability) => ability.can(Action.Update, 'Project'))
  async addMember(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(AddProjectMemberSchema)) dto: AddProjectMemberDto
  ) {
    const project = await this.projectsService.addProjectMember(id, dto);
    return { message: 'Thêm thành viên project thành công', project };
  }

  @Patch('projects/:id/members/:userId')
  @ApiOperation({ summary: 'PROJ-10: Đổi vai trò thành viên project' })
  @ApiZodBody(UpdateProjectMemberSchema)
  @CheckPolicies((ability) => ability.can(Action.Update, 'Project'))
  async updateMember(
    @Param('id') id: string,
    @Param('userId') userId: string,
    @Body(new ZodValidationPipe(UpdateProjectMemberSchema)) dto: UpdateProjectMemberDto
  ) {
    const project = await this.projectsService.updateProjectMemberRole(id, userId, dto);
    return { message: 'Cập nhật vai trò thành viên thành công', project };
  }

  @Delete('projects/:id/members/:userId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Xóa thành viên khỏi project' })
  @CheckPolicies((ability) => ability.can(Action.Update, 'Project'))
  async removeMember(@Param('id') id: string, @Param('userId') userId: string) {
    const project = await this.projectsService.removeProjectMember(id, userId);
    return { message: 'Xóa thành viên project thành công', project };
  }

  @Post('projects/:id/transfer-owner')
  @ApiOperation({ summary: 'PROJ-11: Nhượng quyền Project Owner' })
  @ApiZodBody(TransferProjectOwnerSchema)
  @CheckPolicies((ability) => ability.can(Action.Update, 'Project'))
  async transferOwner(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserPayload,
    @Body(new ZodValidationPipe(TransferProjectOwnerSchema)) dto: TransferProjectOwnerDto
  ) {
    const project = await this.projectsService.transferProjectOwner(id, user.userId, dto);
    return { message: 'Nhượng quyền Project Owner thành công', project };
  }
}
