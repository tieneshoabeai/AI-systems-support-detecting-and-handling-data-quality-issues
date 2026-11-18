# Feedback và chỉ số chất lượng AI

- Ngày lập: 2026-11-16.
- Loại: Checklist unit test và ca hồi quy.
- Nguồn (tương đối với `src/backend/src/`): modules/feedback/application; modules/feedback/domain; modules/feedback/infrastructure/http/dtos.
- Cô lập dependency: feedback/analysis/project/user/RAG ports, realtime, clock.
- Mỗi dòng là một nhóm ca; dấu `/` hoặc danh sách giá trị phải triển khai thành các ca riêng, không chỉ chọn một đại diện. Tất cả chưa thực thi.
- P0: quyền/dữ liệu/trạng thái cốt lõi; P1: logic và biên quan trọng. `RISK`/`GAP`/`OPEN` không phải khẳng định đã có lỗi được tái hiện.

## Các phần cần test

- [ ] **FB-001 [P1]** Tạo feedback cho run và finding → đúng scope, author, modelId và label; hai loại feedback không trộn.
- [ ] **FB-002 [P1]** Label correct/partially_correct/false_positive/missed_issue/other → enum hợp lệ; ba nhãn cuối thiếu reason hoặc whitespace → lỗi.
- [ ] **FB-003 [P1]** findingId rỗng, chỉ khoảng trắng, 200/201 ký tự → kiểm tra trim và biên đúng.
- [ ] **FB-004 [P0]** Run không tồn tại hoặc user không thuộc project → từ chối; không tạo feedback hoặc cập nhật RAG.
- [ ] **FB-005 [P0]** System admin gửi/đọc feedback tenant → xử lý theo giới hạn riêng trong handler, không bypass bằng CASL manage-all.
- [ ] **FB-006 [P0]** FindingId không thuộc kết quả run → không tạo liên kết giả; nếu chưa validate phải ghi RISK.
- [ ] **FB-007 [P1]** Update feedback chính mình → đúng nội dung và reason mới; user khác → Forbidden.
- [ ] **FB-008 [P0]** Remove feedback chính mình/Owner được moderation/người khác → đúng policy từng nhánh, không xóa ngoài project.
- [ ] **FB-009 [P1]** List run/finding với cursor hợp lệ/sai, hồ sơ author bị xóa → pagination đúng, không crash, không lộ dữ liệu user.
- [ ] **FB-010 [P1]** AI quality metrics → đúng count theo label/rate và mẫu số; không có feedback → không chia 0.
- [ ] **FB-011 [P0]** Viewer xem metrics khi policy chỉ Owner/Member → Forbidden; admin bị hạn chế theo contract hiện tại.
- [ ] **FB-012 [P1]** Feedback đủ điều kiện RAG → normalize và upsert đúng ví dụ; chưa đủ trust/thiếu description/embedding rỗng → không lưu ví dụ.
- [ ] **FB-013 [P1]** Cập nhật feedback đã có → không nhân đôi contribution; RAG lỗi không được làm sai trạng thái feedback đã persist.
- [ ] **FB-014 [P1]** Emit feedback.created → đúng project/run và metadata an toàn, không gửi reason/raw text vào realtime payload.
