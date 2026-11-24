# KẾ HOẠCH HOÀN THIỆN MODULE ANALYSIS
**Dự án:** Nền tảng Full-stack Quản lý & Giám sát Chất lượng Dữ liệu có AI Hỗ trợ
**Tập tin:** `docs/modules/analysis_plan.md`
**Phiên bản:** v1.14 (2026-11-25)
**Trạng thái:** Đã thực hiện đợt A, B, C (commit `f9f61eb`), D, E, F, G, H, I và J (đợt J chỉ là tài liệu/công cụ trực quan, không đổi code `src/`). **2026-11-24:** đã merge `origin/backend` (refactor P1–P6 + OPEN-01..10) vào `Vqd_BE` — code hiện hành theo `backend`, xem mục 7g. **2026-11-25:** kéo tiếp 8 commit của `origin/backend` trước khi push — mục 7k; làm K6 (thông báo phân tích) — mục 7l.
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
- **Từ 2026-11-24 (sau hợp nhất hai nhánh docs, mục 7g):** các mục trên nằm trong bản đang dùng **Phần 2 v15 · 6 v9 · 7 v12 · 8 v12 · 9 v5 · 10 v8 · 12 v13 · 13 v13 · 14 v12**. Tham chiếu "Phần 6 v7 mục 3.20/3.21" ở trên là bản trong `docs/restructures/_nhanh_vqd_be/`; ở Phần 6 v9 hai mục này thành **3.22 / 3.23** (mục 3.22 cũ → 3.24).

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

## 7f. Đợt J — bộ trực quan module analysis (2026-11-18, chỉ tài liệu/công cụ)
- **Trạng thái:** Đã thực hiện 2026-11-18. **Không đổi code `src/`, không đổi API hay nghiệp vụ** → không có Phần 2–14 vN+1 mới.
- **Bối cảnh:** diagram cũ trong `local_VQD/report/diagrams/` chỉ vẽ 4/11 endpoint, thiếu alt/opt/break, activation bar, async, state machine và có vài chỗ sai so với code (tên hàm `requireRead`/`ensureFreshness` không tồn tại; `top_n` 1..500; retry "<2"; thiếu nhánh grounding fail; claim "bỏ qua kiểm record >10k dòng" không có trong `staleness.service.ts`).
- **Sản phẩm (`local_VQD/report/`, git-exclude, không vào nhánh):** viewer UML 4 tab (Architecture · Activity 3 sheet · Sequence 4 sheet · State 4 máy), trang **walkthrough** titanic 12 bước chạy service/worker thật, trang **code-flow** (sequence → activity theo hàm → mã nguồn), bản Markdown/Mermaid sinh từ cùng dữ liệu.
- **Chống lệch:** `npm run check` (`scripts/check-drift.mjs`) xác minh mọi tham chiếu `file#hàm@chuỗi` còn tồn tại trong git HEAD (số dòng lấy từ `source-index.js` sinh bằng TypeScript compiler API), toàn vẹn đồ thị, cạnh không đâm xuyên node, activation bar đóng đủ, phủ 11/11 endpoint và các mục tiêu định lượng.
- **Đính chính báo cáo:** `module_analysis_report.md` + `module_analysis_presentation.md` sửa các điểm sai nêu trên và số test.
- **Hướng dẫn chạy:** `local_VQD/report/README.md`.

## 7g. Đồng bộ sau khi kéo nhánh `backend` (2026-11-24, chỉ tài liệu)
- **Bối cảnh:** nhánh `backend` đã **chép tay** (commit `a7af214`, không merge git) logic đợt F–I từ `Vqd_BE`, rồi áp quyết định OPEN-01..10 (`docs/restructures/24_open_decisions_resolved.md`) và refactor modular monolith P1–P6 (`docs/refactor/`, ADR-0002 — analysis là module **Hexagonal**). Merge thường xung đột 42 file nên merge commit `131e14c` lấy **nguyên code của `backend`**, chỉ giữ thêm các docs riêng của `Vqd_BE`.
- **Trạng thái:** tài liệu đã đồng bộ; code chưa đổi. Mốc test sau merge (Node 22 + pnpm): type-check 0, lint 0, `test:arch` 23/23, `arch:api-coverage` 84/84, `test:unit` 1049 pass (3 lỗi đều do môi trường: `/proc/meminfo` chỉ có trên Linux, thiếu `redis-server`), `test:integration` 135/138 (3 lỗi do thiếu image MinIO).

