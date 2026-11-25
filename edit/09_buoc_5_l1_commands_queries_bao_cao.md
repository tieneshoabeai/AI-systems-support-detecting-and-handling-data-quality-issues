# Bước 5 — Nhóm L1 (Tách `commands/` + `queries/` theo Command/Query pattern)

> Kế hoạch: `edit/02_ke_hoach_thuc_thien.md` §4 (Bước 5) + `edit/03_yeu_cau_chat_luong_code_clean_architecture.md` §3.3 (L1)
> Tham chiếu thiết kế: `docs/restructures/5_ports_adapters_design_v3.md` §3.10
> Ngày thực hiện: 2026-11-16
> Trạng thái: ✅ **HOÀN TẤT** — 14 service → **105 handler** (60 commands + 45 queries), 0 vi phạm kiến trúc, 252/252 unit + 52/52 E2E pass

---

## 1. Tóm tắt kết quả

| Chỉ số | Trước Bước 5 | Sau Bước 5 | Δ |
|---|---|---|---|
| **Số service application** | 17 | 3 | −14 |
| **Số handler (UC)** | 0 | **105** | +105 |
| ├─ Commands (ghi/thay đổi trạng thái) | — | 60 | — |
| └─ Queries (chỉ đọc) | — | 45 | — |
| Module có service monolithic | 14 | 0 | −14 |
| Controller inject `XxxService` | 21 | **0** | −21 |
| Module provider chứa `XxxService` | 14 | **0** | −14 |
| Tổng vi phạm Clean Architecture | 0 | **0** | ✅ giữ nguyên |
| Unit test | 252 pass | **252 pass** | ✅ không regress |
| E2E test | 52 pass | **52 pass** | ✅ không regress |
| `tsc --noEmit` | sạch | **sạch** | ✅ |
| `tsc -p tsconfig.build.json` | sạch | **sạch** | ✅ |
| ESLint | 0 error / 152 warning | 0 error / 152 warning | ✅ |
| DI graph (`AppModule`) | resolve OK | **resolve OK** | ✅ |
| Số route HTTP | 85 | **85** | ✅ không đổi |
| `operationId` Swagger | 85 | **85** | ✅ không đổi |

**Hợp đồng API với frontend không thay đổi** — chỉ có cấu trúc nội bộ `application/` được tách.

---

## 2. Vì sao chọn phương án "1 handler class / UC" (§3.10)

Theo lựa chọn đã chốt ở phiên họp:

| Phương án | Mô tả | Kết quả |
|---|---|---|
| ❌ Giữ service, thêm `commands/`/`queries/` bên cạnh | Service vẫn tồn tại, trùng logic | Không đạt mục tiêu |
| ❌ Dùng `@nestjs/cqrs` | Thêm dependency + `ICommand`/`IQuery` boilerplate | Không đúng §3.10 |
| ✅ **1 handler class / UC** | **Mỗi use case = 1 file = 1 `@Injectable()` handler; controller gọi thẳng `handler.execute(...)`; xóa service cũ** | **Đã thực hiện** |

Không dùng framework CQRS — chỉ dùng **Command/Query pattern thuần** theo đúng §3.10.

---

## 3. Cấu trúc mới của tầng `application/`

Trước Bước 5 (monolithic):

```
src/modules/projects/application/
├── projects.service.ts        ← 15 method, 1 class
└── projects.types.ts
```

Sau Bước 5:

```
src/modules/projects/application/
├── commands/                  ← thao tác GHI
│   ├── add-project-member.handler.ts
│   ├── create-project.handler.ts
│   ├── delete-project.handler.ts
│   ├── mark-completed.handler.ts
│   ├── remove-project-member.handler.ts
│   ├── set-has-dataset.handler.ts
│   ├── transfer-project-owner.handler.ts
│   ├── update-project-member-role.handler.ts
│   └── update-project.handler.ts
├── queries/                   ← thao tác ĐỌC
│   ├── get-project-by-id.handler.ts
│   ├── get-projects-by-workspace.handler.ts
│   ├── get-workspace-name.handler.ts
│   ├── list-members.handler.ts
│   ├── list-projects-by-workspace.handler.ts
│   └── resolve-user-project-role.handler.ts
├── projects.types.ts          ← input/DTO type dùng chung
└── projects.utils.ts          ← hàm thuần dùng chung
```

### 3.1 Quy ước đặt tên

| Loại | Quy tắc | Method chuẩn CQRS |
|---|---|---|
| **Command** | động từ thay đổi trạng thái: `create`, `update`, `delete`, `set`, `add`, `remove`, `transfer`, `mark`, `dispatch`, `ingest`, `revoke`, `softDelete`, `request`, `retry`, `buildPrompt`… | `async execute(...)` |
| **Query** | tiền tố đọc: `get`, `list`, `find`, `count`, `read`, `search`, `resolve`, `check`, `exists`, `fetch`, `preview`, `stats`, `summary`, `download`, `view`, `detail`, `query` | `async execute(...)` |

