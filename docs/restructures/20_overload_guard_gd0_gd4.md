# GĐ0 — Chống quá tải máy khi phân tích AI

> **Nhánh:** `Hoa24102026` · **Ngày:** 2026-11-18 · **Trạng thái:** hoàn tất phần core
>
> **Ghi chú yêu cầu của user (Q3):** hiện tại ưu tiên **(a) chống quá tải trước**.
> Phần **(b) — port toàn bộ logic nghiệp vụ từ nhánh `Vqd_BE`** sẽ thực hiện ở
> phiên sau. Xem mục *Việc còn lại* ở cuối tài liệu.

---

## 1. Nguyên nhân gốc

Khi gọi API phân tích AI với dataset lớn, máy bị quá tải (OOM / quá nhiệt CPU).

Nguyên nhân nằm ở `RecordQueryPort.listAllRecords()`:

```typescript
// src/backend/src/modules/datasets/infrastructure/persistence/record-query.repository.ts
async listAllRecords(datasetId: string): Promise<RecordRow[]> {
  const docs = await this.recordModel
    .find({ dataset_id: new Types.ObjectId(datasetId) })
    .sort({ row_index: 1 })
    .lean()
    .exec();
  return docs.map(toRow);
}
```

Truy vấn **không giới hạn**. Toàn bộ dataset được nạp vào RAM, rồi bị biến đổi
thành **3 bản sao** trong bộ nhớ:

```
recordRows  →  records  →  rows (object `named`)  →  rowWrappers (object `named` LẦN NỮA)
```

Với 100k dòng × N cột, chuỗi BSON deserialization + biến đổi in-memory tạo
peak-RAM vài GB → OOM hoặc CPU phải throttle nhiệt.

Ngoài ra, `listAllRecords()` được gọi **hai lần** cho cùng một lần phân tích:

| # | Vị trí | Mục đích |
|---|---|---|
| 1 | `run-analysis.handler.ts:186` | tính rule-based stats / DQ |
| 2 | `build-prompt-for-job.handler.ts:59` | dựng prompt gửi AI |

---

## 2. Chiến lược chống quá tải (2 lớp)

### Lớp 1 — Chặn sớm theo số dòng (MỚI, GĐ0)

Kiểm tra **trước khi** đọc bất kỳ record nào từ MongoDB, dựa trên
`ANALYSIS_MAX_ROWS` (mặc định **100.000** — quyết định của user).

- Mã lỗi nghiệp vụ: `ANALYSIS_TOO_LARGE` → **HTTP 413**
- Files:
  - `src/backend/src/modules/analysis/application/analysis-limit.util.ts` (mới)
  - `src/backend/src/modules/analysis/application/commands/run-analysis.handler.ts`
  - `src/backend/src/modules/analysis/application/commands/build-prompt-for-job.handler.ts`

### Lớp 2 — Chặn lúc chạy theo RAM thực (ĐÃ CÓ SẴN)

`SystemResourceGuardAdapter` đọc `/proc/meminfo` + RSS tiến trình engine AI
(`ollama runner`, `vllm`) → chặn nhận job AI mới khi máy thực sự thiếu tài nguyên.

**Điều chỉnh trong phiên này** (user đồng ý):

| Biến | Trước | Sau | Lý do |
|---|---|---|---|
| `AI_MIN_RAM_GB` | 12 | **4** | Máy dev 16 GB chỉ còn ~5.6 GB khả dụng → ngưỡng 12 GB chặn **mọi** job AI, kể cả dataset nhỏ |
| `AI_RAM_GUARD_PERCENT` | 85 | **90** | Tránh chặn oan khi RAM dùng ~85% nhưng vẫn còn dư |

### GĐ0b — Dọn bản sao trung gian

`run-analysis.handler.ts` nay tạo object `named` **đúng một lần** cho mỗi dòng,
rồi chia sẻ giữa `rows` và `rowWrappers` (hai mảng chỉ chứa *tham chiếu*).
Tương tự cho `build-prompt-for-job.handler.ts`.

Ước lượng: giảm ~40–50% peak-RAM ở bước xử lý in-memory.

---

## 3. Thay đổi chi tiết

### 3.1 Cấu hình môi trường

`src/backend/src/shared/infrastructure/config/env.validation.ts`:

