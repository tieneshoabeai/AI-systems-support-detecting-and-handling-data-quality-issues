# 2. Kiểm kê & số liệu baseline (bản hybrid 6+7)

> Nguồn: đo trực tiếp từ cây nguồn ở P1 (`31cd2f3`). Dùng để **lập kế hoạch** và **đo kết quả** sau refactor. Viết lại 2026-11-24 theo ADR-0002.

---

## 2.1. Baseline tổng thể

| Chỉ số | Baseline (P1) | Mục tiêu hybrid | Nguồn đo |
|---|---|---|---|
| File `.ts` trong `src/modules/` | **340** | **~305** (chỉ flatten 6 Simple) | `find src/modules -name '*.ts' \| wc -l` |
| LOC trong `src/modules/` | **31 505** | **~28 500** (−~3 000) | `wc -l` |
| File `.ts` trong `src/shared/` | **88** | 88 (không đổi) | — |
| LOC trong `src/shared/` | **5 567** | 5 567 (không đổi) | — |
| Thư mục con trong `src/modules/` | **~60** | **~30** (−~30, từ 6 Simple) | `find … -mindepth 2 -type d` |
| Template kiến trúc | 4 tầng đồng nhất × 13 | **Simple × 6 + Hexagonal × 7** | — |
| Rule kiến trúc | MM1–MM4 + CA nội bộ H | MM1–MM4 + MM5' (không ép phẳng) | `eslint.config.mjs` + arch test |
| HTTP route | **82 HTTP + 1 WS** | **82+1** (bất biến) | `pnpm arch:api-coverage` |
| Handler | **107** (61 cmd + 46 query) + 3 subscriber | 107 (Simple → method; H giữ file) | inventory handler |
| Mongoose model | **18 (17 file)** | bất biến | `MongooseModule.forFeature` |
| Test | **1 277** / 79 suite | 1 277 (bất biến, chỉ đổi import path) | `pnpm test*` |
| Coverage (stmts) | 71.03% | ≥ 71% | `pnpm test:cov` |

> Hướng cũ đặt mục tiêu ~180 file / ~20 000 LOC vì ép cả 13 module phẳng — **đã bỏ**. Mục tiêu mới thực tế hơn vì 7 Hexagonal không gộp.

---

## 2.2. Baseline chi tiết từng module + template chốt

| Module | Handler (cmd/qry) | File `.ts` | LOC | Template chốt | Ghi chú bất biến (§12) |
|---|---|---|---|---|---|
| `audit` | 1 / 0 | 8 | 353 | 🟢 **Simple — PILOT** | facade `AUDIT_LOGGER_PORT`, `LogHandler.execute()` → `AuditService.log()` |
| `overview` | 0 / 2 | 5 | 190 | 🟢 **Simple** | 2 query đọc/view, không DB riêng |
| `realtime` | 0 / 0 (+1 sub) | 8 | 642 | 🟢 **Simple** | WS gateway + subscriber, side-effect cục bộ |
| `data-view` | 0 / 4 | 15 | 967 | 🟢 **Simple** | 4 query, không repo riêng (qua `RECORD_QUERY_PORT`) |
| `notifications` | 3 / 3 | 21 | 1 294 | 🟢 **Simple** | 6 handler; **giữ 2 mapper riêng** (DB vs email) — không gộp |
| `feedback` | 5 / 2 | 21 | 2 186 | 🟢 **Simple (có điều kiện)** | 7 handler; giữ `create/updateByAuthor + requiresReason + ensureNotAdmin` trong `types.ts`; tương thích camel/snake |
| `issues` | 4 / 5 | 23 | 1 913 | 🟠 **Hexagonal** (đổi so với hướng cũ) | optimistic locking + 1 controller (2 nhóm route) + cascade — đủ ngưỡng giữ H (D14) |
| `datasets` | 4 / 4 (+1 sub) | 33 | 4 227 | 🟠 **Hexagonal** | 2 schema/2 repo, tx strict, policy loader |
| `projects` | 10 / 7 (+1 sub) | 43 | 3 182 | 🟠 **Hexagonal** | 17 handler + 3 policy loader + best-effort outbox |
| `users` | 11 / 6 | 34 | 2 822 | 🟠 **Hexagonal** | password policy + revocation service |
| `workspaces` | 8 / 6 | 38 | 2 625 | 🟠 **Hexagonal** | quota 20, tx strict, RBAC 3 tầng |
| `analysis` | 6 / 5 | 56 | 8 242 | 🔴 **Hexagonal** | AI worker + RAM/cardinality guard + 7 schema + 14 util |
| `auth` | 9 / 2 | 35 | 2 862 | 🔴 **Hexagonal** | OAuth/session rotation + 7 token + 4 adapter |
| **Tổng** | **61 / 46 = 107 (+3 sub)** | **340** | **31 505** | 6 S + 7 H | — |

### Thứ tự làm việc

