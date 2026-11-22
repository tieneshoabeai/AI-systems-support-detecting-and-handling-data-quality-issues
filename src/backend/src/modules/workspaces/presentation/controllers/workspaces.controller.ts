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
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CreateWorkspaceSchema, CreateWorkspaceDto } from '../dtos/create-workspace.dto';
import { UpdateWorkspaceSchema, UpdateWorkspaceDto } from '../dtos/update-workspace.dto';
import { AddMemberSchema, AddMemberDto } from '../dtos/add-member.dto';
import { TransferOwnerSchema, TransferOwnerDto } from '../dtos/transfer-owner.dto';
import { ListWorkspacesQuerySchema } from '../dtos/list-workspaces-query.dto';
import { ListWorkspaceMembersQuerySchema } from '../dtos/list-workspace-members-query.dto';
import { JwtAuthGuard } from '../../../../shared/interfaces/guards/jwt-auth.guard';
import { PoliciesGuard } from '../../../../shared/interfaces/casl/policies.guard';
import { CheckPolicies } from '../../../../shared/interfaces/casl/check-policies.decorator';
import { PolicyResource } from '../../../../shared/interfaces/casl/policy-resource.decorator';
import { Action } from '../../../../shared/domain/security/action';
import {
  CurrentUser,
  CurrentUserPayload,
} from '../../../../shared/interfaces/decorators/current-user.decorator';
import { ZodValidationPipe } from '../../../../shared/interfaces/pipes/zod-validation.pipe';
import { ApiZodBody, ApiZodQuery } from '../../../../shared/interfaces/swagger/api-zod.decorator';
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
import { WorkspacePolicyLoader } from '../../application/policy-loaders/workspace-policy.loader';
import type { WorkspaceMemberView } from '../..';
import {
  toWorkspaceResponse,
  toWorkspaceResponses,
  type WorkspaceResponse,
} from '../responses/workspace.response';
import type { CursorMeta } from '../../../../shared/domain/pagination/cursor-paginated.response';

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
  ): Promise<{ message: string; workspace: WorkspaceResponse; }> {
    const workspace = await this.createWorkspaceHandler.execute(user.userId, dto);
    return {
      message: 'Tạo không gian làm việc thành công',
      workspace: toWorkspaceResponse(workspace),
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
  ): Promise<{ items: WorkspaceResponse[]; meta: CursorMeta; }> {
    const result = await this.listWorkspacesHandler.execute(user, query as never);
    return { items: toWorkspaceResponses(result.items), meta: result.meta };
  }

  @Get(':id')
  @ApiOperation({ summary: 'WS-03: Xem chi tiết không gian làm việc' })
  @PolicyResource('Workspace', WorkspacePolicyLoader)
  @CheckPolicies((ability) => ability.can(Action.Read, 'Workspace'))
  @ApiResponse({ status: 200, description: 'Thành công' })
  async getWorkspaceById(@Param('id') id: string): Promise<{ workspace: WorkspaceResponse; }> {
    const workspace = await this.getWorkspaceByIdHandler.execute(id, true);
    return { workspace: toWorkspaceResponse(workspace) };
  }

  @Patch(':id')
  @ApiOperation({ summary: 'WS-04: Cập nhật thông tin không gian làm việc' })
  @ApiZodBody(UpdateWorkspaceSchema)
  @PolicyResource('Workspace', WorkspacePolicyLoader)
  @CheckPolicies((ability) => ability.can(Action.Update, 'Workspace'))
  @ApiResponse({ status: 200, description: 'Thành công' })
  async updateWorkspace(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(UpdateWorkspaceSchema)) dto: UpdateWorkspaceDto,
  ): Promise<{ message: string; workspace: WorkspaceResponse; }> {
    const workspace = await this.updateWorkspaceHandler.execute(id, dto);
    return {
      message: 'Cập nhật không gian làm việc thành công',
      workspace: toWorkspaceResponse(workspace),
    };
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'WS-05: Xóa mềm không gian làm việc' })
  @PolicyResource('Workspace', WorkspacePolicyLoader)
  @CheckPolicies((ability) => ability.can(Action.Delete, 'Workspace'))
  @ApiResponse({ status: 204, description: 'Thành công, không có nội dung phản hồi' })
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
  @PolicyResource('Workspace', WorkspacePolicyLoader)
  @CheckPolicies((ability) => ability.can(Action.Read, 'Workspace'))
  @ApiResponse({ status: 200, description: 'Thành công' })
  async listMembers(
    @Param('id') id: string,
    @Query(new ZodValidationPipe(ListWorkspaceMembersQuerySchema)) query: Record<string, unknown>,
  ): Promise<{ items: WorkspaceMemberView[]; meta: CursorMeta; }> {
    const result = await this.listMembersHandler.execute(id, query as never);
    return { ...result };
  }

  @Post(':id/members')
  @ApiOperation({
    summary: 'WS-07: Thêm thành viên vào không gian làm việc',
    description:
      'Email đã có tài khoản → thêm thành viên ngay. ' +
      'Email chưa có tài khoản → gửi lời mời qua email (trả `invited: true`).',
  })
  @ApiZodBody(AddMemberSchema)
  @PolicyResource('Workspace', WorkspacePolicyLoader)
  @CheckPolicies((ability) => ability.can(Action.Update, 'Workspace'))
  @ApiResponse({ status: 201, description: 'Tạo mới thành công' })
  async addMember(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(AddMemberSchema)) dto: AddMemberDto,
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<{ message: string; workspace: WorkspaceResponse; invited: boolean; }> {
    const result = await this.addMemberHandler.execute(id, dto, user.userId);
    return {
      message: result.invited
        ? 'Đã gửi lời mời tham gia không gian làm việc qua email'
        : 'Thêm thành viên vào không gian làm việc thành công',
      workspace: toWorkspaceResponse(result.workspace),
      invited: result.invited,
    };
  }

  @Delete(':id/members/:userId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Xóa thành viên khỏi không gian làm việc' })
  @PolicyResource('Workspace', WorkspacePolicyLoader)
  @CheckPolicies((ability) => ability.can(Action.Update, 'Workspace'))
  @ApiResponse({ status: 200, description: 'Thành công' })
  async removeMember(@Param('id') id: string, @Param('userId') userId: string): Promise<{ message: string; workspace: WorkspaceResponse; }> {
    const workspace = await this.removeMemberHandler.execute(id, userId);
    return {
      message: 'Xóa thành viên khỏi không gian làm việc thành công',
      workspace: toWorkspaceResponse(workspace),
    };
  }

  @Post(':id/transfer-owner')
  @ApiOperation({ summary: 'WS-09: Nhượng quyền Workspace Owner' })
  @ApiZodBody(TransferOwnerSchema)
  @PolicyResource('Workspace', WorkspacePolicyLoader)
  @CheckPolicies((ability) => ability.can(Action.Update, 'Workspace'))
  @ApiResponse({ status: 201, description: 'Tạo mới thành công' })
  async transferOwner(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserPayload,
    @Body(new ZodValidationPipe(TransferOwnerSchema)) dto: TransferOwnerDto,
  ): Promise<{ message: string; workspace: WorkspaceResponse; }> {
    const workspace = await this.transferOwnerHandler.execute(id, user.userId, dto);
    return { message: 'Nhượng quyền Owner thành công', workspace: toWorkspaceResponse(workspace) };
  }

  @Post(':id/leave')
  @ApiOperation({ summary: 'WS-10: Rời workspace' })
  // WS-10: phải là thành viên của workspace mới rời được → instance check.
  @PolicyResource('Workspace', WorkspacePolicyLoader)
  @CheckPolicies((ability) => ability.can(Action.Read, 'Workspace'))
  @ApiResponse({ status: 201, description: 'Tạo mới thành công' })
  async leave(@Param('id') id: string, @CurrentUser() user: CurrentUserPayload): Promise<{ left: boolean; message: string; }> {
    const r = await this.leaveWorkspaceHandler.execute(id, user.userId);
    return { message: 'Rời workspace thành công', ...r };
  }
}
