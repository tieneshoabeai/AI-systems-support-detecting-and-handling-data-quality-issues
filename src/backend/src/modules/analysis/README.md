# Module `analysis` — Phân Tích DQ + AI + Báo Cáo

Trung tâm phân tích chất lượng dữ liệu: thuật toán DQ/ thống kê nội bộ (không cần AI) + job AI corr-v1 chạy nền + tóm tắt + báo cáo PDF. Module lớn nhất backend (56 tệp). Mọi kết quả đều gắn `input_fingerprint` để phát hiện dữ liệu đã đổi.

## 1. Vị trí và vai trò

- Đường dẫn: `src/backend/src/modules/analysis/`
- Loại kiến trúc: CQRS đầy đủ + 2 worker service + 14 util domain.
- Sở hữu: 7 collection (`analysis_runs`, `analysis_results`, `ai_jobs`, `cell_evidences`, `few_shot_examples` (tên collection thật `fewshotexamples`), `project_saves`, `report_jobs`).
- Cung cấp: `ANALYSIS_REPOSITORY_PORT`, `RAG_FEW_SHOT_PORT` (cho `feedback`), 2 policy loader.
- Phụ thuộc: `datasets` (quét bản ghi), `projects` (quyền), `realtime` (đẩy tiến độ), `shared` (Storage).

## 2. Cây thư mục đầy đủ

```text
analysis/
├── domain/ (14 util + 2 port)
│   ├── dq.util.ts                             # DQ-01 thiếu, DQ-02 trùng/sai kiểu, DQ-03 kiểu, DQ-04 ngoại lệ
│   ├── stats.util.ts                          # mean/median/min/max/stdev, mất cân bằng, chuỗi thời gian
│   ├── correlation.util.ts                    # pearson/spearman/cramers_v/eta_squared + MAX_CORRELATION_CELLS
│   ├── vif.util.ts                            # VIF đa cộng tuyến (ml-matrix)
│   ├── suspicion.util.ts                      # Nhóm nghi vấn (không phải lỗi xác nhận, không gửi AI)
│   ├── column-role.util.ts                    # identifier/category/measure/text/datetime (OPEN-06)
│   ├── impact.util.ts                         # Mức cao/trung bình/thấp + ngưỡng quy ước dự án
│   ├── ai-grounding.util.ts                   # Zod strict corr-v1, loại ảo giác AI
│   ├── rag-few-shot.util.ts                   # Cosine similarity thuần trong Mongo, tối đa 50000 mẫu
│   ├── pii-mask.util.ts                       # Che email/phone/CCCD -> ***, identifier/text -> dạng mẫu
│   ├── top-n.util.ts                          # DEFAULT_TOP_N 50, MAX_TOP_N 100
│   ├── date-parse.util.ts                     # Đọc ngày chặt, phân biệt dmy/mdy
│   ├── input-fingerprint.util.ts              # FINGERPRINT_VERSION 2, băm metadata cột
│   └── ports/analysis.repository.port.ts | rag-few-shot.port.ts
├── application/
│   ├── commands/ (6)
│   │   ├── run-analysis.handler.ts            # Chạy DQ/stats đồng bộ + tạo AI job corr-v1 bất đồng bộ
│   │   ├── build-prompt-for-job.handler.ts    # Dựng prompt (che PII + few-shot + top_n)
│   │   ├── ingest-ai-result.handler.ts        # Gắn kết quả AI đã grounding (bỏ qua job skipped)
│   │   ├── retry-job.handler.ts               # Tạo job mới, đánh dấu job cũ skipped (không giới hạn)
│   │   ├── create-summary.handler.ts          # Tạo tóm tắt từ kết quả mới nhất
│   │   └── request-report.handler.ts          # Tạo report job 202, không sinh PDF tại API
│   ├── queries/ (5)
│   │   ├── get-result / get-job / get-summary / get-report-file-meta / download-report-file
│   ├── services/ai-worker.service.ts          # Poll pending->running->gọi engine->grounding, concurrency 1
│   ├── services/rag-few-shot.service.ts      # Lưu/truy vấn mẫu few-shot (cơ chế T1)
│   ├── report-worker.service.ts               # Poll report job, dựng PDF, upload Storage
│   ├── pdf-builder.util.ts                    # PDFKit + font DejaVuSans giữ dấu tiếng Việt
│   ├── report-content.util.ts                 # Hàm thuần dựng nội dung PDF FULL
│   ├── analysis-limit.util.ts                 # ANALYSIS_MAX_ROWS 100000 + guard đồng thời (GĐ0)
│   ├── analysis.types.ts | analysis.utils.ts  # Kiểu + maskSampleValue
│   └── policy-loaders/analysis-job-policy.loader.ts | analysis-run-policy.loader.ts
├── infrastructure/
│   ├── ai/local-inference.adapter.ts          # vLLM (prod) / Ollama (dev), không log prompt
│   ├── ai/system-resource-guard.adapter.ts    # Đọc /proc/meminfo, chặn job khi RAM yếu
│   └── persistence/ (7 schema + mapper + repository)
│       ├── analysis-run.schema / analysis-result.schema / ai-job.schema
│       ├── cell-evidence.schema / few-shot-example.schema
│       └── project-save.schema (tóm tắt) / report-job.schema (PDF)
├── presentation/controllers/
│   ├── analysis.controller.ts (5 route) | summary.controller.ts (2 route) | report.controller.ts (2 route)
│   └── dtos/run-analysis.dto.ts               # correlation_method/outlier_method/top_n, mặc định {}, OPEN-06
├── assets/fonts/DejaVuSans*.ttf
├── analysis.module.ts
└── index.ts
```

