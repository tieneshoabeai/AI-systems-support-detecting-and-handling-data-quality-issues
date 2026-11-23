# MÔ-ĐUN `users` — Tài khoản & Phiên đăng nhập

> **Đặc tả mô-đun & Tài liệu kỹ thuật**

## 1. Thông tin phiên bản

- **Phiên bản hiện tại:** v1.1.0
- **Cập nhật lần cuối:** 2026-11-21
- **Đường dẫn mô-đun:** `src/backend/src/modules/users` (34 tệp TypeScript)
- **Tầng kiến trúc:** Clean Architecture 4 tầng (`domain` → `application` → `infrastructure` → `presentation`)
- **Quy tắc tầng:** CA1–CA14 — xem [`../README.md`](../README.md)

## 2. Mục đích & Phạm vi nghiệp vụ

Mô-đun này sở hữu **danh tính người dùng** và **vòng đời phiên đăng nhập**. Đây là aggregate root mang tính bảo mật cao nhất trong hệ thống.

Mô-đun `auth` sẽ **gọi vào** mô-đun này qua port để tạo phiên và kiểm tra user; mô-đun này **không** lo xác thực mật khẩu hay token (thuộc về `auth`).

### 2.1. Tính năng thuộc phạm vi

| Chức năng | Nội dung |
|---|---|
| Hồ sơ người dùng | Tạo, cập nhật, xoá mềm, chặn / bỏ chặn |
| Phiên đăng nhập | Tạo phiên, chạm (touch), thu hồi theo id / toàn bộ / theo hash token |
| Truy vấn | Tìm theo email, id, phân trang, tìm phiên theo hash token |
| Thông báo | Cập nhật tùy chọn (preferences) của người dùng |
| Sự kiện | Phát `user.created`, `user.blocked`, `user.unblocked`, `user.removed` |

### 2.2. Cấu trúc thư mục

