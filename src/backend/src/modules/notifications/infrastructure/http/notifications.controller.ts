import { Controller, Get, Patch, Param, Query, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../../shared/guards/jwt-auth.guard';
import { CurrentUser, CurrentUserPayload } from '../../../../shared/decorators/current-user.decorator';
import { ZodValidationPipe } from '../../../../shared/pipes/zod-validation.pipe';
import { ApiZodBody, ApiZodQuery } from '../../../../shared/swagger/api-zod.decorator';
import { NotificationsService } from '../../application/notifications.service';
import { ListNotificationsQuerySchema, ListNotificationsQueryDto } from './dtos/list-notifications-query.dto';
import { UpdateNotificationPreferencesSchema, UpdateNotificationPreferencesDto } from './dtos/update-preferences.dto';

@ApiTags('Notifications')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller()
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get('notifications')
  @ApiOperation({ summary: 'NOTIF-01: Trung tâm thông báo của chính mình' })
  @ApiZodQuery(ListNotificationsQuerySchema)
  async listNotifications(
    @CurrentUser() user: CurrentUserPayload,
    @Query(new ZodValidationPipe(ListNotificationsQuerySchema)) query: ListNotificationsQueryDto,
  ) {
    return this.notificationsService.listForUser(user.userId, query);
  }

  @Get('notifications/unread-count')
  @ApiOperation({ summary: 'NOTIF-01: Số thông báo chưa đọc' })
  async getUnreadCount(@CurrentUser() user: CurrentUserPayload) {
    return this.notificationsService.countUnread(user.userId);
  }

  @Get('notifications/:id')
  @ApiOperation({ summary: 'NOTIF-02: Chi tiết thông báo (mở là đánh dấu đã đọc)' })
  async getDetail(@CurrentUser() user: CurrentUserPayload, @Param('id') id: string) {
    return this.notificationsService.getDetail(user.userId, id);
  }

  @Patch('notifications/:id/read')
  @ApiOperation({ summary: 'NOTIF-02: Đánh dấu đã đọc' })
  async markAsRead(@CurrentUser() user: CurrentUserPayload, @Param('id') id: string) {
    return this.notificationsService.markAsRead(user.userId, id);
  }

  @Patch('users/me/notification-preferences')
  @ApiOperation({ summary: 'NOTIF-03: Bật/tắt nhận thông báo' })
  @ApiZodBody(UpdateNotificationPreferencesSchema)
  async updatePreferences(
    @CurrentUser() user: CurrentUserPayload,
    @Body(new ZodValidationPipe(UpdateNotificationPreferencesSchema)) dto: UpdateNotificationPreferencesDto,
  ) {
    return this.notificationsService.updatePreferences(user.userId, dto.notificationsEnabled);
  }
}
