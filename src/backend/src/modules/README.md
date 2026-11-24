# Các Mô-đun Nghiệp Vụ

Hệ thống backend gồm **13 mô-đun nghiệp vụ**. Mỗi mô-đun là một **ngữ cảnh giới hạn** độc lập, tuân thủ Clean Architecture 4 tầng và chỉ giao tiếp qua `index.ts` (hợp đồng công khai).

---

## 1. Danh mục mô-đun

| Mô-đun | Phạm vi trách nhiệm | README |
|---|---|---|
| `users` | Tài khoản, phiên đăng nhập, quản trị, khóa tài khoản | [README](./users/README.md) |
| `auth` | Đăng ký, đăng nhập, JWT, refresh, Google OAuth 2.0, quên mật khẩu | [README](./auth/README.md) |
| `workspaces` | Không gian làm việc, vai trò thành viên, hạn ngạch, chuyển chủ sở hữu | [README](./workspaces/README.md) |
| `projects` | Dự án, thành viên, trạng thái, snapshot, cascade | [README](./projects/README.md) |
| `datasets` | Nhập CSV streaming, schema, dòng dữ liệu, phát hiện vấn đề, PII | [README](./datasets/README.md) |
| `data-view` | Lưới dữ liệu ảo, phân trang keyset, thống kê cột, biểu đồ | [README](./data-view/README.md) |
| `analysis` | Phân tích chất lượng dữ liệu, AI job nội bộ, báo cáo PDF, tổng kết | [README](./analysis/README.md) |
| `feedback` | Phản hồi người dùng, RAG few-shot, chỉ số chất lượng AI | [README](./feedback/README.md) |
| `issues` | Báo cáo lỗi, tệp đính kèm, quản trị, vòng đời trạng thái | [README](./issues/README.md) |
| `notifications` | Hộp thư, push ntfy, email, tùy chọn người dùng | [README](./notifications/README.md) |
| `overview` | Tổng quan dashboard (chỉ đọc) | [README](./overview/README.md) |
| `realtime` | WebSocket Socket.IO, phòng, thu hồi token | [README](./realtime/README.md) |
| `audit` | Nhật ký kiểm toán append-only | [README](./audit/README.md) |

---

## 2. Cấu trúc chung

Mỗi mô-đun đều có **cùng một bố cục**:

```text
<module>/
├── domain/           # Lõi nghiệp vụ thuần: entity, value-object, port, event
│   ├── entities/
│   ├── value-objects/
│   ├── events/
│   ├── ports/
│   └── services/     # (một số mô-đun) hàm thuần dùng chung
├── application/      # Ca sử dụng: command/query handler (CQRS), policy loader, service
│   ├── commands/
│   ├── queries/
│   ├── services/
│   └── policy-loaders/
├── infrastructure/   # Adapter: Mongoose schema, repository, mapper
└── presentation/     # Controller REST, DTO (Zod), response mapper
```

---

## 3. Quy tắc phụ thuộc

| Mã | Quy tắc | Kiểm chứng |
|---|---|---|
| CA1 | `domain` không import `application` / `infrastructure` / `presentation` | `clean-architecture.spec.ts` |
| CA2 | `domain` không import framework | `clean-architecture.spec.ts` |
| CA3 | `domain` không import mô-đun khác | `clean-architecture.spec.ts` |
| CA4 | `application` chỉ import `domain` | `clean-architecture.spec.ts` |
| CA5 | `shared` không import từ `modules/` | `clean-architecture.spec.ts` |
| CA6 | `infrastructure` được import `domain` | `clean-architecture.spec.ts` |
| CA7 | `presentation` được import `application` | `clean-architecture.spec.ts` |
| CA8 | Import chéo mô-đun phải qua `index.ts` | `arch:cross-imports` |
| CA9 | `presentation` không chứa logic nghiệp vụ | `clean-architecture.spec.ts` |
| CA10 | Repository chỉ được gọi từ `application` / `infrastructure` | `clean-architecture.spec.ts` |
| CA11 | `domain` không dùng `any` | ESLint |
| CA12 | Controller không chứa logic nghiệp vụ | `clean-architecture.spec.ts` |
| CA13 | `shared/domain` không import framework | `clean-architecture.spec.ts` |
| CA14 | `shared/domain` không import `shared/interfaces` | `clean-architecture.spec.ts` |

---

## 4. Vai trò trong mô hình phân quyền 3 tầng

| Tầng | Mô-đun sở hữu | Vai trò |
|---|---|---|
| **Hệ thống** | `users`, `auth` | `admin`, `analyst` |
| **Workspace** | `workspaces` | `owner`, `member` |
| **Project** | `projects` | `owner`, `member`, `viewer` |

Quy tắc suy ra:

| Vai trò workspace | Vai trò project suy ra |
|---|---|
| `owner` | `owner` — toàn quyền trên mọi project của workspace |
| `member` | lấy đúng vai trò ghi trong `project.members`; nếu không có → `viewer` |

Hai **context port** (`WORKSPACE_CONTEXT_PORT`, `PROJECT_CONTEXT_PORT`) — khai báo trong `shared/application/ports/` và hiện thực ở `modules/workspaces/infrastructure/adapters/workspace-context.adapter.ts` và `modules/projects/infrastructure/adapters/project-context.adapter.ts` — giúp CASL giải quyết vai trò theo từng request.

---

## 5. Lưu đồ mô-đun

```text
users ──▶ auth ──▶ workspaces ──▶ projects ──▶ datasets ──▶ data-view
                                    │              │
                                    │              └──▶ analysis ──▶ feedback
                                    │                            │
                                    ├──▶ issues ──▶ notifications
                                    └──▶ overview

realtime  (nhận event từ mọi mô-đun)
audit     (ghi nhật ký từ mọi mô-đun)
```

---

## 6. Mô-đun nào có README?

Tất cả 13 mô-đun đều có README riêng, mô tả **trạng thái hiện thực hiện tại**: cấu trúc thư mục, domain model, phân quyền, API, lưu trữ và kiểm thử liên quan.

Đặc tả **kế hoạch** (khác với hiện thực) nằm ở `../../../../../docs/modules/`.

---

## 7. Liên quan

| Tài liệu | Nội dung |
|---|---|
| [`../shared/README.md`](../shared/README.md) | Lớp cross-cutting: CASL, keyset, event bus, outbox/inbox |
| [`../README.md`](../../README.md) | Hướng dẫn vận hành backend |
| [`../../../../README.md`](../../../../README.md) | Kiến trúc tổng thể dự án |
| `../../../../docs/modules/` | Đặc tả mô-đun (kế hoạch) |
