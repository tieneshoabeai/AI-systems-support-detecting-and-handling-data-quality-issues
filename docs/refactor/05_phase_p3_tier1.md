# 5. Phase P3 — 5 module Simple còn lại (5 giờ)

> **Thời gian:** 5 giờ · **Mục tiêu:** flatten 5 Simple còn lại theo đúng template S đã chốt ở P2.
> **Điều kiện tiên quyết:** P2 (`audit`) đã qua cổng kiểm soát.
> **Thứ tự bắt buộc (dễ → khó):** `overview → realtime → data-view → notifications → feedback`.
> `issues` KHÔNG làm ở P3 nữa — đã chuyển sang Hexagonal ở P5 (quyết định D14).

---

## 5.1. Danh sách + thời gian

| # | Module | File | LOC | Handler | Thời gian | Ghi chú đặc biệt |
|---|---|---|---|---|---|---|
| 1 | `overview` | 5 | 190 | 2 query | 40 phút | Không DB riêng, đơn giản nhất sau audit |
| 2 | `realtime` | 8 | 642 | 0 + 1 sub | 50 phút | Gateway + subscriber, gần như chỉ di chuyển file |
| 3 | `data-view` | 15 | 967 | 4 query | 60 phút | Không repo riêng (qua `RECORD_QUERY_PORT` của `datasets`) |
| 4 | `notifications` | 21 | 1 294 | 3 cmd + 3 qry | 70 phút | **Giữ 2 mapper riêng** (DB vs email) — không gộp |
| 5 | `feedback` | 21 | 2 186 | 5 cmd + 2 qry | 100 phút | Khó nhất P3: 2 entity + `ensureNotAdmin` + camel/snake |
| | **Tổng** | **70** | **5 279** | **19** | **~5 giờ 20 phút** | Vượt thì cắt `feedback` sang P6 ghi nợ |

---

## 5.2. Module `overview` — 40 phút

### Trước → Sau

```
src/modules/overview/                       src/modules/overview/
├── application/queries/*.handler.ts (2)    ├── overview.routes.ts      ← controller
├── presentation/controllers/*.ts          ├── overview.service.ts     ← 2 method
├── index.ts / overview.module.ts           ├── overview.types.ts       ← type dùng chung (nếu có)
                                            ├── index.ts / overview.module.ts / README.md
```

### Bước

| Bước | Hành động |
|---|---|
| 1 | Đối chiếu `12_business_invariants.md` §overview: `GetUserOverview(userId)` + `GetWorkspaceOverview(workspaceId)`, giữ `Promise.all`, giữ 2 port `WORKSPACE_REPOSITORY_PORT` + `PROJECT_REPOSITORY_PORT` |
| 2 | Tạo `overview.service.ts` (`OverviewService`, 2 method) — copy nguyên body handler, giữ thứ tự tham số |
| 3 | Tạo `overview.routes.ts` từ controller — GIỮ `JwtAuthGuard + PoliciesGuard + WorkspacePolicyLoader + CheckPolicies`, GIỮ comment xung đột đường dẫn E3 (`overview/workspaces` tách khỏi `workspaces/:id`) + 2 path `overview/workspaces` và `workspaces/:id/overview` |
| 4 | Chuyển DI ở `overview.module.ts` — GIỮ `imports: [WorkspacesModule, ProjectsModule]` + 2 provider; export lại ở `index.ts` (giữ export 2 handler để tương thích) |
| 5 | Xóa `application/ presentation/` rỗng sau khi type-check xanh |
| 6 | Viết `README.md`: `Template: Simple`, lý do + bất biến |
| 7 | Verify + commit + tag `v1.2.0-overview` |

---

## 5.3. Module `realtime` — 50 phút

### Trước → Sau

