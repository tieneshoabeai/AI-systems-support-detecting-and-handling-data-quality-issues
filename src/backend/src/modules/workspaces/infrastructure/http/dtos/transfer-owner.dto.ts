import { z } from 'zod';

export const TransferOwnerSchema = z.object({
  email: z.string().trim().email('Định dạng email không hợp lệ'),
});

export type TransferOwnerDto = z.infer<typeof TransferOwnerSchema>;
