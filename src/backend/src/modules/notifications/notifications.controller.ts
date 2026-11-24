/** NOTIFICATIONS — Controller (Template Simple). Gop controller + 2 DTO inline. Giu nguyen thu tu route + guard. */
import { Controller, Get, Patch, Param, Query, Body, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../shared/interfaces/guards/jwt-auth.guard';
import {
  CurrentUser,
  CurrentUserPayload,
} from '../../shared/interfaces/decorators/current-user.decorator';
import { ZodValidationPipe } from '../../shared/interfaces/pipes/zod-validation.pipe';
import { ApiZodBody, ApiZodQuery } from '../../shared/interfaces/swagger/api-zod.decorator';
import { z } from 'zod';
import { NotificationsService } from './notifications.service';

// --- DTO gop tu presentation/dtos (Template Simple: DTO 1 noi trong controller) ---
export const ListNotificationsQuerySchema = z.object({
  cursor: z.string().min(1).max(2000).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  sortBy: z.enum(['createdAt']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
  read: z.enum(['true', 'false', 'all']).default('all'),
});

export type ListNotificationsQueryDto = z.infer<typeof ListNotificationsQuerySchema>;

export const UpdateNotificationPreferencesSchema = z.object({
  notificationsEnabled: z.boolean({ required_error: 'notificationsEnabled là bắt buộc' }),
});

export type UpdateNotificationPreferencesDto = z.infer<typeof UpdateNotificationPreferencesSchema>;

@ApiTags('Notifications')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller()
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get('notifications')
  @ApiOperation({ summary: 'NOTIF-01: Trung tâm thông báo của chính mình' })
  @ApiZodQuery(ListNotificationsQuerySchema)
  @ApiResponse({ status: 200, description: 'Thành công' })
  async listNotifications(
    @CurrentUser() user: CurrentUserPayload,
    @Query(new ZodValidationPipe(ListNotificationsQuerySchema)) query: ListNotificationsQueryDto,
  ): Promise<{ items: Record<string, unknown>[]; meta: { nextCursor: string | null; hasMore: boolean }; unreadCount: number; }> {
    return this.notificationsService.listForUser(user.userId, query);
  }

  @Get('notifications/unread-count')
  @ApiOperation({ summary: 'NOTIF-01: Số thông báo chưa đọc' })
  @ApiResponse({ status: 200, description: 'Thành công' })
  async getUnreadCount(@CurrentUser() user: CurrentUserPayload): Promise<{ unreadCount: number; }> {
    return this.notificationsService.countUnread(user.userId);
  }

  @Get('notifications/:id')
  @ApiOperation({ summary: 'NOTIF-02: Chi tiết thông báo (mở là đánh dấu đã đọc)' })
  @ApiResponse({ status: 200, description: 'Thành công' })
  async getDetail(@CurrentUser() user: CurrentUserPayload, @Param('id') id: string): Promise<Record<string, unknown>> {
    return this.notificationsService.getDetail(user.userId, id);
  }

  @Patch('notifications/:id/read')
  @ApiOperation({ summary: 'NOTIF-02: Đánh dấu đã đọc' })
  @ApiResponse({ status: 200, description: 'Thành công' })
  async markAsRead(@CurrentUser() user: CurrentUserPayload, @Param('id') id: string): Promise<Record<string, unknown>> {
    return this.notificationsService.markAsRead(user.userId, id);
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
    return this.notificationsService.updatePreferences(user.userId, dto.notificationsEnabled);
  }
}
