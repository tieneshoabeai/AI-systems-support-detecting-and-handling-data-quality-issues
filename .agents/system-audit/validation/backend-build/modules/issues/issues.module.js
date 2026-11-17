"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.IssuesModule = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const issue_report_schema_1 = require("./infrastructure/persistence/issue-report.schema");
const issues_repository_1 = require("./infrastructure/persistence/issues.repository");
const issue_report_repository_port_1 = require("./domain/ports/issue-report.repository.port");
const issues_service_1 = require("./application/issues.service");
const issues_controller_1 = require("./infrastructure/http/issues.controller");
const notifications_module_1 = require("../notifications/notifications.module");
const users_module_1 = require("../users/users.module");
let IssuesModule = class IssuesModule {
};
exports.IssuesModule = IssuesModule;
exports.IssuesModule = IssuesModule = __decorate([
    (0, common_1.Module)({
        imports: [
            mongoose_1.MongooseModule.forFeature([{ name: 'IssueReport', schema: issue_report_schema_1.IssueReportSchema }]),
            notifications_module_1.NotificationsModule,
            users_module_1.UsersModule,
        ],
        controllers: [issues_controller_1.IssuesController],
        providers: [
            issues_repository_1.IssuesRepository,
            { provide: issue_report_repository_port_1.ISSUE_REPORT_REPOSITORY_PORT, useExisting: issues_repository_1.IssuesRepository },
            issues_service_1.IssuesService,
        ],
        exports: [issues_service_1.IssuesService, issues_repository_1.IssuesRepository, issue_report_repository_port_1.ISSUE_REPORT_REPOSITORY_PORT],
    })
], IssuesModule);
//# sourceMappingURL=issues.module.js.map