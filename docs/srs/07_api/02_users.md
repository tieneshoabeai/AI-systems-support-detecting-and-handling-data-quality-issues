# 07.02. API MODULE 2 — QUẢN LÝ NGƯỜI DÙNG (USERS)

Quy ước chung, cấu trúc phản hồi và mã lỗi dùng chung: [00_quy-uoc-chung](00_quy-uoc-chung.md). Use case tương ứng: [06_luong-nghiep-vu](../06_luong-nghiep-vu.md) (BF-4, UC-2.x).

> Ghi chú vai trò: tài liệu dùng mã vai trò theo spec `ADMIN` / `DATA_ANALYST`; mã nguồn hiện dùng `admin` / `analyst` (xem [02_pham-vi](../02_pham-vi.md)).

---

### API-11. Lấy hồ sơ hiện tại (F2.1)

| Method | Path | Quyền | Ưu tiên | FR |
|---|---|---|---|---|
| `GET` | `/users/me` | Đã đăng nhập | Bắt buộc | FR-2.1 |

**Input**: không có (danh tính lấy từ access token).

**Output — `200 OK`**
```json
{ "id": "string", "email": "string", "fullName": "string", "role": "DATA_ANALYST", "avatarUrl": "string | null", "isBlocked": false, "createdAt": "ISO-8601" }
```

**Luồng xử lý chính**
1. [FE] Gọi API kèm access token.
2. [BE] Lấy `userId` từ token.
3. [DB] Đọc user (không lấy `passwordHash`).
4. [BE] Trả `200`.

**Luồng lỗi**: E1 (3) User không còn tồn tại → `401` `[GIẢ ĐỊNH]`.

---

### API-12. Cập nhật hồ sơ (F2.2)

| Method | Path | Quyền | Ưu tiên | FR |
|---|---|---|---|---|
| `PATCH` | `/users/me` | Đã đăng nhập | Bắt buộc | FR-2.2 |

**Input**

| Vị trí | Trường | Kiểu | Bắt buộc | Ràng buộc |
|---|---|---|:---:|---|
| Body | `fullName` | string | | 2–100 ký tự |
| Body | `avatarUrl` | string | | URL hợp lệ |

Trường `email`, `role` nếu gửi lên sẽ bị bỏ qua.

**Output — `200 OK`**
```json
{ "id": "string", "email": "string", "fullName": "string", "avatarUrl": "string | null", "updatedAt": "ISO-8601" }
```

**Luồng xử lý chính**
1. [FE] Gửi các trường cần sửa.
2. [BE] Kiểm tra schema; chỉ giữ `fullName`, `avatarUrl`.
3. [DB] Cập nhật user theo `userId` trong token.
4. [BE] Trả `200`.

**Luồng lỗi**: E1 (2) Sai độ dài / URL không hợp lệ → `400`.

---

### API-13. Đổi mật khẩu (F2.3)

| Method | Path | Quyền | Ưu tiên | FR |
|---|---|---|---|---|
| `POST` | `/users/me/change-password` | Đã đăng nhập | Bắt buộc | FR-2.3 |

**Input**

| Vị trí | Trường | Kiểu | Bắt buộc | Ràng buộc |
|---|---|---|:---:|---|
| Body | `currentPassword` | string | ✓ | |
| Body | `newPassword` | string | ✓ | Độ phức tạp như API-01; khác `currentPassword` |

**Output — `200 OK`**
```json
{ "success": true, "message": "Đổi mật khẩu thành công" }
```

**Lỗi riêng**

| Mã | Điều kiện | Message |
|---|---|---|
| `400` | Mật khẩu hiện tại sai | Mật khẩu hiện tại không đúng |
| `400` | Mật khẩu mới trùng mật khẩu cũ | Mật khẩu mới không được trùng mật khẩu cũ `[GIẢ ĐỊNH nội dung]` |

**Luồng xử lý chính**
1. [BE] Lấy `userId` từ token.
2. [DB] Đọc user kèm `passwordHash`.
3. [BE] `bcrypt.compare(currentPassword)`.
4. [BE] Kiểm tra `newPassword` khác mật khẩu cũ.
5. [BE] Băm `newPassword` (bcrypt 12).
6. [DB] Cập nhật `passwordHash`.
7. [BE] Trả `200`.

**Luồng lỗi**
- E1 (3) Sai mật khẩu hiện tại → `400`.
- E2 (4) Trùng mật khẩu cũ → `400`.
- E3 Mật khẩu mới yếu → `400`.

---

### API-14. Danh sách người dùng — phân trang con trỏ (F2.4)

| Method | Path | Quyền | Ưu tiên | FR |
|---|---|---|---|---|
| `GET` | `/users` | Admin | Bắt buộc | FR-2.4 |

**Input**

| Vị trí | Trường | Kiểu | Bắt buộc | Ràng buộc |
|---|---|---|:---:|---|
| Query | `limit` | integer | | Mặc định 20, tối đa 100 |
| Query | `cursor` | string | | Base64 của `{ createdAt, id }` bản ghi cuối trang trước |
| Query | `search` | string | | Tìm theo email hoặc họ tên |
| Query | `status` | enum | | `ACTIVE` \| `BLOCKED` |