**a) Hợp nhất docs hai nhánh phiên bản** — gộp 3 chiều từ bản gốc chung (`334040b`), giữ đủ mục của cả hai nhánh:

| Phần | Nhánh `Vqd_BE` | Nhánh `backend` | Số trùng | Bản hợp nhất |
|---|---|---|---|---|
| 2 | v10–v14 | v10–v11 | v10, v11 | **v15** |
| 6 | v7–v8 | v7 | v7 | **v9** (đổi số mục 3.20/3.21/3.22 của `Vqd_BE` → 3.22/3.23/3.24) |
| 7 | v7–v11 | v7–v8 (v8.4) | v7, v8 | **v12** |
| 8 | v7–v11 | v7 | v7 | **v12** |
| 10 | v7 | v7 | v7 | **v8** |
| 13 | v8–v12 | v8–v9 | v8, v9 | **v13** |
| 9 · 12 · 14 | v5 · v9–v13 · v8–v12 | — | — | dùng thẳng v5 · v13 · v12 |

File cùng tên ở `docs/restructures/` là bản của `backend`; bản cùng số của `Vqd_BE` lưu ở `docs/restructures/_nhanh_vqd_be/`. Chỗ hai nhánh mô tả khác nhau thì **mã nguồn hiện hành + bảng route Phần 7 §3.13 là chuẩn**.

**b) Đối chiếu đường dẫn mã nguồn** (đường dẫn trong mục 2–7f là **trước** refactor):

| Trước (`Vqd_BE` ≤ `8969ee3`) | Hiện hành (`src/backend/src/modules/analysis/…` nếu không ghi khác) |
|---|---|
| `application/analysis.service.ts` · `runAnalysis` | `application/commands/run-analysis.handler.ts` |
| · `getResult` / `getJob` | `application/queries/get-result.handler.ts` / `get-job.handler.ts` |
| · `retryJob` / `ingestAiResult` / `buildPromptForJob` | `application/commands/retry-job.handler.ts` / `ingest-ai-result.handler.ts` / `build-prompt-for-job.handler.ts` |
| · `markAiFailed` | `application/services/ai-worker.service.ts` (hết lượt retry → `status: failed`, `AI_FAILED`) |
| · `assertJobAccess` | `application/policy-loaders/analysis-job-policy.loader.ts` |
| · `saveConfig` / `getConfig` | **Gỡ** (OPEN-06) |
| `application/summary.service.ts` | `application/commands/create-summary.handler.ts` · `application/queries/get-summary.handler.ts` |
| `application/report.service.ts` | `application/commands/request-report.handler.ts` · `application/queries/download-report-file.handler.ts` · `get-report-file-meta.handler.ts` |
| `application/staleness.service.ts` (D2, `dataset_changed`) | **Gỡ** — dataset và cấu hình đều bất biến (OPEN-03/06); Tổng kết ghi `isStale: false` |
| `application/project-access.service.ts` | `PROJECT_ACCESS_PORT` → module projects (`resolve-user-project-role.handler.ts`, `project-access.adapter.ts`) + `application/policy-loaders/analysis-run-policy.loader.ts` |
| `domain/chart-data.util.ts` | `shared/domain/utils/chart-data.util.ts`, dùng ở `modules/data-view/data-view.service.ts` (`GET datasets/{id}/charts`) |
| `infrastructure/http/{analysis,report,summary}.controller.ts` | `presentation/controllers/*.controller.ts` |
| `infrastructure/http/dtos/run-analysis.dto.ts` · `analysis-config.dto.ts` | `presentation/dtos/run-analysis.dto.ts` · **gỡ** |
| `infrastructure/persistence/analysis-config.schema.ts` | **Gỡ** — snapshot cấu hình nằm trong `analysis-run.schema.ts` (`config`) |
| `modules/datasets/application/datasets.service.ts` · `infrastructure/http/datasets.controller.ts` | `modules/datasets/application/{commands,queries}/*.handler.ts` · `modules/datasets/presentation/controllers/` |
| `shared/utils/missing-tokens.util.ts` | `shared/domain/utils/missing-tokens.util.ts` |
| `test/analysis-completion.spec.ts`, `analysis-wave6…10.spec.ts` (96 test) | `test/analysis-wave6-10.spec.ts` (26 test, viết mới) — xem mục d |

