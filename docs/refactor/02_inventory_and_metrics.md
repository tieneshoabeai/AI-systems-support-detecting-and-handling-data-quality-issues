# 2. Kiểm kê & số liệu baseline

> Nguồn: đo trực tiếp từ cây nguồn ngày 2026-11-21. Dùng để **lập kế hoạch** và **đo kết quả** sau refactor.

---

## 2.1. Baseline tổng thể

| Chỉ số | Baseline | Mục tiêu | Nguồn đo |
|---|---|---|---|
| File `.ts` trong `src/modules/` | **340** | ~180 | `find src/modules -name '*.ts' \| wc -l` |
| LOC trong `src/modules/` | **31 505** | ~20 000 | `find … -exec cat {} + \| wc -l` |
| File `.ts` trong `src/shared/` | **88** | 88 (không đổi) | — |
| LOC trong `src/shared/` | **5 567** | 5 567 (không đổi) | — |
| **Tổng file `.ts`** | **427** | ~268 | — |
| **Tổng LOC** | **36 643** | ~25 500 | — |
| Thư mục con trong `src/modules/` | **~60** | ~20 | `find … -mindepth 2 -type d` |
| Tầng kiến trúc | **4** | **1** | — |
| Rule kiến trúc | **14** | **5** | `eslint.config.mjs` + `clean-architecture.spec.ts` |
| HTTP route | **82 HTTP + 1 WS** | **82** (bất biến) | `pnpm arch:api-coverage` |
| Handler | **107** (61 cmd + 46 query) | 107 service method | `19_handler_inventory.md` |
| Mongoose model | **18 (17 file)** | 20 (bất biến) | `MongooseModule.forFeature` |
| Test | **1 277** / 79 suite | 1 277 (bất biến) | `pnpm test*` |
| Coverage (stmts) | 71.03% | ≥ 71% | `pnpm test:cov` |

---

## 2.2. Baseline chi tiết từng module

| Module | Handler (cmd/qry) | File `.ts` | LOC | Tầng con | Phân loại |
|---|---|---|---|---|---|
| `analysis` | 6 / 5 | 56 | 8 242 | 6 | 🔴 T3 — chỉ di chuyển (11 handler + 3 service + 7 schema + 14 util, xem §12.2) |
| `auth` | 9 / 2 | 35 | 2 862 | 6 | 🔴 T3 — chỉ di chuyển (11 handler + 2 service + 7 token + 4 adapter, xem §12.2) |
| `datasets` | 4 / 4 | 33 | 4 227 | 7 | 🟡 T2 — nhạy cảm nhất (8 handler + 1 subscriber, 2 schema, 2 repository, xem §12.5) |
| `projects` | 10 / 7 | 43 | 3 182 | 7 | 🟡 T2 (17 handler + 1 subscriber, 3 policy loader, xem §12.2) |
| `users` | 11 / 6 | 34 | 2 822 | 6 | 🟡 T2 (17 handler + revocation service, xem §12.2) |
| `workspaces` | 8 / 6 | 38 | 2 625 | 7 | 🟡 T2 (14 handler, quota 20, transaction strict, xem §12.5) |
| `feedback` | 5 / 2 | 21 | 2 186 | 6 | 🟡 T2 (7 handler, `ensureNotAdmin`, tương thích camel/snake, xem §12.2) |
| `issues` | 4 / 5 | 23 | 1 913 | 6 | 🟡 T2 nhưng làm ở P3 (9 handler, optimistic locking, 2 nhóm user/admin) |
| `notifications` | 3 / 3 | 21 | 1 294 | 6 | 🟢 T1 (6 handler, 2 mapper khác nhau — không gộp, xem §12.2) |
| `data-view` | 0 / 4 | 15 | 967 | 4 | 🟢 T1 (4 query, không có repository riêng — qua `RECORD_QUERY_PORT`) |
| `realtime` | 0 / 0 | 8 | 642 | 4 | 🟢 T1 |
| `audit` | 1 / 0 | 8 | 353 | 4 | 🟢 T1 — **PILOT** |
| `overview` | 0 / 2 | 5 | 190 | 2 | 🟢 T1 |
| **Tổng** | **61 / 46 = 107 (+3 subscriber)** | **340** | **31 505** | ~60 | — |

### Phân loại rủi ro

| Tier | Module | Tiêu chí | Handler | Ước lượng giờ |
|---|---|---|---|---|
| 🟢 **T1** | `audit` (1), `overview` (2), `data-view` (4), `realtime` (0+1 sub), `notifications` (6) | CRUD + đọc view, side-effect cục bộ (realtime disconnect, email mapper) | 13 | 2h |
| 🟡 **T2** | `issues` (9, làm ở P3), `feedback` (7, làm ở P3), `datasets` (8+1 sub), `users` (17), `workspaces` (14), `projects` (17+1 sub) | Có transaction/outbox/cascade/policy, có invariant phức tạp | 72 | 9–10h (P3 gánh `issues`+`feedback`, P4 gánh 4 module còn lại) |
| 🔴 **T3** | `auth` (11), `analysis` (11) | OAuth/session rotation, AI worker + RAM guard + cardinality guard | 22 | 3h (chỉ di chuyển, xem §12.2) |

> **Đếm lại đúng (quét thật):** T1 lõi `audit`(1) + `overview`(2) + `data-view`(4) + `realtime`(0) = **7 handler**; cộng `notifications`(6) = **13**. P3 làm thêm `feedback`(7) + `issues`(9) nên tổng P3 = **28 handler** (xem §12.2). T2 còn lại 4 module = **56 handler + 2 subscriber**. T3 = **22 handler**. Tổng **107 + 3 subscriber**. ✅

---

