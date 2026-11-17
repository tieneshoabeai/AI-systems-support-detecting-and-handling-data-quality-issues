# KẾ HOẠCH HOÀN THIỆN MODULE ANALYSIS
**Dự án:** Nền tảng Full-stack Quản lý & Giám sát Chất lượng Dữ liệu có AI Hỗ trợ
**Tập tin:** `docs/modules/analysis_plan.md`
**Phiên bản:** v1.3 (2026-11-17)
**Trạng thái:** Đã thực hiện đợt A, B, C (commit `f9f61eb`) và D, E
**Module:** `src/backend/src/modules/analysis/` (Data Analysis & Detection, Tổng kết, Báo cáo PDF, AI corr-v1)

---

## 1. Bối cảnh & 3 câu hỏi cốt lõi
- **Đang làm gì?** Rà soát module `analysis` đã hiện thực và sửa các điểm chưa khớp spec Phần 2 v9 (SUMMARY-01, AI-01, REPORT-01).
- **Cho ai?** Analyst / thành viên project chạy phân tích, tạo Tổng kết và xuất PDF; Viewer tải PDF.
- **Để làm gì?** Đảm bảo Tổng kết/PDF không dùng kết quả lỗi thời, AI job thử lại đúng quy tắc, PDF đúng bản Tổng kết đã yêu cầu và đủ nội dung "PDF FULL".

## 2. Hiện trạng (rà soát 2026-11-17)
- ~5.200 dòng TypeScript, kiến trúc ports & adapters (`domain/` — `application/` — `infrastructure/`).
- Test: `corr-vif-ai.spec.ts` + `test/analysis-wave5.spec.ts` — **49/49 pass**; `tsc --noEmit` không lỗi trong module.

