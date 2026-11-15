import { z } from 'zod';

export const AddProjectMemberSchema = z.object({
  email: z.string().trim().email('Định dạng email không hợp lệ'),
  role: z.enum(['member', 'viewer'], {
    errorMap: () => ({ message: 'Vai trò project phải là member hoặc viewer' }),
  }).default('viewer'),
});

export type AddProjectMemberDto = z.infer<typeof AddProjectMemberSchema>;

export const UpdateProjectMemberSchema = z.object({
  role: z.enum(['member', 'viewer'], {
    errorMap: () => ({ message: 'Vai trò project phải là member hoặc viewer' }),
  }),
  expectedVersion: z.number().int().min(1, 'expectedVersion là bắt buộc'),
});

export type UpdateProjectMemberDto = z.infer<typeof UpdateProjectMemberSchema>;

export const TransferProjectOwnerSchema = z.object({
  email: z.string().trim().email('Định dạng email không hợp lệ'),
  expectedVersion: z.number().int().min(1, 'expectedVersion là bắt buộc'),
});

export type TransferProjectOwnerDto = z.infer<typeof TransferProjectOwnerSchema>;

export const MarkCompletedSchema = z.object({
  expectedVersion: z.number().int().min(1, 'expectedVersion là bắt buộc'),
});

export type MarkCompletedDto = z.infer<typeof MarkCompletedSchema>;
