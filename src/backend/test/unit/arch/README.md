# `test/unit/arch/` — 9 file: luật kiến trúc (cấm là hỏng)

Đây là **hàng rào kiến trúc** — bất kỳ vi phạm nào cũng fail CI. Không test nghiệp vụ, chỉ quét mã nguồn (`fs.readFileSync`, regex import). Tất cả `describe` dưới đây chép nguyên văn từ code.

| File | `describe` thật trong code | Chặn cái gì |
|---|---|---|
| `clean-architecture.spec.ts` | `Clean Architecture — Dependency Rule` | CA1–CA14: `domain` không import framework/module khác; `shared` không import `modules/`; đọc `fixtures/arch-baseline.json` để cho phép vi phạm cũ (hiện `CA3/CA5/CA6/CA7/CA8/CA11` đều `[]`), vi phạm mới thì FAIL |
| `modular-monolith.spec.ts` | `Modular Monolith — MM5: module là vertical slice phẳng` + `MM6 — service không phụ thuộc HTTP của framework` (2 describe trong 1 file) | MM5: không thư mục con lạ (trừ `assets`); MM6: file `*.service.ts` trong `modules/` cấm import `HttpException`/`HttpStatus` |
| `guard-coverage.spec.ts` | `Architectural Guard Coverage (Zero-Trust Security)` | Liệt kê 14 controller thật trong code (`App/Auth/Users/Workspaces/Projects/Datasets/DataView/Analysis/Summary/Report/Notifications/Issues/Feedback/Overview`): mọi endpoint phải có `JwtAuthGuard` hoặc `@Public()` |
| `zero-any.spec.ts` | `Architectural Type Safety (Zero Any Policy)` | Quét `src/`, `scripts/`, `test/` (`*.ts`, trừ `*.d.ts` và trừ chính file này) bằng regex `(:|as|<|,)\s*any` — cấm `any`. Vì vậy e2e phải dùng `ExecutionContext`, không `ctx: any` |
| `api-contract-coverage.spec.ts` | `API contract coverage — hợp đồng §3.13 khớp mã nguồn` | Route trong code khớp tài liệu API và ngược lại |
| `zod-openapi.spec.ts` | `Zod-OpenAPI Schema Transformer` | Swagger sinh trực tiếp từ Zod schema, không DTO 2 lần |
| `mongo-session-arch.spec.ts` | `OPEN-09 — mọi thao tác ghi MongoDB phải mang session` | Ghi Mongo phải mang session qua AsyncLocalStorage |
| `open-09-strict-transaction.spec.ts` | `OPEN-09 — Outbox strict (lỗi ghi event ⇒ nghiệp vụ chính thất bại)` + `OPEN-09 — OutboxService gia nhập session từ MongoSessionContext` (2 describe) | Lỗi ghi event → nghiệp vụ chính thất bại (dùng `fakeTransactionWithRollback`) |
| `open-10-numeric-conventions.spec.ts` | `OPEN-10 — Độ lệch chuẩn & phương sai dùng MẪU (n−1)` + 5 describe con (quartile type 7, skewness mẫu, ngưỡng DQ-01/02/03, ngưỡng DQ-04, IQR 1,5×/3×) | Thống kê dùng mẫu (n−1), không dùng tổng thể |

Lưu ý đường dẫn (kiểm tra thật trong code):
- `zero-any` / `modular-monolith` / `api-contract-coverage`: `path.resolve(__dirname, '..', '..', '..')` về `src/backend/` (vì nằm sau 3 cấp `unit/arch/`).
- `clean-architecture`: `path.resolve(__dirname, '..', '..', 'fixtures', 'arch-baseline.json')` về `test/fixtures/` — khác 3 file trên, sửa sai là vỡ ngay.

Lưu ý lệnh chạy (kiểm tra thật trong `package.json`):
- `pnpm test:arch` chỉ chạy **5/9 file**: `zero-any|guard-coverage|zod-openapi|clean-architecture|api-contract-coverage`.
- 4 file còn lại (`modular-monolith`, `mongo-session`, `open-09`, `open-10`) chạy trong `pnpm test` / `pnpm test:unit`. Muốn chạy hết 9 file: `npx jest test/unit/arch --no-coverage`.
