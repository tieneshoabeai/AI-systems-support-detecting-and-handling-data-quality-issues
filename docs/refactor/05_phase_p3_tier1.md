# 5. Phase P3 — Tier 1: 6 module dễ (3 giờ)

> **Thời gian:** 3 giờ · **Mục tiêu:** áp dụng template P2 cho 6 module có rủi ro thấp.
> **Điều kiện tiên quyết:** P2 đã qua cổng kiểm soát.

---

## 5.1. Thứ tự thực hiện (quan trọng)

Làm **từ nhỏ đến lớn** để tích lũy kinh nghiệm và phát hiện vấn đề sớm:

| # | Module | File | LOC | Handler | Thời gian | Ghi chú đặc biệt |
|---|---|---|---|---|---|---|
| 1 | `overview` | 5 | 190 | 2 | 20 phút | Không có DB, không schema — đơn giản nhất |
| 2 | `realtime` | 8 | 642 | 0 | 30 phút | Không có handler; có gateway + transport |
| 3 | `data-view` | 15 | 897 | 4 | 35 phút | Không có repository riêng; dùng `datasets` |
| 4 | `notifications` | 21 | 1 294 | 6 | 40 phút | Có email mapper, notification mapper |
| 5 | `feedback` | 21 | 2 103 | 7 | 45 phút | 2 entity (feedback + finding-feedback) |
| 6 | `issues` | 23 | 1 913 | 9 | 50 phút | 2 controller (user + admin) |
| | **Tổng** | **93** | **7 039** | **28** | **3 giờ 40 phút** | |

> **Ước lượng 3h.** Nếu vượt → cắt `issues` (làm sau P4). Đường cắt đã định nghĩa sẵn.

---

## 5.2. Module `overview` — 20 phút

### Cấu trúc hiện tại
```
src/modules/overview/
├── application/queries/get-user-overview.handler.ts
├── application/queries/get-workspace-overview.handler.ts
├── index.ts
├── overview.module.ts
└── presentation/controllers/overview.controller.ts
```

### Đích
```
src/modules/overview/
├── overview.module.ts
├── overview.routes.ts        ← từ presentation/controllers/overview.controller.ts
├── overview.service.ts       ← từ application/queries/*.handler.ts (2 handler)
├── index.ts
└── README.md
```

### Bước thực hiện

| Bước | Hành động |
|---|---|
| 1 | `git mv presentation/controllers/overview.controller.ts overview.routes.ts` |
| 2 | `git mv application/queries/get-user-overview.handler.ts overview.service.ts` |
| 3 | `git mv application/queries/get-workspace-overview.handler.ts _tmp/` |
| 4 | Gộp 2 handler vào `overview.service.ts` → `OverviewService` với 2 method `getUserOverview()` / `getWorkspaceOverview()` |
| 5 | Sửa import trong `overview.routes.ts` (controller → dùng `OverviewService`) |
| 6 | Sửa `overview.module.ts`: provider `OverviewService` |
| 7 | Sửa `index.ts` |
| 8 | `rm -rf application presentation` |
| 9 | Verify + commit + tag |

### ⚠️ Quyết định quan trọng: gộp 2 handler vào 1 service hay giữ 2 file?

| Cách | Khi nào chọn |
|---|---|
| **1 service, N method** | Module nhỏ, các handler dùng chung dependency (≤ 3 method) |
| **N service, 1 method mỗi cái** | Module lớn, > 4 handler, hoặc handler độc lập |

> **Quy tắc:** `overview` có 2 handler → **1 service**. Nhưng `issues` có 9 handler → **nhiều service nhỏ** (xem §5.7).

---

## 5.3. Module `realtime` — 30 phút

### Cấu trúc hiện tại
```
src/modules/realtime/
├── application/realtime-auth.service.ts
├── application/realtime-revocation.subscriber.ts
├── application/realtime.service.ts
├── domain/ports/realtime-transport.port.ts
├── index.ts
├── infrastructure/websocket/socket-io-realtime.transport.ts
├── presentation/gateways/realtime.gateway.ts
└── realtime.module.ts
```

### Đích
```
src/modules/realtime/
├── realtime.module.ts
├── realtime.service.ts          ← giữ (đã đúng tên)
├── realtime-auth.service.ts     ← giữ (đã đúng tên)
├── realtime-revocation.subscriber.ts  ← giữ
├── realtime.transport.ts        ← từ domain/ports/realtime-transport.port.ts
├── realtime.gateway.ts          ← từ presentation/gateways/realtime.gateway.ts
├── socket-io-realtime.transport.ts   ← từ infrastructure/websocket/
├── index.ts
└── README.md
```

### Bước thực hiện

