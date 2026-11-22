# 6. Phase P4 — Tier 2: 5 module trung bình (8 giờ)

> **Thời gian:** 8 giờ · **Điều kiện tiên quyết:** P3 qua cổng kiểm soát.
> **Đường cắt:** nếu giờ 12 chưa xong → chỉ làm `issues` + `notifications`, bỏ 3 module còn lại.

---

## 6.1. Vì sao 8 giờ cho 5 module?

| Lý do | Chi tiết |
|---|---|
| Handler nhiều hơn | 8–17 handler/module (so với 1–9 ở T1) |
| Có transaction | `datasets`, `workspaces`, `projects` dùng `TransactionPort` |
| Có outbox event | `WORKSPACE_DELETED`, `PROJECT_DELETED` — cascade phải đúng |
| Có policy loader | `workspaces` (1), `projects` (3), `datasets` (1) |
| Có adapter | `workspaces` (2), `projects` (2) — adapter gắn với shared port |
| Có entity phức tạp | `datasets` có 3 VO với invariant logic |

> **Ước lượng:** `issues` (đã làm ở P3) không tính. 5 module còn lại: `datasets`, `users`, `workspaces`, `projects`, `analysis`(T3).

---

## 6.2. Module `users` — 2 giờ

### Cấu trúc hiện tại → Đích

```
src/modules/users/                                    src/modules/users/
├── application/commands/*.handler.ts (11)            ├── users.module.ts
├── application/queries/*.handler.ts (6)              ├── users.routes.ts
├── application/services/user-access-revocation.service.ts ├── users.admin.routes.ts
├── domain/entities/{user,user-session}.entity.ts     ├── users.service.ts        (11 cmd)
├── domain/events/user-events.ts                       ├── users.query.service.ts   (6 qry)
├── domain/ports/user.repository.port.ts               ├── user-access-revocation.service.ts
├── domain/value-objects/{session-policy,user-role}.vo.ts ├── users.repository.ts
├── infrastructure/persistence/{user.mapper,user.schema,   ├── user.schema.ts
│   user-session.schema,users.repository}.ts           ├── user-session.schema.ts
├── presentation/controllers/{admin-users,users}.controller.ts ├── users.types.ts
├── presentation/dtos/update-user.dto.ts               ├── users.events.ts
├── presentation/responses/user.response.ts            ├── user.mapper.ts
├── index.ts                                           ├── index.ts
└── users.module.ts                                    └── README.md
```

### Bước thực hiện

| Bước | Hành động | Ghi chú |
|---|---|---|
| 1 | `git mv presentation/controllers/users.controller.ts users.routes.ts` | |
| 2 | `git mv presentation/controllers/admin-users.controller.ts users.admin.routes.ts` | 2 controller riêng |
| 3 | `git mv presentation/dtos/update-user.dto.ts _tmp/` | Gộp vào `users.routes.ts` |
| 4 | `git mv presentation/responses/user.response.ts _tmp/` | Gộp vào `users.types.ts` |
| 5 | `git mv application/commands/*.handler.ts _tmp/` → gộp thành `users.service.ts` | 11 method `execute()` |
| 6 | `git mv application/queries/*.handler.ts _tmp/` → gộp thành `users.query.service.ts` | 6 method `execute()` |
| 7 | `git mv application/services/user-access-revocation.service.ts .` | Giữ nguyên tên |
| 8 | `git mv domain/entities/*.entity.ts domain/events/user-events.ts domain/ports/*.ts domain/value-objects/*.vo.ts _tmp/` → gộp `users.types.ts` | |
| 9 | `git mv infrastructure/persistence/users.repository.ts users.repository.ts` | |
| 10 | `git mv infrastructure/persistence/user.schema.ts user.schema.ts` | |
| 11 | `git mv infrastructure/persistence/user-session.schema.ts user-session.schema.ts` | |
| 12 | `git mv infrastructure/persistence/user.mapper.ts user.mapper.ts` | Giữ riêng — mapping phức tạp |
| 13 | `rm -rf application domain infrastructure presentation` | |
| 14 | Sửa import + `index.ts` + `users.module.ts` | |
| 15 | Verify + commit + tag | |

### ⚠️ Cảnh báo cho `users`

