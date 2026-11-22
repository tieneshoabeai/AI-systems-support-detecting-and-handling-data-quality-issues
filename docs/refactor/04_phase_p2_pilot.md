# 4. Phase P2 — PILOT: module `audit` (2 giờ)

> **Đây là phase quan trọng nhất của toàn bộ kịch bản.**
> Nó tạo ra **template** mà 13 module còn lại sẽ copy. Nếu pilot sai, cả 13 module sai.
>
> **Thời gian:** 2 giờ · **Rủi ro:** rất thấp (module nhỏ nhất: 8 file, 353 LOC)

---

## 4.1. Vì sao chọn `audit` làm pilot?

| Tiêu chí | `audit` |
|---|---|
| Số file | **8** (nhỏ nhất) |
| LOC | **353** (nhỏ nhất) |
| Handler | **1** (`LogHandler`) |
| Có HTTP controller? | ❌ **Không** — chỉ là facade nội bộ |
| Có DB schema? | ✅ 1 file |
| Có outbox/transaction? | ❌ Không |
| Có policy? | ❌ Không |
| Rủi ro logic | **Cực thấp** |

> Nếu pilot này thất bại, bạn mất 2 giờ. Nếu bỏ qua pilot và làm thẳng `analysis`, bạn mất cả ngày.

---

## 4.2. Cấu trúc hiện tại của `audit`

```
src/modules/audit/
├── application/commands/log.handler.ts          # LogHandler — 1 handler
├── audit.module.ts                              # DI wiring
├── domain/ports/audit-logger.port.ts            # AUDIT_LOGGER_PORT + interface
├── domain/ports/audit.repository.port.ts        # AUDIT_REPOSITORY_PORT + types
├── index.ts                                     # public contract
├── infrastructure/adapters/audit-logger.adapter.ts  # AuditLoggerAdapter
├── infrastructure/persistence/audit-log.schema.ts
├── infrastructure/persistence/audit.repository.ts
└── README.md
```

---

## 4.3. Cấu trúc đích

```
src/modules/audit/
├── audit.module.ts          ← GIỮ NGUYÊN (chỉ sửa import)
├── audit.repository.ts      ← từ infrastructure/persistence/audit.repository.ts
├── audit.schema.ts          ← từ infrastructure/persistence/audit-log.schema.ts
├── audit.types.ts           ← từ domain/ports/audit.repository.port.ts (types + port token)
├── audit.service.ts         ← LogHandler + AuditLoggerAdapter GỘP LẠI
├── index.ts                 ← GIỮ NGUYÊN (public contract)
└── README.md                ← cập nhật
```

**Kết quả:** 8 file → 7 file, **4 tầng → 0 tầng**.

---

## 4.4. Các bước thực hiện

### Bước 1 — `git mv` (5 phút)

```bash
cd src/backend/src/modules/audit
mkdir -p _tmp

git mv domain/ports/audit.repository.port.ts       _tmp/audit.types.ts
git mv infrastructure/persistence/audit.repository.ts _tmp/audit.repository.ts
git mv infrastructure/persistence/audit-log.schema.ts  _tmp/audit.schema.ts

# xem trước khi xóa thư mục
git mv application/commands/log.handler.ts         _tmp/audit.service.ts
git mv infrastructure/adapters/audit-logger.adapter.ts _tmp/_adapter.ts
git mv domain/ports/audit-logger.port.ts            _tmp/audit-logger.port.ts
```

### Bước 2 — Viết lại `audit.types.ts` (20 phút)

Gộp 2 file port cũ. Nội dung:

```ts
/**
 * AUDIT — Kiểu dữ liệu & hợp đồng repository.
 *
 * Trước đây: `domain/ports/audit.repository.port.ts` + `domain/ports/audit-logger.port.ts`.
 * Nay: gộp vào 1 file — module là vertical slice phẳng.
 */

// ── Token & interface cho repository ──────────────────────────────────────
export const AUDIT_REPOSITORY_PORT = Symbol('AuditRepositoryPort');

export interface CreateAuditLogInput {
  actor_user_id?: string | null;
  workspace_id?: string | null;
  entity_type: string;
  entity_id: string;
  action: string;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
  metadata?: Record<string, unknown> | null;
}

export interface AuditChangeInput {
  field: string;
  old_value?: unknown;
  new_value?: unknown;
}

export interface AuditRepositoryPort {
  createLog(
    input: CreateAuditLogInput,
    changes?: AuditChangeInput[],
  ): Promise<void>;
}

// ── Facade port cho module khác ──────────────────────────────────────────
export const AUDIT_LOGGER_PORT = Symbol('AuditLoggerPort');

export interface AuditLoggerPort {
  /** Ghi một dòng audit log (best-effort). */
  log(input: CreateAuditLogInput, changes?: AuditChangeInput[]): Promise<void>;
}
```

> **Giữ nguyên chữ ký & tên type** — module khác đang import chúng.

### Bước 3 — Viết lại `audit.service.ts` (30 phút)

