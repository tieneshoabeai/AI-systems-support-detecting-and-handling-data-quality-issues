# Module `auth` — Xác Thực Và Phiên Đăng Nhập

Cơ chế đăng nhập duy nhất của toàn hệ thống. Sở hữu luồng đăng ký/đăng nhập/làm mới token/đăng xuất, quên/đặt lại/đổi mật khẩu, Google OAuth và quản lý phiên. Không sở hữu danh tính người dùng — mọi tra cứu người dùng và phiên đều ủy quyền qua module `users` bằng hai cổng `AUTH_USER_LOOKUP_PORT` và `AUTH_SESSION_PORT`.

## 1. Vị trí và vai trò

- Đường dẫn: `src/backend/src/modules/auth/`
- Loại kiến trúc: CQRS đầy đủ (domain + application/commands + application/queries + infrastructure + presentation).
- Phụ thuộc: `users` (lookup user/session), `shared` (JWT guard, CASL, Zod pipe,Outbox/event). Không phụ thuộc `workspaces/projects`.
- Module khác dùng lại: không ai gọi trực tiếp handler của `auth`; `users` cung cấp dữ liệu cho `auth` qua adapter.

## 2. Cây thư mục đầy đủ (35 tệp `.ts`)

```text
auth/
├── domain/
│   ├── events/auth-events.ts                      # Định nghĩa sự kiện AUTH_*
│   ├── ports/auth-session.port.ts                 # 5 token PORT + kiểu AuthUserLookup/Session/TokenIssuer/Hasher
│   ├── ports/google-oauth.port.ts                 # GOOGLE_OAUTH_PORT + GoogleProfile
│   └── value-objects/
│       ├── password-policy.vo.ts                  # PASSWORD_MIN/MAX_LENGTH, isPasswordLengthValid
│       └── auth-policy.vo.ts                      # Chính sách phiên (TTL, remember_me)
├── application/
│   ├── commands/ (9 handler)
│   │   ├── register.handler.ts                    # Đăng ký analyst mới
│   │   ├── login.handler.ts                       # Đăng nhập remember_me + rememberMe (deprecated)
│   │   ├── refresh-access-token.handler.ts        # Xoay vòng refresh token
│   │   ├── logout.handler.ts                      # Thu hồi phiên hiện tại
│   │   ├── forgot-password.handler.ts             # Gửi OTP 6 số, TTL 10 phút
│   │   ├── reset-password.handler.ts              # Đặt lại mật khẩu bằng OTP
│   │   ├── change-password.handler.ts             # Đổi mật khẩu, giữ phiên hiện tại
│   │   ├── revoke-session.handler.ts              # Thu hồi phiên theo id
│   │   └── login-with-google.handler.ts           # Đăng nhập bằng Google id_token
│   ├── queries/ (2 handler)
│   │   ├── get-sessions.handler.ts                # Liệt kê phiên đang hoạt động
│   │   └── get-session-by-id.handler.ts           # Chi tiết một phiên
│   ├── admin-bootstrap.service.ts                 # Bootstrap admin từ ADMIN_EMAIL/PASSWORD (idempotent)
│   ├── security-alert.service.ts                  # Gửi cảnh báo đăng nhập lạ
│   └── auth.types.ts                              # Kiểu dùng chung tầng application
├── infrastructure/
│   ├── auth/jwt.strategy.ts                       # PassportStrategy xác thực access token
│   └── security/ (6 adapter)
│       ├── bcrypt-hasher.adapter.ts               # Băm bcrypt 12 vòng
│       ├── env-auth-session-policy.adapter.ts     # Đọc TTL phiên từ env
│       ├── google-oauth.adapter.ts                # Đổi code, xác minh id_token bằng khóa Google
│       ├── jwt-issuer.adapter.ts                  # Ký access/refresh token
│       ├── users-auth-lookup.adapter.ts           # Hiện thực AUTH_USER_LOOKUP_PORT qua users
│       └── users-auth-session.adapter.ts          # Hiện thực AUTH_SESSION_PORT qua users
├── presentation/
│   ├── controllers/auth.controller.ts             # @Controller('auth'), 13 route
│   ├── dtos/ (4 tệp)
│   │   ├── register.dto.ts                        # RegisterSchema
│   │   ├── login.dto.ts                           # LoginSchema (remember_me + rememberMe)
│   │   ├── refresh-token.dto.ts                   # RefreshTokenSchema
│   │   └── password-reset.dto.ts                  # Forgot/Reset/ChangePasswordSchema
│   └── google-redirect.util.ts                    # Dựng URL redirect Google OAuth
├── auth.module.ts                                 # Khai báo module, JwtModule, providers
└── index.ts                                       # Public contract (PORT, handler, sự kiện, VO)
```

