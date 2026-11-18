"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var FeedbackService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.FeedbackService = void 0;
const common_1 = require("@nestjs/common");
const realtime_port_1 = require("../../realtime/domain/ports/realtime.port");
const feedback_repository_port_1 = require("../domain/ports/feedback.repository.port");
const analysis_repository_port_1 = require("../../analysis/domain/ports/analysis.repository.port");
const projects_service_1 = require("../../projects/application/projects.service");
const workspaces_service_1 = require("../../workspaces/application/workspaces.service");
const users_service_1 = require("../../users/application/users.service");
const feedback_label_vo_1 = require("../domain/value-objects/feedback-label.vo");
const cursor_codec_1 = require("../../../shared/pagination/cursor-codec");
const rag_few_shot_service_1 = require("../../analysis/application/services/rag-few-shot.service");
const rag_few_shot_util_1 = require("../../analysis/domain/rag-few-shot.util");
const feedback_label_vo_2 = require("../domain/value-objects/feedback-label.vo");
const object_id_util_1 = require("../../../shared/utils/object-id.util");
function toPlain(doc, viewerId, authorDisplayName) {
    const isMine = doc.authorId === viewerId;
    const base = {
        id: doc.id,
        analysisRunId: doc.analysisRunId,
        findingId: doc.findingId,
        projectId: doc.projectId,
        label: doc.label,
        reason: doc.reason,
        suggestedSeverity: doc.suggestedSeverity,
        aiConfidence: doc.aiConfidence,
        aiRationale: doc.aiRationale,
        authorRoleAtTime: doc.authorRoleAtTime,
        createdAt: doc.createdAt,
        updatedAt: doc.updatedAt,
    };
    if (isMine) {
        return { ...base, isMine: true, authorId: doc.authorId, authorDisplayName };
    }
    return { ...base, isMine: false, authorDisplayName };
}
let FeedbackService = FeedbackService_1 = class FeedbackService {
    repo;
    analysisRepository;
    projectsService;
    workspacesService;
    usersService;
    realtime;
    ragFewShot;
    logger = new common_1.Logger(FeedbackService_1.name);
    constructor(repo, analysisRepository, projectsService, workspacesService, usersService, realtime, ragFewShot) {
        this.repo = repo;
        this.analysisRepository = analysisRepository;
        this.projectsService = projectsService;
        this.workspacesService = workspacesService;
        this.usersService = usersService;
        this.realtime = realtime;
        this.ragFewShot = ragFewShot;
    }
    ensureNotAdmin(role) {
        if (role === 'admin') {
            throw new common_1.ForbiddenException('Quản trị viên hệ thống không có quyền với nhóm nhận xét (FB-*)');
        }
    }
    parseCursor(cursor) {
        if (!cursor)
            return {};
        const decoded = cursor_codec_1.CursorCodec.decode(cursor);
        if (!decoded || !decoded.createdAt || !decoded.id || !(0, object_id_util_1.isObjectIdHex)(decoded.id)) {
            throw new common_1.BadRequestException('Cursor không hợp lệ');
        }
        const d = new Date(decoded.createdAt);
        if (Number.isNaN(d.getTime()))
            throw new common_1.BadRequestException('Cursor không hợp lệ');
        return { createdAt: d, id: decoded.id };
    }
    buildPage(docs, limit, viewerId, names) {
        const hasMore = docs.length > limit;
        const page = hasMore ? docs.slice(0, limit) : docs;
        let nextCursor = null;
        if (hasMore && page.length > 0) {
            const last = page[page.length - 1];
            nextCursor = cursor_codec_1.CursorCodec.encode({
                createdAt: last.createdAt.toISOString(),
                id: last.id,
            });
        }
        const items = page.map((d) => toPlain(d, viewerId, names.get(d.authorId) ?? null));
        return { items, meta: { nextCursor, hasMore } };
    }
    async resolveProjectAccess(projectId, userId) {
        const project = await this.projectsService.getProjectById(projectId);
        const workspaceId = project.workspaceId;
        const workspaceRole = await this.workspacesService.resolveUserWorkspaceRole(workspaceId, userId);
        const projectRole = await this.projectsService.resolveUserProjectRole(projectId, userId, workspaceRole);
        if (!projectRole) {
            throw new common_1.ForbiddenException('Không có quyền truy cập project này');
        }
        return { projectRole, workspaceRole, workspaceId };
    }
    async resolveRunProject(analysisId, userId) {
        if (!(0, object_id_util_1.isObjectIdHex)(analysisId))
            throw new common_1.BadRequestException('ID lần phân tích không hợp lệ');
        const run = await this.analysisRepository.findById(analysisId);
        if (!run)
            throw new common_1.NotFoundException('Không tìm thấy lần phân tích');
        const projectId = run.projectId;
        const { projectRole, workspaceRole } = await this.resolveProjectAccess(projectId, userId);
        return { run, projectRole, workspaceRole };
    }
    async authorNames(docs) {
        const map = new Map();
        const ids = [...new Set(docs.map((d) => d.authorId))];
        for (const id of ids) {
            try {
                const u = await this.usersService.findById(id);
                if (u)
                    map.set(id, `${u.firstName} ${u.lastName}`.trim());
                else
                    map.set(id, null);
            }
            catch {
                map.set(id, null);
            }
        }
        return map;
    }
    checkReason(label, reason) {
        if ((0, feedback_label_vo_1.requiresReason)(label) &&
            (!reason || reason.trim().length === 0)) {
            throw new common_1.BadRequestException('Nhãn này bắt buộc kèm lý do (reason)');
        }
    }
    async promoteFindingToStore(doc) {
        try {
            const fid = (doc.findingId ?? '').trim();
            if (!fid)
                return;
            const exampleLabel = (0, rag_few_shot_util_1.mapFeedbackLabelToExampleLabel)(doc.label);
            if (!exampleLabel)
                return;
            const ws = doc.workspaceId;
            const projectId = doc.projectId;
            const errorType = (0, rag_few_shot_util_1.extractErrorType)(fid);
            const colPart = fid.includes(':') ? fid.split(':').slice(1).join(':').trim() : '';
            const columnTraits = (colPart || fid).slice(0, 300);
            const reasonText = (doc.reason ?? '').trim();
            const description = (reasonText || `${doc.label} cho ${fid}`).slice(0, 500);
            if (!description)
                return;
            const agreement = await this.repo.countDistinctAuthors({
                workspaceId: ws,
                findingId: fid,
                label: doc.label,
            });
            const trustScore = (0, rag_few_shot_util_1.computeTrustScore)(agreement);
            if (!(0, rag_few_shot_util_1.isEligibleForStore)(agreement, trustScore))
                return;
            const queryText = `${errorType} | ${columnTraits} | ${description}`;
            const embedding = this.ragFewShot ? this.ragFewShot.embedQueryText(queryText) : [];
            if (!embedding || embedding.length === 0)
                return;
            const normalized = (0, rag_few_shot_util_1.normalizeExample)({
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
        }
        catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            this.logger.warn(`T1 promote feedback → kho mau bo qua (khong chan feedback): ${message}`);
        }
    }
    async createFindingFeedback(userId, role, analysisId, findingId, dto) {
        this.ensureNotAdmin(role);
        const fid = (findingId ?? '').trim();
        if (!fid)
            throw new common_1.BadRequestException('findingId không được để trống');
        if (fid.length > 200)
            throw new common_1.BadRequestException('findingId tối đa 200 ký tự');
        this.checkReason(dto.label, dto.reason ?? null);
        (0, feedback_label_vo_2.assertReasonForLabel)(dto.label, dto.reason);
        const { run, projectRole, workspaceRole } = await this.resolveRunProject(analysisId, userId);
        let modelId = null;
        let aiConfidence = null;
        let aiRationale = null;
        try {
            const result = await this.analysisRepository.findResultByRun(analysisId);
            const assess = result?.aiCorrelationAssessment;
            if (assess && typeof assess.modelId === 'string')
                modelId = assess.modelId;
        }
        catch {
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
        }
        catch {
        }
        return plain;
    }
    async createRunFeedback(userId, role, analysisId, dto) {
        this.ensureNotAdmin(role);
        this.checkReason(dto.label, dto.reason ?? null);
        const { run, projectRole, workspaceRole } = await this.resolveRunProject(analysisId, userId);
        let modelId = null;
        try {
            const result = await this.analysisRepository.findResultByRun(analysisId);
            const assess = result?.aiCorrelationAssessment;
            if (assess && typeof assess.modelId === 'string')
                modelId = assess.modelId;
        }
        catch {
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
        }
        catch {
        }
        return plain;
    }
    async listFindingFeedback(userId, role, analysisId, findingId, query) {
        this.ensureNotAdmin(role);
        const fid = (findingId ?? '').trim();
        if (!fid)
            throw new common_1.BadRequestException('findingId không được để trống');
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
        const all = await this.repo.listByScope({
            analysisRunId: analysisId,
            findingId: fid,
            limit: 1000,
            sortOrder: 'desc',
        });
        const summary = {};
        for (const d of all)
            summary[d.label] = (summary[d.label] ?? 0) + 1;
        return { ...page, summary };
    }
    async listRunFeedback(userId, role, analysisId, query) {
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
        const all = await this.repo.listByScope({
            analysisRunId: analysisId,
            findingId: null,
            limit: 1000,
            sortOrder: 'desc',
        });
        const summary = {};
        for (const d of all)
            summary[d.label] = (summary[d.label] ?? 0) + 1;
        return { ...page, summary };
    }
    async updateMine(userId, id, dto) {
        const existing = await this.repo.findByIdActive(id);
        if (!existing)
            throw new common_1.NotFoundException('Không tìm thấy nhận xét');
        if (existing.authorId !== userId) {
            throw new common_1.ForbiddenException('Chỉ chủ nhận xét được sửa');
        }
        const nextLabel = dto.label ?? existing.label;
        const nextReason = dto.reason !== undefined ? dto.reason : existing.reason;
        this.checkReason(nextLabel, nextReason);
        const updated = await this.repo.updateById(id, {
            ...(dto.label !== undefined ? { label: dto.label } : {}),
            ...(dto.reason !== undefined
                ? { reason: dto.reason?.trim() ? dto.reason.trim().slice(0, 2000) : null }
                : {}),
            ...(dto.suggestedSeverity !== undefined ? { suggestedSeverity: dto.suggestedSeverity } : {}),
        });
        if (!updated)
            throw new common_1.NotFoundException('Không tìm thấy nhận xét');
        const names = await this.authorNames([updated]);
        return toPlain(updated, userId, names.get(userId) ?? null);
    }
    async remove(userId, role, id) {
        const existing = await this.repo.findByIdActive(id);
        if (!existing)
            throw new common_1.NotFoundException('Không tìm thấy nhận xét');
        const isMine = existing.authorId === userId;
        if (isMine) {
            if (role === 'admin') {
                this.logger.warn(`SYS-ADMIN tu xoa nhan xet ${id} (ghi log kiem toan)`);
            }
            await this.repo.softDelete(id);
            return { deleted: true };
        }
        if (role === 'admin') {
            this.logger.warn(`SYS-ADMIN xoa nhan xet vi pham ${id} cua ${existing.authorId} (ghi log kiem toan)`);
            await this.repo.softDelete(id);
            return { deleted: true };
        }
        const projectId = existing.projectId;
        const project = await this.projectsService.getProjectById(projectId);
        const workspaceId = project.workspaceId;
        const workspaceRole = await this.workspacesService.resolveUserWorkspaceRole(workspaceId, userId);
        const projectRole = await this.projectsService.resolveUserProjectRole(projectId, userId, workspaceRole);
        const canModerate = projectRole === 'owner' || workspaceRole === 'owner';
        if (!canModerate) {
            throw new common_1.ForbiddenException('Chỉ chủ nhận xét hoặc Project/Workspace Owner (xử lý vi phạm) được xoá');
        }
        this.logger.warn(`Owner ${userId} (${projectRole}/${workspaceRole}) xoa nhan xet vi pham ${id} (ghi log kiem toan)`);
        await this.repo.softDelete(id);
        return { deleted: true };
    }
    async aiQualityMetrics(userId, role, projectId) {
        this.ensureNotAdmin(role);
        if (!(0, object_id_util_1.isObjectIdHex)(projectId))
            throw new common_1.BadRequestException('ID Dự án không hợp lệ');
        const { projectRole, workspaceRole } = await this.resolveProjectAccess(projectId, userId);
        const allowed = workspaceRole === 'owner' || projectRole === 'owner' || projectRole === 'member';
        if (!allowed) {
            throw new common_1.ForbiddenException('Chỉ Owner/Member mới xem thống kê chất lượng AI');
        }
        const [groups, total, runs] = await Promise.all([
            this.repo.aggregateByProject(projectId),
            this.repo.countByProject(projectId),
            this.repo.countDistinctRuns(projectId),
        ]);
        const byLabel = {};
        for (const g of groups)
            byLabel[g.label] = g.count;
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
};
exports.FeedbackService = FeedbackService;
exports.FeedbackService = FeedbackService = FeedbackService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(feedback_repository_port_1.FEEDBACK_REPOSITORY_PORT)),
    __param(1, (0, common_1.Inject)(analysis_repository_port_1.ANALYSIS_REPOSITORY_PORT)),
    __param(5, (0, common_1.Optional)()),
    __param(5, (0, common_1.Inject)(realtime_port_1.REALTIME_PORT)),
    __param(6, (0, common_1.Optional)()),
    __metadata("design:paramtypes", [Object, Object, projects_service_1.ProjectsService, workspaces_service_1.WorkspacesService, users_service_1.UsersService, Object, rag_few_shot_service_1.RagFewShotService])
], FeedbackService);
//# sourceMappingURL=feedback.service.js.map