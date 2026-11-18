import { Inject, Injectable, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { ANALYSIS_REPOSITORY_PORT, type AnalysisRepositoryPort } from '../domain/ports/analysis.repository.port';
import { ProjectsService } from '../../projects/application/projects.service';
import { isObjectIdHex } from '../../../shared/utils/object-id.util';
import { resolveTopN } from '../domain/top-n.util';
import { StalenessService } from './staleness.service';
import {
  SEVERITY_LABEL,
  THRESHOLDS,
  compareIssues,
  outlierSeverity,
  rateSeverity,
  recommendationFor,
  severityReason,
  issueExplanation,
  type DqGroup,
  type OutlierBreakdown,
  type Severity,
} from '../domain/impact.util';

@Injectable()
export class SummaryService {
  constructor(
    @Inject(ANALYSIS_REPOSITORY_PORT)
    private readonly analysisRepository: AnalysisRepositoryPort,
    private readonly projectsService: ProjectsService,
    private readonly staleness: StalenessService,
  ) {}

  async createSummary(projectId: string): Promise<Record<string, unknown>> {
    if (!isObjectIdHex(projectId)) throw new BadRequestException('ID Dự án không hợp lệ');
    const project = await this.projectsService.getProjectById(projectId);
    const run = await this.analysisRepository.findLatestRunByProject(projectId);
    if (!run) throw new NotFoundException('Chưa chạy phân tích — hãy chạy Data Analysis & Detection trước');
    if (run.status !== 'succeeded') throw new BadRequestException('Phân tích hệ thống chưa thành công — hãy chạy lại phân tích');
    const result = await this.analysisRepository.findResultByRun(run.id);
    if (!result) throw new NotFoundException('Chưa có kết quả phân tích cho lần chạy mới nhất');
    const fresh = await this.staleness.assess(projectId, run, result); // D2: gom ca dataset/cot da doi
    if (fresh.isStale) {
      // SUMMARY-01 (Phan 2 v10 muc 3.41): khong tao Tong ket tu ket qua loi thoi
      throw new ConflictException({
        message: 'Kết quả phân tích đã lỗi thời — hãy chạy lại phân tích trước khi tạo Tổng kết',
        error: 'ANALYSIS_RESULT_STALE',
        details: { staleReason: fresh.staleReason, analysisRunId: run.id },
      } as never);
    }
    const runTopN = (run.config as Record<string, unknown> | null)?.top_n;
    const savedConfig = runTopN === undefined ? await this.analysisRepository.findConfigByProject(projectId).catch(() => null) : null;
    const topN = resolveTopN(runTopN ?? savedConfig?.topN);
    const dq = ((result.dqSummary ?? result.dq_summary ?? null) as unknown as {
      totalScanned: number;
      columns: {
        column: string;
        missingCount: number; missingRate: number | null;
        invalidCount: number; invalidRate: number | null;
        outlierCount: number; outlierRate: number | null;
        outlierBreakdown?: OutlierBreakdown | null;
        symbolMissingCount?: number | null;
        skewness?: number | null;
      }[];
      duplicateRowCount: number;
      notes: string[];
    } | null);
    // E2 (Phan 2 muc 3.9 + 3.29): moi van de co muc anh huong + ly do; sap theo uu tien
    type Issue = { dq: DqGroup; column: string | null; count: number; rate: number | null; severity: Severity; reason: string };
    const issues: Issue[] = [];
    const unassessable: { column: string; reason: string }[] = [];
    const push = (dq: DqGroup, column: string | null, count: number, rate: number | null, severity: Severity, note: string | null = null): void => {
      const base = severityReason(dq, severity, rate);
      issues.push({ dq, column, count, rate, severity, reason: note ? `${base} · Lưu ý: ${note}` : base });
    };
    if (dq) {
      for (const c of dq.columns) {
        if (c.missingRate === null || c.missingRate === undefined) {
          unassessable.push({ column: c.column, reason: 'Không có dòng để đánh giá — không áp ngưỡng, không báo 0%' });
          continue;
        }
        if (c.missingCount > 0) push('DQ-01', c.column, c.missingCount, c.missingRate, rateSeverity('DQ-01', c.missingRate));
        if (c.invalidCount > 0) push('DQ-03', c.column, c.invalidCount, c.invalidRate, rateSeverity('DQ-03', c.invalidRate), issueExplanation('DQ-03', c));
        if (c.outlierCount > 0) {
          // Ket qua cu chua co breakdown -> coi nhu chi IQR (muc thap nhat), khong suy dien cao hon
          const sev = outlierSeverity(c.outlierBreakdown ?? { iqr: c.outlierCount, iqrExtreme: 0, zscore: 0, both: 0 }) ?? 'low';
          push('DQ-04', c.column, c.outlierCount, c.outlierRate, sev, issueExplanation('DQ-04', c));
        }
      }
      if (dq.duplicateRowCount > 0) {
        const rate = dq.totalScanned > 0 ? Number((dq.duplicateRowCount / dq.totalScanned).toFixed(4)) : null;
        push('DQ-02', null, dq.duplicateRowCount, rate, rateSeverity('DQ-02', rate));
      }
    }
    issues.sort(compareIssues);
    const ranked = issues.map((it, i) => ({ ...it, priority: i + 1, severity_label: SEVERITY_LABEL[it.severity] }));
    const shown = ranked.slice(0, topN);
    const bySeverity = { high: 0, medium: 0, low: 0, no_data: 0 } as Record<Severity, number>;
    for (const it of ranked) bySeverity[it.severity] += 1;
    const recommendationItems = shown.map((it) => ({
      priority: it.priority,
      dq: it.dq,
      column: it.column,
      severity: it.severity,
      text: recommendationFor(it.dq, it.column),
    }));
    const cfg = (run.config ?? {}) as Record<string, unknown>;
    const ai = result.aiCorrelationAssessment as unknown as { status?: string } | null;
    const summary = {
      overview: `Dataset ${dq?.totalScanned ?? 0} dòng, ${issues.length} nhóm vấn đề (cao ${bySeverity.high}, trung bình ${bySeverity.medium}, thấp ${bySeverity.low}).`,
      issues: shown,
      issue_total: ranked.length,
      severity_counts: bySeverity,
      unassessable,
      top_n: topN,
      evidence_refs: await this.analysisRepository.countEvidencesByRun(run.id),
      // Giu `recommendations: string[]` nhu hop dong cu (tuong thich nguoc), sap theo uu tien;
      // cau truc chi tiet o truong moi `recommendation_items`.
      recommendations: recommendationItems.map(
        (r) => `[${r.priority}] ${r.dq}${r.column ? ` · ${r.column}` : ''}: ${r.text}`,
      ),
      recommendation_items: recommendationItems,
      notes: [
        'Hệ thống chỉ phát hiện và báo cáo — không tự xóa/sửa dữ liệu; xử lý tại hệ thống nguồn.',
        'Ngưỡng mức ảnh hưởng là quy ước dự án, không phải chuẩn thống kê chung.',
      ],
      config_used: {
        selected_columns: cfg.selected_column_names ?? cfg.selected_column_keys ?? null,
        label_column: cfg.label_column ?? null,
        time_column: cfg.time_column ?? null,
        value_column: cfg.value_column ?? null,
        time_granularity: cfg.time_granularity ?? null,
        correlation_method: cfg.correlation_method ?? null,
        outlier_method: cfg.outlier_method ?? null,
        top_n: topN,
        chart_top_n: cfg.chart_top_n ?? null,
      },
      thresholds: THRESHOLDS,
      dq05: result.dq05 ?? { status: 'unassessed', reason: 'no_rule_confirmed' },
      // Dot G (Phan 2 v12 muc 3.44): nhom Nghi van — tach rieng, khong muc anh huong, khong vao `issues`
      suspicions: Array.isArray(result.suspicions) ? result.suspicions : [],
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

  async getSummary(projectId: string): Promise<Record<string, unknown>> {
    if (!isObjectIdHex(projectId)) throw new BadRequestException('ID Dự án không hợp lệ');
    await this.projectsService.getProjectById(projectId);
    const saved = await this.analysisRepository.findLatestSaveByProject(projectId);
    if (!saved) throw new NotFoundException('Chưa có Tổng kết cho project này');
    return {
      saveId: saved.id,
      projectId,
      analysisRunId: saved.analysisRunId,
      inputFingerprint: saved.inputFingerprint,
      summary: saved.summary,
      isStale: saved.isStale,
    };
  }
}

