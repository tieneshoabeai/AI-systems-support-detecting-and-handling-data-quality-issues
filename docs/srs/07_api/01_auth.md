# 07.01. API MODULE 1 — XÁC THỰC & PHÂN QUYỀN (AUTH)

Quy ước chung, cấu trúc phản hồi và mã lỗi dùng chung: [00_quy-uoc-chung](00_quy-uoc-chung.md). Use case tương ứng: [06_luong-nghiep-vu](../06_luong-nghiep-vu.md) (BF-2, BF-3, UC-1.x).

---

### API-01. Đăng ký bằng email (F1.1)

| Method | Path | Quyền | Ưu tiên | FR |
|---|---|---|---|---|
| `POST` | `/auth/register` | Công khai | Bắt buộc | FR-1.1 |

**Input**

| Vị trí | Trường | Kiểu | Bắt buộc | Ràng buộc |
|---|---|---|:---:|---|
| Body | `email` | string | ✓ | RFC 5322; trim, chuyển chữ thường |
| Body | `password` | string | ✓ | 8–64 ký tự; ≥ 1 hoa, 1 thường, 1 số, 1 ký tự đặc biệt |
| Body | `fullName` | string | ✓ | 2–100 ký tự |

**Output — `201 Created`**
```json
{ "userId": "string", "email": "string", "fullName": "string", "role": "DATA_ANALYST", "createdAt": "ISO-8601" }
```

**Lỗi riêng**

| Mã | Điều kiện | Message |
|---|---|---|
| `409` | Email đã tồn tại | Email đã được sử dụng `[GIẢ ĐỊNH nội dung]` |

**Luồng xử lý chính**
1. [FE] Gửi `email`, `password`, `fullName`.
2. [BE] Kiểm tra schema; chuẩn hóa email.
3. [DB] Tìm `users` theo email.
4. [BE] Băm mật khẩu bcrypt (salt 12).
5. [DB] Tạo user `role = DATA_ANALYST`, `status = ACTIVE`, `isBlocked = false`.
6. [BE] Trả `201` (không kèm hash mật khẩu).

**Luồng lỗi**
- E1 (2) Sai định dạng → `400`.
- E2 (3) Email đã tồn tại → `409`.

---

### API-02. Đăng nhập bằng email (F1.2)

| Method | Path | Quyền | Ưu tiên | FR |
|---|---|---|---|---|
| `POST` | `/auth/login` | Công khai | Bắt buộc | FR-1.2 |

**Input**

| Vị trí | Trường | Kiểu | Bắt buộc | Ràng buộc |
|---|---|---|:---:|---|
| Body | `email` | string | ✓ | |
| Body | `password` | string | ✓ | |
| Header | `User-Agent` | string | | Dùng để ghi nhận thiết bị của phiên |

**Output — `200 OK`**
```json
{
  "accessToken": "JWT (15 phút)",
  "refreshToken": "string (7 ngày)",
  "sessionId": "string",
  "user": { "id": "string", "email": "string", "fullName": "string", "role": "DATA_ANALYST | ADMIN" }
}
```

**Lỗi riêng**

| Mã | Điều kiện | Message |
|---|---|---|
| `401` | Email không tồn tại hoặc sai mật khẩu | Email hoặc mật khẩu không chính xác |
| `403` | Tài khoản bị khóa | Tài khoản của bạn đã bị khóa bởi Quản trị viên |

**Luồng xử lý chính**
1. [FE] Gửi `email`, `password`.
2. [BE] Chuẩn hóa email.
3. [DB] Tìm user.
4. [BE] `bcrypt.compare` mật khẩu.
5. [BE] Kiểm tra `isBlocked`.
6. [BE] Sinh `accessToken`, `refreshToken`, `sessionId`.
7. [DB] Lưu `user_sessions`: `sessionId`, `userId`, SHA-256(`refreshToken`), `ipAddress`, `userAgent`, `expiresAt`.
8. [BE] Trả `200`.

**Luồng lỗi**
- E1 (3) hoặc (4) Không tìm thấy hoặc sai mật khẩu → `401` (cùng một thông báo).
- E2 (5) Bị khóa → `403`.

---

### API-03. Đăng nhập bằng Google (F1.3)

| Method | Path | Quyền | Ưu tiên | FR |
|---|---|---|---|---|
| `POST` | `/auth/google` | Công khai | Bắt buộc | FR-1.3 |

**Input**