Tên class: `<TênMethod>Handler` (vd. `CreateProjectHandler`, `ListProjectsByWorkspaceHandler`).
Tên file: kebab-case (`create-project.handler.ts`).

### 3.2 Phân bố 105 handler theo module

| Module | Commands | Queries | Tổng |
|---|---:|---:|---:|
| `analysis` | 7 | 6 | 13 |
| `audit` | 1 | 0 | 1 |
| `auth` | 8 | 2 | 10 |
| `data-view` | 0 | 3 | 3 |
| `datasets` | 6 | 4 | 10 |
| `feedback` | 5 | 2 | 7 |
| `issues` | 4 | 5 | 9 |
| `notifications` | 3 | 3 | 6 |
| `overview` | 0 | 2 | 2 |
| `projects` | 9 | 6 | 15 |
| `users` | 9 | 6 | 15 |
| `workspaces` | 8 | 6 | 14 |
| **TỔNG** | **60** | **45** | **105** |

### 3.3 Service CÒN LẠI (đúng ý đồ — không phải use case)

3 service này **không phải use case** mà là hạ tầng/worker, nên giữ nguyên:

| File | Lý do giữ |
|---|---|
| `realtime/application/realtime.service.ts` | Dịch vụ realtime (publish event qua Socket.IO) — không phải UC nghiệp vụ |
| `realtime/application/realtime-auth.service.ts` | Xác thực WebSocket — không thuộc HTTP use case |
| `analysis/application/report-worker.service.ts` | Worker nền (poll job PDF) — vòng lặp dài hạn, không phải UC |

Ngoài ra các service hạ tầng khác (`schema-inference.service.ts`, `rag-few-shot.service.ts`, `ai-worker.service.ts`) vốn đã nằm ở `application/services/` — không nằm trong phạm vi tách.

---

## 4. Thay đổi ở tầng `infrastructure/http/` (controller)

### 4.1 Trước / sau

```typescript
// TRƯỚC
@Injectable()
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  @Get('projects/:id')
  async getProject(@Param('id') id: string) {
    return this.projectsService.getProjectById(id);
  }
}

// SAU
@Controller()
export class ProjectsController {
  constructor(
    private readonly getProjectByIdHandler: GetProjectByIdHandler,
    private readonly listMembersHandler: ListMembersHandler,
    // ...
  ) {}

  @Get('projects/:id')
  async getProject(@Param('id') id: string) {
    return this.getProjectByIdHandler.execute(id);
  }
}
```

### 4.2 Điểm cần lưu ý

- Controller **chỉ inject handler thực sự dùng** — không inject cả bộ handler của module.
  (Cơ chế: codemod lọc theo handler có mặt trong thân controller.)
- Lời gọi multi-line (`this.svc\n  .method(`) cũng được xử lý.
- **Zero route change**: không thêm/xóa `@Get`/`@Post`/…, không đổi `operationId`, không đổi `summary`.
  → Swagger JSON cho frontend **không đổi**.

---

## 5. Thay đổi ở tầng module (DI wiring)

### 5.1 Module provider

```typescript
// TRƯỚC
@Module({
  providers: [NotificationsRepository, { provide: NOTIFICATION_REPOSITORY_PORT, useExisting: NotificationsRepository }, NotificationsService],
  exports: [NotificationsService, NotificationsRepository, NOTIFICATION_REPOSITORY_PORT],
})

// SAU
@Module({
  providers: [
    NotificationsRepository,
    { provide: NOTIFICATION_REPOSITORY_PORT, useExisting: NotificationsRepository },
    CountUnreadHandler,
    DispatchHandler,
    GetDetailHandler,
    ListForUserHandler,
    MarkAsReadHandler,
    UpdatePreferencesHandler,
  ],
  exports: [NotificationsRepository, NOTIFICATION_REPOSITORY_PORT],
})
```

### 5.2 Facade port cần adapter mới

Sau khi xóa service, 3 facade port (do Bước 4 tạo) không còn implementation để bind
(`useExisting: ProjectsService` → service đã bị xóa). Đã tạo **3 adapter** trong tầng
`infrastructure/adapters/`:

