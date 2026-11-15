import { Inject, Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { ANALYSIS_REPOSITORY_PORT, type AnalysisRepositoryPort } from '../domain/ports/analysis.repository.port';
import { ProjectsService } from '../../projects/application/projects.service';
import { isObjectIdHex } from '../../../shared/utils/object-id.util';

@Injectable()
export class SummaryService {
  constructor(
    @Inject(ANALYSIS_REPOSITORY_PORT)
    private readonly analysisRepository: AnalysisRepositoryPort,
    private readonly projectsService: ProjectsService,
  ) {}

  async createSummary(projectId: string): Promise<Record<string, unknown>> {
    if (!isObjectIdHex(projectId)) throw new BadRequestException('ID Dự án không hợp lệ');
    const project = await this.projectsService.getProjectById(projectId);
    const run = await this.analysisRepository.findLatestRunByProject(projectId);
    if (!run) throw new NotFoundException('Chưa chạy phân tích — hãy chạy Data Analysis & Detection trước');
    if (run.status !== 'succeeded') throw new BadRequestException('Phân tích hệ thống chưa thành công — hãy chạy lại phân tích');
    const result = await this.analysisRepository.findResultByRun(run.id);
    if (!result) throw new NotFoundException('Chưa có kết quả phân tích cho lần chạy mới nhất');
    const dq = ((result.dqSummary ?? result.dq_summary ?? null) as unknown as {
      totalScanned: number;
      columns: { column: string; missingCount: number; missingRate: number | null; invalidCount: number; invalidRate: number | null; outlierCount: number; outlierRate: number | null }[];
      duplicateRowCount: number;
      notes: string[];
    } | null);
    const issues: { dq: string; column: string | null; count: number; rate: number | null }[] = [];
    if (dq) {
      for (const c of dq.columns) {
        if (c.missingCount > 0) issues.push({ dq: 'DQ-01', column: c.column, count: c.missingCount, rate: c.missingRate });
        if (c.invalidCount > 0) issues.push({ dq: 'DQ-03', column: c.column, count: c.invalidCount, rate: c.invalidRate });
        if (c.outlierCount > 0) issues.push({ dq: 'DQ-04', column: c.column, count: c.outlierCount, rate: c.outlierRate });
      }
      if (dq.duplicateRowCount > 0) issues.push({ dq: 'DQ-02', column: null, count: dq.duplicateRowCount, rate: null });
    }
    issues.sort((a, b) => b.count - a.count);
    const ai = result.aiCorrelationAssessment as unknown as { status?: string } | null;
    const summary = {
      overview: `Dataset ${dq?.totalScanned ?? 0} dòng, ${issues.length} nhóm vấn đề.`,
      issues: issues.slice(0, 50),
      evidence_refs: await this.analysisRepository.countEvidencesByRun(run.id),
      recommendations: [
        'Kiểm tra định nghĩa cột tại nguồn trước khi mô hình hóa',
        'Không tự xóa/sửa dòng — xử lý tại nguồn',
      ],
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
