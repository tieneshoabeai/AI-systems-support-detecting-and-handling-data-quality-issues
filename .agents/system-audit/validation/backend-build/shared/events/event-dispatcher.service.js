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
var EventDispatcherService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.EventDispatcherService = void 0;
const common_1 = require("@nestjs/common");
const in_process_event_publisher_1 = require("./in-process-event.publisher");
const realtime_port_1 = require("../../modules/realtime/domain/ports/realtime.port");
const inbox_service_1 = require("../application/outbox/inbox.service");
let EventDispatcherService = EventDispatcherService_1 = class EventDispatcherService {
    inProcess;
    realtime;
    inbox;
    logger = new common_1.Logger(EventDispatcherService_1.name);
    constructor(inProcess, realtime, inbox) {
        this.inProcess = inProcess;
        this.realtime = realtime;
        this.inbox = inbox;
    }
    onModuleInit() {
        this.inProcess.onEvent((e) => { void this.handle(e).catch(() => undefined); });
    }
    async handle(envelope) {
        try {
            if (this.inbox) {
                const claim = await this.inbox.claim('event-dispatcher', envelope.eventId);
                if (claim !== 'claimed')
                    return;
            }
        }
        catch { }
        try {
            this.route(envelope);
            if (this.inbox)
                await this.inbox.complete('event-dispatcher', envelope.eventId).catch(() => undefined);
        }
        catch (err) {
            if (this.inbox)
                await this.inbox.fail('event-dispatcher', envelope.eventId).catch(() => undefined);
            const msg = err instanceof Error ? err.message : String(err);
            this.logger.warn(`dispatch loi event=${envelope.eventType}: ${msg}`);
        }
    }
    route(e) {
        if (!this.realtime)
            return;
        try {
            const p = (e.payload ?? {});
            const projectId = e.projectId ?? (typeof p.project_id === 'string' ? p.project_id : undefined);
            const analysisId = typeof p.analysis_id === 'string' ? p.analysis_id : (typeof p.analysisId === 'string' ? p.analysisId : undefined);
            switch (e.eventType) {
                case 'DATASET_INGESTED':
                    if (projectId)
                        this.realtime.emitToProject(projectId, 'ai.quality.updated', { projectId, status: 'dataset_ready' });
                    break;
                case 'ANALYSIS_STARTED':
                case 'ANALYSIS_PROGRESS':
                    if (projectId && analysisId)
                        this.realtime.emitAnalysisLifecycle(projectId, analysisId, 'analysis.progress', { status: 'running' });
                    else if (projectId)
                        this.realtime.emitToProject(projectId, 'analysis.progress', { status: 'running' });
                    break;
                case 'ANALYSIS_COMPLETED':
                    if (projectId && analysisId)
                        this.realtime.emitAnalysisLifecycle(projectId, analysisId, 'analysis.completed', { status: 'completed' });
                    else if (projectId)
                        this.realtime.emitToProject(projectId, 'analysis.completed', { status: 'completed' });
                    break;
                case 'ANALYSIS_FAILED':
                    if (projectId && analysisId)
                        this.realtime.emitAnalysisLifecycle(projectId, analysisId, 'analysis.failed', { status: 'failed' });
                    else if (projectId)
                        this.realtime.emitToProject(projectId, 'analysis.failed', { status: 'failed' });
                    break;
                case 'NOTIFICATION_CREATED': {
                    const uid = typeof p.user_id === 'string' ? p.user_id : (typeof p.userId === 'string' ? p.userId : undefined);
                    if (uid)
                        this.realtime.emitToUser(uid, 'notification.created', { status: 'created' });
                    break;
                }
                case 'FEEDBACK_CREATED':
                    if (projectId)
                        this.realtime.emitToProject(projectId, 'feedback.created', { projectId, status: 'created' });
                    break;
                case 'ISSUE_CREATED':
                case 'ISSUE_UPDATED':
                    if (projectId)
                        this.realtime.emitToProject(projectId, 'ai.quality.updated', { projectId, status: 'issue_changed' });
                    break;
                default:
                    if (projectId)
                        this.realtime.emitToProject(projectId, 'ai.quality.updated', { projectId, status: 'updated' });
                    break;
            }
        }
        catch { }
    }
};
exports.EventDispatcherService = EventDispatcherService;
exports.EventDispatcherService = EventDispatcherService = EventDispatcherService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(1, (0, common_1.Optional)()),
    __param(1, (0, common_1.Inject)(realtime_port_1.REALTIME_PORT)),
    __param(2, (0, common_1.Optional)()),
    __param(2, (0, common_1.Inject)(inbox_service_1.InboxService)),
    __metadata("design:paramtypes", [in_process_event_publisher_1.InProcessEventPublisher, Object, Function])
], EventDispatcherService);
//# sourceMappingURL=event-dispatcher.service.js.map