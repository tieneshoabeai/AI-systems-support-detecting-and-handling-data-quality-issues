import { Controller, Get, Post, Patch, Param, Body, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../../shared/guards/jwt-auth.guard';
import { RolesGuard } from '../../../../shared/guards/roles.guard';
import { Roles } from '../../../../shared/decorators/roles.decorator';
import { CurrentUser, CurrentUserPayload } from '../../../../shared/decorators/current-user.decorator';
import { ZodValidationPipe } from '../../../../shared/pipes/zod-validation.pipe';
import { ApiZodBody, ApiZodQuery } from '../../../../shared/swagger/api-zod.decorator';
import { IssuesService } from '../../application/issues.service';
import {
  CreateIssueSchema,
  CreateIssueDto,
  ListIssuesQuerySchema,
  ListIssuesQueryDto,
  AdminListIssuesQuerySchema,
  AdminListIssuesQueryDto,
  UpdateIssueStatusSchema,
  UpdateIssueStatusDto,
} from './dtos/create-issue.dto';

@ApiTags('Issues')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller()
export class IssuesController {
  constructor(private readonly issuesService: IssuesService) {}

  @Post('issues')
  @ApiOperation({ summary: 'ISSUE-01: Tạo báo cáo sự cố' })
  @ApiZodBody(CreateIssueSchema)
  async createReport(
    @CurrentUser() user: CurrentUserPayload,
    @Body(new ZodValidationPipe(CreateIssueSchema)) dto: CreateIssueDto,
  ) {
    return this.issuesService.createReport(user.userId, dto);
  }

  @Get('issues')
  @ApiOperation({ summary: 'ISSUE-02: Danh sách báo cáo của tôi' })
  @ApiZodQuery(ListIssuesQuerySchema)
  async listMine(
    @CurrentUser() user: CurrentUserPayload,
    @Query(new ZodValidationPipe(ListIssuesQuerySchema)) query: ListIssuesQueryDto,
  ) {
    return this.issuesService.listMine(user.userId, query);
  }

  @Get('issues/:id')
  @ApiOperation({ summary: 'ISSUE-03: Chi tiết báo cáo của tôi' })
  async getMine(@CurrentUser() user: CurrentUserPayload, @Param('id') id: string) {
    return this.issuesService.getMine(user.userId, id);
  }

  @Get('admin/issues')
  @Roles('admin')
  @ApiOperation({ summary: 'ISSUE-04: Danh sách báo cáo (quản trị)' })
  @ApiZodQuery(AdminListIssuesQuerySchema)
  async listForAdmin(@Query(new ZodValidationPipe(AdminListIssuesQuerySchema)) query: AdminListIssuesQueryDto) {
    return this.issuesService.listForAdmin(query);
  }

  @Get('admin/issues/:id')
  @Roles('admin')
  @ApiOperation({ summary: 'ISSUE-04: Chi tiết báo cáo (quản trị)' })
  async getForAdmin(@CurrentUser() user: CurrentUserPayload, @Param('id') id: string) {
    return this.issuesService.getForAdmin(id, user.role);
  }

  @Patch('admin/issues/:id/status')
  @Roles('admin')
  @ApiOperation({ summary: 'ISSUE-04: Đổi trạng thái báo cáo (optimistic locking)' })
  @ApiZodBody(UpdateIssueStatusSchema)
  async updateStatus(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(UpdateIssueStatusSchema)) dto: UpdateIssueStatusDto,
  ) {
    return this.issuesService.updateStatus(id, user.role, dto.status, dto.expectedVersion);
  }
}
