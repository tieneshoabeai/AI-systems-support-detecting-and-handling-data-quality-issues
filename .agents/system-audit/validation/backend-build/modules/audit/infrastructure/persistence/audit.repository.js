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
exports.AuditRepository = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
const audit_repository_port_1 = require("../../domain/ports/audit.repository.port");
const object_id_util_1 = require("../../../../shared/utils/object-id.util");
function toOid(v) {
    if (!v || !(0, object_id_util_1.isObjectIdHex)(v))
        return null;
    return new mongoose_2.Types.ObjectId(v);
}
const RETENTION_DAYS = 365;
let AuditRepository = class AuditRepository {
    logModel;
    changeModel;
    constructor(logModel, changeModel) {
        this.logModel = logModel;
        this.changeModel = changeModel;
    }
    async createLog(input, changes) {
        const now = new Date();
        const expires = new Date(now.getTime() + RETENTION_DAYS * 24 * 60 * 60 * 1000);
        const doc = new this.logModel({
            actor_id: toOid(input.actorId),
            actor_role: input.actorRole ?? null,
            action: String(input.action),
            target_type: String(input.targetType),
            target_id: input.targetId ?? null,
            target_label: input.targetLabel ?? null,
            workspace_id: toOid(input.workspaceId ?? null),
            project_id: toOid(input.projectId ?? null),
            ip_address: input.ipAddress ?? null,
            user_agent: input.userAgent ? String(input.userAgent).slice(0, 500) : null,
            metadata: input.metadata ?? {},
            expires_at: expires,
        });
        const saved = await doc.save();
        if (changes && changes.length > 0) {
            const docs = changes.slice(0, 50).map((c) => ({
                audit_log_id: saved._id,
                field: String(c.field).slice(0, 200),
                before_value: c.beforeValue ?? null,
                after_value: c.afterValue ?? null,
                expires_at: expires,
            }));
            await this.changeModel.insertMany(docs).catch(() => undefined);
        }
        void audit_repository_port_1.AUDIT_REPOSITORY_PORT;
        return {
            id: saved._id.toString(),
            actorId: input.actorId ?? null,
            actorRole: input.actorRole ?? null,
            action: String(input.action),
            targetType: String(input.targetType),
            targetId: input.targetId ?? null,
            createdAt: saved.created_at,
        };
    }
};
exports.AuditRepository = AuditRepository;
exports.AuditRepository = AuditRepository = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, mongoose_1.InjectModel)('AuditLog')),
    __param(1, (0, mongoose_1.InjectModel)('AuditChange')),
    __metadata("design:paramtypes", [mongoose_2.Model, mongoose_2.Model])
], AuditRepository);
//# sourceMappingURL=audit.repository.js.map