**c) Quyết định của nhánh `backend` làm đổi hành vi đợt A–I** (nguồn: `24_open_decisions_resolved.md`, Phần 7 v8.4):
1. **OPEN-06 — không còn cấu hình phân tích:** gỡ `GET/POST projects/{id}/analysis/config`; `POST projects/{id}/analysis` nhận body rỗng; phân tích luôn toàn bộ cột, label/time/value tự suy. **`column_roles` (ghi đè vai trò cột — đợt F) bị bỏ**, vai trò chỉ còn tự suy (`domain/column-role.util.ts`).
2. **OPEN-03/04 — dataset bất biến:** gỡ `PATCH datasets/{id}/columns` (gồm cờ `is_pii` của đợt F) và đổi tên cột; lỗi tên cột → mục **Phát hiện** (`findings`). Cờ PII **tự suy từ tên cột** (`modules/datasets/domain/services/pii-heuristic.util.ts`) — cần kiểm lại tồn đọng "chưa tự nhận cột họ tên là PII".
3. **OPEN-05:** CSV chỉ nhận dấu phẩy; ngày giữ giá trị thô, ô nghi ngờ → mục Phát hiện.
4. **D2 / `isStale`:** bỏ cơ chế phát hiện kết quả lỗi thời (xem bảng b).

**d) Việc còn lại (giai đoạn 3 — làm sau khi duyệt):**
- **Test bị rơi:** 95/96 test đợt A–I (`analysis-completion`, `analysis-wave6`…`10`) không còn theo tên trong bộ test hiện tại. Bên `backend` chỉ viết lại 26 test. Cần rà từng test cũ: test nào còn đúng với hành vi hiện hành thì port sang handler mới (chỉ **thêm** assert, không sửa assert cũ — ràng buộc TC-01); test nào thuộc tính năng đã gỡ (mục c) thì ghi lý do bỏ.
- **Bộ test offline `local_VQD`:** `runner/engine.ts` còn gọi 5 service đã gỡ → dựng lại bằng handler + port bộ nhớ; tiêu chí đạt như sau đợt I (0 FAIL / 0 WARN / 0 bỏ sót trên cả hai bộ CSV). Kết quả lệch là chỗ bản chép tay làm rơi logic.
- **Bộ trực quan `local_VQD/report`:** cập nhật `data-*.js`, `code-map.js`, `flow-data.js` theo bảng b; chạy `npm run build` tới khi `check-drift` sạch.
- **Hạ tầng test (báo nhóm, không sửa trong module analysis):** `scripts/test-infra-up.sh` gọi `rs.initiate()` không truyền host → cần `TEST_MONGODB_URI='mongodb://127.0.0.1:27018/?replicaSet=rs0&directConnection=true'`; image `minio/minio` không còn trên Docker Hub.
- **Lưu ý git:** `.gitignore` của nhóm bỏ qua `/docs/*` (trừ `restructures/`, `refactor/`, `frontend-handover/`). File này vẫn được theo dõi vì đã có từ trước; file mới trong `docs/modules/` phải `git add -f`.

## 7h. Giai đoạn 3 — dựng lại `local_VQD` + port test đợt A–I (2026-11-24)
- **Trạng thái:** Đã thực hiện 2026-11-24. Chỉ đổi test và bộ test offline, **không đổi `src/`**. Docs: Phần 13 v14 mục 3.26.
- **Việc 1 — `local_VQD/runner/engine.ts`:** dựng bằng `RunAnalysisHandler`, `BuildPromptForJobHandler`, `IngestAiResultHandler`, `CreateSummaryHandler`, `RequestReportHandler`, `GetReportFileMetaHandler`, `ReportWorkerService` + port bộ nhớ. OPEN-06: `chosen` (label/time/value) lấy từ snapshot cấu hình hệ thống tự suy; lệch với `datasets.json` ghi vào `events.log` dòng `[OPEN-06]`. OPEN-03: bỏ bước vòng đời "đổi tên cột → lỗi thời". API không còn trả `columnRoles` → oracle đọc bản lưu nội bộ. PDF do pdfkit sinh → đếm trang qua `/Count`. Bản cũ: `local_VQD/archive/`.
- **Việc 2 — port 100 ca test cũ:** `src/backend/test/analysis-vqd-port/` — **B 48** còn hiệu lực (đạt) · **A 52** không port, ghi lý do tại chỗ. Lần chạy đầu xếp 25 ca vào nhóm "hồi quy" (`it.failing`); sau khi người dùng chốt cách đánh giá (mục 7i) nhóm này bỏ.
- **Mốc `local_VQD` mới:** khác biệt thiết kế đã chấp nhận (mục 7i) không tính lỗi. Còn đúng các lỗi thật: bộ mẫu 5 bỏ sót RC-14 (K2); edge-cases 23/28 — thiếu E15, E16 (K2), E11, E12, E25 (K4). Bản `MISSED_ERRORS*.md` sau đợt I: `local_VQD/archive/*_sau-dot-I.md`.

