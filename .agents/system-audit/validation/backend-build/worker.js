"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require("reflect-metadata");
const core_1 = require("@nestjs/core");
const config_1 = require("@nestjs/config");
const app_module_1 = require("./app.module");
const outbox_relay_service_1 = require("./shared/application/outbox/outbox-relay.service");
async function bootstrap() {
    const app = await core_1.NestFactory.createApplicationContext(app_module_1.AppModule, { logger: ['log', 'error', 'warn'] });
    const cfg = app.get(config_1.ConfigService);
    const mode = cfg.get('WORKER_MODE') ?? 'all';
    console.log(`[worker] mode=${mode} khoi dong background jobs (outbox relay 30s + AI/report workers theo event)`);
    app.get(outbox_relay_service_1.OutboxRelayService);
    const shutdown = async () => { await app.close(); process.exit(0); };
    process.on('SIGTERM', () => { void shutdown(); });
    process.on('SIGINT', () => { void shutdown(); });
}
void bootstrap();
//# sourceMappingURL=worker.js.map