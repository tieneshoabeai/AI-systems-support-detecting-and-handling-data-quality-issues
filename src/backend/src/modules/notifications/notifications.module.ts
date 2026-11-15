import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { NotificationSchema } from './infrastructure/persistence/notification.schema';
import { NotificationsRepository } from './infrastructure/persistence/notifications.repository';
import { NOTIFICATION_REPOSITORY_PORT } from './domain/ports/notification.repository.port';
import { NotificationsService } from './application/notifications.service';
import { NotificationsController } from './infrastructure/http/notifications.controller';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: 'Notification', schema: NotificationSchema }]),
    UsersModule,
  ],
  controllers: [NotificationsController],
  providers: [
    NotificationsRepository,
    { provide: NOTIFICATION_REPOSITORY_PORT, useExisting: NotificationsRepository },
    NotificationsService,
  ],
  exports: [NotificationsService, NotificationsRepository, NOTIFICATION_REPOSITORY_PORT],
})
export class NotificationsModule {}
