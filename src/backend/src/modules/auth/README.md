# MÔ-ĐUN `auth` — Xác thực & Phiên đăng nhập

> **Đặc tả mô-đun & Tài liệu kỹ thuật**

## 1. Thông tin phiên bản

- **Phiên bản hiện tại:** v1.1.0
- **Cập nhật lần cuối:** 2026-11-21
- **Đường dẫn mô-đun:** `src/backend/src/modules/auth` (35 tệp TypeScript)
- **Tầng kiến trúc:** Clean Architecture 4 tầng (`domain` → `application` → `infrastructure` → `presentation`)
- **Quy tắc tầng:** CA1–CA14 — xem [`../README.md`](../README.md)

## 2. Mục đích & Phạm vi nghiệp vụ

Mô-đun xử lý toàn bộ **vòng đời xác thực**: đăng ký, đăng nhập, làm mới token, đăng xuất, quên mật khẩu, Google OAuth 2.0 và quản lý phiên.

Mô-đun này **không sở hữu** danh tính người dùng — nó gọi vào mô-đun `users` qua `AUTH_USER_LOOKUP_PORT` / `AUTH_SESSION_PORT` để tạo phiên và kiểm tra tài khoản.

### 2.1. Tính năng thuộc phạm vi

| Chức năng | Nội dung |
|---|---|
| Đăng ký | Tạo tài khoản `analyst` (client không chọn được vai trò) |
| Đăng nhập | Email + mật khẩu, phát hành access + refresh token |
| Làm mới token | Đổi refresh token lấy access token mới |
| Đăng xuất | Thu hồi phiên hiện tại |
| Quên / đặt lại mật khẩu | Gửi email + token đặt lại |
| Đổi mật khẩu | Xác thực mật khẩu cũ, thu hồi các phiên khác |
| Google OAuth 2.0 | Đăng nhập / liên kết tài khoản qua Google (PKCE + state) |
| Quản lý phiên | Xem danh sách phiên, thu hồi theo id |
| Khởi tạo admin | Tạo **một** tài khoản admin lần đầu từ biến môi trường (OPEN-01) |
| Cảnh báo bảo mật | Gửi cảnh báo khi đăng nhập lạ |

### 2.2. Cấu trúc thư mục

```text
auth/
|-- domain/
|   |-- events/auth-events.ts
|   |-- ports/
|   |   |-- auth-session.port.ts     # AUTH_USER_LOOKUP_PORT, PASSWORD_HASHER_PORT, AUTH_SESSION_PORT
|   |   `-- google-oauth.port.ts     # GOOGLE_OAUTH_PORT
|   `-- value-objects/
|       |-- password-policy.vo.ts    # độ dài mật khẩu
|       `-- auth-policy.vo.ts        # TTL token, trạng thái tài khoản
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

## 3. Nhật ký Prompting & Quyết định kỹ thuật

- **Yêu cầu người dùng / Ý đồ nghiệp vụ:** Làm `auth` là **cổng xác thực duy nhất** của hệ thống, bảo đảm mọi đường đăng nhập (cục bộ, refresh, Google OAuth) đều phát ra cùng một dạng **cặp access token + refresh token**, và mọi tra cứu đều quy về một nguồn sự thật duy nhất là collection `user_sessions`.

- **Lập luận kỹ thuật & Quyết định:**

1. **Refresh token KHÔNG phải JWT.** Nó là chuỗi ngẫu nhiên 40 byte, chỉ lưu hash SHA-256. Nhờ vậy hạn thực tế của phiên nằm ở `user_sessions.expires_at` — **nguồn sự thật**, không phải `exp` của JWT. Một JWT refresh có `exp` sẽ không bị thu hồi được ngay khi admin thu hồi phiên.

2. **Không có endpoint tự phong admin.** `POST /auth/register` chỉ tạo tài khoản `analyst` và **không nhận** `role`. Admin được tạo qua biến môi trường `ADMIN_EMAIL` / `ADMIN_PASSWORD` bởi `AdminBootstrapService` (idempotent, không ghi đè mật khẩu đã đặt). Nếu admin tạo được qua API công khai thì bất kỳ ai cũng tự phong mình làm admin.

3. **Dùng bcrypt 12 vòng + `select: false`.** `passwordHash` không bao giờ được MongoDB trả về nếu không yêu cầu `select('+passwordHash')` tường minh. Giảm thiết kế chuẩn bị đọc nhầm.

4. **Google OAuth dùng PKCE + state + xác thực `id_token`.** `state` chống CSRF, PKCE chống đánh cắp code, `id_token` được xác thực bằng khóa công khai của Google chứ không tin payload chưa xác thực. `google_id` lưu `sub` để liên kết tài khoản.

