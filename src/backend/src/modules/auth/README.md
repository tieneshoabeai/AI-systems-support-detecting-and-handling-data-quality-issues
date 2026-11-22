# MODULE `auth` - Auth - Xac thuc & Phien dang nhap

> **Module Specification & Documentation**

## 1. Thong tin Phien ban (Version Information)

- **Current Version:** v1.1.0
- **Last Updated:** 2026-11-21
- **Module Path:** `src/backend/src/modules/auth` (34 file TypeScript)
- **Architecture Layer:** Clean Architecture 4 tang (`domain` -> `application` -> `infrastructure` -> `presentation`)
- **Layer Rules:** CA1-CA14 - xem [`../README.md`](../README.md)

## 2. Muc dich & Pham vi Nghiep vu (Scope & Responsibility)

Module xu ly toan bo **vong doi xac thuc**: dang ky, dang nhap, lam moi token, dang xuat, quen mat khau, Google OAuth 2.0 va quan ly phien.

Module nay **khong so huu** danh tinh nguoi dung - no goi vao module `users` qua `AUTH_USER_LOOKUP_PORT` / `AUTH_SESSION_PORT` de tao phien va kiem tra tai khoan.

### 2.1. Tinh nang thuoc pham vi

| Chuc nang | Noi dung |
|---|---|
| Dang ky | Tao tai khoan `analyst` (client khong chon duoc role) |
| Dang nhap | Email + mat khau, phat access + refresh token |
| Lam moi token | Exchange refresh token -> access token moi |
| Dang xuat | Thu hoi phien hien tai |
| Quen / dat lai mat khau | Gui email + token dat lai |
| Doi mat khau | Xac thuc mat khau cu, thu hoi cac phien khac |
| Google OAuth 2.0 | Dang nhap / lien ket tai khoan qua Google (PKCE + state) |
| Quan ly phien | Xem danh sach phien, thu hoi theo id |
| Admin bootstrap | Tao **mot** tai khoan admin lan dau tu bien moi truong (OPEN-01) |
| Security alert | Gui canh bao khi dang nhap la |

### 2.2. Cau truc thu muc

```text
auth/
|-- domain/
|   |-- events/auth-events.ts
|   |-- ports/
|   |   |-- auth-session.port.ts     # AUTH_USER_LOOKUP_PORT, PASSWORD_HASHER_PORT, AUTH_SESSION_PORT
|   |   `-- google-oauth.port.ts     # GOOGLE_OAUTH_PORT
|   `-- value-objects/
|       |-- password-policy.vo.ts    # do dai mat khau
|       `-- auth-policy.vo.ts        # TTL token, trang thai tai khoan
|-- application/
|   |-- commands/                    # 9 command handler
|   |-- queries/                     # 2 query handler
|   |-- admin-bootstrap.service.ts   # OPEN-01
|   |-- security-alert.service.ts
|   |-- auth.types.ts
|   `-- auth.utils.ts
|-- infrastructure/
|   |-- auth/jwt.strategy.ts         # PassportStrategy
|   `-- security/
|       |-- bcrypt-hasher.adapter.ts
|       |-- env-auth-session-policy.adapter.ts
|       |-- google-oauth.adapter.ts
|       |-- jwt-issuer.adapter.ts
|       |-- users-auth-lookup.adapter.ts
|       `-- users-auth-session.adapter.ts
`-- presentation/
    |-- controllers/auth.controller.ts
    |-- dtos/                        # 4 DTO
    `-- google-redirect.util.ts
```

## 3. Nhat ky Prompting & Quyet dinh Ky thuat (Prompting Log & Rationale)

- **User Prompt / Business Intent:** Lam `auth` la **cong xac thuc duy nhat** cua he thong, bao dam moi duong dang nhap (local, refresh, Google OAuth) deu phat ra cung mot dang **cap access token + refresh token**, va moi tuong lai deu quy ve mot nguon su that duy nhat la collection `user_sessions`.

- **Technical Reasoning & Decisions:**

1. **Refresh token KHONG phai JWT.** No la chuoi ngau nhien 40 byte, chi luu hash SHA-256. Nho vay han thuc te cua phien nam o `user_sessions.expires_at` - **nguon su that**, khong phai `exp` cua JWT. Mot JWT refresh co `exp` se khong bi thu hoi duoc ngay khi admin thu hoi phien.