| Port | Adapter mới | File | Handler nền |
|---|---|---|---|
| `PROJECT_ACCESS_PORT` | `ProjectAccessAdapter` | `projects/infrastructure/adapters/project-access.adapter.ts` | `GetProjectByIdHandler`, `ResolveUserProjectRoleHandler`, `SetHasDatasetHandler` |
| `WORKSPACE_ACCESS_PORT` | `WorkspaceAccessAdapter` | `workspaces/infrastructure/adapters/workspace-access.adapter.ts` | `ResolveUserWorkspaceRoleHandler`, `IncrementStorageUsedHandler`, `CheckWorkspaceUploadQuotaHandler` |
| `AUDIT_LOGGER_PORT` | `AuditLoggerAdapter` | `audit/infrastructure/adapters/audit-logger.adapter.ts` | `LogHandler` |

`RAG_FEW_SHOT_PORT` không cần adapter — bind vào `RagFewShotService` (hạ tầng, không tách).

> **Lưu ý kiến trúc:** adapter nằm ở tầng `infrastructure/` (driving adapter) và chỉ phụ thuộc
> **port token** + **handler** — không phụ thuộc trực tiếp vào repository hay Mongoose.
> Vẫn giữ đúng luồng phụ thuộc: `infrastructure → application → domain`.

---

## 6. Public contract (`index.ts`) — L4

Mọi module giờ export handler ra public contract, để module khác có thể dùng mà không import sâu:

```typescript
// src/modules/projects/index.ts
// ── Handlers (Command/Query) ────────────────────────────────
export { AddProjectMemberHandler } from './application/commands/add-project-member.handler';
// ...
export { GetProjectByIdHandler } from './application/queries/get-project-by-id.handler';
```

Tổng cộng **105 handler được export** qua 12 file `index.ts`.

> Lưu ý: `test/helpers/module-handlers.ts` import **trực tiếp từ file handler** (không qua
> `index.ts`) vì có trường hợp trùng tên class giữa các module
> (vd. `RevokeSessionHandler` tồn tại ở cả `auth` và `users`, `ListMembersHandler` ở cả
> `projects` và `workspaces`) — nếu import qua `index.ts` sẽ đụng tên.

---

## 7. Test được cập nhật

### 7.1 Vấn đề

11 file test inject `XxxService` — service không còn tồn tại.

### 7.2 Cách xử lý (giữ nguyên logic test)

Tạo 2 helper mới:

| File | Vai trò |
|---|---|
| `test/helpers/module-handlers.ts` | Auto-generated — map `{ methodName: HandlerClass }` cho 12 module (tên class được alias theo module để tránh trùng) |
| `test/helpers/handler-proxy.ts` | `createHandlerProxy(moduleRef, handlers)` — trả về object có **đúng API như service cũ** (mỗi method gọi `handler.execute(...)`); `ProxyOf<T>` suy luận type đầy đủ (không cần `any`) |

```typescript
// TRƯỚC
let service: WorkspacesService;
providers: [WorkspacesService, { provide: WORKSPACE_REPOSITORY_PORT, useValue: repository }]
service = module.get<WorkspacesService>(WorkspacesService);

// SAU
let service: ProxyOf<typeof workspacesHandlers>;
providers: [
  ...Object.values(workspacesHandlers),
  { provide: WORKSPACE_REPOSITORY_PORT, useValue: repository },
]
service = createHandlerProxy(module, workspacesHandlers);
```

→ **Logic assert của test giữ nguyên 100%**, chỉ đổi cách khởi tạo.

### 7.3 Danh sách 11 file test đã cập nhật

| File | Thay đổi |
|---|---|
| `test/data-view.spec.ts` | `DataViewService` → handler proxy; `RECORD_QUERY_PORT` import từ `datasets` |
| `test/datasets-ingestion.spec.ts` | `DatasetsService` → handler proxy; `PROJECT_ACCESS_PORT` + `WORKSPACE_ACCESS_PORT` |
| `test/datasets-wave4.spec.ts` | `DatasetsService` + `DataViewService` → handler proxy |
| `test/feedback-wave7.spec.ts` | `FeedbackService` → handler proxy; 3 facade port |
| `test/keyset-pagination.spec.ts` | sửa đường dẫn import (Bước 4) |
| `test/notifications-issues-wave6.spec.ts` | `NotificationsService` + `IssuesService` → handler proxy |
| `test/projects.spec.ts` | `ProjectsService` → handler proxy |
| `test/step1-remember-me-and-issue-needs-info.spec.ts` | `AuthService` → handler proxy |
| `test/step1-services.spec.ts` | `AuthService` + `IssuesService` → handler proxy |
| `test/step3-efgh.spec.ts` | `WorkspacesService` + `UsersService` + `ProjectsService` + `OverviewService` → handler proxy |
| `test/workspaces.spec.ts` | `WorkspacesService` → handler proxy |
| `test/realtime.spec.ts` | sửa đường dẫn `realtime-events` (Bước 4) |

---

## 8. Script/codemod mới

