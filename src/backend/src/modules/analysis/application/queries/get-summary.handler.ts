/**
 * GetSummaryHandler — Use case: `getSummary()`
 * (chỉ đọc) — theo §3.10 Command/Query pattern.
 *
 * Handler không biết HTTP: trả về kết quả hoặc ném lỗi nghiệp vụ.
 * Dependency chỉ qua port token — không inject adapter cụ thể.
 */
import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  ANALYSIS_REPOSITORY_PORT,
  type AnalysisRepositoryPort,
} from '../../domain/ports/analysis.repository.port';
import { PROJECT_ACCESS_PORT, type ProjectAccessPort } from '../../../projects';
import { isObjectIdHex } from '../../../../shared/utils/object-id.util';

@Injectable()
export class GetSummaryHandler {
  constructor(
    @Inject(PROJECT_ACCESS_PORT)
    private readonly projects: ProjectAccessPort,
    @Inject(ANALYSIS_REPOSITORY_PORT)
    private readonly analysisRepository: AnalysisRepositoryPort,
  ) {}

  async execute(projectId: string): Promise<Record<string, unknown>> {
    if (!isObjectIdHex(projectId)) throw new BadRequestException('ID Dự án không hợp lệ');
    await this.projects.getProjectById(projectId);
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
