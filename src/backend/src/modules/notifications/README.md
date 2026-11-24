# Module `notifications` — Hộp Thư Và Đẩy Tin

Trung tâm thông báo của người dùng: danh sách, số chưa đọc, chi tiết (mở là đọc), đánh dấu đã đọc, tùy chọn nhận. Nhận event từ mọi module qua event bus. Dạng phẳng 10 tệp + index.

## 1. Vị trí và vai trò

- Đường dẫn: `src/backend/src/modules/notifications/`
- Loại kiến trúc: phẳng/service-based.
- Sở hữu: collection `notifications` + tùy chọn nằm trong `users` (`notification_preferences`).
- Cung cấp: `NOTIFICATION_REPOSITORY_PORT`, `NotificationsService`, `NOTIFICATION_TYPES`, `shouldDispatch`, Zod schema.
- Được kích bởi: `USER_EVENTS`, `PROJECT_EVENTS`, `ISSUE_EVENTS`, `ANALYSIS_EVENTS` (project_created, analysis_done, issue_status...).

## 2. Từng tệp làm gì (11 tệp)

| Tệp | Vai trò chi tiết |
|---|---|
| `notifications.controller.ts` | `@Controller()` bare, 5 route. Định nghĩa `ListNotificationsQuerySchema`, `UpdateNotificationPreferencesSchema` ngay trong controller. |
| `notifications.service.ts` | `list/getDetail` (ép `user_id`), `getUnreadCount`, `markAsRead`, `updatePreferences` (ghi vào users), `dispatch` (tạo thông báo từ event, kiểm tra `shouldDispatch` theo tùy chọn, rồi đẩy push/email fail-safe). |
| `notifications.repository.ts` | Hiện thực Mongoose: `list keyset`, `countUnread`, `markRead`, `create`. Index `(user_id, is_read, created_at)`. |
| `notifications.schema.ts` | Schema: `user_id, type, title, summary, payload, is_read, created_at`. `type` thuộc `NOTIFICATION_TYPES`. |
| `notifications.types.ts` | `Notification`, `NOTIFICATION_TYPES`, `MANDATORY_NOTIFICATION_TYPES` (luôn gửi, không tắt được), `isMandatoryNotification`, `shouldDispatch(type, prefs)`, sự kiện. |
| `notification.mapper.ts` | Map DB -> API, chuẩn hóa thời gian. |
| `notification-email.mapper.ts` | Dựng tiêu đề/nội dung email từ Notification (dùng `email-templates` của shared). |
| `notifications.utils.ts` | Lọc theo tùy chọn, cắt ngắn title/summary (`MAX_TITLE_LENGTH/SUMMARY_LENGTH`). |
| `notification-dispatch.util.ts` | `dispatchNotificationViaPorts` — cho module khác tạo thông báo qua port: kiểm công tắc → `createIfEventNotExists` (chống trùng theo `source_event_id`) → realtime `notification.created`. Không gửi email. `analysis` dùng cho `analysis_completed` / `analysis_failed` / `ai_analysis_ready`. |
| `notifications.module.ts` | Khai báo controller/service/repository, đăng ký subscriber lắng nghe event bus, tiêm `PUSH_PORT/EMAIL_PORT`. |
| `index.ts` | Public contract đầy đủ. |

## 3. Route đầy đủ (5 route)

| Phương thức | Đường dẫn đầy đủ | Mô tả |
|---|---|---|
| GET | `/api/v1/notifications` | Trung tâm thông báo của chính mình, keyset (NOTIF-01). |
| GET | `/api/v1/notifications/unread-count` | Số chưa đọc, phải nhất quán với list (NOTIF-01). |
| GET | `/api/v1/notifications/:id` | Chi tiết; mở là đánh dấu đã đọc (NOTIF-02). |
| PATCH | `/api/v1/notifications/:id/read` | Đánh dấu đã đọc (NOTIF-02). |
| PATCH | `/api/v1/users/me/notification-preferences` | Bật/tắt từng loại (NOTIF-03). Loại bắt buộc không tắt được. |

## 4. Luồng đẩy tin

1. Module nghiệp vụ phát event (ví dụ `PROJECT_CREATED`) lên `HybridEventPublisher`.
2. Subscriber của notifications nhận, gọi `dispatch`: tạo bản ghi DB + kiểm tra `shouldDispatch`.
3. Đẩy ntfy (`NtfyPushSenderAdapter`) và email (`SmtpEmailSenderAdapter`) — cả hai đều try/catch, lỗi chỉ log, không làm sập API.
4. Realtime đẩy `notification.*` vào phòng `user:{id}` để frontend cập nhật tức thì.
5. Đường thứ hai (không qua event bus, không email): module nghiệp vụ gọi thẳng `dispatchNotificationViaPorts` — `issues` (hàm riêng cùng logic) và `analysis` (K6, Phần 9 v7 mục 3.14).

## 5. Bất biến

- Mọi truy vấn đều ép `user_id = currentUser.id` — không bao giờ lộ thông báo người khác (chống IDOR).
- Push/email fail-safe.
- Tiền tố MinIO test bị xóa theo prefix; `unread-count` phải khớp `list` (có test bao phủ).

## 6. Test liên quan

`test/unit/notifications/` (entity, `notification-dispatch.spec.ts`), `test/unit/workflows/notifications-issues-wave6.spec.ts`, `test/e2e/feedback-notifications-overview.e2e-spec.ts`.
