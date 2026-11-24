# Module `users` — Hồ Sơ, Phiên, Quản Trị

Sở hữu danh tính người dùng và collection `user_sessions`. Là nguồn thật cho `auth` tra cứu. Cung cấp API hồ sơ cá nhân (`/users/me`) và API quản trị (`/admin/users`, phân trang keyset cursor).

## 1. Vị trí và vai trò

- Đường dẫn: `src/backend/src/modules/users/`
- Loại kiến trúc: CQRS đầy đủ, 34 tệp `.ts`.
- Sở hữu: collection `users` + `user_sessions`.
- Được dùng bởi: `auth` (qua `AUTH_USER_LOOKUP_PORT`, `AUTH_SESSION_PORT`), `workspaces/projects` (lấy tên user), `overview` (đếm user).

## 2. Cây thư mục đầy đủ

```text
users/
├── domain/
│   ├── entities/user.entity.ts                    # User (email duy nhất, role, status, googleId)
│   ├── entities/user-session.entity.ts            # UserSession (tokenHash, expiresAt, device, ip)
│   ├── value-objects/user-role.vo.ts              # USER_ROLES, USER_STATUSES, canUserLogin, normalizeEmail
│   ├── value-objects/session-policy.vo.ts         # TTL phiên, quy tắc remember_me
│   ├── events/user-events.ts                      # USER_EVENTS, USER_OUTBOX_EVENTS
│   └── ports/user.repository.port.ts              # USER_REPOSITORY_PORT + kiểu Create/Update/Query
├── application/
│   ├── commands/ (11)
│   │   ├── create-user.handler.ts                 # Tạo user (dùng cho register + Google + bootstrap)
│   │   ├── create-session.handler.ts              # Tạo phiên (lưu hash refresh token)
│   │   ├── update-profile.handler.ts              # Đổi tên, số điện thoại, bio
│   │   ├── update-notification-preferences.handler.ts # Bật/tắt nhận thông báo
│   │   ├── touch-session.handler.ts               # Cập nhật lần hoạt động cuối
│   │   ├── revoke-session.handler.ts              # Thu hồi phiên hiện tại
│   │   ├── revoke-session-by-id.handler.ts       # Thu hồi một phiên theo id
│   │   ├── revoke-all-user-sessions.handler.ts   # Thu hồi toàn bộ phiên (đổi/quên mật khẩu)
│   │   ├── soft-delete-user.handler.ts            # Xóa mềm tài khoản
│   │   ├── block-user.handler.ts / unblock-user.handler.ts # Khóa/mở khóa (admin)
│   ├── queries/ (6)
│   │   ├── find-by-id.handler.ts / find-by-email.handler.ts
│   │   ├── find-paged.handler.ts                  # Phân trang keyset cho admin
│   │   ├── find-active-sessions.handler.ts        # Phiên còn hiệu lực
│   │   ├── find-session-by-id.handler.ts / find-session-by-token-hash.handler.ts
│   └── services/user-access-revocation.service.ts # Thu hồi quyền truy cập khi block/xóa
├── infrastructure/persistence/
│   ├── user.schema.ts                             # Schema User (email unique, passwordHash select:false)
│   ├── user-session.schema.ts                     # Schema UserSession (tokenHash index, expires_at)
│   ├── user.mapper.ts                             # Map Mongoose <-> entity/record
│   └── users.repository.ts                        # Hiện thực USER_REPOSITORY_PORT
├── presentation/
│   ├── controllers/users.controller.ts            # @Controller('users'), 3 route /me
│   ├── controllers/admin-users.controller.ts      # @Controller('admin/users'), 2 route, cần role admin
│   ├── dtos/update-user.dto.ts                    # UpdateUserSchema (Zod)
│   └── responses/user.response.ts                 # toUserResponse (ẩn passwordHash/googleId)
├── users.module.ts
└── index.ts                                       # Public contract
```

## 3. Tầng domain chi tiết

- `user.entity.ts`: `User.create()` kiểm tra email hợp lệ, chuẩn hóa lowercase; `block()/unblock()/softDelete()` đổi trạng thái; `MAX_NAME_LENGTH`, `MAX_BIO_LENGTH`.
- `user-session.entity.ts`: lưu `tokenHash` (SHA-256), `expiresAt`, `deviceName`, `ip`, `revokedAt`. `isExpired()` so với thời điểm hiện tại.
- `user-role.vo.ts`: `USER_ROLES = ['admin','analyst']`, `USER_STATUSES = ['active','blocked','deleted']`, `canUserLogin()` chỉ cho `active`, `normalizeEmail()` lowercase + trim.
- `user.repository.port.ts`: hợp đồng `create/findById/findByEmail/findPaged/createSession/revoke...`, kiểu `CreateUserInput`, `CreateSessionInput`, `UpdateProfileInput`.
- `user-events.ts`: sự kiện tạo/khóa/xóa user để audit và gửi thông báo.

## 4. Tầng application chi tiết

- Tạo user/session tách riêng để `auth` tái dùng mà không cần biết Mongoose.
- `UpdateProfileHandler`: kiểm tra số điện thoại Việt Nam, khóa lạc quan nếu client gửi `If-Match`.
- `UserAccessRevocationService`: khi block/xóa, thu hồi toàn bộ session và đẩy `session.revoked` qua realtime để client ngắt kết nối.
- `FindPagedHandler`: phân trang keyset (`cursor`, `sortBy`), không dùng `page/total` để tránh quét O(n).

## 5. Route đầy đủ

| Phương thức | Đường dẫn đầy đủ | Bảo vệ | Mô tả |
|---|---|---|---|
| GET | `/api/v1/users/me` | JWT | Lấy hồ sơ hiện tại, không trả `passwordHash`/`googleId`. |
| PATCH | `/api/v1/users/me` | JWT | Cập nhật tên, điện thoại, bio. |
| DELETE | `/api/v1/users/me` | JWT | Xóa mềm tài khoản. |
| GET | `/api/v1/admin/users` | JWT + `Roles('admin')` | Danh sách hồ sơ, keyset cursor (`cursor`, `sortBy`). Có audit log. |
| GET | `/api/v1/admin/users/:id` | JWT + `Roles('admin')` | Chi tiết hồ sơ (chỉ đọc). Có audit log. |

## 6. Bất biến

- `email` duy nhất toàn hệ thống (unique index, chuẩn hóa lowercase).
- `passwordHash`/`googleId` không bao giờ lộ qua API (`toUserResponse` đã lược bỏ).
- Refresh token chỉ lưu hash; tra cứu bằng `find-session-by-token-hash`.
- Block/soft-delete có hiệu lực ngay: `auth` kiểm tra `canUserLogin()` mỗi lần đăng nhập và mỗi lần xác thực JWT.

## 7. Test liên quan

`test/unit/users/` (entity, session), `test/e2e/users-me.e2e-spec.ts`, `test/e2e/security/authorization.e2e-spec.ts` (48 ca CASL).
