# MODULE `audit` - Nhat ky kiem toan

> **Module Specification & Documentation**

## 1. Thong tin Phien ban (Version Information)

- **Current Version:** v1.1.0
- **Last Updated:** 2026-11-21
- **Module Path:** `src/backend/src/modules/audit` (8 file TypeScript)
- **Architecture Layer:** Clean Architecture 4 tang (`domain` -> `application` -> `infrastructure` -> `presentation`)
- **Layer Rules:** CA1-CA14 - xem [`../README.md`](../README.md)

## 2. Muc dich & Pham vi Nghiep vu (Scope & Responsibility)

Module ghi lai **moi thao tac nhay cam** vao mot nhat ky append-only: ai, lam gi, luc nao, tren tai nguyen nao, ket qua ra sao.

> **Nguyen tac:** nhat ky kiem toan **khong bao gio** duoc sua hoac xoa. Khong co API cap nhat hay xoa nhat ky.

### 2.1. Tinh nang thuoc pham vi

| Chuc nang | Noi dung |
|---|---|
| Ghi nhat ky | Ghi hanh dong cua nguoi dung / he thong |
| Truy van | Doc nhat ky theo tieu chi loc (admin) |

### 2.2. Cau truc thu muc

```text
audit/
|-- application/commands/log.handler.ts
|-- domain/ports/
|   |-- audit-logger.port.ts       # AUDIT_LOGGER_PORT
|   `-- audit.repository.port.ts   # port ghi + doc
|-- infrastructure/
|   |-- adapters/audit-logger.adapter.ts
|   `-- persistence/
|       |-- audit-log.schema.ts
|       `-- audit.repository.ts
`-- audit.module.ts
```

## 3. Nhat ky Prompting & Quyet dinh Ky thuat (Prompting Log & Rationale)

- **User Prompt / Business Intent:** Dam bao moi thao tac nhay cam deu **truy vet duoc**, va viec ghi nhat ky khong duoc lam hong luong nghiep vu chinh.

- **Technical Reasoning & Decisions:**

1. **Hai port tach biet.** `AuditLogger` (dung cho module khac) va `AuditRepository` (dung cho tang presentation). Port `AuditLogger` nam o **domain** - bat ky module nao cung ghi nhat ky ma khong can biet MongoDB.

2. **Facade port de tranh phu thuoc truc tiep.** Controller cua module khac **khong** import truc tiep `AuditService` cua module `audit`. Module `audit` **so huu** hop dong nay, export qua `modules/audit/index.ts` (public contract) va bind token toi `AuditService` trong `AuditModule`. Cach nay giu ranh gi giua cac module ma van dung DI.

3. **Ghi nhat ky la best-effort.** `log(input, changes)` nem loi duoc bat va ghi lai, **khong** nem ra ngoai. Mot loi ghi nhat ky khong duoc lam mat hanh dong cua nguoi dung (vi du: dang nhap van thanh cong du audit log that bai).

4. **Chi co duong ghi.** `AuditLogger` chi co `log(...)` - khong mo repository cho doc. Truy van chi qua `AuditRepository` (tang presentation, phia admin).

5. **Append-only thuan.** Collection khong co `deleted_at`, khong co `updated_at`. Khong co API cap nhat hay xoa nhat ky.

- **Generated / Modified Artifacts:**

- `domain/ports/audit-logger.port.ts` - `AUDIT_LOGGER_PORT` (`Symbol`), interface `AuditLoggerPort` voi method `log(input, changes?)`.
- `domain/ports/audit.repository.port.ts` - `CreateAuditLogInput`, `AuditChangeInput`.
- `infrastructure/adapters/audit-logger.adapter.ts` - hien thuc port, bat loi.
- `infrastructure/persistence/audit-log.schema.ts` - schema MongoDB + 2 chi muc.
- `application/commands/log.handler.ts` - xu ly ghi nhat ky.

## 4. Dac ta Giao tiep Ky thuat (Technical Contracts & API Specifications)

### 4.1. Endpoints

Module audit **khong co controller HTTP** — khong ton tai route nao tren `/api/v1/audit/*`.

| Giao dien | Hinh thuc | Mo ta |
|---|---|---|
| `AUDIT_LOGGER_PORT.log(...)` | Port (noi bo) | Module khac ghi nhat ky qua port token, **khong** qua HTTP |
| `AuditRepositoryPort.findLogs(...)` | Port (noi bo) | Truy van nhat ky cho code noi bo / bao cao |

