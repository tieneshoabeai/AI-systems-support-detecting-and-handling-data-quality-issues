import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { validate } from './shared/infrastructure/config/env.validation';
import { SharedModule } from './shared/shared.module';
import { DatabaseModule } from './shared/infrastructure/database/database.module';
import { StorageModule } from './shared/infrastructure/storage/storage.module';
import { UsersModule } from './modules/users/users.module';
import { AuthModule } from './modules/auth/auth.module';
import { WorkspacesModule } from './modules/workspaces/workspaces.module';
import { ProjectsModule } from './modules/projects/projects.module';
import { DatasetsModule } from './modules/datasets/datasets.module';
import { DataViewModule } from './modules/data-view/data-view.module';
import { AnalysisModule } from './modules/analysis/analysis.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { IssuesModule } from './modules/issues/issues.module';
import { FeedbackModule } from './modules/feedback/feedback.module';
import { RealtimeModule } from './modules/realtime/realtime.module';
import { AuditModule } from './modules/audit/audit.module';
import { OverviewModule } from './modules/overview/overview.module';
import { OutboxModule } from './shared/infrastructure/outbox/outbox.module';
import { EventsModule } from './shared/infrastructure/events/events.module';
import { AppController } from './app.controller';
import { RequestIdMiddleware } from './shared/interfaces/middleware/request-id.middleware';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate,
      envFilePath: ['.env', 'src/backend/.env'],
    }),
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService): { name: string; ttl: number; limit: number }[] => [
        {
          // Mặc định rộng rãi 200 req/phút; các endpoint nhạy cảm override xuống 5–10 req/giờ (AUTH-13).
          // Nới được qua env (THROTTLE_DEFAULT_LIMIT / _TTL_MS) để môi trường đo tải (k6)
          // không bị throttle làm sai lệch p95 — mặc định giữ nguyên giá trị production.
          name: 'default',
          ttl: config.get<number>('THROTTLE_DEFAULT_TTL_MS', 60_000),
          limit: config.get<number>('THROTTLE_DEFAULT_LIMIT', 200),
        },
      ],
    }),
    SharedModule,
    DatabaseModule,
    OutboxModule,
    EventsModule,
    StorageModule,
    UsersModule,
    AuthModule,
    WorkspacesModule,
    ProjectsModule,
    DatasetsModule,
    DataViewModule,
    AnalysisModule,
    NotificationsModule,
    IssuesModule,
    FeedbackModule,
    RealtimeModule,
    AuditModule,
    OverviewModule,
  ],
  controllers: [AppController],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule implements NestModule {
  /**
   * Gắn X-Request-Id cho mọi request (có thể nhận sẵn từ header `x-request-id`
   * để trace xuyên qua Cloudflare Tunnel / gateway).
   */
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestIdMiddleware).forRoutes('*');
  }
}
