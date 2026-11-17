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
var OutboxService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.OutboxService = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
let OutboxService = OutboxService_1 = class OutboxService {
    outboxModel;
    logger = new common_1.Logger(OutboxService_1.name);
    constructor(outboxModel) {
        this.outboxModel = outboxModel;
    }
    async recordEvent(data, session) {
        const event = new this.outboxModel({
            aggregate_type: data.aggregate_type,
            aggregate_id: data.aggregate_id,
            event_type: data.event_type,
            payload: data.payload ?? {},
            workspace_id: data.workspace_id ?? null,
            project_id: data.project_id ?? null,
            actor_id: data.actor_id ?? null,
            status: 'PENDING',
            retry_count: 0,
        });
        return event.save({ session });
    }
    async getPendingEvents(limit = 50) {
        return this.outboxModel
            .find({ status: 'PENDING', retry_count: { $lt: 5 } })
            .sort({ created_at: 1 })
            .limit(limit)
            .exec();
    }
    async claimForPublish(limit = 50) {
        const now = new Date();
        const cutoff = new Date(now.getTime() - 60000);
        const docs = await this.outboxModel
            .find({
            $or: [
                { status: 'PENDING', created_at: { $lte: cutoff } },
                { status: 'PENDING' },
                { status: 'PUBLISHING', lease_expires_at: { $lte: now } },
            ],
            retry_count: { $lt: 5 },
        })
            .sort({ created_at: 1 })
            .limit(limit)
            .exec();
        const claimed = [];
        for (const d of docs) {
            const r = await this.outboxModel
                .findOneAndUpdate({ _id: d._id, $or: [{ status: 'PENDING' }, { status: 'PUBLISHING', lease_expires_at: { $lte: now } }] }, { $set: { status: 'PUBLISHING', lease_expires_at: new Date(now.getTime() + 60000) } }, { new: true })
                .exec();
            if (r)
                claimed.push(r);
        }
        return claimed;
    }
    async markAsPublished(eventId) {
        await this.outboxModel.updateOne({ _id: new mongoose_2.Types.ObjectId(eventId) }, { $set: { status: 'PUBLISHED', published_at: new Date(), lease_expires_at: null, error_message: null } });
    }
    async markAsProcessed(eventId) {
        await this.outboxModel.updateOne({ _id: eventId }, { $set: { status: 'PROCESSED', processed_at: new Date(), error_message: null } });
    }
    async markAsFailed(eventId, errorMessage) {
        const event = await this.outboxModel.findById(eventId);
        if (!event)
            return;
        const newRetryCount = event.retry_count + 1;
        const newStatus = newRetryCount >= 5 ? 'FAILED' : 'PENDING';
        await this.outboxModel.updateOne({ _id: eventId }, { $set: { status: newStatus, retry_count: newRetryCount, error_message: errorMessage, lease_expires_at: null } });
        this.logger.warn(`Outbox Event ${eventId} failed (Retry: ${newRetryCount}/5): ${errorMessage}`);
    }
    async reclaimStuckPublishing() {
        const now = new Date();
        const r = await this.outboxModel.updateMany({ status: 'PUBLISHING', lease_expires_at: { $lte: now } }, { $set: { status: 'PENDING', lease_expires_at: null } });
        return r.modifiedCount ?? 0;
    }
};
exports.OutboxService = OutboxService;
exports.OutboxService = OutboxService = OutboxService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, mongoose_1.InjectModel)('OutboxEvent')),
    __metadata("design:paramtypes", [mongoose_2.Model])
], OutboxService);
//# sourceMappingURL=outbox.service.js.map