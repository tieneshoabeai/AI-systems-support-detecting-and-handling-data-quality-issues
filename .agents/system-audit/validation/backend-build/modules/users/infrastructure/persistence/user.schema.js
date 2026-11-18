"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserSchema = void 0;
const mongoose_1 = require("mongoose");
exports.UserSchema = new mongoose_1.Schema({
    email: {
        type: String,
        required: true,
        lowercase: true,
        trim: true,
    },
    password_hash: {
        type: String,
        select: false,
    },
    google_id: {
        type: String,
        unique: true,
        sparse: true,
        index: true,
    },
    first_name: {
        type: String,
        required: true,
        trim: true,
        maxlength: 50,
    },
    last_name: {
        type: String,
        required: true,
        trim: true,
        maxlength: 50,
    },
    avatar_url: {
        type: String,
        default: null,
    },
    role: {
        type: String,
        enum: ['admin', 'analyst'],
        default: 'analyst',
        index: true,
    },
    notifications_enabled: {
        type: Boolean,
        default: true,
    },
    status: {
        type: String,
        enum: ['active', 'blocked'],
        default: 'active',
        index: true,
    },
    password_reset_token_hash: {
        type: String,
        default: null,
        select: false,
    },
    password_reset_expires_at: {
        type: Date,
        default: null,
        select: false,
    },
    password_reset_attempts: {
        type: Number,
        default: 0,
        select: false,
    },
    password_reset_sent_count: {
        type: Number,
        default: 0,
        select: false,
    },
    password_reset_sent_window_start: {
        type: Date,
        default: null,
        select: false,
    },
    deleted_at: {
        type: Date,
        default: null,
        index: true,
    },
}, {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
});
exports.UserSchema.index({ created_at: -1, _id: -1 });
exports.UserSchema.index({ email: 1 }, { unique: true, partialFilterExpression: { deleted_at: null } });
//# sourceMappingURL=user.schema.js.map