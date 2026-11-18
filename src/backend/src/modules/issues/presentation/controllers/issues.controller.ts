import { Inject, Controller, Get, Post, Patch, Param, Body, Query, Req, Res, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../../shared/interfaces/guards/jwt-auth.guard';
import { RolesGuard } from '../../../../shared/interfaces/guards/roles.guard';
import { Roles } from '../../../../shared/interfaces/decorators/roles.decorator';
import {
  CurrentUser,
  CurrentUserPayload,
} from '../../../../shared/interfaces/decorators/current-user.decorator';
import { ZodValidationPipe } from '../../../../shared/interfaces/pipes/zod-validation.pipe';
import { ApiZodBody, ApiZodQuery } from '../../../../shared/interfaces/swagger/api-zod.decorator';
import { AUDIT_LOGGER_PORT, type AuditLoggerPort } from '../../../audit';
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
  UpdateMyIssueSchema,
  UpdateMyIssueDto,
} from '../dtos/create-issue.dto';
import { CreateReportHandler } from '../../application/commands/create-report.handler';
import { DownloadAttachmentHandler } from '../../application/queries/download-attachment.handler';
import { GetForAdminHandler } from '../../application/queries/get-for-admin.handler';
import { GetMineHandler } from '../../application/queries/get-mine.handler';
import { ListForAdminHandler } from '../../application/queries/list-for-admin.handler';
import { ListMineHandler } from '../../application/queries/list-mine.handler';
import { UpdateMyReportHandler } from '../../application/commands/update-my-report.handler';
import { UpdateStatusHandler } from '../../application/commands/update-status.handler';
import { UploadAttachmentHandler } from '../../application/commands/upload-attachment.handler';
import { ValidationError } from '../../../../shared/domain/errors';

@ApiTags('Issues')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller()
export class IssuesController {
  constructor(
    private readonly createReportHandler: CreateReportHandler,

    private readonly updateMyReportHandler: UpdateMyReportHandler,

    private readonly updateStatusHandler: UpdateStatusHandler,

    private readonly uploadAttachmentHandler: UploadAttachmentHandler,

    private readonly downloadAttachmentHandler: DownloadAttachmentHandler,

    private readonly getForAdminHandler: GetForAdminHandler,

    private readonly getMineHandler: GetMineHandler,

    private readonly listForAdminHandler: ListForAdminHandler,

    private readonly listMineHandler: ListMineHandler,
    @Inject(AUDIT_LOGGER_PORT)
    private readonly audit: AuditLoggerPort,
  ) {}

  @Post('issues')
  @ApiOperation({ summary: 'ISSUE-01: Tạo báo cáo sự cố' })
  @ApiZodBody(CreateIssueSchema)
  @ApiResponse({ status: 201, description: 'Tạo mới thành công' })
  async createReport(
    @CurrentUser() user: CurrentUserPayload,
    @Body(new ZodValidationPipe(CreateIssueSchema)) dto: CreateIssueDto,
  ): Promise<Record<string, unknown>> {
    return this.createReportHandler.execute(user.userId, dto);
  }

  @Get('issues')
  @ApiOperation({ summary: 'ISSUE-02: Danh sách báo cáo của tôi' })
  @ApiZodQuery(ListIssuesQuerySchema)
  @ApiResponse({ status: 200, description: 'Thành công' })
  async listMine(
    @CurrentUser() user: CurrentUserPayload,
    @Query(new ZodValidationPipe(ListIssuesQuerySchema)) query: ListIssuesQueryDto,
  ): Promise<{ items: Record<string, unknown>[]; meta: { nextCursor: string | null; hasMore: boolean; }; }> {
    return this.listMineHandler.execute(user.userId, query);
  }

  @Post('issues/:id/attachments')
  @ApiOperation({ summary: 'ISSUE-01: Upload tệp đính kèm (png/jpg/pdf, <=10MB, tối đa 3 tệp)' })
  @ApiConsumes('multipart/form-data')
  @ApiResponse({ status: 201, description: 'Tạo mới thành công' })
  async uploadAttachment(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
    @Req() req: Request,
  ): Promise<Record<string, unknown>> {
    const file = await new Promise<{
      filename: string;
      mimeType: string;
      size: number;
      stream: Readable;
    }>((resolve, reject) => {
      const bb = busboy({ headers: req.headers, limits: { fileSize: 10 * 1024 * 1024 } });
      let done = false;
      bb.on(
        'file',
        (_field: string, stream: Readable, info: { filename: string; mimeType: string }) => {
          const chunks: Buffer[] = [];
          let size = 0;
          stream.on('data', (c: Buffer) => {
            size += c.length;
            chunks.push(c);
          });
          stream.on('end', () => {
            done = true;
            resolve({
              filename: info.filename || 'attachment',
              mimeType: info.mimeType,
              size,
              stream: Readable.from(Buffer.concat(chunks)),
            });
          });
          stream.on('error', (e: unknown) => reject(e));
        },
      );
      bb.on('error', (e: unknown) => reject(e));
      bb.on('finish', () => {
        if (!done) reject(new ValidationError('Không tìm thấy tệp đính kèm trong yêu cầu'));
      });
      req.pipe(bb);
    });
    const result = await this.uploadAttachmentHandler.execute(user.userId, user.role, id, file);
    await this.audit.log({
      actorId: user.userId,
      actorRole: user.role,
      action: 'ISSUE_ATTACHMENT_UPLOADED',
      targetType: 'issue_report',
      targetId: id,
      ipAddress: (req.ip ?? null) as string | null,
      userAgent: (req.headers['user-agent'] as string) ?? null,
      metadata: { filename: file.filename, sizeBytes: file.size, contentType: file.mimeType },
    });
    return result;
  }

