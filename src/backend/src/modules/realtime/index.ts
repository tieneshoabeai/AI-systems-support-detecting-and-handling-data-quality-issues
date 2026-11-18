/**
 * Public contract của module REALTIME.
 *
 * Các module khác chỉ được import qua file này (quy tắc CA8 — cross-module
 * import phải đi qua public contract), không import sâu vào
 * `domain/ports/...` hay `application/...`.
 *
 * Lưu ý kiến trúc (CA5):
 * Hợp đồng push realtime là hạ tầng cross-cutting nên **bản chuẩn** nằm ở
 * `src/shared/application/ports/realtime.port.ts` — để `shared/infrastructure/events` (lớp cross-cutting)
 * không phải import từ `modules/` (vi phạm CA5).
 * Module `realtime` chỉ **implement** hợp đồng đó và re-export lại tại đây
 * để các module nghiệp vụ có một public contract ổn định.
 */

export {
  REALTIME_PORT,
  type RealtimeEnvelope,
  type RealtimeEventName,
  type RealtimeFields,
  type RealtimePort,
} from '../../shared/application/ports/realtime.port';

export {
  RealtimeRooms,
  assertNoSensitiveData,
  buildEnvelope,
} from '../../shared/domain/utils/realtime-events';

export {
  REALTIME_TRANSPORT_PORT,
  type RealtimeTransportPort,
} from './domain/ports/realtime-transport.port';
