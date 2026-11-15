import { z } from 'zod';

export const AddMemberSchema = z.object({
  email: z
    .string()
    .trim()
    .email('Định dạng email thành viên không hợp lệ'),
  role: z.enum(['owner', 'member'], {
    errorMap: () => ({ message: 'Vai trò workspace phải là owner hoặc member' }),
  }).default('member'),
});

export type AddMemberDto = z.infer<typeof AddMemberSchema>;
