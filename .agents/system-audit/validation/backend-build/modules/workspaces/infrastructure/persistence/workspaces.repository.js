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
exports.WorkspacesRepository = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
const mongo_session_context_1 = require("../../../../shared/database/mongo-session-context");
const workspace_mapper_1 = require("./workspace.mapper");
let WorkspacesRepository = class WorkspacesRepository {
    workspaceModel;
    constructor(workspaceModel) {
        this.workspaceModel = workspaceModel;
    }
    toRecord(doc) {
        return (0, workspace_mapper_1.toWorkspaceRecord)(doc);
    }
    async create(data) {
        const userObjectId = new mongoose_2.Types.ObjectId(data.ownerId);
        const inst = new this.workspaceModel({
            name: data.name,
            description: data.description ?? '',
            owner_id: userObjectId,
            members: [{ user_id: userObjectId, role: 'owner', joined_at: new Date() }],
            storage_used_bytes: 0,
            last_accessed_at: new Date(),
            deleted_at: null,
        });
        const saved = await inst.save();
        return this.toRecord(saved);
    }
    async findById(id) {
        if (!mongoose_2.Types.ObjectId.isValid(id))
            return null;
        const doc = await this.workspaceModel.findOne({ _id: new mongoose_2.Types.ObjectId(id), deleted_at: null }).exec();
        return doc ? this.toRecord(doc) : null;
    }
    async updateById(id, update, expectedVersion) {
        if (!mongoose_2.Types.ObjectId.isValid(id))
            return null;
        const filter = expectedVersion !== undefined
            ? { _id: new mongoose_2.Types.ObjectId(id), deleted_at: null, version: expectedVersion }
            : { _id: new mongoose_2.Types.ObjectId(id), deleted_at: null };
        const doc = await this.workspaceModel
            .findOneAndUpdate(filter, { $set: update, $inc: { version: 1 } }, { new: true })
            .exec();
        return doc ? this.toRecord(doc) : null;
    }
    async softDelete(id) {
        if (!mongoose_2.Types.ObjectId.isValid(id))
            return false;
        const r = await this.workspaceModel.updateOne({ _id: new mongoose_2.Types.ObjectId(id), deleted_at: null }, { $set: { deleted_at: new Date() } });
        return r.modifiedCount > 0;
    }
    async findByUser(userId) {
        const s = (0, mongo_session_context_1.resolveMongoSession)(undefined);
        const userObjectId = new mongoose_2.Types.ObjectId(userId);
        const docs = await this.workspaceModel
            .find({ deleted_at: null, $or: [{ owner_id: userObjectId }, { 'members.user_id': userObjectId }] }, null, { session: s })
            .sort({ updated_at: -1 })
            .exec();
        return docs.map((d) => this.toRecord(d));
    }
    async findAllActive() {
        const s = (0, mongo_session_context_1.resolveMongoSession)(undefined);
        const docs = await this.workspaceModel.find({ deleted_at: null }, null, { session: s }).sort({ updated_at: -1 }).exec();
        return docs.map((d) => this.toRecord(d));
    }
    async findByUserPaged(userId, opts = {}) {
        const s = (0, mongo_session_context_1.resolveMongoSession)(undefined);
        const userObjectId = new mongoose_2.Types.ObjectId(userId);
        const filter = { deleted_at: null, $or: [{ owner_id: userObjectId }, { 'members.user_id': userObjectId }] };
        if (opts.search?.trim())
            filter.name = { $regex: opts.search.trim(), $options: 'i' };
        if (opts.role === 'owner')
            filter.owner_id = userObjectId;
        else if (opts.role === 'member') {
            filter['members.user_id'] = userObjectId;
            filter['members.role'] = 'member';
        }
        const page = Math.max(1, Number(opts.page) || 1);
        const limit = Math.min(100, Math.max(1, Number(opts.limit) || 15));
        const sortMap = {
            last_accessed: { last_accessed_at: -1 }, updated: { updated_at: -1 },
            name_asc: { name: 1 }, name_desc: { name: -1 }, joined: { created_at: -1 },
        };
        const sort = sortMap[opts.sort || 'last_accessed'] ?? { last_accessed_at: -1 };
        const [items, total] = await Promise.all([
            this.workspaceModel.find(filter, null, { session: s }).sort(sort).skip((page - 1) * limit).limit(limit).exec(),
            this.workspaceModel.countDocuments(filter).exec(),
        ]);
        return { items: items.map((d) => this.toRecord(d)), total };
    }
    async addMember(workspaceId, member) {
        const s = (0, mongo_session_context_1.resolveMongoSession)(undefined);
        const result = await this.workspaceModel.updateOne({ _id: new mongoose_2.Types.ObjectId(workspaceId), deleted_at: null }, { $push: { members: (0, workspace_mapper_1.toMemberPersistence)(member) } }, { session: s });
        return result.modifiedCount > 0;
    }
    async removeMember(workspaceId, userId) {
        const s = (0, mongo_session_context_1.resolveMongoSession)(undefined);
        const result = await this.workspaceModel.updateOne({ _id: new mongoose_2.Types.ObjectId(workspaceId), deleted_at: null }, { $pull: { members: { user_id: new mongoose_2.Types.ObjectId(userId) } } }, { session: s });
        return result.modifiedCount > 0;
    }
    async updateMemberRole(workspaceId, userId, role, expectedVersion) {
        const s = (0, mongo_session_context_1.resolveMongoSession)(undefined);
        const filter = {
            _id: new mongoose_2.Types.ObjectId(workspaceId),
            deleted_at: null,
            'members.user_id': new mongoose_2.Types.ObjectId(userId),
        };
        if (expectedVersion !== undefined)
            filter.version = expectedVersion;
        const result = await this.workspaceModel.updateOne(filter, { $set: { 'members.$.role': role }, $inc: { version: 1 } }, { session: s });
        if (result.modifiedCount > 0)
            return true;
        if (expectedVersion !== undefined) {
            const exists = await this.workspaceModel
                .findOne({ _id: new mongoose_2.Types.ObjectId(workspaceId), deleted_at: null })
                .select('_id version')
                .lean()
                .exec();
            if (exists)
                return null;
            return false;
        }
        return result.modifiedCount > 0;
    }
    async touchLastAccessed(workspaceId) {
        const s = (0, mongo_session_context_1.resolveMongoSession)(undefined);
        await this.workspaceModel.updateOne({ _id: new mongoose_2.Types.ObjectId(workspaceId), deleted_at: null }, { $set: { last_accessed_at: new Date() } }, { session: s }).exec();
    }
    async addStorageUsed(workspaceId, deltaBytes) {
        const s = (0, mongo_session_context_1.resolveMongoSession)(undefined);
        await this.workspaceModel.updateOne({ _id: new mongoose_2.Types.ObjectId(workspaceId), deleted_at: null }, { $inc: { storage_used_bytes: deltaBytes } }, { session: s }).exec();
    }
    async transferOwner(workspaceId, newOwnerId, expectedVersion) {
        const s = (0, mongo_session_context_1.resolveMongoSession)(undefined);
        const wsId = new mongoose_2.Types.ObjectId(workspaceId);
        const newId = new mongoose_2.Types.ObjectId(newOwnerId);
        const scoped = { _id: wsId, deleted_at: null, version: expectedVersion };
        const demote = await this.workspaceModel.updateOne(scoped, { $set: { 'members.$[o].role': 'member' }, $inc: { version: 1 } }, { arrayFilters: [{ 'o.role': 'owner' }], session: s }).exec();
        if (demote.matchedCount === 0) {
            const exists = await this.workspaceModel.findOne({ _id: wsId, deleted_at: null }).select('_id version').lean().exec();
            if (exists)
                return null;
            return false;
        }
        const r = await this.workspaceModel.updateOne({ _id: wsId, deleted_at: null, 'members.user_id': newId }, { $set: { owner_id: newId, 'members.$.role': 'owner' } }, { session: s }).exec();
        return r.modifiedCount > 0;
    }
};
exports.WorkspacesRepository = WorkspacesRepository;
exports.WorkspacesRepository = WorkspacesRepository = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, mongoose_1.InjectModel)('Workspace')),
    __metadata("design:paramtypes", [mongoose_2.Model])
], WorkspacesRepository);
//# sourceMappingURL=workspaces.repository.js.map