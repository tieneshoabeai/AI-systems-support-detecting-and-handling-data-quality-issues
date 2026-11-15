import { Inject, Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import type { Readable } from 'stream';
import { ANALYSIS_REPOSITORY_PORT, type AnalysisRepositoryPort } from '../domain/ports/analysis.repository.port';
import { ProjectsService } from '../../projects/application/projects.service';
import { isObjectIdHex } from '../../../shared/utils/object-id.util';
import { STORAGE_PORT, type StoragePort } from '../../../shared/ports/storage.port';

@Injectable()
export class ReportService {
  constructor(
    @Inject(ANALYSIS_REPOSITORY_PORT)
    private readonly analysisRepository: AnalysisRepositoryPort,
    private readonly projectsService: ProjectsService,
    @Inject(STORAGE_PORT)
    private readonly storage: StoragePort,
  ) {}

  async requestReport(projectId: string): Promise<Record<string, unknown>> {
    if (!isObjectIdHex(projectId)) throw new BadRequestException('ID Dự án không hợp lệ');
    const project = await this.projectsService.getProjectById(projectId);
    const saved = await this.analysisRepository.findLatestSaveByProject(projectId);
    if (!saved) throw new NotFoundException('Chưa có Tổng kết — hãy tạo Tổng kết trước khi sinh PDF');
    const job = await this.analysisRepository.createReportJob({
      projectId: project.id,
      workspaceId: project.workspaceId,
      projectSaveId: saved.id,
      status: 'pending',
    });
    return {
      reportId: job.id,
      status: 'pending',
      pollUrl: `/api/v1/projects/${projectId}/report/${job.id}/file`,
    };
  }

  async downloadReportFile(projectId: string, reportId: string): Promise<{ stream: Readable; fileSizeBytes: number | null }> {
    const job = await this.analysisRepository.findReportById(reportId);
    if (!job || job.projectId !== projectId || !job.storageKey) {
      throw new NotFoundException('Không tìm thấy báo cáo');
    }
    if (job.status !== 'succeeded') {
      throw new NotFoundException('Báo cáo chưa sẵn sàng');
    }
    const stream = await this.storage.downloadStream(job.storageKey);
    return { stream, fileSizeBytes: job.fileSizeBytes ?? null };
  }

  async getReportFileMeta(projectId: string, reportId: string): Promise<Record<string, unknown>> {
    const job = await this.analysisRepository.findReportById(reportId);
    if (!job || job.projectId !== projectId) throw new NotFoundException('Không tìm thấy báo cáo');
    if (job.status !== 'succeeded' || !job.storageKey) {
      return { reportId, status: job.status, error: job.error ?? null };
    }
    return {
      reportId,
      status: job.status,
      fileSizeBytes: job.fileSizeBytes,
      downloadUrl: `/api/v1/projects/${projectId}/report/${reportId}/file`,
    };
  }
}
