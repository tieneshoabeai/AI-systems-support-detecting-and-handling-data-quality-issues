# GĐ12 — Semaphore chống chặn event loop khi phân tích đồng bộ

> Ngày: 2026-11-19.
> Bối cảnh: phát hiện trong `docs/test-reports/perf-2026-11-19.md` (mục 4).

## 1. Vấn đề gốc

`POST /projects/:projectId/analysis` xử lý **đồng bộ** toàn bộ trong request
handler: đọc toàn bộ dataset từ MongoDB → tính DQ-01/02/03, thống kê mô tả,
ma trận tương quan, VIF → ghi kết quả.

Với dataset **100.000 dòng**, một lần chạy mất **~6,4 s** (p95 đo bằng k6) và
**chặn event loop** của Node trong suốt thời gian đó.

Node.js **đơn luồng** → trong 6 giây đó, mọi request khác của cùng instance phải
xếp hàng. Khi 10 VU gọi phân tích đồng thời, hệ quả đo được:

| Chỉ số | Trước | Sau (semaphore) |
|---|---|---|
| `read_records` p95 (50 VU) | **16,53 s** | **3,95 s** (−76 %) |
| `dq01_50k` p95 (10 VU) | **60 s** (hết timeout) | **5,18 s** (−91 %) |
| `dq01_50k` max | 60 s | 9,04 s |
| Lỗi 5xx | 0 | 0 |

Nguyên nhân gốc không phải "quá tải" mà là **xếp hàng**: 10 lần phân tích × 6,4 s
≈ 64 s → vượt ngưỡng k6 (120 s tính cả phần bị cắt).

## 2. Vì sao không tách worker ngay

Hai hướng đã được cân nhắc:

| Hướng | Mô tả | Đánh giá |
|---|---|---|
| **A** | `POST /analysis` trả `202` + đẩy job vào hàng đợi, worker xử lý | Đúng về kiến trúc (giống `AiWorkerService` / `ReportWorkerService`) nhưng **đổi hợp đồng API** — frontend phải chờ polling thay vì nhận kết quả ngay |
| **B** | Giữ đồng bộ, giới hạn số phân tích **đồng thời**, trả `429` khi đã đủ slot | **Không đổi hợp đồng API**, triển khai được ngay, loại bỏ hàng đợi |

**Quyết định:** triển khai **B** trước. Đây là lớp trung gian, không phải điểm dừng:
hướng A vẫn là bước tiếp theo khi sẵn sàng đổi hợp đồng.

## 3. Thiết kế

### 3.1. `AnalysisConcurrencyGuard` — `src/backend/src/modules/analysis/application/analysis-limit.util.ts`

```typescript
export class AnalysisConcurrencyGuard {
  private running = 0;

  constructor(private readonly maxConcurrency: number) {}

  tryAcquire(): boolean {
    if (this.running >= this.maxConcurrency) return false;
    this.running++;
    return true;
  }

  release(): void { if (this.running > 0) this.running--; }

  async run<T>(task: () => Promise<T>, retryAfterSeconds = 5): Promise<T> {
    if (!this.tryAcquire()) {
      throw new RateLimitExceededError(/* … */, {
        maxConcurrency: this.maxConcurrency,
        activeCount: this.running,
        retryAfterSeconds,
      });
    }
    try { return await task(); } finally { this.release(); }
  }
}
```

**Vì sao `tryAcquire` (không chờ)?** Chờ trong request đồng bộ chính là vấn đề
đang giải quyết — chờ = vẫn chặn event loop. Thay vào đó: từ chối ngay kèm
`Retry-After` để client tự lên lịch thử lại.

**Vì sao `try/finally`?** Slot **phải** được trả về kể cả khi task ném lỗi —
nếu không, một lần lỗi sẽ "rò" slot và hệ thống dần kẹt ở trạng thái 429 vĩnh viễn.

### 3.2. Cấu hình

```bash
# .env
ANALYSIS_MAX_CONCURRENCY=1   # mặc định 1, trần cứng 8
```