## 2.3. Cross-module import — hiện trạng đã tốt

**Đo được:** 116 cross-module import, **100% đi qua `index.ts`** (public contract) — không có deep import nào.

| Nguồn → Đích | Số import |
|---|---|
| `data-view` → `datasets` | 13 |
| `analysis` → `projects` | 8 |
| `projects` → `workspaces` | 7 |
| `feedback` → `projects` | 6 |
| `feedback` → `workspaces` | 6 |
| `feedback` → `users` | 5 |
| `analysis` → `datasets` | 4 |
| `feedback` → `analysis` | 4 |
| `projects` → `users` | 4 |
| `workspaces` → `users` | 4 |
| `datasets` → `workspaces` | 3 |
| `datasets` → `projects` | 3 |
| `issues` → `notifications` | 3 |
| `auth` → `users` | 3 |
| `overview` → `workspaces` | 3 |
| *(còn lại)* | 47 |

> **Phát hiện quan trọng:** Ranh giới module **đã được enforce chặt** bằng `index.ts` + ESLint + arch test. Đây chính là "M2" của modular monolith — **đã đạt**.
>
> → **Không cần làm lại.** Chỉ cần giữ nguyên cơ chế này khi flatten thư mục.

---

## 2.4. Bảng quy đổi file theo module (dùng cho P2–P5)

Áp dụng cho mọi module — mẫu chuẩn hóa:

| Tầng cũ | Đích | Quy tắc đặt tên |
|---|---|---|
| `presentation/controllers/X.controller.ts` | `x.routes.ts` | gộp controller + DTO vào 1 file |
| `presentation/dtos/*.dto.ts` | `x.routes.ts` hoặc `x.types.ts` | DTO chỉ dùng 1 nơi → nhúng vào routes |
| `presentation/responses/*.response.ts` | `x.types.ts` | type response |
| `application/commands/*.handler.ts` | `x.service.ts` | mỗi handler → 1 method của service |
| `application/queries/*.handler.ts` | `x.service.ts` | như trên |
| `application/services/*.service.ts` | `x.service.ts` | gộp vào service chính |
| `application/policy-loaders/*.ts` | `x.policy.ts` | giữ riêng |
| `application/ports/*.port.ts` | `x.service.ts` hoặc `x.types.ts` | port nội bộ → gộp |
| `domain/entities/*.entity.ts` | `x.types.ts` | type + schema |
| `domain/value-objects/*.vo.ts` | `x.types.ts` | enum + helper |
| `domain/events/*.event.ts` | `x.events.ts` | giữ riêng nếu có |
| `domain/ports/*.port.ts` | `x.types.ts` (interface) | interface trong types |
| `domain/services/*.util.ts` | `x.service.ts` hoặc `x.utils.ts` | util thuần |
| `infrastructure/persistence/X.schema.ts` | `x.schema.ts` | giữ |
| `infrastructure/persistence/X.repository.ts` | `x.repository.ts` | giữ (nếu tách) |
| `infrastructure/persistence/X.mapper.ts` | gộp vào `x.repository.ts` | **chỉ T1/T2** |
| `infrastructure/adapters/*.adapter.ts` | `x.adapter.ts` | giữ |
| `index.ts` | `index.ts` | **giữ nguyên** |
| `x.module.ts` | `x.module.ts` | **giữ nguyên** |

### Quy tắc "giữ file hay gộp"

| Điều kiện | Hành động |
|---|---|
| File > 150 LOC hoặc phục vụ > 1 mục đích rõ ràng | **Giữ riêng** (vd: `x.repository.ts`) |
| File chỉ là wrapper 1-1 | **Gộp** |
| File < 60 LOC và chỉ dùng 1 nơi | **Gộp** |
| File là interface + Symbol được module khác dùng | **Giữ riêng** trong `x.types.ts` hoặc `x.repository.ts` |

---

## 2.5. Script đo lại (chạy sau mỗi phase)

Tạo file `scripts/measure-refactor.sh` — xem `03_phase_p0_p1.md` §3.4.

```bash
#!/usr/bin/env bash
# Đo baseline sau mỗi phase refactor
set -euo pipefail
cd "$(dirname "$0")/.."

printf '=== File .ts trong src/modules ===\n'
find src/modules -name '*.ts' | wc -l

printf '=== LOC trong src/modules ===\n'
find src/modules -name '*.ts' -exec cat {} + | wc -l

printf '=== Thư mục con trong src/modules ===\n'
find src/modules -mindepth 2 -type d | wc -l

printf '=== Handler ===\n'
ls src/modules/*/application/{commands,queries}/*.handler.ts 2>/dev/null | wc -l || true

printf '=== Route (contract 3.13) ===\n'
node scripts/check-api-coverage.cjs | tail -3
```

> **Ghi kết quả vào `docs/refactor/notes.md`** sau mỗi phase — đây là số liệu dùng cho báo cáo đồ án.

---

## 2.6. Đường cong đo lại

| Phase | File `.ts` | LOC | Thư mục con | Handler | Ghi chú |
|---|---|---|---|---|---|
| Baseline (hiệu chỉnh 2026-11-23) | 340 | 31 505 | ~60 | 107 | — |
| Sau P2 (pilot) | −7 | −~350 | −5 | 107 | `audit` làm mẫu |
| Sau P3 (T1) | ~305 | ~28 000 | ~38 | 107 | 6 module dễ |
| Sau P4 (T2) | ~225 | ~22 500 | ~22 | 107 | 5 module vừa |
| Sau P5 (T3) | ~180 | ~20 000 | ~20 | 107 | chỉ di chuyển |

> **Ước lượng:** giảm **~47% file**, **~36% LOC**, **~67% thư mục con**.