```
src/modules/realtime/                      src/modules/realtime/
├── application/*.service.ts + *.subscriber.ts  ├── realtime.service.ts (giữ tên)
├── domain/ports/*.port.ts                     ├── realtime-auth.service.ts (giữ)
├── infrastructure/websocket/*.ts               ├── realtime-revocation.subscriber.ts (giữ)
├── presentation/gateways/*.ts                  ├── realtime.transport.ts (từ port)
└── ...                                         ├── realtime.gateway.ts (từ gateway)
                                                ├── socket-io-realtime.transport.ts              ← giữ nguyên (nơi duy nhất biết `socket.io`)
                                                ├── realtime.module.ts GIỮ gateway config (`path: /api/v1/realtime`, `transports`, `pingInterval/pingTimeout`)
```

### Bước

| Bước | Hành động |
|---|---|
| 1 | Đối chiếu §realtime: giữ `extractUserId` (cả `user_id`/`userId`), giữ `disconnectUser`, giữ handshake check trạng thái |
| 2 | `git mv` từng file ra gốc đúng tên trên (giữ nội dung) |
| 3 | Sửa import + `index.ts` (GIỮ re-export `REALTIME_PORT` + helpers từ `shared/`) + `realtime.module.ts` — GIỮ `@Global()` + `imports: [JwtModule, UsersModule, ProjectsModule, WorkspacesModule]` + 2 binding `useExisting` (`REALTIME_PORT`, `REALTIME_TRANSPORT_PORT`) + exports |
| 4 | `rm -rf` thư mục rỗng |
| 5 | Verify + commit + tag `v1.2.0-realtime` |

> Rủi ro thấp nhất P3 — nếu P2 gặp khó, có thể làm `realtime` trước để lấy đà (ghi vào notes).

---

## 5.4. Module `data-view` — 60 phút

### Trước → Sau

```
src/modules/data-view/                     src/modules/data-view/
├── application/queries/*.handler.ts (4)   ├── data-view.routes.ts   ← controller + 3 DTO
├── application/*.types.ts + *.utils.ts     ├── data-view.service.ts  ← 4 method
├── domain/entities + value-objects        ├── data-view.types.ts    ← types + entity/vo gộp
├── presentation/controllers + dtos       ├── data-view.utils.ts    ← giữ
└── ...                                     └── index.ts / module / README.md
```

### Bước

| Bước | Hành động |
|---|---|
| 1 | Đối chiếu §data-view: giữ `RECORD_QUERY_PORT` của `datasets`, giữ `DEFAULT/MAX_RECORD_LIMIT` + `normalizeRecordLimit`, giữ tách route `records/query` (POST) vs `records` (GET) |
| 2 | Gộp 3 DTO vào `data-view.routes.ts` (DTO 1 nơi) |
| 3 | Gộp entity + vo vào `data-view.types.ts` (không tách `domain/`) |
| 4 | Gộp 4 handler → `DataViewService` (4 method, giữ `execute()` + thứ tự tham số) |
| 5 | Import chéo `datasets` **phải qua `../datasets`** (MM2) — 13 chỗ, kiểm tra kỹ; GIỮ `imports: [DatasetsModule]` trong module + `DatasetPolicyLoader` trong routes (2 resource `DataRecord`/`Dataset`) |
| 6 | Verify + commit + tag `v1.2.0-data-view` |

---

## 5.5. Module `notifications` — 70 phút

### Trước → Sau

```
src/modules/notifications/                 src/modules/notifications/
├── application/commands + queries (6)     ├── notifications.routes.ts     ← controller + 2 DTO
├── application/*.mapper.ts + *.utils.ts   ├── notifications.service.ts    ← 6 method
├── domain/entities + events + ports + vo  ├── notifications.repository.ts ← giữ
├── infrastructure/*.schema.ts + *.repo.ts ├── notifications.schema.ts    ← giữ
├── presentation/controllers + dtos       ├── notifications.types.ts      ← entity + vo + port token
└── ...                                     ├── notifications.events.ts   ← giữ riêng
                                            ├── notification.mapper.ts    ← DB mapping, GIỮ RIÊNG
                                            ├── notification-email.mapper.ts ← email rendering, GIỮ RIÊNG
                                            ├── notifications.utils.ts
```

