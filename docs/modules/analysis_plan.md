# KẾ HOẠCH HOÀN THIỆN MODULE ANALYSIS
**Dự án:** Nền tảng Full-stack Quản lý & Giám sát Chất lượng Dữ liệu có AI Hỗ trợ
**Tập tin:** `docs/modules/analysis_plan.md`
**Phiên bản:** v1.7 (2026-11-18)
**Trạng thái:** Đã thực hiện đợt A, B, C (commit `f9f61eb`), D, E, F và G và H
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
- Thay đổi hành vi cần lưu ý: `top_n` mặc định 10 → **50** (tối đa giữ 100); `summary.recommendations` vẫn là mảng chuỗi, thêm `recommendation_items`; ingest kết quả AI thủ công chỉ còn cho `SYS-ADMIN`; Viewer thử lại AI → 403; người ngoài project gọi route job → 404.
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

- Test: AN-11 → AN-21 (Phần 13 v8 mục 3.21) trong `test/analysis-wave6.spec.ts` — 23 test (AN-21 thêm khi điều chỉnh tương thích API, commit `52df5b7`; toàn bộ unit 188/188); toàn bộ unit 187/187, kiến trúc 3/3. Kết quả chi tiết: Phần 14 v8 mục 3.17.
- Sửa thêm: worker AI hết lượt ghi nhầm đánh giá `succeeded` rỗng → `markAiFailed`; mapper `topN` mặc định 10 → 50.
- Lệch so với đề xuất: giữ realtime phát trực tiếp; API cấu hình thêm `*Ref` (giữ `selectedColumns` là tên); `selected_columns` không khớp → 400.
- **Còn mở:** CASL tĩnh theo vai trò workspace chặn PROJ-MEMBER là WS-MEMBER ở route ghi.
- Để đợt sau: lưu/khôi phục trạng thái project (3.19), phân tích bất đồng bộ/Kafka, DQ-05 rule engine, tinh chỉnh kiểu/vai trò/PII cột (3.22), subset font PDF.

## 7b. Đợt F — sửa 6 lỗi phát hiện khi demo Titanic (2026-11-17)
- **Trạng thái:** Đã thực hiện 2026-11-17. Kết quả 2026-11-17: tsc/nest build sạch; unit 208/208 (thêm 20 test cho đợt F), kiến trúc 3/3, e2e 52/52; demo Titanic: tương quan còn 8 cột / 28 cặp (loại PassengerId, Name, Ticket, Cabin), VIF chỉ Age/Fare, prompt có mẫu ô lỗi, cặp đường chéo bị loại, PDF 7 → 4 trang.
- Bổ sung khi thực hiện: biểu đồ theo vai trò cột (không Top N cho định danh/văn bản/cột PII); grounding giữ ô tam giác trên khi đối chiếu cặp.
- **Docs (vN+1):** Phần 2 v11 (3.43), 6 v8 (3.22), 7 v8 (3.19), 8 v8 (3.16), 12 v10 (3.19), 13 v9 (3.22), 14 v9 (3.18).

| # | Lỗi | Hướng sửa |
|---|---|---|
| 1 | Guard CASL chặn mọi analyst (JWT thiếu vai trò workspace) | Không sửa code (dev khác phụ trách `shared/casl`); đính chính docs + PR; kiểm bằng mock nội bộ |
| 2 | Prompt AI không có mẫu (mọi ô bị loại) | `maskForAi` che theo vai trò cột; mẫu = ô lỗi, ≤ 20/cột; `value_masked` theo cùng chính sách |
| 3 | Không đánh dấu được cột PII | `PATCH datasets/{id}/columns` nhận `is_pii` |
| 4 | Cột định danh/văn bản lọt vào tương quan/VIF | Vai trò cột (`column-role.util.ts`, chuyển từ `inferRole` Quality - Structure); ghi đè qua `column_roles`; DQ-04 chỉ cột `measure` |
| 5 | Grounding nhận cặp đường chéo | Loại `colA == colB`; prompt chỉ tam giác trên |
| 6 | PDF in đủ ma trận | In tam giác trên, xếp theo |hệ số| |

- **Test:** `test/analysis-wave7.spec.ts` (AN-22..AN-33) + demo offline Titanic.

## 7c. Đợt G — sửa lỗi bỏ sót phát hiện bởi bộ test offline `local_VQD` (2026-11-17)
- **Trạng thái:** Đã thực hiện 2026-11-17.
- **Kết quả 2026-11-17:** tsc/nest build sạch; unit 221/221 (thêm 13 test đợt G), kiến trúc 3/3, e2e 52/52; bộ test offline `local_VQD` (9 dataset): nhóm A (bỏ sót trong phạm vi DQ-01..04) 5 → 0, taxis hết FAIL phủ cột và báo trùng giả, tiêm lỗi vào cột ngày bắt 60/60, ký hiệu thiếu / hoa-thường / khoảng trắng ở cột chữ được báo ở nhóm Nghi vấn 106/106 mỗi loại; còn lại chỉ RC-01 (DQ-05, để đợt sau).
- **Docs (vN+1):** Phần 2 v12 (3.44), 7 v9 (3.20), 8 v9 (3.17), 12 v11 (3.20), 13 v10 (3.23), 14 v10 (3.19).

