/**
 * GetConfigHandler — Use case: `getConfig()`
 * (chỉ đọc) — theo §3.10 Command/Query pattern.
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
import { isObjectIdHex } from '../../../../shared/domain/utils/object-id.util';
import { ValidationError } from '../../../../shared/domain/errors';

@Injectable()
export class GetConfigHandler {
  constructor(
    @Inject(PROJECT_ACCESS_PORT)
    private readonly projects: ProjectAccessPort,
    @Inject(ANALYSIS_REPOSITORY_PORT)
    private readonly analysisRepository: AnalysisRepositoryPort,
  ) {}

  async execute(projectId: string): Promise<Record<string, unknown>> {
    if (!isObjectIdHex(projectId)) throw new ValidationError('ID Dự án không hợp lệ');
    await this.projects.getProjectById(projectId);
    const saved = await this.analysisRepository.findConfigByProject(projectId);
    if (!saved) {
      return {
        projectId,
        selectedColumns: null,
        labelColumn: null,
        timeColumn: null,
        timeGranularity: 'day',
        valueColumn: null,
        correlationMethod: 'pearson',
        outlierMethod: 'iqr',
        topN: 10,
      };
    }
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
