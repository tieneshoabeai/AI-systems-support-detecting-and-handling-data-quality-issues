/**
 * PUSH — Hợp đồng push notification (cross-cutting infrastructure).
 *
 * Vì sao nằm ở `shared/ports/`?
 * --------------------------------------------------------------
 * Push notification là hạ tầng dùng chung: `notifications` gửi push khi có
 * thông báo, `analysis` báo tiến độ phân tích, `auth` báo cảnh báo bảo mật.
 * Đặt hợp đồng ở `shared/ports/` để không phải import chéo module nghiệp vụ
 * (ràng buộc CA5/CA8) — cùng lý do với `email.port.ts` và `realtime.port.ts`.
 *
 * Hiện triển khai bằng `ntfy.sh` (HTTP push, không cần SDK), nhưng hợp đồng
 * không gắn với vendor — có thể thay bằng FCM/APNs mà không đổi tầng trên.
 *
 * Dependency Rule: domain (contract) ← application (consumer) ← infrastructure (adapter).
 */

/** Mức độ ưu tiên của push — ánh xạ sang `Priority` của ntfy. */
export const PUSH_PRIORITIES = ['min', 'low', 'default', 'high', 'max'] as const;

export type PushPriority = (typeof PUSH_PRIORITIES)[number];

export interface PushMessage {
  /** Tiêu đề ngắn hiển thị trên thiết bị. */
  title: string;
  /** Nội dung thông báo. */
  body: string;
  /** Mức ưu tiên (mặc định `default`). */
  priority?: PushPriority;
  /** Tag để gom nhóm thông báo cùng loại trên thiết bị. */
  tags?: string[];
  /** URL mở khi người dùng chạm vào thông báo. */
  click?: string;
  /** Email nhận thêm bản sao (ntfy hỗ trợ). */
  email?: string;
}

export const PUSH_SENDER_PORT = Symbol('PushSenderPort');

export interface PushSenderPort {
  /**
   * Có cấu hình đầy đủ để gửi push không.
   * Thiếu cấu hình (hoặc `NTFY_ENABLED=false`) → `false`, hệ thống bỏ qua push.
   */
  isConfigured(): boolean;
  /**
   * Gửi một push notification.
   *
   * @returns `true` nếu gửi thành công, `false` nếu thất bại.
   *          Không ném lỗi — push là kênh bổ sung, không được làm hỏng
   *          thao tác nghiệp vụ chính.
   */
  send(message: PushMessage): Promise<boolean>;
}
