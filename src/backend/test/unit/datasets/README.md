# `test/unit/datasets/` — 10 file: CSV, PII, data-view, chart

Nhập liệu là cửa ngõ đầu tiên — sai ở đây thì analysis sai hết.

| File | Các `describe` thật trong code |
|---|---|
| `dataset-csv-delimiter.spec.ts` | `OPEN-05 — CSV chỉ phẩy cách` |
| `dataset-column-pii.spec.ts` | `OPEN-04 — PII tự động theo heuristic tên cột` |
| `dataset-findings.spec.ts` | `Mục "Phát hiện" (findings)` |
| `dataset-entity.spec.ts` | `factory & truy vấn` ; `assertIngestible()` ; `bất biến nội dung dữ liệu` ; `markReady()` ; `markFailed()` ; `setColumnIssues()` ; `toProps()` (7 describe) |
| `datasets-ingestion.spec.ts` | `DatasetsService (Streaming Ingestion & R2 Quota Guard)` |
| `datasets-wave4.spec.ts` | `Wave4 acceptance (CSV-only, props c0.., insert-only, cursor, no-leak)` |
| `data-view.spec.ts` | `DataViewService Wave4 (keyset props.cN, meta nextCursor/hasMore)` |
| `data-view-type-coercion.spec.ts` | `Lop 1 - quy tac ep kieu (value-coercion.vo)` ; `Lop 1b - logic dich gia tri bo loc` |
| `chart-data.spec.ts` | `GĐ6 — chart-data.util (hàm thuần)` ; `GĐ6 — DataViewService.getChartData` |
| `chart-swagger-schema.spec.ts` | `BE-07 — Schema Swagger của API biểu đồ` |

Chạy: `npx jest test/unit/datasets --no-coverage`.