| Script | Lệnh | Mục đích |
|---|---|---|
| `scripts/split-commands-queries.ts` | (đã chạy 1 lần) | Codemod AST: tách 14 service → 105 handler + file `*.types.ts` / `*.utils.ts` dùng chung |
| `scripts/map-handler-to-service.ts` | (đã chạy 1 lần) | Sinh `.handler-manifest.json` — map handler ↔ service gốc |
| `scripts/wire-handlers.ts` | (đã chạy 1 lần) | Rewire `<module>.module.ts` (providers/exports) + `<module>.controller.ts` (constructor + lời gọi) |
| `scripts/cleanup-old-services.py` | (đã chạy 1 lần) | Thay service trong file application còn lại (`ai-worker.service.ts`), xóa service cũ |
| `scripts/update-module-index.py` | (đã chạy 1 lần) | Cập nhật `index.ts` public contract — export 105 handler |
| `scripts/generate-test-handlers.py` | (đã chạy 1 lần) | Sinh `test/helpers/module-handlers.ts` |
| `scripts/update-tests-for-handlers.py` | (đã chạy 1 lần) | Cập nhật 11 file unit test sang dùng handler proxy |

> `.handler-manifest.json` (artifact sinh tự động) đã thêm vào `.gitignore`.
> Tất cả script codemod đều **idempotent** — chạy lại cho cùng kết quả.

---

## 9. Lệnh kiểm tra đã chạy

```bash
cd src/backend

pnpm run type-check                    # ✅ 0 lỗi
npx tsc -p tsconfig.build.json --noEmit # ✅ 0 lỗi (build config)
pnpm exec jest --runInBand             # ✅ 23 suites / 252 tests pass
pnpm exec jest --config ./test/jest-e2e.json --runInBand
                                     # ✅ 2 suites / 52 tests pass
pnpm exec jest --testPathPatterns '(zero-any|guard-coverage|zod-openapi|clean-architecture)\.spec\.ts$' --runInBand
                                     # ✅ 4 suites / 16 tests pass
pnpm run lint                          # ✅ 0 error / 152 warning
pnpm run arch:baseline                 # ✅ 0 vi phạm (CA3/5/6/7/8/11)
pnpm run arch:verify-di                # ✅ DI graph resolve thành công
pnpm run arch:cross-imports            # ✅ 106 import chéo — 100% qua index.ts / *.module.ts
npx nest start                         # ✅ boot tới InstanceLoader (chỉ lỗi Mongo do sandbox chặn network)
```

---

## 10. Ảnh hưởng tới tài liệu (cập nhật ở Bước 8 — Nhóm I)

| Tài liệu | Nội dung cần sửa |
|---|---|
| `docs/restructures/5_ports_adapters_design_v3.md` | §3.10 — bổ sung quy ước thực tế sau khi áp dụng (tên file kebab-case, alias class trong test, 3 adapter mới) |
| `docs/restructures/4_module_boundaries_v5.md` | Sơ đồ module: `application/` nay có `commands/` + `queries/`; thêm 3 adapter vào sơ đồ |
| `docs/restructures/00_cong_nghe_ky_thuat_kien_truc_hien_tai.md` (+ `.slides.html`) | Bảng "105 use case / 60 command / 45 query"; cây thư mục `application/` mới; sơ đồ DI |
| `docs/restructures/13_testing_acceptance_plan_v8.md` | Thêm `test/helpers/handler-proxy.ts` + `module-handlers.ts` vào mô tả hạ tầng test |

---

## 11. Kết luận & bước tiếp theo

**Bước 5 hoàn tất.** Nhóm L1 đã được triển khai đầy đủ theo §3.10:

- 14 service monolithic → **105 handler class** (60 command + 45 query), mỗi handler là 1 use case độc lập với `execute()`.
- Controller gọi thẳng `handler.execute(...)` — không còn `XxxService` nào trong tầng HTTP.
- Module provider khai báo handler; facade port được bind qua **3 adapter** mới ở tầng `infrastructure`.
- Public contract `index.ts` export đủ 105 handler.
- **0 vi phạm Clean Architecture**, 252/252 unit + 52/52 E2E pass, 0 lỗi type-check, 0 lỗi lint, DI resolve OK.
- **Hợp đồng API không đổi** (85 route, 85 `operationId` giữ nguyên) → frontend không cần sửa gì.

**Tiếp theo:**

| Bước | Nội dung | Ghi chú |
|---|---|---|
| **Bước 6** | Nhóm B — Google OAuth 2.0 thực tế | Cần credential từ người dùng (Client ID/Secret) |
| **Bước 7** | Nhóm J1 — siết ESLint `--max-warnings 0` | Còn 152 warning (chủ yếu `explicit-function-return-type` + `no-unsafe-*`) |
| **Bước 8** | Nhóm I — cập nhật toàn bộ `docs/restructures/` | Xem mục 10 |
