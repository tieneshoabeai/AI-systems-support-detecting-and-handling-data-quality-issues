"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProjectsModule = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const project_schema_1 = require("./infrastructure/persistence/project.schema");
const projects_repository_1 = require("./infrastructure/persistence/projects.repository");
const project_repository_port_1 = require("./domain/ports/project.repository.port");
const projects_service_1 = require("./application/projects.service");
const projects_controller_1 = require("./infrastructure/http/projects.controller");
const workspaces_module_1 = require("../workspaces/workspaces.module");
const users_module_1 = require("../users/users.module");
let ProjectsModule = class ProjectsModule {
};
exports.ProjectsModule = ProjectsModule;
exports.ProjectsModule = ProjectsModule = __decorate([
    (0, common_1.Module)({
        imports: [
            mongoose_1.MongooseModule.forFeature([{ name: 'Project', schema: project_schema_1.ProjectSchema }]),
            workspaces_module_1.WorkspacesModule,
            users_module_1.UsersModule,
        ],
        controllers: [projects_controller_1.ProjectsController],
        providers: [projects_repository_1.ProjectsRepository, { provide: project_repository_port_1.PROJECT_REPOSITORY_PORT, useExisting: projects_repository_1.ProjectsRepository }, projects_service_1.ProjectsService],
        exports: [projects_repository_1.ProjectsRepository, project_repository_port_1.PROJECT_REPOSITORY_PORT, projects_service_1.ProjectsService],
    })
], ProjectsModule);
//# sourceMappingURL=projects.module.js.map