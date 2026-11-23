# MÔ-ĐUN `realtime` — WebSocket realtime

> **Đặc tả mô-đun & Tài liệu kỹ thuật**

## 1. Thông tin phiên bản

- **Phiên bản hiện tại:** v1.1.0
- **Cập nhật lần cuối:** 2026-11-21
- **Đường dẫn mô-đun:** `src/backend/src/modules/realtime` (8 tệp TypeScript)
- **Tầng kiến trúc:** Clean Architecture 4 tầng (`domain` → `application` → `infrastructure` → `presentation`)
- **Quy tắc tầng:** CA1–CA14 — xem [`../README.md`](../README.md)

## 2. Mục đích & Phạm vi nghiệp vụ

Mô-đun cung cấp kênh truyền tin hai chiều (WebSocket) để đẩy thông báo, tiến độ phân tích và trạng thái AI job tới client mà không cần polling.

### 2.1. Tính năng thuộc phạm vi

| Chức năng | Nội dung |
|---|---|
| Cổng kết nối (Gateway) | Xác thực bắt tay (handshake) bằng access token |
| Phòng (room) | Tham gia / rời khỏi theo `user`, `project`, `analysis` |
| Đẩy sự kiện | Gửi envelope tới phòng qua `RealtimeTransportPort` |
| Thu hồi | Đóng toàn bộ socket của người dùng khi bị khoá / xoá (OPEN-08) |

### 2.2. Cấu trúc thư mục

```text
realtime/
|-- domain/
|   |-- ports/realtime-transport.port.ts
|   `-- events/realtime.events.ts
|-- application/
|   |-- realtime.service.ts                # dịch vụ phía application
|   `-- realtime-revocation.subscriber.ts  # bắt USER_BLOCKED / USER_REMOVED
|-- infrastructure/websocket/
|   |-- socket-io-realtime.transport.ts     # hiện thực RealtimeTransportPort
|   |-- realtime.gateway.ts                # @WebSocketGateway
|   `-- realtime-auth.adapter.ts           # xác thực bắt tay
`-- realtime.module.ts
```

## 3. Nhật ký Prompting & Quyết định kỹ thuật

- **Yêu cầu người dùng / Ý đồ nghiệp vụ:** Đẩy thông báo và tiến độ tới client ngay lập tức thay vì để client phải polling, đồng thời bảo đảm socket **tự động bị thu hồi** khi tài khoản bị khoá hoặc xoá.

- **Lập luận kỹ thuật & Quyết định:**

1. **Tách port để tầng application không biết `socket.io`.** Tầng `application/` chỉ nói "đẩy envelope này tới phòng X"; adapter lo phần gắn driver và thực thi `emit`. `domain` không được import thư viện hạ tầng.

2. **`attachServer(server: unknown)`.** Tầng domain không được biết kiểu `Server` của `socket.io`. Adapter hiện thực với kiểu cụ thể hơn (`attachServer(server: Server)`) — TypeScript chấp nhận hiệp biến ngược (contravariance) cho tham số phương thức, nên vẫn hiện thực được interface này.

3. **Hợp thức hoá xác thực bằng access token trong query.** `?token=<access_token>` — để client không cần gửi header trong quá trình bắt tay WebSocket. Token được xác thực theo chuẩn của mô-đun `auth`.

4. **Tự động tham gia phòng `user:${userId}`.** Sau khi xác thực, socket tự động vào phòng riêng. Các phòng `project:*` và `analysis:*` phải **tham gia thủ công** qua sự kiện `join`, và việc tham gia phòng project **được kiểm tra quyền** — người dùng không thể nghe sự kiện của project mà mình không có quyền.

5. **Quy tắc nội dung: chỉ id + trạng thái + số liệu tổng hợp.** Tuyệt đối không đẩy giá trị ô dữ liệu, nội dung nhận xét, email hay PII qua WebSocket.

6. **Thu hồi = `disconnectSockets(true)`, không phải "gửi sự kiện rồi để client tự đóng".** Client có thể bỏ qua sự kiện. `disconnectUser(userId)` đóng **toàn bộ** socket của người dùng. Đây là lý do `USER_BLOCKED` / `USER_REMOVED` được định nghĩa ở `shared/domain/utils/realtime-events.ts` chứ không phải trong mô-đun này.

7. **Hợp đồng nằm ở `shared/domain/utils/`.** `shared/infrastructure/events/event-dispatcher.service.ts` cần dùng nó nhưng `shared/` không được import từ `modules/` (CA5); `modules/realtime/domain/` chỉ được import `shared/` ở thư mục thuần (CA11). `shared/domain/utils/` là nơi duy nhất thoả cả hai.

- **Hiện vật đã tạo / đã sửa:**

- `domain/ports/realtime-transport.port.ts` — `REALTIME_TRANSPORT_PORT`: `emitToRoom`, `disconnectUser`, `attachServer`.
- `infrastructure/websocket/socket-io-realtime.transport.ts` — hiện thực port, `disconnectSockets(true)`.
- `presentation/gateways/realtime.gateway.ts` — `@WebSocketGateway`, xác thực bắt tay, tham gia phòng có kiểm tra quyền.
- `application/realtime-revocation.subscriber.ts` — bắt `USER_BLOCKED` / `USER_REMOVED` và gọi `disconnectUser`.

## 4. Đặc tả giao tiếp kỹ thuật

### 4.1. Điểm cuối (Endpoints)

> Mô-đun này không phải REST. Kết nối WebSocket:

