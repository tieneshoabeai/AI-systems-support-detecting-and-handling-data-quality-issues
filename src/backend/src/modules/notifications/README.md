# MÔ-ĐUN `notifications` — Trung tâm thông báo (Template: Simple)

> **P3.4 (2026-11-24):** Flatten từ Hexagonal → Simple Monolith theo ADR-0002.
> - Vì sao Simple: 6 use-case CRUD + dispatch, không DB riêng phức tạp, không transaction/outbox.
> - Bất biến: 2 mapper RIÊNG (`notification.mapper.ts` DB ↔ entity, `notification-email.mapper.ts` loại → email); thứ tự route `notifications/unread-count` TRƯỚC `notifications/:id`; `PATCH users/me/notification-preferences`; 10 loại + 2 bắt buộc (`issue_needs_info`, `security_alert`); entity invariant title 200/summary 500/đọc 1 lần.
> - Cấu trúc mới: `notifications.service.ts (6 method) + notifications.controller.ts (controller + 2 DTO gộp) + notifications.types.ts (entity + VO + port + input) + notifications.utils.ts + notification.mapper.ts + notification-email.mapper.ts + notifications.schema.ts + notifications.repository.ts + index.ts + notifications.module.ts`.
> - Cấm: gộp 2 mapper (khác nghĩa), đổi Symbol port (TC-03), đổi thứ tự/tham số method (BC), đổi thứ tự route.

---
# MÔ-ĐUN `notifications` — Thông báo & Tùy chọn người dùng

> **Đặc tả mô-đun & Tài liệu kỹ thuật**

## 1. Thông tin phiên bản

- **Phiên bản hiện tại:** v1.1.0
- **Cập nhật lần cuối:** 2026-11-21
- **Đường dẫn mô-đun:** `src/backend/src/modules/notifications` (21 tệp TypeScript)
- **Tầng kiến trúc:** Clean Architecture 4 tầng (`domain` → `application` → `infrastructure` → `presentation`)
- **Quy tắc tầng:** CA1–CA14 — xem [`../README.md`](../README.md)

## 2. Mục đích & Phạm vi nghiệp vụ

Mô-đun gửi thông báo trong hệ thống: thông báo trong ứng dụng, thông báo đẩy qua ntfy, và email.

### 2.1. Tính năng thuộc phạm vi

| Chức năng | Nội dung |
|---|---|
| Điều phối (Dispatch) | Nhận yêu cầu gửi, kiểm tra tùy chọn người nhận, lưu, đẩy realtime, gửi push/email |
| Hộp thư | Liệt kê, đếm chưa đọc, đọc chi tiết, đánh dấu đã đọc |
| Tùy chọn | Người dùng bật/tắt từng loại thông báo |

### 2.2. Cấu trúc thư mục

```text
notifications/
|-- domain/
|   |-- entities/notification.entity.ts
|   |-- value-objects/notification-type.vo.ts
|   |-- events/notification-events.ts
|   `-- ports/notification.repository.port.ts
|-- application/
|   |-- commands/
|   |   |-- dispatch.handler.ts
|   |   |-- mark-as-read.handler.ts
|   |   `-- update-preferences.handler.ts
|   |-- queries/
|   |   |-- list-for-user.handler.ts
|   |   |-- count-unread.handler.ts
|   |   `-- get-detail.handler.ts
|   |-- notification-email.mapper.ts
|   |-- notifications.types.ts
|   `-- notifications.utils.ts
|-- infrastructure/persistence/
|   |-- notification.schema.ts
|   |-- notifications.repository.ts
|   `-- notification.mapper.ts
`-- presentation/
    |-- controllers/notifications.controller.ts
    `-- dtos/list-notifications-query.dto.ts
