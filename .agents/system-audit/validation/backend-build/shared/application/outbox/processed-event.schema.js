"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProcessedEventSchema = void 0;
const mongoose_1 = require("mongoose");
exports.ProcessedEventSchema = new mongoose_1.Schema({
    consumer_name: { type: String, required: true },
    event_id: { type: String, required: true },
    status: { type: String, enum: ['processing', 'completed', 'failed'], default: 'processing' },
    lease_id: { type: String, default: null },
    lease_expires_at: { type: Date, default: null },
    attempts: { type: Number, default: 0 },
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });
exports.ProcessedEventSchema.index({ consumer_name: 1, event_id: 1 }, { unique: true });
exports.ProcessedEventSchema.index({ status: 1, lease_expires_at: 1 });
//# sourceMappingURL=processed-event.schema.js.map