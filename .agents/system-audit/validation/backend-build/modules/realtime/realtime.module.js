"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RealtimeModule = void 0;
const common_1 = require("@nestjs/common");
const jwt_1 = require("@nestjs/jwt");
const realtime_service_1 = require("./application/realtime.service");
const realtime_auth_service_1 = require("./application/realtime-auth.service");
const realtime_gateway_1 = require("./infrastructure/websocket/realtime.gateway");
const users_module_1 = require("../users/users.module");
const projects_module_1 = require("../projects/projects.module");
const workspaces_module_1 = require("../workspaces/workspaces.module");
const realtime_port_1 = require("./domain/ports/realtime.port");
let RealtimeModule = class RealtimeModule {
};
exports.RealtimeModule = RealtimeModule;
exports.RealtimeModule = RealtimeModule = __decorate([
    (0, common_1.Global)(),
    (0, common_1.Module)({
        imports: [jwt_1.JwtModule.register({}), users_module_1.UsersModule, projects_module_1.ProjectsModule, workspaces_module_1.WorkspacesModule],
        providers: [
            realtime_service_1.RealtimeService,
            { provide: realtime_port_1.REALTIME_PORT, useExisting: realtime_service_1.RealtimeService },
            realtime_auth_service_1.RealtimeAuthService,
            realtime_gateway_1.RealtimeGateway,
        ],
        exports: [realtime_service_1.RealtimeService, realtime_port_1.REALTIME_PORT],
    })
], RealtimeModule);
//# sourceMappingURL=realtime.module.js.map