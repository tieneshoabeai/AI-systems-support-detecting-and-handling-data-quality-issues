import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Req,
  UseGuards,
  HttpCode,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiConsumes } from '@nestjs/swagger';
import { Request } from 'express';
import busboy from 'busboy';
import { DatasetsService } from './datasets.service';
import { UpdateDatasetSchema, UpdateDatasetDto } from './dto/update-dataset.dto';
import { JwtAuthGuard } from '../../shared/guards/jwt-auth.guard';
import { PoliciesGuard } from '../../shared/casl/policies.guard';
import { CheckPolicies } from '../../shared/casl/check-policies.decorator';
import { Action } from '../../shared/casl/actions.enum';
import { ZodValidationPipe } from '../../shared/pipes/zod-validation.pipe';
import { ApiZodBody } from '../../shared/swagger/api-zod.decorator';

@ApiTags('Datasets')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PoliciesGuard)
@Controller()
export class DatasetsController {
  constructor(private readonly datasetsService: DatasetsService) {}

  @Post('projects/:projectId/datasets/upload')
  @ApiOperation({ summary: 'F4.1: Streaming upload file dữ liệu (CSV/Excel) vào Project' })
  @ApiConsumes('multipart/form-data')
  @CheckPolicies((ability) => ability.can(Action.Create, 'Dataset'))
  async uploadDataset(
    @Param('projectId') projectId: string,
    @Req() req: Request
  ) {
    return new Promise((resolve, reject) => {
      const bb = busboy({ headers: req.headers });
      let fileProcessed = false;

      bb.on('file', (_fieldName, fileStream, info) => {
        const { filename, mimeType } = info;
        fileProcessed = true;
        const contentLength = req.headers['content-length']
          ? parseInt(req.headers['content-length'], 10)
          : undefined;

        this.datasetsService
          .ingestDatasetStream({
            projectId,
            fileStream,
            fileName: filename || 'unnamed_dataset.csv',
            mimeType,
            contentLength,
          })
          .then((dataset) => {
            resolve({
              message: 'Tải lên và xử lý tập dữ liệu thành công',
              dataset,
            });
          })
          .catch((err: unknown) => reject(err));
      });

      bb.on('error', (err: unknown) => reject(err));

      bb.on('finish', () => {
        if (!fileProcessed) {
          reject(new BadRequestException('Không tìm thấy tệp đính kèm trong yêu cầu'));
        }
      });

      req.pipe(bb);
    });
  }

  @Get('projects/:projectId/datasets')
  @ApiOperation({ summary: 'F4.2: Lấy thông tin tập dữ liệu của dự án' })
  @CheckPolicies((ability) => ability.can(Action.Read, 'Dataset'))
  async getDatasetByProject(@Param('projectId') projectId: string) {
    const dataset = await this.datasetsService.getDatasetByProjectId(projectId);
    return { dataset };
  }

  @Get('datasets/:id')
  @ApiOperation({ summary: 'F4.3: Xem chi tiết thông tin tập dữ liệu' })
  @CheckPolicies((ability) => ability.can(Action.Read, 'Dataset'))
  async getDatasetById(@Param('id') id: string) {
    const dataset = await this.datasetsService.getDatasetById(id);
    return { dataset };
  }

  @Patch('datasets/:id')
  @ApiOperation({ summary: 'F4.4: Cập nhật tên/thông tin tập dữ liệu' })
  @ApiZodBody(UpdateDatasetSchema)
  @CheckPolicies((ability) => ability.can(Action.Update, 'Dataset'))
  async updateDataset(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(UpdateDatasetSchema)) dto: UpdateDatasetDto
  ) {
    const dataset = await this.datasetsService.updateDataset(id, dto);
    return {
      message: 'Cập nhật tập dữ liệu thành công',
      dataset,
    };
  }

  @Delete('datasets/:id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'F4.5: Xóa mềm tập dữ liệu và giải phóng dự án' })
  @CheckPolicies((ability) => ability.can(Action.Delete, 'Dataset'))
  async deleteDataset(@Param('id') id: string) {
    await this.datasetsService.deleteDataset(id);
    return {
      message: 'Xóa tập dữ liệu thành công, dự án đã sẵn sàng cho dữ liệu mới',
    };
  }

  @Get('datasets/:id/schema')
  @ApiOperation({ summary: 'F4.6: Xem cấu trúc schema và kiểu dữ liệu các cột' })
  @CheckPolicies((ability) => ability.can(Action.Read, 'Dataset'))
  async getDatasetSchema(@Param('id') id: string) {
    const columns = await this.datasetsService.getDatasetSchema(id);
    return { columns };
  }
}
