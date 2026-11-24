# 23. GĐ7 — Ghi đè vai trò cột (`column_roles`) + Số liệu giải thích DQ-04

- **Trạng thái:** Hoàn thành (2026-11-19)
- **Nhóm:** GĐ — port tính năng còn thiếu từ nhánh `Vqd_BE`
- **Hợp đồng API:** [`7_api_contracts_v8.md`](./7_api_contracts_v8.md) v8.3
- **Mã nguồn:** `src/backend/src/modules/analysis/`

---

## 1. Vấn đề

Nhánh `Vqd_BE` có 5 tính năng mà nhánh hiện tại **chưa có**:

| # | Tính năng | Vì sao cần |
|---|---|---|
| GĐ7.1 | Ghi đè vai trò cột (`column_roles`) | Hệ thống **tự suy** vai trò cột từ *tên cột + phân bố giá trị*. Cột bị suy sai (VD cột mã toàn số `0/1` → coi là `measure`) → lọc sai, tương quan tính sai. Người dùng **không có cách sửa**. |
| GĐ7.2 | `outlierBreakdown` | Chỉ có tổng số ngoại lệ → không biết ngoại lệ đến từ phương pháp nào, không biết "cực đoan" hay "vừa". |
| GĐ7.3 | `symbolMissingCount` | Ô chứa `"N/A"` **không phải thiếu** (DQ-01) nhưng cũng **không hợp lệ** → không được tính vào mẫu số. Không có trường này thì người dùng không biết vì sao `validCount + invalidCount ≠ tổng`. |
| GĐ7.4 | `skewness` | Cần phân biệt "ngoại lệ do lỗi nhập" với "ngoại lệ do phân phối lệch". |
| GĐ7.5 | `outlierSkippedReason` | Cột số không có ngoại lệ — không biết là "không có" hay "cố ý bỏ qua". |

---

## 2. GĐ7.1 — Ghi đè vai trò cột

### 2.1. Quyết định thiết kế

**Key là `columnKey` ổn định (`c0`, `c1`, …), KHÔNG phải tên hiển thị.**

Lý do: tên cột có thể đổi (có endpoint `PATCH /datasets/{id}/columns` đổi tên). Nếu lưu theo tên, mỗi lần đổi tên là mất ghi đè. Dataset đã có sẵn cơ chế **key bất biến** dùng cho fingerprint (`input-fingerprint.util.ts`) → tái dùng để nhất quán.

### 2.2. Luồng dữ liệu

```
POST /projects/:id/analysis/config  { column_roles: { c5: "identifier" } }
        │
        ▼
SaveConfigHandler
  ├─ validate: key tồn tại? role ∈ enum? role khớp kiểu dữ liệu?
  ├─ column_roles = null  → xoá hết ghi đè
  └─ column_roles = undefined → giữ nguyên (không ghi field vào doc)
        │
        ▼
AnalysisConfigSchema.column_roles  (Mixed)
        │
        ▼
toAnalysisConfigRecord() → sanitizeColumnRoles()
  ├─ key phải khớp /^c\d+$/
  ├─ value phải ∈ ANALYSIS_ROLES
  └─ entry không hợp lệ → BỎ QUA (không ném lỗi)
        │
        ▼
RunAnalysisHandler
  ├─ computeInputFingerprint({ columnRoles })  → đổi ghi đè ⇒ fingerprint đổi
  └─ inferColumnRoles(columns, rows, columnRoles) → source: 'user'
```

### 2.3. Vì sao `sanitizeColumnRoles()` bỏ qua thay vì ném lỗi

`column_roles` lưu dạng `Schema.Types.Mixed` → có thể chứa **bất kỳ** giá trị nào đã từng nằm trong DB (dữ liệu cũ, import tay, sửa ngoài API). Đây là **dữ liệu đã lưu**, không phải input của người dùng.

- **Input** của người dùng → validate chặt, ném lỗi 400 kèm cột/role cụ thể (`SaveConfigHandler`).
- **Dữ liệu đọc từ DB** → bỏ qua entry hỏng, tiếp tục chạy (không sập server vì một record lỗi).

