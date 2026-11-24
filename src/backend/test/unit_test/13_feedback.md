# Feedback và chỉ số chất lượng AI

- Ngày lập: 2026-11-16.
- Loại: Checklist unit test và ca hồi quy.
- Nguồn (tương đối với `src/backend/src/`): modules/feedback/application; modules/feedback/domain; modules/feedback/infrastructure/http/dtos.
- Cô lập dependency: feedback/analysis/project/user/RAG ports, realtime, clock.
- Mỗi dòng là một nhóm ca; dấu `/` hoặc danh sách giá trị phải triển khai thành các ca riêng, không chỉ chọn một đại diện.
- Cập nhật 2026-11-24 (Phần 13 v16 mục 3.29): 13/14 nhóm đã phủ (`[x]`); còn mở FB-010 (metrics khi total = 0 chưa có ca riêng).
- P0: quyền/dữ liệu/trạng thái cốt lõi; P1: logic và biên quan trọng. `RISK`/`GAP`/`OPEN` không phải khẳng định đã có lỗi được tái hiện.

## Các phần cần test

- [x] **FB-001 [P1]** Tạo feedback cho run và finding → đúng scope, author, modelId và label; hai loại feedback không trộn. — *Đã phủ (2026-11-24): test/feedback-wave7.spec.ts, test/feedback-v14.spec.ts (FBT-02, FBT-10).*
- [x] **FB-002 [P1]** Label correct/partially_correct/false_positive/missed_issue/other → enum hợp lệ; ba nhãn cuối thiếu reason hoặc whitespace → lỗi. — *Đã phủ (2026-11-24): test/feedback-wave7.spec.ts, test/feedback-entity.spec.ts.*
- [x] **FB-003 [P1]** findingId rỗng, chỉ khoảng trắng, 200/201 ký tự → kiểm tra trim và biên đúng. — *Đã phủ (2026-11-24): test/feedback-v14.spec.ts (FBT-04).*
- [x] **FB-004 [P0]** Run không tồn tại hoặc user không thuộc project → từ chối; không tạo feedback hoặc cập nhật RAG. — *Đã phủ (2026-11-24): test/feedback-v14.spec.ts (FBT-02: không có quyền → FORBIDDEN, không tạo).*
- [x] **FB-005 [P0]** System admin gửi/đọc feedback tenant → xử lý theo giới hạn riêng trong handler, không bypass bằng CASL manage-all. — *Đã phủ (2026-11-24): test/feedback-wave7.spec.ts (admin bị chặn), test/feedback-v14.spec.ts (admin xoá kiểm duyệt có audit).*
- [x] **FB-006 [P0]** FindingId không thuộc kết quả run → không tạo liên kết giả; nếu chưa validate phải ghi RISK. — *Đã phủ (2026-11-24): test/feedback-v14.spec.ts (FBT-02: chặn theo trạng thái run). RISK còn mở: không đối chiếu `findingId` với kết quả — kết quả không sinh sẵn mã phát hiện (Phần 7 v14 FB-R5).*
- [x] **FB-007 [P1]** Update feedback chính mình → đúng nội dung và reason mới; user khác → Forbidden. — *Đã phủ (2026-11-24): test/feedback-wave7.spec.ts, test/feedback-v14.spec.ts (FBT-01).*
- [x] **FB-008 [P0]** Remove feedback chính mình/Owner được moderation/người khác → đúng policy từng nhánh, không xóa ngoài project. — *Đã phủ (2026-11-24): test/feedback-wave7.spec.ts, test/feedback-v14.spec.ts (FBT-01, FBT-09).*
- [x] **FB-009 [P1]** List run/finding với cursor hợp lệ/sai, hồ sơ author bị xóa → pagination đúng, không crash, không lộ dữ liệu user. — *Đã phủ (2026-11-24): test/feedback-wave7.spec.ts, test/feedback-v14.spec.ts (FBT-03, FBT-05), test/integration/repositories-domain.spec.ts (FBT-13).*
- [ ] **FB-010 [P1]** AI quality metrics → đúng count theo label/rate và mẫu số; không có feedback → không chia 0.
- [x] **FB-011 [P0]** Viewer xem metrics khi policy chỉ Owner/Member → Forbidden; admin bị hạn chế theo contract hiện tại. — *Đã phủ (2026-11-24): test/feedback-wave7.spec.ts.*
- [x] **FB-012 [P1]** Feedback đủ điều kiện RAG → normalize và upsert đúng ví dụ; chưa đủ trust/thiếu description/embedding rỗng → không lưu ví dụ. — *Đã phủ (2026-11-24): test/feedback-v14.spec.ts (FBT-06).*
- [x] **FB-013 [P1]** Cập nhật feedback đã có → không nhân đôi contribution; RAG lỗi không được làm sai trạng thái feedback đã persist. — *Đã phủ (2026-11-24): test/feedback-v14.spec.ts (FBT-06, FBT-07).*
- [x] **FB-014 [P1]** Emit feedback.created → đúng project/run và metadata an toàn, không gửi reason/raw text vào realtime payload. — *Đã phủ (2026-11-24): test/feedback-v14.spec.ts (FBT-11).*