| Vấn đề | Xử lý |
|---|---|
| `domain/value-objects/session-policy.vo.ts` có invariant (luật session) | Giữ logic nguyên vẹn trong `users.types.ts` |
| `domain/events/user-events.ts` có `USER_BLOCKED`/`USER_REMOVED` — dùng bởi `realtime` | Giữ nguyên tên event; `realtime` import qua `../users` |
| `user-access-revocation.service.ts` cần cả `users` + `realtime` | Giữ là file riêng, không gộp vào service chính |
| `soft-delete-user` / `block-user` / `unblock-user` liên quan bảo mật | Không đổi logic, không đổi thứ tự thao tác |

---

## 6.3. Module `workspaces` — 1 giờ 45 phút

```
src/modules/workspaces/
├── workspaces.module.ts
├── workspaces.routes.ts              ← controller + 6 DTO
├── workspaces.service.ts             ← 8 command handler
├── workspaces.query.service.ts       ← 6 query handler
├── workspaces.repository.ts
├── workspaces.schema.ts
├── workspaces.types.ts               ← entity + 2 VO + 2 port + types + utils
├── workspaces.events.ts
├── workspaces.mapper.ts
├── workspace-access.adapter.ts       ← adapter (implement shared port)
├── workspace-context.adapter.ts      ← adapter (implement shared port)
├── workspace-policy.ts               ← policy loader
├── index.ts
└── README.md
```

### ⚠️ Cảnh báo

| Vấn đề | Xử lý |
|---|---|
| `WORKSPACE_CONTEXT_PORT` & `WORKSPACE_ACCESS_PORT` là port của **`shared/`**, module chỉ *implement* | Giữ adapter riêng; token định nghĩa ở `shared/application/ports/` |
| `workspace-context.adapter.ts` là **fail-safe** (lỗi → tập rỗng) | Giữ nguyên logic try/catch |
| `delete-workspace.handler.ts` phát event `WORKSPACE_DELETED` trong **transaction** | **Không đụng logic** — chỉ di chuyển file |
| `workspace-quota.vo.ts` có `MAX_WORKSPACES_PER_USER = 20` | Giữ nguyên hằng số |
| `increment-storage-used.handler.ts` | Có thể gộp vào `workspaces.service.ts` — không tách riêng |

---

## 6.4. Module `projects` — 2 giờ

```
src/modules/projects/
├── projects.module.ts
├── projects.routes.ts                ← controller + 5 DTO
├── projects.service.ts               ← 10 command handler
├── projects.query.service.ts         ← 7 query handler
├── projects.repository.ts
├── projects.schema.ts
├── projects.types.ts
├── projects.events.ts
├── projects.mapper.ts
├── project-access.adapter.ts
├── project-context.adapter.ts
├── project-policy.ts                 ← gộp 3 policy loader
├── cascade-project-event.subscriber.ts
├── index.ts
└── README.md
```

### ⚠️ Cảnh báo

| Vấn đề | Xử lý |
|---|---|
| **3 policy loader** (`project-policy`, `project-scope-policy`, `workspace-scope-policy`) | Gộp vào `projects.policy.ts` — giữ nguyên 3 class, chỉ đổi file |
| `cascade-project-event.subscriber.ts` — consumer `WORKSPACE_DELETED` | **Giữ riêng**, không gộp vào service (nó là subscriber, không phải use case) |
| `cascade-workspace-projects.handler.ts` — xóa project khi workspace bị xóa | Giữ riêng — logic cascade nhạy cảm |
| `delete-project.handler.ts` phát `PROJECT_DELETED` trong transaction | **Không đụng logic** |
| `transfer-project-owner` / `remove-project-member` / `update-project-member-role` | Chỉ di chuyển |

### Quyết định: gộp 3 policy loader hay giữ 3 file?

| Cách | Ưu | Nhược |
|---|---|---|
| **Gộp vào `projects.policy.ts`** | Ít file hơn | File 3 class |
| Giữ 3 file | Rõ ràng | Nhiều file |

> **Chọn: gộp vào `projects.policy.ts`.** Vì 3 loader đều nhỏ (~30–50 LOC) và liên quan cùng một resource (`Project`). Tương tự, `datasets` có 1 loader → `datasets.policy.ts`.

---

