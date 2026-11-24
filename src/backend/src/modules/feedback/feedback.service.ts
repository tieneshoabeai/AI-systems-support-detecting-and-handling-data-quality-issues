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
  stripIdentifiers,
  type AnalysisRepositoryPort,
  type AnalysisRunRecord,
  type FewShotExample,
  type RagFewShotPort,
} from '../analysis';
import { PROJECT_ACCESS_PORT, type ProjectAccessPort } from '../projects';
import { WORKSPACE_ACCESS_PORT, type WorkspaceAccessPort } from '../workspaces';
import { USER_REPOSITORY_PORT, type UserRepositoryPort } from '../users';
import { AUDIT_LOGGER_PORT, type AuditLoggerPort } from '../audit';
import { Feedback as FeedbackEntity } from './feedback.types';
import type { CreateFeedbackInput, UpdateFeedbackInput, ListFeedbackQueryInput } from './feedback.types';
import { isObjectIdHex, newObjectIdHex } from '../../shared/domain/utils/object-id.util';
import { CursorCodec } from '../../shared/domain/pagination/cursor-codec';
import { toPlain } from './feedback.utils';
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from '../../shared/domain/errors';

type RunStatus = AnalysisRunRecord['status'];

/** Trạng thái lần phân tích được phép nhận nhận xét (Phần 7 v14 §3.24 FB-R4). */
const FINDING_FEEDBACK_RUN_STATUSES: readonly RunStatus[] = ['succeeded'];
const RUN_FEEDBACK_RUN_STATUSES: readonly RunStatus[] = ['succeeded', 'failed'];

/** Độ dài tối đa của đặc tính cột trong mẫu RAG (Phần 12 v15 §3.24 T1-2). */
const MAX_COLUMN_TRAITS_LENGTH = 80;

/** Cụm mô tả theo nhãn mẫu (Phần 12 v15 §3.24 T1-1) — KHÔNG dùng `reason` người dùng. */
const EXAMPLE_LABEL_PHRASES: Record<FewShotExample['label'], string> = {
  correct: 'AI phát hiện đúng',
  false_positive: 'AI báo nhầm, không phải lỗi',
  missed_issue: 'AI bỏ sót vấn đề',
};

type Page = {
  items: Record<string, unknown>[];
  meta: { nextCursor: string | null; hasMore: boolean; limit: number };
  summary: Record<string, number>;
};

/**
 * Đặc tính cột từ `findingId` (`DQ-01:ten-cot` → `ten-cot`), đã làm sạch: bỏ PII,
 * ký tự điều khiển / xuống dòng, gộp khoảng trắng, tối đa 80 ký tự (T1-2).
 */
