# MODULE `realtime` - WebSocket realtime

> **Module Specification & Documentation**

## 1. Thong tin Phien ban (Version Information)

- **Current Version:** v1.1.0
- **Last Updated:** 2026-11-21
- **Module Path:** `src/backend/src/modules/realtime` (8 file TypeScript)
- **Architecture Layer:** Clean Architecture 4 tang (`domain` -> `application` -> `infrastructure` -> `presentation`)
- **Layer Rules:** CA1-CA14 - xem [`../README.md`](../README.md)

## 2. Muc dich & Pham vi Nghiep vu (Scope & Responsibility)

Module cung cap kenh truyen tin hai chieu (WebSocket) de day thong bao, tien do phan tich va trang thai AI job toi client ma khong can polling.

### 2.1. Tinh nang thuoc pham vi

| Chuc nang | Noi dung |
|---|---|
| Gateway | Xac thuc handshake bang access token |
| Phong (room) | Join / leave theo `user`, `project`, `analysis` |
| Day su kien | Emit envelope toi phong qua `RealtimeTransportPort` |
| Thu hoi | Dong hanh moi socket cua user khi bi khoa / xoa (OPEN-08) |

### 2.2. Cau truc thu muc

```text
realtime/
|-- domain/
|   |-- ports/realtime-transport.port.ts
|   `-- events/realtime.events.ts
|-- application/
|   |-- realtime.service.ts                # service phia application
|   `-- realtime-revocation.subscriber.ts  # bat USER_BLOCKED / USER_REMOVED
|-- infrastructure/websocket/
|   |-- socket-io-realtime.transport.ts     # hien thuc RealtimeTransportPort
|   |-- realtime.gateway.ts                # @WebSocketGateway
|   `-- realtime-auth.adapter.ts           # xac thuc handshake
`-- realtime.module.ts
```

## 3. Nhat ky Prompting & Quyet dinh Ky thuat (Prompting Log & Rationale)

- **User Prompt / Business Intent:** Day thong bao va tien do toi client ngay lap tuc thay vi client phai polling, dong thoi dam bao socket **tu dong bi thu hoi** khi tai khoan bi khoa hoac xoa.

- **Technical Reasoning & Decisions:**

1. **Tach port de application khong biet `socket.io`.** `application/` chi noi "day envelope nay toi phong X"; adapter lo phan gan driver va thuc thi `emit`. `domain` khong duoc import thu vien ha tang.

2. **`attachServer(server: unknown)`.** Tang Domain khong duoc biet kieu `Server` cua `socket.io`. Adapter hien thuc voi kieu cu the hon (`attachServer(server: Server)`) - TypeScript chap nhan contravariance long cho method, nen van hien thuc duoc interface nay.

3. **Hop thuc xac thuc bang access token trong query.** `?token=<access_token>` - de client khong can goi header trong WebSocket handshake. Token duoc xac thuc bang `JwtAuthGuard` cua module `auth`.

4. **Tu dong join phong `user:${userId}`.** Sau khi xac thuc, socket tu dong vao phong rieng. Cac phong `project:*` va `analysis:*` phai **join thu cong** qua event `join`, va viec join phong project **duoc kiem tra quyen** - nguoi dung khong the nghe su kien cua project minh khong co quyen.

5. **Quy tac noi dung: chi id + trang thai + so lieu tong hop.** Tuyet doi khong day gia tri o loi, noi dung nhan xet, email hay PII qua WebSocket.

6. **Thu hoi = `disconnectSockets(true)`, khong phai "emit roi de client tu dong".** Client co the bo qua su kien. `disconnectUser(userId)` dong **hanh** moi socket cua user. Day la ly do `USER_BLOCKED` / `USER_REMOVED` duoc dinh nghia o `shared/domain/utils/realtime-events.ts` chu khong phai trong module nay.

7. **Hop dong nam o `shared/domain/utils/`.** `shared/infrastructure/events/event-dispatcher.service.ts` can dung no nhung `shared/` khong duoc import tu `modules/` (CA5); `modules/realtime/domain/` chi duoc import `shared/` o thu muc thuan (CA11). `shared/domain/utils/` la noi duy nhat thoa ca hai.

- **Generated / Modified Artifacts:**

- `domain/ports/realtime-transport.port.ts` - `REALTIME_TRANSPORT_PORT`: `emitToRoom`, `disconnectUser`, `attachServer`.
- `infrastructure/websocket/socket-io-realtime.transport.ts` - hien thuc port, `disconnectSockets(true)`.
- `presentation/gateways/realtime.gateway.ts` - `@WebSocketGateway`, xac thuc handshake, join phong co kiem tra quyen.
- `application/realtime-revocation.subscriber.ts` - bat `USER_BLOCKED` / `USER_REMOVED` va goi `disconnectUser`.

## 4. Dac ta Giao tiep Ky thuat (Technical Contracts & API Specifications)

### 4.1. Endpoints

> Module nay khong phai REST. Ket noi WebSocket:

