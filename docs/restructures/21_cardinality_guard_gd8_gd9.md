# GĐ8 + GĐ9 — Sửa gốc OOM do ma trận tương quan Cramér V dày

> **Nhánh:** `Hoa24102026` · **Ngày:** 2026-11-18 · **Trạng thái:** hoàn tất, đã kiểm chứng thực tế
>
> Tài liệu này bổ sung cho [`20_overload_guard_gd0_gd4.md`](./20_overload_guard_gd0_gd4.md).
> GĐ0 chặn dataset **quá lớn**, nhưng **không chặn được** dataset 100.000 dòng
> có cột định danh — đó là lỗ hổng mà GĐ8/GĐ9 vá.

---

## 1. Sự cố đã tái hiện (không phải giả định)

### 1.1. Log OOM thực tế

Khi gọi `POST /api/v1/projects/:projectId/analysis` với dataset 100.000 dòng:

```
<--- Last few GCs --->

[112142:0x23147000]  766851 ms: Mark-Compact 4093.3 (4139.3) -> 4093.3 (4139.3) MB,
                     pooled: 0 MB, 410.05 / 0.00 ms
                     allocation failure; scavenge might not succeed

FATAL ERROR: Reached heap limit Allocation failed - JavaScript heap out of memory
```

**Đây là V8 heap OOM (4 GB), KHÔNG phải kernel OOM.** Kernel log
(`/var/log/syslog`) không có mục `oom-kill` cho process này — V8 tự abort.

### 1.2. Đo từng bước của pipeline

Script đo lương heap (`/tmp/overload-verify/measure.cjs`) chạy trên chính
dataset của môi trường dev:

| Bước | Heap | RSS |
|---|---|---|
| Nạp 100.000 records từ MongoDB | 235 MB | 367 MB |
| Tạo `named` objects (`rows` + `rowWrappers`) | 249 MB | 386 MB |
| Tạo 2 mảng chuỗi (như `toCategory` làm) | 258 MB | 391 MB |
| Tạo **ma trận Cramér V** | **→ OOM ở 4093 MB** | — |

→ Kết luận: **GĐ0b (dọn bản sao trung gian) đã hiệu quả** (chỉ tiết kiệm ~14 MB),
nhưng thủ phạm thật nằm ở bước 4 — ma trận tương quan.

### 1.3. Nguyên nhân: cardinality của cột phân loại

Cardinality thực tế của dataset (đo bằng MongoDB `distinct`):

| Cột | Kiểu | Số giá trị khác nhau |
|---|---|---|
| `review_id` | string | **99.173** |
| `order_id` | string | **99.441** |
| `review_answer_timestamp` | date | 99.010 (bị loại — date) |
| `review_comment_message` | string | 36.924 |
| `review_comment_title` | string | 4.601 |
| `review_creation_date` | date | 637 (bị loại — date) |
| `review_score` | number | 5 |

Bản cũ dựng ma trận contingency **dày** (`number[][]` kích thước `r × c`):

```
review_id × order_id = 99.173 × 99.441 = 9,86 tỷ ô × 8 byte = 73,5 GB
```

V8 chết ở 4 GB. Tệ hơn: mỗi cặp cột phân loại lại dựng một ma trận riêng,
nên `buildCorrelationMatrix()` dựng **7 × 7 / 2 = 21 ma trận** lần lượt.

> **Bài học cốt lõi:** giới hạn **số dòng** không giới hạn **số giá trị khác nhau**.
> 100.000 dòng với cột ID gần như duy nhất = 100.000 giá trị khác nhau.

---

## 2. GĐ8 — Cramér V trên bảng contingency thưa

### 2.1. Thay đổi

`src/backend/src/modules/analysis/domain/correlation.util.ts` — hàm `cramersV()`:

| | Bản cũ | Bản mới |
|---|---|---|
| Cấu trúc | `number[][]` kích thước `r × c` | `Map<number, number>` (key = `i * c + j`) |
| Bộ nhớ | O(r × c) — **73,5 GB** | O(n) — chỉ giữ ô **có** quan sát |
| Thời gian | không hoàn tất | ~317 ms cho 100.000 dòng |

### 2.2. Công thức χ² — không đổi, nhưng phải bù phần ô rỗng

Công thức gốc:

```
χ² = Σ_{i,j} (O_ij − E_ij)² / E_ij,   E_ij = (rowSum_i × colSum_j) / n
```

Trong bản dày, vòng lặp duyệt **mọi** ô `(i, j)`. Trong bản thưa, ta chỉ duyệt
các ô **có quan sát**. Với ô không có quan sát (`O_ij = 0`):

