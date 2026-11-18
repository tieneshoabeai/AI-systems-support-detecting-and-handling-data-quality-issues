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
exports.NotificationsRepository = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
const notification_mapper_1 = require("./notification.mapper");
const object_id_util_1 = require("../../../../shared/utils/object-id.util");
let NotificationsRepository = class NotificationsRepository {
    model;
    constructor(model) {
        this.model = model;
    }
    async create(doc) {
        const inst = new this.model((0, notification_mapper_1.toNotificationPersistence)(doc));
        const saved = await inst.save();
        return (0, notification_mapper_1.toNotificationRecord)(saved);
    }
    async findByIdForUser(id, userId) {
        if (!(0, object_id_util_1.isObjectIdHex)(id) || !(0, object_id_util_1.isObjectIdHex)(userId))
            return null;
        const doc = await this.model
            .findOne({ _id: new mongoose_2.Types.ObjectId(id), user_id: new mongoose_2.Types.ObjectId(userId) })
            .exec();
        return doc ? (0, notification_mapper_1.toNotificationRecord)(doc) : null;
    }
    async listForUser(userId, opts) {
        if (!(0, object_id_util_1.isObjectIdHex)(userId))
            return [];
        const filter = { user_id: new mongoose_2.Types.ObjectId(userId) };
        if (opts.read === 'true')
            filter.read_at = { $ne: null };
        if (opts.read === 'false')
            filter.read_at = null;
        if (opts.cursorCreatedAt && opts.cursorId && (0, object_id_util_1.isObjectIdHex)(opts.cursorId)) {
            const cmp = opts.sortOrder === 'desc' ? '$lt' : '$gt';
            filter.$or = [
                { created_at: { [cmp]: opts.cursorCreatedAt } },
                { created_at: opts.cursorCreatedAt, _id: { [cmp]: new mongoose_2.Types.ObjectId(opts.cursorId) } },
            ];
        }
        const dir = opts.sortOrder === 'desc' ? -1 : 1;
        const docs = await this.model
            .find(filter)
            .sort({ created_at: dir, _id: dir })
            .limit(opts.limit + 1)
            .exec();
        return docs.map(notification_mapper_1.toNotificationRecord);
    }
    async countUnread(userId) {
        if (!(0, object_id_util_1.isObjectIdHex)(userId))
            return 0;
        return this.model.countDocuments({ user_id: new mongoose_2.Types.ObjectId(userId), read_at: null }).exec();
    }
    async markAsRead(id, userId) {
        if (!(0, object_id_util_1.isObjectIdHex)(id) || !(0, object_id_util_1.isObjectIdHex)(userId))
            return null;
        const doc = await this.model
            .findOneAndUpdate({ _id: new mongoose_2.Types.ObjectId(id), user_id: new mongoose_2.Types.ObjectId(userId) }, { $set: { read_at: new Date() } }, { new: true })
            .exec();
        return doc ? (0, notification_mapper_1.toNotificationRecord)(doc) : null;
    }
    async createIfEventNotExists(doc) {
        if (!doc.sourceEventId)
            return this.create(doc);
        try {
            const inst = new this.model((0, notification_mapper_1.toNotificationPersistence)(doc));
            const saved = await inst.save();
            return (0, notification_mapper_1.toNotificationRecord)(saved);
        }
        catch (err) {
            const code = typeof err === 'object' && err !== null ? err.code : null;
            if (code === 11000)
                return null;
            throw err;
        }
    }
    async existsByEvent(userId, sourceEventId) {
        if (!(0, object_id_util_1.isObjectIdHex)(userId) || !sourceEventId)
            return false;
        const c = await this.model
            .countDocuments({ user_id: new mongoose_2.Types.ObjectId(userId), source_event_id: sourceEventId })
            .exec();
        return c > 0;
    }
};
exports.NotificationsRepository = NotificationsRepository;
exports.NotificationsRepository = NotificationsRepository = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, mongoose_1.InjectModel)('Notification')),
    __metadata("design:paramtypes", [mongoose_2.Model])
], NotificationsRepository);
//# sourceMappingURL=notifications.repository.js.map