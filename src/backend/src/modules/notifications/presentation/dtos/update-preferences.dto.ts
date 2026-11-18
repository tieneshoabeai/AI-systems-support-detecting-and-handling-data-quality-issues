import { z } from 'zod';

export const UpdateNotificationPreferencesSchema = z.object({
  notificationsEnabled: z.boolean({ required_error: 'notificationsEnabled là bắt buộc' }),
});

export type UpdateNotificationPreferencesDto = z.infer<typeof UpdateNotificationPreferencesSchema>;
