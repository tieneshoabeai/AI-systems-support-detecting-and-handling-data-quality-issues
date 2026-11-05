import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { CleanRulesRepository } from './clean-rules.repository';
import { RuleExecutorService } from './services/rule-executor.service';
import { DatasetsService } from '../datasets/datasets.service';
import { DatasetsRepository } from '../datasets/datasets.repository';
import { VersionsService } from '../versions/versions.service';
import { OutboxService } from '../../shared/application/outbox/outbox.service';
import { IDatasetRecord } from '../datasets/schemas/dataset-record.schema';
import { ICleanRule } from './schemas/clean-rule.schema';
import {
  PreviewRulesDto,
  PreviewRulesResultDto,
  ApplyRulesDto,
  ApplyRulesResultDto,
  CleanRuleDetailDto,
} from './dto/clean-rule.dto';

@Injectable()
export class CleanRulesService {
  private readonly logger = new Logger(CleanRulesService.name);

  constructor(
    private readonly cleanRulesRepository: CleanRulesRepository,
    private readonly ruleExecutorService: RuleExecutorService,
    private readonly datasetsService: DatasetsService,
    private readonly datasetsRepository: DatasetsRepository,
    @InjectModel('DatasetRecord')
    private readonly recordModel: Model<IDatasetRecord>,
    private readonly versionsService: VersionsService,
    private readonly outboxService: OutboxService
  ) {}

  /**
   * F6.1: Dry-run Chạy thử nghiệm danh sách luật trên 100 dòng mẫu đầu tiên (Không chạm CSDL thật)
   */
  async previewRules(
    datasetId: string,
    dto: PreviewRulesDto
  ): Promise<PreviewRulesResultDto> {
    if (!Types.ObjectId.isValid(datasetId)) {
      throw new BadRequestException('ID Tập dữ liệu không hợp lệ');
    }

    const dataset = await this.datasetsService.getDatasetById(datasetId);
    if (!dataset) {
      throw new NotFoundException('Không tìm thấy tập dữ liệu hoặc tập dữ liệu đã bị xóa');
    }

    // 1. Lấy tối đa 100 dòng mẫu đầu tiên từ MongoDB Atlas với .lean() để tối ưu bộ nhớ
    const records = await this.recordModel
      .find({
        dataset_id: new Types.ObjectId(datasetId),
        deleted_at: null,
      })
      .sort({ row_index: 1 })
      .limit(100)
      .lean()
      .exec();

    const sampleBefore: Record<string, unknown>[] = records.map(
      (r) => (r.data as Record<string, unknown>) ?? {}
    );

    // 2. Chạy thử nghiệm toàn bộ rules trên bản sao in-memory
    const execResult = this.ruleExecutorService.executeRules(sampleBefore, dto.rules);

    this.logger.log(
      `Đã hoàn tất Dry-run Preview cho Dataset ${datasetId} trên ${sampleBefore.length} dòng mẫu (${execResult.affectedRowsCount} dòng bị ảnh hưởng)`
    );

    return {
      total_sample_rows: sampleBefore.length,
      affected_rows_count: execResult.affectedRowsCount,
      dropped_rows_count: execResult.droppedRowsCount,
      sample_before: sampleBefore,
      sample_after: execResult.transformedRecords,
      rule_stats: execResult.ruleStats,
    };
  }

