import { z } from 'zod';
import { EmailSchema, PasswordSchema } from '../../../../shared/domain/validation/common-schemas';

export const RegisterSchema = z
  .object({
    email: EmailSchema,
    password: PasswordSchema,
    first_name: z
      .string()
      .min(1, 'Họ không được để trống')
      .max(50, 'Họ không được vượt quá 50 ký tự')
      .trim(),
    last_name: z
      .string()
      .min(1, 'Tên không được để trống')
      .max(50, 'Tên không được vượt quá 50 ký tự')
      .trim(),
    /**
     * OPEN-01 — **không có trường `role`**.
     *
     * Mọi tài khoản tự đăng ký qua API công khai đều là `analyst`. Tài khoản
     * `admin` chỉ được tạo bởi **admin bootstrap** khi khởi động ứng dụng
     * (`ADMIN_EMAIL` + `ADMIN_PASSWORD` trong biến môi trường).
     *
     * Gửi `role` trong body → bị từ chối (`400`) nhờ `.strict()`.
     */
  })
  /** Từ chối mọi trường lạ (nhất là `role`) thay vì âm thầm bỏ qua. */
  .strict();

export type RegisterDto = z.infer<typeof RegisterSchema>;
