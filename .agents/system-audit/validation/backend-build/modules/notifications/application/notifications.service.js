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
exports.NotificationsService = void 0;
const common_1 = require("@nestjs/common");
const notification_repository_port_1 = require("../domain/ports/notification.repository.port");
const notification_type_vo_1 = require("../domain/value-objects/notification-type.vo");
const user_repository_port_1 = require("../../users/domain/ports/user.repository.port");
const realtime_port_1 = require("../../realtime/domain/ports/realtime.port");
const cursor_codec_1 = require("../../../shared/pagination/cursor-codec");
const object_id_util_1 = require("../../../shared/utils/object-id.util");
function toResponse(doc) {
    return {
        id: doc.id,
        userId: doc.userId,
        type: doc.type,
        isMandatory: doc.isMandatory,
        title: doc.title,
        summary: doc.summary ?? null,
        payload: doc.payload ?? null,
        sourceEventId: doc.sourceEventId ?? null,
        readAt: doc.readAt ?? null,
        createdAt: doc.createdAt,
        updatedAt: doc.updatedAt,
    };
}
let NotificationsService = class NotificationsService {
    repo;
    users;
    realtime;
    constructor(repo, users, realtime) {
        this.repo = repo;
        this.users = users;
        this.realtime = realtime;
    }
    async listForUser(userId, query) {
        let cursorCreatedAt;
        let cursorId;
        if (query.cursor) {
            const decoded = cursor_codec_1.CursorCodec.decode(query.cursor);
            if (!decoded || !decoded.createdAt || !decoded.id || !(0, object_id_util_1.isObjectIdHex)(decoded.id)) {
                throw new common_1.BadRequestException('Cursor không hợp lệ');
            }
            const d = new Date(decoded.createdAt);
            if (Number.isNaN(d.getTime()))
                throw new common_1.BadRequestException('Cursor không hợp lệ');
            cursorCreatedAt = d;
            cursorId = decoded.id;
        }
        const docs = await this.repo.listForUser(userId, {
            read: query.read,
            limit: query.limit,
            cursorCreatedAt,
            cursorId,
            sortOrder: query.sortOrder,
        });
        const hasMore = docs.length > query.limit;
        const page = hasMore ? docs.slice(0, query.limit) : docs;
        let nextCursor = null;
        if (hasMore && page.length > 0) {
            const last = page[page.length - 1];
            nextCursor = cursor_codec_1.CursorCodec.encode({
                createdAt: last.createdAt.toISOString(),
                id: last.id,
            });
        }
        const unreadCount = await this.repo.countUnread(userId);
        return { items: page.map(toResponse), meta: { nextCursor, hasMore }, unreadCount };
    }
    async countUnread(userId) {
        const unreadCount = await this.repo.countUnread(userId);
        return { unreadCount };
    }
    async getDetail(userId, id) {
        const doc = await this.repo.findByIdForUser(id, userId);
        if (!doc)
            throw new common_1.NotFoundException('Không tìm thấy thông báo');
        if (!doc.readAt) {
            const updated = await this.repo.markAsRead(id, userId);
            return toResponse(updated ?? doc);
        }
        return toResponse(doc);
    }
    async markAsRead(userId, id) {
        const existing = await this.repo.findByIdForUser(id, userId);
        if (!existing)
            throw new common_1.NotFoundException('Không tìm thấy thông báo');
        const updated = await this.repo.markAsRead(id, userId);
        if (!updated)
            throw new common_1.NotFoundException('Không tìm thấy thông báo');
        return toResponse(updated);
    }
    async updatePreferences(userId, enabled) {
        const ok = await this.users.updateNotificationPreferences(userId, enabled);
        if (!ok)
            throw new common_1.NotFoundException('Không tìm thấy tài khoản người dùng');
        return { notificationsEnabled: enabled };
    }
    async dispatch(params) {
        const user = await this.users.findById(params.userId);
        const enabled = user ? user.notificationsEnabled : undefined;
        const mandatory = (0, notification_type_vo_1.isMandatoryNotification)(params.type, params.isMandatory === true);
        if (!(0, notification_type_vo_1.shouldDispatch)(enabled, mandatory))
            return null;
        const doc = {
            userId: params.userId,
            type: params.type,
            title: params.title.trim().slice(0, 200),
            summary: params.summary ? params.summary.slice(0, 500) : null,
            payload: params.payload ?? null,
            sourceEventId: params.sourceEventId ?? null,
            isMandatory: mandatory,
        };
        const created = await this.repo.createIfEventNotExists(doc);
        if (created) {
            try {
                this.realtime?.emitToUser(params.userId, 'notification.created', {
                    notificationId: created.id,
                    notificationType: created.type,
                });
            }
            catch {
            }
        }
        return created;
    }
};
exports.NotificationsService = NotificationsService;
exports.NotificationsService = NotificationsService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(notification_repository_port_1.NOTIFICATION_REPOSITORY_PORT)),
    __param(1, (0, common_1.Inject)(user_repository_port_1.USER_REPOSITORY_PORT)),
    __param(2, (0, common_1.Optional)()),
    __param(2, (0, common_1.Inject)(realtime_port_1.REALTIME_PORT)),
    __metadata("design:paramtypes", [Object, Object, Object])
], NotificationsService);
//# sourceMappingURL=notifications.service.js.map