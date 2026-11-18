/**
 * CreateRunFeedbackHandler — Use case: `createRunFeedback()`
 * (thay đổi trạng thái) — theo §3.10 Command/Query pattern.
 *
 * Handler không biết HTTP: trả về kết quả hoặc ném lỗi nghiệp vụ.
 * Dependency chỉ qua port token — không inject adapter cụ thể.
 */
import { Inject, Injectable, Optional } from '@nestjs/common';
import { REALTIME_PORT, type RealtimePort } from '../../../realtime';
import {
  FEEDBACK_REPOSITORY_PORT,
  type Feedback,
  type FeedbackRepositoryPort,
} from '../../domain/ports/feedback.repository.port';
import {
  ANALYSIS_REPOSITORY_PORT,
  type AnalysisRepositoryPort,
  type AnalysisRunRecord,
} from '../../../analysis';
import { PROJECT_ACCESS_PORT, type ProjectAccessPort } from '../../../projects';
import { WORKSPACE_ACCESS_PORT, type WorkspaceAccessPort } from '../../../workspaces';
import { USER_REPOSITORY_PORT, type UserRepositoryPort } from '../../../users';
import { requiresReason } from '../../domain/value-objects/feedback-label.vo';
import { isObjectIdHex } from '../../../../shared/domain/utils/object-id.util';
import { CreateFeedbackInput } from '../feedback.types';
import { toPlain } from '../feedback.utils';
import { ForbiddenError, NotFoundError, ValidationError } from '../../../../shared/domain/errors';

@Injectable()
export class CreateRunFeedbackHandler {
  constructor(
    @Inject(ANALYSIS_REPOSITORY_PORT)
    private readonly analysisRepository: AnalysisRepositoryPort,
    @Inject(PROJECT_ACCESS_PORT)
    private readonly projects: ProjectAccessPort,
    @Inject(WORKSPACE_ACCESS_PORT)
    private readonly workspaces: WorkspaceAccessPort,
    @Inject(FEEDBACK_REPOSITORY_PORT)
    private readonly repo: FeedbackRepositoryPort,
    @Inject(USER_REPOSITORY_PORT)
    private readonly users: UserRepositoryPort,
    @Optional()
    @Inject(REALTIME_PORT)
    private readonly realtime: RealtimePort,
  ) {}

  private ensureNotAdmin(role: string): void {
    if (role === 'admin') {
      throw new ForbiddenError('Quản trị viên hệ thống không có quyền với nhóm nhận xét (FB-*)',);
    }
  }

  private checkReason(label: string, reason: string | null | undefined): void {
    if (requiresReason(label) && (!reason || reason.trim().length === 0)) {
      throw new ValidationError('Nhãn này bắt buộc kèm lý do (reason)');
    }
  }

  private async resolveRunProject(
    analysisId: string,
    userId: string,
  ): Promise<{ run: AnalysisRunRecord; projectRole: string; workspaceRole: string | null }> {
    if (!isObjectIdHex(analysisId)) throw new ValidationError('ID lần phân tích không hợp lệ');
    const run = await this.analysisRepository.findById(analysisId);
    if (!run) throw new NotFoundError('Không tìm thấy lần phân tích');
    const projectId = run.projectId;
    const { projectRole, workspaceRole } = await this.resolveProjectAccess(projectId, userId);
    return { run, projectRole, workspaceRole };
  }

  private async resolveProjectAccess(
    projectId: string,
    userId: string,
  ): Promise<{ projectRole: string; workspaceRole: string | null; workspaceId: string }> {
    const project = await this.projects.getProjectById(projectId);
    const workspaceId = project.workspaceId;
    const workspaceRole = await this.workspaces.resolveUserWorkspaceRole(workspaceId, userId);
    const projectRole = await this.projects.resolveUserProjectRole(
      projectId,
      userId,
      workspaceRole,
    );
    if (!projectRole) {
      throw new ForbiddenError('Không có quyền truy cập project này');
    }
    return { projectRole, workspaceRole, workspaceId };
  }

  private async authorNames(docs: Feedback[]): Promise<Map<string, string | null>> {
    const map = new Map<string, string | null>();
    const ids = [...new Set(docs.map((d) => d.authorId))];
    for (const id of ids) {
      try {
        const u = await this.users.findById(id);
        if (u) map.set(id, `${u.firstName} ${u.lastName}`.trim());
        else map.set(id, null);
      } catch {
        map.set(id, null);
      }
    }
    return map;
  }

  async execute(
    userId: string,
    role: string,
    analysisId: string,
    dto: CreateFeedbackInput,
  ): Promise<Record<string, unknown>> {
    this.ensureNotAdmin(role);
    this.checkReason(dto.label, dto.reason ?? null);
    const { run, projectRole, workspaceRole } = await this.resolveRunProject(analysisId, userId);

    let modelId: string | null = null;
    try {
      const result = await this.analysisRepository.findResultByRun(analysisId);
      const assess = result?.aiCorrelationAssessment as unknown as {
        modelId?: string | null;
      } | null;
      if (assess && typeof assess.modelId === 'string') modelId = assess.modelId;
    } catch {
      modelId = null;
    }

    const doc = await this.repo.create({
      analysisRunId: run.id,
      findingId: null,
      projectId: run.projectId,
      workspaceId: run.workspaceId,
      label: dto.label,
      reason: dto.reason?.trim() ? dto.reason.trim().slice(0, 2000) : null,
      suggestedSeverity: dto.suggestedSeverity ?? null,
      aiConfidence: null,
      aiRationale: null,
      authorId: userId,
      authorRoleAtTime: projectRole ?? workspaceRole ?? 'viewer',
      model_id: modelId,
      prompt_version: 'corr-v1',
    });
    const names = await this.authorNames([doc]);
    const plain = toPlain(doc, userId, names.get(userId) ?? null);
    try {
      const projectId = run.projectId;
      const runId = run.id;
      this.realtime?.emitToProject(projectId, 'feedback.created', {
        analysisId: runId,
        feedbackId: doc.id,
        label: doc.label,
      });
      this.realtime?.emitToAnalysis(runId, 'feedback.created', {
        projectId,
        feedbackId: doc.id,
        label: doc.label,
      });
    } catch {
      // realtime không bao giờ làm hỏng luồng nghiệp vụ chính
    }
    return plain;
  }
}
