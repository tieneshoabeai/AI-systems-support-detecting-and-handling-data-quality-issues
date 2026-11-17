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
exports.InboxService = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
const crypto_1 = require("crypto");
let InboxService = class InboxService {
    model;
    constructor(model) {
        this.model = model;
    }
    async claim(consumer, eventId, leaseMs = 30000) {
        const now = new Date();
        const leaseId = (0, crypto_1.randomUUID)();
        try {
            await this.model.create({
                consumer_name: consumer,
                event_id: eventId,
                status: 'processing',
                lease_id: leaseId,
                lease_expires_at: new Date(now.getTime() + leaseMs),
                attempts: 1,
            });
            return 'claimed';
        }
        catch (e) {
            const code = e?.code;
            if (code !== 11000)
                throw e;
        }
        const doc = await this.model.findOne({ consumer_name: consumer, event_id: eventId }).exec();
        if (!doc)
            return 'busy';
        if (doc.status === 'completed')
            return 'already';
        const exp = doc.lease_expires_at ? new Date(doc.lease_expires_at).getTime() : 0;
        if (doc.status === 'processing' && exp > Date.now())
            return 'busy';
        await this.model.updateOne({ _id: doc._id }, { $set: { status: 'processing', lease_id: leaseId, lease_expires_at: new Date(now.getTime() + leaseMs) }, $inc: { attempts: 1 } });
        return 'claimed';
    }
    async complete(consumer, eventId) {
        await this.model.updateOne({ consumer_name: consumer, event_id: eventId }, { $set: { status: 'completed', lease_id: null, lease_expires_at: null } });
    }
    async fail(consumer, eventId) {
        await this.model.updateOne({ consumer_name: consumer, event_id: eventId }, { $set: { status: 'failed', lease_id: null, lease_expires_at: null } });
    }
};
exports.InboxService = InboxService;
exports.InboxService = InboxService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, mongoose_1.InjectModel)('ProcessedEvent')),
    __metadata("design:paramtypes", [mongoose_2.Model])
], InboxService);
//# sourceMappingURL=inbox.service.js.map