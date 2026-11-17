"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OutboxEventSchema = void 0;
const mongoose_1 = require("mongoose");
exports.OutboxEventSchema = new mongoose_1.Schema({
    aggregate_type: {
        type: String,
        required: true,
        index: true,
    },
    aggregate_id: {
        type: String,
        required: true,
        index: true,
    },
    event_type: {
        type: String,
        required: true,
        index: true,
    },
    payload: {
        type: mongoose_1.Schema.Types.Mixed,
        required: true,
    },
    status: {
        type: String,
        enum: ['PENDING', 'PUBLISHING', 'PUBLISHED', 'PROCESSED', 'FAILED'],
        default: 'PENDING',
        index: true,
    },
    retry_count: {
        type: Number,
        default: 0,
    },
    error_message: {
        type: String,
        default: null,
    },
    processed_at: {
        type: Date,
        default: null,
    },
    published_at: {
        type: Date,
        default: null,
    },
    lease_expires_at: {
        type: Date,
        default: null,
    },
    workspace_id: { type: String, default: null },
    project_id: { type: String, default: null },
    actor_id: { type: String, default: null },
}, {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
});
exports.OutboxEventSchema.index({ status: 1, retry_count: 1, created_at: 1 });
exports.OutboxEventSchema.index({ status: 1, lease_expires_at: 1 });
//# sourceMappingURL=outbox-event.schema.js.map