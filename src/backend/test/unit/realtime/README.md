# `test/unit/realtime/` — 3 file: WebSocket

| File | Các `describe` thật trong code |
|---|---|
| `realtime.spec.ts` | `REALTIME-01: envelope + room + no-sensitive-data` (phòng `workspace:{id}/project:{id}/user:{id}`, không lọt dữ liệu nhạy cảm) |
| `realtime-gateway.spec.ts` | `B2.9 — RealtimeGateway (Socket.IO)` (handshake JWT, join phòng theo quyền) |
| `realtime-revocation.spec.ts` | `UserAccessRevocationService phát event thu hồi` ; `RealtimeRevocationSubscriber đóng socket khi nhận event` ; `RealtimeService.disconnectUser` ; `handler khoá / xoá tài khoản gọi thu hồi realtime` (4 describe, OPEN-08) |

Hạ tầng thật (Redis adapter multi-instance) nằm ở `infra/group1-infra.spec.ts`.

Chạy: `npx jest test/unit/realtime --no-coverage`.
