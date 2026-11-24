/**
 * AnalysisRunPolicyLoader — Loader tài nguyên cho `@PolicyResource('Analysis', ...)`
 * trên các route định tuyến theo `:analysisId` (nhóm `FB-*`).
 *
 * `AnalysisRunRecord` có đủ `projectId` + `workspaceId` → buildSubject() ánh xạ
 * sang `project_id` / `workspace_id` khớp với rule CASL.
 */
import { Inject, Injectable } from '@nestjs/common';
import {
  ANALYSIS_REPOSITORY_PORT,
  type AnalysisRepositoryPort,
} from '../../domain/ports/analysis.repository.port';

@Injectable()
export class AnalysisRunPolicyLoader {
  constructor(
    @Inject(ANALYSIS_REPOSITORY_PORT)
    private readonly analysis: AnalysisRepositoryPort,
  ) {}

  async load(id: string): Promise<unknown> {
    const run = await this.analysis.findById(id);
    if (!run) return null;
    return {
      id: run.id,
      project_id: run.projectId,
      workspace_id: run.workspaceId,
    };
  }
}
