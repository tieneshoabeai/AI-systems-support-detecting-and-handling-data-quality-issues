# AI: prompt, grounding, retry, worker và RAG

- Ngày lập: 2026-11-16.
- Loại: Checklist unit test và ca hồi quy.
- Nguồn (tương đối với `src/backend/src/`): modules/analysis/domain/ai-grounding.util.ts; pii-mask.util.ts; rag-few-shot.util.ts; application/services; application/commands/build-prompt-for-job.handler.ts; ingest-ai-result.handler.ts; retry-job.handler.ts; infrastructure/ai/local-inference.adapter.ts.
- Cô lập dependency: AI inference, repository, embedding/retrieval port, clock, fetch/HTTP transport; không gọi model thật.
- Mỗi dòng là một nhóm ca; dấu `/` hoặc danh sách giá trị phải triển khai thành các ca riêng, không chỉ chọn một đại diện. Tất cả chưa thực thi.
- P0: quyền/dữ liệu/trạng thái cốt lõi; P1: logic và biên quan trọng. `RISK`/`GAP`/`OPEN` không phải khẳng định đã có lỗi được tái hiện.

## Các phần cần test

- [ ] **AI-001 [P0]** Prompt từ result/run hợp lệ → số liệu và tên cột khớp cùng fingerprint; thiếu job/result/dataset → lỗi, không gọi inference.
- [ ] **AI-002 [P0]** Prompt có raw file/ô mẫu/PII → theo yêu cầu cũ chỉ thống kê nên không được gửi; maskedSamples hiện có phải xử lý theo GAP-009 trước khi đóng ca.
- [ ] **AI-003 [P1]** Mask email/phone/CCCD và cột đánh dấu PII → không lộ giá trị; dữ liệu không che được bị loại thay vì gửi nguyên.
- [ ] **AI-004 [P1]** Mask null/empty/số/chuỗi rất dài/object/Unicode → không crash, không biến object thành chuỗi chứa dữ liệu nhạy cảm ngoài ý muốn.
- [ ] **AI-005 [P0]** AI trả JSON đúng schema, claim số khớp → giữ claim; sai kiểu/thiếu trường/field thừa → schema validation theo strict contract.
- [ ] **AI-006 [P0]** Claim dùng cột/cặp/VIF không tồn tại → loại và lưu droppedClaims; không tạo chứng cứ giả.
- [ ] **AI-007 [P1]** Hệ số AI lệch dưới/bằng/trên tolerance 0.01 → xử lý đúng biên theo grounding, số hệ thống vẫn là nguồn chuẩn.
- [ ] **AI-008 [P1]** AI có NaN/Infinity/null không đúng schema → không đưa số không hợp lệ ra response/JSON/PDF.
- [ ] **AI-009 [P1]** Chỉ một phần claim hợp lệ → giữ phần hợp lệ, phản ánh phần bị loại; toàn bộ sai → không báo lời giải thích đáng tin cậy.
- [ ] **AI-010 [P1]** Notable pairs sort |coef| giảm dần, highVif sort giảm dần, ties → thứ tự xác định; limits/nextSteps không bị cắt ngoài contract.
- [ ] **AI-011 [P0]** AI suy ra DQ05/causal conclusion/rule tự tạo → không thay đổi kết luận hệ thống thành vi phạm đã xác nhận.
- [ ] **AI-012 [P0]** Job cũ hoặc khác fingerprint gửi kết quả trễ → không ghi đè result mới; hiện thiếu kiểm tra thì ghi RISK.
- [ ] **AI-013 [P1]** Retry thiếu job → NotFound; attempt dưới/bằng/trên max → pending hoặc từ chối đúng; error/start/end được reset đúng.
- [ ] **AI-014 [P0]** Retry job đang chạy/đã xong hoặc result stale → không tạo chạy trùng ngoài contract; trạng thái được phép retry cần OPEN-07.
- [ ] **AI-015 [P1]** Worker disabled/API-only/busy/no-job → không gọi AI; tick thất bại phải nhả busy.
- [ ] **AI-016 [P0]** AI timeout/network/provider error/JSON malformed → failed có lỗi an toàn, không làm mất kết quả hệ thống.
- [ ] **AI-017 [P1]** Worker thành công → persist assessment, update job, phát sự kiện đúng project/run; realtime throw không làm hỏng kết quả.
- [ ] **AI-018 [P0]** Hai tick hoặc hai worker claim cùng job → unit mô phỏng một port claim thắng; atomic claim thật nằm INT-004.
- [ ] **AI-019 [P1]** RAG vector giống nhau/đối nhau/trực giao/zero/different dimensions → cosine hữu hạn hoặc contract lỗi rõ, không chia 0.
- [ ] **AI-020 [P1]** RAG lọc workspace/errorType/language/trust/tuổi → không lấy mẫu tenant khác, hết hạn hoặc thiếu tin cậy.
- [ ] **AI-021 [P1]** TopK mặc định 5, ít hơn 5 hoặc không có mẫu → đúng số và sort score, block rỗng khi không có dữ liệu.
- [ ] **AI-022 [P0]** Feedback text chứa PII hoặc câu lệnh giả → normalize/redact trước lưu/render; nội dung ví dụ không trở thành chỉ thị hệ thống.
- [ ] **AI-023 [P1]** Mapping feedback label/error type, agreement/trust với ít/đủ người → eligibility đúng, không tính lặp một người thành nhiều phiếu độc lập.
- [ ] **AI-024 [P1]** Embedding cùng text → xác định, L2 đúng; empty text vector zero; cap kho và loại FIFO đúng phạm vi workspace theo adapter.
- [ ] **AI-025 [P1]** RAG hoặc embedding lỗi → phân tích cơ bản tiếp tục nếu fallback đã thiết kế; không đưa error raw vào prompt.
- [ ] **AI-026 [P0]** Local inference adapter thiếu cấu hình/HTTP lỗi/token secret → mapping lỗi rõ, không log secret; contract provider hiện tại không đồng nghĩa đã phê duyệt model mới.
