import {
  Inject,
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Req,
  Res,
  UseGuards,
  HttpCode,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiConsumes, ApiBody } from '@nestjs/swagger';
import { Request, Response } from 'express';
import busboy from 'busboy';
import { AUDIT_LOGGER_PORT, type AuditLoggerPort } from '../../../audit';
import {
  CurrentUser,
  CurrentUserPayload,
} from '../../../../shared/decorators/current-user.decorator';
import { UpdateDatasetSchema, UpdateDatasetDto } from './dtos/update-dataset.dto';
import { RenameColumnsSchema, RenameColumnsDto } from './dtos/rename-columns.dto';
import { JwtAuthGuard } from '../../../../shared/guards/jwt-auth.guard';
import { PoliciesGuard } from '../../../../shared/casl/policies.guard';
import { CheckPolicies } from '../../../../shared/casl/check-policies.decorator';
import { Action } from '../../../../shared/casl/actions.enum';
import { ZodValidationPipe } from '../../../../shared/pipes/zod-validation.pipe';
import { ApiZodBody } from '../../../../shared/swagger/api-zod.decorator';
import { DeleteDatasetHandler } from '../../application/commands/delete-dataset.handler';
import { DownloadDatasetFileHandler } from '../../application/queries/download-dataset-file.handler';
import { GetDatasetByIdHandler } from '../../application/queries/get-dataset-by-id.handler';
import { GetDatasetByProjectIdHandler } from '../../application/queries/get-dataset-by-project-id.handler';
import { GetDatasetSchemaHandler } from '../../application/queries/get-dataset-schema.handler';
import { IngestDatasetStreamHandler } from '../../application/commands/ingest-dataset-stream.handler';
import { RenameColumnsHandler } from '../../application/commands/rename-columns.handler';
import { ResetColumnNamesHandler } from '../../application/commands/reset-column-names.handler';
import { UpdateDatasetHandler } from '../../application/commands/update-dataset.handler';
import type { DatasetColumnRecord, DatasetRecord } from '../..';

@ApiTags('Datasets')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PoliciesGuard)
@Controller()
export class DatasetsController {
  constructor(
    private readonly deleteDatasetHandler: DeleteDatasetHandler,

    private readonly ingestDatasetStreamHandler: IngestDatasetStreamHandler,

    private readonly renameColumnsHandler: RenameColumnsHandler,

    private readonly resetColumnNamesHandler: ResetColumnNamesHandler,

    private readonly updateDatasetHandler: UpdateDatasetHandler,

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
              dataset,
            });
          })
          .catch((err: unknown) => reject(err));
      });

      bb.on('error', (err: unknown) => reject(err));

      bb.on('finish', () => {
        if (!fileProcessed) {
          reject(new BadRequestException('Khong tim thay tep dinh kem trong yeu cau'));
        }
      });

      req.pipe(bb);
    });
  }

  @Get('projects/:projectId/datasets')
  @ApiOperation({ summary: 'F4.2: Lay thong tin tap du lieu cua du an' })
  @CheckPolicies((ability) => ability.can(Action.Read, 'Dataset'))
  async getDatasetByProject(@Param('projectId') projectId: string): Promise<{ dataset: DatasetRecord | null; }> {
    const dataset = await this.getDatasetByProjectIdHandler.execute(projectId);
    return { dataset };
  }

  @Get('datasets/:id')
  @ApiOperation({ summary: 'F4.3: Xem chi tiet thong tin tap du lieu (khong bao gom storage_key)' })
  @CheckPolicies((ability) => ability.can(Action.Read, 'Dataset'))
  async getDatasetById(@Param('id') id: string): Promise<{ dataset: DatasetRecord; }> {
    const dataset = await this.getDatasetByIdHandler.execute(id);
    return { dataset };
  }

  @Patch('datasets/:id')
  @ApiOperation({ summary: 'F4.4: Cap nhat ten tap du lieu' })
  @ApiZodBody(UpdateDatasetSchema)
  @CheckPolicies((ability) => ability.can(Action.Update, 'Dataset'))
  async updateDataset(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(UpdateDatasetSchema)) dto: UpdateDatasetDto,
  ): Promise<{ message: string; dataset: DatasetRecord; }> {
    const dataset = await this.updateDatasetHandler.execute(id, dto);
    return {
      message: 'Cap nhat tap du lieu thanh cong',
      dataset,
    };
  }

  @Patch('datasets/:id/columns')
  @ApiOperation({ summary: 'Wave 4: Doi ten cot hien thi - key c{i} bat bien' })
  @ApiZodBody(RenameColumnsSchema)
  @CheckPolicies((ability) => ability.can(Action.Update, 'Dataset'))
  async renameColumns(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(RenameColumnsSchema)) dto: RenameColumnsDto,
  ): Promise<{ dataset: DatasetRecord; }> {
    const dataset = await this.renameColumnsHandler.execute(id, dto);
    return { dataset };
  }

  @Post('datasets/:id/columns/reset')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Wave 4 (M15): Khoi phuc ten cot ve ten goc tu file CSV' })
  @CheckPolicies((ability) => ability.can(Action.Update, 'Dataset'))
  async resetColumnNames(@Param('id') id: string): Promise<{ dataset: DatasetRecord; }> {
    const dataset = await this.resetColumnNamesHandler.execute(id);
    return { dataset };
  }

  @Delete('datasets/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'F4.5: Xoa mem tap du lieu va giai phong du an' })
  @CheckPolicies((ability) => ability.can(Action.Delete, 'Dataset'))
  async deleteDataset(@Param('id') id: string): Promise<void> {
    await this.deleteDatasetHandler.execute(id);
  }

  @Get('datasets/:id/file')
  @ApiOperation({ summary: 'FILE-01: Tải file gốc .csv (stream trực tiếp, có audit log)' })
  @CheckPolicies((ability) => ability.can(Action.Read, 'Dataset'))
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
  @CheckPolicies((ability) => ability.can(Action.Read, 'Dataset'))
  async getDatasetSchema(@Param('id') id: string): Promise<{ columns: DatasetColumnRecord[]; }> {
    const columns = await this.getDatasetSchemaHandler.execute(id);
    return { columns };
  }
}
