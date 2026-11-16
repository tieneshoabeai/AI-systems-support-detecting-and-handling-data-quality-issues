import { z } from 'zod';

export const TransferOwnerSchema = z.object({
  email: z.string().trim().email('Định dạng email không hợp lệ'),
  expectedVersion: z.number().int().min(1, 'expectedVersion là bắt buộc'),
});

export type TransferOwnerDto = z.infer<typeof TransferOwnerSchema>;