| Thông số | Giá trị |
|---|---|
| **Đường dẫn** | `ws://<host>/api/v1/realtime?token=<access_token>` |
| **Giao thức** | Socket.IO (dự phòng sang WebSocket thuần) |
| **Xác thực** | Access token trong chuỗi truy vấn |

**Phòng (room):**

| Phòng | Nội dung |
|---|---|
| `user:${userId}` | Thông báo cá nhân, tiến độ của tôi — tự động tham gia sau khi xác thực |
| `project:${projectId}` | Sự kiện của project — tham gia thủ công, có kiểm tra quyền |
| `analysis:${analysisId}` | Tiến độ phân tích — tham gia thủ công, có kiểm tra quyền |

### 4.2. Giao diện / Provider được xuất ra ngoài

`src/backend/src/modules/realtime/index.ts` xuất hợp đồng công khai:

| Tên xuất | Vai trò |
|---|---|
| `RealtimeModule` | Mô-đun Nest |
| `REALTIME_TRANSPORT_PORT` | Cổng đẩy sự kiện tới phòng |

### 4.3. Sự kiện domain phát ra

| Sự kiện realtime | Mục đích |
|---|---|
| `notification.created` | Thông báo mới |
| `ai.quality.updated` | Chỉ số chất lượng AI thay đổi |
| `analysis.progress` | Tiến độ phân tích |
| `analysis.completed` | Phân tích xong |
| `analysis.failed` | Phân tích thất bại |
| `ai.job.status` | Trạng thái AI job |
| `feedback.created` | Có phản hồi mới |

| Sự kiện thu hồi | Mục đích |
|---|---|
| `USER_BLOCKED` | Đóng socket của người dùng bị khoá |
| `USER_REMOVED` | Đóng socket của người dùng bị xoá mềm |

## 5. Ràng buộc & Tiêu chuẩn bất biến

### 5.1. Bất biến nghiệp vụ

| Nội dung | Bắt buộc |
|---|---|
| Giá trị ô dữ liệu | **Không** được đẩy |
| Nội dung nhận xét | **Không** được đẩy |
| Email / PII | **Không** được đẩy |
| Id + trạng thái + số liệu tổng hợp | Được phép |
| Tải trọng (payload) sự kiện | Luôn có `event`, `payload`, `timestamp` |

- Socket **phải** được xác thực trước khi tham gia phòng nào.
- Tham gia phòng `project:*` / `analysis:*` **phải** được kiểm tra quyền.
- Socket của người dùng bị khoá / xoá **phải** bị đóng, không phải chỉ nhận sự kiện.
- Lỗi realtime **không** được làm hỏng luồng nghiệp vụ chính.

### 5.2. Xoá mềm (Soft Delete)

- **Chuẩn:** `deleted_at: Date | null` — trường này **null** nghĩa là bản ghi đang hoạt động.
- **Quy tắc truy vấn:** mọi truy vấn mặc định luôn lọc `deleted_at: null`. Repository nền (`shared/infrastructure/database/base-mongo.repository.ts`) áp dụng điều này tự động.
- **Chơi index Partial Unique:** `partialFilterExpression: { deleted_at: null }` — cho phép tài khoản / tên / email đã xoá mềm được tạo lại.

### 5.3. Bảo mật

| Vấn đề | Cách xử lý |
|---|---|
| Truy cập socket không xác thực | Quá trình bắt tay đi qua kiểm tra token |
| Nghe sự kiện project người khác | Kiểm tra quyền khi tham gia phòng |
| Socket còn sống sau khi khoá tài khoản | `disconnectUser` → `disconnectSockets(true)` |
| Rò rỉ PII qua WebSocket | Quy tắc nội dung: chỉ id + trạng thái + số liệu tổng hợp |
| Token bị lộ qua log | Token trong chuỗi truy vấn — cần cơ chế che trong access log |
| Sự kiện giả mạo từ client | Client **chỉ** được tham gia phòng; không có API gửi sự kiện từ client |

### 5.4. Phân quyền

| Hành động | Chính sách |
|---|---|
| Kết nối socket | Access token hợp lệ |
| Tham gia `user:${userId}` | Tự động — theo `userId` trong token |
| Tham gia `project:${projectId}` | Kiểm tra quyền project |
| Tham gia `analysis:${analysisId}` | Kiểm tra quyền project chứa analysis |

## 6. Lịch sử thay đổi

### 2026-11-21
- **v1.1.0** / 2026-11-21 / Viết lại README mô-đun đầy đủ theo chuẩn 6 phần / Yêu cầu tái đọc / Tài liệu mẫu chuẩn

### 2026-11-XX
- **v1.0.0** / 2026-11-XX / Bổ sung `realtime-revocation.subscriber.ts` và `disconnectUser` (OPEN-08) / Đóng socket tức thời khi khoá / xoá tài khoản / `modules/realtime`, `modules/users`
- **v0.8.0** / 2026-11-XX / Bổ sung kiểm tra quyền khi tham gia phòng project / Chặn nghe sự kiện của project người khác / `modules/realtime`
- **v0.5.0** / 2026-11-XX / Chuyển danh mục phòng và envelope sang `shared/domain/utils/realtime-events.ts` / Giải quyết vòng tròn ràng buộc CA5 + CA11 / `shared/domain/utils`, `modules/realtime`
- **v0.1.0** / 2026-11-XX / Tạo mô-đun, tách `RealtimeTransportPort` / Giữ `application` độc lập với `socket.io` / `modules/realtime`

- **Định dạng:** `[Phiên bản] / [Ngày] / [Thay đổi gì] / [Lý do] / [Ảnh hưởng đến đâu]`