## 7i. Đánh giá tính đúng đắn sau merge + đợt K (2026-11-24)
- **Nguyên tắc (người dùng chốt):** code nhánh `backend` là chuẩn vì đã được nhóm điều chỉnh có chủ đích; test và oracle cũ là logic cũ, **không** dùng để ép code quay về. Chỉ sửa chỗ code mới **sai** (kết quả sai, mất chức năng, tự mâu thuẫn), không sửa chỗ chỉ **khác**.
- **Chấp nhận là thay đổi thiết kế (không sửa):** retry tạo job mới và đánh dấu job cũ `skipped` (kết quả trễ của job cũ bị bỏ qua — an toàn); mẫu gửi AI là giá trị bất kỳ đã che PII; grounding không lọc thêm đường chéo (prompt đã chỉ gửi tam giác trên); `top_n` mặc định 10 (body rỗng theo OPEN-06); API kết quả không trả `columnRoles` / `charts` (biểu đồ ở `GET datasets/{id}/charts`); Tổng kết không có `recommendation_items`, `unassessable`, `severity_counts`, `issue_total`, `dq05`; DQ-04 không ghi `outlierSkippedReason`; bỏ gợi ý năm + tháng, `dateOrder`, `excluded_invalid_dates_N`, `valueColumnIgnoredReason`; `describeColumn` không theo vai trò. **Hợp đồng chuẩn cho frontend:** Phần 7 v8.4 + `docs/frontend-handover/` — các mục đợt A–I trong Phần 2/7/8/12/13 mô tả trường nào khác code hiện hành thì code hiện hành đúng.
- **Lỗi thật — sửa ở đợt K:**

| Mã | Lỗi | Hậu quả | Vị trí | Docs |
|---|---|---|---|---|
| K1 | Worker AI đặt job `pending` để thử lại rồi vẫn gọi `ingest({})` → job thành `failed` | Lỗi JSON không bao giờ được thử lại; `AI_MAX_RETRIES` vô tác dụng | `application/services/ai-worker.service.ts` | Phần 9 v6 mục 3.13 |
| K2 | Cột ngày bị loại khỏi DQ-01..04 (bộ lọc `classifyColumn` của tương quan) | Báo dòng trùng giả; ô ngày trống không tính thiếu; mất nghi vấn trên cột ngày | `application/commands/run-analysis.handler.ts` | Phần 12 v14 mục 3.23 |
| K3 | Tổng kết bỏ qua `outlierBreakdown` | DQ-04 luôn "Thấp" → thứ tự ưu tiên sai | `application/commands/create-summary.handler.ts` | Phần 12 v14 mục 3.23 |
| K4 | Chọn nhãn theo vai trò `category` nhưng `evaluateImbalance` xét kiểu `number` là liên tục | Không bao giờ đánh giá mất cân bằng với nhãn số (Survived, target, pclass) | `domain/stats.util.ts` + run handler | Phần 12 v14 mục 3.23 |
| K5 | Job PDF không có lease (job AI có) | Worker dừng giữa chừng → báo cáo kẹt `running` mãi | `infrastructure/persistence/analysis.repository.ts`, `report-job.schema.ts`, `report-worker.service.ts` | Phần 9 v6 mục 3.13, Phần 8 v13 mục 3.20 |

