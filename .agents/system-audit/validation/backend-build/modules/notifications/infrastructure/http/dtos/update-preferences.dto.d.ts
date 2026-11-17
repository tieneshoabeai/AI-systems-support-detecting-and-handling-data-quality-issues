import { z } from 'zod';
export declare const UpdateNotificationPreferencesSchema: z.ZodObject<{
    notificationsEnabled: z.ZodBoolean;
}, "strip", z.ZodTypeAny, {
    notificationsEnabled: boolean;
}, {
    notificationsEnabled: boolean;
}>;
export type UpdateNotificationPreferencesDto = z.infer<typeof UpdateNotificationPreferencesSchema>;
