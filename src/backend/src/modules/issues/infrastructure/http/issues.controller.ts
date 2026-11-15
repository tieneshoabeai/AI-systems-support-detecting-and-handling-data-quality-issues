import { Controller, Get, Post, Patch, Param, Body, Query, Req, Res, UseGuards, BadRequestException } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiConsumes } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../../shared/guards/jwt-auth.guard';
import { RolesGuard } from '../../../../shared/guards/roles.guard';
import { Roles } from '../../../../shared/decorators/roles.decorator';
import { CurrentUser, CurrentUserPayload } from '../../../../shared/decorators/current-user.decorator';
import { ZodValidationPipe } from '../../../../shared/pipes/zod-validation.pipe';
import { ApiZodBody, ApiZodQuery } from '../../../../shared/swagger/api-zod.decorator';
import { IssuesService } from '../../application/issues.service';
import { AuditService } from '../../../audit/application/audit.service';
import type { Request, Response } from 'express';
import busboy from 'busboy';
import { Readable } from 'stream';
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
  constructor(
    private readonly issuesService: IssuesService,
    private readonly audit: AuditService,
  ) {}

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

  @Post('issues/:id/attachments')
  @ApiOperation({ summary: 'ISSUE-01: Upload tệp đính kèm (png/jpg/pdf, <=10MB, tối đa 3 tệp)' })
  @ApiConsumes('multipart/form-data')
  async uploadAttachment(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
    @Req() req: Request,
  ) {
    const file = await new Promise<{ filename: string; mimeType: string; size: number; stream: Readable }>((resolve, reject) => {
      const bb = busboy({ headers: req.headers, limits: { fileSize: 10 * 1024 * 1024 } });
      let done = false;
      bb.on('file', (_field: string, stream: Readable, info: { filename: string; mimeType: string }) => {
        const chunks: Buffer[] = [];
        let size = 0;
        stream.on('data', (c: Buffer) => { size += c.length; chunks.push(c); });
        stream.on('end', () => {
          done = true;
          resolve({ filename: info.filename || 'attachment', mimeType: info.mimeType, size, stream: Readable.from(Buffer.concat(chunks)) });
        });
        stream.on('error', (e: unknown) => reject(e));
      });
      bb.on('error', (e: unknown) => reject(e));
      bb.on('finish', () => { if (!done) reject(new BadRequestException('Không tìm thấy tệp đính kèm trong yêu cầu')); });
      req.pipe(bb);
    });
    const result = await this.issuesService.uploadAttachment(user.userId, user.role, id, file);
    await this.audit.log({
      actorId: user.userId,
      actorRole: user.role,
      action: 'ISSUE_ATTACHMENT_UPLOADED',
      targetType: 'issue_report',
      targetId: id,
      ipAddress: (req.ip ?? null) as string | null,
      userAgent: (req.headers['user-agent'] as string ?? null),
      metadata: { filename: file.filename, sizeBytes: file.size, contentType: file.mimeType },
    });
    return result;
  }

  @Get('issues/:id/attachments/:attachmentId')
  @ApiOperation({ summary: 'Tải tệp đính kèm báo cáo (kiểm tra quyền, có audit log)' })
  async downloadAttachment(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
    @Param('attachmentId') attachmentId: string,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    const file = await this.issuesService.downloadAttachment(user.userId, user.role, id, attachmentId);
    res.setHeader('Content-Type', file.contentType);
    const safe = encodeURIComponent(file.filename).replace(/['()]/g, escape);
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${safe}`);
    if (typeof file.sizeBytes === 'number' && file.sizeBytes > 0) res.setHeader('Content-Length', String(file.sizeBytes));
    await this.audit.log({
      actorId: user.userId,
      actorRole: user.role,
      action: 'ISSUE_ATTACHMENT_DOWNLOADED',
      targetType: 'issue_report',
      targetId: id,
      workspaceId: file.workspaceId,
      ipAddress: (req.ip ?? null) as string | null,
      userAgent: (req.headers['user-agent'] as string ?? null),
      metadata: { attachmentId, filename: file.filename, sizeBytes: file.sizeBytes },
    });
    file.stream.pipe(res);
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
