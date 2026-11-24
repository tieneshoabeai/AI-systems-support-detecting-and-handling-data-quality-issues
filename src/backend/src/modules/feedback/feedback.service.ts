/** FEEDBACK — Service (Template Simple). Gop 7 handler thanh FeedbackService. Giu ensureNotAdmin + camel/snake + chu ky 4 tham so UpdateMine. */
import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import { REALTIME_PORT, type RealtimePort } from '../realtime';
import {
  FEEDBACK_REPOSITORY_PORT,
  type Feedback,
  type FeedbackRepositoryPort,
} from './feedback.types';
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
} from '../analysis';
import { PROJECT_ACCESS_PORT, type ProjectAccessPort } from '../projects';
import { WORKSPACE_ACCESS_PORT, type WorkspaceAccessPort } from '../workspaces';
import { USER_REPOSITORY_PORT, type UserRepositoryPort } from '../users';
import { Feedback as FeedbackEntity } from './feedback.types';
import type { CreateFeedbackInput, UpdateFeedbackInput, ListFeedbackQueryInput } from './feedback.types';
import { isObjectIdHex, newObjectIdHex } from '../../shared/domain/utils/object-id.util';
import { CursorCodec } from '../../shared/domain/pagination/cursor-codec';
import { toPlain } from './feedback.utils';
import { ForbiddenError, NotFoundError, ValidationError } from '../../shared/domain/errors';

@Injectable()
export class FeedbackService {
  private readonly logger = new Logger(FeedbackService.name);
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
      throw new ForbiddenError('Quản trị viên hệ thống không có quyền với nhóm nhận xét (FB-*)',);
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

