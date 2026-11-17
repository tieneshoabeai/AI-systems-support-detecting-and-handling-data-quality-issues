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
exports.UsersRepository = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
function toUserRecord(doc) {
    return {
        id: doc._id.toString(),
        email: doc.email,
        passwordHash: doc.password_hash ?? null,
        googleId: doc.google_id ?? null,
        firstName: doc.first_name,
        lastName: doc.last_name,
        avatarUrl: doc.avatar_url ?? null,
        role: doc.role,
        notificationsEnabled: doc.notifications_enabled !== false,
        status: doc.status,
        deletedAt: doc.deleted_at,
        createdAt: doc.created_at,
        updatedAt: doc.updated_at,
    };
}
function toSessionRecord(doc) {
    return {
        id: doc._id.toString(),
        userId: doc.user_id.toString(),
        refreshTokenHash: doc.refresh_token_hash,
        deviceName: doc.device_name ?? null,
        ipAddress: doc.ip_address ?? null,
        userAgent: doc.user_agent ?? null,
        isRevoked: doc.is_revoked,
        expiresAt: doc.expires_at,
        createdAt: doc.created_at,
    };
}
let UsersRepository = class UsersRepository {
    userModel;
    sessionModel;
    constructor(userModel, sessionModel) {
        this.userModel = userModel;
        this.sessionModel = sessionModel;
    }
    async findByEmail(email, includePassword = false) {
        const query = this.userModel.findOne({ email, deleted_at: null });
        if (includePassword)
            query.select('+password_hash');
        const doc = await query.exec();
        return doc ? toUserRecord(doc) : null;
    }
    async findById(id) {
        if (!mongoose_2.Types.ObjectId.isValid(id))
            return null;
        const doc = await this.userModel
            .findOne({ _id: new mongoose_2.Types.ObjectId(id), deleted_at: null })
            .exec();
        return doc ? toUserRecord(doc) : null;
    }
    async findByIdWithResetSecret(id) {
        if (!mongoose_2.Types.ObjectId.isValid(id))
            return null;
        const doc = await this.userModel.findOne({ _id: new mongoose_2.Types.ObjectId(id), deleted_at: null }).select('+password_hash +password_reset_token_hash +password_reset_expires_at +password_reset_attempts +password_reset_sent_count +password_reset_sent_window_start').exec();
        if (!doc)
            return null;
        const base = toUserRecord(doc);
        return { ...base, tokenHash: doc.password_reset_token_hash ?? null, expiresAt: doc.password_reset_expires_at ?? null, attempts: doc.password_reset_attempts ?? 0, sentCount: doc.password_reset_sent_count ?? 0, windowStart: doc.password_reset_sent_window_start ?? null };
    }
    async findByEmailWithResetSecret(email) {
        const doc = await this.userModel.findOne({ email, deleted_at: null }).select('+password_hash +password_reset_token_hash +password_reset_expires_at +password_reset_attempts +password_reset_sent_count +password_reset_sent_window_start').exec();
        if (!doc)
            return null;
        const base = toUserRecord(doc);
        return { ...base, tokenHash: doc.password_reset_token_hash ?? null, expiresAt: doc.password_reset_expires_at ?? null, attempts: doc.password_reset_attempts ?? 0, sentCount: doc.password_reset_sent_count ?? 0, windowStart: doc.password_reset_sent_window_start ?? null };
    }
    async setPasswordResetOtp(email, tokenHash, expiresAt, sentCount, windowStart) {
        const r = await this.userModel.updateOne({ email, deleted_at: null }, { $set: { password_reset_token_hash: tokenHash, password_reset_expires_at: expiresAt, password_reset_attempts: 0, password_reset_sent_count: sentCount, password_reset_sent_window_start: windowStart } }).exec();
        return r.modifiedCount > 0;
    }
    async incrementResetAttempts(email) {
        const doc = await this.userModel.findOneAndUpdate({ email, deleted_at: null }, { $inc: { password_reset_attempts: 1 } }, { new: true }).select('+password_reset_attempts').exec();
        return doc?.password_reset_attempts ?? 0;
    }
    async clearPasswordReset(email) {
        const r = await this.userModel.updateOne({ email, deleted_at: null }, { $set: { password_reset_token_hash: null, password_reset_expires_at: null, password_reset_attempts: 0 } }).exec();
        return r.matchedCount > 0;
    }
    async setPasswordHash(userId, passwordHash) {
        if (!mongoose_2.Types.ObjectId.isValid(userId))
            return false;
        const r = await this.userModel.updateOne({ _id: new mongoose_2.Types.ObjectId(userId), deleted_at: null }, { $set: { password_hash: passwordHash } }).exec();
        return r.modifiedCount > 0;
    }
    async findPaged(opts) {
        const filter = { deleted_at: null };
        if (opts.search?.trim()) {
            const s = opts.search.trim();
            filter.$or = [{ email: { $regex: s, $options: 'i' } }, { first_name: { $regex: s, $options: 'i' } }, { last_name: { $regex: s, $options: 'i' } }];
        }
        if (opts.role)
            filter.role = opts.role;
        if (opts.status)
            filter.status = opts.status;
        const page = Math.max(1, opts.page || 1);
        const limit = Math.min(100, Math.max(1, opts.limit || 15));
        const [docs, total] = await Promise.all([
            this.userModel.find(filter).sort({ created_at: -1 }).skip((page - 1) * limit).limit(limit).exec(),
            this.userModel.countDocuments(filter).exec(),
        ]);
        return { items: docs.map(toUserRecord), total };
    }
    async create(data) {
        const inst = new this.userModel({
            email: data.email,
            password_hash: data.passwordHash,
            first_name: data.firstName,
            last_name: data.lastName,
            role: data.role ?? 'analyst',
            deleted_at: null,
        });
        const saved = await inst.save();
        return toUserRecord(saved);
    }
    async updateProfile(userId, data) {
        const doc = await this.userModel
            .findOneAndUpdate({ _id: new mongoose_2.Types.ObjectId(userId), deleted_at: null }, {
            $set: {
                ...(data.firstName !== undefined ? { first_name: data.firstName } : {}),
                ...(data.lastName !== undefined ? { last_name: data.lastName } : {}),
                ...(data.avatarUrl !== undefined ? { avatar_url: data.avatarUrl } : {}),
            },
        }, { new: true })
            .exec();
        return doc ? toUserRecord(doc) : null;
    }
    async updateNotificationPreferences(userId, enabled) {
        const doc = await this.userModel
            .findOneAndUpdate({ _id: new mongoose_2.Types.ObjectId(userId), deleted_at: null }, { $set: { notifications_enabled: enabled } }, { new: true })
            .exec();
        return !!doc;
    }
    async softDeleteUser(userId) {
        const result = await this.userModel.updateOne({ _id: new mongoose_2.Types.ObjectId(userId), deleted_at: null }, { $set: { deleted_at: new Date() } });
        if (result.matchedCount === 0)
            return false;
        await this.sessionModel.updateMany({ user_id: new mongoose_2.Types.ObjectId(userId), is_revoked: false }, { $set: { is_revoked: true } });
        return true;
    }
    async createSession(data) {
        const inst = new this.sessionModel({
            user_id: new mongoose_2.Types.ObjectId(data.userId),
            refresh_token_hash: data.refreshTokenHash,
            device_name: data.deviceName ?? 'Unknown Device',
            ip_address: data.ipAddress ?? null,
            user_agent: data.userAgent ?? null,
            is_revoked: false,
            expires_at: data.expiresAt,
        });
        const saved = await inst.save();
        return toSessionRecord(saved);
    }
    async findActiveSessions(userId) {
        const docs = await this.sessionModel
            .find({
            user_id: new mongoose_2.Types.ObjectId(userId),
            is_revoked: false,
            expires_at: { $gt: new Date() },
        })
            .sort({ created_at: -1 })
            .exec();
        return docs.map(toSessionRecord);
    }
    async findSessionByTokenHashIncludingRevoked(refreshTokenHash) {
        const doc = await this.sessionModel
            .findOne({ refresh_token_hash: refreshTokenHash })
            .exec();
        return doc ? toSessionRecord(doc) : null;
    }
    async findSessionByTokenHash(refreshTokenHash) {
        const doc = await this.sessionModel
            .findOne({ refresh_token_hash: refreshTokenHash, is_revoked: false, expires_at: { $gt: new Date() } })
            .exec();
        return doc ? toSessionRecord(doc) : null;
    }
    async revokeSession(userId, sessionId) {
        if (!mongoose_2.Types.ObjectId.isValid(sessionId))
            return false;
        const result = await this.sessionModel.updateOne({ _id: new mongoose_2.Types.ObjectId(sessionId), user_id: new mongoose_2.Types.ObjectId(userId) }, { $set: { is_revoked: true } });
        return result.modifiedCount > 0;
    }
    async revokeSessionById(sessionId) {
        if (!mongoose_2.Types.ObjectId.isValid(sessionId))
            return false;
        const result = await this.sessionModel.updateOne({ _id: new mongoose_2.Types.ObjectId(sessionId) }, { $set: { is_revoked: true } });
        return result.modifiedCount > 0;
    }
    async revokeAllUserSessions(userId) {
        const result = await this.sessionModel.updateMany({ user_id: new mongoose_2.Types.ObjectId(userId), is_revoked: false }, { $set: { is_revoked: true } });
        return result.modifiedCount;
    }
};
exports.UsersRepository = UsersRepository;
exports.UsersRepository = UsersRepository = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, mongoose_1.InjectModel)('User')),
    __param(1, (0, mongoose_1.InjectModel)('UserSession')),
    __metadata("design:paramtypes", [mongoose_2.Model, mongoose_2.Model])
], UsersRepository);
//# sourceMappingURL=users.repository.js.map