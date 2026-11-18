import { Controller, Get, Patch, Param, Query, Body, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../../shared/interfaces/guards/jwt-auth.guard';
import {
  CurrentUser,
  CurrentUserPayload,
} from '../../../../shared/interfaces/decorators/current-user.decorator';
import { ZodValidationPipe } from '../../../../shared/interfaces/pipes/zod-validation.pipe';
import { ApiZodBody, ApiZodQuery } from '../../../../shared/interfaces/swagger/api-zod.decorator';
import {
  ListNotificationsQuerySchema,
  ListNotificationsQueryDto,
} from '../dtos/list-notifications-query.dto';
import {
  UpdateNotificationPreferencesSchema,
  UpdateNotificationPreferencesDto,
} from '../dtos/update-preferences.dto';
import { CountUnreadHandler } from '../../application/queries/count-unread.handler';
import { GetDetailHandler } from '../../application/queries/get-detail.handler';
import { ListForUserHandler } from '../../application/queries/list-for-user.handler';
import { MarkAsReadHandler } from '../../application/commands/mark-as-read.handler';
import { UpdatePreferencesHandler } from '../../application/commands/update-preferences.handler';

@ApiTags('Notifications')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller()
export class NotificationsController {
  constructor(
    private readonly getDetailHandler: GetDetailHandler,
    private readonly markAsReadHandler: MarkAsReadHandler,
    private readonly updatePreferencesHandler: UpdatePreferencesHandler,
    private readonly countUnreadHandler: CountUnreadHandler,
    private readonly listForUserHandler: ListForUserHandler,
  ) {}

  @Get('notifications')
  @ApiOperation({ summary: 'NOTIF-01: Trung tâm thông báo của chính mình' })
  @ApiZodQuery(ListNotificationsQuerySchema)
  @ApiResponse({ status: 200, description: 'Thành công' })
  async listNotifications(
    @CurrentUser() user: CurrentUserPayload,
    @Query(new ZodValidationPipe(ListNotificationsQuerySchema)) query: ListNotificationsQueryDto,
  ): Promise<{ items: Record<string, unknown>[]; meta: { nextCursor: string | null; hasMore: boolean; }; unreadCount: number; }> {
    return this.listForUserHandler.execute(user.userId, query);
  }

  @Get('notifications/unread-count')
  @ApiOperation({ summary: 'NOTIF-01: Số thông báo chưa đọc' })
  @ApiResponse({ status: 200, description: 'Thành công' })
  async getUnreadCount(@CurrentUser() user: CurrentUserPayload): Promise<{ unreadCount: number; }> {
    return this.countUnreadHandler.execute(user.userId);
  }

  @Get('notifications/:id')
  @ApiOperation({ summary: 'NOTIF-02: Chi tiết thông báo (mở là đánh dấu đã đọc)' })
  @ApiResponse({ status: 200, description: 'Thành công' })
  async getDetail(@CurrentUser() user: CurrentUserPayload, @Param('id') id: string): Promise<Record<string, unknown>> {
    return this.getDetailHandler.execute(user.userId, id);
  }

  @Patch('notifications/:id/read')
  @ApiOperation({ summary: 'NOTIF-02: Đánh dấu đã đọc' })
  @ApiResponse({ status: 200, description: 'Thành công' })
  async markAsRead(@CurrentUser() user: CurrentUserPayload, @Param('id') id: string): Promise<Record<string, unknown>> {
    return this.markAsReadHandler.execute(user.userId, id);
  }

  @Patch('users/me/notification-preferences')
  @ApiOperation({ summary: 'NOTIF-03: Bật/tắt nhận thông báo' })
  @ApiZodBody(UpdateNotificationPreferencesSchema)
  @ApiResponse({ status: 200, description: 'Thành công' })
  async updatePreferences(
    @CurrentUser() user: CurrentUserPayload,
    @Body(new ZodValidationPipe(UpdateNotificationPreferencesSchema))
    dto: UpdateNotificationPreferencesDto,
  ): Promise<{ notificationsEnabled: boolean; }> {
    return this.updatePreferencesHandler.execute(user.userId, dto.notificationsEnabled);
  }
}