  @Get('issues/:id/attachments/:attachmentId')
  @ApiOperation({ summary: 'Tải tệp đính kèm báo cáo (kiểm tra quyền, có audit log)' })
  @ApiResponse({ status: 200, description: 'File đính kèm (stream) — tải trực tiếp từ storage' })
  async downloadAttachment(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
    @Param('attachmentId') attachmentId: string,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    const file = await this.downloadAttachmentHandler.execute(
      user.userId,
      user.role,
      id,
      attachmentId,
    );
    res.setHeader('Content-Type', file.contentType);
    const safe = encodeURIComponent(file.filename).replace(/['()]/g, escape);
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${safe}`);
    if (typeof file.sizeBytes === 'number' && file.sizeBytes > 0)
      res.setHeader('Content-Length', String(file.sizeBytes));
    await this.audit.log({
      actorId: user.userId,
      actorRole: user.role,
      action: 'ISSUE_ATTACHMENT_DOWNLOADED',
      targetType: 'issue_report',
      targetId: id,
      workspaceId: file.workspaceId,
      ipAddress: (req.ip ?? null) as string | null,
      userAgent: (req.headers['user-agent'] as string) ?? null,
      metadata: { attachmentId, filename: file.filename, sizeBytes: file.sizeBytes },
    });
    file.stream.pipe(res);
  }

  @Get('issues/:id')
  @ApiOperation({ summary: 'ISSUE-03: Chi tiết báo cáo của tôi' })
  @ApiResponse({ status: 200, description: 'Thành công' })
  async getMine(@CurrentUser() user: CurrentUserPayload, @Param('id') id: string): Promise<Record<string, unknown>> {
    return this.getMineHandler.execute(user.userId, id);
  }

  @Patch('issues/:id')
  @ApiOperation({
    summary:
      'ISSUE-EDIT: Sửa báo cáo của tôi (chỉ khi status = needs_info — quản trị viên đã yêu cầu bổ sung)',
  })
  @ApiZodBody(UpdateMyIssueSchema)
  @ApiResponse({ status: 200, description: 'Thành công' })
  async updateMine(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(UpdateMyIssueSchema)) dto: UpdateMyIssueDto,
    @Req() req: Request,
  ): Promise<Record<string, unknown>> {
    const result = await this.updateMyReportHandler.execute(user.userId, id, {
      ...(dto.title !== undefined ? { title: dto.title } : {}),
      ...(dto.description !== undefined ? { description: dto.description } : {}),
      ...(dto.removeAttachmentIds !== undefined
        ? { removeAttachmentIds: dto.removeAttachmentIds }
        : {}),
      expectedVersion: dto.expectedVersion,
    });
    await this.audit.log({
      actorId: user.userId,
      actorRole: user.role,
      action: 'ISSUE_REPORT_UPDATED',
      targetType: 'issue_report',
      targetId: id,
      ipAddress: (req.ip ?? null) as string | null,
      userAgent: (req.headers['user-agent'] as string) ?? null,
      metadata: {
        title: dto.title ?? null,
        descriptionChanged: dto.description !== undefined,
        removedAttachments: dto.removeAttachmentIds?.length ?? 0,
      },
    });
    return result;
  }

  @Get('admin/issues')
  @Roles('admin')
  @ApiOperation({ summary: 'ISSUE-04: Danh sách báo cáo (quản trị)' })
  @ApiZodQuery(AdminListIssuesQuerySchema)
  @ApiResponse({ status: 200, description: 'Thành công' })
  async listForAdmin(
    @Query(new ZodValidationPipe(AdminListIssuesQuerySchema)) query: AdminListIssuesQueryDto,
  ): Promise<{ items: Record<string, unknown>[]; meta: { nextCursor: string | null; hasMore: boolean; }; }> {
    return this.listForAdminHandler.execute(query);
  }

  @Get('admin/issues/:id')
  @Roles('admin')
  @ApiOperation({ summary: 'ISSUE-04: Chi tiết báo cáo (quản trị)' })
  @ApiResponse({ status: 200, description: 'Thành công' })
  async getForAdmin(@CurrentUser() user: CurrentUserPayload, @Param('id') id: string): Promise<Record<string, unknown>> {
    return this.getForAdminHandler.execute(id, user.role);
  }

  @Patch('admin/issues/:id/status')
  @Roles('admin')
  @ApiOperation({ summary: 'ISSUE-04: Đổi trạng thái báo cáo (optimistic locking)' })
  @ApiZodBody(UpdateIssueStatusSchema)
  @ApiResponse({ status: 200, description: 'Thành công' })
  async updateStatus(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(UpdateIssueStatusSchema)) dto: UpdateIssueStatusDto,
    @Req() req: Request,
  ): Promise<Record<string, unknown>> {
    const before = await this.getForAdminHandler.execute(id, user.role);
    const result = await this.updateStatusHandler.execute(
      id,
      user.role,
      dto.status,
      dto.expectedVersion,
    );
    await this.audit.log(
      {
        actorId: user.userId,
        actorRole: user.role,
        action: 'ISSUE_STATUS_CHANGED',
        targetType: 'issue_report',
        targetId: id,
        ipAddress: (req.ip ?? null) as string | null,
        userAgent: (req.headers['user-agent'] as string) ?? null,
        metadata: { from: before.status, to: dto.status },
      },
      [{ field: 'status', beforeValue: before.status, afterValue: dto.status }],
    );
    return result;
  }
}
