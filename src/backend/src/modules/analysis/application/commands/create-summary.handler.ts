/**
 * CreateSummaryHandler — Use case: `createSummary()`
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
import { isObjectIdHex } from '../../../../shared/domain/utils/object-id.util';
import { NotFoundError, ValidationError } from '../../../../shared/domain/errors';
import {
  compareIssues,
  outlierSeverity,
  rateSeverity,
  recommendationFor,
  severityReason,
  THRESHOLDS,
  type DqGroup,
  type Severity,
} from '../../domain/impact.util';
import { resolveTopN } from '../../domain/top-n.util';

@Injectable()
export class CreateSummaryHandler {
  constructor(
    @Inject(PROJECT_ACCESS_PORT)
    private readonly projects: ProjectAccessPort,
    @Inject(ANALYSIS_REPOSITORY_PORT)
    private readonly analysisRepository: AnalysisRepositoryPort,
  ) {}

  async execute(projectId: string): Promise<Record<string, unknown>> {
    if (!isObjectIdHex(projectId)) throw new ValidationError('ID Dự án không hợp lệ');
    const project = await this.projects.getProjectById(projectId);
    const run = await this.analysisRepository.findLatestRunByProject(projectId);
    if (!run)
      throw new NotFoundError('Chưa chạy phân tích — hãy chạy Data Analysis & Detection trước');
    if (run.status !== 'succeeded')
      throw new ValidationError('Phân tích hệ thống chưa thành công — hãy chạy lại phân tích');
    const result = await this.analysisRepository.findResultByRun(run.id);
    if (!result) throw new NotFoundError('Chưa có kết quả phân tích cho lần chạy mới nhất');
    const dq = (result.dqSummary ?? result.dq_summary ?? null) as unknown as {
      totalScanned: number;
      columns: {
        column: string;
        missingCount: number;
        missingRate: number | null;
        invalidCount: number;
        invalidRate: number | null;
        outlierCount: number;
        outlierRate: number | null;
      }[];
      duplicateRowCount: number;
      notes: string[];
    } | null;
    const issues: {
      dq: DqGroup;
      column: string | null;
      count: number;
      rate: number | null;
      severity: Severity;
      priority: number;
      rule: string;
      reason: string;
    }[] = [];
    if (dq) {
      for (const c of dq.columns) {
        const mk = (
          dqCode: DqGroup,
          count: number,
          rate: number | null,
          severity: Severity,
        ): void => {
          issues.push({
            dq: dqCode,
            column: c.column,
            count,
            rate,
            severity,
            priority: issues.length + 1,
            rule: THRESHOLDS.find((t) => t.dq === dqCode)?.rule ?? dqCode,
            reason: severityReason(dqCode, severity, rate),
          });
        };
        if (c.missingCount > 0) {
          mk('DQ-01', c.missingCount, c.missingRate, rateSeverity('DQ-01', c.missingRate));
        }
        if (c.invalidCount > 0) {
          mk('DQ-03', c.invalidCount, c.invalidRate, rateSeverity('DQ-03', c.invalidRate));
        }
        if (c.outlierCount > 0) {
          // DQ-04 đánh dấu theo phương pháp ngoại lệ, không theo tỷ lệ.
          // Không có phân rã IQR/Z-score chi tiết → suy mức "thấp" (ngoại lệ
          // không mặc định là lỗi cần xoá).
          const sev = outlierSeverity({ iqr: c.outlierCount, iqrExtreme: 0, zscore: 0, both: 0 }) ?? 'low';
          mk('DQ-04', c.outlierCount, c.outlierRate, sev);
        }
      }
      if (dq.duplicateRowCount > 0) {
        const rate =
          dq.totalScanned > 0 ? Number((dq.duplicateRowCount / dq.totalScanned).toFixed(4)) : null;
        const severity = rateSeverity('DQ-02', rate);
        issues.push({
          dq: 'DQ-02',
          column: null,
          count: dq.duplicateRowCount,
          rate,
          severity,
          priority: issues.length + 1,
          rule: THRESHOLDS.find((t) => t.dq === 'DQ-02')?.rule ?? 'DQ-02',
          reason: severityReason('DQ-02', severity, rate),
        });
      }
    }
    // Sắp xếp theo mức ảnh hưởng (cao → thấp), rồi theo tỷ lệ, rồi số lượng.
    issues.sort((a, b) => compareIssues(a, b));
    issues.forEach((it, i) => {
      it.priority = i + 1;
    });
    const ai = result.aiCorrelationAssessment as unknown as { status?: string } | null;
    // GĐ2 — nhóm Nghi vấn đi kèm Tổng kết (chỉ hiển thị, không phải vấn đề đã xác nhận).
    const suspicions = Array.isArray(result.suspicions) ? result.suspicions : [];
    // GĐ3 — `top_n` + cấu hình đã dùng (mục 2b của PDF báo cáo).
    const runConfig = (run.config ?? {}) as Record<string, unknown>;
    const topN = resolveTopN(runConfig.top_n);
    const configUsed = {
      selected_columns: Array.isArray(runConfig.selected_column_keys)
        ? (runConfig.selected_column_keys as unknown[])
        : null,
      label_column: runConfig.label_column ?? null,
      time_column: runConfig.time_column ?? null,
      time_granularity: runConfig.time_granularity ?? null,
      value_column: runConfig.value_column ?? null,
      correlation_method: runConfig.correlation_method ?? null,
      outlier_method: runConfig.outlier_method ?? null,
      top_n: topN,
      chart_top_n: runConfig.chart_top_n ?? null,
    };
    const summary = {
      overview: `Dataset ${dq?.totalScanned ?? 0} dòng, ${issues.length} nhóm vấn đề.`,
      issues: issues.slice(0, topN),
      suspicions,
      top_n: topN,
      config_used: configUsed,
      thresholds: THRESHOLDS,
      evidence_refs: await this.analysisRepository.countEvidencesByRun(run.id),
      recommendations: issues.map((it) => recommendationFor(it.dq as DqGroup, it.column)),
      ai_section: ai && (ai as { status?: string }).status === 'succeeded' ? ai : null,
    };
    const saved = await this.analysisRepository.createSave({
      projectId: project.id,
      workspaceId: project.workspaceId,
      analysisRunId: run.id,
      analysisResultId: result.id,
      inputFingerprint: result.inputFingerprint,
      summary,
    });
    await this.analysisRepository.markSavesStale(projectId, saved.id);
    return {
      saveId: saved.id,
      projectId,
      analysisRunId: run.id,
      inputFingerprint: result.inputFingerprint,
      summary,
      isStale: false,
    };
  }
}
