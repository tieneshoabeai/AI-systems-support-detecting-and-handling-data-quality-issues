/**
 * CreateFindingFeedbackHandler — Use case: `createFindingFeedback()`
 * (thay đổi trạng thái) — theo §3.10 Command/Query pattern.
 *
 * Handler không biết HTTP: trả về kết quả hoặc ném lỗi nghiệp vụ.
 * Dependency chỉ qua port token — không inject adapter cụ thể.
 */
import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { REALTIME_PORT, type RealtimePort } from '../../../realtime';
import {
  FEEDBACK_REPOSITORY_PORT,
  type FeedbackRecord,
  type FeedbackRepositoryPort,
} from '../../domain/ports/feedback.repository.port';
import {
  ANALYSIS_REPOSITORY_PORT,
  RAG_FEW_SHOT_PORT,
  computeTrustScore,
  extractErrorType,
  isEligibleForStore,
  mapFeedbackLabelToExampleLabel,
  normalizeExample,
  type AnalysisRepositoryPort,
  type AnalysisRunRecord,
  type RagFewShotPort,
} from '../../../analysis';
import { PROJECT_ACCESS_PORT, type ProjectAccessPort } from '../../../projects';
import { WORKSPACE_ACCESS_PORT, type WorkspaceAccessPort } from '../../../workspaces';
import { USER_REPOSITORY_PORT, type UserRepositoryPort } from '../../../users';
import { requiresReason } from '../../domain/value-objects/feedback-label.vo';
import { assertReasonForLabel } from '../../domain/value-objects/feedback-label.vo';
import { isObjectIdHex } from '../../../../shared/utils/object-id.util';
import { CreateFeedbackInput } from '../feedback.types';
import { toPlain } from '../feedback.utils';

@Injectable()
export class CreateFindingFeedbackHandler {
  private readonly logger = new Logger(CreateFindingFeedbackHandler.name);
  constructor(
    @Inject(ANALYSIS_REPOSITORY_PORT)
    private readonly analysisRepository: AnalysisRepositoryPort,
    @Inject(PROJECT_ACCESS_PORT)
    private readonly projects: ProjectAccessPort,
    @Inject(WORKSPACE_ACCESS_PORT)
    private readonly workspaces: WorkspaceAccessPort,
    @Inject(FEEDBACK_REPOSITORY_PORT)
    private readonly repo: FeedbackRepositoryPort,
    @Optional()
    @Inject(RAG_FEW_SHOT_PORT)
    private readonly ragFewShot: RagFewShotPort,
    @Inject(USER_REPOSITORY_PORT)
    private readonly users: UserRepositoryPort,
    @Optional()
    @Inject(REALTIME_PORT)
    private readonly realtime: RealtimePort,
  ) {}

  private ensureNotAdmin(role: string): void {
    if (role === 'admin') {
      throw new ForbiddenException(
        'Quản trị viên hệ thống không có quyền với nhóm nhận xét (FB-*)',
      );
    }
  }

  private checkReason(label: string, reason: string | null | undefined): void {
    if (requiresReason(label) && (!reason || reason.trim().length === 0)) {
      throw new BadRequestException('Nhãn này bắt buộc kèm lý do (reason)');
    }
  }