### Giữ DI + cấm gộp nhầm (ghi vào checklist review)

- GIỮ `imports: [MongooseModule.forFeature([{ name: 'Notification' }]), UsersModule]` + `{ provide: NOTIFICATION_REPOSITORY_PORT, useExisting: NotificationsRepository }` — không bỏ `UsersModule`.

- `notification.mapper.ts` (DB mapping) vs `notification-email.mapper.ts` (email rendering): **2 thứ khác nghĩa, giữ tách**.
- Giữ route `PATCH users/me/notification-preferences` ở đúng controller.
- Giữ thứ tự `unread-count` trước `:id`.

---

## 5.6. Module `feedback` — 100 phút (khó nhất P3)

### Trước → Sau

```
src/modules/feedback/                     src/modules/feedback/
├── application/commands + queries (7)    ├── feedback.routes.ts      ← controller + DTO
├── domain 2 entities + vo                ├── feedback.service.ts     ← 7 method
├── infrastructure 1 repo + schemas       ├── feedback.repository.ts  ← 1 repo (giữ, dùng 1 model `FindingFeedback`)
├── presentation controllers + dtos      ├── feedback.types.ts       ← 2 entity + vo + port token (giữ `Feedback.create/updateByAuthor`)
                                           ├── feedback.mapper.ts        ← giữ riêng (mapping snake/camel)
                                           ├── feedback.module.ts GIỮ `forFeature([{ name: 'FindingFeedback' }])` + `imports: [ProjectsModule, WorkspacesModule, UsersModule, AnalysisModule]` + `useExisting`
└── ...                                    ├── feedback.events.ts + feedback.utils.ts
                                           ├── finding-feedback.schema.ts ← schema entity thứ 2, giữ riêng
```

### Điều kiện Simple (bắt buộc giữ trong `types.ts` + service)

- Giữ `Feedback.create/updateByAuthor + requiresReason + ensureNotAdmin`.
- Giữ chữ ký 4 tham số của `UpdateMine`.
- Giữ tương thích camel/snake/ObjectId trong repository + `deleted_at: null` mọi query.

> Nếu quá 100 phút chưa xanh: **cắt** — revert `feedback`, ghi nợ vào `notes.md`, sang P4. Không cố gộp.

---

## 5.7. Checklist chung mỗi module P3

```
☐ 1. Đối chiếu 12_business_invariants.md §module + tick 13_refactor_constraints.md §13.6
☐ 2. Tạo file mới (types/service/routes) — không xóa cũ ngay
☐ 3. Handler → method: giữ tên execute()/log() + thứ tự tham số
☐ 4. Chuyển DI ở *.module.ts + export lại ở index.ts
☐ 5. Xóa file cũ + thư mục rỗng sau khi type-check xanh
☐ 6. Viết README.md (Template: Simple + lý do + bất biến)
☐ 7. pnpm type-check → 0 lỗi
☐ 8. pnpm lint → 0 cảnh báo
☐ 9. pnpm exec jest --maxWorkers=2 --testPathPatterns '<mod>|modular-monolith|clean-architecture' → xanh
☐ 10. pnpm arch:api-coverage → 82 HTTP + 1 WS
☐ 11. bash scripts/measure-refactor.sh → ghi notes.md
☐ 12. git commit + tag v1.2.0-<mod>
```

---

## 5.8. Cổng kiểm soát P3

| Điều kiện | Giá trị kỳ vọng |
|---|---|
| 6 Simple phẳng (`audit` + 5 P3) | 0 thư mục con mỗi module (arch test MM5' pass cho 6 Simple) |
| File `.ts` | 340 → ~305 |
| LOC | 31 505 → ~28 500 |
| type-check / lint / test / api-coverage | xanh / 0 / xanh / 82+1 |
| Tag | `v1.2.0-p3` |
