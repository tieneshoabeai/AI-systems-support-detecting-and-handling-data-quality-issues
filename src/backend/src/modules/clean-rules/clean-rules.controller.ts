import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { CleanRulesService } from './clean-rules.service';
import {
  PreviewRulesSchema,
  PreviewRulesDto,
  ApplyRulesSchema,
  ApplyRulesDto,
} from './dto/clean-rule.dto';
import { JwtAuthGuard } from '../../shared/guards/jwt-auth.guard';
import { PoliciesGuard } from '../../shared/casl/policies.guard';
import { CheckPolicies } from '../../shared/casl/check-policies.decorator';
import { Action } from '../../shared/casl/actions.enum';
import { CurrentUser, CurrentUserPayload } from '../../shared/decorators/current-user.decorator';
import { ZodValidationPipe } from '../../shared/pipes/zod-validation.pipe';
import { ApiZodBody } from '../../shared/swagger/api-zod.decorator';

@ApiTags('Clean Rules')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PoliciesGuard)
@Controller('datasets/:id/rules')
export class CleanRulesController {
  constructor(private readonly cleanRulesService: CleanRulesService) {}

  @Post('preview')
  @ApiOperation({ summary: 'F6.1: Dry-run Chạy thử danh sách luật trên 100 dòng mẫu đầu tiên' })
  @ApiZodBody(PreviewRulesSchema)
  @CheckPolicies((ability) => ability.can(Action.Execute, 'CleanRule'))
  async previewRules(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(PreviewRulesSchema)) dto: PreviewRulesDto
  ) {
    return this.cleanRulesService.previewRules(id, dto);
  }

  @Post('apply')
  @ApiOperation({ summary: 'F6.2: Áp dụng hàng loạt danh sách luật vào toàn bộ bảng & commit version' })
  @ApiZodBody(ApplyRulesSchema)
  @CheckPolicies((ability) => ability.can(Action.Execute, 'CleanRule'))
  async applyRules(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserPayload,
    @Body(new ZodValidationPipe(ApplyRulesSchema)) dto: ApplyRulesDto
  ) {
    return this.cleanRulesService.applyRules(id, user.userId, dto);
  }

  @Get()
  @ApiOperation({ summary: 'F6.3: Lấy danh sách lịch sử các luật đã lưu/áp dụng của tập dữ liệu' })
  @CheckPolicies((ability) => ability.can(Action.Read, 'CleanRule'))
  async getRules(@Param('id') id: string) {
    return this.cleanRulesService.getRules(id);
  }
}
