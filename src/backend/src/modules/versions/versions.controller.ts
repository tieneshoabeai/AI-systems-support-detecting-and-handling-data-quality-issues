import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  Body,
  UseGuards,
  ParseIntPipe,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { VersionsService } from './versions.service';
import {
  CommitVersionSchema,
  CommitVersionDto,
  DiffVersionsQuerySchema,
  DiffVersionsQueryDto,
  ListVersionsQuerySchema,
  ListVersionsQueryDto,
} from './dto/version.dto';
import { JwtAuthGuard } from '../../shared/guards/jwt-auth.guard';
import { PoliciesGuard } from '../../shared/casl/policies.guard';
import { CheckPolicies } from '../../shared/casl/check-policies.decorator';
import { Action } from '../../shared/casl/actions.enum';
import { CurrentUser, CurrentUserPayload } from '../../shared/decorators/current-user.decorator';
import { ZodValidationPipe } from '../../shared/pipes/zod-validation.pipe';
import { ApiZodBody } from '../../shared/swagger/api-zod.decorator';

@ApiTags('Versions')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PoliciesGuard)
@Controller('datasets/:id/versions')
export class VersionsController {
  constructor(private readonly versionsService: VersionsService) {}

  @Post()
  @ApiOperation({ summary: 'F7.1: Tạo Snapshot CSV & Commit phiên bản Merkle mới' })
  @ApiZodBody(CommitVersionSchema)
  @CheckPolicies((ability) => ability.can(Action.Create, 'DatasetVersion'))
  async commitVersion(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserPayload,
    @Body(new ZodValidationPipe(CommitVersionSchema)) dto: CommitVersionDto
  ) {
    const version = await this.versionsService.commitVersion(id, user.userId, dto);
    return {
      message: `Đã commit phiên bản v${version.version_number} thành công`,
      version,
    };
  }

  @Get()
  @ApiOperation({ summary: 'F7.2: Danh sách lịch sử các phiên bản của tập dữ liệu' })
  @CheckPolicies((ability) => ability.can(Action.Read, 'DatasetVersion'))
  async getVersions(
    @Param('id') id: string,
    @Query(new ZodValidationPipe(ListVersionsQuerySchema)) query: ListVersionsQueryDto
  ) {
    return this.versionsService.getVersions(id, query);
  }

  @Get('diff')
  @ApiOperation({ summary: 'F7.4: So sánh sai khác cấu trúc và dữ liệu giữa 2 phiên bản' })
  @CheckPolicies((ability) => ability.can(Action.Read, 'DatasetVersion'))
  async diffVersions(
    @Param('id') id: string,
    @Query(new ZodValidationPipe(DiffVersionsQuerySchema)) query: DiffVersionsQueryDto
  ) {
    const diff = await this.versionsService.diffVersions(id, query.v1, query.v2);
    return { diff };
  }

  @Get(':versionNumber')
  @ApiOperation({ summary: 'F7.3: Xem chi tiết một phiên bản của tập dữ liệu' })
  @CheckPolicies((ability) => ability.can(Action.Read, 'DatasetVersion'))
  async getVersionByNumber(
    @Param('id') id: string,
    @Param('versionNumber', ParseIntPipe) versionNumber: number
  ) {
    const version = await this.versionsService.getVersionByNumber(id, versionNumber);
    return { version };
  }

  @Post(':versionNumber/rollback')
  @ApiOperation({ summary: 'F7.5: Khôi phục tại chỗ (In-place Rollback) về phiên bản chỉ định' })
  @CheckPolicies((ability) => ability.can(Action.Update, 'DatasetVersion'))
  async rollbackVersion(
    @Param('id') id: string,
    @Param('versionNumber', ParseIntPipe) versionNumber: number,
    @CurrentUser() user: CurrentUserPayload
  ) {
    return this.versionsService.rollbackVersion(id, versionNumber, user.userId);
  }
}
