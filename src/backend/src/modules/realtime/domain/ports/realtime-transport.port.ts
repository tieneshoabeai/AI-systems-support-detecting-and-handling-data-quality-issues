/**
 * REALTIME — Port (driven) cho tầng truyền tải.
 *
 * Lý do tồn tại: `application/` KHÔNG được biết tới `socket.io` (thư viện hạ tầng).
 * Application chỉ nói "đẩy envelope này tới room X"; adapter ở `infrastructure/`
 * lo phần gắn driver (Socket.IO server) và thực thi emit.
 *
 * Dependency Rule: domain (contract) ← application (consumer) ← infrastructure (adapter).
 *
 * Lưu ý CA11: `domain/` chỉ được import `shared/` ở tầng thuần
 * (`shared/domain/`) — vì vậy envelope được import từ
 * `shared/domain/utils/realtime-events.ts` chứ không phải `shared/application/ports/`.
 */
import type { RealtimeEnvelope } from '../../../../shared/domain/utils/realtime-events';

export const REALTIME_TRANSPORT_PORT = Symbol('RealtimeTransportPort');

export interface RealtimeTransportPort {
  /**
   * Đẩy envelope tới room.
   * @returns `true` nếu đã gửi, `false` nếu transport chưa sẵn sàng (chưa gắn driver).
   */
  emitToRoom(room: string, envelope: RealtimeEnvelope): boolean;

  /**
   * OPEN-08 — Đóng **hẳn** mọi socket của user (socket.io `disconnectSockets(true)`).
   *
   * Dùng khi tài khoản bị khoá / bị xoá ⇒ socket phải bị thu hồi ngay lập tức,
   * không chỉ "emit rồi để client tự đóng" (client có thể bỏ qua).
   *
   * @returns `true` nếu transport đã sẵn sàng và đã thực thi ngắt kết nối.
   */
  disconnectUser(userId: string): boolean;

  /**
   * Gắn driver (Socket.IO server) vào transport.
   *
   * Hợp đồng dùng `unknown` vì tầng Domain không được biết tới kiểu `Server`
   * của `socket.io` (thư viện hạ tầng). Adapter hiện thực với kiểu cụ thể
   * hơn (`attachServer(server: Server)`) — TypeScript chấp nhận contravariance
   * lỏng cho method, nên vẫn hiện thực được interface này.
   */
  attachServer(server: unknown): void;
}
