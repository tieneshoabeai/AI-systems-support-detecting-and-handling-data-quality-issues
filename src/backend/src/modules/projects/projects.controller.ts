import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { ProjectsService } from './projects.service';
import { CreateProjectSchema, CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectSchema, UpdateProjectDto } from './dto/update-project.dto';
import { JwtAuthGuard } from '../../shared/guards/jwt-auth.guard';
import { PoliciesGuard } from '../../shared/casl/policies.guard';
import { CheckPolicies } from '../../shared/casl/check-policies.decorator';
import { Action } from '../../shared/casl/actions.enum';
import { CurrentUser, CurrentUserPayload } from '../../shared/decorators/current-user.decorator';
import { ZodValidationPipe } from '../../shared/pipes/zod-validation.pipe';
import { ApiZodBody } from '../../shared/swagger/api-zod.decorator';

@ApiTags('Projects')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PoliciesGuard)
@Controller()
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  @Post('workspaces/:workspaceId/projects')
  @ApiOperation({ summary: 'F3.1: Tạo dự án mới trong không gian làm việc' })
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
  @ApiOperation({ summary: 'F3.2: Lấy danh sách dự án trong không gian làm việc' })
  @CheckPolicies((ability) => ability.can(Action.Read, 'Project'))
  async getProjectsByWorkspace(@Param('workspaceId') workspaceId: string) {
    const projects = await this.projectsService.getProjectsByWorkspace(workspaceId);
    return { projects };
  }

  @Get('projects/:id')
  @ApiOperation({ summary: 'F3.3: Xem chi tiết dự án' })
  @CheckPolicies((ability) => ability.can(Action.Read, 'Project'))
  async getProjectById(@Param('id') id: string) {
    const project = await this.projectsService.getProjectById(id);
    return { project };
  }

  @Patch('projects/:id')
  @ApiOperation({ summary: 'F3.4: Cập nhật thông tin dự án' })
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
  @ApiOperation({ summary: 'F3.5: Xóa mềm dự án' })
  @CheckPolicies((ability) => ability.can(Action.Delete, 'Project'))
  async deleteProject(@Param('id') id: string) {
    await this.projectsService.deleteProject(id);
    return {
      message: 'Xóa dự án thành công',
    };
  }
}
