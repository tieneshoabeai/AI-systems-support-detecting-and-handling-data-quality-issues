# MÔ-ĐUN `analysis` — Phân tích chất lượng dữ liệu & AI

> **Đặc tả mô-đun & Tài liệu kỹ thuật**

## 1. Thông tin phiên bản (Version Information)

- **Phiên bản hiện tại:** v1.1.0
- **Cập nhật lần cuối:** 2026-11-21
- **Đường dẫn mô-đun:** `src/backend/src/modules/analysis` (56 tệp TypeScript)
- **Tầng kiến trúc:** Clean Architecture 4 tầng (`domain` → `application` → `infrastructure` → `presentation`)
- **Quy tắc tầng:** CA1–CA14 — xem [`../README.md`](../README.md)

## 2. Mục đích & Phạm vi nghiệp vụ (Scope & Responsibility)

Mô-đun lõi của hệ thống: chạy **phân tích chất lượng dữ liệu (DQ)** bằng thống kê xác định, sau đó giao cho **AI cục bộ** diễn giải kết quả và sinh khuyến nghị.

```text
Dataset ---> Chạy phân tích ---> Quy tắc DQ (xác định) ---> AI Grounding ---> Suy luận AI
                  |                                                       |
                    `------------------> Kết quả phân tích <---------------- Chuỗi AI Job
                                        |
                                        |---> Báo cáo (PDF)
                                        |---> Tóm tắt (Summary)
                                        `---> Phản hồi (Human-in-the-Loop)
```

### 2.1. Tính năng thuộc phạm vi

| Chức năng | Nội dung |
|---|---|
| Chạy phân tích | Thống kê DQ, tương quan, VIF, trùng lặp, ngoại lai |
| AI Job | Đưa job vào hàng đợi, worker thực thi, retry, lease, heartbeat |
| Kết quả | Lưu & đọc kết quả chạy phân tích, ô bằng chứng (cell evidence) |
| Báo cáo | Sinh PDF từ kết quả |
| Tóm tắt | Tạo & đọc bản tóm tắt |
| RAG few-shot | Thu thập phản hồi, chọn ví dụ cho prompt tối ưu |

### 2.2. Cấu trúc thư mục

```text
analysis/
|-- domain/                            # Toàn bộ thuật toán thuần, không framework
|   |-- dq.util.ts                    # DQ-01/02: thiếu, sai kiểu, trùng lặp
|   |-- stats.util.ts                 # Thống kê mô tả
|   |-- correlation.util.ts           # Pearson, Spearman, Cramer's V, Eta^2
|   |-- vif.util.ts                   # VIF (đa cộng tuyến)
|   |-- column-role.util.ts           # Phân vai trò cột
|   |-- date-parse.util.ts            # Nhận diện thứ tự ngày/tháng
|   |-- impact.util.ts                # Mức độ ảnh hưởng của finding
|   |-- suspicion.util.ts             # Nghi vấn (quy tắc dựa trên mẫu)
|   |-- ai-grounding.util.ts          # Chuẩn bị grounding cho AI
|   |-- pii-mask.util.ts              # Che PII trước khi gửi AI
|   |-- top-n.util.ts                 # Top-N
|   |-- input-fingerprint.util.ts     # Dấu vân tay đầu vào
|   |-- rag-few-shot.util.ts          # Chuẩn hoá & chọn ví dụ few-shot
|   `-- ports/
|       |-- analysis.repository.port.ts
|       `-- rag-few-shot.port.ts
|-- application/
|   |-- commands/
|   |   |-- run-analysis.handler.ts          # Chạy phân tích
|   |   |-- build-prompt-for-job.handler.ts  # Dựng prompt
|   |   |-- ingest-ai-result.handler.ts      # Nạp kết quả AI
|   |   |-- retry-job.handler.ts             # Thử lại job
|   |   |-- request-report.handler.ts        # Yêu cầu báo cáo
|   |   `-- create-summary.handler.ts        # Tạo tóm tắt
|   |-- queries/                     # 5 query handler
|   |-- services/
|   |   |-- ai-worker.service.ts            # Worker AI
|   |   |-- rag-few-shot.service.ts
|   |   `-- report-worker.service.ts
|   |-- ports/
|   |   |-- ai-inference.port.ts             # Cổng suy luận AI
|   |   `-- resource-guard.port.ts           # Cổng bảo vệ tài nguyên
|   |-- report-content.util.ts               # Nội dung báo cáo (mục PDF)
|   |-- pdf-builder.util.ts                  # Dựng PDF
|   `-- policy-loaders/                     # 2 loader
|-- infrastructure/
|   |-- ai/
|   |   |-- local-inference.adapter.ts       # Ollama / vLLM
|   |   `-- system-resource-guard.adapter.ts # Đọc /proc/meminfo
|   `-- persistence/                        # 7 schema
`-- presentation/
    |-- controllers/analysis.controller.ts
    |-- controllers/report.controller.ts
    |-- controllers/summary.controller.ts
    `-- dtos/run-analysis.dto.ts
```

