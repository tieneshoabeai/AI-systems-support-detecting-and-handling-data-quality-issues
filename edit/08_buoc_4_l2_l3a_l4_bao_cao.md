# Bước 4 — L2 (Cross-schema) + L3a (Cross-service) + L4 (Public contract)

> Kế hoạch: `edit/02_ke_hoach_thuc_thien.md` §4 (Bước 4) + `edit/03_yeu_cau_chat_luang_code_clean_architecture.md` §3.3 (L2, L3a, L4)
> Ngày thực hiện: 2026-11-16
> Trạng thái: ✅ **HOÀN TẤT** — nợ kỹ thuật kiến trúc **68 → 0 vi phạm**

---

## 1. Tóm tắt kết quả

| Chỉ số | Trước Bước 4 | Sau Bước 4 | Δ |
|---|---|---|---|
| **Tổng vi phạm Clean Architecture** | **68** | **0** | −68 |
| CA3 — infrastructure chạm tầng trong module khác | 9 | 0 | −9 |
| CA5 — `shared/` import từ `modules/` | 2 | 0 | −2 |
| CA6 — import schema Mongoose chéo module (R3) | 3 | 0 | −3 |
| CA7 — import service class chéo module (R2) | 16 | 0 | −16 |
| CA8 — import sâu, không qua public contract (R6) | 38 | 0 | −38 |
| CA11 — `domain/` import `shared/` mang framework | 0 | 0 | 0 |
| Unit test | 252 pass | 252 pass | ✅ không regress |
| E2E test | 52 pass | 52 pass | ✅ không regress |
| `tsc --noEmit` | sạch | sạch | ✅ |
| ESLint | 0 error / 155 warning | 0 error / 152 warning | −3 warning |
| DI graph (`AppModule`) | — | resolve OK | ✅ mới |

**Baseline cũ đã xóa sạch** — `test/fixtures/arch-baseline.json` nay có mảng rỗng cho mọi quy tắc.
Từ Bước 7 trở đi, **bất kỳ vi phạm mới nào cũng FAIL CI ngay** (không còn "nợ kỹ thuật được đặc xả").

---

## 2. L2 — Sửa V1: không import schema Mongoose của module khác (R3 / CA6)

### 2.1 Vấn đề

Bounded context `datasets` sở hữu collection `dataset_records` + schema `DatasetRecordSchema`.
Nhưng `data-view` và `analysis` tự khai báo lại schema đó:

```
src/modules/data-view/data-view.module.ts → MongooseModule.forFeature([{ name: 'DatasetRecord', schema: DatasetRecordSchema }])
src/modules/analysis/analysis.module.ts  → MongooseModule.forFeature([..., { name: 'DatasetRecord', schema: DatasetRecordSchema }])
src/modules/data-view/infrastructure/persistence/record-query.repository.ts → import IDatasetRecord
```

Hệ quả: module `data-view`/`analysis` phụ thuộc trực tiếp vào **cấu trúc lưu trữ** của module khác.
Khi `datasets` đổi schema, hai module kia có thể ghi bẩn collection do schema lệch phiên bản.

### 2.2 Cách sửa

| Hành động | Chi tiết |
|---|---|
| **Di chuyển port** | `data-view/domain/ports/record-query.port.ts` → `datasets/domain/ports/record-query.port.ts` |
| **Di chuyển adapter** | `data-view/infrastructure/persistence/record-query.repository.ts` → `datasets/infrastructure/persistence/record-query.repository.ts` |
| **Xóa file cũ** | 2 file ở `data-view/` đã bị xóa hoàn toàn |
| **Owner mới** | `datasets.module.ts` khai báo `DatasetRecordSchema` + bind/export `RECORD_QUERY_PORT` |
| **Consumer** | `data-view.module.ts` bỏ `MongooseModule.forFeature([DatasetRecord])`, chỉ import `DatasetsModule` |
| **Consumer** | `analysis.module.ts` bỏ `DatasetRecordSchema` khỏi `forFeature`, bỏ `DataViewModule` khỏi imports |

