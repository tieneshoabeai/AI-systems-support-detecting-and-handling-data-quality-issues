import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  Body,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { Response } from 'express';
import { ExportsService } from './exports.service';
import {
  SecureExportSchema,
  SecureExportDto,
  ExportQuerySchema,
  ExportQueryDto,
} from './dto/export.dto';
import { JwtAuthGuard } from '../../shared/guards/jwt-auth.guard';
import { PoliciesGuard } from '../../shared/casl/policies.guard';
import { CheckPolicies } from '../../shared/casl/check-policies.decorator';
import { Action } from '../../shared/casl/actions.enum';
import { CurrentUser, CurrentUserPayload } from '../../shared/decorators/current-user.decorator';
import { ZodValidationPipe } from '../../shared/pipes/zod-validation.pipe';
import { ApiZodBody } from '../../shared/swagger/api-zod.decorator';

@ApiTags('Exports')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PoliciesGuard)
@Controller('datasets/:id')
export class ExportsController {
  constructor(private readonly exportsService: ExportsService) {}

  @Get('export/csv')
  @ApiOperation({
    summary: 'F9.1: Xuất dữ liệu CSV sạch dạng luồng trực tiếp sang HTTP Response (RAM <= 20MB)',
  })
  @CheckPolicies((ability) => ability.can(Action.Export, 'Dataset'))
  async exportCsv(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserPayload,
    @Query(new ZodValidationPipe(ExportQuerySchema)) query: ExportQueryDto,
    @Res() res: Response
  ): Promise<void> {
    await this.exportsService.exportCsvStream(id, user.userId, query.version, res);
  }

  @Post('export/secure')
  @ApiOperation({
    summary: 'F9.2: Xuất dữ liệu mã hóa luồng AES-256-GCM bảo vệ bằng mật khẩu, lưu R2 và tải về',
  })
  @ApiZodBody(SecureExportSchema)
  @CheckPolicies((ability) => ability.can(Action.Export, 'Dataset'))
  async exportSecure(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserPayload,
    @Body(new ZodValidationPipe(SecureExportSchema)) dto: SecureExportDto,
    @Res() res: Response
  ): Promise<void> {
    await this.exportsService.exportSecureStream(id, user.userId, dto, res);
  }

  @Get('exports')
  @ApiOperation({ summary: 'Xem lịch sử các tác vụ xuất dữ liệu của tập dữ liệu' })
  @CheckPolicies((ability) => ability.can(Action.Read, 'ExportTask'))
  async getExportHistory(@Param('id') id: string) {
    return this.exportsService.getExportHistory(id);
  }
}
