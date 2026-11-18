"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserSessionSchema = void 0;
const mongoose_1 = require("mongoose");
exports.UserSessionSchema = new mongoose_1.Schema({
    user_id: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true,
    },
    refresh_token_hash: {
        type: String,
        required: true,
        select: false,
    },
    device_name: {
        type: String,
        default: 'Unknown Device',
    },
    ip_address: {
        type: String,
        default: null,
    },
    user_agent: {
        type: String,
        default: null,
    },
    is_revoked: {
        type: Boolean,
        default: false,
        index: true,
    },
    expires_at: {
        type: Date,
        required: true,
        index: { expires: '7d' },
    },
}, {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
});
exports.UserSessionSchema.index({ user_id: 1, is_revoked: 1 });
//# sourceMappingURL=user-session.schema.js.map