## 3. Tầng domain

| Tệp | Nội dung chi tiết |
|---|---|
| `domain/ports/auth-session.port.ts` | 5 token: `AUTH_USER_LOOKUP_PORT`, `AUTH_SESSION_PORT`, `AUTH_TOKEN_ISSUER_PORT`, `AUTH_SESSION_POLICY_PORT`, `PASSWORD_HASHER_PORT`. Kiểu `AuthUserLookup`, `AuthSessionRecord` (id, userId, tokenHash, expiresAt, device, ip), `AuthTokenPayload` (sub, sessionId), `PasswordHasherPort` (hash/compare). |
| `domain/ports/google-oauth.port.ts` | `GoogleOAuthPort` (getAuthUrl, exchangeCode, verifyIdToken), `GoogleProfile` (sub, email, name). |
| `domain/value-objects/password-policy.vo.ts` | `PASSWORD_MIN_LENGTH`, `PASSWORD_MAX_LENGTH`, `isPasswordLengthValid`. Mật khẩu yếu bị từ chối ở Zod DTO trước khi vào handler. |
| `domain/value-objects/auth-policy.vo.ts` | Thời sống phiên thường và phiên `remember_me` dài ngày, chính sách thu hồi. |
| `domain/events/auth-events.ts` | `AUTH_EVENTS` (REGISTERED, LOGGED_IN, LOGGED_OUT, PASSWORD_CHANGED...), dùng cho audit và cảnh báo bảo mật. |

## 4. Tầng application — 9 lệnh, 2 truy vấn

| Handler | Việc làm chi tiết |
|---|---|
| `RegisterHandler` | Chỉ tạo vai trò `analyst`, không nhận `role` từ client. Băm mật khẩu, tạo user qua `users`, ghi audit, trả user an toàn (không hash). |
| `LoginHandler` | Nhận `email + password + remember_me` (chuẩn) và bí danh cũ `rememberMe` (tương thích ngược). Xác minh bcrypt, kiểm tra `status` (block/soft-delete thì chặn), tạo session + refresh token 40 byte ngẫu nhiên, chỉ lưu SHA-256. |
| `RefreshAccessTokenHandler` | Nhận refresh token, băm SHA-256 rồi tìm session, kiểm tra `expires_at` trong `user_sessions` (nguồn thật, không phải `exp` JWT), xoay vòng: cấp cặp token mới, vô hiệu token cũ. |
| `LogoutHandler` | Thu hồi phiên hiện hành (lấy `sessionId` từ access token). |
| `ForgotPasswordHandler` | Luôn trả thông điệp trung lập (không xác nhận email tồn tại). Sinh OTP 6 số, TTL 10 phút, gửi qua email adapter. |
| `ResetPasswordHandler` | Kiểm tra OTP, đặt mật khẩu mới, thu hồi toàn bộ phiên của user. |
| `ChangePasswordHandler` | Yêu cầu JWT. Kiểm tra mật khẩu cũ, đặt mật khẩu mới, thu hồi các phiên khác, giữ phiên hiện tại. |
| `RevokeSessionHandler` | Thu hồi một phiên theo id, chỉ cho chính chủ. |
| `LoginWithGoogleHandler` | Nhận `id_token/code`, xác minh chữ ký bằng khóa công khai Google, lấy `sub` làm `google_id`, liên kết/tạo user, tạo session như login thường. |
| `GetSessionsHandler` | Liệt kê phiên đang hoạt động của chính user. |
| `GetSessionByIdHandler` | Chi tiết một phiên, kiểm tra sở hữu. |
| `AdminBootstrapService` | Khởi tạo admin một lần từ `ADMIN_EMAIL/PASSWORD`, idempotent, không ghi đè nếu đã tồn tại. |
| `SecurityAlertService` | Gửi email cảnh báo khi phát hiện thiết bị/IP lạ. |

