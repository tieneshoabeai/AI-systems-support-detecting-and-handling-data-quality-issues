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
exports.IssuesRepository = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
const issue_mapper_1 = require("./issue.mapper");
const object_id_util_1 = require("../../../../shared/utils/object-id.util");
let IssuesRepository = class IssuesRepository {
    model;
    constructor(model) {
        this.model = model;
    }
    async create(doc) {
        const inst = new this.model((0, issue_mapper_1.toIssuePersistence)(doc));
        const saved = await inst.save();
        return (0, issue_mapper_1.toIssueRecord)(saved);
    }
    async findById(id) {
        if (!(0, object_id_util_1.isObjectIdHex)(id))
            return null;
        const doc = await this.model.findOne({ _id: new mongoose_2.Types.ObjectId(id), deleted_at: null }).exec();
        return doc ? (0, issue_mapper_1.toIssueRecord)(doc) : null;
    }
    async findByIdForUser(id, userId) {
        if (!(0, object_id_util_1.isObjectIdHex)(id) || !(0, object_id_util_1.isObjectIdHex)(userId))
            return null;
        const doc = await this.model
            .findOne({ _id: new mongoose_2.Types.ObjectId(id), user_id: new mongoose_2.Types.ObjectId(userId), deleted_at: null })
            .exec();
        return doc ? (0, issue_mapper_1.toIssueRecord)(doc) : null;
    }
    async list(opts) {
        const filter = { deleted_at: null };
        if (opts.userId) {
            if (!(0, object_id_util_1.isObjectIdHex)(opts.userId))
                return [];
            filter.user_id = new mongoose_2.Types.ObjectId(opts.userId);
        }
        if (opts.status)
            filter.status = opts.status;
        if (opts.cursorCreatedAt && opts.cursorId && (0, object_id_util_1.isObjectIdHex)(opts.cursorId)) {
            const cmp = opts.sortOrder === 'desc' ? '$lt' : '$gt';
            filter.$or = [
                { created_at: { [cmp]: opts.cursorCreatedAt } },
                { created_at: opts.cursorCreatedAt, _id: { [cmp]: new mongoose_2.Types.ObjectId(opts.cursorId) } },
            ];
        }
        const dir = opts.sortOrder === 'desc' ? -1 : 1;
        const sortField = opts.sortBy === 'updatedAt' ? 'updated_at' : opts.sortBy === 'status' ? 'status' : 'created_at';
        const sort = {};
        sort[sortField] = dir;
        sort['_id'] = dir;
        const docs = await this.model.find(filter).sort(sort).limit(opts.limit + 1).exec();
        return docs.map(issue_mapper_1.toIssueRecord);
    }
    async addAttachment(id, attachment) {
        if (!(0, object_id_util_1.isObjectIdHex)(id))
            return null;
        const doc = await this.model
            .findOneAndUpdate({ _id: new mongoose_2.Types.ObjectId(id), deleted_at: null }, {
            $push: {
                attachments: {
                    id: new mongoose_2.Types.ObjectId(attachment.id),
                    filename: attachment.filename,
                    storage_key: attachment.storageKey,
                    size_bytes: attachment.sizeBytes,
                    content_type: attachment.contentType,
                },
            },
        }, { new: true })
            .exec();
        return doc ? (0, issue_mapper_1.toIssueRecord)(doc) : null;
    }
    async updateStatus(id, status, expectedVersion) {
        if (!(0, object_id_util_1.isObjectIdHex)(id))
            return null;
        const doc = await this.model
            .findOneAndUpdate({ _id: new mongoose_2.Types.ObjectId(id), version: expectedVersion, deleted_at: null }, { $set: { status }, $inc: { version: 1 } }, { new: true })
            .exec();
        return doc ? (0, issue_mapper_1.toIssueRecord)(doc) : null;
    }
    async findStatusById(id) {
        if (!(0, object_id_util_1.isObjectIdHex)(id))
            return null;
        const doc = await this.model
            .findOne({ _id: new mongoose_2.Types.ObjectId(id), deleted_at: null })
            .select('status')
            .lean()
            .exec();
        return doc?.status ?? null;
    }
};
exports.IssuesRepository = IssuesRepository;
exports.IssuesRepository = IssuesRepository = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, mongoose_1.InjectModel)('IssueReport')),
    __metadata("design:paramtypes", [mongoose_2.Model])
], IssuesRepository);
//# sourceMappingURL=issues.repository.js.map