| Nguyên nhân | Lỗi | Hướng sửa (người dùng chốt) |
|---|---|---|
| RC-14 | Cột ngày bị loại âm thầm khỏi DQ, gây báo trùng giả | Cột ngày chạy DQ-01, DQ-02 (vào khóa trùng), DQ-03; bỏ DQ-04; vẫn loại khỏi tương quan/VIF |
| — | `new Date()` dễ dãi (30/02 thành 02/03) | Bộ đọc ngày chặt, phân định DD/MM, MM/DD; mơ hồ → nghi vấn |
| RC-04 | `NA` ở cột chữ bị đếm sai kiểu, `?` không ai báo | Cột chữ → nghi vấn `missing_token`; danh sách ký hiệu dùng chung |
| RC-08/09/10 | Hoa/thường, khoảng trắng, sentinel, cột hằng không được báo | Nhóm **Nghi vấn**, chỉ hiển thị ở Tổng kết + PDF, không có mức ảnh hưởng |
| RC-02 | Năm + tháng không có cột ngày | Chỉ báo rõ: `reason` + `timePartColumns` |
| RC-15 | Số thập phân ít giá trị bị coi là phân loại | Chỉ số nguyên mới thành phân loại |
| RC-01 | DQ-05 chưa có rule engine | **Để đợt sau** |

- **Test:** `test/analysis-wave8.spec.ts` (AN-34..AN-45) + chạy lại `local_VQD/runner/run-all.ts`.

## 7d. Đợt H — vá lỗi bỏ sót của bộ edge-cases `local_VQD/edge-cases` (2026-11-18)
- **Trạng thái:** Đã thực hiện 2026-11-18.
- **Kết quả 2026-11-18:** tsc/nest build sạch; unit 238/238 (thêm 17 test đợt H), kiến trúc 3/3, e2e 52/52; bộ edge-cases `local_VQD/edge-cases` (11 file, 28 bẫy): 10 → 26 bẫy được báo đúng, chỉ còn E14/E15 (DQ-05, để đợt sau); bộ 9 dataset mẫu không đổi (chỉ còn RC-01), Nghi vấn mới không báo thừa trên dữ liệu mẫu.
- **Bối cảnh:** 11 file edge-cases, 28 bẫy biết trước; hệ thống bắt 10, bỏ sót 18 (`local_VQD/MISSED_ERRORS_edge-cases.md`).
- **Docs (vN+1):** Phần 2 v13 (3.45), 7 v10 (3.21), 8 v10 (3.18), 12 v12 (3.21), 13 v11 (3.24), 14 v11 (3.20).

| Lỗi | Vấn đề | Hướng sửa (người dùng chốt 2026-11-18) |
|---|---|---|
| E11, E12, E25 | Cột số nguyên vai trò phân loại (0/1, 1/2/3) không chọn được làm nhãn | Cho chọn cột số; khi chạy quyết theo vai trò hiệu lực, không 400 |
| E06 | `NA` ở cột chữ bị loại khỏi mất cân bằng/tương quan | Cột chữ: chỉ ô trống là thiếu ở mọi phép tính |
| E08, E09, E13 | Mã định danh lặp, trùng theo email/điện thoại khác ID | Nghi vấn `identifier_not_unique`, `duplicate_key` (cột khóa theo tên) |
| E20 | Số theo vùng `1.200,50` lẫn với lỗi | Nghi vấn `locale_number_format`, không tự chuyển |
| E16 | Thiếu có cấu trúc bị gắn Cao | Nghi vấn `conditional_missing`; mức DQ-01 giữ nguyên |
| E21 | Ký hiệu thiếu ở cột số làm DQ-01 hiện thấp | `symbolMissingCount` + lý do DQ-03 tách riêng |
| E24 | Phân phối lệch bị gắn Cao | `skewness` + câu cảnh báo trong lý do DQ-04 |
| E02 | Thời gian không nói thứ tự ngày/tháng | `dateOrder`, `dateOrderAmbiguous` + câu trong PDF |
| E23, E27 | Sentinel đơn lẻ, mã có số 0 đầu | Mở rộng `sentinel` (âm, 1 lần, cột không có số âm khác); Nghi vấn `leading_zero_numeric` |
| E28, E10 | Thống kê định lượng cho cột mã; cột giá trị là mã | Bỏ số liệu định lượng cho identifier; bỏ cột giá trị kèm lý do |
| E14, E15 | Luật liên cột | DQ-05 — vẫn để đợt sau |