```typescript
ANALYSIS_MAX_ROWS: z.coerce.number().int().min(1).max(5_000_000).default(100_000),
AI_RAM_GUARD_PERCENT: z.coerce.number().int().min(1).max(100).default(90),
AI_MIN_RAM_GB: z.coerce.number().int().min(1).default(4),
```

`src/backend/.env.example` — thêm mục `GĐ0 — CHỐNG QUÁ TẢI MÁY KHI PHÂN TÍCH AI`.

### 3.2 Mã lỗi nghiệp vụ mới

| Mã | HTTP | Lớp lỗi |
|---|---|---|
| `ANALYSIS_TOO_LARGE` | **413** | `PayloadTooLargeError` |

Đăng ký tại:
- `shared/domain/errors/error-codes.ts`
- `shared/domain/errors/domain-error.ts`
- `shared/domain/errors/index.ts`
- `shared/interfaces/errors/error-http-mapping.ts`

> Tầng `application` **không** biết HTTP — việc ánh xạ `code → 413` do
> `shared/interfaces/errors/error-http-mapping.ts` đảm nhiệm (đúng nguyên tắc
> Clean Architecture của nhánh này).

### 3.3 GĐ4 — `PATCH /datasets/:id/columns/pii`

Route mới cho phép bật/tắt cờ PII của cột.

**Vì sao route riêng, không sửa `PATCH /datasets/:id/columns`?**

Nguyên tắc bất biến dữ liệu của nhánh này: *"dữ liệu nạp vào như nào thì phải
là như vậy"* — sau khi nạp, **nội dung dataset** không được sửa. Route đổi tên
dataset / đổi tên cột / reset tên cột đã bị gỡ.

Cờ `isPii` **không phải nội dung dữ liệu** — đó là *metadata phân loại cột*,
nằm ngoài bản chụp dữ liệu. Cho phép sửa nó giữ nguyên nguyên tắc bất biến,
đồng thời mở đường cho tính năng che PII trước khi đưa dữ liệu lên prompt AI
(`domain/pii-mask.util.ts` đọc `dataset.columns[].isPii`).

| Thành phần | File |
|---|---|
| DTO (Zod) | `modules/datasets/presentation/dtos/update-column-pii.dto.ts` (mới) |
| Handler | `modules/datasets/application/commands/update-column-pii.handler.ts` (mới) |
| Hành vi entity | `Dataset.setColumnPii()` — `modules/datasets/domain/entities/dataset.entity.ts` |
| Repository port | `DatasetRepositoryPort.updateColumnPii()` |
| Adapter | `DatasetsRepository.updateColumnPii()` — dùng `$set` dot-notation `columns.N.is_pii` |
| Domain event | `DATASET_EVENTS.PII_UPDATED` = `'dataset.pii_updated'` |
| Controller | `PATCH /datasets/:id/columns/pii` — `@CheckPolicies(Update, 'Dataset')` |

**Ràng buộc:**
- Key cột phải tồn tại → `VALIDATION_ERROR` (400)
- Phải có ít nhất 1 cột **thực sự thay đổi** → `VALIDATION_ERROR` (400)
- Dataset không tồn tại → `NOT_FOUND` (404)
- Payload rỗng → `VALIDATION_ERROR` (400, Zod)

**Bất biến được bảo vệ:** adapter dùng `$set` với đường dẫn dot-notation
(`columns.0.is_pii`) nên **không** ghi đè bất kỳ trường nội dung nào khác —
kể cả trên dataset đã `READY` (khác với `updateById` chỉ chạy được ở `INGESTING`).

---

## 4. GĐ1 — Port lớp domain từ nhánh `Vqd_BE`

6 file **pure function** (không phụ thuộc framework) được port nguyên vẹn sang
`modules/analysis/domain/`:

| File | Nội dung | Số dòng |
|---|---|---|
| `column-role.util.ts` | vai trò cột: `identifier` / `category` / `measure` / `text` / `datetime` | 153 |
| `impact.util.ts` | tính `severity` / `priority` từ tỉ lệ lỗi | 107 |
| `date-parse.util.ts` | parse ngày nghiêm ngặt (chặn `2019-02-30`) | 96 |
| `chart-data.util.ts` | histogram (Freedman-Diaconis, Sturges), box plot, category chart | 116 |
| `top-n.util.ts` | clamp số phần tử top-N | 8 |
| `input-fingerprint.util.ts` | fingerprint v2 (kèm metadata cột → phát hiện kết quả lỗi thời) | 113 |