5. **Thu hồi phiên khi đổi mật khẩu.** Đổi mật khẩu phải thu hồi **toàn bộ** phiên, không chỉ phiên hiện tại.

6. **Chống spam quên mật khẩu.** Bộ đếm `password_reset_attempts` + `_sent_count` + `_sent_window_start`, tất cả `select: false`. Hai trường `remember_me` (`rememberMe`) và `rememberMe` trong DTO đăng nhập thực chất là một — giữ tương thích ngược với client cũ, logic chuẩn chỉ đọc `rememberMe`.

- **Hiện vật đã tạo / đã sửa:**

- `domain/value-objects/password-policy.vo.ts` — `PASSWORD_MIN_LENGTH` (8), `PASSWORD_MAX_LENGTH` (100), `assertPasswordLength`.
- `domain/value-objects/auth-policy.vo.ts` — `ACCESS_TOKEN_TTL_SECONDS` (900), `REFRESH_TOKEN_TTL_MS` (7 ngày), `REMEMBER_ME_REFRESH_TOKEN_TTL_MS` (30 ngày), `REFRESH_TOKEN_BYTES` (40).
- `application/admin-bootstrap.service.ts` — `OnModuleInit`, idempotent, không ghi đè mật khẩu.
- `infrastructure/security/bcrypt-hasher.adapter.ts` — `PASSWORD_HASHER_PORT`, 12 vòng.
- `infrastructure/security/google-oauth.adapter.ts` — `GOOGLE_OAUTH_PORT`, PKCE + state, xác thực `id_token`.
- `presentation/controllers/auth.controller.ts` — 13 route, 9 route `@Public()`.

## 4. Đặc tả giao tiếp kỹ thuật

### 4.1. Điểm cuối (Endpoints)

| Phương thức | Đường dẫn | Chính sách | Mô tả |
|---|---|---|---|
| `POST` | `/api/v1/auth/register` | `@Public()` | Đăng ký (chỉ tạo `analyst`) |
| `POST` | `/api/v1/auth/login` | `@Public()` | Đăng nhập email + mật khẩu |
| `POST` | `/api/v1/auth/refresh` | `@Public()` | Làm mới access token |
| `POST` | `/api/v1/auth/logout` | Đăng nhập | Đăng xuất, thu hồi phiên |
| `POST` | `/api/v1/auth/forgot-password` | `@Public()` | Quên mật khẩu |
| `POST` | `/api/v1/auth/reset-password` | `@Public()` | Đặt lại mật khẩu bằng token |
| `POST` | `/api/v1/auth/change-password` | Đăng nhập | Đổi mật khẩu (thu hồi phiên khác) |
| `GET` | `/api/v1/auth/google` | `@Public()` | Bắt đầu luồng Google OAuth |
| `GET` | `/api/v1/auth/google/callback` | `@Public()` | Callback OAuth |
| `GET` | `/api/v1/auth/sessions` | Đăng nhập | Danh sách phiên của tôi |
| `GET` | `/api/v1/auth/sessions/me` | Đăng nhập | Phiên hiện tại |
| `GET` | `/api/v1/auth/sessions/:id` | Đăng nhập | Chi tiết phiên |
| `DELETE` | `/api/v1/auth/sessions/:id` | Đăng nhập | Thu hồi phiên |

> **Thứ tự khai báo route bắt buộc:** `GET /sessions/me` phải khai báo **TRƯỚC** `GET /sessions/:id`. Nếu không, NestJS sẽ khớp chuỗi `"me"` vào `:id` và trả về 404.

### 4.2. Giao diện / Provider được xuất ra ngoài

`src/backend/src/modules/auth/index.ts` xuất hợp đồng công khai:

| Tên xuất | Vai trò |
|---|---|
| `AuthModule` | Mô-đun Nest |
| `AUTH_USER_LOOKUP_PORT` | Cổng tra cứu tài khoản (dùng cho adapter) |
| `PASSWORD_HASHER_PORT` | Cổng băm mật khẩu |
| `AUTH_SESSION_PORT` | Cổng quản lý phiên |
| `GOOGLE_OAUTH_PORT` | Cổng giao tiếp Google |

### 4.3. Sự kiện domain phát ra

| Sự kiện | Khi nào | Mục đích |
|---|---|---|
| `AUTH_LOGIN_SUCCESS` | Đăng nhập thành công | Cảnh báo bảo mật + audit log |
| `AUTH_LOGIN_FAILED` | Đăng nhập thất bại | Chống brute-force + audit log |
| `AUTH_PASSWORD_CHANGED` | Đổi mật khẩu | Thông báo + thu hồi phiên |
| `AUTH_PASSWORD_RESET_REQUESTED` | Quên mật khẩu | Gửi email + audit log |
| `AUTH_PASSWORD_RESET_COMPLETED` | Đặt lại thành công | Audit log + thu hồi phiên |