## 3. Nhật ký Prompting & Quyết định kỹ thuật (Prompting Log & Rationale)

- **Yêu cầu người dùng / Ý đồ nghiệp vụ:** Đưa **quyết định chất lượng dữ liệu** về phía máy (thống kê xác định, lặp lại được, kiểm chứng được) và chỉ dùng **AI** cho phần **diễn giải** và **khuyến nghị** — nơi máy không làm được. Ngoài ra, hệ thống phải **an toàn tài nguyên** khi suy luận AI, và **không bao giờ** gửi dữ liệu PII ra ngoài.

- **Lập luận kỹ thuật & Quyết định:**

1. **Tách phần xác định khỏi phần diễn giải.** Thống kê DQ, tương quan, VIF là **xác định (deterministic)** — chạy lại cho kết quả giống hệt, kiểm chứng được, giải thích được. AI chỉ diễn giải, ví dụ: "cột `tuổi` thiếu 42% dữ liệu, đây là nguyên nhân chính". Tách hai tầng này tránh hiện tượng AI báo kết quả sai mà vẫn có vẻ đúng.

2. **Cramér's V dạng thưa (GĐ8).** Ma trận liên hợp **đặc** với 2 cột phân loại 20 giá trị × 20 giá trị × 100.000 dòng tạo ma trận 4 triệu ô — vừa chậm vừa tốn bộ nhớ. Công thức Cramer's V chỉ cần `chi-square = sum((O-E)^2/E)` và `V = sqrt(chi2/(n*(min(r,c)-1)))`. `correlation.util.ts` duyệt một lần qua các cặp giá trị đã **nén** (đếm số lần xuất hiện), tính trực tiếp tổng mà không cần bảng. Kết quả **giống hệt** công thức gốc nhưng chỉ dùng O(distinct) bộ nhớ.

3. **VIF có cảnh báo mất mẫu.** VIF chỉ dùng được trên các dòng có **đủ** dữ liệu cho tất cả các cột. Nếu chỉ 40% dòng đủ, kết quả không đáng tin. Mô-đun tính `commonNRate` và cảnh báo: ≥ 80% không cảnh báo; 50–80% "cần thận trọng"; < 50% cảnh báo nghiêm trọng. Ma trận kỳ dị (cột phụ thuộc tuyến tính) được đánh dấu `singular: true` và các cột liên quan `computable: false` kèm `reason`.

4. **Quy ước số học thống nhất (OPEN-10).** Mọi hệ số tương quan dùng **phương sai mẫu** (sample standard deviation), không phải phương sai tổng thể.

5. **Vai trò cột dùng chung cho cả hai tầng (GĐ7).** `column-role.util.ts` phân loại cột thành `identifier | category | measure | text | datetime`. Cột `identifier` (giá trị gần như duy nhất) và cột `text` bị **loại** khỏi tương quan và VIF. Cột do người dùng chỉ định có `source: 'user'`; cột do hệ thống suy luận có `source: 'system'` + `uncertain: true` + `reason`. `run-analysis.handler.ts` và `build-prompt-for-job.handler.ts` **cùng** dùng logic này — cột bị loại khỏi phân tích toán học cũng bị loại khỏi prompt AI, tránh việc AI suy diễn về cột không liên quan.