Tất cả **không có import nội bộ** → port an toàn, type-check pass ngay.

> **Lưu ý kiến trúc:** `origin/Vqd_BE` được fork từ commit cũ hơn (trước Bước 5 —
> refactor L1 Clean Architecture). Ở đó analysis nằm trong monolithic
> `AnalysisService` (~1140 dòng); ở nhánh này đã tách thành 13 handler.
> **Không được `git merge origin/Vqd_BE`** — sẽ phá vỡ Clean Architecture.
> Chỉ port có chọn lọc.

---

## 5. Kiểm thử

| Loại | Kết quả |
|---|---|
| `test/analysis-overload-guard.spec.ts` (mới, 7 test) | ✅ pass |
| `test/dataset-column-pii.spec.ts` (mới, 7 test) | ✅ pass |
| Toàn bộ test suite | ✅ **584/584 pass**, 41/41 suite |
| Arch test (`zero-any` / `guard-coverage` / `zod-openapi` / `clean-architecture`) | ✅ 17/17 pass |
| `tsc --noEmit` | ✅ 0 lỗi |
| `eslint --max-warnings 0` | ✅ 0 cảnh báo |

---

## 6. Việc còn lại (ghi chú Q3-(b) — phiên sau)

| Mã | Nội dung | Ước lượng |
|---|---|---|
| **GĐ2** | Port `shared/utils/missing-tokens.util.ts` + `domain/suspicion.util.ts` (14 kiểu nghi vấn) + tích hợp `dateOrderOf()` vào `dq.util.ts` | 1.5–2h |
| **GĐ3** | Port `application/report-content.util.ts` (PDF sections) — phụ thuộc shape `AnalysisResultRecord` **khác nhau** giữa 2 branch | 1.5–2h |
| **GĐ5** | Viết lại test `analysis-wave6..10.spec.ts` theo 13 handler mới (bản gốc import `AnalysisService` monolithic) | 3–4h |
| **GĐ6** | Endpoint chart-data (`histogram`, `boxPlot`, `categoryTopN`) | 1h |

**Tổng ước lượng để đạt parity với `Vqd_BE`: ~7–9h.**

### Ghi chú kỹ thuật cho GĐ5

Test suite của `Vqd_BE` import trực tiếp:

```typescript
import { AnalysisService } from '../src/modules/analysis/application/analysis.service';
import { SummaryService } from '../src/modules/analysis/application/summary.service';
import { StalenessService } from '../src/modules/analysis/application/staleness.service';
```

→ Đây là **monolithic service cũ**, không tồn tại ở nhánh này. Mỗi file test wave
phải viết lại theo kiểu handler mới (inject qua `DATASET_REPOSITORY_PORT`,
`ANALYSIS_REPOSITORY_PORT`, … + `createHandlerProxy`).

---

## 7. Hướng dẫn sử dụng

### Chặn dataset quá lớn

```bash
# .env
ANALYSIS_MAX_ROWS=100000     # mặc định 100.000
```

Khi dataset vượt ngưỡng, API trả:

```http
HTTP/1.1 413 Payload Too Large
```

```json
{
  "code": "ANALYSIS_TOO_LARGE",
  "message": "Dataset có 250.000 dòng, vượt giới hạn phân tích đồng bộ 100.000 dòng...",
  "details": { "rowCount": 250000, "maxRows": 100000 }
}
```

### Gắn cờ PII cho cột

```bash
curl -X PATCH http://localhost:3000/api/v1/datasets/<datasetId>/columns/pii \
  -H "Authorization: Bearer <access_token>" \
  -H "Content-Type: application/json" \
  -d '{"columns":[{"columnKey":"c3","isPii":true}]}'
```

Response trả về dataset đã cập nhật (giống `GET /datasets/:id`).

---

## 8. Tài liệu liên quan

- `docs/restructures/` — lịch sử refactor kiến trúc nhánh này
- `src/backend/src/modules/analysis/application/analysis-limit.util.ts` — lớp guard
- `src/backend/src/modules/analysis/infrastructure/ai/system-resource-guard.adapter.ts` — guard RAM
