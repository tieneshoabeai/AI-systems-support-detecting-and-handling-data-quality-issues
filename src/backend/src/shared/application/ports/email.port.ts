/**
 * EMAIL — Hợp đồng gửi email (cross-cutting infrastructure).
 *
 * Vì sao nằm ở `shared/ports/`?
 * --------------------------------------------------------------
 * Gửi email là hạ tầng dùng chung cho nhiều module nghiệp vụ:
 *   - `auth`         → OTP quên mật khẩu (AUTH-05), cảnh báo bảo mật
 *   - `workspaces`   → lời mời thành viên (WS-07)
 *   - `notifications`→ thông báo báo cáo, kết quả phân tích
 *
 * Nếu đặt hợp đồng trong một module nghiệp vụ, các module còn lại sẽ phải
 * import chéo từ `modules/` — vi phạm quy tắc CA8 ("cross-module import phải
 * đi qua public contract") và ràng buộc kiến trúc của Phần 9 v3 §3.2
 * ("Adapter nằm ở `infrastructure/` của module sở hữu, hoặc ở
 * `shared/infrastructure/` nếu là hạ tầng dùng chung").
 *
 * Vì vậy hợp đồng đặt cùng cấp với `storage.port.ts`, `realtime.port.ts`,
 * `outbox.port.ts` — những port hạ tầng dùng chung đã có sẵn.
 *
 * Dependency Rule: domain (contract) ← application (consumer) ← infrastructure (adapter).
 *
 * Ràng buộc nghiệp vụ (Phần 9 v3 §3.5.5):
 *   1. Email KHÔNG chứa liên kết tới file dữ liệu hay PDF — chỉ liên kết tới trang web.
 *   2. KHÔNG log nội dung email.
 *   3. Lỗi gửi email KHÔNG làm fail thao tác chính — log cảnh báo, retry tối đa 3 lần.
 *   4. Email bắt buộc gửi BẤT KỂ công tắc `notifications_enabled`.
 */

/** Loại email gửi đi — dùng để adapter chọn template & để test xác định ý định. */
export const EMAIL_TEMPLATES = [
  /** AUTH-05 — OTP quên mật khẩu (mã 6 số, hạn 10 phút). */
  'password_reset_otp',
  /** WS-07 — lời mời thành viên vào workspace. */
  'workspace_invitation',
  /** Thông báo báo cáo cần bổ sung thông tin. */
  'issue_needs_info',
  /** Báo cáo sự cố đã được xử lý. */
  'issue_resolved',
  /** Kết quả phân tích hoàn tất. */
  'analysis_completed',
  /** Phân tích thất bại. */
  'analysis_failed',
  /** Báo cáo PDF đã sẵn sàng. */
  'report_ready',
  /** Cảnh báo bảo mật (đổi mật khẩu, tái sử dụng refresh token). */
  'security_alert',
  /** Thông báo chung (project được tạo/xoá, thêm thành viên). */
  'generic',
] as const;

export type EmailTemplate = (typeof EMAIL_TEMPLATES)[number];

/** Dữ liệu gửi kèm email — mọi trường đều tuỳ chọn trừ `to`. */
export interface EmailMessage {
  /** Địa chỉ người nhận. */
  to: string;
  /** Loại email → adapter chọn template tương ứng. */
  template: EmailTemplate;
  /** Tiêu đề hiển thị. */
  subject: string;
  /** Nội dung dạng HTML (đã escape sẵn ở tầng gọi). */
  html?: string;
  /** Nội dung dạng text thuần (fallback khi client không đọc HTML). */
  text?: string;
  /**
   * Dữ liệu động cho template (VD: `{ otp: '123456', expiresInMinutes: 10 }`).
   * Dùng để adapter tự dựng nội dung nếu `html`/`text` không được truyền.
   */
  vars?: Record<string, string | number>;
  /** Bản chữ ký/footer tuỳ chọn. */
  replyTo?: string;
}

export const EMAIL_SENDER_PORT = Symbol('EmailSenderPort');

export interface EmailSenderPort {
  /**
   * Có cấu hình đầy đủ để gửi email không.
   * Thiếu cấu hình → adapter trả `false` và hệ thống chỉ log cảnh báo (không crash).
   */
  isConfigured(): boolean;
  /**
   * Gửi một email.
   *
   * @returns `true` nếu gửi thành công, `false` nếu thất bại (thiếu cấu hình hoặc lỗi SMTP).
   *          Hàm này **không ném lỗi** — lỗi gửi email không được làm hỏng
   *          thao tác nghiệp vụ chính (Phần 9 v3 §3.5.5 quy tắc 3).
   */
  send(message: EmailMessage): Promise<boolean>;
}
