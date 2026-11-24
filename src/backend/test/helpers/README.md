# `test/helpers/` — 5 file dùng chung (không phải test)

| File | Để làm gì thật (đọc dòng comment đầu file) | Ai dùng |
|---|---|---|
| `module-handlers.ts` | Auto-generated — xem `scripts/generate-test-handlers.py` (48 dòng). Map tên method cũ → Handler class mới, alias theo module để không trùng (ví dụ `RevokeSessionHandler` ở cả `auth` và `users`). Ví dụ thật: `import { BuildPromptForJobHandler as AnalysisBuildPromptForJobHandler } from '../../src/modules/analysis/...'` | Mọi `*.spec.ts` dùng `createHandlerProxy` |
| `handler-proxy.ts` | `ProxyOf<T>` + `createHandlerProxy()`: Handler thì gọi `handler.execute(...)`, service Simple (ví dụ `OverviewService`/`AuditService`, ADR-0002) thì gọi `service.<method>(...)` — giữ logic test khi flatten | Unit test CQRS |
| `transaction.ts` | `fakeTransaction()` (noop: `runInTransaction(fn)` chạy `fn` trực tiếp) + `fakeTransactionWithRollback(committed)` (ném lại lỗi, đánh dấu `committed=false`) — mô phỏng OPEN-09 strict outbox (`MongooseTransactionService` thật cần replica set nên không dùng được ở unit) | Unit test cần transaction |
| `test-infra.ts` | Detect Mongo rs0 + Redis + MinIO; fix dynamic-import `os` cho driver mongodb@7 trong Jest VM; `describe.skip` khi thiếu hạ tầng. URI mặc định trong code: `mongodb://127.0.0.1:27018/?replicaSet=rs0`, `redis://127.0.0.1:6380`, `http://127.0.0.1:9002` | Chỉ integration test |
| `resolve-import.ts` | Quét import/export bằng regex (không AST) để phân tầng/layer. `ROOT_DIR = path.resolve(__dirname, '..', '..')` (từ `test/helpers/` về `src/backend/`), `SRC_DIR`, `MODULES_DIR`, `SHARED_DIR` | Chỉ `unit/arch/` (`clean-architecture`, `modular-monolith`) |

Quy tắc import thật (kiểm tra trong `unit/datasets/data-view.spec.ts` + `unit/arch/clean-architecture.spec.ts`):
- Spec trong `test/unit/<domain>/` dùng `'../../helpers/...'` (lên 2 cấp tới `test/helpers/`) và `'../../../src/...'` (lên 3 cấp tới `src/`).
- Riêng `unit/arch/clean-architecture.spec.ts` dùng `'../../helpers/resolve-import'` (không lên 3 cấp).
