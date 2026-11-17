"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.FeedbackModule = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const finding_feedback_schema_1 = require("./infrastructure/persistence/finding-feedback.schema");
const feedback_repository_1 = require("./infrastructure/persistence/feedback.repository");
const feedback_repository_port_1 = require("./domain/ports/feedback.repository.port");
const feedback_service_1 = require("./application/feedback.service");
const feedback_controller_1 = require("./infrastructure/http/feedback.controller");
const projects_module_1 = require("../projects/projects.module");
const workspaces_module_1 = require("../workspaces/workspaces.module");
const users_module_1 = require("../users/users.module");
const analysis_module_1 = require("../analysis/analysis.module");
let FeedbackModule = class FeedbackModule {
};
exports.FeedbackModule = FeedbackModule;
exports.FeedbackModule = FeedbackModule = __decorate([
    (0, common_1.Module)({
        imports: [
            mongoose_1.MongooseModule.forFeature([{ name: 'FindingFeedback', schema: finding_feedback_schema_1.FindingFeedbackSchema }]),
            projects_module_1.ProjectsModule,
            workspaces_module_1.WorkspacesModule,
            users_module_1.UsersModule,
            analysis_module_1.AnalysisModule,
        ],
        controllers: [feedback_controller_1.FeedbackController],
        providers: [
            feedback_repository_1.FeedbackRepository,
            { provide: feedback_repository_port_1.FEEDBACK_REPOSITORY_PORT, useExisting: feedback_repository_1.FeedbackRepository },
            feedback_service_1.FeedbackService,
        ],
        exports: [feedback_service_1.FeedbackService, feedback_repository_port_1.FEEDBACK_REPOSITORY_PORT, feedback_repository_1.FeedbackRepository],
    })
], FeedbackModule);
//# sourceMappingURL=feedback.module.js.map