export function columnTraitsFromFindingId(findingId: string): string {
  const colPart = findingId.includes(':') ? findingId.split(':').slice(1).join(':') : findingId;
  // eslint-disable-next-line no-control-regex
  const cleaned = stripIdentifiers(colPart.replace(/[\u0000-\u001f\u007f]+/g, ' '))
    .replace(/["`]/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
  return cleaned.slice(0, MAX_COLUMN_TRAITS_LENGTH).trim();
}

/** Mô tả mẫu theo khuôn (T1-1) — xác định theo (loại lỗi, đặc tính cột, nhãn) nên tự gom trùng. */
export function templateExampleDescription(
  exampleLabel: FewShotExample['label'],
  errorType: string,
  columnTraits: string,
): string {
  const where = columnTraits ? ` trên cột có đặc tính "${columnTraits}"` : '';
  return `${EXAMPLE_LABEL_PHRASES[exampleLabel]} — ${errorType}${where}`;
}

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
    @Optional()
    @Inject(AUDIT_LOGGER_PORT)
    private readonly audit?: AuditLoggerPort,
  ) {}

  private ensureNotAdmin(role: string | undefined): void {
    if (role === 'admin') {
      throw new ForbiddenError('Quản trị viên hệ thống không có quyền với nhóm nhận xét (FB-*)',);
    }
  }

  private assertFeedbackId(id: string): void {
    if (!isObjectIdHex(id)) throw new ValidationError('ID nhận xét không hợp lệ');
  }

  private normalizeFindingId(findingId: string): string {
    const fid = (findingId ?? '').trim();
    if (!fid) throw new ValidationError('findingId không được để trống');
    if (fid.length > 200) throw new ValidationError('findingId tối đa 200 ký tự');
    return fid;
  }

  /**
   * Tìm lần phân tích + kiểm tra quyền xem project.
   * `allowedStatuses` (khi tạo nhận xét): sai trạng thái → `ConflictError` (FB-R4).
   */
  private async resolveRunProject(
    analysisId: string,
    userId: string,
    allowedStatuses?: readonly RunStatus[],
  ): Promise<{ run: AnalysisRunRecord; projectRole: string; workspaceRole: string | null }> {
    if (!isObjectIdHex(analysisId)) throw new ValidationError('ID lần phân tích không hợp lệ');
    const run = await this.analysisRepository.findById(analysisId);
    if (!run) throw new NotFoundError('Không tìm thấy lần phân tích');
    const { projectRole, workspaceRole } = await this.resolveProjectAccess(run.projectId, userId);
    if (allowedStatuses && !allowedStatuses.includes(run.status)) {
      throw new ConflictError(
        `Lần phân tích chưa hoàn tất (trạng thái: ${run.status}) — chưa thể nhận xét`,
      );
    }
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

  /** Ảnh chụp thông tin AI của lần phân tích tại thời điểm nhận xét (FB-R10). */
  private async aiSnapshot(analysisId: string): Promise<{ modelId: string | null; promptVersion: string | null }> {
    try {
      const result = await this.analysisRepository.findResultByRun(analysisId);
      const assess = result?.aiCorrelationAssessment as
        | { modelId?: unknown; promptVersion?: unknown }
        | null
        | undefined;
      return {
        modelId: typeof assess?.modelId === 'string' ? assess.modelId : null,
        promptVersion: typeof assess?.promptVersion === 'string' ? assess.promptVersion : null,
      };
    } catch {
      return { modelId: null, promptVersion: null };
    }
  }

  /**
   * Đồng bộ mẫu học lại T1 cho một (finding, nhãn) — Phần 12 v15 §3.24.
   *
   * - Mô tả mẫu theo khuôn, **không** dùng `reason` (T1-1) → không đưa nội dung
   *   tự do của người dùng vào prompt AI, và cùng (finding, nhãn) luôn ra cùng mô tả
   *   → tự gom trùng (T1-3).
   * - Đếm lại số người khác nhau cùng nhãn → trust (T1-4). Gọi cả khi tạo, sửa, xoá
   *   (T1-5): mẫu tụt dưới 3 người có trust < 0,6 → bị loại khi truy xuất.
   * - Lỗi RAG không chặn luồng nhận xét (T1-6).
   */
  private async syncFindingExample(scope: {
    workspaceId: string;
    projectId: string;
    findingId: string | null;
    label: string;
  }): Promise<void> {
    try {
      const fid = (scope.findingId ?? '').trim();
      if (!fid) return;
      const exampleLabel = mapFeedbackLabelToExampleLabel(scope.label);
      if (!exampleLabel) return;
      const errorType = extractErrorType(fid);
      const columnTraits = columnTraitsFromFindingId(fid);
      const description = templateExampleDescription(exampleLabel, errorType, columnTraits);
      const agreement = await this.repo.countDistinctAuthors({
        workspaceId: scope.workspaceId,
        findingId: fid,
        label: scope.label,
      });
      const trustScore = computeTrustScore(agreement);
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
        workspaceId: scope.workspaceId,
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
      if (!isEligibleForStore(agreement, trustScore)) return;
      await this.analysisRepository.saveFewShotExample({
        workspaceId: scope.workspaceId,
        projectId: scope.projectId,
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
      this.logger.warn(`T1 dong bo kho mau bo qua (khong chan feedback): ${message}`);
    }
  }

  private async authorNames(docs: Feedback[]): Promise<Map<string, string | null>> {
    const map = new Map<string, string | null>();
    const ids = [...new Set(docs.map((d) => d.authorId))];
    for (const id of ids) map.set(id, null);
    if (ids.length === 0) return map;
    try {
      // Một truy vấn cho cả trang (trước đây N+1 `findById`).
      const users = await this.users.findByIds(ids);
      for (const u of users) map.set(u.id, `${u.firstName} ${u.lastName}`.trim());
    } catch {
      // Không lấy được tên → hiển thị null, không làm hỏng danh sách.
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
  ): Omit<Page, 'summary'> {
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
    return { items, meta: { nextCursor, hasMore, limit } };
  }

  /** `summary` đếm MỌI nhãn của phạm vi — không theo `?label` (FB-R2). */
  private async summaryFor(analysisRunId: string, findingId: string | null): Promise<Record<string, number>> {
    if (typeof this.repo.summaryByScope === 'function') {
      return this.repo.summaryByScope({ analysisRunId, findingId });
    }
    const summary: Record<string, number> = {};
    const all = await this.repo.listByScope({ analysisRunId, findingId, limit: 1000, sortOrder: 'desc' });
    for (const d of all) summary[d.label] = (summary[d.label] ?? 0) + 1;
    return summary;
  }

  private async listScope(
    userId: string,
    analysisId: string,
    findingId: string | null,
    query: ListFeedbackQueryInput,
  ): Promise<Page> {
    await this.resolveRunProject(analysisId, userId);
    const c = this.parseCursor(query.cursor);
    const docs = await this.repo.listByScope({
      analysisRunId: analysisId,
      findingId,
      limit: query.limit,
      label: query.label,
      sortOrder: query.sortOrder,
      cursorCreatedAt: c.createdAt,
      cursorId: c.id,
    });
    const names = await this.authorNames(docs.slice(0, query.limit));
    const page = this.buildPage(docs, query.limit, userId, names);
    const summary = await this.summaryFor(analysisId, findingId);
    return { ...page, summary };
  }

  private emitCreated(run: AnalysisRunRecord, doc: Feedback): void {
    // Không gửi `reason` / nội dung tự do qua socket (§3.17.2 quy tắc 2, FB-R12).
    try {
      this.realtime?.emitToProject(run.projectId, 'feedback.created', {
        analysisId: run.id,
        feedbackId: doc.id,
        label: doc.label,
      });
      this.realtime?.emitToAnalysis(run.id, 'feedback.created', {
        projectId: run.projectId,
        feedbackId: doc.id,
        label: doc.label,
      });
    } catch {
      // realtime khong bao gio lam hong luong nghiep vu chinh
    }
  }

  private async createFeedback(
    userId: string,
    run: AnalysisRunRecord,
    role: { projectRole: string; workspaceRole: string | null },
    findingId: string | null,
    dto: CreateFeedbackInput,
  ): Promise<Feedback> {
    const ai = await this.aiSnapshot(run.id);
    const entity = FeedbackEntity.create({
      id: newObjectIdHex(),
      analysisRunId: run.id,
      findingId,
      projectId: run.projectId,
      workspaceId: run.workspaceId,
      label: dto.label,
      reason: dto.reason ?? null,
      suggestedSeverity: dto.suggestedSeverity ?? null,
      // Phát hiện DQ không có độ tin cậy AI → null (FB-R10).
      aiConfidence: null,
      aiRationale: null,
      authorId: userId,
      authorRoleAtTime: role.projectRole ?? role.workspaceRole ?? 'viewer',
      modelId: ai.modelId,
      promptVersion: ai.promptVersion,
    });
    return this.repo.create({
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
  }

  async createFindingFeedback(
    userId: string,
    role: string,
    analysisId: string,
    findingId: string,
    dto: CreateFeedbackInput,
  ): Promise<Record<string, unknown>> {
    this.ensureNotAdmin(role);
    const fid = this.normalizeFindingId(findingId);
    const { run, projectRole, workspaceRole } = await this.resolveRunProject(
      analysisId,
      userId,
      FINDING_FEEDBACK_RUN_STATUSES,
    );
    const doc = await this.createFeedback(userId, run, { projectRole, workspaceRole }, fid, dto);
    await this.syncFindingExample({
      workspaceId: doc.workspaceId,
      projectId: doc.projectId,
      findingId: doc.findingId,
      label: doc.label,
    });
    const names = await this.authorNames([doc]);
    const plain = toPlain(doc, userId, names.get(userId) ?? null);
    this.emitCreated(run, doc);
    return plain;
  }

  async createRunFeedback(
    userId: string,
    role: string,
    analysisId: string,
    dto: CreateFeedbackInput,
  ): Promise<Record<string, unknown>> {
    this.ensureNotAdmin(role);
    const { run, projectRole, workspaceRole } = await this.resolveRunProject(
      analysisId,
      userId,
      RUN_FEEDBACK_RUN_STATUSES,
    );
    const doc = await this.createFeedback(userId, run, { projectRole, workspaceRole }, null, dto);
    const names = await this.authorNames([doc]);
    const plain = toPlain(doc, userId, names.get(userId) ?? null);
    this.emitCreated(run, doc);
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
    this.ensureNotAdmin(role);
    this.assertFeedbackId(id);
    const existing = await this.repo.findByIdActive(id);
    if (!existing) throw new NotFoundError('Không tìm thấy nhận xét');
    const before = { label: existing.label, reason: existing.reason, suggestedSeverity: existing.suggestedSeverity };
    existing.updateByAuthor(userId, {
      ...(dto.label !== undefined ? { label: dto.label } : {}),
      ...(dto.reason !== undefined ? { reason: dto.reason } : {}),
      ...(dto.suggestedSeverity !== undefined
        ? { suggestedSeverity: dto.suggestedSeverity }
        : {}),
    });
    // Chủ nhận xét phải CÒN quyền xem project (FB-R6): bị gỡ → 403, project đã xoá → 404.
    const { projectRole, workspaceRole } = await this.resolveProjectAccess(existing.projectId, userId);
    const updated = await this.repo.updateById(id, {
      ...(dto.label !== undefined ? { label: dto.label } : {}),
      ...(dto.reason !== undefined
        ? { reason: dto.reason?.trim() ? (dto.reason as string).trim().slice(0, 2000) : null }
        : {}),
      ...(dto.suggestedSeverity !== undefined ? { suggestedSeverity: dto.suggestedSeverity } : {}),
    });
    if (!updated) throw new NotFoundError('Không tìm thấy nhận xét');

    // Lịch sử nội bộ khi sửa (FB-R9, Phần 6 §3.5b "Lưu trữ").
    const changes = (['label', 'reason', 'suggestedSeverity'] as const)
      .filter((f) => before[f] !== updated[f])
      .map((f) => ({ field: f, beforeValue: before[f], afterValue: updated[f] }));
    if (changes.length > 0) {
      await this.audit?.log(
        {
          actorId: userId,
          actorRole: projectRole ?? workspaceRole,
          action: 'FEEDBACK_UPDATED',
          targetType: 'finding_feedback',
          targetId: id,
          workspaceId: updated.workspaceId,
          projectId: updated.projectId,
          metadata: { analysisRunId: updated.analysisRunId, findingId: updated.findingId },
        },
        changes,
      );
    }

    // Đổi nhãn → đồng bộ mẫu RAG của cả nhãn cũ lẫn nhãn mới (T1-5).
    if (before.label !== updated.label) {
      for (const label of [before.label, updated.label]) {
        await this.syncFindingExample({
          workspaceId: updated.workspaceId,
          projectId: updated.projectId,
          findingId: updated.findingId,
          label,
        });
      }
    }
    const names = await this.authorNames([updated]);
    return toPlain(updated, userId, names.get(userId) ?? null);
  }

  async remove(userId: string, role: string, id: string): Promise<{ deleted: boolean }> {
    this.assertFeedbackId(id);
    const existing = await this.repo.findByIdActive(id);
    if (!existing) throw new NotFoundError('Không tìm thấy nhận xét');
    const isMine = existing.authorId === userId;

    if (isMine && role !== 'admin') {
      // Chủ nhận xét phải CÒN quyền xem project (FB-R6).
      await this.resolveProjectAccess(existing.projectId, userId);
      await this.repo.softDelete(id);
      await this.afterRemoved(existing);
      return { deleted: true };
    }

    if (role === 'admin') {
      this.logger.warn(
        `SYS-ADMIN xoa nhan xet ${id} cua ${existing.authorId} (ghi log kiem toan)`,
      );
      await this.repo.softDelete(id);
      await this.auditModeration(existing, userId, 'admin');
      await this.afterRemoved(existing);
      return { deleted: true };
    }

    const project = await this.projects.getProjectById(existing.projectId);
    const workspaceRole = await this.workspaces.resolveUserWorkspaceRole(project.workspaceId, userId);
    const projectRole = await this.projects.resolveUserProjectRole(
      existing.projectId,
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
    await this.auditModeration(existing, userId, projectRole === 'owner' ? 'project_owner' : 'workspace_owner');
    await this.afterRemoved(existing);
    return { deleted: true };
  }

  /** Audit bắt buộc khi xoá nhận xét của người khác, kèm nội dung bị xoá (FB-R8). */
  private async auditModeration(doc: Feedback, actorId: string, actorRole: string): Promise<void> {
    await this.audit?.log({
      actorId,
      actorRole,
      action: 'FEEDBACK_MODERATION_DELETED',
      targetType: 'finding_feedback',
      targetId: doc.id,
      workspaceId: doc.workspaceId,
      projectId: doc.projectId,
      metadata: {
        analysisRunId: doc.analysisRunId,
        findingId: doc.findingId,
        authorId: doc.authorId,
        label: doc.label,
        reason: doc.reason,
        suggestedSeverity: doc.suggestedSeverity,
      },
    });
  }

  /** Xoá nhận xét → đếm lại đồng thuận cho nhãn cũ (T1-5). */
  private async afterRemoved(doc: Feedback): Promise<void> {
    await this.syncFindingExample({
      workspaceId: doc.workspaceId,
      projectId: doc.projectId,
      findingId: doc.findingId,
      label: doc.label,
    });
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
  ): Promise<Page> {
    this.ensureNotAdmin(role);
    const fid = this.normalizeFindingId(findingId);
    return this.listScope(userId, analysisId, fid, query);
  }

  async listRunFeedback(
    userId: string,
    role: string,
    analysisId: string,
    query: ListFeedbackQueryInput,
  ): Promise<Page> {
    this.ensureNotAdmin(role);
    return this.listScope(userId, analysisId, null, query);
  }
}
