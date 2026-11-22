/**
 * AnalysisJobPolicyLoader — Loader tài nguyên cho `@PolicyResource('Analysis', ...)`
 * trên các route định tuyến theo `:jobId`.
 *
 * `AiJobRecord` không chứa `workspaceId` (chỉ có `projectId`), nên loader
 * nạp thêm `AnalysisRun` để suy ra `workspace_id` → rule CASL tầng workspace
 * (`WS-OWNER`) cũng áp dụng được cho các endpoint này.
 */
import { Inject, Injectable } from '@nestjs/common';
import {
  ANALYSIS_REPOSITORY_PORT,
  type AnalysisRepositoryPort,
} from '../../domain/ports/analysis.repository.port';

@Injectable()
export class AnalysisJobPolicyLoader {
  constructor(
    @Inject(ANALYSIS_REPOSITORY_PORT)
    private readonly analysis: AnalysisRepositoryPort,
  ) {}

  async load(id: string): Promise<unknown> {
    const job = await this.analysis.findJobById(id);
    if (!job) return null;
    let workspaceId: string | null = null;
    if (job.analysisRunId) {
      const run = await this.analysis.findById(job.analysisRunId);
      workspaceId = run?.workspaceId ?? null;
    }
    return {
      id: job.id,
      project_id: job.projectId ?? null,
      workspace_id: workspaceId,
    };
  }
}
