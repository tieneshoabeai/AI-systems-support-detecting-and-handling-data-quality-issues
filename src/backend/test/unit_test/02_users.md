# Users: hồ sơ và session

- Ngày lập: 2026-11-16.
- Loại: Checklist unit test và ca hồi quy.
- Nguồn (tương đối với `src/backend/src/`): modules/users/application; modules/users/domain; modules/users/infrastructure/persistence.
- Cô lập dependency: user repository, clock, event/outbox ports.
- Mỗi dòng là một nhóm ca; dấu `/` hoặc danh sách giá trị phải triển khai thành các ca riêng, không chỉ chọn một đại diện. Tất cả chưa thực thi.
- P0: quyền/dữ liệu/trạng thái cốt lõi; P1: logic và biên quan trọng. `RISK`/`GAP`/`OPEN` không phải khẳng định đã có lỗi được tái hiện.

## Các phần cần test

- [ ] **USR-001 [P1]** Tạo user hợp lệ/trùng email → tạo đúng một bản ghi hoặc Conflict; không ghi lại khi trùng.
- [ ] **USR-002 [P1]** Cập nhật first_name/last_name/bio/avatar hợp lệ → chỉ chuyển trường cho phép, giữ các trường không gửi.
- [ ] **USR-003 [P0]** Gửi role/status/password_hash/deleted_at qua cập nhật hồ sơ → DTO/controller không cho nâng quyền hoặc sửa trường nội bộ.
- [ ] **USR-004 [P1]** Bio 499/500/501, tên tại biên maxlength → chấp nhận/từ chối đúng schema; chuỗi Unicode không bị cắt sai bất ngờ.
- [ ] **USR-005 [P0]** Đổi phone sang số của người khác → Conflict; phone đang thuộc chính user → được giữ.
- [ ] **USR-006 [P1]** Phone thiếu/null/chuỗi rỗng → phân biệt giữ nguyên và xóa theo DTO; không gọi kiểm tra unique với giá trị không phải số điện thoại.
- [ ] **USR-007 [P0]** Repository báo duplicate key dù pre-check không thấy → không trả thành công; mapping lỗi thống nhất. Index thật kiểm tra tại INT-001.
- [ ] **USR-008 [P1]** Lookup by ID/email trả null, session không tồn tại → xử lý đúng contract từng query, không tạo hồ sơ giả.
- [ ] **USR-009 [P1]** Mapper user/session → ObjectId thành ID string, snake_case/camelCase đúng, Date/null/optional không bị mất.
- [ ] **USR-010 [P0]** Soft delete user tồn tại/đã xóa → cập nhật đúng user hoặc NotFound; không làm lộ hồ sơ đã xóa qua query public.
- [ ] **USR-011 [P1]** Tạo session → lưu hash thay raw token, TTL/device/IP đúng; expiresAt không bị thay bởi thời gian hệ thống ngoài fake clock.
- [ ] **USR-012 [P0]** Revoke một session/theo ID/toàn bộ user → phạm vi query đúng user, không thu hồi toàn hệ thống.
- [ ] **USR-013 [P1]** Touch session → chỉ cập nhật lastUsedAt của session đích; session mất trong lúc cập nhật được xử lý có chủ đích.
- [ ] **USR-014 [P1]** Liệt kê active sessions → loại revoked/expired theo contract và trả đúng metadata; danh sách rỗng không phải lỗi.
- [ ] **USR-015 [P1]** Cập nhật notifications_enabled true/false → lưu đúng boolean, user không tồn tại trả NotFound.
- [ ] **USR-016 [P1]** Danh sách user cho admin → kiểm tra sort/filter/cursor, projection không chứa hash hoặc token reset.