| Bước | Hành động |
|---|---|
| 1 | `git mv domain/ports/realtime-transport.port.ts realtime.transport.ts` |
| 2 | `git mv presentation/gateways/realtime.gateway.ts realtime.gateway.ts` |
| 3 | `git mv infrastructure/websocket/socket-io-realtime.transport.ts socket-io-realtime.transport.ts` |
| 4 | `git mv application/realtime-auth.service.ts realtime-auth.service.ts` |
| 5 | `git mv application/realtime-revocation.subscriber.ts realtime-revocation.subscriber.ts` |
| 6 | `rm -rf application domain infrastructure presentation` |
| 7 | Sửa import trong 3 file di chuyển + `index.ts` + `realtime.module.ts` |
| 8 | Verify + commit + tag |

> **Module này gần như chỉ là di chuyển file** — rủi ro cực thấp. Làm nó sớm để "lấy cảm hứng".

---

## 5.4. Module `data-view` — 35 phút

### Cấu trúc hiện tại
```
src/modules/data-view/
├── application/data-view.types.ts
├── application/data-view.utils.ts
├── application/queries/get-chart-data.handler.ts
├── application/queries/get-column-stats.handler.ts
├── application/queries/get-records.handler.ts
├── application/queries/query-records.handler.ts
├── data-view.module.ts
├── domain/entities/record-query.entity.ts
├── domain/value-objects/record-filter.vo.ts
├── domain/value-objects/record-query.vo.ts
├── index.ts
├── presentation/controllers/data-view.controller.ts
├── presentation/dtos/chart-data.dto.ts
├── presentation/dtos/query-records-body.dto.ts
└── presentation/dtos/query-records.dto.ts
```

### Đích
```
src/modules/data-view/
├── data-view.module.ts
├── data-view.routes.ts       ← controller + 3 DTO
├── data-view.service.ts      ← 4 handler
├── data-view.types.ts        ← từ application/data-view.types.ts + domain/entities + value-objects
├── data-view.utils.ts        ← từ application/data-view.utils.ts
├── index.ts
└── README.md
```

### Bước thực hiện

| Bước | Hành động |
|---|---|
| 1 | `git mv presentation/controllers/data-view.controller.ts data-view.routes.ts` |
| 2 | Gộp 3 DTO vào `data-view.routes.ts` (DTO chỉ dùng 1 nơi) |
| 3 | `git mv application/data-view.types.ts data-view.types.ts` |
| 4 | `git mv application/data-view.utils.ts data-view.utils.ts` |
| 5 | `git mv application/queries/get-chart-data.handler.ts _tmp/` (+ 3 file nữa) |
| 6 | Gộp 4 handler → `DataViewService` với 4 method |
| 7 | Gộp `domain/entities/record-query.entity.ts` + `domain/value-objects/*.vo.ts` → `data-view.types.ts` |
| 8 | `rm -rf application domain presentation` |
| 9 | Sửa import: `data-view.routes.ts`, `data-view.service.ts`, `index.ts`, `data-view.module.ts` |
| 10 | **Quan trọng:** module này import 13 lần từ `datasets` — phải qua `../datasets` (public contract) |
| 11 | Verify + commit + tag |

> **Lưu ý:** `data-view` là module "read-only view" — không có schema riêng, đọc qua `RECORD_QUERY_PORT` của `datasets`. Đây là ví dụ đẹp của **module dùng port của module khác** — và nó hoạt động tốt.

---

## 5.5. Module `notifications` — 40 phút

### Cấu trúc hiện tại → Đích
```
src/modules/notifications/
├── application/commands/dispatch.handler.ts
├── application/commands/mark-as-read.handler.ts
├── application/commands/update-preferences.handler.ts
├── application/notification-email.mapper.ts
├── application/notifications.types.ts
├── application/notifications.utils.ts
├── application/queries/count-unread.handler.ts
├── application/queries/get-detail.handler.ts
├── application/queries/list-for-user.handler.ts
├── domain/entities/notification.entity.ts
├── domain/events/notification-events.ts
├── domain/ports/notification.repository.port.ts
├── domain/value-objects/notification-type.vo.ts
├── index.ts
├── infrastructure/persistence/notification.mapper.ts
├── infrastructure/persistence/notification.schema.ts
├── infrastructure/persistence/notifications.repository.ts
├── notifications.module.ts
├── presentation/controllers/notifications.controller.ts
└── presentation/dtos/list-notifications-query.dto.ts
+ presentation/dtos/update-preferences.dto.ts
```