- **Ngoài phạm vi, báo nhóm:** K6 — loại thông báo `analysis_completed` / `ai_analysis_ready` có trong module notifications nhưng chưa nơi nào tạo (realtime `analysis.completed` vẫn chạy) → tính năng chưa làm, không phải lỗi *(đã làm ở mục 7l)*. AN-08 / AN-11–13: kiểm quyền đã chuyển sang guard CASL — chưa đối chiếu lại ma trận quyền Phần 6 v9 mục 3.22–3.23.
- **Test:** Phần 13 v14 mục 3.27 (AK-01 → AK-08), file `src/backend/test/analysis-dot-k.spec.ts`.
- **Trạng thái:** Đã thực hiện 2026-11-24. Kết quả: unit 1106 pass (2 lỗi `/proc/meminfo` có từ mốc), `test:arch` 23/23, integration 139/142 (3 lỗi MinIO thiếu image, có từ mốc), `arch:api-coverage` 84/84, type-check + lint sạch; `local_VQD` bộ mẫu 0 FAIL / 0 bỏ sót, edge-cases 28/28 bẫy.
- **Thay đổi kèm theo:** `test/ai-worker.spec.ts` — ca "lỗi JSON ⇒ gọi ingest với payload rỗng" của nhánh `backend` kiểm đúng hành vi lỗi K1 (và mâu thuẫn với ca "vẫn retry" ngay sau) → đổi thành "lỗi JSON còn lượt ⇒ không gọi ingest, job vẫn pending". Test mới: `test/analysis-dot-k.spec.ts` (AK-01 → AK-06), `test/integration/report-lease.spec.ts` (AK-07, MongoDB thật). Xác nhận ngược: tạm gỡ phần sửa `src/` thì bộ test đợt K không đạt.
- **Còn lại (báo nhóm):** K6 thông báo phân tích xong *(đã làm ở mục 7l)*; đối chiếu ma trận quyền AN-08 / AN-11–13 với guard CASL. *(v1.12: trạng thái Phần 13 mục 3.27 đã ghi "Đã thực hiện" ở Phần 13 v17.)*

## 7j. Vá sau rà soát commit (2026-11-24)

- **Nguồn:** bản audit các commit `Vqd_BE` (Antigravity) — đối chiếu với code ở `9dff652`.
- **AJ-1 (VA-1):** `POST /analysis/jobs/:jobId/result` chỉ SYS-ADMIN (`can(Manage, 'all')`), `NODE_ENV=production` → 404. Trước đó PROJ-MEMBER+ ghi đè được nhận xét AI. Worker không dùng route này.
- **AJ-2 (VA-2):** audit `AI_JOB_RETRIED` (`POST …/retry`), `AI_RESULT_INGESTED` (`POST …/result`) qua `AUDIT_LOGGER_PORT`.
- **Hợp đồng / test:** Phần 7 v15 mục 3.25, Phần 13 v17 mục 3.30 (VAT-06, VAT-07). Phần 6 v9 §3.22 không đổi — code nay khớp.
- **Ngoài phạm vi:** CASL `admin → manage all` trên route chỉ kiểm CASL (dev khác xử lý); K6.
- **Trạng thái:** Đã thực hiện 2026-11-24. Test `test/analysis-ai-result-guard.spec.ts` 11/11. `tsc` 0 lỗi, `lint` 0 cảnh báo, `test:arch` 23/23, `arch:api-coverage` 84/84; `test:unit` **không đặt biến môi trường** 73/73 suite (1180 đạt, 3 skip — gồm 2 test chỉ chạy trên Linux); integration **không đặt `TEST_MONGODB_URI`** 175/178 (3 lỗi MinIO — OPEN-T-01); E2E 70/70.

## 7k. Kéo `origin/backend` lần 2 trước khi push (2026-11-25)

- **Bối cảnh:** sau merge `131e14c`, nhánh `backend` có thêm 8 commit: `cc3090a` gom test unit theo module (`test/unit/<module>/`) + 7 e2e + k6; `48231b7` schema Swagger `GET /datasets/:id/charts` (BE-07); 6 commit viết lại README module/test. `backend` không đổi `docs/restructures/` nên không trùng số phiên bản.
- **Xung đột (3 file):**
  - `modules/data-view/README.md`, `modules/feedback/README.md`: lấy bản viết lại của `backend` làm khung, chỉ sửa chỗ code `Vqd_BE` đã đổi (cursor theo sort, null cuối, chặn `value` object, `in []`; RAG theo khuôn, ≥ 3 người, nhóm nhãn mẫu, chặn theo trạng thái run, quyền sửa/xoá, audit). Sửa luôn danh sách nhãn ghi sai so với `feedback.types.ts`.
  - `test/unit/datasets/data-view.spec.ts`: chỉ dòng import.