  private async resolveRunProject(
    analysisId: string,
    userId: string,
  ): Promise<{ run: AnalysisRunRecord; projectRole: string; workspaceRole: string | null }> {
    if (!isObjectIdHex(analysisId)) throw new BadRequestException('ID lần phân tích không hợp lệ');
    const run = await this.analysisRepository.findById(analysisId);
    if (!run) throw new NotFoundException('Không tìm thấy lần phân tích');
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
      throw new ForbiddenException('Không có quyền truy cập project này');
    }
    return { projectRole, workspaceRole, workspaceId };
  }

  private async promoteFindingToStore(doc: FeedbackRecord): Promise<void> {
    try {
      const fid = (doc.findingId ?? '').trim();
      if (!fid) return;
      const exampleLabel = mapFeedbackLabelToExampleLabel(doc.label);
      if (!exampleLabel) return;
      const ws = doc.workspaceId;
      const projectId = doc.projectId;
      const errorType = extractErrorType(fid);
      const colPart = fid.includes(':') ? fid.split(':').slice(1).join(':').trim() : '';
      const columnTraits = (colPart || fid).slice(0, 300);
      const reasonText = (doc.reason ?? '').trim();
      const description = (reasonText || `${doc.label} cho ${fid}`).slice(0, 500);
      if (!description) return;
      const agreement = await this.repo.countDistinctAuthors({
        workspaceId: ws,
        findingId: fid,
        label: doc.label,
      });
      const trustScore = computeTrustScore(agreement);
      if (!isEligibleForStore(agreement, trustScore)) return;
      const queryText = `${errorType} | ${columnTraits} | ${description}`;
      const embedding = this.ragFewShot ? this.ragFewShot.embedQueryText(queryText) : [];
      if (!embedding || embedding.length === 0) return;
      const normalized = normalizeExample({
        errorType,
        columnTraits,
        description,
        label: exampleLabel,
        embedding,
        trustScore,
        language: 'vi',
      });
      const existing = await this.analysisRepository.findDuplicateExample({
        workspaceId: ws,
        errorType: normalized.errorType,
        description: normalized.description,
        label: normalized.label,
      });
      if (existing) {
        await this.analysisRepository.updateFewShotTrust(existing.id, {
          agreementCount: agreement,
          trustScore,
          embedding: normalized.embedding,
        });
        return;
      }
      await this.analysisRepository.saveFewShotExample({
        workspaceId: ws,
        projectId,
        errorType: normalized.errorType,
        columnTraits: normalized.columnTraits,
        description: normalized.description,
        label: normalized.label,
        embedding: normalized.embedding,
        trustScore: normalized.trustScore,
        language: normalized.language,
        agreementCount: agreement,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(`T1 promote feedback → kho mau bo qua (khong chan feedback): ${message}`);
    }
  }

  private async authorNames(docs: FeedbackRecord[]): Promise<Map<string, string | null>> {
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
    findingId: string,
    dto: CreateFeedbackInput,
  ): Promise<Record<string, unknown>> {
    this.ensureNotAdmin(role);
    const fid = (findingId ?? '').trim();
    if (!fid) throw new BadRequestException('findingId không được để trống');
    if (fid.length > 200) throw new BadRequestException('findingId tối đa 200 ký tự');
    this.checkReason(dto.label, dto.reason ?? null);
    assertReasonForLabel(dto.label, dto.reason);
    const { run, projectRole, workspaceRole } = await this.resolveRunProject(analysisId, userId);

    let modelId: string | null = null;
    const aiConfidence: number | null = null;
    const aiRationale: string | null = null;
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
      findingId: fid,
      projectId: run.projectId,
      workspaceId: run.workspaceId,
      label: dto.label,
      reason: dto.reason?.trim() ? dto.reason.trim().slice(0, 2000) : null,
      suggestedSeverity: dto.suggestedSeverity ?? null,
      aiConfidence,
      aiRationale,
      authorId: userId,
      authorRoleAtTime: projectRole ?? workspaceRole ?? 'viewer',
      model_id: modelId,
      prompt_version: 'corr-v1',
    });
    await this.promoteFindingToStore(doc);
    const names = await this.authorNames([doc]);
    const plain = toPlain(doc, userId, names.get(userId) ?? null);
    try {
      const projectId = run.projectId;
      this.realtime?.emitToProject(projectId, 'feedback.created', {
        analysisId: run.id,
        feedbackId: doc.id,
        label: doc.label,
      });
      this.realtime?.emitToAnalysis(run.id, 'feedback.created', {
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
