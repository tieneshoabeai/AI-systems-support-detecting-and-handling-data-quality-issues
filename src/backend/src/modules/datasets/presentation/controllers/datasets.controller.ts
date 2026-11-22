import { Inject, Controller, Get, Post, Delete, Param, Req, Res, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Request, Response } from 'express';
import busboy from 'busboy';
import { AUDIT_LOGGER_PORT, type AuditLoggerPort } from '../../../audit';
import {
  CurrentUser,
  CurrentUserPayload,
} from '../../../../shared/interfaces/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../../../shared/interfaces/guards/jwt-auth.guard';
import { PoliciesGuard } from '../../../../shared/interfaces/casl/policies.guard';
import { CheckPolicies } from '../../../../shared/interfaces/casl/check-policies.decorator';
import { PolicyResource } from '../../../../shared/interfaces/casl/policy-resource.decorator';
import { Action } from '../../../../shared/domain/security/action';
import { DeleteDatasetHandler } from '../../application/commands/delete-dataset.handler';
import { DownloadDatasetFileHandler } from '../../application/queries/download-dataset-file.handler';
import { GetDatasetByIdHandler } from '../../application/queries/get-dataset-by-id.handler';
import { GetDatasetByProjectIdHandler } from '../../application/queries/get-dataset-by-project-id.handler';
import { GetDatasetSchemaHandler } from '../../application/queries/get-dataset-schema.handler';
import { IngestDatasetStreamHandler } from '../../application/commands/ingest-dataset-stream.handler';
import { DatasetPolicyLoader } from '../../application/policy-loaders/dataset-policy.loader';
import { ProjectScopePolicyLoader } from '../../../projects';
import { toDatasetResponse, type DatasetResponse } from '../responses/dataset.response';
import { ValidationError } from '../../../../shared/domain/errors';

@ApiTags('Datasets')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PoliciesGuard)
@Controller()
export class DatasetsController {
  constructor(
    private readonly deleteDatasetHandler: DeleteDatasetHandler,

    private readonly ingestDatasetStreamHandler: IngestDatasetStreamHandler,

    private readonly downloadDatasetFileHandler: DownloadDatasetFileHandler,

    private readonly getDatasetByIdHandler: GetDatasetByIdHandler,

    private readonly getDatasetByProjectIdHandler: GetDatasetByProjectIdHandler,

    private readonly getDatasetSchemaHandler: GetDatasetSchemaHandler,

    @Inject(AUDIT_LOGGER_PORT)
    private readonly audit: AuditLoggerPort,
  ) {}