  /**
   * F6.2: Áp dụng Hàng loạt các luật lên toàn bộ bảng dữ liệu và tự động commit phiên bản Merkle mới
   */
  async applyRules(
    datasetId: string,
    userId: string,
    dto: ApplyRulesDto
  ): Promise<ApplyRulesResultDto> {
    if (!Types.ObjectId.isValid(datasetId)) {
      throw new BadRequestException('ID Tập dữ liệu không hợp lệ');
    }

    const dataset = await this.datasetsService.getDatasetById(datasetId);
    if (!dataset) {
      throw new NotFoundException('Không tìm thấy tập dữ liệu hoặc tập dữ liệu đã bị xóa');
    }

    // 1. Lưu trữ danh sách rules vào collection clean_rules
    const rulesToInsert = dto.rules.map((r) => ({
      dataset_id: new Types.ObjectId(datasetId),
      workspace_id: dataset.workspace_id,
      name:
        r.name ||
        `${r.action} trên ${r.target_column || (r.target_columns && r.target_columns.join(',')) || 'toàn bộ bảng'}`,
      category: r.category,
      action: r.action,
      target_column: r.target_column ?? null,
      target_columns: r.target_columns ?? [],
      parameters: r.parameters ?? {},
      created_by: new Types.ObjectId(userId),
    }));

    const savedRules = await this.cleanRulesRepository.bulkInsertRules(rulesToInsert);
    const ruleIds = savedRules.map((r) => r._id.toHexString());

    // 2. Đọc toàn bộ các bản ghi hiện tại của dataset
    const records = await this.recordModel
      .find({
        dataset_id: new Types.ObjectId(datasetId),
        deleted_at: null,
      })
      .sort({ row_index: 1 })
      .lean()
      .exec();

    const dataArray: Record<string, unknown>[] = records.map(
      (r) => (r.data as Record<string, unknown>) ?? {}
    );

    // 3. Thực thi động cơ quy tắc trên toàn bộ dữ liệu
    const execResult = this.ruleExecutorService.executeRules(dataArray, dto.rules);

    // 4. Cập nhật lại các bản ghi trong database: Dọn sạch và ghi lại dữ liệu đã biến đổi
    await this.recordModel.deleteMany({
      dataset_id: new Types.ObjectId(datasetId),
    });

    const batchSize = 1000;
    for (let i = 0; i < execResult.transformedRecords.length; i += batchSize) {
      const chunk = execResult.transformedRecords.slice(i, i + batchSize);
      const batchToInsert = chunk.map((data, idx) => ({
        dataset_id: new Types.ObjectId(datasetId),
        row_index: i + idx,
        data,
        version_number: dataset.current_version,
      }));
      await this.datasetsRepository.bulkInsertRecords(batchToInsert);
    }

    // 5. Cập nhật row_count của Dataset
    await this.datasetsRepository.updateById(datasetId, {
      $set: {
        row_count: execResult.transformedRecords.length,
      },
    });

    // 6. Tự động Commit phiên bản mới (tạo snapshot CSV trên R2, tính Merkle root hash)
    const newVersion = await this.versionsService.commitVersion(datasetId, userId, {
      description: dto.description,
      rule_ids: ruleIds,
    });

    // 7. Ghi nhận sự kiện RULES_APPLIED vào Outbox Pattern
    await this.outboxService.recordEvent({
      aggregate_type: 'DATASET',
      aggregate_id: datasetId,
      event_type: 'RULES_APPLIED',
      payload: {
        dataset_id: datasetId,
        rule_ids: ruleIds,
        applied_by: userId,
        affected_rows_count: execResult.affectedRowsCount,
        dropped_rows_count: execResult.droppedRowsCount,
        new_version_number: newVersion.version_number,
      },
    });

    this.logger.log(
      `Đã áp dụng thành công ${dto.rules.length} luật cho Dataset ${datasetId} và commit phiên bản v${newVersion.version_number}`
    );

    return {
      message: `Áp dụng thành công ${dto.rules.length} quy tắc làm sạch và đã tạo phiên bản v${newVersion.version_number}`,
      applied_rules_count: dto.rules.length,
      affected_rows_count: execResult.affectedRowsCount,
      dropped_rows_count: execResult.droppedRowsCount,
      version: {
        version_number: newVersion.version_number,
        version_hash: newVersion.version_hash,
        record_count: newVersion.record_count,
        data_checksum: newVersion.data_checksum,
      },
    };
  }

  /**
   * F6.3: Lấy danh sách các luật đã lưu/áp dụng của tập dữ liệu
   */
  async getRules(datasetId: string): Promise<{ rules: CleanRuleDetailDto[] }> {
    if (!Types.ObjectId.isValid(datasetId)) {
      throw new BadRequestException('ID Tập dữ liệu không hợp lệ');
    }

    await this.datasetsService.getDatasetById(datasetId);

    const rules = await this.cleanRulesRepository.findByDatasetId(datasetId);

    return {
      rules: rules.map((r) => this.mapToDetailDto(r)),
    };
  }

  private mapToDetailDto(rule: ICleanRule): CleanRuleDetailDto {
    return {
      id: rule._id.toHexString(),
      dataset_id: rule.dataset_id.toHexString(),
      workspace_id: rule.workspace_id.toHexString(),
      name: rule.name,
      category: rule.category,
      action: rule.action,
      target_column: rule.target_column,
      target_columns: rule.target_columns ?? [],
      parameters: rule.parameters ?? {},
      is_active: rule.is_active,
      created_by: rule.created_by.toHexString(),
      created_at: rule.created_at,
    };
  }
}