```
(0 − E_ij)² / E_ij = E_ij
```

→ các ô rỗng **vẫn đóng góp** vào χ², và không thể bỏ qua!

Tổng phần đóng góp của mọi ô rỗng được rút gọn thành một số hạng:

```
Σ_{ô rỗng, E>0} E_ij = Σ_{tất cả ô} E_ij − Σ_{ô có dữ liệu} E_ij
                      = n − expectedSum
```

vì `Σ_{i,j} E_ij = (Σ_i rowSum_i) × (Σ_j colSum_j) / n = n × n / n = n`.

Do đó trong code:

```typescript
let chi2 = 0;
let expectedSum = 0;
for (const [key, observed] of obs) {
  const expected = ((rowSum.get(i) ?? 0) * (colSum.get(j) ?? 0)) / counted;
  if (!(expected > 0)) continue;
  expectedSum += expected;
  const d = observed - expected;
  chi2 += (d * d) / expected;
}
const emptyCellsExpected = counted - expectedSum;
if (emptyCellsExpected > 0) chi2 += emptyCellsExpected;
```

> ⚠️ **Bẫy đã tránh:** nếu bỏ hẳn phần bù này, Cramér V sẽ **xuống 0** với mọi
> cặp cột gần như duy nhất → kết quả tương quan sai lệch (âm thay vì dương).
> Test `GĐ8 — Cramér V trên bảng contingency thưa` có case chống hồi quy này.

### 2.3. Hợp đồng API không đổi

`r` và `c` (số mức) vẫn được trả về đúng như bản cũ → `CorrelationCell` giữ nguyên
shape → không có breaking change.

---

## 3. GĐ9 — Lọc cột theo vai trò trước khi tính tương quan

### 3.1. Vấn đề

Bản cũ xếp loại cột **chỉ theo kiểu dữ liệu**:

```typescript
const role = classifyColumn(col?.dataType ?? 'string');
// 'string' → 'categorical' → ĐƯỢC ĐƯA VÀO TƯƠNG QUAN
```

→ Mọi cột `string` (kể cả `review_id`, `order_id`) đều được coi là phân loại và
tính Cramér V. Đây chính là nguồn của ma trận 73 GB.

### 3.2. Thay đổi

`src/backend/src/modules/analysis/application/commands/run-analysis.handler.ts`:
dùng `column-role.util.ts` (đã port từ `Vqd_BE` ở GĐ1) để suy **vai trò** cột
rồi loại theo vai trò:

```typescript
const columnRoles = inferColumnRoles(
  dataset.columns.map((c) => ({ key: c.key, name: c.name, dataType: c.dataType })),
  rows,
  null,
);
const roleByName = new Map<string, AnalysisRole>(
  columnRoles.map((r) => [r.name, r.role] as const),
);

const analyzable: AnalyzableColumn[] = selectedKeys.map((key) => {
  const col = dataset.columns.find((c) => c.name === key);
  const typeRole = classifyColumn(col?.dataType ?? 'string');
  if (typeRole === 'excluded') { /* date / kiểu không hỗ trợ */ }
  const role = roleByName.get(key);
  const exclusion = role ? correlationExclusionReason(role) : null;
  if (exclusion) return { key, role: 'excluded', reason: exclusion };
  return { key, role: role === 'measure' ? 'numeric' : 'categorical', reason: null };
});
```

Quy tắc loại (từ `column-role.util.ts`):

| Vai trò | Điều kiện suy ra | Lý do loại |
|---|---|---|
| `identifier` | tên có `id`/`code`/`zip`/`phone` **và** ≥95% giá trị khác nhau | `identifier_column_excluded` |
| `text` | >50% giá trị khác nhau (văn bản tự do) | `free_text_column_excluded` |
| `datetime` | kiểu dữ liệu `date` | `date_column_excluded_from_correlation_vif` |
| `category` | ≤20 giá trị khác nhau **hoặc** ≤5% số dòng | *(giữ lại)* |
| `measure` | kiểu `number`, không phải mã định danh | *(giữ lại)* |

### 3.3. Đồng bộ đường dẫn AI (GĐ9b)

`src/backend/src/modules/analysis/application/commands/build-prompt-for-job.handler.ts`:
trước đây `excludedColumns` được tính lại **chỉ theo kiểu dữ liệu** → mâu thuẫn với
ma trận tương quan (AI được báo "loại cột X" trong khi ma trận lại không có X).
 nay đọc thẳng từ `result.correlationMatrix.excludedColumns` — nguồn duy nhất.

---

## 4. Kết quả kiểm chứng (dataset thật, 100.000 dòng)

### 4.1. Trước / sau