Adapter `RecordQueryRepository` giờ nằm trong `datasets/infrastructure/persistence/` — được phép chạm
schema Mongoose của chính module sở hữu nó (đúng nguyên tắc).

---

## 3. L3a — Sửa V2: mọi cross-service call đi qua port (R2 / CA7)

### 3.1 Các facade port mới

| Port | File | Interface | Implementer | Module bind |
|---|---|---|---|---|
| `PROJECT_ACCESS_PORT` | `projects/domain/ports/project.access.port.ts` | `getProjectById`, `resolveUserProjectRole`, `setHasDataset` | `ProjectsService` | `ProjectsModule` |
| `WORKSPACE_ACCESS_PORT` | `workspaces/domain/ports/workspace.access.port.ts` | `resolveUserWorkspaceRole`, `incrementStorageUsed`, `checkWorkspaceUploadQuota` | `WorkspacesService` | `WorkspacesModule` |
| `AUDIT_LOGGER_PORT` | `audit/domain/ports/audit-logger.port.ts` | `log(input, changes?)` | `AuditService` | `AuditModule` |
| `RAG_FEW_SHOT_PORT` | `analysis/domain/ports/rag-few-shot.port.ts` | `embedQueryText`, `buildQueryText`, `buildFewShotBlockFromText` | `RagFewShotService` | `AnalysisModule` |

`USER_REPOSITORY_PORT` được **tái sử dụng** (không tạo port mới) cho các tác vụ tra cứu user
(`findById`) — vì đây đã là repository port, không phải service.

### 3.2 Các import chéo đã xóa (16 vi phạm CA7)

| File | Trước | Sau |
|---|---|---|
| `analysis/application/analysis.service.ts` | `ProjectsService` | `PROJECT_ACCESS_PORT` |
| `analysis/application/report.service.ts` | `ProjectsService` | `PROJECT_ACCESS_PORT` |
| `analysis/application/summary.service.ts` | `ProjectsService` | `PROJECT_ACCESS_PORT` |
| `analysis/infrastructure/http/report.controller.ts` | `AuditService` | `AUDIT_LOGGER_PORT` |
| `auth/infrastructure/auth/jwt.strategy.ts` | `UsersService` | `USER_REPOSITORY_PORT` |
| `datasets/application/datasets.service.ts` | `ProjectsService`, `WorkspacesService` | `PROJECT_ACCESS_PORT`, `WORKSPACE_ACCESS_PORT` |
| `datasets/infrastructure/http/datasets.controller.ts` | `AuditService` | `AUDIT_LOGGER_PORT` |
| `feedback/application/feedback.service.ts` | `ProjectsService`, `WorkspacesService`, `UsersService`, `RagFewShotService` | 4 port tương ứng |
| `issues/infrastructure/http/issues.controller.ts` | `AuditService` | `AUDIT_LOGGER_PORT` |
| `realtime/application/realtime-auth.service.ts` | `UsersService` | `USER_REPOSITORY_PORT` |
| `realtime/infrastructure/websocket/realtime.gateway.ts` | `ProjectsService`, `WorkspacesService` | `PROJECT_ACCESS_PORT`, `WORKSPACE_ACCESS_PORT` |

**Còn lại:** 0 import service chéo module.

### 3.3 Ghi chú đặc biệt — `realtime` (CA5 + CA11)

Hợp đồng realtime trước đây nằm ở `modules/realtime/domain/ports/realtime.port.ts`.
`shared/events/event-dispatcher.service.ts` cần dùng nó → vi phạm **CA5** (`shared/` không được biết module nghiệp vụ).

Cách sửa 2 tầng (thỏa cả CA5 lẫn CA11):

```
shared/utils/realtime-events.ts   →  hợp đồng THUẦN (tên sự kiện, envelope, room, buildEnvelope)
shared/ports/realtime.port.ts     →  REALTIME_PORT + interface RealtimePort (token DI)

modules/realtime/index.ts         →  re-export cả hai (public contract cho module nghiệp vụ)
modules/realtime/domain/ports/realtime-transport.port.ts
                                  →  import envelope từ shared/utils/ (thuần ⇒ không vi phạm CA11)
```

