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
var RealtimeGateway_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.RealtimeGateway = void 0;
const websockets_1 = require("@nestjs/websockets");
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const object_id_util_1 = require("../../../../shared/utils/object-id.util");
const socket_io_1 = require("socket.io");
const realtime_service_1 = require("../../application/realtime.service");
const realtime_auth_service_1 = require("../../application/realtime-auth.service");
const projects_service_1 = require("../../../projects/application/projects.service");
const workspaces_service_1 = require("../../../workspaces/application/workspaces.service");
const realtime_events_1 = require("../../domain/realtime-events");
let RealtimeGateway = RealtimeGateway_1 = class RealtimeGateway {
    realtime;
    auth;
    projectsService;
    workspacesService;
    config;
    logger = new common_1.Logger(RealtimeGateway_1.name);
    server;
    constructor(realtime, auth, projectsService, workspacesService, config) {
        this.realtime = realtime;
        this.auth = auth;
        this.projectsService = projectsService;
        this.workspacesService = workspacesService;
        this.config = config;
    }
    afterInit(server) {
        this.realtime.attachServer(server);
        this.logger.log('Realtime gateway sẵn sàng tại /api/v1/realtime');
    }
    socketEnabled() {
        const v = this.config.get('SOCKET_ENABLED');
        if (v === false || v === 'false' || v === '0')
            return false;
        return true;
    }
    async handleConnection(client) {
        if (!this.socketEnabled()) {
            client.emit('error', { code: 'SOCKET_DISABLED', message: 'Kênh realtime đang tắt (SOCKET_ENABLED=false)' });
            client.disconnect(true);
            return;
        }
        try {
            const token = this.auth.extractToken(client.handshake);
            if (!token)
                throw new Error('4401: thiếu access token (query ?token=)');
            const identity = await this.auth.verifyToken(token);
            client.data.identity = identity;
            await client.join(realtime_events_1.RealtimeRooms.user(identity.userId));
            client.emit('connected', { userId: identity.userId, rooms: [realtime_events_1.RealtimeRooms.user(identity.userId)] });
        }
        catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            const code = message.startsWith('4401') ? 4401 : 4401;
            try {
                client.emit('error', {
                    code,
                    message: message.replace(/^4401:\s*/, ''),
                });
            }
            catch {
            }
            client.disconnect(true);
        }
    }
    handleDisconnect(client) {
        const uid = client.data.identity?.userId ?? 'unknown';
        this.logger.debug(`Realtime client ngắt kết nối: ${uid}`);
    }
    requireIdentity(client) {
        const identity = client.data.identity;
        if (!identity) {
            client.emit('error', { code: 4401, message: 'Chưa xác thực phiên realtime' });
            return null;
        }
        return identity;
    }
    async resolveProjectRole(projectId, userId) {
        if (!(0, object_id_util_1.isObjectIdHex)(projectId))
            return { ok: false };
        try {
            const project = await this.projectsService.getProjectById(projectId);
            const workspaceId = project.workspaceId.toString();
            const workspaceRole = await this.workspacesService.resolveUserWorkspaceRole(workspaceId, userId);
            const projectRole = await this.projectsService.resolveUserProjectRole(projectId, userId, workspaceRole);
            if (!projectRole)
                return { ok: false };
            return { ok: true, workspaceId };
        }
        catch {
            return { ok: false };
        }
    }
    async handleJoinProject(client, payload) {
        const identity = this.requireIdentity(client);
        if (!identity)
            return { ok: false, error: 'UNAUTHENTICATED' };
        const projectId = (payload?.projectId ?? '').trim();
        if (!(0, object_id_util_1.isObjectIdHex)(projectId))
            return { ok: false, error: 'INVALID_PROJECT_ID' };
        const access = await this.resolveProjectRole(projectId, identity.userId);
        if (!access.ok)
            return { ok: false, error: 'FORBIDDEN' };
        await client.join(realtime_events_1.RealtimeRooms.project(projectId));
        return { ok: true, room: realtime_events_1.RealtimeRooms.project(projectId) };
    }
    async handleJoinAnalysis(client, payload) {
        const identity = this.requireIdentity(client);
        if (!identity)
            return { ok: false, error: 'UNAUTHENTICATED' };
        const analysisId = (payload?.analysisId ?? '').trim();
        const projectId = (payload?.projectId ?? '').trim();
        if (!(0, object_id_util_1.isObjectIdHex)(analysisId))
            return { ok: false, error: 'INVALID_ANALYSIS_ID' };
        if (!(0, object_id_util_1.isObjectIdHex)(projectId))
            return { ok: false, error: 'INVALID_PROJECT_ID' };
        const access = await this.resolveProjectRole(projectId, identity.userId);
        if (!access.ok)
            return { ok: false, error: 'FORBIDDEN' };
        await client.join(realtime_events_1.RealtimeRooms.analysis(analysisId));
        return { ok: true, room: realtime_events_1.RealtimeRooms.analysis(analysisId) };
    }
    async handleLeaveProject(client, payload) {
        const projectId = (payload?.projectId ?? '').trim();
        if ((0, object_id_util_1.isObjectIdHex)(projectId))
            await client.leave(realtime_events_1.RealtimeRooms.project(projectId));
        return { ok: true };
    }
    async handleLeaveAnalysis(client, payload) {
        const analysisId = (payload?.analysisId ?? '').trim();
        if ((0, object_id_util_1.isObjectIdHex)(analysisId))
            await client.leave(realtime_events_1.RealtimeRooms.analysis(analysisId));
        return { ok: true };
    }
};
exports.RealtimeGateway = RealtimeGateway;
__decorate([
    (0, websockets_1.WebSocketServer)(),
    __metadata("design:type", socket_io_1.Server)
], RealtimeGateway.prototype, "server", void 0);
__decorate([
    (0, websockets_1.SubscribeMessage)('joinProject'),
    __param(0, (0, websockets_1.ConnectedSocket)()),
    __param(1, (0, websockets_1.MessageBody)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], RealtimeGateway.prototype, "handleJoinProject", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('joinAnalysis'),
    __param(0, (0, websockets_1.ConnectedSocket)()),
    __param(1, (0, websockets_1.MessageBody)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], RealtimeGateway.prototype, "handleJoinAnalysis", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('leaveProject'),
    __param(0, (0, websockets_1.ConnectedSocket)()),
    __param(1, (0, websockets_1.MessageBody)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], RealtimeGateway.prototype, "handleLeaveProject", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('leaveAnalysis'),
    __param(0, (0, websockets_1.ConnectedSocket)()),
    __param(1, (0, websockets_1.MessageBody)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], RealtimeGateway.prototype, "handleLeaveAnalysis", null);
exports.RealtimeGateway = RealtimeGateway = RealtimeGateway_1 = __decorate([
    (0, websockets_1.WebSocketGateway)({
        path: '/api/v1/realtime',
        cors: { origin: true, credentials: true },
        transports: ['websocket', 'polling'],
        pingInterval: 25000,
        pingTimeout: 60000,
    }),
    __metadata("design:paramtypes", [realtime_service_1.RealtimeService, realtime_auth_service_1.RealtimeAuthService, projects_service_1.ProjectsService, workspaces_service_1.WorkspacesService, config_1.ConfigService])
], RealtimeGateway);
//# sourceMappingURL=realtime.gateway.js.map