6. **Dấu vân tay (fingerprint) phát hiện dữ liệu cũ (stale).** `FINGERPRINT_VERSION = 2` băm dấu vân tay của `dataset.id + file_checksum + row_count + columns[{key,name,data_type,is_pii}]`. Khi dataset hoặc cột **thay đổi**, kết quả cũ bị đánh dấu hết hạn thay vì hiển thị như còn hiệu lực. Cột tham chiếu bằng **khóa bất biến** `c{i}` chứ không phải tên — người dùng có thể đổi tên cột bất kỳ lúc nào.

7. **Bảo vệ tài nguyên chống OOM.** `SystemResourceGuardAdapter` đọc `/proc/meminfo` + RSS tiến trình. Khi RAM còn < `AI_MIN_RAM_GB` (4 GB) hoặc RAM đã dùng > `AI_RAM_GUARD_PERCENT` (90%), worker **từ chối** job mới. Job bị từ chối **không bị mất** — nó ở lại hàng đợi và được thử lại ở vòng poll sau.

8. **Giới hạn số dòng đưa vào prompt.** `ANALYSIS_MAX_ROWS` (mặc định 100.000) và `run-analysis.handler.ts` **đơn giản hoá bản sao trung gian** để giảm đỉnh RAM.

9. **Che PII trước khi gửi AI.** `pii-mask.util.ts` che giá trị của cột `is_pii` **trước** khi gửi sang mô hình. Dù mô hình chạy cục bộ, dữ liệu PII ở dạng rõ cũng không nên được gửi đi.

10. **RAG few-shot động = AI học lại.** `rag-few-shot.util.ts` lọc theo `trust_score` và `max_age_days`, chuẩn hoá, `stripIdentifiers` (loại định danh cá nhân), chọn `top_k`. Đây là cơ chế học lại mà không cần huấn luyện lại mô hình.

11. **Báo cáo PDF và bản tóm tắt dùng chung bảng nội dung.** `report-content.util.ts` dựng các mục báo cáo; `pdf-builder.util.ts` render PDF. `create-summary.handler.ts` tạo bản **Tóm tắt** dùng chung bảng nội dung với báo cáo — hai đầu ra không lệch nhau.

- **Hiện vật đã tạo / đã sửa:**

- `domain/dq.util.ts` — `isMissingCell`, `isMissingToken`, quy tắc DQ-01/02.
- `domain/correlation.util.ts` — 4 loại hệ số, Cramer's V dạng thưa.
- `domain/vif.util.ts` — VIF qua `ml-matrix`, `commonNRate`, cảnh báo mất mẫu.
- `domain/column-role.util.ts` — 5 vai trò cột, nguồn `user` / `system`.
- `domain/input-fingerprint.util.ts` — `FINGERPRINT_VERSION = 2`.
- `domain/pii-mask.util.ts` — che PII trước khi gửi AI.
- `domain/rag-few-shot.util.ts` — chọn ví dụ few-shot.
- `infrastructure/ai/local-inference.adapter.ts` — Ollama / vLLM, `extractJsonObject`.
- `infrastructure/ai/system-resource-guard.adapter.ts` — đọc `/proc/meminfo`.
- `application/services/ai-worker.service.ts` — vòng đời job, lease, heartbeat, retry.

## 4. Đặc tả giao tiếp kỹ thuật (Technical Contracts & API Specifications)

### 4.1. Điểm cuối (Endpoints)

| Phương thức | Đường dẫn | Chính sách | Mô tả |
|---|---|---|---|
| `POST` | `/api/v1/projects/:projectId/analysis` | `Action.Execute` | Chạy phân tích |
| `GET` | `/api/v1/projects/:projectId/analysis/result` | `Action.Read` | Kết quả gần nhất |
| `GET` | `/api/v1/analysis/jobs/:jobId` | `Action.Read` | Trạng thái job AI |
| `POST` | `/api/v1/analysis/jobs/:jobId/retry` | `Action.Execute` | Thử lại job |
| `POST` | `/api/v1/analysis/jobs/:jobId/result` | Nội bộ | Nạp kết quả AI (worker) |
| `POST` | `/api/v1/projects/:projectId/report` | `Action.Create` | Yêu cầu báo cáo PDF |
| `GET` | `/api/v1/projects/:projectId/report/:reportId/file` | `Action.Read` | Tải báo cáo |
| `POST` | `/api/v1/projects/:projectId/summary` | `Action.Create` | Tạo bản tóm tắt |
| `GET` | `/api/v1/projects/:projectId/summary` | `Action.Read` | Đọc bản tóm tắt |

