# `test/unit/notifications/` — 2 tệp kiểm thử thông báo

Thư mục này kiểm thử entity thông báo. Chuỗi `describe` chép nguyên văn từ code để tiện đối chiếu.

| Tệp | Các `describe` thật trong code |
|---|---|
| `notification-entity.spec.ts` | `factory` ; `truy vấn` ; `markAsRead()` ; `toProps()` (4 describe — tạo mới, truy vấn, đánh dấu đã đọc, chuyển thuộc tính) |
| `notification-dispatch.spec.ts` | `dispatchNotificationViaPorts (NTT-01)` (1 describe — công tắc, bắt buộc, chống trùng, cắt độ dài, realtime lỗi; Phần 13 v18 mục 3.31) |

Nội dung được giữ: số lượng chưa đọc (`unreadCount`) luôn nhất quán với danh sách, sắp xếp theo `createdAt` giảm dần.

Liên quan: `workflows/notifications-issues-wave6.spec.ts` và e2e feedback-notifications-overview.

Chạy: `npx jest test/unit/notifications --no-coverage`.