**Output — `200 OK`**
```json
{
  "data": [ { "id": "string", "email": "string", "fullName": "string", "role": "DATA_ANALYST", "isBlocked": false, "createdAt": "ISO-8601" } ],
  "pageInfo": { "hasNextPage": true, "nextCursor": "string | null" }
}
```

**Lỗi riêng**

| Mã | Điều kiện |
|---|---|
| `403` | Người gọi không phải Admin |
| `400` | `cursor` giải mã không hợp lệ `[GIẢ ĐỊNH]` |

**Luồng xử lý chính**
1. [BE] Kiểm tra vai trò `ADMIN`.
2. [BE] Nếu có `cursor` → giải mã Base64 lấy `lastCreatedAt`, `lastId`.
3. [DB] Truy vấn: `(createdAt < lastCreatedAt) OR (createdAt = lastCreatedAt AND _id < lastId)`, áp `search`/`status`, sắp xếp `createdAt DESC, _id DESC`, `LIMIT limit + 1` (không dùng `skip`).
4. [BE] Nếu nhận được `limit + 1` bản ghi → `hasNextPage = true`, bỏ bản ghi thừa.
5. [BE] Sinh `nextCursor` từ bản ghi cuối.
6. [BE] Trả `200`.

**Luồng lỗi**
- E1 (1) Không phải Admin → `403`.
- E2 (2) Cursor hỏng → `400`.

---

### API-15. Chi tiết người dùng theo ID (F2.5)

| Method | Path | Quyền | Ưu tiên | FR |
|---|---|---|---|---|
| `GET` | `/users/:userId` | Admin | Bắt buộc | FR-2.5 |

**Input**: Path `userId` (string, ✓).

**Output — `200 OK`**
```json
{ "id": "string", "email": "string", "fullName": "string", "role": "DATA_ANALYST", "isBlocked": false, "createdAt": "ISO-8601", "workspaceCount": 3 }
```

**Lỗi riêng**

| Mã | Điều kiện |
|---|---|
| `403` | Không phải Admin |
| `404` | Không tìm thấy người dùng |

**Luồng xử lý chính**
1. [BE] Kiểm tra vai trò `ADMIN`.
2. [DB] Tìm user theo `userId`.
3. [DB] Đếm Workspace chưa xóa có `ownerId = userId`.
4. [BE] Trả `200`.

**Luồng lỗi**
- E1 (1) Không phải Admin → `403`.
- E2 (2) Không tồn tại → `404`.

---

### API-16. Khóa tài khoản (F2.6)

| Method | Path | Quyền | Ưu tiên | FR |
|---|---|---|---|---|
| `PATCH` | `/users/:userId/block` | Admin | Bắt buộc | FR-2.6 |

**Input**

| Vị trí | Trường | Kiểu | Bắt buộc | Ràng buộc |
|---|---|---|:---:|---|
| Path | `userId` | string | ✓ | Khác id của Admin đang gọi |
| Body | `reason` | string | | Lý do khóa |

**Output — `200 OK`**
```json
{ "success": true, "userId": "string", "isBlocked": true, "message": "Tài khoản đã bị khóa" }
```

**Lỗi riêng**

| Mã | Điều kiện |
|---|---|
| `400` | Admin tự khóa chính mình |
| `403` | Không phải Admin |
| `404` | Không tìm thấy người dùng `[GIẢ ĐỊNH]` |

**Luồng xử lý chính**
1. [BE] Kiểm tra vai trò `ADMIN`.
2. [BE] So sánh `userId` với id người gọi.
3. [DB] Tìm user.
4. [DB] Cập nhật `isBlocked = true`.
5. [DB] Xóa **toàn bộ** `user_sessions` của user.
6. [BE] Trả `200`. Mọi thiết bị của user nhận `401` ở lần gọi kế tiếp; refresh token → `401`/`403`.

**Luồng lỗi**
- E1 (1) Không phải Admin → `403`.
- E2 (2) Tự khóa → `400`.
- E3 (3) Không tồn tại → `404`.

---

### API-17. Mở khóa tài khoản (F2.7)

| Method | Path | Quyền | Ưu tiên | FR |
|---|---|---|---|---|
| `PATCH` | `/users/:userId/unblock` | Admin | Bắt buộc | FR-2.7 |

**Input**: Path `userId` (string, ✓).

**Output — `200 OK`**
```json
{ "success": true, "userId": "string", "isBlocked": false, "message": "Tài khoản đã được mở khóa" }
```

**Lỗi riêng**

| Mã | Điều kiện |
|---|---|
| `403` | Không phải Admin |
| `404` | Không tìm thấy người dùng `[GIẢ ĐỊNH]` |

**Luồng xử lý chính**
1. [BE] Kiểm tra vai trò `ADMIN`.
2. [DB] Tìm user.
3. [DB] Cập nhật `isBlocked = false`.
4. [BE] Trả `200`. Người dùng đăng nhập lại bình thường (không khôi phục phiên cũ).

**Luồng lỗi**
- E1 (1) Không phải Admin → `403`.
- E2 (2) Không tồn tại → `404`.