| Giá trị | Ý nghĩa |
|---|---|
| `1` (mặc định) | Chỉ 1 phân tích đồng bộ mỗi tiến trình. Đọc dataset 100k dòng chỉ chặn event loop ~6 s/lần |
| `2` | Cho phép 2 phân tích chạy song song — độ trễ xử lý tăng gấp đôi nhưng **giảm** tần suất 429 |
| `> 8` | Bị chặn bởi `env.validation.ts` (trần cứng) — hàng đợi vô hạn vô nghĩa |

> **Giới hạn trên MỖI instance.** Chạy N replica (Kubernetes/SaaS) → tổng số
> phân tích đồng thời = N × giá trị này. Khi mở rộng theo chiều ngang, cần cân
> nhắc đặt `ANALYSIS_MAX_CONCURRENCY = 1` và dựa vào số replica.

### 3.3. Tích hợp vào handler

`RunAnalysisHandler.execute()` được tách thành hai lớp:

```typescript
async execute(projectId, dto, userId?) {
  return this.concurrencyGuard.run(() => this.executeAnalysis(projectId, dto, userId));
}

private async executeAnalysis(projectId, dto, userId?) { /* … toàn bộ logic cũ … */ }
```

Guard được **khởi tạo trong constructor** (đọc `ANALYSIS_MAX_CONCURRENCY` một lần
khi khởi động), vì đây là cấu hình ứng dụng chứ không phải tham số request.

### 3.4. Phản hồi 429

```http
HTTP/1.1 429 Too Many Requests
Retry-After: 5
```

```json
{
  "success": false,
  "error": {
    "code": "LIMIT_EXCEEDED",
    "message": "Hệ thống đang xử lý 1 phân tích đồng bộ. Vui lòng thử lại sau ít phút.",
    "details": {
      "maxConcurrency": 1,
      "activeCount": 1,
      "retryAfterSeconds": 5
    }
  }
}
```

Header `Retry-After` được set trong `AllExceptionsFilter` (điểm tập trung duy nhất
của hợp đồng lỗi HTTP) khi `status === 429` **và** `details.retryAfterSeconds`
là số dương.

### 3.5. Phạm vi

| Nơi | Có dùng guard? |
|---|---|
| `POST /projects/:id/analysis` (đồng bộ) | ✅ **Có** |
| `POST /analysis/jobs/:jobId/retry` (AI worker) | ❌ Không — đã chạy ở worker riêng với hàng đợi hệ thống |
| Report worker | ❌ Không — tương tự |

Guard **không** dùng cho AI job / report job: hai loại đó đã tách khỏi API từ
trước và có cơ chế hàng đợi riêng.

## 4. Kết quả đo

Môi trường: local, Node đơn luồng, MongoDB 7, dataset CSV **100.000 dòng × 6 cột**
(4,3 MB), `ANALYSIS_MAX_ROWS=150000`.

### 4.1. Độ trễ phân tích đơn lẻ (`analysis-latency.js`, 1 VU × 3 lần)

| Chỉ số | Giá trị | Ngưỡng | Kết quả |
|---|---|---|---|
| avg | 6,07 s | — | — |
| median | 6,14 s | — | — |
| **p95** | **6,38 s** | < 8 s | ✅ |
| max | 6,41 s | — | — |

→ Semaphore **không ảnh hưởng** độ trễ của một phân tích đơn lẻ (đúng như
thiết kế: guard chỉ chặn *phần thừa*, không chặn phần đầu).

### 4.2. Stress đồng thời (`stress.js`, 50 VU đọc + 20 VU upload + 10 VU phân tích)

**Baseline** (`ANALYSIS_MAX_CONCURRENCY=8` — không chặn hàng đợi):

| Kịch bản | p95 | Ghi chú |
|---|---|---|
| `read_records` | **16,53 s** | ~8× ngưỡng 2 s |
| `dq01_50k` | **60 s** | hết thời gian chờ của k6 |
| checks | 97,58 % | upload 429 bị tính là fail |

**Sau khi bật semaphore** (`ANALYSIS_MAX_CONCURRENCY=1`):

| Kịch bản | p95 | Ngưỡng | Kết quả |
|---|---|---|---|
| `read_records` | **3,95 s** | < 2 s | ❌ (xem ghi chú bên dưới) |
| `dq01_50k` | **5,18 s** | < 120 s | ✅ |
| `checks` | **99,88 %** | > 98 % | ✅ |
| `429 kèm Retry-After` | 100 % | — | ✅ |

