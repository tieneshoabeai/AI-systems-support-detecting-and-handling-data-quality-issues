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
import {
  ANALYSIS_ROLES,
  isRoleAllowedForType,
  type AnalysisRole,
} from '../../domain/column-role.util';

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

    // ── GĐ7 — ghi đè vai trò cột ───────────────────────────────────────────
    // Key là **key cột ổn định** (`c0`, `c1`, …), không phải tên hiển thị → đổi
    // tên cột không làm mất ghi đè.
    //
    // Validate nghiêm ngặt ở đây (tầng application) vì đây là **input** của
    // người dùng: sai thì phải báo rõ cột nào, role nào, không hợp lệ vì sao.
    let columnRoles: Record<string, string> | null = null;
    if (dto.column_roles !== undefined && dto.column_roles !== null) {
      const byKey = new Map((dataset?.columns ?? []).map((c) => [c.key, c] as const));
      columnRoles = {};
      for (const [key, role] of Object.entries(dto.column_roles)) {
        const col = byKey.get(key);
        if (!col) {
          throw new ValidationError(
            `column_roles có key cột không tồn tại: ${key}`,
            { key, availableKeys: [...byKey.keys()] },
          );
        }
        if (!(ANALYSIS_ROLES as readonly string[]).includes(role)) {
          throw new ValidationError(
            `column_roles: vai trò không hợp lệ "${role}" cho cột ${col.name}. ` +
              `Chỉ nhận: ${ANALYSIS_ROLES.join(', ')}.`,
            { key, role, allowedRoles: [...ANALYSIS_ROLES] },
          );
        }
        if (!isRoleAllowedForType(role as AnalysisRole, col.dataType)) {
          throw new ValidationError(
            `column_roles: vai trò "${role}" không hợp lệ cho cột ${col.name} (kiểu ${col.dataType}).`,
            { key, role, dataType: col.dataType },
          );
        }
        columnRoles[key] = role;
      }
    } else if (dto.column_roles === null) {
      // `null` → xoá hết ghi đè.
      columnRoles = null;
    }
    // `undefined` → giữ nguyên cấu hình cũ (không ghi đè `column_roles`).

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
        ...(columnRoles !== undefined ? { column_roles: columnRoles } : {}),
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
      // GĐ7 — trả về ghi đè vai trò cột để client hiển thị/kiểm chứng.
      columnRoles: saved.columnRoles ?? {},
    };
  }
}
