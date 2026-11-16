# Phân quyền và cách ly tài nguyên

- Ngày lập: 2026-11-16.
- Loại: Checklist unit test và ca hồi quy.
- Nguồn (tương đối với `src/backend/src/`): shared/casl; shared/guards; các controller và access adapter projects/workspaces.
- Cô lập dependency: Reflector, ModuleRef, ExecutionContext, access ports; không gọi HTTP thật.
- Mỗi dòng là một nhóm ca; dấu `/` hoặc danh sách giá trị phải triển khai thành các ca riêng, không chỉ chọn một đại diện. Tất cả chưa thực thi.
- P0: quyền/dữ liệu/trạng thái cốt lõi; P1: logic và biên quan trọng. `RISK`/`GAP`/`OPEN` không phải khẳng định đã có lỗi được tái hiện.

## Các phần cần test

- [ ] **SEC-001 [P0]** Anonymous gọi handler cần xác thực → guard từ chối, use case không được gọi; public route được phép đúng metadata.
- [ ] **SEC-002 [P0]** RolesGuard: không có user, sai role, đúng role, nhiều role cho phép → quyết định đúng; không nhầm role hệ thống và project.
- [ ] **SEC-003 [P0]** Workspace Owner truy cập tài nguyên trong/ngoài workspace → quyền đầy đủ trong phạm vi, không lan sang workspace khác.
- [ ] **SEC-004 [P0]** Workspace Member → đọc workspace; không tạo project hoặc sửa workspace chỉ nhờ vai trò Member.
- [ ] **SEC-005 [P0]** Workspace Member không có role project riêng → Viewer mặc định; người ngoài workspace → không có quyền.
- [ ] **SEC-006 [P0]** Project Owner/Member/Viewer → lập ca cho từng action read/create/update/delete/execute của từng loại tài nguyên; chỉ cho phép theo policy được duyệt, không dùng một ca đại diện mọi action.
- [ ] **SEC-007 [P0]** Workspace Owner đồng thời có role project thấp hơn → quyền quản trị workspace không bị hạ ngoài ý muốn; kiểm tra resolver và controller cùng lúc bằng mock.
- [ ] **SEC-008 [P0]** Sửa tên cột: Workspace Owner, Project Owner, Project Member → được phép; Viewer → chỉ đọc cảnh báo, không gọi rename/reset handler.
- [ ] **SEC-009 [P0]** Viewer đọc analysis/summary → không kích hoạt tạo kết quả/job; chạy analysis, retry AI, tạo summary, save config → từ chối.
- [ ] **SEC-010 [P0]** Viewer tải PDF được phép xem → được đọc; tải file của project khác → từ chối. Quyền file gốc cần đối chiếu controller hiện tại.
- [ ] **SEC-011 [P0]** Request sửa profile/session/notification/issue của user khác → bị chặn dù ID tồn tại.
- [ ] **SEC-012 [P0]** Đổi projectId/datasetId/runId/jobId trong URL/body/query → mọi liên kết tài nguyên được kiểm tra, không dùng ID hợp lệ làm bằng chứng quyền.
- [ ] **SEC-013 [P0]** PoliciesGuard static can=true nhưng dynamic resource thuộc workspace khác → từ chối; loader trả null → NotFound.
- [ ] **SEC-014 [P1]** Loader resolve qua get thất bại rồi resolve thành công → dùng đúng instance; lỗi dependency không được biến thành allow.
- [ ] **SEC-015 [P0]** Nhiều policy, chỉ một policy trả false → toàn bộ yêu cầu bị từ chối; thiếu resource không được vô tình mở quyền.
- [ ] **SEC-016 [P0]** Route không có policy metadata → ghi nhận bypass theo thiết kế guard; có kiểm tra độc lập route nhạy cảm không bị bỏ quên metadata (không phải unit test riêng).
- [ ] **SEC-017 [P0]** Người đã rời/bị loại khỏi workspace → resolver không trả role cũ; mọi request mới mất quyền project.
- [ ] **SEC-018 [P0]** Admin có CASL manage-all nhưng feedback cấm admin đọc dữ liệu tenant → kiểm tra giới hạn riêng ở handler, không suy ra admin được mọi use case.
- [ ] **SEC-019 [P1]** Adapter access workspace/project → chuyển đúng ID, role, version; không import hoặc thao tác repository của module khác trong test business.