> **Luu y:** bang trong ban "Dac ta" cua hop dong §3.13 cung khong co route `/audit/logs` — 84 route
> hien hanh khong bao gom audit. Truy van nhat ky cho quan tri chua duoc mo route HTTP; neu can,
> se phai them controller + policy `@Roles('admin')` va dong bo lai hop dong.

### 4.2. Interfaces / Providers duoc export ra ngoai

`src/backend/src/modules/audit/index.ts` export public contract:

| Export | Vai tro |
|---|---|
| `AuditModule` | Nest module |
| `AUDIT_LOGGER_PORT` | Port ghi nhat ky (dung boi module khac) |
| `AuditLoggerPort` | Interface ghi nhat ky |

### 4.3. Su kien domain phat ra

> Module nay **khong phat su kien**. No **ghi** nhat ky ve cac su kien cua module khac.

## 5. Rang buoc & Tieu chuan Bat bien (Invariants & Security Rules)

### 5.1. Bat bien nghiep vu

| Truong | Bat buoc |
|---|---|
| `userId` | `null` cho hanh dong he thong |
| `action` | Khong rong |
| `entityType` | Khong rong |
| `createdAt` | Tu dong |
| `expiresAt` | Cho phep null (luu lau dai) |

- Moi ban ghi co `created_at` - **khong** co `updated_at`.
- Moi ban ghi co `expires_at` - cho phep xoa theo quy tac bao luu (tu dong phoi cho phan quyen doc, khong phai xoa thu cong).
- `targetLabel` toi da 200 ky tu; `ipAddress` toi da 45; `userAgent` toi da 500.
- Khong co API sua hoac xoa nhat ky.
- Ghi nhat ky **khong** duoc lam hong luong nghiep vu chinh.

### 5.2. Xoa mem (Soft Delete)

- **Chuan:** `deleted_at: Date | null` - truong nay **null** nghia la ban ghi dang hoat dong.
- **Quy tac truy van:** moi truy van mac dinh luon loc `deleted_at: null`. Repository base (`shared/infrastructure/database/base-mongo.repository.ts`) ap dung dieu nay tu dong.
- **Choi index Partial Unique:** `partialFilterExpression: { deleted_at: null }` - cho phep tai khoan / ten / email da xoa mem duoc tao lai.

### 5.3. Bao mat

| Van de | Cach xu ly |
|---|---|
| Doi tien nhat ky de che dau | Append-only, khong co API sua / xoa |
| Loi audit lam mat hanh dong | `log()` bat loi, ghi lai, khong nem ra ngoai |
| Xoa nhat ky thu cong | Khong co duong xoa thu cong; chi tu dong theo `expires_at` |
| Rò PII trong nhat ky | Chi luu id, loai, nhan, metadata; khong luu gia tri du lieu nghiep vu |
| Truy van nhat ky khong phai admin | Chua mo route HTTP; khi mo route moi phai gan `@Roles('admin')` |
| Truy van cham tren nhat ky lon | Chi muc `{ actor_id, created_at }` va `{ target_type, target_id, created_at }` |

### 5.4. Phan quyen

Module nay **khong co route HTTP**, nen khong co bang phan quyen theo route.
Quyen duoc ap dung o tang ghi:

| Giao dien | Chinh sach |
|---|---|
| `AUDIT_LOGGER_PORT` | Chi module trong he thong moi goi duoc (qua DI token, khong phai HTTP) |
| Truy van nhat ky | Chua mo route; neu mo phai co `@Roles('admin')` + audit log cho ban ghi doc |

## 6. Lich su Thay doi (Change Log & Version History)

### 2026-11-21
- **v1.1.0** / 2026-11-21 / Viet lai README module day du theo chuan 6 phan / Yeu cau tai doc / Tai lieu mau chuan

### 2026-11-XX
- **v1.0.0** / 2026-11-XX / Bo sung `AUDIT_LOGGER_PORT` va `audit-logger.adapter.ts` best-effort / Module khac ghi nhat ky ma khong phu thuoc truc tiep / `modules/audit`
- **v0.5.0** / 2026-11-XX / Bo sung `expires_at` va chi muc theo actor / theo target / Truy van nhat ky tren quy mo khong cham / `modules/audit`
- **v0.1.0** / 2026-11-XX / Tao module / Truy vet thao tac nhay cam / `modules/audit`

- **Dinh dang:** `[Version] / [Ngay] / [Thay doi gi] / [Ly do] / [Anh huong den dau]`