### 2.4. Quy tắc khớp vai trò ↔ kiểu dữ liệu

`isRoleAllowedForType(role, dataType)`:

| Vai trò | `number` | `string` | `date` | `boolean` |
|---|---|---|---|---|
| `measure` | ✅ | ❌ | ❌ | ❌ |
| `datetime` | ❌ | ❌ | ✅ | ❌ |
| `identifier` | ✅ | ✅ | ❌ | ✅ |
| `category` | ✅ | ✅ | ❌ | ✅ |
| `text` | ✅ | ✅ | ❌ | ✅ |

### 2.5. Ảnh hưởng fingerprint (quan trọng)

Ghi đè vai trò là **một phần của đầu vào phân tích** → phải nằm trong hash fingerprint:

```typescript
// input-fingerprint.util.ts
...(normalizeRoles(cfg.columnRoles).length > 0 ? { column_roles: normalizeRoles(cfg.columnRoles) } : {}),
```

Nếu không, người dùng đổi `c5` từ `measure` → `identifier` thì kết quả cũ vẫn "hiện hành" dù đã sai → báo cáo có thể in ra số liệu không còn đúng.

Ngoài ra `SaveConfigHandler` gọi `markResultsStale(projectId, ..., 'config_changed')` → kết quả cũ bị đánh dấu `stale` ngay khi đổi cấu hình.

### 2.6. `analysis_run.config` lưu lại ghi đè

```typescript
column_roles: cfgColumnRoles,   // trong config của run
```

Cho phép truy vết "kết quả này được tính với vai trò nào" (audit + tái lập).

---

## 3. GĐ7.2–7.5 — Số liệu giải thích DQ-04

### 3.1. `outlierBreakdown`

```typescript
breakdown: {
  iqr: out.iqrOutliers.length,        // ngưỡng 1.5×IQR
  iqrExtreme: out.iqrExtremeOutliers.length, // ngưỡng 3×IQR — ngoại lệ "cực đoan"
  zscore: out.zOutliers.length,        // Modified-Z 3.5
  both: out.intersection.length,      // giao IQR ∩ Z
}
```

**Lưu ý hành vi `intersection`:** khi chỉ dùng **một** phương pháp (`iqr` hoặc `modified_zscore`), `detectOutliers()` đặt `intersection = union` — tức "số ngoại lệ mà phương pháp đang dùng chỉ ra". Đây là hành vi **cố ý**, giữ nguyên từ `Vqd_BE`, để `breakdown.both` luôn có số để hiển thị.

### 3.2. `symbolMissingCount`

```typescript
symbolMissingCount: inv?.reasons['symbol_as_missing_excluded_from_dq01'] ?? 0,
```

Nguồn: `computeDq03()` trong `dq.util.ts` (đã port từ GĐ1). Ô chứa `"N/A"`:
- **không** phải thiếu theo DQ-01 (`isMissingCell('NA') === false`),
- **không** phải giá trị hợp lệ theo DQ-03 → bị loại khỏi cả mẫu số lẫn tử số.

### 3.3. `skewness`

Chỉ tính cho cột có vai trò `measure`:

```typescript
const xs = roleByName.get(c.column) === 'measure' ? (numericValues.get(c.column) ?? []) : [];
const skewness = skewnessOf(xs);
```

Cột `identifier` toàn số `0/1` có skewness vô nghĩa → không tính.

`skewnessOf()` (trong `stats.util.ts`) trả `null` khi:
- `< 4` giá trị — mẫu quá nhỏ, ước lượng không đáng tin;
- độ lệch chuẩn = 0 — tất cả giá trị bằng nhau → không có phân tán để lệch.

Dùng **sample skewness** (chuẩn hoá theo n−1) qua `simple-statistics`, khớp với `Vqd_BE`.

### 3.4. `outlierSkippedReason`

