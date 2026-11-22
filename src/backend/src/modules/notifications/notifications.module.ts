import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { NotificationSchema } from './infrastructure/persistence/notification.schema';
import { NotificationsRepository } from './infrastructure/persistence/notifications.repository';
import { NOTIFICATION_REPOSITORY_PORT } from './domain/ports/notification.repository.port';
import { NotificationsController } from './presentation/controllers/notifications.controller';
import { UsersModule } from '../users/users.module';
import { CountUnreadHandler } from './application/queries/count-unread.handler';
import { DispatchHandler } from './application/commands/dispatch.handler';
import { GetDetailHandler } from './application/queries/get-detail.handler';
import { ListForUserHandler } from './application/queries/list-for-user.handler';
import { MarkAsReadHandler } from './application/commands/mark-as-read.handler';
import { UpdatePreferencesHandler } from './application/commands/update-preferences.handler';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: 'Notification', schema: NotificationSchema }]),
    UsersModule,
  ],
  controllers: [NotificationsController],
  providers: [
    NotificationsRepository,
    { provide: NOTIFICATION_REPOSITORY_PORT, useExisting: NotificationsRepository },
    DispatchHandler,
    GetDetailHandler,
    MarkAsReadHandler,
    UpdatePreferencesHandler,
    CountUnreadHandler,
    ListForUserHandler,
  ],
  exports: [NotificationsRepository, NOTIFICATION_REPOSITORY_PORT],
})
export class NotificationsModule {}
