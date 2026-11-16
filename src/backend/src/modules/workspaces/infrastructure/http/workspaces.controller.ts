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
import { WorkspacesService } from '../../application/workspaces.service';
import {
  CreateWorkspaceSchema,
  CreateWorkspaceDto,
} from './dtos/create-workspace.dto';
import {
  UpdateWorkspaceSchema,
  UpdateWorkspaceDto,
} from './dtos/update-workspace.dto';
import { AddMemberSchema, AddMemberDto } from './dtos/add-member.dto';
import { TransferOwnerSchema, TransferOwnerDto } from './dtos/transfer-owner.dto';
import { ListWorkspacesQuerySchema } from './dtos/list-workspaces-query.dto';
import { JwtAuthGuard } from '../../../../shared/guards/jwt-auth.guard';
import { PoliciesGuard } from '../../../../shared/casl/policies.guard';
import { CheckPolicies } from '../../../../shared/casl/check-policies.decorator';
import { Action } from '../../../../shared/casl/actions.enum';
import { CurrentUser, CurrentUserPayload } from '../../../../shared/decorators/current-user.decorator';
import { ZodValidationPipe } from '../../../../shared/pipes/zod-validation.pipe';
import { ApiZodBody } from '../../../../shared/swagger/api-zod.decorator';

@ApiTags('Workspaces')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PoliciesGuard)
@Controller('workspaces')
export class WorkspacesController {
  constructor(private readonly workspacesService: WorkspacesService) {}

  @Post()
  @ApiOperation({ summary: 'WS-01: Tạo không gian làm việc mới' })
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
  @ApiOperation({ summary: 'WS-02: Lấy danh sách workspace (phân trang/tìm kiếm/lọc/sắp xếp)' })
  @CheckPolicies((ability) => ability.can(Action.Read, 'Workspace'))
  async listWorkspaces(
    @CurrentUser() user: CurrentUserPayload,
    @Query(new ZodValidationPipe(ListWorkspacesQuerySchema)) query: Record<string, unknown>
  ) {
    const result = await this.workspacesService.listWorkspaces(user, query as never);
    return { ...result };
  }

  @Get(':id')
  @ApiOperation({ summary: 'WS-03: Xem chi tiết không gian làm việc' })
  @CheckPolicies((ability) => ability.can(Action.Read, 'Workspace'))
  async getWorkspaceById(@Param('id') id: string) {
    const workspace = await this.workspacesService.getWorkspaceById(id, true);
    return { workspace };
  }

  @Patch(':id')
  @ApiOperation({ summary: 'WS-04: Cập nhật thông tin không gian làm việc' })
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
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'WS-05: Xóa mềm không gian làm việc' })
  @CheckPolicies((ability) => ability.can(Action.Delete, 'Workspace'))
  async deleteWorkspace(@Param('id') id: string): Promise<void> {
    await this.workspacesService.deleteWorkspace(id);
  }

  @Get(':id/members')
  @ApiOperation({ summary: 'WS-06: Danh sách thành viên workspace' })
  @CheckPolicies((ability) => ability.can(Action.Read, 'Workspace'))
  async listMembers(@Param('id') id: string) {
    const ws = await this.workspacesService.getWorkspaceById(id);
    return { members: ws.members, total: ws.members.length };
  }

  @Post(':id/members')
  @ApiOperation({ summary: 'WS-07: Thêm thành viên vào không gian làm việc' })
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
  @ApiOperation({ summary: 'Xóa thành viên khỏi không gian làm việc' })
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

  @Post(':id/transfer-owner')
  @ApiOperation({ summary: 'WS-09: Nhượng quyền Workspace Owner' })
  @ApiZodBody(TransferOwnerSchema)
  @CheckPolicies((ability) => ability.can(Action.Update, 'Workspace'))
  async transferOwner(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserPayload,
    @Body(new ZodValidationPipe(TransferOwnerSchema)) dto: TransferOwnerDto
  ) {
    const workspace = await this.workspacesService.transferOwner(id, user.userId, dto);
    return { message: 'Nhượng quyền Owner thành công', workspace };
  }

  @Post(':id/leave')
  @ApiOperation({ summary: 'WS-10: Rời workspace' })
  @CheckPolicies((ability) => ability.can(Action.Read, 'Workspace'))
  async leave(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    const r = await this.workspacesService.leaveWorkspace(id, user.userId);
    return { message: 'Rời workspace thành công', ...r };
  }
}