- **Theo bố cục test mới:** chuyển `analysis-dot-k`, `analysis-ai-result-guard` → `test/unit/analysis/`; `feedback-v14` → `test/unit/feedback/`; `record-keyset-cursor` → `test/unit/shared/`; `test/analysis-vqd-port/` → `test/unit/analysis/vqd-port/`. Cập nhật `test/README.md`, `test/unit/README.md`, README của `unit/analysis`, `unit/feedback`, `unit/shared`, `integration/README.md` (thêm `report-lease.spec.ts` của đợt K), đường dẫn trong checklist `unit_test/07`, `13`, `18`.
- **README module:** `analysis` (quyền route `/result`, audit `/retry`, K1, K5), `audit` (action mới).
- **Sửa tương thích:** e2e `analysis-report-summary.e2e-spec.ts` của `backend` tự khai provider, không có `ConfigService` → `AnalysisController` nhận `ConfigService` dạng `@Optional()`, thiếu thì đọc `process.env.NODE_ENV` (route `/result` vẫn trả 404 ở production). Thêm 1 ca VAT-06.
- **Kết quả:** `tsc` 0, `lint` 0, `test:arch` 23/23 (đủ 9 file arch: 64 đạt, 1 skip), `arch:api-coverage` 84/84; `test:unit` 74/74 suite (1197 đạt, 3 skip); integration 175/178 (3 lỗi MinIO — OPEN-T-01); E2E 10/12 suite, 87/87 ca.
- **Báo nhóm `backend` (có sẵn trên `origin/backend`, không do merge):** 2 e2e mới `feedback-notifications-overview.e2e-spec.ts` và `dataset-dataview.e2e-spec.ts` không biên dịch được — TS18048 vì mock khai `Record<string, jest.Mock>` trong khi `tsconfig` bật `noUncheckedIndexedAccess`. Đã chạy lại trên worktree sạch của `origin/backend`: cùng 2 suite lỗi, cùng 87/87 ca.

## 7l. K6 — thông báo phân tích xong / lỗi / AI xong (2026-11-25)

- **Nguồn:** mục 9 "Việc còn mở" của báo cáo thay đổi nhánh `Vqd_BE`; người dùng nhận module analysis và duyệt plan.
- **Hiện trạng:** đợt D/E (Phần 9 §3.12) từng gửi 3 loại thông báo qua `NotificationsService.dispatch` trong `AnalysisService`; refactor P1–P6 của `backend` tách service thành handler và phần thông báo bị mất → không nơi nào tạo `analysis_completed`, `analysis_failed`, `ai_analysis_ready`.
- **Quyết định của người dùng:** làm theo cách module `issues` (port, không outbox, **không email**); job AI thất bại vẫn gửi `ai_analysis_ready` kèm summary báo lỗi (không thêm loại mới).
- **Thay đổi:**
  - `notifications/notification-dispatch.util.ts` — `dispatchNotificationViaPorts` (kiểm công tắc → `createIfEventNotExists` → realtime `notification.created`), public qua `notifications/index.ts`. Module `issues` giữ hàm riêng (có thể gộp sau).
  - `analysis/application/services/analysis-notifier.service.ts` — `runCompleted`, `runFailed`, `aiFinished`; người nhận `analysis_run.started_by`; nuốt mọi lỗi.
  - Gắn vào `RunAnalysisHandler` (thành công / nhánh lỗi), `IngestAiResultHandler` (sau grounding), `AiWorkerService` (chỉ nhánh hết lượt) — tham số **cuối** constructor, `@Optional()`, nên test cũ khởi tạo theo vị trí không đổi.
  - `analysis.module.ts` import `NotificationsModule`, `UsersModule` (không tạo vòng — `test:arch` CA9 đạt).
  - `source_event_id`: `analysis_completed:<runId>`, `analysis_failed:<runId>`, `ai_analysis_ready:<jobId>:<attempt>`; `payload.targetType = 'analysis_run'`; summary lỗi chỉ nêu mã.
- **Hợp đồng / test:** Phần 9 v7 mục 3.14 (làm rõ quy tắc actor §3.6.1), Phần 7 v16 mục 3.26 NT-1…NT-7, Phần 13 v18 NTT-01…NTT-06 (`test/unit/analysis/analysis-k6-notifications.spec.ts`, `test/unit/notifications/notification-dispatch.spec.ts`).
- **Còn mở:** OPEN-K6-EMAIL (không gửi email); khi worker AI chạy process riêng, realtime `notification.created` cần Redis adapter.
- **Trạng thái:** Đã thực hiện 2026-11-25 — 18/18 ca mới; test analysis/notifications cũ giữ nguyên.