| Phase | Module | Việc | Handler chạm |
|---|---|---|---|
| P2 pilot | `audit` (Simple) | Flatten mẫu, chốt template S | 1 |
| P3 Simple còn lại | `overview → realtime → data-view → notifications → feedback` | Flatten 5 module (feedback khó nhất để cuối) | 2+0+4+6+7 = 19 |
| P4 Hexagonal vừa | `datasets, projects, workspaces, users` | Chuẩn hóa import + README, không gộp | 8+17+14+17 = 56 (+2 sub) |
| P5 Hexagonal khó | `issues, analysis, auth` | Chuẩn hóa + tài liệu lý do giữ H | 9+11+11 = 31 (+1 sub) |

> Tổng Simple flatten: **20 handler** (`audit` 1 + P3 19). Tổng Hexagonal chuẩn hóa: **87 handler + 3 sub** (giữ nguyên file).

---

## 2.3. Cross-module import — giữ nguyên MM2

**Đo được ở P1:** 116 cross-module import, **100% qua `index.ts`** — đã đạt, không làm lại.

| Nguồn → Đích (top) | Số import |
|---|---|
| `data-view` → `datasets` | 13 |
| `analysis` → `projects` | 8 |
| `projects` → `workspaces` | 7 |
| `feedback` → `projects` | 6 |
| `feedback` → `workspaces` | 6 |
| *(còn lại)* | xem bản cũ / quét lại bằng AST |

> Khi flatten Simple: import nội bộ module rút ngắn; import chéo module **vẫn qua `index.ts`** (MM2). Khi chuẩn hóa H: chỉ sửa deep import còn sót (nếu có), không đổi public contract.

---

## 2.4. Bảng quy đổi file

### 2.4a. Simple (áp dụng 6 module S)

| Tầng cũ | Đích | Quy tắc |
|---|---|---|
| `presentation/controllers/*.controller.ts` | `<mod>.routes.ts` | gộp controller + DTO 1 nơi |
| `presentation/dtos/*.dto.ts` | `<mod>.routes.ts` hoặc `<mod>.types.ts` | DTO 1 nơi → nhúng vào routes |
| `presentation/responses/*.response.ts` | `<mod>.types.ts` | type response |
| `application/commands/*.handler.ts` | `<mod>.service.ts` | mỗi handler → 1 method, giữ `execute()` + thứ tự tham số |
| `application/queries/*.handler.ts` | `<mod>.service.ts` | như trên |
| `application/services/*.service.ts` | `<mod>.service.ts` | gộp |
| `domain/entities/*.entity.ts` (nhẹ) | `<mod>.types.ts` | vd `Notification.create/markAsRead`, `Feedback.create` |
| `domain/value-objects/*.vo.ts` | `<mod>.types.ts` | enum + helper |
| `infrastructure/persistence/*.schema.ts` | `<mod>.schema.ts` | giữ (nếu có DB riêng) |
| `infrastructure/persistence/*.repository.ts` | `<mod>.repository.ts` | giữ (nếu có DB riêng) |
| `infrastructure/persistence/*.mapper.ts` | giữ riêng nếu khác nghĩa | **`notifications`: giữ 2 mapper riêng** |
| `index.ts` / `<mod>.module.ts` | giữ | **bất biến** |

### 2.4b. Hexagonal (áp dụng 7 module H)

| Việc | Quy tắc |
|---|---|
| Giữ toàn bộ `application/ + domain/ + infrastructure/ + presentation/` | không gộp, không đổi tên file |
| Chuẩn hóa `index.ts` | export public contract rõ (port/symbol dùng chéo) |
| Sửa import | nội bộ module import trực tiếp; chéo module qua `index.ts` |
| Viết `README.md` | ghi `Template: Hexagonal` + lý do giữ + invariant chính |

---

## 2.5. Script đo lại (chạy sau mỗi module/phase)

Dùng `scripts/measure-refactor.sh` đã có từ P1. Ghi kết quả vào `docs/refactor/notes.md` + bảng §2.6.

```bash
./scripts/measure-refactor.sh
pnpm type-check && pnpm lint
pnpm arch:api-coverage   # phải 82 HTTP + 1 WS
pnpm test -- <module-liên-quan>
```

---

## 2.6. Đường cong đo lại (mục tiêu hybrid)

| Phase | File `.ts` | LOC | Thư mục con | Handler | Ghi chú |
|---|---|---|---|---|---|
| Baseline P1 | 340 | 31 505 | ~60 | 107 | `31cd2f3` |
| Sau P2 (`audit`) | ~333 | ~31 150 | ~55 | 107 | Simple mẫu |
| Sau P3 (5 Simple) | ~305 | ~28 500 | ~30 | 107 | xong 6 Simple |
| Sau P4 (4 H chuẩn hóa) | ~305 | ~28 500 | ~30 | 107 | file không đổi, chỉ chuẩn hóa |
| Sau P5 (3 H chuẩn hóa) | ~305 | ~28 500 | ~30 | 107 | file không đổi |
| Sau P6/P7 | ~305 | ~28 500 | ~30 | 107 | tài liệu + verify |

> **Ước lượng hybrid:** giảm **~10% file**, **~10% LOC**, **~50% thư mục con** — khiêm tốn nhưng an toàn; giá trị chính nằm ở 6 Simple gọn + tài liệu rõ template.
