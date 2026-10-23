import { z } from 'zod';

export const AddMemberSchema = z.object({
  email: z
    .string()
    .trim()
    .email('Định dạng email thành viên không hợp lệ'),
  role: z.enum(['owner', 'editor', 'viewer'], {
    errorMap: () => ({ message: 'Vai trò phải là owner, editor, hoặc viewer' }),
  }),
});

export type AddMemberDto = z.infer<typeof AddMemberSchema>;
