# MODULE `users` - Users - Tai khoan & Phien dang nhap

> **Module Specification & Documentation**

## 1. Thong tin Phien ban (Version Information)

- **Current Version:** v1.1.0
- **Last Updated:** 2026-11-21
- **Module Path:** `src/backend/src/modules/users` (34 file TypeScript)
- **Architecture Layer:** Clean Architecture 4 tang (`domain` -> `application` -> `infrastructure` -> `presentation`)
- **Layer Rules:** CA1-CA14 - xem [`../README.md`](../README.md)

## 2. Muc dich & Pham vi Nghiep vu (Scope & Responsibility)

Module nay so huu **danh tinh nguoi dung** va **vong doi phien dang nhap**. Day la aggregate root mang tinh bao mat cao nhat trong he thong.

Module `auth` se **goi vao** module nay qua port de tao phien va kiem tra user; module nay **khong** lo xac thuc mat khau hay token (thuoc ve `auth`).

### 2.1. Tinh nang thuoc pham vi

| Chuc nang | Noi dung |
|---|---|
| Ho so nguoi dung | Tao, cap nhat, xoa mem, chan / bo chan |
| Phien dang nhap | Tao phien, cham (touch), thu hoi theo id / toan bo / theo token hash |
| Truy van | Tim theo email, id, phan trang, tim phien theo token hash |
| Thong bao | Cap nhat preferences cua nguoi dung |
| Su kien | Phat `user.created`, `user.blocked`, `user.unblocked`, `user.removed` |

### 2.2. Cau truc thu muc

```text
users/
|-- domain/
|   |-- entities/
|   |   |-- user.entity.ts            # Aggregate root User
|   |   `-- user-session.entity.ts    # Aggregate root UserSession
|   |-- value-objects/
|   |   |-- user-role.vo.ts           # UserRole, UserStatus, normalizeEmail, canUserLogin
|   |   `-- session-policy.vo.ts      # Chinh sach het han phien
|   |-- events/user-events.ts         # USER_EVENTS, USER_OUTBOX_EVENTS
|   `-- ports/user.repository.port.ts
|-- application/
|   |-- commands/                     # 11 command handler
|   |-- queries/                      # 6 query handler
|   `-- services/user-access-revocation.service.ts
|-- infrastructure/persistence/        # user.schema, user-session.schema, repository, mapper
`-- presentation/
    |-- controllers/users.controller.ts
    |-- controllers/admin-users.controller.ts
    |-- dtos/update-user.dto.ts
    `-- responses/user.response.ts
```

## 3. Nhat ky Prompting & Quyet dinh Ky thuat (Prompting Log & Rationale)

- **User Prompt / Business Intent:** Lam `users` la nguon su that duy nhat ve danh tinh nguoi dung va phien dang nhap, de moi module khac deu co the trich xuat `userId` mot cach nhat quan, dong thoi dam bao moi luon co mot `User` hop le.

- **Technical Reasoning & Decisions:**

1. **Tach danh tinh ra khoi xac thuc.** `auth` lo bang chung (mat khau, token, OAuth); `users` lo danh tinh (tai khoan, phien). Hai muc do khac nhau, tach ra de mo rong duong dang OAuth ma khong phai sua lai model nguoi dung.

2. **Bam sat invariant trong entity.** `canUserLogin` chan tai khoan bi chan / da xoa **ngay trong domain**, thay vi de controller phai tu kiem tra. `normalizeEmail` chuan hoa email mot lan duy nhat, o domain, nen moi noi deu dung chung.

3. **Chi luu hash refresh token.** Session luu SHA-256 hash, khong luu token tho. Neu database bi lo, attacker khong the gia lap phien.

4. **Thu hoi realtime ngay lap tuc (OPEN-08).** Khoa tai khoan nhung socket van song la lo hong IDOR qua WebSocket. `UserAccessRevocationService` ghi outbox event, module `realtime` bat va dong socket - tach module de tranh phu thuoc vong tron.

5. **Xoa mem + partial unique index.** Cho phep dang ky lai email da xoa ma van khong trung ten voi tai khoan dang hoat dong.

- **Generated / Modified Artifacts:**

- `domain/entities/user.entity.ts` - aggregate root `User` voi 3 phuong thuc `create` / `reconstitute` / `restore`.
- `domain/value-objects/user-role.vo.ts` - `UserRole`, `UserStatus`, `normalizeEmail`, `canUserLogin`.
- `domain/events/user-events.ts` - `USER_EVENTS` (dot.case) va `USER_OUTBOX_EVENTS` (UPPER_SNAKE).
- `application/services/user-access-revocation.service.ts` - phat `USER_BLOCKED` / `USER_REMOVED` khi khoa / xoa.
- `application/commands/block-user.handler.ts`, `unblock-user.handler.ts`, `soft-delete-user.handler.ts`.
- `presentation/controllers/admin-users.controller.ts` - cac route quan tri co `@Roles('admin')`.

## 4. Dac ta Giao tiep Ky thuat (Technical Contracts & API Specifications)

### 4.1. Endpoints

| Method | Path | Chinh sach | Mo ta |
|---|---|---|---|
| `GET` | `/api/v1/users/me` | Chu user | Ho so cua toi |
| `PATCH` | `/api/v1/users/me` | Chu user | Cap nhat ho so |
| `DELETE` | `/api/v1/users/me` | Chu user | Xoa mem tai khoan cua toi |
| `GET` | `/api/v1/admin/users` | `admin` | Danh sach tai khoan |
| `GET` | `/api/v1/admin/users/:id` | `admin` | Chi tiet tai khoan |