2. **Khong co endpoint tu phong admin.** `POST /auth/register` chi tao tai khoan `analyst` va **khong nhan** `role`. Admin duoc tao qua bien moi truong `ADMIN_EMAIL` / `ADMIN_PASSWORD` boi `AdminBootstrapService` (idempotent, khong ghi de mat khau da dat). Neu admin tao duoc qua API cong khai -> bat ky ai cung tu phong minh la admin.

3. **Dung bcrypt 12 rounds + `select: false`.** `passwordHash` khong bao gio duoc MongoDB tra ve neu khong yeu cau `select('+passwordHash')` tuong minh. Giam thiet ke chuan bi doc nham.

4. **Google OAuth dung PKCE + state + verify `id_token`.** `state` chong CSRF, PKCE chong code interception, `id_token` duoc xac thuc bang public key cua Google chu khong tin payload ma khong verify. `google_id` luu `sub` de lien ket tai khoan.

5. **Thu hoi phien khi doi mat khau.** Doi mat khau phai thu hoi **toan bo** phien, khong chi phien hien tai.

6. **Chong spam quen mat khau.** Bo dem `password_reset_attempts` + `_sent_count` + `_sent_window_start`, tat ca `select: false`.

- **Generated / Modified Artifacts:**

- `domain/value-objects/password-policy.vo.ts` - `PASSWORD_MIN_LENGTH` (8), `PASSWORD_MAX_LENGTH` (100), `assertPasswordLength`.
- `domain/value-objects/auth-policy.vo.ts` - `ACCESS_TOKEN_TTL_SECONDS` (900), `REFRESH_TOKEN_TTL_MS` (7 ngay), `REMEMBER_ME_REFRESH_TOKEN_TTL_MS` (30 ngay), `REFRESH_TOKEN_BYTES` (40).
- `application/admin-bootstrap.service.ts` - `OnModuleInit`, idempotent, khong ghi de mat khau.
- `infrastructure/security/bcrypt-hasher.adapter.ts` - `PASSWORD_HASHER_PORT`, 12 rounds.
- `infrastructure/security/google-oauth.adapter.ts` - `GOOGLE_OAUTH_PORT`, PKCE + state, verify `id_token`.
- `presentation/controllers/auth.controller.ts` - 13 route, 9 route `@Public()`.

## 4. Dac ta Giao tiep Ky thuat (Technical Contracts & API Specifications)

### 4.1. Endpoints

| Method | Path | Chinh sach | Mo ta |
|---|---|---|---|
| `POST` | `/api/v1/auth/register` | `@Public()` | Dang ky (chi tao `analyst`) |
| `POST` | `/api/v1/auth/login` | `@Public()` | Dang nhap email + mat khau |
| `POST` | `/api/v1/auth/refresh` | `@Public()` | Lam moi access token |
| `POST` | `/api/v1/auth/logout` | Dang nhap | Dang xuat, thu hoi phien |
| `POST` | `/api/v1/auth/forgot-password` | `@Public()` | Quen mat khau |
| `POST` | `/api/v1/auth/reset-password` | `@Public()` | Dat lai mat khau bang token |
| `POST` | `/api/v1/auth/change-password` | Dang nhap | Doi mat khau (thu hoi phien khac) |
| `GET` | `/api/v1/auth/google` | `@Public()` | Bat dau luong Google OAuth |
| `GET` | `/api/v1/auth/google/callback` | `@Public()` | Callback OAuth |
| `GET` | `/api/v1/auth/sessions` | Dang nhap | Danh sach phien cua toi |
| `GET` | `/api/v1/auth/sessions/me` | Dang nhap | Phien hien tai |
| `GET` | `/api/v1/auth/sessions/:id` | Dang nhap | Chi tiet phien |
| `DELETE` | `/api/v1/auth/sessions/:id` | Dang nhap | Thu hoi phien |

> **Thu tu khai bao route bat buoc:** `GET /sessions/me` phai khai bao **TRUOC** `GET /sessions/:id`. Neu khong, NestJS se khop chuoi `"me"` vao `:id` va tra ve 404.

### 4.2. Interfaces / Providers duoc export ra ngoai

`src/backend/src/modules/auth/index.ts` export public contract:

| Export | Vai tro |
|---|---|
| `AuthModule` | Nest module |
| `AUTH_USER_LOOKUP_PORT` | Port tra cuu tai khoan (dung cho adapter) |
| `PASSWORD_HASHER_PORT` | Port bam mat khau |
| `AUTH_SESSION_PORT` | Port quan ly phien |
| `GOOGLE_OAUTH_PORT` | Port giao tiep Google |

### 4.3. Su kien domain phat ra