## 5. Tầng infrastructure

| Adapter | Vai trò |
|---|---|
| `JwtStrategy` | Trích Bearer token, xác minh bằng `JWT_ACCESS_SECRET`, nạp `CurrentUser` (sub, sessionId, role). Bỏ qua route `@Public()`. |
| `BcryptHasherAdapter` | `hash/compare` với `SALT_ROUNDS=12`. |
| `JwtIssuerAdapter` | Ký access token ngắn hạn và refresh token dài hạn. |
| `UsersAuthLookupAdapter` | Tìm user theo email/id qua `USER_REPOSITORY_PORT`. |
| `UsersAuthSessionAdapter` | Tạo/tìm/thu hồi session trong `user_sessions`. |
| `EnvAuthSessionPolicyAdapter` | Đọc TTL phiên thường/dài ngày từ biến môi trường. |
| `GoogleOAuthAdapter` | Dựng URL OAuth (PKCE + state), đổi code, xác minh `id_token`. Cần đủ 3 biến `GOOGLE_CLIENT_ID/SECRET/REDIRECT_URI`, thiếu thì route trả 501. |

## 6. Route đầy đủ (`auth.controller.ts`, prefix `auth`)

| Phương thức | Đường dẫn đầy đủ | Bảo vệ | Mô tả |
|---|---|---|---|
| POST | `/api/v1/auth/register` | `@Public()` | Đăng ký analyst mới (F1.1). |
| POST | `/api/v1/auth/login` | `@Public()` | Đăng nhập, hỗ trợ `remember_me` + bí danh `rememberMe`. |
| POST | `/api/v1/auth/refresh` | `@Public()` | Cấp access token mới bằng refresh token (F1.3). |
| POST | `/api/v1/auth/forgot-password` | `@Public()` | Gửi OTP 6 số, TTL 10 phút (AUTH-05). |
| POST | `/api/v1/auth/reset-password` | `@Public()` | Đặt lại mật khẩu bằng OTP (AUTH-06). |
| POST | `/api/v1/auth/change-password` | JWT + throttle 500/giờ | Đổi mật khẩu, giữ phiên hiện tại (AUTH-07). |
| GET | `/api/v1/auth/google` | `@Public()` | Chuyển hướng tới Google; thiếu cấu hình trả 501. |
| GET | `/api/v1/auth/google/callback` | `@Public()` | Đổi mã lấy token, đối chiếu cookie `google_oauth_state` (cần `cookie-parser`). |
| POST | `/api/v1/auth/logout` | JWT | Thu hồi phiên hiện hành (F1.4). |
| GET | `/api/v1/auth/sessions` | JWT | Danh sách phiên đang hoạt động (F1.8). |
| GET | `/api/v1/auth/sessions/me` | JWT | Phiên hiện tại (lấy `sessionId` từ token). **Khai báo trước `/:id` để không bị nuốt route.** |
| GET | `/api/v1/auth/sessions/:id` | JWT | Chi tiết một phiên của chính user. |
| DELETE | `/api/v1/auth/sessions/:id` | JWT | Thu hồi phiên từ xa (F1.10). |

## 7. Bất biến quan trọng

- Refresh token là chuỗi ngẫu nhiên 40 byte, chỉ lưu SHA-256 trong DB; nguồn hết hạn thật là `user_sessions.expires_at`.
- `passwordHash` đặt `select: false`, không bao giờ trả qua API.
- Không có endpoint tự phong admin; admin chỉ sinh bằng bootstrap.
- `rememberMe` là bí danh cũ, vẫn chấp nhận để tương thích ngược nhưng tài liệu chuẩn là `remember_me`.
- Đổi/đặt lại mật khẩu thu hồi toàn bộ phiên (trừ phiên hiện tại khi đổi).
- Block/soft-delete chặn đăng nhập ngay ở bước lookup.

## 8. Test liên quan

`test/unit/auth/` (`auth-admin-bootstrap`, `step6-google-oauth`), `test/e2e/auth-flow.e2e-spec.ts`, `test/e2e/security/google-oauth*.e2e-spec.ts`.