| Mã | Endpoint | Chức năng | Trạng thái |
|---|---|---|---|
| ANALYSIS-01 | `POST/GET /projects/:projectId/analysis/config` | Lưu/xem cột chọn, nhãn, thời gian, giá trị, phương pháp | Xong |
| ANALYSIS-02 | `POST /projects/:projectId/analysis` | Chạy đồng bộ: DQ-01..04, thống kê mô tả, mất cân bằng (IR ≥ 3), phân tích thời gian, ma trận tương quan (Pearson/Spearman, Cramér's V, η²), VIF, bằng chứng ≤ 20 ô/cột che PII; tạo AI job `corr-v1` | Xong |
| ANALYSIS-03 | `GET /projects/:projectId/analysis/result` | Kết quả mới nhất | Xong, thiếu `isStale` |
| AI-01 | `GET /analysis/jobs/:jobId`, `POST .../retry`, `POST .../result` | Trạng thái, thử lại, gắn kết quả AI; worker poll Ollama/vLLM, lease 10 phút, grounding, RAG few-shot | Có lỗi |
| SUMMARY-01 | `POST/GET /projects/:projectId/summary` | Tổng hợp vấn đề DQ + khuyến nghị + phần AI | Có lỗi |
| REPORT-01 | `POST /projects/:projectId/report`, `GET .../report/:reportId/file` | Worker sinh PDF, tải file + audit | Cơ bản |
| DQ-05 | — | Luôn `unassessed` | Hoãn theo spec |

## 3. Thiếu sót và hướng sửa
| # | Vấn đề | Vị trí | Hướng sửa |
|---|---|---|---|
| 1 | Tổng kết tạo được từ kết quả stale | `application/summary.service.ts` `createSummary` | Kiểm `result.isStale` → 409 `ANALYSIS_RESULT_STALE` |
| 2 | PDF dựng từ bản Tổng kết mới nhất thay vì bản đã yêu cầu | `application/report-worker.service.ts` `buildPdf` | Thêm `findSaveById` vào port/repository, dùng `job.projectSaveId` |
| 3 | Lỗi JSON từ model làm job `failed` dù còn lượt | `application/services/ai-worker.service.ts` (catch) | Chỉ ingest rỗng khi hết lượt |
| 4 | Log "succeeded" khi grounding thất bại | như trên | Kiểm `status` trả về từ `ingestAiResult` |
| 5 | Retry không kiểm trạng thái/stale | `application/analysis.service.ts` `retryJob` | Chỉ `failed`/`skipped`; từ chối khi stale |
| 6 | Route job không kiểm quyền theo project (IDOR); ingest mở rộng | `infrastructure/http/analysis.controller.ts` | Kiểm quyền project của `job.projectId`; ingest chỉ `SYS-ADMIN`/tắt ở production |
| 7 | Report job kẹt `running` không thu hồi | `report-worker.service.ts`, `report-job.schema.ts` | Lease + heartbeat như `ai_job` |
| 8 | `top_n` nhận nhưng không dùng | `summary.service.ts`, `report-worker.service.ts` | Giới hạn số phát hiện theo `top_n` |
| 9 | `getResult` thiếu `isStale/staleReason` | `analysis.service.ts` `toApiShape` | Bổ sung trường |
| 10 | PDF chưa đủ "PDF FULL", tiếng Việt không dấu | `application/pdf-builder.util.ts` | Thêm bảng ma trận/VIF/mô tả/imbalance/time/bằng chứng; font Unicode |
| 11 | Code chết, ép kiểu thừa, lặp logic map `props→named` 3 lần | `analysis.service.ts` | Dọn, gom helper |

**Ngoài phạm vi:** DQ-05 rule engine; chuyển AI job sang Kafka; phân tích bất đồng bộ cho dataset lớn (`listAllRecords` nạp toàn bộ vào RAM).

## 4. Tài liệu liên quan (bản mới, đã thực hiện)
- Phần 2 v10 mục 3.41 — nghiệp vụ SUMMARY-01 / AI-01 / REPORT-01
- Phần 6 v7 mục 3.20 — phân quyền route job AI
- Phần 7 v7 mục 3.17 — hợp đồng API, mã lỗi mới
- Phần 8 v7 mục 3.14 — collection `report_job` + lease
- Phần 9 v5 mục 3.11 — hành vi worker AI và worker PDF
- Phần 12 v9 mục 3.17 — quy tắc trạng thái job AI
- Phần 13 v8 mục 3.20 — test AN-01 → AN-10
- Phần 14 v8 mục 3.16 — chia đợt thực hiện + kết quả nghiệm thu
- Phần 10 v7 mục 3.16 — `REPORT_FONT_PATH`, sửa cờ `REPORT_WORKER_ENABLED`

## 5. Thứ tự thực hiện
- **Đợt A — sửa lỗi:** 1, 2, 3, 4, 5, 9, 11
- **Đợt B — bảo mật:** 6
- **Đợt C — tính năng:** 7, 8, 10

## 6. Kết quả thực hiện (2026-11-17)
- Đã xử lý toàn bộ 11 mục ở bảng 3. Phát hiện và sửa thêm: `REPORT_WORKER_ENABLED` được parse thành boolean nhưng worker so sánh chuỗi → worker PDF không bao giờ bật.
- Thay đổi hành vi cần lưu ý: `top_n` mặc định 10 → **50**, tối đa 100 → **500**; ingest kết quả AI thủ công chỉ còn cho `SYS-ADMIN`; Viewer thử lại AI → 403; người ngoài project gọi route job → 404.
- PDF tiếng Việt có dấu cần đặt `REPORT_FONT_PATH` tới file `.ttf` (DejaVu Sans / Noto Sans); không đặt thì PDF ASCII như cũ.
- Test: analysis 72/72, toàn bộ unit 165/165, kiến trúc 3/3, `tsc` sạch. Chưa chạy e2e với Mongo thật.
- **Còn mở:** route `projects/{projectId}/analysis*`, `summary`, `report` chưa kiểm vai trò theo project ở tầng service (cùng loại rủi ro với mục 6); PDF chưa subset font.

## 7. Đợt D/E — đã thực hiện (2026-11-17)
Rà soát lại spec sau đợt A/B/C, module vẫn còn 6 thiếu sót:

| # | Thiếu sót | Hướng sửa | Tài liệu |
|---|---|---|---|
| D1 | Route `projects/{id}/analysis*`, `summary`, `report` không kiểm vai trò trong project | `application/project-access.service.ts` dùng chung; read/write theo ma trận; ngoài project → 404, Viewer ghi → 403; Viewer được yêu cầu + tải PDF | Phần 6 v7 mục 3.21 |
| D2 | Cấu hình lưu theo tên cột → đổi tên làm hỏng cấu hình, kết quả không stale | Lưu key `c{i}`; `domain/input-fingerprint.util.ts` gồm metadata cột; stale `dataset_changed` | Phần 2 v10 mục 3.42, Phần 8 v7 mục 3.15 |
| E1 | Thiếu dữ liệu biểu đồ 3.21 | `domain/chart-data.util.ts`: tỷ lệ thiếu, histogram, box plot, Top N + "Khác" (`chart_top_n` 1–20), chuỗi thời gian | Phần 7 v7 mục 3.18, Phần 12 v9 mục 3.18 |
| E2 | Tổng kết thiếu mức ảnh hưởng/ưu tiên 3.29 | `domain/impact.util.ts`; issues có `severity/priority/reason`; đề xuất theo vấn đề; `config_used`, `thresholds`; PDF thêm cột mức ảnh hưởng | Phần 2 v10 mục 3.42, Phần 12 v9 mục 3.18 |
| E3 | Không có outbox/thông báo | `recordEvent` `ANALYSIS_COMPLETED/FAILED`, `AI_JOB_SUCCEEDED/FAILED`; dispatcher + thông báo cho người chạy | Phần 9 v5 mục 3.12 |
| E4 | Không giới hạn số dòng | `ANALYSIS_MAX_ROWS` (200.000) → 413 `ANALYSIS_TOO_LARGE` | Phần 10 v7 mục 3.17 |

- Test: AN-11 → AN-20 (Phần 13 v8 mục 3.21) trong `test/analysis-wave6.spec.ts` — 22 test; toàn bộ unit 187/187, kiến trúc 3/3. Kết quả chi tiết: Phần 14 v8 mục 3.17.
- Sửa thêm: worker AI hết lượt ghi nhầm đánh giá `succeeded` rỗng → `markAiFailed`; mapper `topN` mặc định 10 → 50.
- Lệch so với đề xuất: giữ realtime phát trực tiếp; API cấu hình thêm `*Ref` (giữ `selectedColumns` là tên); `selected_columns` không khớp → 400.
- **Còn mở:** CASL tĩnh theo vai trò workspace chặn PROJ-MEMBER là WS-MEMBER ở route ghi.
- Để đợt sau: lưu/khôi phục trạng thái project (3.19), phân tích bất đồng bộ/Kafka, DQ-05 rule engine, tinh chỉnh kiểu/vai trò/PII cột (3.22), subset font PDF.

## 8. Nghiệm thu
- `npx jest src/modules/analysis test/analysis-wave5.spec.ts` + test AN-01 → AN-10.
- `npx tsc --noEmit`.
- Kiểm tra thủ công: config → run → đổi config → tạo Tổng kết bị từ chối → run lại → Tổng kết → yêu cầu PDF → tải PDF.

## 9. Lịch sử thay đổi
- **v1.3 / 2026-11-17:** Thực hiện đợt D/E; ghi kết quả, điểm lệch và việc còn mở (mục 7).
- **v1.2 / 2026-11-17:** Thêm đề xuất đợt D/E (mục 7), ghi tiếp vào các phiên bản tài liệu của đợt A/B/C.
- **v1.1 / 2026-11-17:** Thực hiện đợt A, B, C; ghi kết quả và việc còn mở (mục 6).
- **v1.0 / 2026-11-17:** Tạo tài liệu từ kết quả rà soát code module analysis; chờ duyệt.