| Vị trí | Trường | Kiểu | Bắt buộc | Ràng buộc |
|---|---|---|:---:|---|
| Body | `idToken` | string | ✓ | Google ID Token từ Google Sign-In phía client |

**Output — `200 OK`**: như API-02, `user` có thêm `avatarUrl`.

**Lỗi riêng**

| Mã | Điều kiện |
|---|---|
| `401` | ID token không hợp lệ / giả mạo |
| `400` | `email_verified ≠ true` |
| `403` | Tài khoản đã tồn tại và bị khóa |

**Luồng xử lý chính**
1. [BE] Xác minh `idToken` với Google (`audience = GOOGLE_CLIENT_ID`).
2. [BE] Lấy `email`, `name`, `picture`, `email_verified`.
3. [DB] Tìm user theo email.
4. ◇ Đã tồn tại?
   - Có → cập nhật `googleId`, `avatarUrl`; kiểm tra `isBlocked`.
   - Không → tạo user `DATA_ANALYST`, `ACTIVE`, `passwordHash = null`.
5. [DB] Tạo phiên.
6. [BE] Trả token.

**Luồng lỗi**
- E1 (1) Token sai → `401`.
- E2 (2) Email chưa xác minh → `400`.
- E3 (4) Bị khóa → `403`.

---

### API-04. Quên mật khẩu (F1.4)

| Method | Path | Quyền | Ưu tiên | FR |
|---|---|---|---|---|
| `POST` | `/auth/forgot-password` | Công khai | Bắt buộc | FR-1.4 |

**Input**: Body `email` (string, ✓, định dạng email).

**Output — `200 OK`** (luôn giống nhau)
```json
{ "success": true, "message": "Nếu email tồn tại trên hệ thống, một đường dẫn đặt lại mật khẩu đã được gửi đi" }
```

**Luồng xử lý chính**
1. [BE] Kiểm tra định dạng email.
2. [DB] Tìm user.
3. ◇ Tồn tại và không bị khóa?
   - Có → sinh `resetToken` (32 byte ngẫu nhiên); [DB] lưu SHA-256 vào `password_resets`, `expiresAt = now + 15 phút`; [Mail] gửi liên kết `.../reset-password?token=...`.
   - Không → không làm gì.
4. [BE] Trả `200` với cùng một thông báo.

**Luồng lỗi**
- E1 (1) Email sai định dạng → `400`.
- E2 (3) Gửi mail thất bại → vẫn trả `200`, ghi log lỗi `[GIẢ ĐỊNH]`.

---

### API-05. Đặt lại mật khẩu (F1.5)

| Method | Path | Quyền | Ưu tiên | FR |
|---|---|---|---|---|
| `POST` | `/auth/reset-password` | Công khai (cần token khôi phục) | Bắt buộc | FR-1.5 |

**Input**

| Vị trí | Trường | Kiểu | Bắt buộc | Ràng buộc |
|---|---|---|:---:|---|
| Body | `token` | string | ✓ | Token nhận từ email |
| Body | `newPassword` | string | ✓ | Độ phức tạp như API-01 |

**Output — `200 OK`**
```json
{ "success": true, "message": "Đặt lại mật khẩu thành công. Vui lòng đăng nhập bằng mật khẩu mới" }
```

**Lỗi riêng**

| Mã | Điều kiện | Message |
|---|---|---|
| `400` | Token không tồn tại / hết hạn / đã dùng | Mã khôi phục không hợp lệ hoặc đã hết hạn |

**Luồng xử lý chính**
1. [BE] SHA-256(`token`).
2. [DB] Tìm trong `password_resets`.
3. [BE] Kiểm tra `expiresAt > now`, `used = false`.
4. [BE] Băm `newPassword` (bcrypt 12).
5. [DB] Cập nhật `passwordHash`.
6. [DB] Đánh dấu `used = true`.
7. [DB] Xóa **toàn bộ** `user_sessions` của user.
8. [BE] Trả `200`.

**Luồng lỗi**
- E1 (2) hoặc (3) Token không hợp lệ → `400`.
- E2 Mật khẩu yếu → `400`.

---

### API-06. Làm mới access token (F1.6)

| Method | Path | Quyền | Ưu tiên | FR |
|---|---|---|---|---|
| `POST` | `/auth/refresh-token` | Công khai (cần refresh token) | Bắt buộc | FR-1.6 |

**Input**: Body `refreshToken` (string, ✓).