## 8. Nghiệm thu
- `npx jest src/modules/analysis test/analysis-wave5.spec.ts` + test AN-01 → AN-10.
- `npx tsc --noEmit`.
- Kiểm tra thủ công: config → run → đổi config → tạo Tổng kết bị từ chối → run lại → Tổng kết → yêu cầu PDF → tải PDF.

## 9. Lịch sử thay đổi
- **v1.14 / 2026-11-25:** Thêm mục 7l — K6 thông báo phân tích xong / lỗi / AI xong (theo cách module `issues`, không email); đánh dấu K6 đã làm ở mục 7i.
- **v1.13 / 2026-11-25:** Thêm mục 7k — kéo 8 commit `origin/backend` (gom test theo module, viết lại README), giải quyết xung đột, sửa tương thích `ConfigService`; đổi mục 7j về cấp `##` cho đồng nhất.
- **v1.12 / 2026-11-24:** Thêm mục 7j — vá sau rà soát commit (quyền `/result`, audit job AI); ghi nhận đã cập nhật trạng thái Phần 13 mục 3.27.
- **v1.11 (thực hiện) / 2026-11-24:** Hoàn tất đợt K (K1–K5) — code + test; cập nhật trạng thái mục 7i.
- **v1.11 / 2026-11-24:** Viết lại mục 7h (bỏ nhóm "hồi quy" — người dùng chốt đánh giá tính đúng đắn thay vì khớp test cũ); thêm mục 7i — khác biệt thiết kế được chấp nhận + đợt K sửa 5 lỗi thật (K1–K5), K6 ngoài phạm vi. Docs: Phần 8 v13, 9 v6, 12 v14, 13 v14.
- **v1.10 / 2026-11-24:** Thêm mục 7h — giai đoạn 3: dựng lại `local_VQD` theo handler, port 100 ca test đợt A–I (B 48 · C 25 · A 27), ghi các hồi quy đã xác nhận; không đổi `src/`.
- **v1.9 / 2026-11-24:** Thêm mục 7g — đồng bộ sau khi merge `origin/backend`: hợp nhất docs hai nhánh phiên bản (Phần 2 v15, 6 v9, 7 v12, 8 v12, 10 v8, 13 v13), bảng đối chiếu đường dẫn code trước/sau refactor, quyết định OPEN ảnh hưởng đợt A–I, việc còn lại cho giai đoạn 3; không đổi code.
- **v1.8 / 2026-11-18:** Thêm đợt J (mục 7f) — bộ trực quan module analysis (viewer UML, walkthrough, code-flow) và đính chính báo cáo; không đổi code.
- **v1.7 / 2026-11-18:** Thêm đợt I (mục 7e) — tự phát hiện mâu thuẫn dữ liệu dưới dạng Nghi vấn; không làm khai báo quy tắc DQ-05.
- **v1.6 / 2026-11-18:** Thêm đợt H (mục 7d) — vá lỗi bỏ sót bộ edge-cases; DQ-05 vẫn để đợt sau.
- **v1.5 / 2026-11-17:** Thêm đợt G (mục 7c) — sửa lỗi bỏ sót từ bộ test offline; DQ-05 để đợt sau.
- **v1.4 / 2026-11-17:** Thêm đợt F (mục 7b) — sửa lỗi demo Titanic; đính chính phạm vi lỗi CASL.
- **v1.3.1 / 2026-11-17:** Giữ `top_n` tối đa 100; `recommendations` giữ mảng chuỗi + thêm `recommendation_items` (không phá tương thích API).
- **v1.3 / 2026-11-17:** Thực hiện đợt D/E; ghi kết quả, điểm lệch và việc còn mở (mục 7).
- **v1.2 / 2026-11-17:** Thêm đề xuất đợt D/E (mục 7), ghi tiếp vào các phiên bản tài liệu của đợt A/B/C.
- **v1.1 / 2026-11-17:** Thực hiện đợt A, B, C; ghi kết quả và việc còn mở (mục 6).
- **v1.0 / 2026-11-17:** Tạo tài liệu từ kết quả rà soát code module analysis; chờ duyệt.
