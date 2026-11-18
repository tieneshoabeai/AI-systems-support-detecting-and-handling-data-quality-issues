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
var RealtimeService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.RealtimeService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const realtime_events_1 = require("../domain/realtime-events");
let RealtimeService = RealtimeService_1 = class RealtimeService {
    config;
    logger = new common_1.Logger(RealtimeService_1.name);
    server = null;
    constructor(config) {
        this.config = config;
    }
    attachServer(server) {
        this.server = server;
    }
    isEnabled() {
        try {
            const v = this.config?.get('SOCKET_ENABLED');
            if (v === false || v === 'false' || v === '0')
                return false;
            return true;
        }
        catch {
            return true;
        }
    }
    safeEmit(room, envelope) {
        try {
            (0, realtime_events_1.assertNoSensitiveData)(envelope);
        }
        catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            this.logger.error(`Realtime payload bị chặn (nhạy cảm): ${message}`);
            return;
        }
        if (!this.isEnabled())
            return;
        if (!this.server)
            return;
        try {
            this.server.to(room).emit(envelope.event, envelope);
        }
        catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            this.logger.warn(`Realtime emit thất bại (room=${room}): ${message}`);
        }
    }
    emitToUser(userId, event, fields) {
        const envelope = (0, realtime_events_1.buildEnvelope)(event, fields);
        this.safeEmit(realtime_events_1.RealtimeRooms.user(userId), envelope);
    }
    emitToProject(projectId, event, fields) {
        const envelope = (0, realtime_events_1.buildEnvelope)(event, { ...fields, projectId });
        this.safeEmit(realtime_events_1.RealtimeRooms.project(projectId), envelope);
    }
    emitToAnalysis(analysisId, event, fields) {
        const envelope = (0, realtime_events_1.buildEnvelope)(event, { ...fields, analysisId });
        this.safeEmit(realtime_events_1.RealtimeRooms.analysis(analysisId), envelope);
    }
    emitAnalysisLifecycle(projectId, analysisId, event, fields) {
        const forProject = (0, realtime_events_1.buildEnvelope)(event, { ...fields, projectId, analysisId });
        const forAnalysis = (0, realtime_events_1.buildEnvelope)(event, { ...fields, projectId, analysisId });
        this.safeEmit(realtime_events_1.RealtimeRooms.project(projectId), forProject);
        this.safeEmit(realtime_events_1.RealtimeRooms.analysis(analysisId), forAnalysis);
    }
};
exports.RealtimeService = RealtimeService;
exports.RealtimeService = RealtimeService = RealtimeService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Optional)()),
    __metadata("design:paramtypes", [config_1.ConfigService])
], RealtimeService);
//# sourceMappingURL=realtime.service.js.map