```text
users/
|-- domain/
|   |-- entities/
|   |   |-- user.entity.ts            # Aggregate root User
|   |   `-- user-session.entity.ts    # Aggregate root UserSession
|   |-- value-objects/
|   |   |-- user-role.vo.ts           # UserRole, UserStatus, normalizeEmail, canUserLogin
|   |   `-- session-policy.vo.ts      # Chính sách hết hạn phiên
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

## 3. Nhật ký Prompting & Quyết định kỹ thuật

- **Yêu cầu người dùng / Ý đồ nghiệp vụ:** Làm `users` là nguồn sự thật duy nhất về danh tính người dùng và phiên đăng nhập, để mọi mô-đun khác đều có thể trích xuất `userId` một cách nhất quán, đồng thời bảo đảm mọi luồng đều có một `User` hợp lệ.

- **Lập luận kỹ thuật & Quyết định:**

1. **Tách danh tính ra khỏi xác thực.** `auth` lo bằng chứng (mật khẩu, token, OAuth); `users` lo danh tính (tài khoản, phiên). Hai mối lo khác nhau, tách ra để mở rộng đường đăng nhập OAuth mà không phải sửa lại mô hình người dùng.

2. **Gắn chặt invariant trong entity.** `canUserLogin` chặn tài khoản bị chặn / đã xoá **ngay trong domain**, thay vì để controller phải tự kiểm tra. `normalizeEmail` chuẩn hoá email một lần duy nhất, ở domain, nên mọi nơi đều dùng chung.

3. **Chỉ lưu hash refresh token.** Session lưu SHA-256 hash, không lưu token thô. Nếu cơ sở dữ liệu bị lộ, kẻ tấn công không thể giả lập phiên.

4. **Thu hồi realtime ngay lập tức (OPEN-08).** Khoá tài khoản nhưng socket vẫn sống là lỗ hổng IDOR qua WebSocket. `UserAccessRevocationService` ghi outbox event, mô-đun `realtime` bắt và đóng socket — tách mô-đun để tránh phụ thuộc vòng tròn.

5. **Xoá mềm + partial unique index.** Cho phép đăng ký lại email đã xoá mà vẫn không trùng tên với tài khoản đang hoạt động.

- **Hiện vật đã tạo / đã sửa:**

- `domain/entities/user.entity.ts` — aggregate root `User` với 3 phương thức `create` / `reconstitute` / `restore`.
- `domain/value-objects/user-role.vo.ts` — `UserRole`, `UserStatus`, `normalizeEmail`, `canUserLogin`.
- `domain/events/user-events.ts` — `USER_EVENTS` (dạng `dot.case`) và `USER_OUTBOX_EVENTS` (dạng UPPER_SNAKE).
- `application/services/user-access-revocation.service.ts` — phát `USER_BLOCKED` / `USER_REMOVED` khi khoá / xoá.
- `application/commands/block-user.handler.ts`, `unblock-user.handler.ts`, `soft-delete-user.handler.ts`.
- `presentation/controllers/admin-users.controller.ts` — các route quản trị có `@Roles('admin')`.

## 4. Đặc tả giao tiếp kỹ thuật

### 4.1. Điểm cuối (Endpoints)

| Phương thức | Đường dẫn | Chính sách | Mô tả |
|---|---|---|---|
| `GET` | `/api/v1/users/me` | Chủ tài khoản | Hồ sơ của tôi |
| `PATCH` | `/api/v1/users/me` | Chủ tài khoản | Cập nhật hồ sơ |
| `DELETE` | `/api/v1/users/me` | Chủ tài khoản | Xoá mềm tài khoản của tôi |
| `GET` | `/api/v1/admin/users` | `admin` | Danh sách tài khoản |
| `GET` | `/api/v1/admin/users/:id` | `admin` | Chi tiết tài khoản |

> Các command handler **không mở route REST** (gọi từ `auth`): `block-user`, `unblock-user`, `revoke-all-user-sessions`, `revoke-session-by-id`, `revoke-session`.

### 4.2. Giao diện / Provider được xuất ra ngoài

`src/backend/src/modules/users/index.ts` xuất hợp đồng công khai:

| Tên xuất | Vai trò |
|---|---|
| `UsersModule` | Mô-đun Nest |
| Thực thể `User` + `UserRole` / `UserStatus` | Hợp đồng đọc của mô-đun khác |
| `USER_REPOSITORY_PORT` | Cổng truy vấn tài khoản / phiên |
| `UserAccessRevocationService` | Phát sự kiện thu hồi quyền |

### 4.3. Sự kiện domain phát ra

| Sự kiện | Khi nào | Định dạng |
|---|---|---|
| `user.created` | Đăng ký mới | `dot.case` — domain event của entity |
| `user.blocked` | Admin khoá tài khoản | `dot.case` |
| `user.unblocked` | Admin bỏ khoá | `dot.case` |
| `user.removed` | Xoá mềm | `dot.case` |
| `USER_BLOCKED` | Khoá — kích hoạt thu hồi realtime | UPPER_SNAKE — outbox event |
| `USER_REMOVED` | Xoá mềm — kích hoạt thu hồi realtime | UPPER_SNAKE — outbox event |

Hai nhóm tên cùng tồn tại có chủ đích: `dot.case` là **domain event** của entity; UPPER_SNAKE là **outbox event** mà `EventDispatcherService` và `DomainEventHandlerRegistry` khớp theo tên.

## 5. Ràng buộc & Tiêu chuẩn bất biến

### 5.1. Bất biến nghiệp vụ

- Email chuẩn hoá (`lowercase` + `trim`) và **duy nhất** trong số tài khoản chưa xoá mềm.
- Số điện thoại **duy nhất** nếu có giá trị.
- `firstName` / `lastName` ≤ 50 ký tự; `bio` ≤ 500 ký tự.
- Chỉ tài khoản `active` + chưa xoá mới đăng nhập được (`canUserLogin`).
- Xoá mềm **phải** thu hồi toàn bộ phiên.
- `passwordHash` là private + `select: false` — không bao giờ được lộ ra ngoài.

### 5.2. Xoá mềm (Soft Delete)

- **Chuẩn:** `deleted_at: Date | null` — trường này **null** nghĩa là bản ghi đang hoạt động.
- **Quy tắc truy vấn:** mọi truy vấn mặc định luôn lọc `deleted_at: null`. Repository nền (`shared/infrastructure/database/base-mongo.repository.ts`) áp dụng điều này tự động.
- **Chơi index Partial Unique:** `partialFilterExpression: { deleted_at: null }` — cho phép tài khoản / tên / email đã xoá mềm được tạo lại.

### 5.3. Bảo mật

| Vấn đề | Cách xử lý |
|---|---|
| Lộ mật khẩu | `passwordHash` private + `select: false`; mapper không bao giờ map ra response |
| Trùng email | Chuẩn hoá trước khi ghi + partial unique index |
| Đăng nhập tài khoản bị khoá | `canUserLogin` chặn ở entity, không phải ở controller |
| Đăng nhập tài khoản đã xoá | `canUserLogin` + truy vấn lọc `deleted_at: null` |
| Token phiên bị lộ | Chỉ lưu SHA-256 hash |
| Đặt lại mật khẩu bị lạm dụng | Bộ đệm cửa sổ thời gian + giới hạn số lần gửi |
| Phiên còn sống sau khi khoá | `USER_BLOCKED` / `USER_REMOVED` đóng socket tức thời |

### 5.4. Phân quyền

| Tuyến đường | Chính sách |
|---|---|
| `GET/PATCH/DELETE /users/me` | Chủ tài khoản đang đăng nhập |
| `GET /admin/users`, `GET /admin/users/:id` | `@Roles('admin')` |

**Mô hình vai trò 3 tầng:** hệ thống (`admin`, `analyst`) → workspace (`owner`, `member`) → project (`owner`, `member`, `viewer`). Mô-đun này sở hữu tầng hệ thống.

## 6. Lịch sử thay đổi

### 2026-11-21
- **v1.1.0** / 2026-11-21 / Viết lại README mô-đun đầy đủ theo chuẩn 6 phần / Yêu cầu tái đọc / Tài liệu mẫu chuẩn
- **v1.0.0** / 2026-11-XX / Bổ sung `UserAccessRevocationService` và `USER_BLOCKED` / `USER_REMOVED` để thu hồi realtime khi khoá / xoá tài khoản (OPEN-08) / Lỗ hổng IDOR qua WebSocket / `modules/users`, `modules/realtime`
- **v0.9.0** / 2026-11-XX / Bổ sung `block-user` / `unblock-user` và thu hồi phiên toàn bộ / Chuẩn bị mật khẩu / `modules/users`
- **v0.8.0** / 2026-11-XX / Bổ sung admin bootstrap (`admin-bootstrap.service.ts`) — tạo tài khoản admin **tự động** khi hệ thống chưa có admin nào / Yêu cầu quyết định OPEN-01 / `modules/users`, `modules/auth`
- **v0.1.0** / 2026-11-XX / Tạo mô-đun, tách danh tính khỏi xác thực / Kiến trúc Clean Architecture / `modules/users`

- **Định dạng:** `[Phiên bản] / [Ngày] / [Thay đổi gì] / [Lý do] / [Ảnh hưởng đến đâu]`
