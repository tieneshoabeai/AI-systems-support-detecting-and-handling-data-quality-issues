# Projects

- Ngày lập: 2026-11-16.
- Loại: Checklist unit test và ca hồi quy.
- Nguồn (tương đối với `src/backend/src/`): modules/projects/application; modules/projects/domain; modules/projects/infrastructure/persistence.
- Cô lập dependency: workspace/user/project ports, transaction stub, clock, outbox.
- Mỗi dòng là một nhóm ca; dấu `/` hoặc danh sách giá trị phải triển khai thành các ca riêng, không chỉ chọn một đại diện. Tất cả chưa thực thi.
- P0: quyền/dữ liệu/trạng thái cốt lõi; P1: logic và biên quan trọng. `RISK`/`GAP`/`OPEN` không phải khẳng định đã có lỗi được tái hiện.

## Các phần cần test

- [ ] **PRJ-001 [P0]** Tạo project trong workspace hợp lệ → hasDataset=false, trạng thái ban đầu đúng, một Owner.
- [ ] **PRJ-002 [P0]** Workspace không tồn tại hoặc actor không được phép tạo → không tạo project.
- [ ] **PRJ-003 [P1]** Tên trùng trong cùng workspace → Conflict; cùng tên ở workspace khác → không xung đột do phạm vi tên.
- [ ] **PRJ-004 [P0]** Chỉ định owner_id là member hợp lệ → đúng Owner; user ngoài workspace/không tồn tại → từ chối.
- [ ] **PRJ-005 [P1]** Đổi tên project sang tên đang dùng → Conflict; giữ nguyên tên → không tự xung đột với chính project.
- [ ] **PRJ-006 [P0]** Update với version cũ → Conflict, không ghi đè; repository trả null với/không expectedVersion → mapping lỗi đúng.
- [ ] **PRJ-007 [P1]** Get/list project của workspace không tồn tại/đã xóa → NotFound; list search/sort/cursor đúng phạm vi.
- [ ] **PRJ-008 [P1]** Get touch truy cập thất bại → vẫn trả project nếu lỗi touch được xem là best-effort.
- [ ] **PRJ-009 [P0]** setHasDataset true từ not_started → in_progress; false → trạng thái tương ứng code; không thay đổi project khác.
- [ ] **PRJ-010 [P0]** Project đã có dataset nhận import tiếp → bị chặn; hai yêu cầu cạnh tranh cần INT-003, unit chỉ mô phỏng conflict từ port.
- [ ] **PRJ-011 [P0]** Mark completed thiếu expectedVersion, sai trạng thái, version cũ → từ chối; in_progress + version đúng → completed.
- [ ] **PRJ-012 [P1]** Thêm member hợp lệ/trùng/email không tồn tại → tạo membership hoặc Conflict/NotFound; không thêm nhiều lần.
- [ ] **PRJ-013 [P0]** Thêm user ngoài workspace vào project → không cấp quyền tenant ngoài ý muốn; ghi RISK nếu handler hiện không kiểm tra.
- [ ] **PRJ-014 [P0]** Đổi role Member ↔ Viewer → đúng version và membership; không dùng endpoint thường để hạ Owner.
- [ ] **PRJ-015 [P0]** Remove Owner → từ chối và yêu cầu chuyển quyền; remove user không thuộc project → NotFound.
- [ ] **PRJ-016 [P0]** Remove role project của Workspace Member → resolver trở về Viewer mặc định thay vì mất quyền đọc workspace.
- [ ] **PRJ-017 [P0]** Project Owner tự chuyển → người cũ thành Member, người mới thành Owner; tự chuyển/ngoài project/sai actor → lỗi.
- [ ] **PRJ-018 [P0]** Workspace Owner chỉ định lại Owner → yêu cầu cũ người cũ thành Viewer; chưa thấy use case tương ứng rõ ràng, thực hiện GAP-008 trước khi chốt assertion.
- [ ] **PRJ-019 [P0]** Chuyển Owner với version conflict → không tồn tại hai Owner; unit kiểm tra lệnh port nguyên tử, tích hợp kiểm tra race thật.
- [ ] **PRJ-020 [P1]** List members có search/filter/phan trang → đúng tập và cursor; không lẫn workspace/project khác.
- [ ] **PRJ-021 [P0]** Delete project → soft-delete đúng ID và side effect theo code; subsequent access không trả project đã xóa.
- [ ] **PRJ-022 [P1]** Mapper project → status, hasDataset, owner/member, version, Date/nullable đúng qua round-trip thuần.
