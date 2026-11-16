# Notifications

- Ngày lập: 2026-11-16.
- Loại: Checklist unit test và ca hồi quy.
- Nguồn (tương đối với `src/backend/src/`): modules/notifications/application; modules/notifications/domain.
- Cô lập dependency: notification/user repository, realtime, clock.
- Mỗi dòng là một nhóm ca; dấu `/` hoặc danh sách giá trị phải triển khai thành các ca riêng, không chỉ chọn một đại diện. Tất cả chưa thực thi.
- P0: quyền/dữ liệu/trạng thái cốt lõi; P1: logic và biên quan trọng. `RISK`/`GAP`/`OPEN` không phải khẳng định đã có lỗi được tái hiện.

## Các phần cần test

- [ ] **NOT-001 [P1]** Dispatch optional với notifications_enabled true/false/undefined → theo policy, false không tạo bản ghi.
- [ ] **NOT-002 [P0]** Thông báo mandatory khi người dùng tắt thông báo → vẫn tạo; mandatory type và explicit flag được kết hợp đúng.
- [ ] **NOT-003 [P1]** Notification entity title có khoảng trắng và quá 200 ký tự → normalize theo contract; không thay body ngoài ý muốn.
- [ ] **NOT-004 [P1]** Dispatch hợp lệ → persist trước emit, gửi đúng user room; repository không tạo được → không emit thành công.
- [ ] **NOT-005 [P1]** Realtime lỗi → thông báo đã persist không bị coi thất bại nghiệp vụ nếu best-effort.
- [ ] **NOT-006 [P0]** Get detail/mark read của user khác → NotFound; không đổi readAt.
- [ ] **NOT-007 [P1]** Get detail chưa đọc → đánh dấu read đúng một lần; đã đọc → không ghi lại timestamp ngoài contract.
- [ ] **NOT-008 [P1]** Mark read lặp → idempotent về trạng thái; bản ghi mất lúc update → NotFound.
- [ ] **NOT-009 [P1]** Count unread → đúng user và trạng thái readAt, 0 hợp lệ; không tính của user khác.
- [ ] **NOT-010 [P1]** List có filter/cursor → đúng thứ tự/hasMore, empty list hợp lệ; cursor sai → validation.
- [ ] **NOT-011 [P1]** Update preferences true/false → user port nhận đúng boolean; user không tồn tại → NotFound.
