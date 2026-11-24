/** NOTIFICATIONS — Module (Template Simple). */
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { NotificationSchema } from './notifications.schema';
import { NotificationsRepository } from './notifications.repository';
import { NOTIFICATION_REPOSITORY_PORT } from './notifications.types';
import { NotificationsController } from './notifications.routes';
import { NotificationsService } from './notifications.service';
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
  exports: [NotificationsRepository, NOTIFICATION_REPOSITORY_PORT],
})
export class NotificationsModule {}
