# Analysis: cấu hình, chạy, Tổng kết và PDF

- Ngày lập: 2026-11-16.
- Loại: Checklist unit test và ca hồi quy.
- Nguồn (tương đối với `src/backend/src/`): modules/analysis/application/commands; modules/analysis/application/queries; report-worker.service.ts; pdf-builder.util.ts.
- Cô lập dependency: analysis/dataset/record/project ports, AI port, storage, realtime, clock; PDF engine stub cho worker.
- Mỗi dòng là một nhóm ca; dấu `/` hoặc danh sách giá trị phải triển khai thành các ca riêng, không chỉ chọn một đại diện. Tất cả chưa thực thi.
- P0: quyền/dữ liệu/trạng thái cốt lõi; P1: logic và biên quan trọng. `RISK`/`GAP`/`OPEN` không phải khẳng định đã có lỗi được tái hiện.

## Các phần cần test

- [ ] **RUN-001 [P1]** Get config chưa có bản lưu → defaults đúng; đã có → map đầy đủ selected/label/time/value/method/topN.
- [ ] **RUN-002 [P1]** Save config chọn cột tồn tại → lưu đúng project/workspace; toàn cột lạ → lỗi; hỗn hợp cột đúng/sai cần ghi nhận lọc hiện tại.
- [ ] **RUN-003 [P1]** selected_columns undefined/null/[] → kiểm tra riêng ý nghĩa default/all/none; OPEN-06 nếu contract chưa rõ.
- [ ] **RUN-004 [P1]** Label categorical/boolean hợp lệ; number/date sai; time không date và value không number → lỗi trước persist.
- [ ] **RUN-005 [P1]** topN tại 0/1/5/20/21 và số lẻ → đúng biên DTO, mặc định 5; không nhầm TopN hiển thị với phạm vi phân tích.
- [ ] **RUN-006 [P0]** Save config thành công → kết quả cũ stale đúng project; save thất bại không đánh dấu như config đã lưu.
- [ ] **RUN-007 [P0]** Cấu hình không đổi hoặc chỉ TopN đổi → yêu cầu cũ không chạy lại thống kê; code hiện mark stale mọi lần, ghi GAP-007.
- [ ] **RUN-008 [P0]** Run ID sai/project không tồn tại/dataset thiếu → không tạo run/job hay đọc records.
- [ ] **RUN-009 [P0]** Còn columnIssues empty_name/duplicate_name → yêu cầu chặn run; kiểm tra handler thực tế thiếu gate tại GAP-003.
- [ ] **RUN-010 [P1]** Chỉ có một cột date → tự chọn theo contract; nhiều cột date chưa chọn → không tự đoán; date/value không thuộc dataset không được dùng.
- [ ] **RUN-011 [P0]** Run hợp lệ → running rồi succeeded, lưu result đúng run/project/fingerprint, tạo AI job; output thống kê đối chiếu STAT.
- [ ] **RUN-012 [P1]** Dataset records dùng stable key → map sang đúng cột đã chọn sau rename; không ghi đè dữ liệu khi display name trùng.
- [ ] **RUN-013 [P0]** Records/repository/thống kê lỗi → run failed, thời điểm/error code đúng, không giả succeeded; realtime lỗi không che lỗi nghiệp vụ.
- [ ] **RUN-014 [P0]** Lưu result thất bại sau update run succeeded → run cuối phải failed hoặc trạng thái nhất quán, không để client tin có result.
- [ ] **RUN-015 [P1]** Giới hạn evidence theo cột/loại → đúng rowIndex, capped và tổng số phản ánh evidence thực có; insert evidence thất bại không báo số đã lưu giả (RISK).
- [ ] **RUN-016 [P1]** Fingerprint cùng đầu vào → giống; dữ liệu/config ảnh hưởng phân tích đổi → khác; không chứa secret.
- [ ] **RUN-017 [P0]** Run mới hoàn tất → chỉ đánh dấu stale kết quả cũ cùng project, không ảnh hưởng project khác.
- [ ] **RUN-018 [P1]** Get result/job thiếu hoặc không thuộc project của request → lỗi; không lộ prompt/evidence của project khác qua ID trực tiếp.
- [ ] **RUN-019 [P0]** Tạo summary chưa có run, run running/failed, thiếu result → yêu cầu phân tích thành công trước; không createSave.
- [ ] **RUN-020 [P1]** Summary có missing/invalid/outlier/duplicate → đúng count/rate/evidence refs; không tạo vấn đề với count=0.
- [ ] **RUN-021 [P0]** AI failed/pending → summary có kết quả hệ thống, ai_section không giả lời giải thích; AI succeeded → dùng kết quả đã grounding.
- [ ] **RUN-022 [P0]** Result stale → không tạo summary mới từ kết quả cũ; handler hiện cần đối chiếu GAP-007.
- [ ] **RUN-023 [P1]** Summary hiện createSave và markSavesStale → characterization riêng; không coi là đã đáp ứng nút Lưu riêng trước đây (GAP-007).
- [ ] **RUN-024 [P1]** Get summary thiếu/đã có → NotFound hoặc payload đúng, giữ isStale/fingerprint; không tự chạy analysis.
- [ ] **RUN-025 [P0]** Request report chưa có summary → từ chối; hợp lệ → tạo job tham chiếu đúng bản dữ liệu, không sinh PDF đồng bộ trong controller.
- [ ] **RUN-026 [P1]** Report worker tắt/WORKER_MODE=api/busy/không có job → không build; claim một job → xử lý một lần, cuối cùng nhả busy cả khi lỗi.
- [ ] **RUN-027 [P0]** PDF engine hoặc storage throw → report failed, không có download success; summary mất → prerequisite error.
- [ ] **RUN-028 [P1]** PDF build thành công → đúng MIME/key/tên file, job succeeded sau upload; tiếng Việt/nội dung dài cần kiểm tra render tại INT-006.
- [ ] **RUN-029 [P0]** Job report của project khác, chưa succeeded, không có storageKey → không trả download; hợp lệ → đúng file.
- [ ] **RUN-030 [P0]** Summary mới xuất hiện trong lúc report chờ → report phải dùng snapshot được yêu cầu; nếu worker lấy latest cần ghi RISK và chốt contract.
- [ ] **RUN-031 [P1]** PDF chứa bộ số liệu, giới hạn AI, cấu hình và thay đổi cuối cùng → đối chiếu requirement, không dùng nội dung chưa lưu người khác; thiếu thì ghi GAP.
