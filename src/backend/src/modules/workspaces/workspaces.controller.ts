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
import { WorkspacesService } from './workspaces.service';
import {
  CreateWorkspaceSchema,
  CreateWorkspaceDto,
} from './dto/create-workspace.dto';
import {
  UpdateWorkspaceSchema,
  UpdateWorkspaceDto,
} from './dto/update-workspace.dto';
import { AddMemberSchema, AddMemberDto } from './dto/add-member.dto';
import { JwtAuthGuard } from '../../shared/guards/jwt-auth.guard';
import { PoliciesGuard } from '../../shared/casl/policies.guard';
import { CheckPolicies } from '../../shared/casl/check-policies.decorator';
import { Action } from '../../shared/casl/actions.enum';
import { CurrentUser, CurrentUserPayload } from '../../shared/decorators/current-user.decorator';
import { ZodValidationPipe } from '../../shared/pipes/zod-validation.pipe';
import { ApiZodBody } from '../../shared/swagger/api-zod.decorator';

@ApiTags('Workspaces')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PoliciesGuard)
@Controller('workspaces')
export class WorkspacesController {
  constructor(private readonly workspacesService: WorkspacesService) {}

  @Post()
  @ApiOperation({ summary: 'F2.1: Tạo không gian làm việc mới' })
  @ApiZodBody(CreateWorkspaceSchema)
  @CheckPolicies((ability) => ability.can(Action.Create, 'Workspace'))
  async createWorkspace(
    @CurrentUser() user: CurrentUserPayload,
    @Body(new ZodValidationPipe(CreateWorkspaceSchema)) dto: CreateWorkspaceDto
  ) {
    const workspace = await this.workspacesService.createWorkspace(user.userId, dto);
    return {
      message: 'Tạo không gian làm việc thành công',
      workspace,
    };
  }

  @Get()
  @ApiOperation({ summary: 'F2.2: Lấy danh sách không gian làm việc của người dùng' })
  @CheckPolicies((ability) => ability.can(Action.Read, 'Workspace'))
  async getWorkspaces(@CurrentUser() user: CurrentUserPayload) {
    const workspaces = await this.workspacesService.getWorkspaces(user);
    return { workspaces };
  }

  @Get(':id')
  @ApiOperation({ summary: 'F2.3: Xem chi tiết không gian làm việc' })
  @CheckPolicies((ability) => ability.can(Action.Read, 'Workspace'))
  async getWorkspaceById(@Param('id') id: string) {
    const workspace = await this.workspacesService.getWorkspaceById(id);
    return { workspace };
  }

  @Patch(':id')
  @ApiOperation({ summary: 'F2.4: Cập nhật thông tin không gian làm việc' })
  @ApiZodBody(UpdateWorkspaceSchema)
  @CheckPolicies((ability) => ability.can(Action.Update, 'Workspace'))
  async updateWorkspace(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(UpdateWorkspaceSchema)) dto: UpdateWorkspaceDto
  ) {
    const workspace = await this.workspacesService.updateWorkspace(id, dto);
    return {
      message: 'Cập nhật không gian làm việc thành công',
      workspace,
    };
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'F2.5: Xóa mềm không gian làm việc' })
  @CheckPolicies((ability) => ability.can(Action.Delete, 'Workspace'))
  async deleteWorkspace(@Param('id') id: string) {
    await this.workspacesService.deleteWorkspace(id);
    return {
      message: 'Xóa không gian làm việc thành công',
    };
  }

  @Post(':id/members')
  @ApiOperation({ summary: 'F2.6: Thêm thành viên vào không gian làm việc' })
  @ApiZodBody(AddMemberSchema)
  @CheckPolicies((ability) => ability.can(Action.Update, 'Workspace'))
  async addMember(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(AddMemberSchema)) dto: AddMemberDto
  ) {
    const workspace = await this.workspacesService.addMember(id, dto);
    return {
      message: 'Thêm thành viên vào không gian làm việc thành công',
      workspace,
    };
  }

  @Delete(':id/members/:userId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'F2.7: Xóa thành viên khỏi không gian làm việc' })
  @CheckPolicies((ability) => ability.can(Action.Update, 'Workspace'))
  async removeMember(
    @Param('id') id: string,
    @Param('userId') userId: string
  ) {
    const workspace = await this.workspacesService.removeMember(id, userId);
    return {
      message: 'Xóa thành viên khỏi không gian làm việc thành công',
      workspace,
    };
  }
}
