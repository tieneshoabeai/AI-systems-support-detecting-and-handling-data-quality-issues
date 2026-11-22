# Cac Module Nghiep Vu

He thong backend gom **13 module nghiep vu**. Moi module la mot **bounded context** doc lap, tuan thu Clean Architecture 4 tang va chi giao tiep qua `index.ts` (public contract).

---

## 1. Danh muc Module

| Module | Phu vi trach nhiem | README |
|---|---|---|
| `users` | Tai khoan, phien dang nhap, quan tri, khoa tai khoan | [README](./users/README.md) |
| `auth` | Dang ky, dang nhap, JWT, refresh, Google OAuth 2.0, quen mat khau | [README](./auth/README.md) |
| `workspaces` | Khong gian lam viec, vai tro thanh vien, ha nganh, chuyen owner | [README](./workspaces/README.md) |
| `projects` | Du an, thanh vien, trang thai, snapshot, cascade | [README](./projects/README.md) |
| `datasets` | Nhap CSV streaming, schema, dong du lieu, findings, PII | [README](./datasets/README.md) |
| `data-view` | Luoi du lieu ao, keyset pagination, thong ke cot, bieu do | [README](./data-view/README.md) |
| `analysis` | Phan tich chat luong du lieu, AI job local, bao cao PDF, tong ket | [README](./analysis/README.md) |
| `feedback` | Phan hoi nguoi dung, RAG few-shot, chi so chat luong AI | [README](./feedback/README.md) |
| `issues` | Bao cao loi, tep dinh kem, quan tri, vong doi trang thai | [README](./issues/README.md) |
| `notifications` | Hop thu, push ntfy, email, tuy chon nguoi dung | [README](./notifications/README.md) |
| `overview` | Tong quan dashboard (chi doc) | [README](./overview/README.md) |
| `realtime` | WebSocket Socket.IO, phong, thu hoi token | [README](./realtime/README.md) |
| `audit` | Nhat ky kiem toan append-only | [README](./audit/README.md) |

---

## 2. Cau Truc Chung

Moi module deu co **cung mot bo cuc**:

```text
<module>/
├── domain/           # Loi nghiep vu thuan: entity, value-object, port, event
│   ├── entities/
│   ├── value-objects/
│   ├── events/
│   ├── ports/
│   └── services/     # (mot so module) ham thuan dung chung
├── application/      # Use case: command/query handler (CQRS), policy loader, service
│   ├── commands/
│   ├── queries/
│   ├── services/
│   └── policy-loaders/
├── infrastructure/   # Adapter: Mongoose schema, repository, mapper
└── presentation/     # Controller REST, DTO (Zod), response mapper
```

---

## 3. Quy Tac Phu Thuoc

| Ma | Quy tac | Kiem chung |
|---|---|---|
| CA1 | `domain` khong import `application` / `infrastructure` / `presentation` | `clean-architecture.spec.ts` |
| CA2 | `domain` khong import framework | `clean-architecture.spec.ts` |
| CA3 | `domain` khong import module khac | `clean-architecture.spec.ts` |
| CA4 | `application` chi import `domain` | `clean-architecture.spec.ts` |
| CA5 | `shared` khong import tu `modules/` | `clean-architecture.spec.ts` |
| CA6 | `infrastructure` duoc import `domain` | `clean-architecture.spec.ts` |
| CA7 | `presentation` duoc import `application` | `clean-architecture.spec.ts` |
| CA8 | Import cheo module phai qua `index.ts` | `arch:cross-imports` |
| CA9 | `presentation` khong chua logic nghiep vu | `clean-architecture.spec.ts` |
| CA10 | Repository chi duoc goi tu `application` / `infrastructure` | `clean-architecture.spec.ts` |
| CA11 | `domain` khong dung `any` | ESLint |
| CA12 | Controller khong chua logic nghiep vu | `clean-architecture.spec.ts` |
| CA13 | `shared/domain` khong import framework | `clean-architecture.spec.ts` |
| CA14 | `shared/domain` khong import `shared/interfaces` | `clean-architecture.spec.ts` |

---

## 4. Vai Tro Trong Mo Hinh Phan Quyen 3 Tang

| Tang | Module so huu | Vai tro |
|---|---|---|
| **He thong** | `users`, `auth` | `admin`, `analyst` |
| **Workspace** | `workspaces` | `owner`, `member` |
| **Project** | `projects` | `owner`, `member`, `viewer` |

Quy tac suy ra:

| Vai tro workspace | Vai tro project suy ra |
|---|---|
| `owner` | `owner` - toan quyen tren moi project cua workspace |
| `member` | lay dung vai tro ghi trong `project.members`; neu khong co -> `viewer` |

Hai **context port** (`WORKSPACE_CONTEXT_PORT`, `PROJECT_CONTEXT_PORT`) - khai bao trong `shared/application/ports/` va hien thuc o `modules/workspaces/infrastructure/adapters/workspace-context.adapter.ts` va `modules/projects/infrastructure/adapters/project-context.adapter.ts` - giup CASL giai quyet vai tro theo request.

---

## 5. Luu Do Module

```text
users ──▶ auth ──▶ workspaces ──▶ projects ──▶ datasets ──▶ data-view
                                    │              │
                                    │              └──▶ analysis ──▶ feedback
                                    │                            │
                                    ├──▶ issues ──▶ notifications
                                    └──▶ overview

realtime  (nhận event từ mọi module)
audit     (ghi nhật ký từ mọi module)
```

---

## 6. Module Nao Co README?

Tat ca 13 module deu co README rieng, mo ta **trang thai hien thuc hien tai**: cau truc thu muc, domain model, phan quyen, API, luu tru va kiem thu lien quan.

Dac ta **ke hoach** (khac voi hien thuc) nam o `../../../../../docs/modules/`.

---

## 7. Lien Quan

| Tai lieu | Noi dung |
|---|---|
| [`../shared/README.md`](../shared/README.md) | Lop cross-cutting: CASL, keyset, event bus, outbox/inbox |
| [`../README.md`](../../README.md) | Huong dan van hanh backend |
| [`../../../../README.md`](../../../../README.md) | Kien truc tong the du an |
| `../../../../docs/modules/` | Dac ta module (ke hoach) |