| Thong so | Gia tri |
|---|---|
| **Duong dan** | `ws://<host>/api/v1/realtime?token=<access_token>` |
| **Protocol** | Socket.IO (fallback sang WebSocket thuan) |
| **Xac thuc** | Access token trong query string |

**Phong (room):**

| Phong | Noi dung |
|---|---|
| `user:${userId}` | Thong bao ca nhan, tien do cua toi - tu dong join sau khi xac thuc |
| `project:${projectId}` | Su kien cua project - join thu cong, co kiem tra quyen |
| `analysis:${analysisId}` | Tien do phan tich - join thu cong, co kiem tra quyen |

### 4.2. Interfaces / Providers duoc export ra ngoai

`src/backend/src/modules/realtime/index.ts` export public contract:

| Export | Vai tro |
|---|---|
| `RealtimeModule` | Nest module |
| `REALTIME_TRANSPORT_PORT` | Port day su kien toi phong |

### 4.3. Su kien domain phat ra

| Su kien realtime | Muc dich |
|---|---|
| `notification.created` | Thong bao moi |
| `ai.quality.updated` | Chi so chat luong AI thay doi |
| `analysis.progress` | Tien do phan tich |
| `analysis.completed` | Phan tich xong |
| `analysis.failed` | Phan tich that bai |
| `ai.job.status` | Trang thai job AI |
| `feedback.created` | Co phan hoi moi |

| Su kien thu hoi | Muc dich |
|---|---|
| `USER_BLOCKED` | Dong socket cua user bi khoa |
| `USER_REMOVED` | Dong socket cua user bi xoa mem |

## 5. Rang buoc & Tieu chuan Bat bien (Invariants & Security Rules)

### 5.1. Bat bien nghiep vu

| Noi dung | Bat buoc |
|---|---|
| Gia tri o loi | **Khong** duoc day |
| Noi dung nhan xet | **Khong** duoc day |
| Email / PII | **Khong** duoc day |
| Id + trang thai + so lieu tong hop | Duoc phep |
| Payload su kien | Luon co `event`, `payload`, `timestamp` |

- Socket **phai** duoc xac thuc truoc khi join phong nao.
- Join phong `project:*` / `analysis:*` **phai** duoc kiem tra quyen.
- Socket cua user bi khoa / xoa **phai** bi dong, khong phai chi nhan su kien.
- Loi realtime **khong** duoc lam hong luong nghiep vu chinh.

### 5.2. Xoa mem (Soft Delete)

- **Chuan:** `deleted_at: Date | null` - truong nay **null** nghia la ban ghi dang hoat dong.
- **Quy tac truy van:** moi truy van mac dinh luon loc `deleted_at: null`. Repository base (`shared/infrastructure/database/base-mongo.repository.ts`) ap dung dieu nay tu dong.
- **Choi index Partial Unique:** `partialFilterExpression: { deleted_at: null }` - cho phep tai khoan / ten / email da xoa mem duoc tao lai.

### 5.3. Bao mat

| Van de | Cach xu ly |
|---|---|
| Truy cap socket khong xac thuc | Handshake trai qua `JwtAuthGuard` |
| Nghe su kien project nguoi khac | Kiem tra quyen khi join phong |
| Socket con song sau khi khoa tai khoan | `disconnectUser` -> `disconnectSockets(true)` |
| Rò PII qua WebSocket | Quy tac noi dung: chi id + trang thai + so lieu tong hop |
| Token bi lo qua log | Token trong query string - can co che che trong access log |
| Event gia mao tu client | Client **chi** duoc join phong; khong co API emit tu client |

### 5.4. Phan quyen

| Hanh dong | Chinh sach |
|---|---|
| Ket noi socket | Access token hop le |
| Join `user:${userId}` | Tu dong - theo `userId` trong token |
| Join `project:${projectId}` | Kiem tra quyen project |
| Join `analysis:${analysisId}` | Kiem tra quyen project chua analysis |

## 6. Lich su Thay doi (Change Log & Version History)

### 2026-11-21
- **v1.1.0** / 2026-11-21 / Viet lai README module day du theo chuan 6 phan / Yeu cau tai doc / Tai lieu mau chuan

### 2026-11-XX
- **v1.0.0** / 2026-11-XX / Bo sung `realtime-revocation.subscriber.ts` va `disconnectUser` (OPEN-08) / Dong socket tuc thoi khi khoa / xoa tai khoan / `modules/realtime`, `modules/users`
- **v0.8.0** / 2026-11-XX / Bo sung kiem tra quyen khi join phong project / Chan nghe su kien cua project nguoi khac / `modules/realtime`
- **v0.5.0** / 2026-11-XX / Chuyen danh muc phong va envelope sang `shared/domain/utils/realtime-events.ts` / Giai quyet vong tròn rang buoc CA5 + CA11 / `shared/domain/utils`, `modules/realtime`
- **v0.1.0** / 2026-11-XX / Tao module, tach `RealtimeTransportPort` / Giu `application` doc lap voi `socket.io` / `modules/realtime`

- **Dinh dang:** `[Version] / [Ngay] / [Thay doi gi] / [Ly do] / [Anh huong den dau]`