Gộp `LogHandler` + `AuditLoggerAdapter`:

```ts
/**
 * AUDIT — Service ghi audit log.
 *
 * Trước đây: `application/commands/log.handler.ts` (`LogHandler`)
 * + `infrastructure/adapters/audit-logger.adapter.ts` (`AuditLoggerAdapter`).
 * Nay: 1 class duy nhất, cài đặt cả `AuditLoggerPort`.
 *
 * **OPEN-09 — audit log là BEST-EFFORT (khác outbox).** Lý do:
 * 1. Audit log được ghi ở *sau khi* mutation đã commit ⇒ không thể rollback.
 * 2. Ghi audit thất bại ⇒ báo lỗi cho người dùng gây hiểu nhầm.
 *
 * Lỗi vẫn được log lại để cảnh báo vận hành.
 */
import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  AUDIT_REPOSITORY_PORT,
  type AuditChangeInput,
  type AuditLoggerPort,
  type AuditRepositoryPort,
  type CreateAuditLogInput,
} from './audit.types';

@Injectable()
export class AuditService implements AuditLoggerPort {
  private readonly logger = new Logger(AuditService.name);

  constructor(
    @Inject(AUDIT_REPOSITORY_PORT)
    private readonly repo: AuditRepositoryPort,
  ) {}

  /** Ghi audit log — best-effort, không ném lỗi ra ngoài. */
  async log(input: CreateAuditLogInput, changes?: AuditChangeInput[]): Promise<void> {
    try {
      await this.repo.createLog(input, changes);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Ghi audit log that bai (best-effort): ${msg}`);
    }
  }
}
```

> **Lưu ý quan trọng:** `LogHandler.execute(input, changes)` → `AuditService.log(input, changes)`.
> Tên method đổi từ `execute` → `log` để khớp với `AuditLoggerPort`. Nếu muốn giữ `execute`, dùng `execute` làm method chính và `log` là alias — xem §4.5.

### Bước 4 — Sửa `audit.repository.ts` & `audit.schema.ts` (15 phút)

Chỉ sửa import path:
```ts
// audit.repository.ts
import { ..., type AuditRepositoryPort } from './audit.types';   // thay vì domain/ports/...
// audit.schema.ts
import { ..., type CreateAuditLogInput } from './audit.types';
```

### Bước 5 — Sửa `audit.module.ts` (15 phút)

```ts
// Trước
import { LogHandler } from './application/commands/log.handler';
import { AuditLoggerAdapter } from './infrastructure/adapters/audit-logger.adapter';
import { AUDIT_LOGGER_PORT } from './domain/ports/audit-logger.port';

// Sau
import { AuditService } from './audit.service';
import { AUDIT_LOGGER_PORT } from './audit.types';
```

Đăng ký provider:
```ts
providers: [
  AuditService,
  { provide: AUDIT_LOGGER_PORT, useExisting: AuditService },
]
```

### Bước 6 — Sửa `index.ts` (10 phút)

```ts
// Trước
export { LogHandler } from './application/commands/log.handler';
export { AuditLoggerAdapter } from './infrastructure/adapters/audit-logger.adapter';
export { AUDIT_LOGGER_PORT, type AuditLoggerPort } from './domain/ports/audit-logger.port';
export { AUDIT_REPOSITORY_PORT, ... } from './domain/ports/audit.repository.port';

// Sau
export { AuditService } from './audit.service';
export {
  AUDIT_LOGGER_PORT,
  AUDIT_REPOSITORY_PORT,
  type AuditLoggerPort,
  type AuditRepositoryPort,
  type CreateAuditLogInput,
  type AuditChangeInput,
} from './audit.types';
```

### Bước 7 — Xóa thư mục rỗng + fix import toàn repo (20 phút)

```bash
cd src/backend
rm -rf src/modules/audit/_tmp
rm -rf src/modules/audit/domain src/modules/audit/application src/modules/audit/infrastructure

# Tìm nơi import LogHandler / AuditLoggerAdapter
grep -rn "LogHandler\|AuditLoggerAdapter" src/ test/
```

**Kết quả mong đợi:** các import đó chỉ nằm trong `audit.module.ts` và `index.ts` (đã sửa ở Bước 5–6) → **không còn import nào ở module khác**.

> Nếu có module khác import `LogHandler` → đó là vi phạm MM2 đã tồn tại. Ghi vào `notes.md` và xử lý.

### Bước 8 — Chạy cổng kiểm soát (20 phút)

```bash
cd src/backend
pnpm type-check
pnpm lint
pnpm exec jest --maxWorkers=2 --testPathPatterns 'audit|modular-monolith'
pnpm arch:api-coverage
```

### Bước 9 — Commit + tag (5 phút)

```bash
git add -A
git commit -m "refactor(audit): flatten module sang vertical slice

