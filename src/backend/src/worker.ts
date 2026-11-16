import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';
import { OutboxRelayService } from './shared/application/outbox/outbox-relay.service';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['log', 'error', 'warn'] });
  const cfg = app.get(ConfigService);
  const mode = cfg.get<string>('WORKER_MODE') ?? 'all';
  // eslint-disable-next-line no-console
  console.log(`[worker] mode=${mode} khoi dong background jobs (outbox relay 30s + AI/report workers theo event)`);
  // OutboxRelayService tự chạy onModuleInit; giữ process sống
  app.get(OutboxRelayService);
  const shutdown = async () => { await app.close(); process.exit(0); };
  process.on('SIGTERM', () => { void shutdown(); });
  process.on('SIGINT', () => { void shutdown(); });
}
void bootstrap();