> Cac command handler **khong mo route REST** (goi tu `auth`): `block-user`, `unblock-user`, `revoke-all-user-sessions`, `revoke-session-by-id`, `revoke-session`.

### 4.2. Interfaces / Providers duoc export ra ngoai

`src/backend/src/modules/users/index.ts` export public contract:

| Export | Vai tro |
|---|---|
| `UsersModule` | Nest module |
| `User` entity + `UserRole` / `UserStatus` | Doc contract cua module khac |
| `USER_REPOSITORY_PORT` | Port truy van tai khoan / phien |
| `UserAccessRevocationService` | Phat su kien thu hoi quyen |

### 4.3. Su kien domain phat ra

| Event | Khi nao | Dinh dang |
|---|---|---|
| `user.created` | Dang ky moi | `dot.case` - domain event cua entity |
| `user.blocked` | Admin khoa tai khoan | `dot.case` |
| `user.unblocked` | Admin bo khoa | `dot.case` |
| `user.removed` | Xoa mem | `dot.case` |
| `USER_BLOCKED` | Khoa - kich hoat thu hoi realtime | `UPPER_SNAKE` - outbox event |
| `USER_REMOVED` | Xoa mem - kich hoat thu hoi realtime | `UPPER_SNAKE` - outbox event |

Hai nhom ten cung ton tai co chu dich: `dot.case` la **domain event** cua entity; `UPPER_SNAKE` la **outbox event** ma `EventDispatcherService` va `DomainEventHandlerRegistry` khop theo ten.

## 5. Rang buoc & Tieu chuan Bat bien (Invariants & Security Rules)

### 5.1. Bat bien nghiep vu

- Email chuan hoa (`lowercase` + `trim`) va **duy nhất** trong tai khoan chua xoa mem.
- So dien thoai **duy nhat** neu co gia tri.
- `firstName` / `lastName` <= 50 ky tu; `bio` <= 500 ky tu.
- Chi tai khoan `active` + chua xoa moi dang nhap duoc (`canUserLogin`).
- Xoa mem **phai** thu hoi toan bo phien.
- `passwordHash` la private + `select: false` - khong bao gio duoc loi ra ngoai.

### 5.2. Xoa mem (Soft Delete)

- **Chuan:** `deleted_at: Date | null` - truong nay **null** nghia la ban ghi dang hoat dong.
- **Quy tac truy van:** moi truy van mac dinh luon loc `deleted_at: null`. Repository base (`shared/infrastructure/database/base-mongo.repository.ts`) ap dung dieu nay tu dong.
- **Choi index Partial Unique:** `partialFilterExpression: { deleted_at: null }` - cho phep tai khoan / ten / email da xoa mem duoc tao lai.

### 5.3. Bao mat

| Van de | Cach xu ly |
|---|---|
| Ro mat khau | `passwordHash` private + `select: false`; mapper khong bao gio map ra response |
| Email trung | Chuan hoa truoc khi ghi + partial unique index |
| Dang nhap tai khoan bi khoa | `canUserLogin` chan o entity, khong phai o controller |
| Dang nhap tai khoan da xoa | `canUserLogin` + query loc `deleted_at: null` |
| Token phien bi lo | Chi luu SHA-256 hash |
| Dat lai mat khau bi lam dung | Bo dem cua so thoi gian + gioi han so lan gui |
| Phien con song sau khi khoa | `USER_BLOCKED` / `USER_REMOVED` dong socket tuc thoi |

### 5.4. Phan quyen

| Route | Chinh sach |
|---|---|
| `GET/PATCH/DELETE /users/me` | Chu user dang dang nhap |
| `GET /admin/users`, `GET /admin/users/:id` | `@Roles('admin')` |

**Moi hinh vai tro 3 tang:** he thong (`admin`, `analyst`) -> workspace (`owner`, `member`) -> project (`owner`, `member`, `viewer`). Module nay so huu tang he thong.

## 6. Lich su Thay doi (Change Log & Version History)

### 2026-11-21
- **v1.1.0** / 2026-11-21 / Viet lai README module day du theo chuan 6 phan / Yeu cau tai doc / Tai lieu mau chuan
- **v1.0.0** / 2026-11-XX / Bo sung `UserAccessRevocationService` va `USER_BLOCKED` / `USER_REMOVED` de thu hoi realtime khi khoa / xoa tai khoan (OPEN-08) / Lo hong IDOR qua WebSocket / `modules/users`, `modules/realtime`
- **v0.9.0** / 2026-11-XX / Bo sung `block-user` / `unblock-user` va thu hoi phien toan bo / Chuan bi mat khau / `modules/users`
- **v0.8.0** / 2026-11-XX / Bo sung admin bootstrap (`admin-bootstrap.service.ts`) — tao tai khoan admin **tu dong** khi he thong chua co admin nao / Yeu cau quyet dinh OPEN-01 / `modules/users`, `modules/auth`
- **v0.1.0** / 2026-11-XX / Tao module, tach danh tinh khoi xac thuc / Kien truc Clean Architecture / `modules/users`

- **Dinh dang:** `[Version] / [Ngay] / [Thay doi gi] / [Ly do] / [Anh huong den dau]`
