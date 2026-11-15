/**
 * REALTIME — Port (driven) cho tầng truyền tải.
 *
 * Lý do tồn tại: `application/` KHÔNG được biết tới `socket.io` (thư viện hạ tầng).
 * Application chỉ nói "đẩy envelope này tới room X"; adapter ở `infrastructure/`
 * lo phần gắn driver (Socket.IO server) và thực thi emit.
 *
 * Dependency Rule: domain (contract) ← application (consumer) ← infrastructure (adapter).
 */
import type { RealtimeEnvelope } from '../realtime-events';

export const REALTIME_TRANSPORT_PORT = Symbol('RealtimeTransportPort');

export interface RealtimeTransportPort {
  /**
   * Đẩy envelope tới room.
   * @returns `true` nếu đã gửi, `false` nếu transport chưa sẵn sàng (chưa gắn driver).
   */
  emitToRoom(room: string, envelope: RealtimeEnvelope): boolean;
}