## 3. Luồng chạy chi tiết

1. `POST /projects/:projectId/analysis` -> `RunAnalysisHandler`: kiểm tra `ANALYSIS_MAX_ROWS` và guard RAM/CPU trước khi đọc Mongo; quét bản ghi qua `RECORD_QUERY_PORT`; tính DQ-01..DQ-04, stats, correlation, VIF, suspicion; lưu `analysis_run` + `analysis_result`; tạo `ai_job` corr-v1 (pending) và trả 201 ngay.
2. `AiWorkerService` (poll): nhận job pending -> running (lease 10 phút), kiểm tra `ResourceGuard`, dựng prompt (`BuildPromptForJobHandler`: che PII, gắn few-shot từ `feedback`, cắt top_n), gọi `LocalInferenceAdapter` (vLLM/Ollama), tách JSON (`extractJsonObject`), grounding strict (`ai-grounding`), lưu qua `IngestAiResultHandler`. Job AI kết thúc (thành công, grounding không đạt, hoặc hết lượt) → thông báo `ai_analysis_ready` cho người chạy phân tích (K6). Job cũ bị retry sẽ thành `skipped`, kết quả trễ không ghi đè. Lỗi JSON khi còn lượt: chỉ trả job về `pending` để thử lại; hết `AI_MAX_RETRIES`: job `failed` mã `AI_FAILED` (đợt K1).
3. `POST /projects/:projectId/summary` -> `CreateSummaryHandler`: lấy kết quả mới nhất, kiểm tra fingerprint (dữ liệu đổi thì đánh `is_stale`), sinh tóm tắt 5 mức ảnh hưởng + nghi vấn + cấu hình đã dùng.
4. `POST /projects/:projectId/report` -> `RequestReportHandler`: tạo `report_job` 202. `ReportWorkerService` dựng PDF (`buildReportSections` thuần + `buildReportPdfAsync` PDFKit/DejaVuSans, tối đa 500 dòng bằng chứng), upload Storage, đánh `succeeded`. `report_job` có lease (`lease_expires_at`, `attempt`): job `running` hết lease được nhận lại, đủ 3 lượt → `failed` mã `REPORT_LEASE_EXPIRED` (đợt K5).

## 4. Route đầy đủ (9 route, 3 controller bare)

| Phương thức | Đường dẫn đầy đủ | Mô tả |
|---|---|---|
| POST | `/api/v1/projects/:projectId/analysis` | Chạy phân tích hệ thống + tạo AI job (201, ANALYSIS-02). |
| GET | `/api/v1/projects/:projectId/analysis/result` | Kết quả DQ + correlation + VIF + nhận xét AI, không trả `suspicions` thô (ANALYSIS-03). |
| GET | `/api/v1/analysis/jobs/:jobId` | Trạng thái AI job corr-v1 (AI-01). |
| POST | `/api/v1/analysis/jobs/:jobId/retry` | Thử lại, tạo job mới (202, không giới hạn). Ghi audit `AI_JOB_RETRIED`. |
| POST | `/api/v1/analysis/jobs/:jobId/result` | Gắn kết quả AI nội bộ đã grounding. **Chỉ SYS-ADMIN** (`can(Manage, 'all')`); trả 404 khi `NODE_ENV=production`; ghi audit `AI_RESULT_INGESTED`. Worker gọi thẳng `IngestAiResultHandler`, không qua route này. |
| POST | `/api/v1/projects/:projectId/summary` | Tạo tóm tắt (SUMMARY-01). |
| GET | `/api/v1/projects/:projectId/summary` | Xem tóm tắt mới nhất. |
| POST | `/api/v1/projects/:projectId/report` | Yêu cầu sinh PDF ở worker (202, REPORT-01). |
| GET | `/api/v1/projects/:projectId/report/:reportId/file` | Tải PDF do worker sinh. |

Tất cả đều JWT + `ProjectScopePolicyLoader`/`AnalysisJobPolicyLoader` + `can(Read/Execute, Analysis)`, trừ `POST …/jobs/:jobId/result` như trên (Phần 6 v9 §3.22, Phần 7 v15 §3.25).

## 5. Bất biến

- Chặn quá tải: `ANALYSIS_MAX_ROWS=100000`, `AI_MIN_RAM_GB`/`AI_RAM_GUARD_PERCENT`, giới hạn đồng thời + cardinality ma trận tương quan.
- Controller không import pdfkit/puppeteer; PDF chỉ sinh ở worker rồi `uploadStream`.
- Prompt không log (chứa dữ liệu nhạy cảm dù đã che); chỉ log độ dài + thời gian.
- Fingerprint đổi khi PII/metadata đổi -> kết quả cũ đánh stale.
- Thông báo cho người chạy phân tích (`analysis_completed` / `analysis_failed` / `ai_analysis_ready`, K6) đi qua `AnalysisNotifierService` → `dispatchNotificationViaPorts` của `notifications` (cách module `issues`, không email); lỗi thông báo không bao giờ làm hỏng luồng phân tích. Summary lỗi chỉ nêu mã lỗi.

## 6. Test liên quan

`test/unit/analysis/` (thêm `analysis-k6-notifications.spec.ts` cho K6), `test/e2e/analysis-report-summary.e2e-spec.ts`, `test/k6/analysis-latency.js` (1 VU, p95 dưới 8000ms với 100k dòng).
