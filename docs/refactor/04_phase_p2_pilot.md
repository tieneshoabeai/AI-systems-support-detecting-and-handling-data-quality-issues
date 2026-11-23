# 4. Phase P2 — Pilot `audit` (Simple template mẫu)

> **Thời gian:** 2 giờ · **Mục tiêu:** Flatten `audit` thành Simple mẫu, chốt template S cho P3.
> **Vì sao chọn `audit`:** nhỏ nhất (8 file / 353 LOC / 1 cmd / 0 query / 0 HTTP route), sai cũng revert rẻ. Lưu ý `audit` CÓ DB riêng (2 schema append-only + TTL) nhưng logic mỏng nên vẫn làm pilot tốt.

---

## 4.1. Cấu trúc trước → sau (audit, đối chiếu mã thật ở P1)

### Trước (Hexagonal 4 tầng, ở P1 — KHÔNG có `presentation/`)

```
src/modules/audit/
├── application/commands/log.handler.ts          ← LogHandler.execute() (best-effort try/catch)
├── domain/ports/audit-logger.port.ts            ← AUDIT_LOGGER_PORT (facade cho module khác)
├── domain/ports/audit.repository.port.ts        ← AUDIT_REPOSITORY_PORT + AuditAction/TargetType/Input
├── infrastructure/adapters/audit-logger.adapter.ts ← AuditLoggerAdapter.log() → delegate sang LogHandler
├── infrastructure/persistence/audit-log.schema.ts  ← 2 schema: AuditLog + AuditChange (TTL expires_at)
├── infrastructure/persistence/audit.repository.ts  ← createLog (RETENTION_DAYS=365, toOid/isObjectIdHex, resolveMongoSession, slice 50 changes)
├── index.ts                                     ← export 2 port + LogHandler
└── audit.module.ts                              ← @Global(), 2 model forFeature, useExisting cho cả 2 port
```

### Sau (Simple — KHÔNG tạo `routes.ts` vì không có HTTP route)

```
src/modules/audit/
├── audit.service.ts      ← AuditService implements AuditLoggerPort, method log() (gộp LogHandler + AuditLoggerAdapter, giữ nguyên body best-effort)
├── audit.repository.ts   ← giữ nguyên từ infrastructure/persistence/audit.repository.ts (giữ toOid/slice/session)
├── audit.schema.ts       ← giữ nguyên 2 schema + TTL index (đổi tên file, không đổi nội dung)
├── audit.types.ts        ← type/log-level/constant + 2 port symbol + Input/Record types (gộp từ domain/ports/)
├── index.ts              ← public contract (giữ, export service + 2 port symbol; ngừng export LogHandler/Adapter cũ)
└── audit.module.ts       ← DI wiring (giữ @Global() + 2 model forFeature; provide AuditService + useExisting cho AUDIT_LOGGER_PORT)
```

> Điểm lệch duy nhất đã biết: `LogHandler.execute()` + `AuditLoggerAdapter.log()` → gộp thành `AuditService.log()` (facade `AUDIT_LOGGER_PORT`). Ghi rõ trong commit + README.
> Cấm đụng: `RETENTION_DAYS=365`, TTL `expires_at`, `toOid/isObjectIdHex`, `resolveMongoSession`, slice (`userAgent` 500, changes 50, field 200), `@Global()`, best-effort try/catch warn.

## 4.2. Các bước làm (làm đúng thứ tự, không gộp bước)

1. **Đối chiếu bất biến (15 phút):** mở `12_business_invariants.md` §audit + `13_refactor_constraints.md` §13.6; liệt kê port/handler/schema/DI của `audit` ra giấy (không có route/HTTP để đối chiếu).
2. **Tạo file mới, không xóa file cũ ngay:**
   - `audit.types.ts`: copy nguyên 2 port symbol + toàn bộ type từ `domain/ports/` (không đổi tên Symbol, TC-03).
   - `audit.schema.ts`: `git mv` từ `infrastructure/persistence/audit-log.schema.ts` — giữ nguyên 2 schema + TTL index.
   - `audit.repository.ts`: `git mv` từ `infrastructure/persistence/audit.repository.ts` — giữ nguyên `createLog` + `resolveMongoSession` + `deleted` không có (append-only).
   - `audit.service.ts`: tạo class `AuditService implements AuditLoggerPort` với method `log()` — copy nguyên body `LogHandler.execute()` (best-effort try/catch) + chữ ký `(input, changes?)` giữ thứ tự tham số.
3. **Chuyển DI:** `audit.module.ts` provide `AuditService` + `{ provide: AUDIT_LOGGER_PORT, useExisting: AuditService }` (thay LogHandler + AuditLoggerAdapter); giữ `AuditRepository` + `AUDIT_REPOSITORY_PORT useExisting` + `@Global()` + 2 model `forFeature`. `index.ts` export lại symbol cũ (`AUDIT_LOGGER_PORT`, `AUDIT_REPOSITORY_PORT` + types) để module khác không vỡ import; ngừng export `LogHandler`/`AuditLoggerAdapter`.
4. **Xóa file cũ:** chỉ xóa `application/commands/log.handler.ts` + `infrastructure/adapters/audit-logger.adapter.ts` + thư mục rỗng sau khi type-check xanh.
5. **Viết `README.md` cho module:**
   ```md
   # audit — Template: Simple (không routes vì không có HTTP)
   - Vì sao Simple: 1 cmd nội bộ best-effort, DB append-only mỏng, không invariant phức tạp.
   - Bất biến: facade AUDIT_LOGGER_PORT, method log() (gộp từ execute() + adapter.log()); giữ RETENTION 365d + TTL + @Global().
   ```

## 4.3. Cổng kiểm soát P2 (bắt buộc)

```bash
cd src/backend
pnpm type-check
pnpm lint
pnpm exec jest --maxWorkers=2 --testPathPatterns 'audit|modular-monolith|clean-architecture'
pnpm arch:api-coverage   # vẫn 82 HTTP + 1 WS (audit không có route nên không đổi)
bash scripts/measure-refactor.sh
```

- Tick `13_refactor_constraints.md` §13.6 (TC/AC/FC/BC/PC) — dù module nhỏ cũng phải tick; chú ý TC-03 (Symbol/useExisting), TC-04 (không có subscriber), TC-05 (session).
- Ghi `notes.md` + `11_decision_log.md` §11.5 (file/LOC sau P2).

## 4.4. Điều kiện qua P2

- `audit/` phẳng (không còn `application/domain/infrastructure/`), arch test MM5' pass cho `audit`.
- MM2 vẫn xanh (import chéo qua `index.ts`).
- `git diff -M` cho thấy schema/repository là rename thuần (không đổi logic).
- Tag: `git tag -a v1.2.0-audit -m "P2 pilot audit Simple"`.

> **Nếu P2 thất bại > 2h:** dừng, giữ `audit` nguyên Hexagonal, ghi nợ vào `notes.md`, vẫn sang P3 với `overview` (template S không phụ thuộc P2 phải hoàn hảo).