### 4.2. Giao diện / Provider được xuất ra ngoài

`src/backend/src/modules/analysis/index.ts` xuất hợp đồng công khai:

| Tên xuất | Vai trò |
|---|---|
| `AnalysisModule` | Mô-đun Nest |
| Thực thể `Analysis`, `Finding`, `CellEvidence` | Hợp đồng domain |
| `ANALYSIS_REPOSITORY_PORT` | Cổng truy vấn kết quả |
| `RAG_FEW_SHOT_PORT` | Cổng lấy ví dụ few-shot |

> **Không có `AI_INFERENCE_PORT` hay `RESOURCE_GUARD_PORT` trong hợp đồng công khai.**
> - `AI_INFERENCE_PORT` **không tồn tại**: adapter suy luận AI (`LocalInferenceAdapter`)
>   đọc cấu hình trực tiếp qua `ConfigService` (`AI_INFERENCE_BASE_URL`,
>   `AI_INFERENCE_API_KEY`) và được inject nội bộ trong `AnalysisModule`.
> - `RESOURCE_GUARD_PORT` là cổng **nội bộ của mô-đun** (`application/ports/resource-guard.port.ts`),
>   được hiện thực bởi `SystemResourceGuardAdapter`. Không tái xuất ra ngoài `index.ts`.

### 4.3. Sự kiện domain phát ra

| Sự kiện | Khi nào | Mục đích |
|---|---|---|
| `analysis.completed` | Phân tích xong | Thông báo + realtime |
| `analysis.failed` | Phân tích thất bại | Thông báo + realtime |
| `ai.job.queued` | Job AI vào hàng đợi | Realtime |
| `ai.job.status` | Job đổi trạng thái | Realtime tiến độ |
| `ai.quality.updated` | Kết quả AI có nhận xét | Realtime |
| `report.ready` | Báo cáo PDF xong | Thông báo |

## 5. Ràng buộc & Tiêu chuẩn bất biến (Invariants & Security Rules)

### 5.1. Bất biến nghiệp vụ

- Kết quả phân tích **phải** kèm `input_fingerprint`; kết quả có fingerprint lệch với dataset hiện tại bị đánh dấu **cũ (stale)**.
- Cột bị loại khỏi phân tích toán học **phải** bị loại khỏi prompt AI (cùng dùng `column-role.util.ts`).
- Mọi báo cáo phân tích phải nêu rõ **bao nhiêu dòng thực sự được kiểm tra** (`checkedRows`, `excludedRows`, `method`, `reason`).
- VIF không được báo cáo mà **không kèm** cảnh báo mất mẫu khi `commonNRate` < 80%.
- Hệ số tương quan dùng **phương sai mẫu**, không dùng phương sai tổng thể.
- Một cột boolean **không** được tính histogram số.
- Giá trị null khi sắp xếp theo số / ngày **phải** nằm ở cuối danh sách.
- Job AI **không** được nhận khi `SystemResourceGuardAdapter` báo RAM không đủ.
- Job AI hết lease **phải** có thể được worker khác nhận lại — không để kẹt.
- `ANALYSIS_MAX_ROWS` **phải** được tôn trọng khi dựng prompt.

### 5.2. Xoá mềm (Soft Delete)

- **Chuẩn:** `deleted_at: Date | null` — trường này **null** nghĩa là bản ghi đang hoạt động.
- **Quy tắc truy vấn:** mọi truy vấn mặc định luôn lọc `deleted_at: null`. Repository nền (`shared/infrastructure/database/base-mongo.repository.ts`) áp dụng điều này tự động.
- **Chơi index Partial Unique:** `partialFilterExpression: { deleted_at: null }` — cho phép tài khoản / tên / email đã xoá mềm được tạo lại.

### 5.3. Bảo mật

