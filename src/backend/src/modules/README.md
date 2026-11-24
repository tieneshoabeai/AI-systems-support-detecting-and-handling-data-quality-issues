# Các Module Nghiệp Vụ — 13 Module (Thực Tế)

Backend có **13 module** trong `src/backend/src/modules/`. Mỗi module là một **ngữ cảnh giới hạn**, giao tiếp ra ngoài chỉ qua `index.ts` (hợp đồng công khai, kiểm chứng bởi `arch:cross-imports` + `clean-architecture.spec.ts`).

> Đặc tả kế hoạch (khác hiện thực) nằm ở `docs/modules/`. README ở đây mô tả **mã nguồn thật**.

---

## 1. Danh mục (đếm từ mã nguồn)

| Module | Tệp `.ts` | Handler (lệnh/truy vấn) | Controller | README |
|---|---|---|---|---|
| `users` | 34 | 11 / 6 | 2 (`users`, `admin/users`) | [README](./users/README.md) |
| `auth` | 35 | 9 / 2 | 1 (`auth`, 13 route) | [README](./auth/README.md) |
| `workspaces` | 38 | 8 / 6 | 1 (`workspaces`, 10 route) | [README](./workspaces/README.md) |
| `projects` | 43 | 10 / 7 | 1 (12 route) | [README](./projects/README.md) |
| `datasets` | 33 | 4 / 4 | 1 (6 route) | [README](./datasets/README.md) |
| `data-view` | 7 | 0 / 0 (service) | 1 (`datasets/:datasetId`, 4 route) | [README](./data-view/README.md) |
| `analysis` | 56 | 6 / 5 | 3 (analysis/report/summary, 9 route) | [README](./analysis/README.md) |
| `feedback` | 9 | 0 / 0 (service) | 1 (7 route) | [README](./feedback/README.md) |
| `issues` | 23 | 4 / 5 | 1 (9 route: user + admin) | [README](./issues/README.md) |
| `notifications` | 10 | 0 / 0 (service) | 1 (5 route) | [README](./notifications/README.md) |
| `overview` | 5 | 0 / 0 (service) | 1 (2 route, chỉ đọc) | [README](./overview/README.md) |
| `realtime` | 8 | 0 / 0 (gateway + service) | 0 (WebSocket, không REST) | [README](./realtime/README.md) |
| `audit` | 6 | 0 / 0 (service) | 0 (chỉ ghi nối tiếp, không REST) | [README](./audit/README.md) |

---

## 2. Hai dạng cấu trúc (thực tế, không phải module nào cũng 4 tầng)

**Dạng CQRS** (`auth`, `users`, `workspaces`, `projects`, `datasets`, `analysis`, `issues`):

```text
<module>/
├── domain/           # entity, value-object, port, event
├── application/      # commands/ + queries/ handler, services, policy-loaders
├── infrastructure/   # Mongoose schema, repository, adapter
├── presentation/     # controller, DTO (Zod), response mapper
└── index.ts          # hợp đồng công khai
```

**Dạng phẳng / service-based** (`data-view`, `feedback`, `notifications`, `overview`, `audit`, `realtime`):

```text
<module>/
├── *.service.ts / *.controller.ts / *.schema.ts / *.types.ts
├── *.mapper.ts / *.repository.ts (tùy module)
└── index.ts
```

Ví dụ: `data-view/` chỉ có 7 tệp (`controller`, `service`, `utils`, `types`, `module`, `index`, `chart.schema`); `overview/` chỉ 5 tệp; `audit/` chỉ 6 tệp.

---

## 3. Quy tắc phụ thuộc (CA1–CA14, kiểm chứng tự động)

| Mã | Quy tắc | Kiểm chứng |
|---|---|---|
| CA1 | `domain` không import `application` / `infrastructure` / `presentation` | `unit/arch/clean-architecture.spec.ts` |
| CA2 | `domain` không import framework | `clean-architecture.spec.ts` |
| CA3 | `domain` không import module khác | `clean-architecture.spec.ts` |
| CA4 | `application` chỉ import `domain` | `clean-architecture.spec.ts` |
| CA5 | `shared` không import từ `modules/` | `clean-architecture.spec.ts` |
| CA6 | `infrastructure` được import `domain` | `clean-architecture.spec.ts` |
| CA7 | `presentation` được import `application` | `clean-architecture.spec.ts` |
| CA8 | Import chéo module phải qua `index.ts` | `pnpm arch:cross-imports` |
| CA9 | `presentation` không chứa logic nghiệp vụ | `clean-architecture.spec.ts` |
| CA10 | Repository chỉ được gọi từ `application` / `infrastructure` | `clean-architecture.spec.ts` |
| CA11 | `domain` không dùng `any` | `unit/arch/zero-any.spec.ts` + ESLint |
| CA12 | Controller không chứa logic nghiệp vụ | `clean-architecture.spec.ts` |
| CA13 | `shared/domain` không import framework | `clean-architecture.spec.ts` |
| CA14 | `shared/domain` không import `shared/interfaces` | `clean-architecture.spec.ts` |

---

## 4. Phân quyền 3 tầng (thực tế)

| Tầng | Module sở hữu | Vai trò |
|---|---|---|
| Hệ thống | `users`, `auth` | `admin`, `analyst` |
| Workspace | `workspaces` | `owner`, `member` |
| Project | `projects` | `owner`, `member`, `viewer` |

Quy tắc suy ra: `owner` workspace → `owner` mọi project trong workspace; `member` workspace lấy đúng vai trò ghi trong `project.members`, nếu không có → `viewer`. Hai cổng ngữ cảnh (`WORKSPACE_CONTEXT_PORT`, `PROJECT_CONTEXT_PORT` trong `shared/application/ports/`) hiện thực ở `workspaces/infrastructure/adapters/` và `projects/infrastructure/adapters/` — chịu lỗi (lỗi truy vấn trả rỗng, không chặn oan).

---

## 5. Lưu đồ phụ thuộc (rút gọn)

```text
users -> auth -> workspaces -> projects -> datasets -> data-view
                                    |            |
                                    |            +-> analysis -> feedback
                                    |                         |
                                    +-> issues -> notifications
                                    +-> overview (chỉ đọc)

realtime  (nhận event từ mọi module qua shared event bus)
audit     (ghi nhật ký từ mọi module, chỉ ghi nối tiếp)
```
