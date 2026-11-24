# `test/unit/analysis/` — 11 file: thuật toán DQ + guard phân tích

Test thuật toán **thuần** (không DB). Tất cả `describe` dưới đây chép nguyên văn từ code — mở file ra đối chiếu từng chữ.

| File | Các `describe` thật trong code |
|---|---|
| `analysis-overload-guard.spec.ts` | `GĐ0 — chống quá tải máy (ANALYSIS_MAX_ROWS)` |
| `analysis-cardinality-guard.spec.ts` | `GĐ8 — Cramér V trên bảng contingency thưa` ; `GĐ9 — lọc cột theo vai trò trước khi tính tương quan` |
| `analysis-cardinality-guard-gd10.spec.ts` | `GĐ10 — exceedsCardinalityGuard` ; `GĐ10 — buildCorrelationMatrix chặn cặp cardinality quá lớn` |
| `analysis-concurrency-guard.spec.ts` | `GĐ12 — resolveAnalysisMaxConcurrency` ; `GĐ12 — AnalysisConcurrencyGuard` |
| `analysis-gap003-column-issues.spec.ts` | `GAP-003 — gate lỗi tên cột chặn phân tích` (đã xử lý 2026-11-19: gate `columnIssues.length > 0` → 400 trước khi đọc bản ghi) |
| `analysis-gd2-suspicion.spec.ts` | `GĐ2.1 — ký hiệu thiếu dùng chung (missing-tokens.util)` ; `GĐ2.2 — toCategory / tương quan` ; `GĐ2.3 — dateOrderOf() tích hợp vào DQ-03` ; `GĐ2.4 — 15 loại Nghi vấn` ; `GĐ2.5 — che PII theo vai trò` ; `GĐ2.6 — đồng bộ DQ-01 / mô tả / cân bằng` (6 describe) |
| `analysis-gd7-column-roles.spec.ts` | `GĐ7.1 — inferColumnRoles (OPEN-06 — không còn ghi đè thủ công)` ; `GĐ7.2 — isRoleAllowedForType` ; `GĐ7.4 — skewnessOf` ; `GĐ7.5 — detectOutliers` (4 describe) |
| `analysis-wave5.spec.ts` | `Wave5 DQ-01` ; `Wave5 DQ-02` ; `Wave5 DQ-03` ; `Wave5 DQ-04: IQR 1.5x/3x + Modified Z 3.5` ; `Wave5 ANALYSIS-04/06/07` ; `Wave5 I13: API không chứa mã sinh PDF` (6 describe) |
| `analysis-wave6-10.spec.ts` | `AN-14 / AN-15 / AN-33 — fingerprint` ; `AN-16 — dữ liệu biểu đồ` ; `AN-17 — mức ảnh hưởng` ; `AN-30 / AN-31 — tam giác trên` ; `AN-32 — PDF tam giác trên` ; `AN-18 / AN-45 — Tổng kết` ; `AN-20 — chặn quá tải` ; `GĐ12 — semaphore chặn xếp hàng phân tích đồng bộ` (8 describe) |
| `pdf-builder.spec.ts` | `PDF builder — giữ dấu tiếng Việt` |
| `report-content.spec.ts` | `GĐ3 — buildReportSections` + 7 describe con (mục 2, GĐ2 riêng, mục 4, mục 5 VIF, phụ lục D, không kết quả, mục 2b) |

Liên quan trực tiếp `test/k6/stress.js`: vượt `ANALYSIS_MAX_CONCURRENCY` thì API trả **429 + `Retry-After`** — đó là kết quả đúng, không phải lỗi.

Chạy: `npx jest test/unit/analysis --no-coverage`.
