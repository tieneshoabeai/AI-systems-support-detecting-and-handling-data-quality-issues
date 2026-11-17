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
var OutboxRelayService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.OutboxRelayService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const outbox_service_1 = require("./outbox.service");
const event_publisher_port_1 = require("../../ports/event-publisher.port");
let OutboxRelayService = OutboxRelayService_1 = class OutboxRelayService {
    outbox;
    config;
    publisher;
    logger = new common_1.Logger(OutboxRelayService_1.name);
    timer = null;
    busy = false;
    constructor(outbox, config, publisher) {
        this.outbox = outbox;
        this.config = config;
        this.publisher = publisher;
    }
    onModuleInit() {
        const mode = (this.config.get('WORKER_MODE') ?? 'all').toLowerCase();
        if (mode === 'api') {
            this.logger.log('Outbox relay tat trong API process (WORKER_MODE=api) - worker rieng dam nhan');
            return;
        }
        const enabled = (this.config.get('OUTBOX_RELAY_ENABLED') ?? 'true') !== 'false';
        if (!enabled) {
            this.logger.log('Outbox relay tat (OUTBOX_RELAY_ENABLED=false)');
            return;
        }
        this.timer = setInterval(() => { void this.tick().catch((e) => this.logger.error(`relay loi: ${e instanceof Error ? e.message : String(e)}`)); }, 30000);
        const t = this.timer;
        if (typeof t.unref === 'function' && this.config.get('NODE_ENV') === 'test')
            t.unref();
        void this.tick().catch(() => undefined);
    }
    async tick() {
        if (this.busy)
            return 0;
        this.busy = true;
        try {
            await this.outbox.reclaimStuckPublishing().catch(() => 0);
            const claimed = await this.outbox.claimForPublish(50);
            let ok = 0;
            for (const doc of claimed) {
                const raw = doc;
                const id = String(raw._id.toString());
                try {
                    if (this.publisher) {
                        await this.publisher.publish({
                            eventId: id,
                            eventType: String(raw.event_type ?? ''),
                            aggregateType: String(raw.aggregate_type ?? ''),
                            aggregateId: String(raw.aggregate_id ?? ''),
                            payload: raw.payload ?? {},
                            workspaceId: raw.workspace_id ?? null,
                            projectId: raw.project_id ?? null,
                            actorId: raw.actor_id ?? null,
                            occurredAt: new Date().toISOString(),
                        });
                    }
                    await this.outbox.markAsPublished(id);
                    ok++;
                }
                catch (err) {
                    await this.outbox.markAsFailed(id, err instanceof Error ? err.message : String(err)).catch(() => undefined);
                }
            }
            if (ok > 0)
                this.logger.log(`Outbox relay publish ${ok} events`);
            return ok;
        }
        finally {
            this.busy = false;
        }
    }
};
exports.OutboxRelayService = OutboxRelayService;
exports.OutboxRelayService = OutboxRelayService = OutboxRelayService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(2, (0, common_1.Optional)()),
    __param(2, (0, common_1.Inject)(event_publisher_port_1.EVENT_PUBLISHER_PORT)),
    __metadata("design:paramtypes", [outbox_service_1.OutboxService, config_1.ConfigService, Object])
], OutboxRelayService);
//# sourceMappingURL=outbox-relay.service.js.map