## 6.5. Module `datasets` — 2 giờ 15 phút

```
src/modules/datasets/
├── datasets.module.ts
├── datasets.routes.ts                ← controller + response
├── datasets.service.ts               ← 4 command handler
├── datasets.query.service.ts         ← 4 query handler
├── datasets.repository.ts
├── record-query.repository.ts        ← repository thứ 2 (giữ riêng)
├── datasets.schema.ts
├── dataset-record.schema.ts          ← schema thứ 2 (giữ riêng)
├── dataset.mapper.ts
├── datasets.types.ts
├── datasets.events.ts
├── datasets.utils.ts
├── dataset-policy.ts
├── schema-inference.service.ts       ← service riêng (giữ)
├── dataset-finding.service.ts        ← service riêng (giữ)
├── cascade-dataset-event.subscriber.ts  ← subscriber (giữ riêng)
├── csv-delimiter.util.ts             ← util thuần
├── pii-heuristic.util.ts             ← util thuần (giữ riêng — logic nghiệp vụ)
├── finding.util.ts                   ← util thuần
├── index.ts
└── README.md
```

### ⚠️ Cảnh báo — module phức tạp nhất của T2

| Vấn đề | Xử lý |
|---|---|
| **3 VO có invariant** (`column-type.vo`, `dataset-limits.vo`, `value-coercion.vo`) | Giữ nguyên logic trong `datasets.types.ts` — **đây là nghiệp vụ cốt lõi** |
| `pii-heuristic.util.ts` — tự suy luận cột PII | **Giữ riêng file** — logic nghiệp vụ thuần, không gộp |
| `ingest-dataset-stream.handler.ts` — streaming, giữ RAM ~20 MB | **Không đụng logic** (R4 — đây là điểm nhạy cảm RAM) |
| `cascade-project-datasets.handler.ts` — xóa dataset khi project bị xóa | Giữ riêng — cascade phải đúng |
| `map-props-to-original-names.handler.ts` | Gộp vào `datasets.service.ts` |
| `schema-inference.service.ts` & `dataset-finding.service.ts` | Giữ riêng — 2 trách nhiệm khác nhau |
| `record-query.repository.ts` | Giữ riêng — phục vụ Virtual Grid |
| `dataset-record.schema.ts` | Giữ riêng — collection riêng |
| `download-dataset-file.handler.ts` | Gộp vào `datasets.query.service.ts` |

### ⚠️ Cảnh báo — `datasets` là **module bất biến**

> Dataset là **insert-only**: không có route cập nhật cột. Đây là quy tắc nghiệp vụ, KHÔNG phải hạn chế kỹ thuật.
> Refactor **không được** thêm bất kỳ route cập nhật nào vào `datasets`.
>
> Kiểm tra sau mỗi commit: `pnpm arch:api-coverage` phải vẫn là **84 route** — không phải 85.

---

## 6.6. Checklist chung P4 (giống P3 + bổ sung)

```
☐  Giữ nguyên logic transaction / outbox / cascade
☐  Giữ nguyên tất cả hằng số nghiệp vụ (MAX_WORKSPACES_PER_USER, TYPE_INFERENCE_THRESHOLD, ...)
☐  Không thêm route mới (dataset bất biến)
☐  Adapter implement shared port vẫn giữ nguyên tên class
☐  Policy loader giữ nguyên tên class
☐  Subscriber giữ riêng, không gộp vào service
☐  VO có invariant → giữ logic, chỉ đổi vị trí
☐  Util nghiệp vụ thuần (pii-heuristic, csv-delimiter, finding) → giữ file riêng
☐  Verify đầy đủ (xem §5.8)
☐  Commit + tag
```

---

## 6.7. Cổng kiểm soát P4

| Điều kiện | Giá trị kỳ vọng |
|---|---|
| File `.ts` trong `src/modules/` | ~305 → ~225 |
| LOC | ~28 000 → ~22 500 |
| Thư mục con | ~38 → ~22 |
| `pnpm type-check` | 0 lỗi |
| `pnpm lint` | 0 cảnh báo |
| `pnpm exec jest --maxWorkers=2` | 67 suites / 1 069 tests |
| `pnpm arch:api-coverage` | 84 / 84 / 0 / 0 |
| Tag | `v1.2.0-p4` |