  @Post('projects/:projectId/datasets/upload')
  @ApiOperation({
    summary: 'F4.1 (Wave 4): Streaming upload file CSV duy nhat (1 file = 1 bang) vao Project',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    description: 'File CSV duy nhat (field name: file)',
    required: true,
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
      },
      required: ['file'],
    },
  })
  @CheckPolicies((ability) => ability.can(Action.Create, 'Dataset'))
  // UC-08: import dữ liệu chỉ WS-OWNER hoặc PROJ-OWNER → instance check theo
  // `project_id` của project chứa dataset.
  @PolicyResource('Dataset', ProjectScopePolicyLoader, 'projectId')
  @ApiResponse({ status: 201, description: 'Tạo mới thành công' })
  async uploadDataset(@Param('projectId') projectId: string, @Req() req: Request): Promise<unknown> {
    return new Promise((resolve, reject) => {
      const bb = busboy({ headers: req.headers, limits: { fileSize: 50 * 1024 * 1024 } });
      let fileProcessed = false;

      bb.on('file', (_fieldName, fileStream, info) => {
        const { filename, mimeType } = info;
        fileProcessed = true;
        const contentLength = req.headers['content-length']
          ? parseInt(req.headers['content-length'], 10)
          : undefined;

        this.ingestDatasetStreamHandler
          .execute({
            projectId,
            fileStream,
            fileName: filename || 'unnamed_dataset.csv',
            mimeType,
            contentLength,
          })
          .then((dataset) => {
            resolve({
              message: 'Tai len va xu ly tap du lieu CSV thanh cong',
              dataset: toDatasetResponse(dataset),
            });
          })
          .catch((err: unknown) => reject(err));
      });

      bb.on('error', (err: unknown) => reject(err));

      bb.on('finish', () => {
        if (!fileProcessed) {
          reject(new ValidationError('Khong tim thay tep dinh kem trong yeu cau'));
        }
      });

      req.pipe(bb);
    });
  }

  @Get('projects/:projectId/datasets')
  @ApiOperation({ summary: 'F4.2: Lay thong tin tap du lieu cua du an' })
  @PolicyResource('Dataset', ProjectScopePolicyLoader, 'projectId')
  @CheckPolicies((ability) => ability.can(Action.Read, 'Dataset'))
  @ApiResponse({ status: 200, description: 'Thành công' })
  async getDatasetByProject(@Param('projectId') projectId: string): Promise<{ dataset: DatasetResponse | null; }> {
    const dataset = await this.getDatasetByProjectIdHandler.execute(projectId);
    return { dataset: dataset ? toDatasetResponse(dataset) : null };
  }

  @Get('datasets/:id')
  @ApiOperation({ summary: 'F4.3: Xem chi tiet thong tin tap du lieu (khong bao gom storage_key)' })
  @PolicyResource('Dataset', DatasetPolicyLoader)
  @CheckPolicies((ability) => ability.can(Action.Read, 'Dataset'))
  @ApiResponse({ status: 200, description: 'Thành công' })
  async getDatasetById(@Param('id') id: string): Promise<{ dataset: DatasetResponse; }> {
    const dataset = await this.getDatasetByIdHandler.execute(id);
    return { dataset: toDatasetResponse(dataset) };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // BẤT BIẾN DỮ LIỆU (Data Immutability)
  //
  // Nguyên tắc (OPEN-03, chốt 2026-11-19): hệ thống **chỉ nhận dataset và
  // phân tích** — người dùng KHÔNG được thao tác lên dataset sau khi nạp.
  //
  // Nội dung dataset (giá trị ô, số dòng, số cột, kiểu dữ liệu cột, file gốc,
  // **tên hiển thị của cột**, **tên dataset**, **cờ PII**) là bản chụp bất biến
  // ngay sau khi nạp. Không route nào sửa được chúng.
  //
  // Thay vì sửa, hệ thống **phát hiện** vấn đề (tên cột rỗng/trùng, ô nghi ngờ
  // ngày/số…) và trả về trong mục **Phát hiện** (`findings`) — kèm vị trí lỗi
  // cụ thể. Người dùng sửa file rồi **xoá dataset và nạp lại**.
  //
  // VẪN GIỮ:
  //   - `POST /projects/:projectId/datasets/upload` — nạp dataset
  //   - `DELETE /datasets/:id` — huỷ bỏ toàn bộ dataset để nạp lại từ đầu
  // ─────────────────────────────────────────────────────────────────────────

  @Delete('datasets/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'F4.5: Xoa mem tap du lieu va giai phong du an' })
  @PolicyResource('Dataset', DatasetPolicyLoader)
  @CheckPolicies((ability) => ability.can(Action.Delete, 'Dataset'))
  @ApiResponse({ status: 204, description: 'Thành công, không có nội dung phản hồi' })
  async deleteDataset(@Param('id') id: string): Promise<void> {
    await this.deleteDatasetHandler.execute(id);
  }

  @Get('datasets/:id/file')
  @ApiOperation({ summary: 'FILE-01: Tải file gốc .csv (stream trực tiếp, có audit log)' })
  // FILE-01: PROJ-VIEWER cũng được tải file gốc (quyết định v3 mục 3.4).
  @PolicyResource('Dataset', DatasetPolicyLoader)
  @CheckPolicies((ability) => ability.can(Action.Read, 'Dataset'))
  @ApiResponse({ status: 200, description: 'File CSV gốc (stream) — tải trực tiếp từ storage' })
  async downloadDatasetFile(
    @Param('id') id: string,
    @CurrentUser() actor: CurrentUserPayload,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    const file = await this.downloadDatasetFileHandler.execute(id);
    res.setHeader('Content-Type', file.contentType);
    const safe = encodeURIComponent(file.filename).replace(/['()]/g, escape);
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${safe}`);
    if (typeof file.fileSizeBytes === 'number' && file.fileSizeBytes > 0) {
      res.setHeader('Content-Length', String(file.fileSizeBytes));
    }
    await this.audit.log({
      actorId: actor?.userId ?? null,
      actorRole: ((actor as unknown as Record<string, unknown>)?.role as string) ?? null,
      action: 'DATASET_FILE_DOWNLOADED',
      targetType: 'dataset',
      targetId: id,
      workspaceId: file.workspaceId,
      projectId: file.projectId,
      ipAddress: (req.ip ?? null) as string | null,
      userAgent: (req.headers['user-agent'] as string) ?? null,
      metadata: { datasetId: id, fileSizeBytes: file.fileSizeBytes },
    });
    file.stream.pipe(res);
  }

  @Get('datasets/:id/schema')
  @ApiOperation({ summary: 'F4.6: Xem schema voi key cot on dinh c0..cN' })
  @PolicyResource('Dataset', DatasetPolicyLoader)
  @CheckPolicies((ability) => ability.can(Action.Read, 'Dataset'))
  @ApiResponse({ status: 200, description: 'Thành công' })
  async getDatasetSchema(@Param('id') id: string): Promise<{ columns: DatasetResponse['columns']; }> {
    const columns = await this.getDatasetSchemaHandler.execute(id);
    return {
      columns: columns.map((c) => ({
        key: c.key,
        index: c.index,
        name: c.name,
        dataType: c.dataType,
        originalName: c.originalName,
        missingCount: c.missingCount,
        isPii: c.isPii,
      })),
    };
  }
}