```
src/modules/notifications/
├── notifications.module.ts
├── notifications.routes.ts     ← controller + 2 DTO
├── notifications.service.ts    ← 6 handler (3 cmd + 3 qry)
├── notifications.repository.ts ← từ infrastructure/persistence/notifications.repository.ts
├── notifications.schema.ts     ← từ infrastructure/persistence/notification.schema.ts
├── notifications.types.ts      ← types + entity + vo + port token
├── notifications.events.ts     ← từ domain/events/notification-events.ts
├── notifications.mapper.ts     ← từ infrastructure/persistence/notification.mapper.ts
├── notifications.email.mapper.ts ← từ application/notification-email.mapper.ts
├── notifications.utils.ts      ← từ application/notifications.utils.ts
├── index.ts
└── README.md
```

> **Lưu ý:** 2 file mapper (`notification.mapper.ts` DB mapping và `notification-email.mapper.ts` email rendering) là **hai thứ khác nhau** — giữ tách biệt, đừng gộp nhầm.

---

## 5.6. Module `feedback` — 45 phút

### Đích
```
src/modules/feedback/
├── feedback.module.ts
├── feedback.routes.ts          ← controller + DTO
├── feedback.service.ts         ← 7 handler
├── feedback.repository.ts
├── feedback.types.ts           ← 2 entity + 2 vo + port token + types
├── feedback.events.ts
├── feedback.utils.ts
├── finding-feedback.schema.ts  ← schema riêng của entity thứ 2
├── index.ts
└── README.md
```

> **Điểm đặc biệt:** `feedback` có **2 entity** (`feedback` + `finding-feedback`) nhưng **1 repository**. Giữ nguyên cấu trúc này — chỉ flatten.

---

## 5.7. Module `issues` — 50 phút

### Đích — nhiều service nhỏ
```
src/modules/issues/
├── issues.module.ts
├── issues.routes.ts              ← controller user (issues.controller.ts)
├── issues.admin.routes.ts         ← controller admin (admin-issues.controller.ts)
├── issues.service.ts              ← 4 command handler
├── issues.query.service.ts        ← 5 query handler
├── issues.repository.ts
├── issues.schema.ts
├── issues.types.ts
├── issues.events.ts
├── issues.utils.ts
├── issue.mapper.ts
├── index.ts
└── README.md
```

### Quy tắc tách service

| Nhóm | Handler | Service |
|---|---|---|
| Command (ghi) | `create-report`, `update-my-report`, `update-status`, `upload-attachment` | `issues.service.ts` |
| Query (đọc) | `download-attachment`, `get-for-admin`, `get-mine`, `list-for-admin`, `list-mine` | `issues.query.service.ts` |

> **Quy tắc chung cho module ≥ 6 handler:** tách `*.service.ts` (command) và `*.query.service.ts` (query).
> Lý do: người mới đọc "service" sẽ thấy 2 nhóm rõ ràng — ghi hay đọc — thay vì 9 method lẫn lộn.

**Áp dụng quy tắc này cho:** `users` (17), `projects` (17), `workspaces` (14), `feedback` (7), `issues` (9), `notifications` (6), `datasets` (8), `auth` (11).

---

## 5.8. Checklist chung cho mỗi module P3

```
☐  1. git mv từng file (giữ nội dung, chỉ đổi vị trí)
☐  2. Gộp file theo bảng quy đổi
☐  3. Gộp handler → service method (giữ tên method & thứ tự tham số)
☐  4. Giữ nguyên tên type / port token / event type
☐  5. Sửa import trong file di chuyển
☐  6. Sửa index.ts (public contract)
☐  7. Sửa <ten>.module.ts (provider)
☐  8. grep tên cũ: grep -rn "<TênCũ>" src/ test/  → phải 0 kết quả
☐  9. rm -rf thư mục rỗng
☐ 10. pnpm type-check → 0 lỗi
☐ 11. pnpm lint → 0 cảnh báo
☐ 12. pnpm exec jest --maxWorkers=2 → xanh
☐ 13. pnpm arch:api-coverage → 84/84
☐ 14. test/modular-monolith.spec.ts → MM5 pass
☐ 15. bash scripts/measure-refactor.sh → ghi notes.md
☐ 16. git commit + tag
```

---

## 5.9. Cổng kiểm soát P3

| Điều kiện | Giá trị kỳ vọng |
|---|---|
| `src/modules/{audit,overview,realtime,data-view,notifications,feedback,issues}/` phẳng | 0 thư mục con mỗi module |
| File `.ts` trong `src/modules/` | 339 → ~305 |
| LOC | 31 076 → ~28 000 |
| `pnpm type-check` | 0 l�i |
| `pnpm lint` | 0 cảnh báo |
| `pnpm exec jest --maxWorkers=2` | 67 suites / 1 069 tests |
| `pnpm arch:api-coverage` | 84 / 84 / 0 / 0 |
| Tag | `v1.2.0-p3` |