**Ghi chú về `read_records` vẫn > 2 s:** một lần phân tích 100k dòng vẫn chặn
event loop ~6 s. Semaphore loại bỏ **xếp hàng** (10 lần × 6,4 s = 64 s → 1 lần
× 6,4 s) nhưng không loại bỏ **bản thân** thời gian chặn. Muốn `read_records` p95
< 2 s thì **phải** tách phân tích sang worker (hướng A) hoặc đưa phần tính nặng
sang worker thread (hướng C).

### 4.3. Xác nhận hành vi 429

5 request phân tích **song song** (concurrency = 1):

```
3:429  1:429  4:429  2:429  5:201
```

→ Đúng 1 request chạy, 4 request bị từ chối ngay (không xếp hàng). Trong log
server: **507** lần `429` với `analysis`, **0** lỗi 5xx.

## 5. Kiểm thử

| Loại | Nội dung |
|---|---|
| `test/analysis-concurrency-guard.spec.ts` (mới, 12 test) | `resolveAnalysisMaxConcurrency` (mặc định / chuỗi số / giá trị sai / trần cứng) + `AnalysisConcurrencyGuard` (giữ slot, 429 kèm details, **giải phóng slot khi task lỗi**, không vượt số slot khi chạy song song, `release()` không âm) |
| `test/analysis-wave6-10.spec.ts` (+3 test) | Tích hợp thật với `RunAnalysisHandler`: lần 1 chiếm slot → lần 2 nhận `LIMIT_EXCEEDED`; sau khi lần 1 xong thì slot trả lại; `ANALYSIS_MAX_CONCURRENCY` sai → fallback 1 |
| `test/k6/stress.js` (cập nhật) | Chấp nhận 429 cho upload (rate-limit chung) + check mới "429 kèm Retry-After" |

**Trạng thái toàn bộ:** type-check 0 lỗi · lint 0 cảnh báo · unit **802/802** (53 suite) ·
E2E 70/70 · arch 17/17.

## 6. Tác động lên hợp đồng API

| Mã | Mô tả | Thay đổi |
|---|---|---|
| `POST /projects/:projectId/analysis` | Trả `429` khi vượt `ANALYSIS_MAX_CONCURRENCY` | **Bổ sung** — trước đây luôn xếp hàng |
| — | Header `Retry-After` | **Bổ sung** |
| — | Mã lỗi `LIMIT_EXCEEDED` | Đã có sẵn trong hợp đồng (§3.1) |

Hợp đồng `7_api_contracts_v8.md` **chưa** được cập nhật cho thay đổi này — xem
`docs/restructures/17_api_gap_analysis_v1.md` (mục "Việc còn lại").

## 7. Còn lại

| Hạng mục | Mô tả | Ước lượng |
|---|---|---|
| **Hướng A** | `POST /analysis` trả `202` + hàng đợi; worker xử lý | 4–6 h + đổi hợp đồng |
| **Hướng C** | Đưa phần tính nặng (tương quan/VIF) sang `worker_threads` | ~3 h |
| Cập nhật hợp đồng | `7_api_contracts_v8.md` §3.1/§3.13 — ghi nhận 429 + `Retry-After` | 30 phút |

## 8. Tài liệu liên quan

- [`docs/test-reports/perf-2026-11-19.md`](../test-reports/perf-2026-11-19.md) — số liệu gốc
- [`20_overload_guard_gd0_gd4.md`](./20_overload_guard_gd0_gd4.md) — GĐ0 (guard số dòng)
- [`21_cardinality_guard_gd8_gd9.md`](./21_cardinality_guard_gd8_gd9.md) — GĐ8/GĐ9 (guard cardinality)
- `src/backend/src/modules/analysis/application/analysis-limit.util.ts` — `AnalysisConcurrencyGuard`
- `src/backend/src/modules/analysis/application/commands/run-analysis.handler.ts` — điểm tích hợp
- `src/backend/src/shared/interfaces/filters/all-exceptions.filter.ts` — header `Retry-After`
