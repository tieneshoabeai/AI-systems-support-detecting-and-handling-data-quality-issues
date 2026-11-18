/**
 * SaveConfigHandler — Use case: `saveConfig()`
 * (thay đổi trạng thái) — theo §3.10 Command/Query pattern.
 *
 * Handler không biết HTTP: trả về kết quả hoặc ném lỗi nghiệp vụ.
 * Dependency chỉ qua port token — không inject adapter cụ thể.
 */
import { Inject, Injectable } from '@nestjs/common';
import {
  ANALYSIS_REPOSITORY_PORT,
  type AnalysisRepositoryPort,
} from '../../domain/ports/analysis.repository.port';
import { PROJECT_ACCESS_PORT, type ProjectAccessPort } from '../../../projects';
import { DATASET_REPOSITORY_PORT, type DatasetRepositoryPort } from '../../../datasets';
import { isObjectIdHex } from '../../../../shared/domain/utils/object-id.util';
import { AnalysisConfigInput } from '../analysis.types';
import { ValidationError } from '../../../../shared/domain/errors';

@Injectable()
export class SaveConfigHandler {
  constructor(
    @Inject(PROJECT_ACCESS_PORT)
    private readonly projects: ProjectAccessPort,
    @Inject(DATASET_REPOSITORY_PORT)
    private readonly datasetsRepository: DatasetRepositoryPort,
    @Inject(ANALYSIS_REPOSITORY_PORT)
    private readonly analysisRepository: AnalysisRepositoryPort,
  ) {}

  async execute(projectId: string, dto: AnalysisConfigInput): Promise<Record<string, unknown>> {
    if (!isObjectIdHex(projectId)) throw new ValidationError('ID Dự án không hợp lệ');
    const project = await this.projects.getProjectById(projectId);
    const dataset = await this.datasetsRepository.findByProject(projectId);
    const known = new Set((dataset?.columns ?? []).map((c) => c.name));
    const norm = (v: string | null | undefined): string | null => {
      if (v === undefined || v === null) return null;
      return known.has(v) ? v : null;
    };
    const selected =
      dto.selected_columns === undefined || dto.selected_columns === null
        ? null
        : dto.selected_columns.filter((c) => known.has(c));
    if (
      dto.selected_columns &&
      dto.selected_columns.length > 0 &&
      (!selected || selected.length === 0)
    ) {
      throw new ValidationError('selected_columns không khớp cột nào của dataset');
    }
    const label = norm(dto.label_column ?? null);
    const time = norm(dto.time_column ?? null);
    const value = norm(dto.value_column ?? null);
    if (label && dataset) {
      const dt = dataset.columns.find((c) => c.name === label)?.dataType;
      if (dt === 'number' || dt === 'date')
        throw new ValidationError('label_column phải là cột phân loại (string/boolean)');
    }
    if (time && dataset) {
      const dt = dataset.columns.find((c) => c.name === time)?.dataType;
      if (dt !== 'date') throw new ValidationError('time_column phải là cột date');
    }
    if (value && dataset) {
      const dt = dataset.columns.find((c) => c.name === value)?.dataType;
      if (dt !== 'number') throw new ValidationError('value_column phải là cột số');
    }
    const saved = await this.analysisRepository.upsertConfig(
      projectId,
      project.workspaceId.toString(),
      {
        project_id: project.id,
        selected_columns: selected,
        label_column: label,
        time_column: time,
        time_granularity: dto.time_granularity,
        value_column: value,
        correlation_method: dto.correlation_method,
        outlier_method: dto.outlier_method,
        top_n: dto.top_n,
      },
    );
    await this.analysisRepository.markResultsStale(
      projectId,
      '000000000000000000000000',
      'config_changed',
    );
    return {
      projectId,
      selectedColumns: saved.selectedColumns,
      labelColumn: saved.labelColumn,
      timeColumn: saved.timeColumn,
      timeGranularity: saved.timeGranularity,
      valueColumn: saved.valueColumn,
      correlationMethod: saved.correlationMethod,
      outlierMethod: saved.outlierMethod,
      topN: saved.topN,
    };
  }
}
