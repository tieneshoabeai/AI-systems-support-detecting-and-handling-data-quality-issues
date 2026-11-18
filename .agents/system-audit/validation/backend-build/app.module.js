"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppModule = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@nestjs/core");
const throttler_1 = require("@nestjs/throttler");
const config_1 = require("@nestjs/config");
const env_validation_1 = require("./shared/config/env.validation");
const shared_module_1 = require("./shared/shared.module");
const database_module_1 = require("./shared/database/database.module");
const storage_module_1 = require("./shared/storage/storage.module");
const users_module_1 = require("./modules/users/users.module");
const auth_module_1 = require("./modules/auth/auth.module");
const workspaces_module_1 = require("./modules/workspaces/workspaces.module");
const projects_module_1 = require("./modules/projects/projects.module");
const datasets_module_1 = require("./modules/datasets/datasets.module");
const data_view_module_1 = require("./modules/data-view/data-view.module");
const analysis_module_1 = require("./modules/analysis/analysis.module");
const notifications_module_1 = require("./modules/notifications/notifications.module");
const issues_module_1 = require("./modules/issues/issues.module");
const feedback_module_1 = require("./modules/feedback/feedback.module");
const realtime_module_1 = require("./modules/realtime/realtime.module");
const audit_module_1 = require("./modules/audit/audit.module");
const outbox_module_1 = require("./shared/application/outbox/outbox.module");
const events_module_1 = require("./shared/events/events.module");
const app_controller_1 = require("./app.controller");
let AppModule = class AppModule {
};
exports.AppModule = AppModule;
exports.AppModule = AppModule = __decorate([
    (0, common_1.Module)({
        imports: [
            throttler_1.ThrottlerModule.forRoot([
                {
                    name: 'default',
                    ttl: 60000,
                    limit: 200,
                },
            ]),
            config_1.ConfigModule.forRoot({
                isGlobal: true,
                validate: env_validation_1.validate,
                envFilePath: ['.env', 'src/backend/.env'],
            }),
            shared_module_1.SharedModule,
            database_module_1.DatabaseModule,
            outbox_module_1.OutboxModule,
            events_module_1.EventsModule,
            storage_module_1.StorageModule,
            users_module_1.UsersModule,
            auth_module_1.AuthModule,
            workspaces_module_1.WorkspacesModule,
            projects_module_1.ProjectsModule,
            datasets_module_1.DatasetsModule,
            data_view_module_1.DataViewModule,
            analysis_module_1.AnalysisModule,
            notifications_module_1.NotificationsModule,
            issues_module_1.IssuesModule,
            feedback_module_1.FeedbackModule,
            realtime_module_1.RealtimeModule,
            audit_module_1.AuditModule,
        ],
        controllers: [app_controller_1.AppController],
        providers: [
            {
                provide: core_1.APP_GUARD,
                useClass: throttler_1.ThrottlerGuard,
            },
        ],
    })
], AppModule);
//# sourceMappingURL=app.module.js.map