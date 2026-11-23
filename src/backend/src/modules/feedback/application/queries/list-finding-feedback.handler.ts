/**
 * ListFindingFeedbackHandler — Use case: `listFindingFeedback()`
 * (chỉ đọc) — theo §3.10 Command/Query pattern.
 *
 * Handler không biết HTTP: trả về kết quả hoặc ném lỗi nghiệp vụ.
 * Dependency chỉ qua port token — không inject adapter cụ thể.
 */
import { Inject, Injectable } from '@nestjs/common';
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
import { CursorCodec } from '../../../../shared/domain/pagination/cursor-codec';
import { isObjectIdHex } from '../../../../shared/domain/utils/object-id.util';
import { ListFeedbackQueryInput } from '../feedback.types';
import { toPlain } from '../feedback.utils';
import { ForbiddenError, NotFoundError, ValidationError } from '../../../../shared/domain/errors';

@Injectable()
export class ListFindingFeedbackHandler {
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

  async execute(
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
    // Summary đếm bằng aggregation (không cắt ở 1000) — đúng khi >1000 feedback.
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
}
