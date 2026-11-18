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
exports.ProjectsRepository = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
const project_mapper_1 = require("./project.mapper");
let ProjectsRepository = class ProjectsRepository {
    model;
    constructor(model) {
        this.model = model;
    }
    async create(data) {
        const inst = new this.model({
            workspace_id: new mongoose_2.Types.ObjectId(data.workspaceId),
            name: data.name.trim(),
            description: data.description ?? '',
            has_dataset: false,
            status: 'not_started',
            members: [{ user_id: new mongoose_2.Types.ObjectId(data.createdBy), role: 'owner', joined_at: new Date() }],
            last_accessed_at: new Date(),
            created_by: new mongoose_2.Types.ObjectId(data.createdBy),
            deleted_at: null,
        });
        const saved = await inst.save();
        return (0, project_mapper_1.toProjectRecord)(saved);
    }
    async findById(id) {
        if (!/^[0-9a-fA-F]{24}$/.test(id))
            return null;
        const doc = await this.model.findOne({ _id: new mongoose_2.Types.ObjectId(id), deleted_at: null }).exec();
        return doc ? (0, project_mapper_1.toProjectRecord)(doc) : null;
    }
    async findOneByWorkspaceAndName(workspaceId, name) {
        if (!/^[0-9a-fA-F]{24}$/.test(workspaceId))
            return null;
        const doc = await this.model
            .findOne({ workspace_id: new mongoose_2.Types.ObjectId(workspaceId), name: name.trim(), deleted_at: null })
            .exec();
        return doc ? (0, project_mapper_1.toProjectRecord)(doc) : null;
    }
    async findByWorkspace(workspaceId) {
        if (!/^[0-9a-fA-F]{24}$/.test(workspaceId))
            return [];
        const docs = await this.model
            .find({ workspace_id: new mongoose_2.Types.ObjectId(workspaceId), deleted_at: null })
            .sort({ updated_at: -1 })
            .exec();
        return docs.map(project_mapper_1.toProjectRecord);
    }
    async findByWorkspacePaged(workspaceId, opts = {}) {
        const filter = {
            workspace_id: new mongoose_2.Types.ObjectId(workspaceId),
            deleted_at: null,
        };
        if (opts.search?.trim())
            filter.name = { $regex: opts.search.trim(), $options: 'i' };
        if (opts.status)
            filter.status = opts.status;
        const page = Math.max(1, Number(opts.page) || 1);
        const limit = Math.min(100, Math.max(1, Number(opts.limit) || 15));
        const sortMap = {
            last_accessed: { last_accessed_at: -1 },
            updated: { updated_at: -1 },
            name_asc: { name: 1 },
            name_desc: { name: -1 },
            joined: { created_at: -1 },
        };
        const sort = sortMap[opts.sort || 'last_accessed'] ?? { last_accessed_at: -1 };
        const [items, total] = await Promise.all([
            this.model.find(filter).sort(sort).skip((page - 1) * limit).limit(limit).exec(),
            this.model.countDocuments(filter).exec(),
        ]);
        return { items: items.map(project_mapper_1.toProjectRecord), total };
    }
    async updateById(id, update, expectedVersion) {
        if (!/^[0-9a-fA-F]{24}$/.test(id))
            return null;
        const set = {};
        if (update.name !== undefined)
            set.name = update.name.trim();
        if (update.description !== undefined)
            set.description = update.description;
        const filter = { _id: new mongoose_2.Types.ObjectId(id), deleted_at: null };
        if (expectedVersion !== undefined)
            filter.version = expectedVersion;
        const doc = await this.model
            .findOneAndUpdate(filter, { $set: set, $inc: { version: 1 } }, { new: true })
            .exec();
        return doc ? (0, project_mapper_1.toProjectRecord)(doc) : null;
    }
    async softDelete(id) {
        if (!/^[0-9a-fA-F]{24}$/.test(id))
            return false;
        const r = await this.model
            .updateOne({ _id: new mongoose_2.Types.ObjectId(id), deleted_at: null }, { $set: { deleted_at: new Date() } })
            .exec();
        return r.modifiedCount > 0;
    }
    async setHasDataset(projectId, hasDataset) {
        if (!/^[0-9a-fA-F]{24}$/.test(projectId))
            return false;
        const r = await this.model
            .updateOne({ _id: new mongoose_2.Types.ObjectId(projectId), deleted_at: null }, { $set: { has_dataset: hasDataset } })
            .exec();
        return r.modifiedCount > 0;
    }
    async markCompleted(projectId, expectedVersion) {
        if (!/^[0-9a-fA-F]{24}$/.test(projectId))
            return false;
        const r = await this.model
            .updateOne({ _id: new mongoose_2.Types.ObjectId(projectId), deleted_at: null, status: 'in_progress', version: expectedVersion }, { $set: { status: 'completed' }, $inc: { version: 1 } })
            .exec();
        if (r.modifiedCount > 0)
            return true;
        const exists = await this.model.findOne({ _id: new mongoose_2.Types.ObjectId(projectId), deleted_at: null }).select('_id status version').lean().exec();
        if (exists)
            return null;
        return false;
    }
    async setStatus(projectId, status) {
        if (!/^[0-9a-fA-F]{24}$/.test(projectId))
            return false;
        const r = await this.model
            .updateOne({ _id: new mongoose_2.Types.ObjectId(projectId), deleted_at: null }, { $set: { status } })
            .exec();
        return r.modifiedCount > 0;
    }
    async touchLastAccessed(projectId) {
        if (!/^[0-9a-fA-F]{24}$/.test(projectId))
            return;
        await this.model
            .updateOne({ _id: new mongoose_2.Types.ObjectId(projectId), deleted_at: null }, { $set: { last_accessed_at: new Date() } })
            .exec();
    }
    async addMember(projectId, member) {
        if (!/^[0-9a-fA-F]{24}$/.test(projectId) || !/^[0-9a-fA-F]{24}$/.test(member.userId))
            return false;
        const r = await this.model
            .updateOne({ _id: new mongoose_2.Types.ObjectId(projectId), deleted_at: null }, { $push: { members: { user_id: new mongoose_2.Types.ObjectId(member.userId), role: member.role, joined_at: new Date() } } })
            .exec();
        return r.modifiedCount > 0;
    }
    async removeMember(projectId, userId) {
        if (!/^[0-9a-fA-F]{24}$/.test(projectId) || !/^[0-9a-fA-F]{24}$/.test(userId))
            return false;
        const r = await this.model
            .updateOne({ _id: new mongoose_2.Types.ObjectId(projectId), deleted_at: null }, { $pull: { members: { user_id: new mongoose_2.Types.ObjectId(userId) } } })
            .exec();
        return r.modifiedCount > 0;
    }
    async updateMemberRole(projectId, userId, role, expectedVersion) {
        if (!/^[0-9a-fA-F]{24}$/.test(projectId) || !/^[0-9a-fA-F]{24}$/.test(userId))
            return false;
        const filter = {
            _id: new mongoose_2.Types.ObjectId(projectId),
            deleted_at: null,
            'members.user_id': new mongoose_2.Types.ObjectId(userId),
        };
        if (expectedVersion !== undefined)
            filter.version = expectedVersion;
        const r = await this.model
            .updateOne(filter, { $set: { 'members.$.role': role }, $inc: { version: 1 } })
            .exec();
        if (r.modifiedCount > 0)
            return true;
        if (expectedVersion !== undefined) {
            const exists = await this.model.findOne({ _id: new mongoose_2.Types.ObjectId(projectId), deleted_at: null }).select('_id version').lean().exec();
            if (exists)
                return null;
            return false;
        }
        return r.modifiedCount > 0;
    }
    async transferOwner(projectId, newOwnerId, expectedVersion) {
        if (!/^[0-9a-fA-F]{24}$/.test(projectId) || !/^[0-9a-fA-F]{24}$/.test(newOwnerId))
            return false;
        const prjId = new mongoose_2.Types.ObjectId(projectId);
        const newId = new mongoose_2.Types.ObjectId(newOwnerId);
        const scoped = { _id: prjId, deleted_at: null };
        if (expectedVersion !== undefined)
            scoped.version = expectedVersion;
        const demote = await this.model
            .updateOne(scoped, { $set: { 'members.$[o].role': 'member' }, $inc: { version: 1 } }, { arrayFilters: [{ 'o.role': 'owner' }] })
            .exec();
        if (demote.matchedCount === 0) {
            if (expectedVersion !== undefined) {
                const exists = await this.model.findOne({ _id: prjId, deleted_at: null }).select('_id version').lean().exec();
                if (exists)
                    return null;
                return false;
            }
            return false;
        }
        const r = await this.model
            .updateOne({ _id: prjId, deleted_at: null, 'members.user_id': newId }, { $set: { 'members.$.role': 'owner' } })
            .exec();
        return r.modifiedCount > 0;
    }
};
exports.ProjectsRepository = ProjectsRepository;
exports.ProjectsRepository = ProjectsRepository = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, mongoose_1.InjectModel)('Project')),
    __metadata("design:paramtypes", [mongoose_2.Model])
], ProjectsRepository);
//# sourceMappingURL=projects.repository.js.map