- domain/ports/audit.repository.port.ts + audit-logger.port.ts -> audit.types.ts
- application/commands/log.handler.ts + infrastructure/adapters/audit-logger.adapter.ts -> audit.service.ts
- infrastructure/persistence/* -> audit.repository.ts + audit.schema.ts
- LogHandler.execute -> AuditService.log (implement AuditLoggerPort)
- Hanh vi ben ngoi khong doi."
git tag -a v1.2.0-p2-pilot -m "Pilot: module audit"
```

---

## 4.5. Quyết định thiết kế: giữ `execute()` hay đổi thành `log()`?

Module `audit` là **đặc biệt**: nó được module khác gọi qua `AUDIT_LOGGER_PORT` có method `log()`.

| Lựa chọn | Ưu | Nhược |
|---|---|---|
| **Đổi `execute` → `log`** | Đồng nhất với port, 1 tên gọi | Phải sửa nơi gọi (đã kiểm tra: không có nơi gọi trực tiếp) |
| **Giữ `execute`, thêm `log` làm alias** | Không phá vỡ gì | 2 tên cho 1 việc — xấu cho người mới |

> **Chọn: đổi thành `log()`.** Module `audit` là nơi duy nhất có port facade, nên đây là điểm lệch duy nhất — xử lý ngay tại pilot là hợp lý.

**Quy tắc chung cho 13 module còn lại:** giữ nguyên tên method `execute()` cho command/query, vì:
- Test hiện tại gọi `handler.execute(...)` — đổi tên = sửa test = rủi ro
- `execute()` là quy ước nhất quán cho command/query → người mới dễ học

---

## 4.6. Checklist nghiệm thu P2

| # | Hạng mục | ✓ |
|---|---|---|
| 1 | `src/modules/audit/` **không còn thư mục con** (trừ `assets/`) | ☐ |
| 2 | `audit.types.ts` chứa cả `AUDIT_REPOSITORY_PORT` + `AUDIT_LOGGER_PORT` | ☐ |
| 3 | `audit.service.ts` implement `AuditLoggerPort` | ☐ |
| 4 | `index.ts` export đúng public contract | ☐ |
| 5 | `audit.module.ts` provider đúng | ☐ |
| 6 | Không còn import `LogHandler` / `AuditLoggerAdapter` ở đâu | ☐ |
| 7 | `pnpm type-check` → 0 lỗi | ☐ |
| 8 | `pnpm lint` → 0 cảnh báo | ☐ |
| 9 | Unit test audit xanh | ☐ |
| 10 | `pnpm arch:api-coverage` → 84/84 | ☐ |
| 11 | `test/modular-monolith.spec.ts` → MM5 pass | ☐ |
| 12 | Đo lại số liệu, ghi vào `notes.md` | ☐ |
| 13 | Commit + tag `v1.2.0-p2-pilot` | ☐ |

---

## 4.7. Sau pilot — template áp dụng cho 13 module

**Template "module đã flatten"** (đây là thứ bạn copy):

```
src/modules/<ten>/
├── <ten>.module.ts        ← DI wiring (giữ)
├── <ten>.routes.ts        ← controller + DTO (T1/T2)
├── <ten>.service.ts       ← nghiệp vụ
├── <ten>.repository.ts    ← truy vấn DB (nếu có)
├── <ten>.schema.ts        ← Mongoose model (nếu có)
├── <ten>.types.ts         ← type + port token + enum
├── <ten>.events.ts        ← event type (nếu có)
├── <ten>.policy.ts        ← policy loader (nếu có)
├── <ten>.utils.ts         ← util thuần (nếu có)
├── index.ts               ← public contract (giữ)
└── README.md
```

**Checklist áp dụng cho mỗi module P3/P4:**

- [ ] `git mv` từng file, giữ nội dung
- [ ] Gộp file theo bảng quy đổi (`02_inventory_and_metrics.md` §2.4)
- [ ] Giữ nguyên **tên type / tên port token / tên method**
- [ ] Sửa import trong `index.ts` + `<ten>.module.ts`
- [ ] Tìm & sửa import bên ngoài module: `grep -rn "<TênCũ>" src/ test/`
- [ ] `pnpm type-check` → `pnpm lint` → test → `arch:api-coverage`
- [ ] Commit + tag

> **Mẹo:** làm **một module / một commit**. Không gộp 2 module vào 1 commit — khó review, khó rollback.

---

## 4.8. Cổng kiểm soát P2

**Điều kiện qua P2:**
1. `src/modules/audit/` phẳng — 0 thư mục con
2. `pnpm type-check` 0 lỗi
3. `pnpm lint` 0 cảnh báo
4. Unit test xanh (67 suite / 1 069 test)
5. `pnpm arch:api-coverage` → 84 | 84 | 0 | 0
6. `test/modular-monolith.spec.ts` MM5 pass
7. Đã commit + tag `v1.2.0-p2-pilot`

> **Nếu qua được P2 → bạn đã có template. 13 module còn lại chỉ là việc lặp lại.**
> **Nếu không qua được → dừng lại, đọc `09_risk_and_rollback.md`, xem lại phương án B (đóng băng).**