**Output — `200 OK`**
```json
{ "accessToken": "JWT (15 phút)", "expiresIn": 900 }
```

**Lỗi riêng**

| Mã | Điều kiện |
|---|---|
| `401` | Refresh token không tồn tại hoặc phiên hết hạn |
| `403` | Tài khoản bị khóa (phiên bị xóa) |

**Luồng xử lý chính**
1. [BE] SHA-256(`refreshToken`).
2. [DB] Tìm `user_sessions` còn hạn.
3. [DB] Lấy user.
4. [BE] Kiểm tra `isBlocked`.
5. [BE] Ký `accessToken` mới.
6. [BE] Trả `200`.

**Luồng lỗi**
- E1 (2) Không tìm thấy hoặc hết hạn → `401`.
- E2 (4) Bị khóa → [DB] xóa phiên → `403`.

---

### API-07. Đăng xuất (F1.7)

| Method | Path | Quyền | Ưu tiên | FR |
|---|---|---|---|---|
| `POST` | `/auth/logout` | Đã đăng nhập | Bắt buộc | FR-1.7 |

**Input**: Body `sessionId` (string, không bắt buộc; mặc định là phiên gắn với access token).

**Output — `200 OK`**
```json
{ "message": "Đăng xuất thành công" }
```

**Luồng xử lý chính**
1. [BE] Xác thực access token, lấy `userId`, `sessionId`.
2. [DB] Xóa phiên tương ứng.
3. [BE] Trả `200`.

**Luồng lỗi**: E1 (1) Token không hợp lệ → `401`.

---

### API-08. Thu hồi phiên từ xa (F1.8)

| Method | Path | Quyền | Ưu tiên | FR |
|---|---|---|---|---|
| `DELETE` | `/auth/sessions/:sessionId` | Chủ phiên hoặc Admin | Bắt buộc | FR-1.8 |

**Input**: Path `sessionId` (string, ✓).

**Output — `200 OK`**
```json
{ "success": true, "message": "Phiên làm việc từ xa đã được thu hồi thành công" }
```

**Lỗi riêng**

| Mã | Điều kiện |
|---|---|
| `404` | Không tìm thấy phiên |
| `403` | Phiên không thuộc người gọi và người gọi không phải Admin |

**Luồng xử lý chính**
1. [BE] Lấy `userId` từ token.
2. [DB] Tìm phiên.
3. [BE] Kiểm tra sở hữu.
4. [DB] Xóa phiên.
5. [BE] Trả `200`. Thiết bị dùng phiên này ở lần gọi sau nhận `401`.

**Luồng lỗi**
- E1 (2) Không có → `404`.
- E2 (3) Không phải chủ → `403`.

---

### API-09. Lấy quyền hiện tại (F1.9)

| Method | Path | Quyền | Ưu tiên | FR |
|---|---|---|---|---|
| `GET` | `/auth/permissions` | Đã đăng nhập | Bắt buộc | FR-1.9 |

**Input**: không có.

**Output — `200 OK`**
```json
{ "role": "ADMIN | DATA_ANALYST", "permissions": ["user:read", "user:block", "workspace:create"], "isAdmin": true }
```

**Luồng xử lý chính**
1. [BE] Lấy `userId` từ token.
2. [DB] Đọc vai trò mới nhất.
3. [BE] Ánh xạ vai trò → danh sách mã quyền.
4. [BE] Trả `200`.

**Luồng lỗi**: E1 (2) User không còn tồn tại → `401` `[GIẢ ĐỊNH]`.

---

### API-10. Danh sách phiên đang hoạt động (F1.10)

| Method | Path | Quyền | Ưu tiên | FR |
|---|---|---|---|---|
| `GET` | `/auth/sessions` | Đã đăng nhập | Đề xuất | FR-1.10 |

**Input**: không có.

**Output — `200 OK`**
```json
{
  "sessions": [
    { "sessionId": "string", "ipAddress": "string", "userAgent": "string", "isCurrentSession": true, "createdAt": "ISO-8601", "lastActiveAt": "ISO-8601" }
  ]
}
```

**Luồng xử lý chính**
1. [BE] Lấy `userId`, `sessionId` hiện tại từ token.
2. [DB] Lấy các phiên còn hạn của user.
3. [BE] Đánh dấu `isCurrentSession`.
4. [BE] Trả `200`.

**Luồng lỗi**: chỉ có lỗi chung.
