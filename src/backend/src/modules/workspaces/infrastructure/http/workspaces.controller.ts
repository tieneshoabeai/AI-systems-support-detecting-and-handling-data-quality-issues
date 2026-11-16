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
import { CreateWorkspaceSchema, CreateWorkspaceDto } from './dtos/create-workspace.dto';
import { UpdateWorkspaceSchema, UpdateWorkspaceDto } from './dtos/update-workspace.dto';
import { AddMemberSchema, AddMemberDto } from './dtos/add-member.dto';
import { TransferOwnerSchema, TransferOwnerDto } from './dtos/transfer-owner.dto';
import { ListWorkspacesQuerySchema } from './dtos/list-workspaces-query.dto';
import { ListWorkspaceMembersQuerySchema } from './dtos/list-workspace-members-query.dto';
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
import { AddMemberHandler } from '../../application/commands/add-member.handler';
import { CreateWorkspaceHandler } from '../../application/commands/create-workspace.handler';
import { DeleteWorkspaceHandler } from '../../application/commands/delete-workspace.handler';
import { GetWorkspaceByIdHandler } from '../../application/queries/get-workspace-by-id.handler';
import { LeaveWorkspaceHandler } from '../../application/commands/leave-workspace.handler';
import { ListMembersHandler } from '../../application/queries/list-members.handler';
import { ListWorkspacesHandler } from '../../application/queries/list-workspaces.handler';
import { RemoveMemberHandler } from '../../application/commands/remove-member.handler';
import { TransferOwnerHandler } from '../../application/commands/transfer-owner.handler';
import { UpdateWorkspaceHandler } from '../../application/commands/update-workspace.handler';

@ApiTags('Workspaces')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PoliciesGuard)
@Controller('workspaces')
export class WorkspacesController {
  constructor(
    private readonly addMemberHandler: AddMemberHandler,
    private readonly createWorkspaceHandler: CreateWorkspaceHandler,
    private readonly deleteWorkspaceHandler: DeleteWorkspaceHandler,
    private readonly getWorkspaceByIdHandler: GetWorkspaceByIdHandler,
    private readonly leaveWorkspaceHandler: LeaveWorkspaceHandler,
    private readonly removeMemberHandler: RemoveMemberHandler,
    private readonly transferOwnerHandler: TransferOwnerHandler,
    private readonly updateWorkspaceHandler: UpdateWorkspaceHandler,
    private readonly listMembersHandler: ListMembersHandler,
    private readonly listWorkspacesHandler: ListWorkspacesHandler,
  ) {}

  @Post()
  @ApiOperation({ summary: 'WS-01: Tạo không gian làm việc mới' })
  @ApiZodBody(CreateWorkspaceSchema)
  @CheckPolicies((ability) => ability.can(Action.Create, 'Workspace'))
  async createWorkspace(
    @CurrentUser() user: CurrentUserPayload,
    @Body(new ZodValidationPipe(CreateWorkspaceSchema)) dto: CreateWorkspaceDto,
  ) {
    const workspace = await this.createWorkspaceHandler.execute(user.userId, dto);
    return {
      message: 'Tạo không gian làm việc thành công',
      workspace,
    };
  }

  @Get()
  @ApiOperation({
    summary: 'WS-02: Lấy danh sách workspace (phân trang cursor/tìm kiếm/lọc/sắp xếp)',
    description:
      'Phân trang keyset: dùng `meta.nextCursor` làm tham số `cursor` của request kế tiếp. ' +
      'Response: `{ items, meta: { nextCursor, hasMore, limit } }` — không có `total`/`page`.',
  })
  @ApiZodQuery(ListWorkspacesQuerySchema)
  @CheckPolicies((ability) => ability.can(Action.Read, 'Workspace'))
  async listWorkspaces(
    @CurrentUser() user: CurrentUserPayload,
    @Query(new ZodValidationPipe(ListWorkspacesQuerySchema)) query: Record<string, unknown>,
  ) {
    const result = await this.listWorkspacesHandler.execute(user, query as never);
    return { ...result };
  }

  @Get(':id')
  @ApiOperation({ summary: 'WS-03: Xem chi tiết không gian làm việc' })
  @CheckPolicies((ability) => ability.can(Action.Read, 'Workspace'))
  async getWorkspaceById(@Param('id') id: string) {
    const workspace = await this.getWorkspaceByIdHandler.execute(id, true);
    return { workspace };
  }

  @Patch(':id')
  @ApiOperation({ summary: 'WS-04: Cập nhật thông tin không gian làm việc' })
  @ApiZodBody(UpdateWorkspaceSchema)
  @CheckPolicies((ability) => ability.can(Action.Update, 'Workspace'))
  async updateWorkspace(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(UpdateWorkspaceSchema)) dto: UpdateWorkspaceDto,
  ) {
    const workspace = await this.updateWorkspaceHandler.execute(id, dto);
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
    await this.deleteWorkspaceHandler.execute(id);
  }

  @Get(':id/members')
  @ApiOperation({
    summary: 'WS-06: Danh sách thành viên workspace (tìm kiếm/lọc/phân trang cursor)',
    description:
      'Phân trang keyset: dùng `meta.nextCursor` làm tham số `cursor` của request kế tiếp. ' +
      'Response: `{ items, meta: { nextCursor, hasMore, limit } }` — không có `total`/`page`.',
  })
  @ApiZodQuery(ListWorkspaceMembersQuerySchema)
  @CheckPolicies((ability) => ability.can(Action.Read, 'Workspace'))
  async listMembers(
    @Param('id') id: string,
    @Query(new ZodValidationPipe(ListWorkspaceMembersQuerySchema)) query: Record<string, unknown>,
  ) {
    const result = await this.listMembersHandler.execute(id, query as never);
    return { ...result };
  }

  @Post(':id/members')
  @ApiOperation({ summary: 'WS-07: Thêm thành viên vào không gian làm việc' })
  @ApiZodBody(AddMemberSchema)
  @CheckPolicies((ability) => ability.can(Action.Update, 'Workspace'))
  async addMember(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(AddMemberSchema)) dto: AddMemberDto,
  ) {
    const workspace = await this.addMemberHandler.execute(id, dto);
    return {
      message: 'Thêm thành viên vào không gian làm việc thành công',
      workspace,
    };
  }

  @Delete(':id/members/:userId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Xóa thành viên khỏi không gian làm việc' })
  @CheckPolicies((ability) => ability.can(Action.Update, 'Workspace'))
  async removeMember(@Param('id') id: string, @Param('userId') userId: string) {
    const workspace = await this.removeMemberHandler.execute(id, userId);
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
    @Body(new ZodValidationPipe(TransferOwnerSchema)) dto: TransferOwnerDto,
  ) {
    const workspace = await this.transferOwnerHandler.execute(id, user.userId, dto);
    return { message: 'Nhượng quyền Owner thành công', workspace };
  }

  @Post(':id/leave')
  @ApiOperation({ summary: 'WS-10: Rời workspace' })
  @CheckPolicies((ability) => ability.can(Action.Read, 'Workspace'))
  async leave(@Param('id') id: string, @CurrentUser() user: CurrentUserPayload) {
    const r = await this.leaveWorkspaceHandler.execute(id, user.userId);
    return { message: 'Rời workspace thành công', ...r };
  }
}
