# Issues: báo cáo sự cố và tệp đính kèm

- Ngày lập: 2026-11-16.
- Loại: Checklist unit test và ca hồi quy.
- Nguồn (tương đối với `src/backend/src/`): modules/issues/application; modules/issues/domain; modules/issues/infrastructure/http/dtos.
- Cô lập dependency: issue/storage/workspace ports, outbox/notifications, clock.
- Mỗi dòng là một nhóm ca; dấu `/` hoặc danh sách giá trị phải triển khai thành các ca riêng, không chỉ chọn một đại diện. Tất cả chưa thực thi.
- P0: quyền/dữ liệu/trạng thái cốt lõi; P1: logic và biên quan trọng. `RISK`/`GAP`/`OPEN` không phải khẳng định đã có lỗi được tái hiện.

## Các phần cần test

- [ ] **ISS-001 [P1]** Tạo issue hợp lệ → đúng author, type, trạng thái new và version ban đầu; client không tự gán admin status.
- [ ] **ISS-002 [P1]** workspaceId sai, occurredAt invalid, title/description sai biên DTO → lỗi trước persist.
- [ ] **ISS-003 [P0]** Tạo issue gắn workspace người dùng không có quyền → không cho gắn tài nguyên tenant khác; xác minh enforcement tại controller/port.
- [ ] **ISS-004 [P1]** Get/list mine → chỉ issue chính user; ID người khác → NotFound, không tiết lộ nội dung.
- [ ] **ISS-005 [P0]** Get/list admin hoặc update status bằng analyst → Forbidden, repository không bị ghi.
- [ ] **ISS-006 [P1]** Mọi cặp trạng thái new/needs_info/in_progress/resolved/closed → chấp nhận đúng bảng transitions; cùng trạng thái và cạnh không khai báo → từ chối.
- [ ] **ISS-007 [P0]** User sửa issue chỉ khi needs_info → được sửa title/description/attachments rồi về in_progress; trạng thái khác → Forbidden.
- [ ] **ISS-008 [P0]** Sửa issue không thuộc user hoặc đổi issueType ngoài contract → không thành công.
- [ ] **ISS-009 [P0]** expectedVersion thiếu/sai hoặc update có tranh chấp → validation/Conflict; không ghi đè thay đổi mới.
- [ ] **ISS-010 [P1]** Admin chuyển needs_info/new/resolved → đúng thông báo/event theo code, không phát khi transition thất bại.
- [ ] **ISS-011 [P1]** Upload attachment loại được phép, 10MiB−1/10MiB/+1, tổng 2/3/4 tệp → kiểm tra đúng biên 10MiB và tối đa 3.
- [ ] **ISS-012 [P0]** Tên tệp traversal, MIME giả, extension không cho phép → không lưu vào key tùy ý; cleanup temp nếu có.
- [ ] **ISS-013 [P0]** Upload/download attachment của issue người khác → không được, ngoại lệ admin đúng contract.
- [ ] **ISS-014 [P1]** Storage không sẵn sàng/upload lỗi/update attachments lỗi → không báo đính kèm thành công; object mồ côi cần cleanup hoặc ghi RISK.
- [ ] **ISS-015 [P1]** Xóa attachment khi bổ sung issue → chỉ cleanup key đã bỏ, không xóa tệp vẫn được tham chiếu.
- [ ] **ISS-016 [P0]** Download ID attachment không nằm trong issue hoặc thiếu storageKey → NotFound; không lookup đường dẫn tùy ý.
- [ ] **ISS-017 [P1]** Cursor/filter status/type/search trên list mine/admin → giữ scope và sort ổn định, invalid cursor → lỗi.