```

## 3. Nhật ký Prompting & Quyết định kỹ thuật

- **Yêu cầu người dùng / Ý đồ nghiệp vụ:** Bảo đảm người dùng **không bỏ lỡ** thông báo quan trọng, đồng thời **không bị làm phiền** bởi thông báo không cần thiết.

- **Lập luận kỹ thuật & Quyết định:**

1. **Hai loại thông báo BẮT BUỘC.** `MANDATORY_NOTIFICATION_TYPES = ['issue_needs_info', 'security_alert']`.
   - `issue_needs_info`: quản trị viên yêu cầu bổ sung thông tin — người dùng không được "không thấy" yêu cầu.
   - `security_alert`: cảnh báo bảo mật (đăng nhập lạ, thu hồi phiên).

   Logic: `isMandatoryNotification(type, explicitFlag)` → `explicitFlag === true` hoặc loại thuộc danh sách; `shouldDispatch(enabled, mandatory)` → chỉ bỏ qua khi `enabled === false` **và** không bắt buộc. Kết quả: người dùng tắt `security_alert` vẫn **luôn** nhận được.

2. **Lưu vào DB trước, đẩy realtime sau.** Nếu đẩy realtime lỗi, thông báo vẫn còn trong hộp thư — người dùng không bị mất thông tin. Thứ tự ngược lại sẽ tạo tình trạng "đã gửi nhưng không có trong hộp thư".

3. **Lỗi realtime không làm hỏng luồng chính.** `EventDispatcherService` (mô-đun `shared`) bắt và ghi log lỗi — không rollback transaction đã commit.

4. **Tùy chọn lưu đúng thực tế** khi người dùng tắt loại bắt buộc: giá trị `false` được bỏ qua khi kiểm tra nhưng **vẫn lưu** để hiển thị trung thực trong giao diện — người dùng thấy "không thể tắt" thì nhận rõ.

- **Hiện vật đã tạo / đã sửa:**

- `domain/value-objects/notification-type.vo.ts` — `NOTIFICATION_TYPES` (10 loại), `MANDATORY_NOTIFICATION_TYPES`, `isMandatoryNotification`, `shouldDispatch`.
- `application/commands/dispatch.handler.ts` — luồng gửi: kiểm tra tùy chọn → lưu → realtime → push → email.
- `application/notification-email.mapper.ts` — ánh xạ loại thông báo → nội dung email.
- `application/commands/update-preferences.handler.ts` — cập nhật tùy chọn.

## 4. Đặc tả giao tiếp kỹ thuật

### 4.1. Điểm cuối (Endpoints)

| Phương thức | Đường dẫn | Chính sách | Mô tả |
|---|---|---|---|
| `GET` | `/api/v1/notifications` | Chủ thông báo | Hộp thư (phân trang) |
| `GET` | `/api/v1/notifications/unread-count` | Chủ thông báo | Số chưa đọc |
| `GET` | `/api/v1/notifications/:id` | Chủ thông báo | Chi tiết |
| `PATCH` | `/api/v1/notifications/:id/read` | Chủ thông báo | Đánh dấu đã đọc |
| `PATCH` | `/api/v1/users/me/notification-preferences` | Chủ người dùng | Cập nhật tùy chọn |

**Tham số truy vấn `GET /notifications`:** `unreadOnly`, `type`, `limit`, `cursor`.

### 4.2. Giao diện / Provider được xuất ra ngoài

`src/backend/src/modules/notifications/index.ts` xuất hợp đồng công khai:

| Tên xuất | Vai trò |
|---|---|
| `NotificationsModule` | Mô-đun Nest |
| Thực thể `Notification`, `NotificationType` | Hợp đồng domain |
| `NOTIFICATION_REPOSITORY_PORT` | Cổng truy vấn thông báo |

### 4.3. Sự kiện domain phát ra

| Sự kiện | Khi nào | Mục đích |
|---|---|---|
| `notification.created` | Tạo thông báo | Realtime đến phòng `user:${userId}` |
| `notification.read` | Đánh dấu đã đọc | Realtime |

## 5. Ràng buộc & Tiêu chuẩn bất biến

### 5.1. Bất biến nghiệp vụ

| Loại | Bắt buộc |
|---|---|
| `project_created` | Không |
| `project_deleted` | Không |
| `project_member_added` | Không |
| `issue_needs_info` | **Có** |
| `issue_resolved` | Không |
| `analysis_completed` | Không |
| `analysis_failed` | Không |
| `ai_analysis_ready` | Không |
| `report_ready` | Không |
| `security_alert` | **Có** |

- Thông báo **luôn** được lưu vào DB trước khi đẩy realtime / push / email.
- Loại bắt buộc **được gửi dù** người dùng tắt tùy chọn.
- Chỉ người dùng **sở hữu** mới được đánh dấu đọc thông báo của mình.
- Mỗi thông báo phải trỏ tới một `entityType` + `entityId` để frontend điều hướng.

### 5.2. Xoá mềm (Soft Delete)

- **Chuẩn:** `deleted_at: Date | null` — trường này **null** nghĩa là bản ghi đang hoạt động.
- **Quy tắc truy vấn:** mọi truy vấn mặc định luôn lọc `deleted_at: null`. Repository nền (`shared/infrastructure/database/base-mongo.repository.ts`) áp dụng điều này tự động.
- **Chơi index Partial Unique:** `partialFilterExpression: { deleted_at: null }` — cho phép tài khoản / tên / email đã xoá mềm được tạo lại.

### 5.3. Bảo mật

| Vấn đề | Cách xử lý |
|---|---|
| Đọc thông báo của người khác | Policy loader kiểm tra `userId` khu vực |
| Đánh dấu đọc thông báo người khác | Policy loader kiểm tra `userId` khu vực |
| Mất thông báo quan trọng | Loại bắt buộc không thể tắt |
| Gửi quá nhiều thông báo (spam) | Bộ lọc tùy chọn + `security_alert` luôn gửi |
| Lưu PII trong thông báo | Không đẩy giá trị ô dữ liệu / nhận xét qua thông báo; chỉ đẩy id + trạng thái |
| Lỗi realtime làm mất thông báo | Lưu vào DB trước; lỗi realtime chỉ ghi log |

### 5.4. Phân quyền

| Tuyến đường | Chính sách |
|---|---|
| `GET /notifications` | Chủ thông báo — lọc theo `userId` hiện tại |
| `GET /notifications/unread-count` | Chủ thông báo |
| `GET /notifications/:id` | Chủ thông báo |
| `PATCH /notifications/:id/read` | Chủ thông báo |
| `PATCH /users/me/notification-preferences` | Chủ người dùng |

## 6. Lịch sử thay đổi

### 2026-11-21
- **v1.1.0** / 2026-11-21 / Viết lại README mô-đun đầy đủ theo chuẩn 6 phần / Yêu cầu tái đọc / Tài liệu mẫu chuẩn

### 2026-11-XX
- **v1.0.0** / 2026-11-XX / Bổ sung `security_alert` vào danh sách bắt buộc + `shouldDispatch` / Cảnh báo bảo mật không thể tắt / `modules/notifications`
- **v0.9.0** / 2026-11-XX / Bổ sung `issue_needs_info` vào danh sách bắt buộc / Yêu cầu bổ sung thông tin phải được thấy / `modules/notifications`, `modules/issues`
- **v0.6.0** / 2026-11-XX / Bổ sung `update-preferences.handler.ts` và route `/users/me/notification-preferences` / Người dùng tự kiểm soát / `modules/notifications`
- **v0.4.0** / 2026-11-XX / Tách `dispatch.handler.ts`: lưu vào DB trước, đẩy realtime sau / Không mất thông báo khi realtime lỗi / `modules/notifications`
- **v0.1.0** / 2026-11-XX / Tạo mô-đun / Thông báo là kênh thông tin chính / `modules/notifications`

- **Định dạng:** `[Phiên bản] / [Ngày] / [Thay đổi gì] / [Lý do] / [Ảnh hưởng đến đâu]`
