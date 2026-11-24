# Workspaces

- Ngày lập: 2026-11-16.
- Loại: Checklist unit test và ca hồi quy.
- Nguồn (tương đối với `src/backend/src/`): modules/workspaces/application; modules/workspaces/domain; modules/workspaces/infrastructure/persistence.
- Cô lập dependency: workspace/project/user ports, outbox, transaction stub, clock.
- Mỗi dòng là một nhóm ca; dấu `/` hoặc danh sách giá trị phải triển khai thành các ca riêng, không chỉ chọn một đại diện. Tất cả chưa thực thi.
- P0: quyền/dữ liệu/trạng thái cốt lõi; P1: logic và biên quan trọng. `RISK`/`GAP`/`OPEN` không phải khẳng định đã có lỗi được tái hiện.

## Các phần cần test

- [ ] **WS-001 [P0]** Tạo workspace hợp lệ → người tạo là Owner duy nhất, membership Owner đúng; fields mặc định đúng.
- [ ] **WS-002 [P1]** Tạo với danh sách email lặp hoặc gồm người tạo → không thêm trùng; email không tồn tại → lỗi có danh sách phù hợp, không báo tạo đầy đủ giả.
- [ ] **WS-003 [P0]** Lỗi giữa tạo workspace và thêm thành viên → kiểm tra rollback/compensation hoặc báo thất bại đúng; không giữ trạng thái nửa chừng ngoài contract.
- [ ] **WS-004 [P1]** Get ID sai định dạng/không tồn tại/đã xóa → lỗi tương ứng; không gọi port tra cứu khi ID đã sai.
- [ ] **WS-005 [P1]** Get với touch true/false → chỉ cập nhật lastAccessed khi cần; lỗi touch không làm mất kết quả đọc nếu là best-effort.
- [ ] **WS-006 [P1]** List workspaces theo user/admin, role owner/member, search → tập kết quả đúng; không đưa workspace đã xóa vào danh sách.
- [ ] **WS-007 [P1]** List members tìm theo tên/email, lọc role, user mất hồ sơ → trả đúng scope, không crash hoặc lộ hash.
- [ ] **WS-008 [P1]** List cursor hỏng hoặc không cùng sort → validation error; trang kế tiếp không trùng, cùng timestamp dùng ID phân định.
- [ ] **WS-009 [P0]** Thêm member hợp lệ → membership đúng; người không tồn tại/trùng member → NotFound/Conflict, không phát event thành công.
- [ ] **WS-010 [P0]** Xóa member → xóa quyền workspace/project tương ứng, project đang sở hữu được bàn giao đúng Owner workspace.
- [ ] **WS-011 [P0]** Xóa Workspace Owner bằng remove-member → từ chối; xóa người chưa là member → NotFound.
- [ ] **WS-012 [P0]** Member tự rời → mất membership, project sở hữu được xử lý; Owner tự rời khi chưa chuyển quyền → từ chối.
- [ ] **WS-013 [P0]** Chuyển Owner hợp lệ → đúng một Owner mới, Owner cũ không còn quyền Owner; người ngoài workspace/tự chuyển/sai actor → từ chối.
- [ ] **WS-014 [P0]** Chuyển Owner với version cũ hoặc repository trả conflict → Conflict, không phát sự kiện thành công.
- [ ] **WS-015 [P1]** Update workspace với expectedVersion đúng/sai, workspace biến mất → update hoặc Conflict/NotFound phù hợp, không ghi đè phiên bản mới.
- [ ] **WS-016 [P0]** Delete workspace → soft-delete đúng tài nguyên và side effect theo handler; không xóa workspace khác.
- [ ] **WS-017 [P1]** Quota dùng + incoming nhỏ hơn/bằng/lớn hơn quota → bằng giới hạn được nhận, vượt bị chặn; kiểm tra 0 bytes.
- [ ] **WS-018 [P1]** Increment storage dùng số byte thực tế, không số ước lượng → ghi delta đúng một lần; lỗi persistence không được báo cập nhật thành công.
- [ ] **WS-019 [P1]** Resolver role với owner/member/không thuộc workspace và role legacy editor/viewer → mapping tương thích đúng code, không tạo Workspace Viewer mới.
