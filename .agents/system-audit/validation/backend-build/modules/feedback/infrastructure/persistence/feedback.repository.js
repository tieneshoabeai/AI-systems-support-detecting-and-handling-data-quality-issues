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
exports.FeedbackRepository = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
const feedback_mapper_1 = require("./feedback.mapper");
const object_id_util_1 = require("../../../../shared/utils/object-id.util");
function oid(id) {
    return new mongoose_2.Types.ObjectId(id);
}
let FeedbackRepository = class FeedbackRepository {
    model;
    constructor(model) {
        this.model = model;
    }
    async create(doc) {
        const raw = doc;
        const pickStr = (v) => {
            if (typeof v === 'string' && v.length > 0)
                return v;
            if (v instanceof mongoose_2.Types.ObjectId)
                return v.toString();
            return null;
        };
        const get = (camel, snake) => (raw[camel] !== undefined ? raw[camel] : raw[snake]);
        const input = {
            analysisRunId: pickStr(get('analysisRunId', 'analysis_run_id')) ?? doc.analysisRunId,
            projectId: pickStr(get('projectId', 'project_id')) ?? doc.projectId,
            workspaceId: pickStr(get('workspaceId', 'workspace_id')) ?? doc.workspaceId,
            findingId: get('findingId', 'finding_id') ?? null,
            findingKey: get('findingKey', 'finding_key') ?? null,
            authorId: pickStr(get('authorId', 'author_id')) ?? doc.authorId,
            label: String(get('label', 'label') ?? doc.label),
            reason: get('reason', 'reason') ?? null,
            suggestedSeverity: get('suggestedSeverity', 'suggested_severity') ?? null,
            aiConfidence: get('aiConfidence', 'ai_confidence') ?? null,
            aiRationale: get('aiRationale', 'ai_rationale') ?? null,
            authorRoleAtTime: get('authorRoleAtTime', 'author_role_at_time') ?? null,
        };
        const inst = new this.model({ ...(0, feedback_mapper_1.toFeedbackPersistence)(input), deleted_at: null });
        const extra = {};
        if (raw.model_id !== undefined)
            extra.model_id = raw.model_id;
        if (raw.prompt_version !== undefined)
            extra.prompt_version = raw.prompt_version;
        if (raw.modelId !== undefined && raw.model_id === undefined)
            extra.model_id = raw.modelId;
        if (raw.promptVersion !== undefined && raw.prompt_version === undefined)
            extra.prompt_version = raw.promptVersion;
        for (const [k, v] of Object.entries(extra))
            inst[k] = v;
        const saved = await inst.save();
        return (0, feedback_mapper_1.toFeedbackRecord)(saved);
    }
    async listByScope(params) {
        const raw = params;
        const analysisRunId = String(raw.analysisRunId ?? raw.analysis_run_id ?? params.analysisRunId);
        const findingId = (raw.findingId !== undefined ? raw.findingId : raw.finding_id);
        const limit = Number(raw.limit ?? params.limit ?? 20);
        const label = (raw.label ?? params.label);
        const sortOrder = String(raw.sortOrder ?? raw.sort_order ?? params.sortOrder ?? 'desc');
        const cursorCreatedAt = (raw.cursorCreatedAt ?? raw.cursor_created_at ?? params.cursorCreatedAt);
        const cursorId = String(raw.cursorId ?? raw.cursor_id ?? params.cursorId ?? '');
        if (!(0, object_id_util_1.isObjectIdHex)(analysisRunId))
            return [];
        const filter = {
            analysis_run_id: oid(analysisRunId),
            finding_id: findingId ?? null,
            deleted_at: null,
        };
        if (label)
            filter.label = label;
        if (cursorCreatedAt && cursorId && (0, object_id_util_1.isObjectIdHex)(cursorId)) {
            const op = sortOrder === 'desc' ? '$lt' : '$gt';
            filter.$or = [
                { created_at: { [op]: cursorCreatedAt } },
                { created_at: cursorCreatedAt, _id: { [op]: oid(cursorId) } },
            ];
        }
        const sort = sortOrder === 'desc' ? { created_at: -1, _id: -1 } : { created_at: 1, _id: 1 };
        const docs = await this.model
            .find(filter)
            .sort(sort)
            .limit(limit + 1)
            .exec();
        return docs.map(feedback_mapper_1.toFeedbackRecord);
    }
    async listActiveByRun(analysisRunId) {
        if (!(0, object_id_util_1.isObjectIdHex)(analysisRunId))
            return [];
        const docs = await this.model.find({ analysis_run_id: oid(analysisRunId), deleted_at: null }).sort({ created_at: 1 }).exec();
        return docs.map(feedback_mapper_1.toFeedbackRecord);
    }
    async findByIdActive(id) {
        if (!(0, object_id_util_1.isObjectIdHex)(id))
            return null;
        const doc = await this.model.findOne({ _id: oid(id), deleted_at: null }).exec();
        return doc ? (0, feedback_mapper_1.toFeedbackRecord)(doc) : null;
    }
    async updateById(id, update) {
        if (!(0, object_id_util_1.isObjectIdHex)(id))
            return null;
        const raw = update.$set && typeof update.$set === 'object'
            ? update.$set
            : update;
        const set = { ...raw };
        if (raw.label !== undefined)
            set.label = raw.label;
        if (raw.reason !== undefined)
            set.reason = raw.reason;
        if (raw.suggestedSeverity !== undefined) {
            set.suggested_severity = raw.suggestedSeverity;
            delete set.suggestedSeverity;
        }
        if (raw.suggested_severity !== undefined)
            set.suggested_severity = raw.suggested_severity;
        const doc = await this.model.findOneAndUpdate({ _id: oid(id), deleted_at: null }, { $set: set }, { new: true }).exec();
        return doc ? (0, feedback_mapper_1.toFeedbackRecord)(doc) : null;
    }
    async softDelete(id) {
        if (!(0, object_id_util_1.isObjectIdHex)(id))
            return false;
        const res = await this.model.updateOne({ _id: oid(id), deleted_at: null }, { $set: { deleted_at: new Date() } }).exec();
        return res.modifiedCount > 0;
    }
    async countByProject(projectId) {
        if (!(0, object_id_util_1.isObjectIdHex)(projectId))
            return 0;
        return this.model.countDocuments({ project_id: oid(projectId), deleted_at: null }).exec();
    }
    async countDistinctAuthors(scope) {
        const raw = scope;
        const workspaceId = String(raw.workspaceId ?? raw.workspace_id ?? scope.workspaceId);
        const findingId = String(raw.findingId ?? raw.finding_id ?? scope.findingId);
        const label = String(raw.label ?? scope.label);
        if (!(0, object_id_util_1.isObjectIdHex)(workspaceId))
            return 0;
        const ids = (await this.model.distinct('author_id', {
            workspace_id: oid(workspaceId),
            finding_id: findingId,
            label,
            deleted_at: null,
        }).exec());
        return ids.length;
    }
    async countDistinctRuns(projectId) {
        if (!(0, object_id_util_1.isObjectIdHex)(projectId))
            return 0;
        const ids = await this.model.distinct('analysis_run_id', { project_id: oid(projectId), deleted_at: null }).exec();
        return ids.length;
    }
    async aggregateByProject(projectId) {
        if (!(0, object_id_util_1.isObjectIdHex)(projectId))
            return [];
        const rows = await this.model.aggregate([
            { $match: { project_id: oid(projectId), deleted_at: null } },
            { $group: { _id: '$label', count: { $sum: 1 } } },
            { $sort: { count: -1 } },
        ]).exec();
        return rows.map((r) => ({ label: r._id, count: r.count }));
    }
};
exports.FeedbackRepository = FeedbackRepository;
exports.FeedbackRepository = FeedbackRepository = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, mongoose_1.InjectModel)('FindingFeedback')),
    __metadata("design:paramtypes", [mongoose_2.Model])
], FeedbackRepository);
//# sourceMappingURL=feedback.repository.js.map