  private async promoteFindingToStore(doc: Feedback): Promise<void> {
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

  private parseCursor(cursor: string | undefined): { createdAt?: Date; id?: string } {
    if (!cursor) return {};
    const decoded = CursorCodec.decode<{ createdAt?: string; id?: string }>(cursor);
    if (!decoded || !decoded.createdAt || !decoded.id || !isObjectIdHex(decoded.id)) {
      throw new ValidationError('Cursor không hợp lệ');
    }
    const d = new Date(decoded.createdAt);
    if (Number.isNaN(d.getTime())) throw new ValidationError('Cursor không hợp lệ');
    return { createdAt: d, id: decoded.id };
  }

  private buildPage(
    docs: Feedback[],
    limit: number,
    viewerId: string,
    names: Map<string, string | null>,
  ): { items: Record<string, unknown>[]; meta: { nextCursor: string | null; hasMore: boolean } } {
    const hasMore = docs.length > limit;
    const page = hasMore ? docs.slice(0, limit) : docs;
    let nextCursor: string | null = null;
    if (hasMore && page.length > 0) {
      const last = page[page.length - 1];
      if (last) {
        nextCursor = CursorCodec.encode({
          createdAt: last.createdAt.toISOString(),
          id: last.id,
        });
      }
    }
    const items = page.map((d) => toPlain(d, viewerId, names.get(d.authorId) ?? null));
    return { items, meta: { nextCursor, hasMore } };
  }

  async createFindingFeedback(
    userId: string,
    role: string,
    analysisId: string,
    findingId: string,
    dto: CreateFeedbackInput,
  ): Promise<Record<string, unknown>> {
    this.ensureNotAdmin(role);
    const fid = (findingId ?? '').trim();
    if (!fid) throw new ValidationError('findingId không được để trống');
    if (fid.length > 200) throw new ValidationError('findingId tối đa 200 ký tự');
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

    const entity = FeedbackEntity.create({
      id: newObjectIdHex(),
      analysisRunId: run.id,
      findingId: fid,
      projectId: run.projectId,
      workspaceId: run.workspaceId,
      label: dto.label,
      reason: dto.reason ?? null,
      suggestedSeverity: dto.suggestedSeverity ?? null,
      aiConfidence,
      aiRationale,
      authorId: userId,
      authorRoleAtTime: projectRole ?? workspaceRole ?? 'viewer',
      modelId,
      promptVersion: 'corr-v1',
    });

    const doc = await this.repo.create({
      analysisRunId: entity.analysisRunId,
      findingId: entity.findingId,
      projectId: entity.projectId,
      workspaceId: entity.workspaceId,
      label: entity.label,
      reason: entity.reason,
      suggestedSeverity: entity.suggestedSeverity,
      aiConfidence: entity.aiConfidence,
      aiRationale: entity.aiRationale,
      authorId: entity.authorId,
      authorRoleAtTime: entity.authorRoleAtTime,
      model_id: entity.modelId,
      prompt_version: entity.promptVersion,
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
      // realtime khong bao gio lam hong luong nghiep vu chinh
    }
    return plain;
  }

  async createRunFeedback(
    userId: string,
    role: string,
    analysisId: string,
    dto: CreateFeedbackInput,
  ): Promise<Record<string, unknown>> {
    this.ensureNotAdmin(role);
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

    const entity = FeedbackEntity.create({
      id: newObjectIdHex(),
      analysisRunId: run.id,
      findingId: null,
      projectId: run.projectId,
      workspaceId: run.workspaceId,
      label: dto.label,
      reason: dto.reason ?? null,
      suggestedSeverity: dto.suggestedSeverity ?? null,
      aiConfidence: null,
      aiRationale: null,
      authorId: userId,
      authorRoleAtTime: projectRole ?? workspaceRole ?? 'viewer',
      modelId,
      promptVersion: 'corr-v1',
    });

    const doc = await this.repo.create({
      analysisRunId: entity.analysisRunId,
      findingId: entity.findingId,
      projectId: entity.projectId,
      workspaceId: entity.workspaceId,
      label: entity.label,
      reason: entity.reason,
      suggestedSeverity: entity.suggestedSeverity,
      aiConfidence: entity.aiConfidence,
      aiRationale: entity.aiRationale,
      authorId: entity.authorId,
      authorRoleAtTime: entity.authorRoleAtTime,
      model_id: entity.modelId,
      prompt_version: entity.promptVersion,
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
      // realtime khong bao gio lam hong luong nghiep vu chinh
    }
    return plain;
  }

  async updateMine(
    userId: string,
    roleOrId: string,
    idOrDto: string | UpdateFeedbackInput,
    dtoOrRole?: UpdateFeedbackInput | string,
  ): Promise<Record<string, unknown>> {
    let role: string | undefined;
    let id: string;
    let dto: UpdateFeedbackInput;
    if (typeof idOrDto === 'string' && dtoOrRole !== undefined && typeof dtoOrRole === 'object') {
      role = roleOrId;
      id = idOrDto;
      dto = dtoOrRole;
    } else {
      id = roleOrId;
      dto = idOrDto as UpdateFeedbackInput;
      role = typeof dtoOrRole === 'string' ? dtoOrRole : undefined;
    }
    if (role === 'admin') {
      throw new ForbiddenError('Quản trị viên hệ thống không có quyền với nhóm nhận xét (FB-*)',);
    }
    const existing = await this.repo.findByIdActive(id);
    if (!existing) throw new NotFoundError('Không tìm thấy nhận xét');
    existing.updateByAuthor(userId, {
      ...(dto.label !== undefined ? { label: dto.label } : {}),
      ...(dto.reason !== undefined ? { reason: dto.reason } : {}),
      ...(dto.suggestedSeverity !== undefined
        ? { suggestedSeverity: dto.suggestedSeverity }
        : {}),
    });
    const updated = await this.repo.updateById(id, {
      ...(dto.label !== undefined ? { label: dto.label } : {}),
      ...(dto.reason !== undefined
        ? { reason: dto.reason?.trim() ? (dto.reason as string).trim().slice(0, 2000) : null }
        : {}),
      ...(dto.suggestedSeverity !== undefined ? { suggestedSeverity: dto.suggestedSeverity } : {}),
    });
    if (!updated) throw new NotFoundError('Không tìm thấy nhận xét');
    const names = await this.authorNames([updated]);
    return toPlain(updated, userId, names.get(userId) ?? null);
  }

  async remove(userId: string, role: string, id: string): Promise<{ deleted: boolean }> {
    const existing = await this.repo.findByIdActive(id);
    if (!existing) throw new NotFoundError('Không tìm thấy nhận xét');
    const isMine = existing.authorId === userId;
    if (isMine) {
      if (role === 'admin') {
        this.logger.warn(`SYS-ADMIN tu xoa nhan xet ${id} (ghi log kiem toan)`);
      }
      await this.repo.softDelete(id);
      return { deleted: true };
    }
    if (role === 'admin') {
      this.logger.warn(
        `SYS-ADMIN xoa nhan xet vi pham ${id} cua ${existing.authorId} (ghi log kiem toan)`,
      );
      await this.repo.softDelete(id);
      return { deleted: true };
    }
    const projectId = existing.projectId;
    const project = await this.projects.getProjectById(projectId);
    const workspaceId = project.workspaceId;
    const workspaceRole = await this.workspaces.resolveUserWorkspaceRole(workspaceId, userId);
    const projectRole = await this.projects.resolveUserProjectRole(
      projectId,
      userId,
      workspaceRole,
    );
    const canModerate = projectRole === 'owner' || workspaceRole === 'owner';
    if (!canModerate) {
      throw new ForbiddenError('Chỉ chủ nhận xét hoặc Project/Workspace Owner (xử lý vi phạm) được xoá',);
    }
    this.logger.warn(
      `Owner ${userId} (${projectRole}/${workspaceRole}) xoa nhan xet vi pham ${id} (ghi log kiem toan)`,
    );
    await this.repo.softDelete(id);
    return { deleted: true };
  }

  async aiQualityMetrics(userId: string, role: string, projectId: string): Promise<Record<string, unknown>> {
    this.ensureNotAdmin(role);
    if (!isObjectIdHex(projectId)) throw new ValidationError('ID Dự án không hợp lệ');
    const { projectRole, workspaceRole } = await this.resolveProjectAccess(projectId, userId);
    const allowed =
      workspaceRole === 'owner' || projectRole === 'owner' || projectRole === 'member';
    if (!allowed) {
      throw new ForbiddenError('Chỉ Owner/Member mới xem thống kê chất lượng AI');
    }
    const [groups, total, runs] = await Promise.all([
      this.repo.aggregateByProject(projectId),
      this.repo.countByProject(projectId),
      this.repo.countDistinctRuns(projectId),
    ]);
    const byLabel: Record<string, number> = {};
    for (const g of groups) byLabel[g.label] = g.count;
    const fp = byLabel['false_positive'] ?? 0;
    const missed = byLabel['missed_issue'] ?? 0;
    return {
      projectId,
      total,
      distinctRuns: runs,
      byLabel,
      falsePositiveCount: fp,
      missedIssueCount: missed,
      falsePositiveRate: total > 0 ? fp / total : null,
      missedIssueRate: total > 0 ? missed / total : null,
    };
  }

  async listFindingFeedback(
    userId: string,
    role: string,
    analysisId: string,
    findingId: string,
    query: ListFeedbackQueryInput,
  ): Promise<{
    items: Record<string, unknown>[];
    meta: { nextCursor: string | null; hasMore: boolean };
    summary: Record<string, number>;
  }> {
    this.ensureNotAdmin(role);
    const fid = (findingId ?? '').trim();
    if (!fid) throw new ValidationError('findingId không được để trống');
    await this.resolveRunProject(analysisId, userId);
    const c = this.parseCursor(query.cursor);
    const docs = await this.repo.listByScope({
      analysisRunId: analysisId,
      findingId: fid,
      limit: query.limit,
      label: query.label,
      sortOrder: query.sortOrder,
      cursorCreatedAt: c.createdAt,
      cursorId: c.id,
    });
    const names = await this.authorNames(docs.slice(0, query.limit));
    const page = this.buildPage(docs, query.limit, userId, names);
    const summaryRepo = this.repo as FeedbackRepositoryPort & {
      summaryByScope?: (p: { analysisRunId: string; findingId?: string | null; label?: string }) => Promise<Record<string, number>>;
    };
    let summary: Record<string, number> = {};
    if (typeof summaryRepo.summaryByScope === 'function') {
      summary = await summaryRepo.summaryByScope({
        analysisRunId: analysisId,
        findingId: fid,
        ...(query.label ? { label: query.label } : {}),
      });
    } else {
      const all = await this.repo.listByScope({
        analysisRunId: analysisId,
        findingId: fid,
        limit: 1000,
        sortOrder: 'desc',
      });
      for (const d of all) summary[d.label] = (summary[d.label] ?? 0) + 1;
    }
    return { ...page, summary };
  }

  async listRunFeedback(
    userId: string,
    role: string,
    analysisId: string,
    query: ListFeedbackQueryInput,
  ): Promise<{
    items: Record<string, unknown>[];
    meta: { nextCursor: string | null; hasMore: boolean };
    summary: Record<string, number>;
  }> {
    this.ensureNotAdmin(role);
    await this.resolveRunProject(analysisId, userId);
    const c = this.parseCursor(query.cursor);
    const docs = await this.repo.listByScope({
      analysisRunId: analysisId,
      findingId: null,
      limit: query.limit,
      label: query.label,
      sortOrder: query.sortOrder,
      cursorCreatedAt: c.createdAt,
      cursorId: c.id,
    });
    const names = await this.authorNames(docs.slice(0, query.limit));
    const page = this.buildPage(docs, query.limit, userId, names);
    const summaryRepo = this.repo as FeedbackRepositoryPort & {
      summaryByScope?: (p: { analysisRunId: string; findingId?: string | null; label?: string }) => Promise<Record<string, number>>;
    };
    let summary: Record<string, number> = {};
    if (typeof summaryRepo.summaryByScope === 'function') {
      summary = await summaryRepo.summaryByScope({
        analysisRunId: analysisId,
        findingId: null,
        ...(query.label ? { label: query.label } : {}),
      });
    } else {
      const all = await this.repo.listByScope({
        analysisRunId: analysisId,
        findingId: null,
        limit: 1000,
        sortOrder: 'desc',
      });
      for (const d of all) summary[d.label] = (summary[d.label] ?? 0) + 1;
    }
    return { ...page, summary };
  }
}