```typescript
outlierSkippedReason: !out && colTypeByName.get(c.column) === 'number' ? 'not_measure_column' : null,
```

Cột kiểu `number` nhưng vai trò không phải `measure` (VD mã định danh toàn số) → cố ý bỏ qua DQ-04. Cần trường này để phân biệt "không có ngoại lệ" với "không phân tích ngoại lệ".

### 3.5. Tối ưu: dùng chung `numericValues`

`numericValues` (map key → mảng số hợp lệ) được tính **một lần** ở phần DQ-04 và dùng lại cho:
- `skewness` (GĐ7.4),
- biểu đồ `histogram` / `boxPlot` (GĐ6).

Trước GĐ7 có **hai** vòng quét riêng → gộp lại một, giảm một lần duyệt toàn bộ dữ liệu.

---

## 4. Hợp đồng API (v8.3)

**Thêm field, không đổi/xoá field → không phá vỏ hợp đồng** (mục 3.15 quy tắc 3).

| Endpoint | Thay đổi |
|---|---|
| `POST /projects/{projectId}/analysis/config` | Body: `column_roles` (tuỳ chọn). Response: `columnRoles`. |
| `GET /projects/{projectId}/analysis/config` | Response: `columnRoles` (mặc định `{}`). |
| `GET /projects/{projectId}/analysis/result` | `dqSummary.columns[]`: `symbolMissingCount`, `skewness`, `outlierBreakdown`, `outlierSkippedReason`. |

---

## 5. Kiểm thử

`src/backend/test/analysis-gd7-column-roles.spec.ts` — **28 test**:

| Nhóm | Nội dung |
|---|---|
| GĐ7.1 | `inferColumnRoles` — ghi đè có hiệu lực, chỉ áp cho cột tương ứng, enum sai bị bỏ qua, key lạ không ảnh hưởng |
| GĐ7.2 | `isRoleAllowedForType` — bảng khớp vai trò ↔ kiểu dữ liệu; enum `ANALYSIS_ROLES` đúng 5 giá trị |
| GĐ7.3 | `sanitizeColumnRoles` — map hợp lệ giữ nguyên; key sai / value sai / không phải object bị loại |
| GĐ7.4 | `skewnessOf` — mẫu nhỏ → null, phân tán 0 → null, đối xứng ≈ 0, lệch phải > 0, lệch trái < 0 |
| GĐ7.5 | `detectOutliers` — phân rã theo phương pháp, `iqrExtreme ⊂ iqr`, `union` = hợp, mẫu < 4 và IQR = 0 → không kết luận |

---

## 6. Ảnh hưởng tới các phần khác

| Phần | Ảnh hưởng |
|---|---|
| `analysis-config.schema.ts` | Thêm `column_roles` (Mixed, default null) |
| `analysis.mapper.ts` | Thêm `sanitizeColumnRoles()` + map `columnRoles` |
| `analysis.repository.port.ts` | `AnalysisConfigRecord.columnRoles` (+ alias `column_roles`) |
| `analysis.types.ts` | `AnalysisConfigInput.column_roles` |
| `analysis-config.dto.ts` | `ColumnRolesSchema` (Zod) |
| `save-config.handler.ts` | Validate + persist `column_roles` |
| `get-config.handler.ts` | Trả `columnRoles` |
| `run-analysis.handler.ts` | Đọc config → fingerprint + `inferColumnRoles` + 4 field DQ mới |
| `stats.util.ts` | Thêm `skewnessOf()` |
| `input-fingerprint.util.ts` | **Không đổi** — đã hỗ trợ `columnRoles` sẵn từ trước |

---

## 7. Liên kết

- [`7_api_contracts_v8.md`](./7_api_contracts_v8.md) — hợp đồng API v8.3
- [`17_api_gap_analysis_v1.md`](./17_api_gap_analysis_v1.md) — phân tích gap
- [`22_analysis_concurrency_guard.md`](./22_analysis_concurrency_guard.md) — GĐ12
- `docs/frontend-handover/01-api-contract.md` — handoff frontend
