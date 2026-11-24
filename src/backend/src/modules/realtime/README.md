# Module `realtime` — WebSocket Socket.IO

Đẩy sự kiện thời gian thực tới frontend: tiến độ analysis, thông báo mới, thu hồi phiên. Không có REST controller, chỉ có gateway WebSocket + service + transport. 8 tệp + index.

## 1. Vị trí và vai trò

- Đường dẫn: `src/backend/src/modules/realtime/`
- Loại kiến trúc: gateway + service (không CQRS, không REST).
- Hợp đồng chuẩn nằm ở `shared/application/ports/realtime.port.ts` (`REALTIME_PORT`); module này chỉ hiện thực và re-export để tránh `shared` import từ `modules` (CA5).
- Dùng bởi: `analysis` (tiến độ job), `notifications` (tin mới), `users/auth` (thu hồi phiên).

## 2. Từng tệp làm gì (9 tệp)

| Tệp | Vai trò chi tiết |
|---|---|
| `realtime.gateway.ts` | `@WebSocketGateway({ cors })`, 4 message: `joinProject/leaveProject` (phòng `project:{id}`), `joinAnalysis/leaveAnalysis` (phòng `analysis:{id}`). Kiểm tra JWT từ handshake, kiểm tra quyền phòng bằng `PROJECT_ACCESS_PORT`. |
| `realtime.service.ts` | API nội bộ `emitToProject/emitToUser/emitToWorkspace`: gọi `REALTIME_PORT.emit`, kiểm tra `assertNoSensitiveData` trước khi đẩy. |
| `realtime-auth.service.ts` | Xác thực socket: giải access token, tra `user_sessions`, từ chối nếu hết hạn/bị thu hồi. |
| `realtime-revocation.subscriber.ts` | Lắng nghe event thu hồi phiên -> đẩy `session.revoked` để client tự ngắt. |
| `realtime.transport.ts` | `REALTIME_TRANSPORT_PORT` (trừu tượng transport thấp). |
| `socket-io-realtime.transport.ts` | Hiện thực `REALTIME_PORT` bằng Socket.IO: `emit/broadcast`, phòng `workspace:{id}/project:{id}/user:{id}`. |
| `realtime.module.ts` | Khai báo gateway/service/subscriber, bind `REALTIME_PORT` -> transport. Dùng Redis adapter (`redis-io.adapter`) khi đa tiến trình, không thì `IoAdapter` bộ nhớ. |
| `index.ts` | Re-export `REALTIME_PORT`, `buildEnvelope`, `RealtimeRooms`, transport port. |

## 3. Kênh và sự kiện (`shared/domain/utils/realtime-events.ts`)

- Phòng: `workspace:{id}`, `project:{id}`, `analysis:{id}`, `user:{id}`.
- Sự kiện: `analysis.progress`, `analysis.done`, `notification.created`, `session.revoked`.
- Envelope: `{ event, room, data, at }`, `assertNoSensitiveData` chặn `passwordHash/token/raw PII`.

## 4. Bất biến

- `EventDispatcherService` lỗi không phá vỡ nghiệp vụ (log rồi nuốt).
- Socket không tin client: mọi join phòng đều xác thực lại quyền server-side.
- `SOCKET_ENABLED=false` thì module vẫn nạp nhưng gateway không mở cổng.

## 5. Test liên quan

`test/unit/realtime/` (3 tệp: rooms, envelope, auth), `test/unit/infra/event-dispatcher.spec.ts`, `test/unit/infra/group1-infra.spec.ts`.