- **Test:** `test/analysis-wave9.spec.ts` (AN-46..AN-62) + `local_VQD/runner/run-all.ts --dir edge-cases` và bộ mẫu.

## 7e. Đợt I — tự phát hiện mâu thuẫn dữ liệu dưới dạng Nghi vấn (2026-11-18)
- **Trạng thái:** Đã thực hiện 2026-11-18.
- **Kết quả 2026-11-18:** tsc/nest build sạch; unit 244/244 (thêm 6 test đợt I), kiến trúc 3/3, e2e 52/52; bộ test `local_VQD` chạy đầy đủ (9 CSV mẫu + tiêm lỗi, 11 CSV edge-cases, 0 FAIL): lỗi bỏ sót 16 → 5 (còn thứ tự hai cột ×2, tốc độ, x/y/z ≤ 12 mm, công thức depth — ngoài phạm vi); tiêm giá trị âm bắt 100%; 8 Nghi vấn mới trên dữ liệu sạch đều là lỗi thật, không báo thừa.
- **Bối cảnh:** sau đợt H còn 16 lỗi bỏ sót, đều thuộc DQ-05. Người dùng quyết định không bắt người dùng khai báo quy tắc; hệ thống tự phát hiện và báo Nghi vấn, DQ-05 giữ "Chưa đánh giá".
- **Docs (vN+1):** Phần 2 v14 (3.46), 7 v11 (3.22), 8 v11 (3.19), 12 v13 (3.22), 13 v12 (3.25), 14 v12 (3.21).

| Nghi vấn | Áp dụng cho | Điều kiện |
|---|---|---|
| `negative_in_positive` | Cột số vai trò `measure` hoặc `category` (không xét `identifier`), ≥ 20 giá trị hợp lệ | Có giá trị âm (không tính sentinel đã báo), số giá trị âm ≤ 5%, mọi giá trị khác ≥ 0 |
| `zero_in_positive` | Cột số vai trò `measure` hoặc `category` (không xét `identifier`), ≥ 20 giá trị hợp lệ | Có số 0, số 0 ≤ 3%, mọi giá trị khác > 0 (bỏ qua giá trị đã báo âm/sentinel) |
| `row_all_measures_missing` | Dataset có ≥ 2 cột `measure` | Dòng mà mọi cột `measure` đều trống (khác `fullyMissingRows` của DQ-01 vốn xét mọi cột) |
| `missing_in_filled_group` | Cột đã có nghi vấn `conditional_missing` | Nhóm của cột phân loại mà ô gần như luôn có giá trị (tỷ lệ trống > 0 và ≤ 10%, ≥ 5 dòng) nhưng vẫn có ô trống — báo đích danh các ô đó |

- **Kỳ vọng:** bắt thêm 11/16 lỗi; còn lại 5 (thứ tự hai cột ×2, tốc độ, x/y/z ≤ 12 mm, công thức depth) — ngoài phạm vi đợt này.
- **Test:** `test/analysis-wave10.spec.ts` (AN-63..AN-68) + `local_VQD/runner/run-all.ts` hai bộ.

## 8. Nghiệm thu
- `npx jest src/modules/analysis test/analysis-wave5.spec.ts` + test AN-01 → AN-10.
- `npx tsc --noEmit`.
- Kiểm tra thủ công: config → run → đổi config → tạo Tổng kết bị từ chối → run lại → Tổng kết → yêu cầu PDF → tải PDF.

## 9. Lịch sử thay đổi
- **v1.7 / 2026-11-18:** Thêm đợt I (mục 7e) — tự phát hiện mâu thuẫn dữ liệu dưới dạng Nghi vấn; không làm khai báo quy tắc DQ-05.
- **v1.6 / 2026-11-18:** Thêm đợt H (mục 7d) — vá lỗi bỏ sót bộ edge-cases; DQ-05 vẫn để đợt sau.
- **v1.5 / 2026-11-17:** Thêm đợt G (mục 7c) — sửa lỗi bỏ sót từ bộ test offline; DQ-05 để đợt sau.
- **v1.4 / 2026-11-17:** Thêm đợt F (mục 7b) — sửa lỗi demo Titanic; đính chính phạm vi lỗi CASL.
- **v1.3.1 / 2026-11-17:** Giữ `top_n` tối đa 100; `recommendations` giữ mảng chuỗi + thêm `recommendation_items` (không phá tương thích API).
- **v1.3 / 2026-11-17:** Thực hiện đợt D/E; ghi kết quả, điểm lệch và việc còn mở (mục 7).
- **v1.2 / 2026-11-17:** Thêm đề xuất đợt D/E (mục 7), ghi tiếp vào các phiên bản tài liệu của đợt A/B/C.
- **v1.1 / 2026-11-17:** Thực hiện đợt A, B, C; ghi kết quả và việc còn mở (mục 6).
- **v1.0 / 2026-11-17:** Tạo tài liệu từ kết quả rà soát code module analysis; chờ duyệt.
