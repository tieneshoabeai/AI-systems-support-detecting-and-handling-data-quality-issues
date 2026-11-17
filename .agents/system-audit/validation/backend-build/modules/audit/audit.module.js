"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuditModule = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const audit_log_schema_1 = require("./infrastructure/persistence/audit-log.schema");
const audit_repository_1 = require("./infrastructure/persistence/audit.repository");
const audit_repository_port_1 = require("./domain/ports/audit.repository.port");
const audit_service_1 = require("./application/audit.service");
let AuditModule = class AuditModule {
};
exports.AuditModule = AuditModule;
exports.AuditModule = AuditModule = __decorate([
    (0, common_1.Global)(),
    (0, common_1.Module)({
        imports: [
            mongoose_1.MongooseModule.forFeature([
                { name: 'AuditLog', schema: audit_log_schema_1.AuditLogSchema },
                { name: 'AuditChange', schema: audit_log_schema_1.AuditChangeSchema },
            ]),
        ],
        providers: [audit_repository_1.AuditRepository, { provide: audit_repository_port_1.AUDIT_REPOSITORY_PORT, useExisting: audit_repository_1.AuditRepository }, audit_service_1.AuditService],
        exports: [audit_service_1.AuditService, audit_repository_1.AuditRepository, audit_repository_port_1.AUDIT_REPOSITORY_PORT],
    })
], AuditModule);
//# sourceMappingURL=audit.module.js.map