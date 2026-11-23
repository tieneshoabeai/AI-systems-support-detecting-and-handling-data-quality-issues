import { Injectable, Logger } from '@nestjs/common';
import { Server } from 'socket.io';
import type { RealtimeEnvelope } from '../../shared/domain/utils/realtime-events';
import { RealtimeRooms } from '../../shared/domain/utils/realtime-events';
import type { RealtimeTransportPort } from './realtime.transport';

/**
 * REALTIME — Socket.IO transport adapter (infrastructure).
 *
 * Đây là nơi DUY NHẤT trong module realtime được phép biết tới `socket.io`.
 * `application/` chỉ gọi qua `RealtimeTransportPort`.
 */
@Injectable()
export class SocketIoRealtimeTransport implements RealtimeTransportPort {
  private readonly logger = new Logger(SocketIoRealtimeTransport.name);
  private server: Server | null = null;

  /** Gateway gọi 1 lần khi khởi tạo để gắn Socket.IO server. */
  attachServer(server: Server): void {
    this.server = server;
  }

  emitToRoom(room: string, envelope: RealtimeEnvelope): boolean {
    if (!this.server) return false;
    try {
      this.server.to(room).emit(envelope.event, envelope);
      return true;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Realtime emit thất bại (room=${room}): ${message}`);
      return false;
    }
  }

  /**
   * OPEN-08 — Ngắt **hẳn** mọi socket của user.
   *
   * `disconnectSockets(true)` đóng kết nối ở phía server (client không tự quyết
   * định giữ socket) — an toàn hơn `emit` rồi để client tự đóng.
   */
  disconnectUser(userId: string): boolean {
    if (!this.server) return false;
    try {
      this.server.in(RealtimeRooms.user(userId)).disconnectSockets(true);
      return true;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Realtime disconnect thất bại (user=${userId}): ${message}`);
      return false;
    }
  }
}
