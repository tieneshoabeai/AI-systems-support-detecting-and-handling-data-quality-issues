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
Object.defineProperty(exports, "__esModule", { value: true });
exports.IssuesService = void 0;
const common_1 = require("@nestjs/common");
const issue_report_repository_port_1 = require("../domain/ports/issue-report.repository.port");
const issue_status_vo_1 = require("../domain/value-objects/issue-status.vo");
const cursor_codec_1 = require("../../../shared/pagination/cursor-codec");
const object_id_util_1 = require("../../../shared/utils/object-id.util");
const notification_repository_port_1 = require("../../notifications/domain/ports/notification.repository.port");
const user_repository_port_1 = require("../../users/domain/ports/user.repository.port");
const realtime_port_1 = require("../../realtime/domain/ports/realtime.port");
const notification_type_vo_1 = require("../../notifications/domain/value-objects/notification-type.vo");
const storage_port_1 = require("../../../shared/ports/storage.port");
const crypto_1 = require("crypto");
function toResponse(doc) {
    return {
        id: doc.id,
        userId: doc.userId,
        workspaceId: doc.workspaceId,
        issueType: doc.issueType,
        title: doc.title,
        description: doc.description,
        status: doc.status,
        attachments: (doc.attachments ?? []).map((a) => ({
            ...a,
            downloadUrl: `/api/v1/issues/${doc.id}/attachments/${a.id}`,
        })),
        context: doc.context,
        version: doc.version,
        createdAt: doc.createdAt,
        updatedAt: doc.updatedAt,
    };
}
async function dispatchViaPorts(repo, users, realtime, params) {
    const user = await users.findById(params.userId).catch(() => null);
    const enabled = user ? user.notificationsEnabled : undefined;
    const mandatory = (0, notification_type_vo_1.isMandatoryNotification)(params.type, params.isMandatory);
    if (!(0, notification_type_vo_1.shouldDispatch)(enabled, mandatory))
        return;
    const created = await repo.createIfEventNotExists({
        userId: params.userId,
        type: params.type,
        title: params.title,
        summary: params.summary,
        payload: { targetType: 'issue', targetId: params.targetId },
        sourceEventId: null,
        isMandatory: mandatory,
    });
    if (created) {
        try {
            realtime?.emitToUser(params.userId, 'notification.created', {
                notificationId: created.id,
                notificationType: created.type,
            });
        }
        catch {
        }
    }
}
let IssuesService = class IssuesService {
    repo;
    notifications;
    users;
    realtime;
    storage;
    constructor(repo, notifications, users, realtime, storage) {
        this.repo = repo;
        this.notifications = notifications;
        this.users = users;
        this.realtime = realtime;
        this.storage = storage;
    }
    async createReport(userId, dto) {
        let workspaceId = null;
        if (dto.workspaceId) {
            if (!(0, object_id_util_1.isObjectIdHex)(dto.workspaceId)) {
                throw new common_1.BadRequestException('workspaceId không hợp lệ');
            }
            workspaceId = dto.workspaceId;
        }
        let occurredAt = null;
        if (dto.occurredAt) {
            const d = new Date(dto.occurredAt);
            if (Number.isNaN(d.getTime()))
                throw new common_1.BadRequestException('occurredAt không hợp lệ');
            occurredAt = d;
        }
        const input = {
            userId,
            workspaceId: workspaceId ?? null,
            issueType: dto.issueType,
            title: dto.title.trim(),
            description: dto.description.trim(),
            context: {
                apiPath: dto.apiPath ?? null,
                errorMessage: dto.errorMessage ?? null,
                occurredAt,
            },
        };
        const doc = await this.repo.create(input);
        return toResponse(doc);
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
    buildPage(docs, limit) {
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
        return { items: page.map(toResponse), meta: { nextCursor, hasMore } };
    }
    async listMine(userId, query) {
        const c = this.parseCursor(query.cursor);
        const q = {
            userId,
            limit: query.limit,
            sortBy: query.sortBy,
            sortOrder: query.sortOrder,
            status: query.status,
            cursorCreatedAt: c.createdAt,
            cursorId: c.id,
        };
        const docs = await this.repo.list(q);
        return this.buildPage(docs, query.limit);
    }
    async getMine(userId, id) {
        const doc = await this.repo.findByIdForUser(id, userId);
        if (!doc)
            throw new common_1.NotFoundException('Không tìm thấy báo cáo sự cố');
        return toResponse(doc);
    }
    async listForAdmin(query) {
        const sortBy = query.sortBy === 'severity' ? 'createdAt' : query.sortBy;
        const c = this.parseCursor(query.cursor);
        const docs = await this.repo.list({
            limit: query.limit,
            sortBy,
            sortOrder: query.sortOrder,
            status: query.status,
            cursorCreatedAt: c.createdAt,
            cursorId: c.id,
        });
        return this.buildPage(docs, query.limit);
    }
    async getForAdmin(id, role) {
        if (role !== 'admin')
            throw new common_1.ForbiddenException('Chỉ quản trị viên được xem báo cáo của người khác');
        const doc = await this.repo.findById(id);
        if (!doc)
            throw new common_1.NotFoundException('Không tìm thấy báo cáo sự cố');
        return toResponse(doc);
    }
    async updateStatus(id, role, status, expectedVersion) {
        if (role !== 'admin')
            throw new common_1.ForbiddenException('Chỉ quản trị viên được đổi trạng thái báo cáo');
        const existing = await this.repo.findById(id);
        if (!existing)
            throw new common_1.NotFoundException('Không tìm thấy báo cáo sự cố');
        try {
            (0, issue_status_vo_1.assertAllowedIssueTransition)(existing.status, status);
        }
        catch {
            throw new common_1.BadRequestException(`Chuyển trạng thái không hợp lệ: ${existing.status} -> ${status}`);
        }
        const updated = await this.repo.updateStatus(id, status, expectedVersion);
        if (!updated) {
            throw new common_1.ConflictException('Bản ghi đã bị thay đổi bởi người khác. Vui lòng tải lại (version lệch)');
        }
        if (status === 'new') {
            await dispatchViaPorts(this.notifications, this.users, this.realtime, {
                userId: updated.userId,
                type: 'issue_needs_info',
                title: 'Báo cáo của bạn cần bổ sung thông tin',
                summary: `Báo cáo "${updated.title}" cần bổ sung thêm thông tin.`,
                targetId: updated.id,
                isMandatory: true,
            });
        }
        else if (status === 'resolved') {
            await dispatchViaPorts(this.notifications, this.users, this.realtime, {
                userId: updated.userId,
                type: 'issue_resolved',
                title: 'Báo cáo sự cố đã được xử lý',
                summary: `Báo cáo "${updated.title}" đã được xử lý.`,
                targetId: updated.id,
                isMandatory: false,
            });
        }
        return toResponse(updated);
    }
    assertAttachmentAccess(doc, userId, role) {
        if (role === 'admin')
            return;
        if (doc.userId !== userId) {
            throw new common_1.NotFoundException('Không tìm thấy tệp đính kèm');
        }
    }
    async uploadAttachment(userId, role, issueId, file) {
        const doc = await this.repo.findById(issueId);
        if (!doc)
            throw new common_1.NotFoundException('Không tìm thấy báo cáo sự cố');
        this.assertAttachmentAccess(doc, userId, role);
        const allowed = { 'image/png': 'png', 'image/jpeg': 'jpg', 'application/pdf': 'pdf' };
        const ext = allowed[file.mimeType];
        if (!ext) {
            const err = new common_1.BadRequestException({
                message: `Định dạng tệp không được hỗ trợ: ${file.mimeType}. Chỉ chấp nhận png/jpg/pdf.`,
                error: 'UNSUPPORTED_MEDIA_TYPE',
            });
            throw err;
        }
        if (file.size > 10 * 1024 * 1024) {
            const err = new common_1.BadRequestException({
                message: 'Tệp đính kèm vượt quá 10MB',
                error: 'ATTACHMENT_TOO_LARGE',
            });
            throw err;
        }
        if ((doc.attachments ?? []).length >= 3) {
            throw new common_1.BadRequestException('Mỗi báo cáo chỉ được đính kèm tối đa 3 tệp');
        }
        if (!this.storage)
            throw new common_1.BadRequestException('Storage chưa sẵn sàng');
        const attachmentId = (0, crypto_1.randomBytes)(12).toString('hex');
        const key = `issue_attachments/${issueId}/${attachmentId}.${ext}`;
        await this.storage.uploadStream(key, file.stream, file.mimeType);
        const updated = await this.repo.addAttachment(issueId, {
            id: attachmentId,
            filename: file.filename.slice(0, 255),
            storageKey: key,
            sizeBytes: file.size,
            contentType: file.mimeType,
        });
        if (!updated)
            throw new common_1.NotFoundException('Không tìm thấy báo cáo sự cố');
        return toResponse(updated);
    }
    async downloadAttachment(userId, role, issueId, attachmentId) {
        const doc = (0, object_id_util_1.isObjectIdHex)(issueId)
            ? role === 'admin'
                ? await this.repo.findById(issueId)
                : await this.repo.findByIdForUser(issueId, userId)
            : null;
        if (!doc)
            throw new common_1.NotFoundException('Không tìm thấy tệp đính kèm');
        const att = (doc.attachments ?? []).find((a) => String(a.id) === String(attachmentId));
        if (!att)
            throw new common_1.NotFoundException('Không tìm thấy tệp đính kèm');
        const storageKey = String(att.storageKey ?? '');
        if (!storageKey || !this.storage)
            throw new common_1.NotFoundException('Không tìm thấy tệp đính kèm');
        const stream = await this.storage.downloadStream(storageKey);
        return {
            stream,
            filename: String(att.filename ?? 'attachment'),
            contentType: String(att.contentType ?? 'application/octet-stream'),
            sizeBytes: Number(att.sizeBytes ?? 0),
            workspaceId: doc.workspaceId,
        };
    }
};
exports.IssuesService = IssuesService;
exports.IssuesService = IssuesService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(issue_report_repository_port_1.ISSUE_REPORT_REPOSITORY_PORT)),
    __param(1, (0, common_1.Inject)(notification_repository_port_1.NOTIFICATION_REPOSITORY_PORT)),
    __param(2, (0, common_1.Inject)(user_repository_port_1.USER_REPOSITORY_PORT)),
    __param(3, (0, common_1.Optional)()),
    __param(3, (0, common_1.Inject)(realtime_port_1.REALTIME_PORT)),
    __param(4, (0, common_1.Optional)()),
    __param(4, (0, common_1.Inject)(storage_port_1.STORAGE_PORT)),
    __metadata("design:paramtypes", [Object, Object, Object, Object, Object])
], IssuesService);
//# sourceMappingURL=issues.service.js.map