## 5. Ràng buộc & Tiêu chuẩn bất biến

### 5.1. Bất biến nghiệp vụ

- `POST /auth/register` **luôn** tạo tài khoản `analyst` — không bao giờ tin `role` từ client.
- Admin được tạo **chỉ** qua biến môi trường, tối đa **một** tài khoản, và không ghi đè mật khẩu đã đặt.
- Độ dài mật khẩu: 8 ≤ độ dài ≤ 100.
- Đổi mật khẩu phải thu hồi **toàn bộ** phiên của user.
- Đặt lại mật khẩu phải thu hồi **toàn bộ** phiên của user.
- Người dùng chỉ quản lý được phiên **của chính mình** — không có đường đọc phiên của người khác.
- Refresh token mới được phát **mỗi lần đăng nhập**; phiên cũ lưu hash cũ không bị ghi đè.

### 5.2. Xoá mềm (Soft Delete)

- **Chuẩn:** `deleted_at: Date | null` — trường này **null** nghĩa là bản ghi đang hoạt động.
- **Quy tắc truy vấn:** mọi truy vấn mặc định luôn lọc `deleted_at: null`. Repository nền (`shared/infrastructure/database/base-mongo.repository.ts`) áp dụng điều này tự động.
- **Chơi index Partial Unique:** `partialFilterExpression: { deleted_at: null }` — cho phép tài khoản / tên / email đã xoá mềm được tạo lại.

### 5.3. Bảo mật

| Vấn đề | Cách xử lý |
|---|---|
| Mật khẩu lộ | bcrypt 12 vòng; `passwordHash` `select: false` |
| Refresh token bị lộ | Lưu hash SHA-256, không lưu token thô |
| Leo thang đặc quyền | Register chỉ tạo `analyst`; admin chỉ qua biến môi trường |
| CSRF trên OAuth | `state` + PKCE |
| Token giả mạo | Xác thực `id_token` bằng khóa công khai Google |
| Spam quên mật khẩu | Bộ đếm cửa sổ thời gian + giới hạn số lần gửi |
| Phiên còn sống sau khi đổi mật khẩu | Thu hồi toàn bộ phiên |
| Phát lại refresh token | Token đã dùng bị đánh dấu; hash lưu trong DB |
| Truy cập phiên của người khác | Policy loader kiểm tra `userId` khu vực |

### 5.4. Phân quyền

| Tuyến đường | Chính sách |
|---|---|
| 9 route `@Public()` | `register`, `login`, `refresh`, `forgot-password`, `reset-password`, `google`, `google/callback` |
| `change-password`, `logout`, `sessions*` | Đăng nhập — chỉ phiên của tôi |

> Mô-đun này không trực tiếp dùng CASL theo tài nguyên. Nguồn sự thật phân quyền nằm ở `shared/interfaces/casl/policies.guard.ts` và tài khoản trong `modules/users`.

## 6. Lịch sử thay đổi

### 2026-11-21
- **v1.1.0** / 2026-11-21 / Viết lại README mô-đun đầy đủ theo chuẩn 6 phần / Yêu cầu tái đọc / Tài liệu mẫu chuẩn

### 2026-11-XX
- **v1.0.0** / 2026-11-XX / Bổ sung Google OAuth 2.0 với PKCE + state và xác thực `id_token` / Mở rộng đường đăng nhập, không cần mật khẩu / `modules/auth`, `modules/users`
- **v0.9.0** / 2026-11-XX / Bổ sung `admin-bootstrap.service.ts` idempotent + route `/admin/users` / Quyết định OPEN-01: không có endpoint tự phong admin / `modules/auth`, `modules/users`
- **v0.8.0** / 2026-11-XX / Chuyển refresh token từ JWT sang chuỗi ngẫu nhiên + lưu hash SHA-256 / Hạn thực của phiên phải nằm trong DB để thu hồi được ngay / `modules/auth`
- **v0.5.0** / 2026-11-XX / Bổ sung bộ đếm cửa sổ thời gian cho quên mật khẩu / Chống spam email / `modules/auth`
- **v0.1.0** / 2026-11-XX / Tạo mô-đun xác thực, tách khỏi `users` / Kiến trúc Clean Architecture / `modules/auth`

- **Định dạng:** `[Phiên bản] / [Ngày] / [Thay đổi gì] / [Lý do] / [Ảnh hưởng đến đâu]`