- `shared/events/*` import từ `shared/ports/realtime.port` → **không còn CA5**.
- `modules/realtime/domain/*` import từ `shared/utils/realtime-events` → **không còn CA11**.
- Xóa 2 file cũ: `modules/realtime/domain/realtime-events.ts`, `modules/realtime/domain/ports/realtime.port.ts`.

---

## 4. L4 — Sửa V3: public contract `index.ts` cho mọi module (R6 / CA8)

### 4.1 Danh sách public contract đã tạo/cập nhật

| Module | File `index.ts` | Nội dung export |
|---|---|---|
| `analysis` | ✅ mới | `ANALYSIS_REPOSITORY_PORT`, `RAG_FEW_SHOT_PORT`, types, pure util RAG |
| `audit` | ✅ mới | `AUDIT_LOGGER_PORT`, `AUDIT_REPOSITORY_PORT`, types |
| `auth` | ✅ mới | 5 port auth, `PASSWORD_MIN_LENGTH`, `AUTH_EVENTS` |
| `datasets` | ✅ mới | `DATASET_REPOSITORY_PORT`, `RECORD_QUERY_PORT`, types, VO giới hạn |
| `data-view` | ✅ mới | `DataViewService`, VO record-query/filter |
| `feedback` | ✅ mới | `FEEDBACK_REPOSITORY_PORT`, VO label |
| `issues` | ✅ mới | `ISSUE_REPORT_REPOSITORY_PORT`, VO status/type |
| `notifications` | ✅ mới | `NOTIFICATION_REPOSITORY_PORT`, VO type |
| `projects` | ✅ cập nhật | + `PROJECT_ACCESS_PORT`, VO role |
| `realtime` | ✅ mới | `REALTIME_PORT`, `REALTIME_TRANSPORT_PORT`, `RealtimeRooms` |
| `users` | ✅ cập nhật | + VO `user-role.vo` (pure functions) |
| `workspaces` | ✅ cập nhật | + `WORKSPACE_ACCESS_PORT`, VO role |
| `overview` | (đã có) | `OverviewService` |
| `datasets` / `data-view` / `analysis` | ✅ | đã liệt kê ở trên |

### 4.2 Script kiểm tra

`scripts/list-cross-module-imports.ts` (mới) — liệt kê mọi import chéo module:

```bash
pnpm run arch:cross-imports
```

**Kết quả hiện tại:** 57 import chéo module, **100% đi qua `index.ts` hoặc `*.module.ts`** (hợp lệ theo CA8).
Không còn import sâu vào `domain/ports/…`, `application/…`, `infrastructure/…` của module khác.

---

## 5. Script mới

| Script | Lệnh | Mục đích |
|---|---|---|
| `scripts/list-cross-module-imports.ts` | `pnpm run arch:cross-imports` | Liệt kê import chéo module — phát hiện vi phạm CA8 ngay khi code |
| `scripts/verify-di-graph.ts` | `pnpm run arch:verify-di` | Compile `AppModule` với stub Mongoose/Storage → phát hiện DI thiếu provider mà **không cần** DB thật |

`verify-di-graph.ts` rất quan trọng vì E2E hiện chưa boot `AppModule`; script này đảm bảo việc đổi
token DI không làm app fail lúc runtime.

---

## 6. Test được cập nhật

