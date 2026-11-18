"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.WorkspacesModule = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const workspace_schema_1 = require("./infrastructure/persistence/workspace.schema");
const workspaces_repository_1 = require("./infrastructure/persistence/workspaces.repository");
const workspace_repository_port_1 = require("./domain/ports/workspace.repository.port");
const workspaces_service_1 = require("./application/workspaces.service");
const workspaces_controller_1 = require("./infrastructure/http/workspaces.controller");
const users_module_1 = require("../users/users.module");
let WorkspacesModule = class WorkspacesModule {
};
exports.WorkspacesModule = WorkspacesModule;
exports.WorkspacesModule = WorkspacesModule = __decorate([
    (0, common_1.Module)({
        imports: [mongoose_1.MongooseModule.forFeature([{ name: 'Workspace', schema: workspace_schema_1.WorkspaceSchema }]), users_module_1.UsersModule],
        controllers: [workspaces_controller_1.WorkspacesController],
        providers: [workspaces_repository_1.WorkspacesRepository, { provide: workspace_repository_port_1.WORKSPACE_REPOSITORY_PORT, useExisting: workspaces_repository_1.WorkspacesRepository }, workspaces_service_1.WorkspacesService],
        exports: [workspaces_repository_1.WorkspacesRepository, workspace_repository_port_1.WORKSPACE_REPOSITORY_PORT, workspaces_service_1.WorkspacesService],
    })
], WorkspacesModule);
//# sourceMappingURL=workspaces.module.js.map