| Vấn đề | Cách xử lý |
|---|---|
| PII lộ khi suy luận AI | `pii-mask.util.ts` che giá trị cột `is_pii` trước khi gửi |
| PII lộ qua RAG few-shot | `stripIdentifiers` loại định danh cá nhân khỏi ví dụ |
| OOM khi suy luận | `SystemResourceGuardAdapter` + `ANALYSIS_MAX_ROWS` + đơn giản hoá bản sao |
| Đọc kết quả của project khác | Policy loader kiểm tra instance `projectId` |
| Tải báo cáo của người khác | Policy loader trên `projectId` |
| Kết quả AI giả mạo | `ingest-ai-result.handler.ts` validate payload bằng schema |
| Prompt injection từ dữ liệu | Chỉ đưa dữ liệu đã che PII vào prompt, định dạng rõ ràng |

### 5.4. Phân quyền

| Tuyến đường | Chính sách |
|---|---|
| `POST /projects/:projectId/analysis` | `Action.Execute` trên `Analysis` — PROJ-MEMBER trở lên |
| `GET /projects/:projectId/analysis/result` | `Action.Read` |
| `GET /analysis/jobs/:jobId` | `Action.Read` + policy loader kiểm tra job thuộc project của tôi |
| `POST /analysis/jobs/:jobId/retry` | `Action.Execute` |
| `POST /analysis/jobs/:jobId/result` | **Nội bộ** — chỉ worker, không phải route công khai cho client |
| `POST /projects/:projectId/report` | `Action.Create` |
| `GET /projects/:projectId/report/:reportId/file` | `Action.Read` + kiểm tra báo cáo thuộc project |
| `POST /projects/:projectId/summary` | `Action.Create` |
| `GET /projects/:projectId/summary` | `Action.Read` |

## 6. Lịch sử thay đổi (Change Log & Version History)

### 2026-11-21
- **v1.1.0** / 2026-11-21 / Viết lại README mô-đun đầy đủ theo chuẩn 6 phần / Yêu cầu tái đọc / Tài liệu mẫu chuẩn

### 2026-11-XX
- **v1.4.0** / 2026-11-XX / Bổ sung `local-inference.adapter.ts` (Ollama / vLLM) và `system-resource-guard.adapter.ts` / Chuyển sang AI cục bộ, không gọi API bên ngoài; chống OOM / `modules/analysis`
- **v1.3.0** / 2026-11-XX / Bổ sung `column-role.util.ts` và nối vào cả `run-analysis` và `build-prompt-for-job` (GĐ7) / Loại cột không liên quan khỏi cả phân tích toán học và prompt / `modules/analysis`
- **v1.2.0** / 2026-11-XX / Cramer's V dạng thưa (GĐ8) + quy ước số học OPEN-10 / Giảm bộ nhớ, chuẩn hoá phương sai mẫu / `modules/analysis`
- **v1.1.0** / 2026-11-XX / Bổ sung `input-fingerprint.util.ts` (`FINGERPRINT_VERSION = 2`) / Phát hiện kết quả cũ (stale) / `modules/analysis`
- **v1.0.0** / 2026-11-XX / Bổ sung VIF + cảnh báo mất mẫu + `ANALYSIS_MAX_ROWS` và đơn giản hoá bản sao (GĐ0) / Bảo vệ tài nguyên / `modules/analysis`
- **v0.9.0** / 2026-11-XX / Bổ sung `rag-few-shot.util.ts` và cổng RAG / Vòng lặp Human-in-the-Loop / `modules/analysis`, `modules/feedback`
- **v0.8.0** / 2026-11-XX / Bổ sung `report-content.util.ts` + `pdf-builder.util.ts` và report worker / Báo cáo PDF, bản tóm tắt dùng chung nội dung / `modules/analysis`
- **v0.1.0** / 2026-11-XX / Tạo mô-đun, tách `analysis-config` thành command riêng / Bỏ endpoint `/analysis/config`, cấu hình chuyển vào body / `modules/analysis`

- **Định dạng:** `[Phiên bản] / [Ngày] / [Thay đổi gì] / [Lý do] / [Ảnh hưởng đến đâu]`