| File | Thay đổi |
|---|---|
| `test/data-view.spec.ts` | `RECORD_QUERY_PORT` import từ `../src/modules/datasets` |
| `test/datasets-wave4.spec.ts` | `RECORD_QUERY_PORT` từ `../src/modules/datasets`; provider `PROJECT_ACCESS_PORT` + `WORKSPACE_ACCESS_PORT` |
| `test/datasets-ingestion.spec.ts` | provider `PROJECT_ACCESS_PORT` + `WORKSPACE_ACCESS_PORT` |
| `test/feedback-wave7.spec.ts` | provider `PROJECT_ACCESS_PORT` + `WORKSPACE_ACCESS_PORT` + `USER_REPOSITORY_PORT` |
| `test/realtime.spec.ts` | envelope import từ `../src/shared/utils/realtime-events` |
| `test/step1-services.spec.ts` | `REALTIME_PORT` từ `../src/modules/realtime` |
| `test/notifications-issues-wave6.spec.ts` | `REALTIME_PORT` từ `../src/modules/realtime` |
| `test/fixtures/arch-baseline.json` | regenerate → **0 vi phạm** |

---

## 7. Lệnh kiểm tra đã chạy

```bash
cd src/backend

pnpm run type-check        # ✅ sạch
pnpm exec jest --runInBand # ✅ 23 suites / 252 tests pass
pnpm exec jest --config ./test/jest-e2e.json --runInBand
                         # ✅ 2 suites / 52 tests pass
pnpm run lint              # ✅ 0 error, 152 warning
pnpm run arch:baseline     # ✅ 0 vi phạm
pnpm run arch:verify-di    # ✅ DI graph resolve OK
pnpm run arch:cross-imports # ✅ 57 import chéo, tất cả qua index.ts / *.module.ts
```

---

## 8. Tác động lên tài liệu (cần cập nhật ở Bước 8 — Nhóm I)

| Tài liệu | Nội dung cần sửa |
|---|---|
| `docs/restructures/4_module_boundaries_v5.md` | Bảng port mới (`PROJECT_ACCESS_PORT`, `WORKSPACE_ACCESS_PORT`, `AUDIT_LOGGER_PORT`, `RAG_FEW_SHOT_PORT`, `RECORD_QUERY_PORT`); sơ đồ dependency; ghi nhận `shared/ports/realtime.port.ts` là hợp đồng cross-cutting |
| `docs/restructures/5_ports_adapters_design_v3.md` | Vị trí port realtime; quy ước public contract `index.ts`; facade vs repository port |
| `docs/restructures/8_database_schema_v7.md` | Ghi nhận `dataset_records` do `datasets` sở hữu duy nhất |
| `docs/restructures/13_testing_acceptance_plan_v8.md` | Thêm `arch:verify-di` + `arch:cross-imports` vào checklist CI |
| `docs/restructures/00_cong_nghe_ky_thuat_kien_truc_hien_tai.md` (+ `.slides.html`) | Sơ đồ module → public contract; bảng "0 vi phạm kiến trúc" |

---

## 9. Kết luận & bước tiếp theo

**Bước 4 hoàn tất.** Nợ kỹ thuật Clean Architecture đã được xóa sạch (68 → 0):
- L2 (R3/CA6): schema Mongoose chỉ nằm trong module sở hữu.
- L3a (R2/CA7): 0 import service chéo module — mọi call đi qua port.
- L4 (R6/CA8): 0 import sâu — mọi import chéo đi qua public contract `index.ts`.

**Tiếp theo — Bước 5: Nhóm L1** — tách `application/` thành `commands/` + `queries/`
theo `5_ports_adapters_design_v3.md` §3.10 (Command/Query pattern, không dùng CQRS framework).
Ước lượng ~30 file (di chuyển + đổi import). Đây là bước rủi ro cao nhất còn lại vì nó đụng
cùng các file mà Bước 4 vừa sửa (`datasets.service.ts`, `feedback.service.ts`, `issues.service.ts`,
`notifications.service.ts`, `analysis.service.ts`, `projects.service.ts`, `workspaces.service.ts`).

Sau Bước 5 còn:
- Bước 6: Nhóm B — Google OAuth 2.0 thực tế (cần credential từ người dùng).
- Bước 7: Nhóm J1 — siết ESLint `--max-warnings 0`.
- Bước 8: Nhóm I — cập nhật toàn bộ tài liệu `docs/restructures/`.