| | Trước | Sau |
|---|---|---|
| Kết quả API | `FATAL ERROR: Reached heap limit` | **HTTP 201** |
| Thời gian | ∞ (sập) | **7,33 giây** |
| Peak RSS | >4 GB rồi chết | **568 MB** |
| Server sau khi chạy | **đã chết** | **vẫn sống** |
| `analysisruns` | `status: running` (treo) | `status: succeeded`, `duration_ms: 6514` |

### 4.2. Kết quả tương quan (đúng nghiệp vụ)

```
=== CỘT TRONG MA TRẬN TƯƠNG QUAN ===
columns = ["review_score", "review_comment_title"]

=== CỘT ĐÃ LOẠI (kèm lý do) ===
  review_id            -> identifier_column_excluded
  order_id             -> identifier_column_excluded
  review_comment_message -> free_text_column_excluded

=== SỐ CELLS === 4
  review_score × review_comment_title: coef=0.7876 kind=cramers_v n=11712 computable=true
```

→ Ma trận chỉ còn **1 cặp** thay vì 21 cặp. Kích thước ma trận tệ nhất:
**0,17 MB** (thay vì 73,5 GB).

### 4.3. Các lớp phòng thủ khác vẫn hoạt động

| Kiểm tra | Kết quả |
|---|---|
| Guard 413 (`ANALYSIS_MAX_ROWS=1000`) | ✅ HTTP 413 trong 0,50 giây, `ANALYSIS_TOO_LARGE` |
| Đường dẫn AI (`build-prompt-for-job`) | ✅ nạp dataset lần 2 xong; peak RSS 730 MB |
| AI worker (`AI_WORKER_ENABLED=true`) | ✅ không OOM (job fail vì `AI_INFERENCE_BASE_URL` chưa cấu hình — **không phải** OOM) |

---

## 5. Kiểm thử

### 5.1. Test mới

`src/backend/test/analysis-cardinality-guard.spec.ts` — 11 test:

- Cramér V ≈ 1 khi tương quan hoàn hảo
- Cramér V ≈ 0 khi không liên hệ
- V luôn trong `[0, 1]`
- **CHỐNG OOM**: 100.000 dòng × 2 cột định danh ~99k giá trị → tính được,
  đồng thời assert ma trận dense tương ứng > 9 tỷ ô / > 70 GB (để chứng minh
  bản cũ **không thể** chạy)
- Suy vai trò: identifier / text / datetime / category
- Ma trận tương quan chỉ dùng cột đã lọc

### 5.2. Kết quả toàn bộ

```
Test Suites: 42 passed, 42 total
Tests:       595 passed, 595 total      (trước: 584)
TypeScript:  0 lỗi
ESLint:      0 cảnh báo (--max-warnings 0)
```

---

## 6. Việc còn lại

| # | Hạng mục | Mô tả | Ước lượng |
|---|---|---|---|
| GĐ10 | Guard theo cardinality | Chặn cặp cột có `distinct(A) × distinct(B)` vượt ngưỡng (vd 10M ô) — lưới an toàn cuối | 30-60 phút |
| GĐ11 | Hạ `ANALYSIS_MAX_ROWS` | Từ 100.000 → 50.000 (biện minh bằng số đo: peak RSS 568 MB) | 5 phút |
| GĐ2 | Port `suspicion.util.ts` + `missing-tokens.util.ts` | 14 kiểu nghi vấn dữ liệu (tính năng người dùng thấy được) | 1,5-2 giờ |
| GĐ3 | Port `report-content.util.ts` | Nội dung PDF đầy đủ | 1,5-2 giờ |
| GĐ5 | Viết lại test wave 6-10 | Theo 13 handler CQRS mới | 3-4 giờ |
| GĐ6 | Chart APIs | `histogram`, `boxPlot`, `categoryTopN` | 1 giờ |

---

## 7. Tài liệu liên quan

- [`20_overload_guard_gd0_gd4.md`](./20_overload_guard_gd0_gd4.md) — GĐ0 (guard số dòng) + GĐ4 (PII)
- `src/backend/src/modules/analysis/domain/correlation.util.ts` — GĐ8 (`cramersV` thưa)
- `src/backend/src/modules/analysis/domain/column-role.util.ts` — GĐ9 (suy vai trò cột)
- `src/backend/src/modules/analysis/application/commands/run-analysis.handler.ts` — GĐ9 (lọc cột)
- `src/backend/src/modules/analysis/application/commands/build-prompt-for-job.handler.ts` — GĐ9b
- `src/backend/test/analysis-cardinality-guard.spec.ts` — test GĐ8 + GĐ9
