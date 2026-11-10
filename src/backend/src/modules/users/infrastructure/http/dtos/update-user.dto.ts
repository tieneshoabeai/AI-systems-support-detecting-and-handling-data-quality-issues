import { z } from 'zod';

export const UpdateUserSchema = z.object({
  first_name: z.string().min(1).max(50).trim().optional(),
  last_name: z.string().min(1).max(50).trim().optional(),
  avatar_url: z.string().url('Avatar URL không hợp lệ').optional(),
});

export type UpdateUserDto = z.infer<typeof UpdateUserSchema>;
