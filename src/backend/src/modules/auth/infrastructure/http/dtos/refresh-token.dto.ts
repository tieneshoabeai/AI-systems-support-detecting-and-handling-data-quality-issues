import { z } from 'zod';

export const RefreshTokenSchema = z.object({
  refresh_token: z.string().min(1, 'Refresh token không được để trống'),
});

export type RefreshTokenDto = z.infer<typeof RefreshTokenSchema>;