| Event | Khi nao | Muc dich |
|---|---|---|
| `AUTH_LOGIN_SUCCESS` | Dang nhap thanh cong | Security alert + audit log |
| `AUTH_LOGIN_FAILED` | Dang nhap that bai | Chong bruteforce + audit log |
| `AUTH_PASSWORD_CHANGED` | Doi mat khau | Thong bao + thu hoi phien |
| `AUTH_PASSWORD_RESET_REQUESTED` | Quen mat khau | Gui email + audit log |
| `AUTH_PASSWORD_RESET_COMPLETED` | Dat lai thanh cong | Audit log + thu hoi phien |

## 5. Rang buoc & Tieu chuan Bat bien (Invariants & Security Rules)

### 5.1. Bat bien nghiep vu

- `POST /auth/register` **luon** tao tai khoan `analyst` - khong bao gio tin `role` tu client.
- Admin duoc tao **chi** qua bien moi truong, toi da **mot** tai khoan, va khong ghi de mat khau da dat.
- Do dai mat khau: 8 <= len <= 100.
- Doi mat khau phai thu hoi **toan bo** phien cua user.
- Dat lai mat khau phai thu hoi **toan bo** phien cua user.
- Nguoi dung chi quan ly duoc phien **cua chinh minh** - khong co duong doc phien cua nguoi khac.
- Refresh token moi duoc phat **moi lan dang nhap**; phien cu luu hash cu khong bi ghi de.

### 5.2. Xoa mem (Soft Delete)

- **Chuan:** `deleted_at: Date | null` - truong nay **null** nghia la ban ghi dang hoat dong.
- **Quy tac truy van:** moi truy van mac dinh luon loc `deleted_at: null`. Repository base (`shared/infrastructure/database/base-mongo.repository.ts`) ap dung dieu nay tu dong.
- **Choi index Partial Unique:** `partialFilterExpression: { deleted_at: null }` - cho phep tai khoan / ten / email da xoa mem duoc tao lai.

### 5.3. Bao mat

| Van de | Cach xu ly |
|---|---|
| Mat khau ro | bcrypt 12 rounds; `passwordHash` `select: false` |
| Refresh token bi lo | Luu hash SHA-256, khong luu token tho |
| Privilege escalation | Register chi tao `analyst`; admin chi qua bien moi truong |
| CSRF tren OAuth | `state` + PKCE |
| Token gia mao | Verify `id_token` bang public key Google |
| Spam quen mat khau | Bo dem cua so thoi gian + gioi han so lan gui |
| Phien con song sau khi doi mat khau | Thu hoi toan bo phien |
| Replay refresh token | Token da dung bi danh dau; hash luu trong DB |
| Truy cap phien cua nguoi khac | Policy loader kiem tra `userId` khu vuc |

### 5.4. Phan quyen

| Route | Chinh sach |
|---|---|
| 9 route `@Public()` | `register`, `login`, `refresh`, `forgot-password`, `reset-password`, `google`, `google/callback` |
| `change-password`, `logout`, `sessions*` | Dang nhap - chi phien cua toi |

> Module nay khong truc tiep dung CASL theo resource. Nguon su that phan quyen nam o `shared/interfaces/casl/policies.guard.ts` va tai khoan trong `modules/users`.

## 6. Lich su Thay doi (Change Log & Version History)

### 2026-11-21
- **v1.1.0** / 2026-11-21 / Viet lai README module day du theo chuan 6 phan / Yeu cau tai doc / Tai lieu mau chuan

### 2026-11-XX
- **v1.0.0** / 2026-11-XX / Bo sung Google OAuth 2.0 voi PKCE + state va verify `id_token` / Mo rong duong dang nhap, khong can mat khau / `modules/auth`, `modules/users`
- **v0.9.0** / 2026-11-XX / Bo sung `admin-bootstrap.service.ts` idempotent + route `/admin/users` / Quyet dinh OPEN-01: khong co endpoint tu phong admin / `modules/auth`, `modules/users`
- **v0.8.0** / 2026-11-XX / Chuyen refresh token tu JWT sang chuoi ngau nhien + luu hash SHA-256 / Han thuc phien phai nam trong DB de thu hoi duoc ngay / `modules/auth`
- **v0.5.0** / 2026-11-XX / Bo sung bo dem cua so thoi gian cho quen mat khau / Chong spam email / `modules/auth`
- **v0.1.0** / 2026-11-XX / Tao module xac thuc, tach khoi `users` / Kien truc Clean Architecture / `modules/auth`

- **Dinh dang:** `[Version] / [Ngay] / [Thay doi gi] / [Ly do] / [Anh huong den dau]`
