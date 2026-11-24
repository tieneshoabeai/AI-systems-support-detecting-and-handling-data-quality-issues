# `test/unit/notifications/` — 1 tệp kiểm thử thông báo

Thư mục này kiểm thử entity thông báo. Chuỗi `describe` chép nguyên văn từ code để tiện đối chiếu.

| Tệp | Các `describe` thật trong code |
|---|---|
| `notification-entity.spec.ts` | `factory` ; `truy vấn` ; `markAsRead()` ; `toProps()` (4 describe — tạo mới, truy vấn, đánh dấu đã đọc, chuyển thuộc tính) |

Nội dung được giữ: số lượng chưa đọc (`unreadCount`) luôn nhất quán với danh sách, sắp xếp theo `createdAt` giảm dần.

Liên quan: `workflows/notifications-issues-wave6.spec.ts` và e2e feedback-notifications-overview.

Chạy: `npx jest test/unit/notifications --no-coverage`.
