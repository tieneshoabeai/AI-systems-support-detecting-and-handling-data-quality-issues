# ĐẶC TẢ CHI TIẾT TÍNH NĂNG VÀ HỢP ĐỒNG API TOÀN DIỆN - GIAI ĐOẠN 1
**Dự án:** Nền tảng Full-stack Quản lý & Giám sát Chất lượng Dữ liệu có AI Hỗ trợ  
*(Full-Stack Data Management & Quality Assurance Platform with AI Assistance)*  
**Tập tin:** `docs/feature_spec_v4.md`  
**Phiên bản:** v4.0  
**Giai đoạn áp dụng:** Giai đoạn 1 (Core Platform MVP - Khung nền tảng chạy độc lập)  
**Ngày lập:** 19/10/2026  
**Trạng thái tài liệu:** Tài liệu thiết kế kỹ thuật chính thức theo cấu trúc module người dùng đề xuất  

---

## Lịch sử thay đổi (Change Log)
- **Phiên bản v4.2 (19/10/2026):**
  - **Thay đổi gì:** Tích hợp các chuẩn mật mã học SHA-256 và AES-256-GCM:
    + Bổ sung mã băm tệp `fileChecksum` (SHA-256) ở F5.1 phục vụ chống trùng lặp và xác minh toàn vẹn file.
    + Bổ sung chuỗi băm phiên bản `versionHash` và `parentHash` ở F8.1; bổ sung endpoint F8.4 xác thực tính toàn vẹn chuỗi phiên bản (`POST /datasets/:datasetId/versions/verify-integrity`).
    + Bổ sung tùy chọn xuất tệp mã hóa AES-256-GCM ở F9.1 (`encrypt=true` kèm mật khẩu bảo vệ).
  - **Lý do:** Nâng cao bảo mật, đảm bảo tính toàn vẹn dữ liệu, chống chối bỏ lịch sử làm sạch dữ liệu (Cryptographic Audit Trail kiểu Blockchain).
  - **Ảnh hưởng đến đâu:** Cập nhật F5.1, F8.1, bổ sung F8.4, cập nhật F9.1, nâng tổng số endpoints lên 43.
- **Phiên bản v4.1 (19/10/2026):**
  - **Thay đổi gì:** Chuyển đổi toàn bộ cơ chế xóa mềm (Soft Delete) từ cờ boolean `isDeleted` sang trường thời gian `deleted_at` (mặc định là `null`, khi bị xóa sẽ lưu thời gian tại thời điểm xóa).
  - **Lý do:** Thống nhất chuẩn đặt tên `deleted_at` đồng bộ với `created_at` và `updated_at`, loại bỏ trường dư thừa, tối ưu hóa điều kiện kiểm tra tồn tại và khôi phục dữ liệu.
  - **Ảnh hưởng đến đâu:** Đồng bộ các ràng buộc nghiệp vụ trong Module 3 (Workspace), Module 4 (Project), Module 5 (Dataset), Module 6 (Visualization) và cấu trúc Schema trong `docs/tech_solution_v1.md`.
- **Phiên bản v4.0 (19/10/2026):**
  - **Thay đổi gì:**
    1. Tái cấu trúc toàn bộ hệ thống thành **9 Module nghiệp vụ độc lập** theo đúng danh mục người dùng yêu cầu.
    2. Bổ sung các tính năng nâng cao hữu ích đi kèm (F1.10, F3.6, F4.6, F7.2, F8.3, F9.3).
    3. Áp dụng chuẩn đặc tả doanh nghiệp 6 mục cho từng Endpoint.
  - **Lý do:** Chuẩn hóa toàn bộ hệ thống theo danh mục nghiệp vụ chính xác của người dùng.
  - **Ảnh hưởng đến đâu:** Là bản thiết kế API contracts và Business Logic quy chuẩn cho toàn bộ Giai đoạn 1.

---

## MÔ HÌNH PHÂN CẤP TÀI NGUYÊN (RESOURCE HIERARCHY)

```
[ NGƯỜI DÙNG (USER) ]
         │
         ▼ Sở hữu (1:N)
[ KHÔNG GIAN LÀM VIỆC (WORKSPACE) ]
         │
         ▼ Chứa (1:N)
[ DỰ ÁN (PROJECT) ]
         │
         ▼ Chứa DUY NHẤT (1:1)
[ TẬP DỮ LIỆU (DATASET) ]
         │
         ├─▶ [ CÁC PHIÊN BẢN BIẾN ĐỔI (DATASET VERSIONS 1..N) ]
         └─▶ [ ĐỒ THỊ NGUỒN GỐC DỮ LIỆU (NEO4J DATA LINEAGE) ]
```

---

# ĐẶC TẢ CHI TIẾT 9 MODULE NGHIỆP VỤ

---

## MODULE 1: PHÂN QUYỀN VÀ XÁC THỰC (AUTHENTICATION & AUTHORIZATION)

---

### F1.1: Đăng ký tài khoản bằng Email
- **Mã Endpoint:** `POST /api/v1/auth/register`
- **Actor:** `Guest / Anonymous`.
- **Dữ liệu đầu vào (Request Body JSON):**
  - `email` (String): Email đăng ký; chuẩn RFC 5322, tự động loại bỏ khoảng trắng và chuyển chữ thường. Bắt buộc.
  - `password` (String): Mật khẩu; độ dài từ 8 đến 64 ký tự, chứa ít nhất 1 chữ hoa, 1 chữ thường, 1 chữ số và 1 ký tự đặc biệt. Bắt buộc.
  - `fullName` (String): Họ và tên; từ 2 đến 100 ký tự. Bắt buộc.
- **Dữ liệu đầu ra (Response JSON - HTTP 201 Created):**
  - `userId` (String): ID tài khoản tạo mới.
  - `email` (String): Email tài khoản.
  - `fullName` (String): Họ tên.
  - `role` (String): Mặc định `"DATA_ANALYST"`.
  - `createdAt` (String ISO-8601).
- **Ràng buộc nghiệp vụ & Quy trình xử lý:**
  1. Kiểm tra định dạng dữ liệu đầu vào. Nếu vi phạm, trả về HTTP `400 Bad Request`.
  2. Truy vấn MongoDB collection `users`. Nếu `email` đã tồn tại, từ chối với HTTP `409 Conflict`.
  3. Băm mật khẩu bằng `bcrypt` (salt rounds = 10).
  4. Tạo bản ghi người dùng với trạng thái `status: "ACTIVE"`, `isBlocked: false`.
  5. Trả về thông tin cơ bản của người dùng (không trả về hash mật khẩu).
- **Quyền truy cập:** Công khai (Public).

---

### F1.2: Đăng nhập bằng Email
- **Mã Endpoint:** `POST /api/v1/auth/login`
- **Actor:** `Guest / Anonymous`.
- **Dữ liệu đầu vào (Request Body JSON):**
  - `email` (String): Email đăng nhập. Bắt buộc.
  - `password` (String): Mật khẩu. Bắt buộc.
- **Dữ liệu đầu ra (Response JSON - HTTP 200 OK):**
  - `accessToken` (String): JWT xác thực (hạn 15 phút).
  - `refreshToken` (String): Token làm mới phiên (hạn 7 ngày).
  - `sessionId` (String): Mã định danh phiên đăng nhập (phục vụ thu hồi từ xa).
  - `user` (Object): `{ id, email, fullName, role }`.
- **Ràng buộc nghiệp vụ & Quy trình xử lý:**
  1. Chuẩn hóa email, tìm kiếm bản ghi trong `users`. Nếu không có hoặc sai mật khẩu (`bcrypt.compare`), trả về HTTP `401 Unauthorized` (Thông báo chung: *"Email hoặc mật khẩu không chính xác"*).
  2. Kiểm tra cờ `isBlocked`: Nếu tài khoản đang bị khóa, từ chối với HTTP `403 Forbidden` kèm thông báo: *"Tài khoản của bạn đã bị khóa bởi Quản trị viên"*.
  3. Tạo mới một phiên trong collection `user_sessions`: Lưu trữ `sessionId`, `userId`, `refreshTokenHash` (SHA-256), `ipAddress`, `userAgent`, `expiresAt`.
  4. Trả về cặp Token và `sessionId`.
- **Quyền truy cập:** Công khai.

---

### F1.3: Đăng nhập bằng Google (Google OAuth)
- **Mã Endpoint:** `POST /api/v1/auth/google`
- **Actor:** `Guest / Anonymous`.
- **Dữ liệu đầu vào (Request Body JSON):**
  - `idToken` (String): Google ID Token nhận được từ Google Sign-In SDK phía Client. Bắt buộc.
- **Dữ liệu đầu ra (Response JSON - HTTP 200 OK):**
  - `accessToken`, `refreshToken`, `sessionId`, `user: { id, email, fullName, role, avatarUrl }`.
- **Ràng buộc nghiệp vụ & Quy trình xử lý:**
  1. Backend sử dụng thư viện `google-auth-library` gọi `oauth2Client.verifyIdToken({ idToken, audience: GOOGLE_CLIENT_ID })`.
  2. Nếu token không hợp lệ hoặc giả mạo, từ chối với HTTP `401 Unauthorized`.
  3. Trích xuất Payload từ Google: `email`, `name`, `picture`, `email_verified`. Nếu `email_verified != true`, từ chối với HTTP `400 Bad Request`.
  4. Kiểm tra tài khoản trong MongoDB:
     - Nếu đã tồn tại: Cập nhật `googleId` và `avatarUrl`. Kiểm tra `isBlocked`.
     - Nếu chưa tồn tại: Tự động khởi tạo tài khoản mới với `role: "DATA_ANALYST"`, `status: "ACTIVE"`, không cần mật khẩu (`passwordHash: null`).
  5. Khởi tạo phiên làm việc mới trong `user_sessions`, cấp phát cặp Token và trả về client.
- **Quyền truy cập:** Công khai.

---

### F1.4: Quên mật khẩu (Forgot Password)
- **Mã Endpoint:** `POST /api/v1/auth/forgot-password`
- **Actor:** `Guest / Anonymous`.
- **Dữ liệu đầu vào (Request Body JSON):**
  - `email` (String): Email tài khoản cần khôi phục mật khẩu. Bắt buộc.
- **Dữ liệu đầu ra (Response JSON - HTTP 200 OK):**
  - `success` (Boolean): `true`.
  - `message` (String): `"Nếu email tồn tại trên hệ thống, một đường dẫn đặt lại mật khẩu đã được gửi đi"`.
- **Ràng buộc nghiệp vụ & Quy trình xử lý:**
  1. Kiểm tra định dạng email. Truy vấn tài khoản trong cơ sở dữ liệu.
  2. Để bảo mật chống dò quét tài khoản (User Enumeration Defense): Dù email có tồn tại hay không, hệ thống **luôn trả về HTTP 200 OK với thông báo giống nhau**.
  3. Nếu email tồn tại và không bị khóa:
     - Sinh chuỗi ngẫu nhiên bảo mật an toàn cao `resetToken` (crypto randomBytes 32 bytes).
     - Băm SHA-256 token và lưu vào `password_resets` với thời hạn hết hạn nghiêm ngặt là **15 phút**.
     - Kích hoạt dịch vụ Mailer gửi email chứa liên kết: `https://domain.com/reset-password?token=...`.
- **Quyền truy cập:** Công khai.

---

### F1.5: Đặt lại mật khẩu (Reset Password)
- **Mã Endpoint:** `POST /api/v1/auth/reset-password`
- **Actor:** `Guest / Anonymous` (Người dùng sở hữu Token khôi phục).
- **Dữ liệu đầu vào (Request Body JSON):**
  - `token` (String): Token khôi phục nhận được từ email. Bắt buộc.
  - `newPassword` (String): Mật khẩu mới (tuân thủ độ phức tạp). Bắt buộc.
- **Dữ liệu đầu ra (Response JSON - HTTP 200 OK):**
  - `success` (Boolean): `true`.
  - `message` (String): `"Đặt lại mật khẩu thành công. Vui lòng đăng nhập bằng mật khẩu mới"`.
- **Ràng buộc nghiệp vụ & Quy trình xử lý:**
  1. Băm `token` gửi lên bằng SHA-256 và đối chiếu trong `password_resets`.
  2. Nếu không tìm thấy hoặc `expiresAt < now()` hoặc đã sử dụng (`used: true`), từ chối với HTTP `400 Bad Request` kèm thông báo: *"Mã khôi phục không hợp lệ hoặc đã hết hạn"*.
  3. Băm mật khẩu mới bằng `bcrypt`. Cập nhật `passwordHash` trong `users`.
  4. Đánh dấu `used: true` cho bản ghi reset token.
  5. **Quy tắc an ninh bắt buộc:** Hủy bỏ toàn bộ các phiên làm việc đang hoạt động của tài khoản này trong `user_sessions` (buộc mọi thiết bị phải đăng nhập lại).
- **Quyền truy cập:** Công khai.

---

### F1.6: Làm mới Access Token (Refresh Token)
- **Mã Endpoint:** `POST /api/v1/auth/refresh-token`
- **Actor:** `Authenticated Client`.
- **Dữ liệu đầu vào (Request Body JSON):**
  - `refreshToken` (String): Chuỗi refresh token hợp lệ. Bắt buộc.
- **Dữ liệu đầu ra (Response JSON - HTTP 200 OK):**
  - `accessToken` (String): JWT mới (hạn 15 phút).
  - `expiresIn` (Number): `900`.
- **Ràng buộc nghiệp vụ & Quy trình xử lý:**
  1. Băm `refreshToken` gửi lên bằng SHA-256, tìm kiếm trong `user_sessions`.
  2. Nếu không tồn tại hoặc đã hết hạn, trả về HTTP `401 Unauthorized`.
  3. Kiểm tra xem người dùng có bị khóa tài khoản (`isBlocked`) hay không. Nếu bị khóa, xóa phiên và từ chối với HTTP `403 Forbidden`.
  4. Cấp phát `accessToken` mới với danh tính người dùng hiện hành.
- **Quyền truy cập:** Công khai (yêu cầu Refresh Token hợp lệ).

---

### F1.7: Đăng xuất phiên hiện tại (Logout Current Session)
- **Mã Endpoint:** `POST /api/v1/auth/logout`
- **Actor:** `Authenticated User`.
- **Headers:** `Authorization: Bearer <accessToken>`
- **Dữ liệu đầu vào (Request Body JSON):**
  - `sessionId` (String, optional): ID của phiên hiện tại. Nếu không truyền, hủy phiên gắn với Access Token hiện hành.
- **Dữ liệu đầu ra (Response JSON - HTTP 200 OK):**
  - `message` (String): `"Đăng xuất thành công"`.
- **Ràng buộc nghiệp vụ & Quy trình xử lý:**
  1. Xác thực Access Token; trích xuất `userId` và `sessionId`.
  2. Xóa bản ghi phiên tương ứng trong `user_sessions`.
- **Quyền truy cập:** Yêu cầu đăng nhập.

---

### F1.8: Thu hồi phiên từ xa theo ID (Revoke Remote Session by ID)
- **Mã Endpoint:** `DELETE /api/v1/auth/sessions/:sessionId`
- **Actor:** `Authenticated User`.
- **Headers:** `Authorization: Bearer <accessToken>`
- **Dữ liệu đầu vào:**
  - `sessionId` (Path Parameter, String): Mã định danh phiên đăng nhập trên thiết bị khác cần đăng xuất từ xa. Bắt buộc.
- **Dữ liệu đầu ra (Response JSON - HTTP 200 OK):**
  - `success` (Boolean): `true`.
  - `message` (String): `"Phiên làm việc từ xa đã được thu hồi thành công"`.
- **Ràng buộc nghiệp vụ & Quy trình xử lý:**
  1. Trích xuất `userId` từ token.
  2. Truy vấn `user_sessions` theo `sessionId`. Nếu không tìm thấy, trả về HTTP `404 Not Found`.
  3. Kiểm tra quyền sở hữu: Phiên làm việc phải thuộc về chính `userId` đó (trừ trường hợp Admin). Nếu không, từ chối với HTTP `403 Forbidden`.
  4. Xóa bản ghi phiên khỏi cơ sở dữ liệu. Thiết bị ở xa sử dụng phiên này khi gọi API tiếp theo sẽ bị từ chối với HTTP `401 Unauthorized`.
- **Quyền truy cập:** Người dùng chỉ được thu hồi phiên của chính mình.

---

### F1.9: Lấy quyền của tài khoản hiện tại cho Giao diện Quản trị (Current Permissions for Admin UI)
- **Mã Endpoint:** `GET /api/v1/auth/permissions`
- **Actor:** `Authenticated User`.
- **Headers:** `Authorization: Bearer <accessToken>`
- **Dữ liệu đầu vào:** Không có Body.
- **Dữ liệu đầu ra (Response JSON - HTTP 200 OK):**
  - `role` (String): `"ADMIN"` hoặc `"DATA_ANALYST"`.
  - `permissions` (Array of Strings): Danh sách các mã quyền cụ thể (ví dụ: `["user:read", "user:block", "workspace:create", "system:view_metrics"]`).
  - `isAdmin` (Boolean): `true` / `false`.
- **Ràng buộc nghiệp vụ & Quy trình xử lý:**
  1. Trích xuất danh tính từ token; truy vấn quyền hạn mới nhất của tài khoản từ cơ sở dữ liệu.
  2. Ánh xạ vai trò sang bộ phân quyền chi tiết (RBAC) để Frontend render có điều kiện các nút bấm, menu quản trị mà không cần hardcode logic quyền ở Client.
- **Quyền truy cập:** Yêu cầu đăng nhập.

---

### F1.10: [TÍNH NĂNG ĐỀ XUẤT THÊM] Lấy danh sách các phiên đăng nhập đang hoạt động
- **Mã Endpoint:** `GET /api/v1/auth/sessions`
- **Actor:** `Authenticated User`.
- **Headers:** `Authorization: Bearer <accessToken>`
- **Dữ liệu đầu ra (Response JSON - HTTP 200 OK):**
  - `sessions` (Array of Objects): Danh sách các thiết bị đang đăng nhập tài khoản này:
    `[ { "sessionId", "ipAddress", "userAgent", "isCurrentSession": true/false, "createdAt", "lastActiveAt" } ]`.
- **Mục đích:** Cung cấp dữ liệu để người dùng nhìn thấy thiết bị lạ và bấm nút "Thu hồi phiên từ xa" (gọi F1.8).

---

## MODULE 2: QUẢN LÝ NGƯỜI DÙNG (USERS MANAGEMENT)

---

### F2.1: Lấy hồ sơ tài khoản hiện tại (Current Profile)
- **Mã Endpoint:** `GET /api/v1/users/me`
- **Actor:** `Authenticated User`.
- **Headers:** `Authorization: Bearer <accessToken>`
- **Dữ liệu đầu ra (Response JSON - HTTP 200 OK):**
  - `id`, `email`, `fullName`, `role`, `avatarUrl`, `isBlocked`, `createdAt`.
- **Quyền truy cập:** Xem hồ sơ của chính mình.

---

### F2.2: Cập nhật thông tin hồ sơ (Update Profile)
- **Mã Endpoint:** `PATCH /api/v1/users/me`
- **Actor:** `Authenticated User`.
- **Headers:** `Authorization: Bearer <accessToken>`
- **Dữ liệu đầu vào (Request Body JSON):**
  - `fullName` (String, optional): Họ tên mới (từ 2 đến 100 ký tự).
  - `avatarUrl` (String, optional): URL ảnh đại diện hợp lệ.
- **Dữ liệu đầu ra (Response JSON - HTTP 200 OK):**
  - `id`, `email`, `fullName`, `avatarUrl`, `updatedAt`.
- **Ràng buộc nghiệp vụ & Quy trình xử lý:**
  1. Lấy `userId` từ token. Không cho phép client tự sửa `email` hoặc `role` tại endpoint này.
  2. Cập nhật các trường được truyền lên và lưu vào MongoDB.
- **Quyền truy cập:** Người dùng cập nhật hồ sơ của chính mình.

---

### F2.3: Đổi mật khẩu (Change Password)
- **Mã Endpoint:** `POST /api/v1/users/me/change-password`
- **Actor:** `Authenticated User`.
- **Headers:** `Authorization: Bearer <accessToken>`
- **Dữ liệu đầu vào (Request Body JSON):**
  - `currentPassword` (String): Mật khẩu cũ hiện tại. Bắt buộc.
  - `newPassword` (String): Mật khẩu mới (tuân thủ độ phức tạp). Bắt buộc.
- **Dữ liệu đầu ra (Response JSON - HTTP 200 OK):**
  - `success` (Boolean): `true`.
  - `message` (String): `"Đổi mật khẩu thành công"`.
- **Ràng buộc nghiệp vụ & Quy trình xử lý:**
  1. Trích xuất `userId` từ token; truy vấn tài khoản trong MongoDB.
  2. So khớp `currentPassword` bằng `bcrypt.compare`. Nếu không đúng, trả về HTTP `400 Bad Request` kèm thông báo: *"Mật khẩu hiện tại không đúng"*.
  3. Kiểm tra mật khẩu mới không được trùng với mật khẩu cũ.
  4. Băm mật khẩu mới và lưu vào cơ sở dữ liệu.
- **Quyền truy cập:** Người dùng đổi mật khẩu tài khoản của chính mình.

---

### F2.4: Lấy danh sách tài khoản người dùng theo Cursor Pagination (List Users)
- **Mã Endpoint:** `GET /api/v1/users`
- **Actor:** `Admin`.
- **Headers:** `Authorization: Bearer <accessToken>`
- **Dữ liệu đầu vào (Query Parameters):**
  - `limit` (Integer, optional): Số bản ghi muốn lấy; mặc định `20`, tối đa `100`.
  - `cursor` (String, optional): Con trỏ bản ghi cuối cùng của trang trước (chuỗi Base64 mã hóa `{ createdAt, id }`).
  - `search` (String, optional): Tìm kiếm theo email hoặc họ tên.
  - `status` (Enum, optional): `"ACTIVE"`, `"BLOCKED"`.
- **Dữ liệu đầu ra (Response JSON - HTTP 200 OK):**
  - `data` (Array of Objects): Danh sách người dùng `{ id, email, fullName, role, isBlocked, createdAt }`.
  - `pageInfo` (Object):
    - `hasNextPage` (Boolean): `true` nếu còn trang tiếp theo.
    - `nextCursor` (String hoặc Null): Con trỏ để client truyền vào request sau.
- **Ràng buộc nghiệp vụ & Quy trình xử lý:**
  1. Kiểm tra quyền của Actor: Bắt buộc `user.role === 'ADMIN'`. Nếu không, từ chối với HTTP `403 Forbidden`.
  2. **Giải thuật Cursor Pagination (Phân trang theo con trỏ):**
     - Không sử dụng `skip()` để tránh làm chậm hệ thống khi duyệt hàng trăm nghìn người dùng (Offset Skip Performance Degradation).
     - Nếu có `cursor`, giải mã chuỗi Base64 để lấy `lastCreatedAt` và `lastId`.
     - Xây dựng điều kiện truy vấn: `WHERE (createdAt < lastCreatedAt) OR (createdAt == lastCreatedAt AND _id < lastId) ORDER BY createdAt DESC, _id DESC LIMIT limit + 1`.
  3. Trả về đúng `limit` bản ghi và sinh ra `nextCursor` cho bản ghi cuối cùng.
- **Quyền truy cập:** Chỉ Quản trị viên (Admin).

---

### F2.5: Lấy thông tin tài khoản theo ID (Get User by ID)
- **Mã Endpoint:** `GET /api/v1/users/:userId`
- **Actor:** `Admin`.
- **Headers:** `Authorization: Bearer <accessToken>`
- **Dữ liệu đầu vào:**
  - `userId` (Path Parameter, String).
- **Dữ liệu đầu ra (Response JSON - HTTP 200 OK):**
  - `id`, `email`, `fullName`, `role`, `isBlocked`, `createdAt`, `workspaceCount`.
- **Ràng buộc nghiệp vụ & Quy trình xử lý:**
  1. Kiểm tra quyền `ADMIN`.
  2. Truy vấn tài khoản theo `userId`. Nếu không thấy, trả về HTTP `404 Not Found`.
- **Quyền truy cập:** Chỉ Admin.

---

### F2.6: Khóa tài khoản người dùng (Block User)
- **Mã Endpoint:** `PATCH /api/v1/users/:userId/block`
- **Actor:** `Admin`.
- **Headers:** `Authorization: Bearer <accessToken>`
- **Dữ liệu đầu vào:**
  - `userId` (Path Parameter, String).
  - Request Body (JSON, optional): `{ "reason": "Vi phạm chính sách dữ liệu" }`.
- **Dữ liệu đầu ra (Response JSON - HTTP 200 OK):**
  - `success`: `true`, `userId`, `isBlocked`: `true`, `message`: `"Tài khoản đã bị khóa"`.
- **Ràng buộc nghiệp vụ & Quy trình xử lý:**
  1. Kiểm tra quyền `ADMIN`.
  2. Không cho phép Admin tự khóa chính tài khoản của mình (`userId === admin.id` $\implies$ HTTP `400 Bad Request`).
  3. Cập nhật `isBlocked = true` trong collection `users`.
  4. Hủy toàn bộ các phiên làm việc đang hoạt động của người dùng này trong `user_sessions` để ngắt kết nối lập tức.
- **Quyền truy cập:** Chỉ Admin.

---

### F2.7: Mở khóa tài khoản người dùng (Unblock User)
- **Mã Endpoint:** `PATCH /api/v1/users/:userId/unblock`
- **Actor:** `Admin`.
- **Headers:** `Authorization: Bearer <accessToken>`
- **Dữ liệu đầu vào:**
  - `userId` (Path Parameter, String).
- **Dữ liệu đầu ra (Response JSON - HTTP 200 OK):**
  - `success`: `true`, `userId`, `isBlocked`: `false`, `message`: `"Tài khoản đã được mở khóa"`.
- **Ràng buộc nghiệp vụ & Quy trình xử lý:**
  1. Kiểm tra quyền `ADMIN`. Cập nhật `isBlocked = false`.
- **Quyền truy cập:** Chỉ Admin.

---

## MODULE 3: KHÔNG GIAN LÀM VIỆC (WORKSPACE)

---

### F3.1: Tạo Không gian làm việc mới
- **Mã Endpoint:** `POST /api/v1/workspaces`
- **Actor:** `Data Analyst`, `Admin`.
- **Headers:** `Authorization: Bearer <accessToken>`
- **Dữ liệu đầu vào (Request Body JSON):**
  - `name` (String): Tên Workspace (từ 3 đến 100 ký tự). Bắt buộc.
  - `description` (String, optional): Mô tả dự án (tối đa 500 ký tự).
- **Dữ liệu đầu ra (Response JSON - HTTP 201 Created):**
  - `workspaceId`, `name`, `description`, `ownerId`, `projectCount: 0`, `createdAt`.
- **Ràng buộc nghiệp vụ & Quy trình xử lý:**
  1. Trích xuất `ownerId` từ token. Kiểm tra tính hợp lệ của `name`.
  2. Kiểm tra tính duy nhất: Người dùng không được tạo Workspace trùng tên với một Workspace chưa bị xóa (`deleted_at: null`) của chính mình.
  3. Khởi tạo bản ghi với `deleted_at: null`, lưu vào `workspaces`.
- **Quyền truy cập:** Người dùng đã đăng nhập.

---

### F3.2: Lấy danh sách Không gian làm việc
- **Mã Endpoint:** `GET /api/v1/workspaces`
- **Actor:** `Data Analyst`, `Admin`.
- **Headers:** `Authorization: Bearer <accessToken>`
- **Dữ liệu đầu vào (Query Parameters):**
  - `page` (Integer, optional): Mặc định `1`.
  - `limit` (Integer, optional): Mặc định `10`.
  - `search` (String, optional): Tìm kiếm theo tên.
- **Dữ liệu đầu ra (Response JSON - HTTP 200 OK):**
  - `data` (Array of Objects): `{ workspaceId, name, description, projectCount, updatedAt }`.
  - `pagination`: `{ page, limit, totalItems, totalPages }`.
- **Ràng buộc nghiệp vụ & Quy trình xử lý:**
  1. Chỉ truy vấn các Workspace có `ownerId = userId` và **`deleted_at: null`** (Bộ lọc Soft Delete).
  2. Trả về kèm trường đếm số lượng Projects trực thuộc.
- **Quyền truy cập:** Chủ sở hữu Workspace.

---

### F3.3: Lấy chi tiết Không gian làm việc
- **Mã Endpoint:** `GET /api/v1/workspaces/:workspaceId`
- **Actor:** `Data Analyst`, `Admin`.
- **Headers:** `Authorization: Bearer <accessToken>`
- **Dữ liệu đầu vào:** `workspaceId` (Path Parameter).
- **Dữ liệu đầu ra (Response JSON - HTTP 200 OK):**
  - `workspaceId`, `name`, `description`, `ownerId`, `createdAt`, `updatedAt`.
  - `projects` (Array of Objects): Danh sách các Project trực thuộc `{ projectId, name, hasDataset, updatedAt }`.
- **Ràng buộc nghiệp vụ & Quy trình xử lý:**
  1. Truy vấn `workspaces` với điều kiện `_id = workspaceId` và `deleted_at: null`. Nếu không có, trả về HTTP `404 Not Found`.
  2. Kiểm tra quyền sở hữu (`ownerId === userId` hoặc Admin).
  3. Nạp danh sách các Projects thuộc Workspace này có `deleted_at: null`.
- **Quyền truy cập:** Chủ sở hữu hoặc Admin.

---

### F3.4: Cập nhật Không gian làm việc
- **Mã Endpoint:** `PATCH /api/v1/workspaces/:workspaceId`
- **Actor:** `Workspace Owner`, `Admin`.
- **Headers:** `Authorization: Bearer <accessToken>`
- **Dữ liệu đầu vào (Request Body JSON):**
  - `name` (String, optional), `description` (String, optional).
- **Dữ liệu đầu ra (Response JSON - HTTP 200 OK):**
  - `workspaceId`, `name`, `description`, `updatedAt`.
- **Quyền truy cập:** Chủ sở hữu Workspace.

---

### F3.5: Xóa Không gian làm việc (Soft Delete)
- **Mã Endpoint:** `DELETE /api/v1/workspaces/:workspaceId`
- **Actor:** `Workspace Owner`, `Admin`.
- **Headers:** `Authorization: Bearer <accessToken>`
- **Dữ liệu đầu vào:** `workspaceId` (Path Parameter).
- **Dữ liệu đầu ra (Response JSON - HTTP 200 OK):**
  - `success`: `true`, `message`: `"Không gian làm việc đã được chuyển vào thùng rác (Soft Delete)"`.
- **Ràng buộc nghiệp vụ & Quy trình xử lý:**
  1. Xác thực quyền sở hữu Workspace.
  2. **Thực thi Xóa mềm dạng thác (Cascading Soft Delete):**
     - Cập nhật bản ghi Workspace: `deleted_at = now()`, `deletedBy = userId`.
     - Cập nhật toàn bộ các Projects thuộc Workspace này: `deleted_at = now()`.
     - Cập nhật toàn bộ các Datasets thuộc các Projects này: `deleted_at = now()`.
  3. Tuyệt đối không xóa vật lý bản ghi trong database để hỗ trợ khôi phục khi cần.
- **Quyền truy cập:** Chủ sở hữu Workspace.

---

### F3.6: [TÍNH NĂNG ĐỀ XUẤT THÊM] Khôi phục Không gian làm việc từ thùng rác (Restore Workspace)
- **Mã Endpoint:** `POST /api/v1/workspaces/:workspaceId/restore`
- **Actor:** `Workspace Owner`, `Admin`.
- **Headers:** `Authorization: Bearer <accessToken>`
- **Dữ liệu đầu ra (Response JSON - HTTP 200 OK):**
  - `success`: `true`, `message`: `"Khôi phục không gian làm việc thành công"`.
- **Quy trình xử lý:** Đặt lại `deleted_at = null` cho Workspace và các Project con.

---

## MODULE 4: DỰ ÁN (PROJECT TRONG WORKSPACE)

---

### F4.1: Tạo Project mới trong Workspace
- **Mã Endpoint:** `POST /api/v1/workspaces/:workspaceId/projects`
- **Actor:** `Data Analyst`, `Admin`.
- **Headers:** `Authorization: Bearer <accessToken>`
- **Dữ liệu đầu vào:**
  - `workspaceId` (Path Parameter, String).
  - Request Body (JSON):
    - `name` (String): Tên dự án (từ 3 đến 100 ký tự). Bắt buộc.
    - `description` (String, optional): Mô tả mục tiêu phân tích.
- **Dữ liệu đầu ra (Response JSON - HTTP 201 Created):**
  - `projectId`, `workspaceId`, `name`, `description`, `hasDataset: false`, `createdAt`.
- **Ràng buộc nghiệp vụ & Quy trình xử lý:**
  1. Kiểm tra tồn tại và quyền sở hữu trên `workspaceId`.
  2. Kiểm tra tên Project không trùng lặp trong cùng một Workspace (`deleted_at: null`).
  3. Khởi tạo bản ghi Project với `deleted_at: null`, `datasetId: null`.
- **Quyền truy cập:** Chủ sở hữu Workspace.

---

### F4.2: Lấy danh sách Project trong Workspace
- **Mã Endpoint:** `GET /api/v1/workspaces/:workspaceId/projects`
- **Actor:** `Data Analyst`, `Admin`.
- **Headers:** `Authorization: Bearer <accessToken>`
- **Dữ liệu đầu vào (Query Parameters):**
  - `page` (Integer, optional), `limit` (Integer, optional), `search` (String, optional).
- **Dữ liệu đầu ra (Response JSON - HTTP 200 OK):**
  - `data` (Array of Objects): `{ projectId, name, description, hasDataset, datasetId, updatedAt }`.
- **Ràng buộc nghiệp vụ & Quy trình xử lý:** Chỉ lấy các Project có `deleted_at: null`.
- **Quyền truy cập:** Thành viên sở hữu Workspace.

---

### F4.3: Lấy chi tiết Project trong Workspace
- **Mã Endpoint:** `GET /api/v1/projects/:projectId`
- **Actor:** `Data Analyst`, `Admin`.
- **Headers:** `Authorization: Bearer <accessToken>`
- **Dữ liệu đầu vào:** `projectId` (Path Parameter).
- **Dữ liệu đầu ra (Response JSON - HTTP 200 OK):**
  - `projectId`, `workspaceId`, `name`, `description`, `dataset`: `{ datasetId, name, rowCount, columnCount, currentVersion }` hoặc `null`.
- **Ràng buộc nghiệp vụ & Quy trình xử lý:**
  1. Kiểm tra `projectId` hợp lệ và `deleted_at: null`.
  2. Kiểm tra quyền sở hữu Workspace chứa Project này.
- **Quyền truy cập:** Chủ sở hữu.

---

### F4.4: Cập nhật Project trong Workspace
- **Mã Endpoint:** `PATCH /api/v1/projects/:projectId`
- **Actor:** `Data Analyst`, `Admin`.
- **Headers:** `Authorization: Bearer <accessToken>`
- **Dữ liệu đầu vào (Request Body JSON):**
  - `name` (String, optional), `description` (String, optional).
- **Dữ liệu đầu ra (Response JSON - HTTP 200 OK):**
  - `projectId`, `name`, `description`, `updatedAt`.
- **Quyền truy cập:** Chủ sở hữu Project.

---

### F4.5: Xóa Project trong Workspace (Soft Delete)
- **Mã Endpoint:** `DELETE /api/v1/projects/:projectId`
- **Actor:** `Data Analyst`, `Admin`.
- **Headers:** `Authorization: Bearer <accessToken>`
- **Dữ liệu đầu vào:** `projectId` (Path Parameter).
- **Dữ liệu đầu ra (Response JSON - HTTP 200 OK):**
  - `success`: `true`, `message`: `"Project đã được chuyển vào thùng rác (Soft Delete)"`.
- **Ràng buộc nghiệp vụ & Quy trình xử lý:**
  1. Đánh dấu Project: `deleted_at = now()`.
  2. Đánh dấu xóa mềm Dataset trực thuộc Project đó (nếu có): `deleted_at = now()`.
- **Quyền truy cập:** Chủ sở hữu Project.

---

## MODULE 5: TẬP DỮ LIỆU (DATASET TRONG PROJECT)

---

### F5.1: Tải tệp dữ liệu lên trong Project (Upload Dataset)
- **Mã Endpoint:** `POST /api/v1/projects/:projectId/datasets/upload`
- **Actor:** `Data Analyst`, `Admin`.
- **Headers bắt buộc:**
  - `Authorization: Bearer <accessToken>`
  - `Content-Type: multipart/form-data`
- **Dữ liệu đầu vào (Form Data):**
  - `file` (Binary): Tệp `.csv`, `.xlsx`, hoặc `.json`. Dung lượng $\le 50$MB (CSV/JSON) hoặc $\le 20$MB (Excel). Bắt buộc.
  - `datasetName` (String, optional): Tên hiển thị của tập dữ liệu.
- **Dữ liệu đầu ra (Response JSON - HTTP 201 Created):**
  - `datasetId`, `projectId`, `name`, `fileFormat`, `fileSizeBytes`, `fileChecksum` (SHA-256 hex), `rowCount`, `columnCount`, `currentVersion: 1`.
  - `columns` (Array of Objects): Danh sách cột trích xuất `{ name, dataType, nullCount, nullRate }`.
- **Ràng buộc nghiệp vụ & Quy trình xử lý:**
  1. **RÀNG BUỘC CỐT LÕI (1 PROJECT = 1 DATASET):**
     - Truy vấn Project theo `projectId`.
     - Kiểm tra xem Project đã có Dataset đang hoạt động (`deleted_at: null`) hay chưa.
     - **Nếu Project ĐÃ CÓ Dataset:** Từ chối ngay lập tức với HTTP `409 Conflict` kèm thông báo: *"Mỗi Dự án chỉ được chứa 1 Tập dữ liệu duy nhất. Vui lòng xóa tập dữ liệu hiện tại trước khi tải lên tệp mới, hoặc tạo một Dự án mới"*.
  2. Kiểm tra định dạng và kích thước file qua Multer Stream Filter.
  3. Đọc dữ liệu theo luồng (Streaming Parser) song song tính toán mã băm **`fileChecksum` (SHA-256)** của toàn bộ tệp để chống tải trùng lặp (Deduplication) và xác minh tính toàn vẹn:
     - CSV/Excel/JSON $\implies$ Phẳng hóa Dot-notation nếu có cấu trúc lồng nhau (tối đa 3 cấp).
     - Kiểm tra giới hạn: Tối đa 100 cột, tối đa 200,000 dòng. Vượt quá sẽ trả về HTTP `422 Unprocessable Entity`.
  4. Lưu dữ liệu bản ghi vào `dataset_records`, lưu metadata kèm `file_checksum` vào `datasets`, khởi tạo mốc phiên bản `v1` (tính `version_hash` SHA-256) trong `dataset_versions` và Neo4j.
  5. Cập nhật `project.datasetId = newDatasetId`, `project.hasDataset = true`.
- **Quyền truy cập:** Chủ sở hữu Project.

---

### F5.2: Lấy thông tin Dataset của Project
- **Mã Endpoint:** `GET /api/v1/projects/:projectId/dataset`
- **Actor:** `Data Analyst`, `Admin`.
- **Headers:** `Authorization: Bearer <accessToken>`
- **Dữ liệu đầu vào:** `projectId` (Path Parameter).
- **Dữ liệu đầu ra (Response JSON - HTTP 200 OK):**
  - `datasetId`, `projectId`, `name`, `rowCount`, `columnCount`, `currentVersion`, `columns`, `createdAt`.
- **Ràng buộc nghiệp vụ:** Nếu Project chưa có dataset hoặc dataset đã bị xóa mềm, trả về HTTP `404 Not Found`.
- **Quyền truy cập:** Thành viên sở hữu Project.

---

### F5.3: Xóa tệp dữ liệu trong Project (Soft Delete Dataset)
- **Mã Endpoint:** `DELETE /api/v1/projects/:projectId/dataset`
- **Actor:** `Data Analyst`, `Admin`.
- **Headers:** `Authorization: Bearer <accessToken>`
- **Dữ liệu đầu vào:** `projectId` (Path Parameter).
- **Dữ liệu đầu ra (Response JSON - HTTP 200 OK):**
  - `success`: `true`, `message`: `"Tập dữ liệu đã được xóa mềm khỏi Project thành công"`.
- **Ràng buộc nghiệp vụ & Quy trình xử lý:**
  1. Truy vấn Dataset của Project có `deleted_at: null`.
  2. Đánh dấu xóa mềm: `dataset.deleted_at = now()`.
  3. Cập nhật Project: `project.datasetId = null`, `project.hasDataset = false`.
  4. Sau khi xóa mềm, Project này được giải phóng và **có thể upload một Dataset mới**.
- **Quyền truy cập:** Chủ sở hữu Project.

---

## MODULE 6: TRỰC QUAN HÓA (VISUALIZATION)

---

### F6.1: Xem và Truy vấn Dữ liệu Bảng của Dataset (Data Grid Query)
- **Mã Endpoint:** `POST /api/v1/datasets/:datasetId/query`
- **Actor:** `Data Analyst`, `Admin`.
- **Headers:** `Authorization: Bearer <accessToken>`
- **Dữ liệu đầu vào:**
  - `datasetId` (Path Parameter, String).
  - Request Body (JSON):
    - `version` (Integer, optional): Mặc định phiên bản hiện hành.
    - `page` (Integer): Bắt buộc, $\ge 1$.
    - `pageSize` (Integer): Bắt buộc, từ 10 đến 200.
    - `sortBy` (String, optional): Cột cần sắp xếp.
    - `sortDirection` (Enum, optional): `"asc"` hoặc `"desc"`.
    - `searchKeyword` (String, optional): Tìm kiếm toàn cục.
    - `filters` (Array of Objects, optional): Lọc theo cột `{ column, operator, value }`.
- **Dữ liệu đầu ra (Response JSON - HTTP 200 OK):**
  - `page`, `pageSize`, `totalMatchingRows`, `totalPages`, `rows: [ { _rowId, col1, col2, ... } ]`.
- **Ràng buộc nghiệp vụ & Quy trình xử lý:**
  1. Kiểm tra Dataset tồn tại và `deleted_at: null`.
  2. Xây dựng MongoDB Aggregation có lập chỉ mục để truy vấn dưới 100ms.
- **Quyền truy cập:** Chủ sở hữu Dataset.

---

### F6.2: Thống kê mô tả và Biểu đồ cột (Column Profile & Chart)
- **Mã Endpoint:** `GET /api/v1/datasets/:datasetId/columns/:columnName/profile`
- **Actor:** `Data Analyst`, `Admin`.
- **Headers:** `Authorization: Bearer <accessToken>`
- **Dữ liệu đầu vào:** `datasetId`, `columnName` (Path Parameters), `version` (Query Parameter, optional).
- **Dữ liệu đầu ra (Response JSON - HTTP 200 OK):**
  - Cột số: `{ columnName, dataType, nullCount, nullRate, uniqueCount, statistics: { min, max, mean, median, stdDev }, histogram: [ { binRange, frequency } ] }`.
  - Cột chuỗi: `{ columnName, dataType, nullCount, uniqueCount, topCategories: [ { value, count, percentage } ] }`.
- **Quyền truy cập:** Chủ sở hữu Dataset.

---

## MODULE 7: BIẾN ĐỔI DỮ LIỆU (TRANSFORMATION)

---

### F7.1: Thực thi xử lý làm sạch dữ liệu (Execute Transformation)
- **Mã Endpoint:** `POST /api/v1/datasets/:datasetId/transformations`
- **Actor:** `Data Analyst`, `Admin`.
- **Headers:** `Authorization: Bearer <accessToken>`
- **Dữ liệu đầu vào (Request Body JSON):**
  - `currentVersion` (Integer): Phiên bản Client đang thao tác. Bắt buộc.
  - `actionType` (Enum): Bắt buộc. Chấp nhận:
    - `"DROP_NULL_ROWS"`: Xóa dòng có ô trống.
    - `"IMPUTE_VALUE"`: Điền giá trị vào ô trống.
    - `"SANITIZE_STRING"`: Cắt khoảng trắng (Trim), đổi hoa/thường.
    - `"REPLACE_REGEX"`: Tìm và thay thế theo chuỗi / biểu thức chính quy.
    - `"DROP_COLUMN"`: Xóa cột.
    - `"RENAME_COLUMN"`: Đổi tên cột.
  - `targetColumn` (String): Cột áp dụng.
  - `parameters` (Object): Tham số chi tiết theo từng `actionType`.
- **Dữ liệu đầu ra (Response JSON - HTTP 200 OK):**
  - `datasetId`, `previousVersion`, `newVersion`, `actionExecuted`, `rowsAffected`, `newRowCount`, `message`, `updatedAt`.
- **Ràng buộc nghiệp vụ & Quy trình xử lý:**
  1. **Khóa lạc quan:** `currentVersion` gửi lên phải bằng đúng `dataset.currentVersion` trong DB. Nếu lệch, trả về HTTP `409 Conflict`.
  2. Thực thi biến đổi trên `dataset_records` bằng Bulk Write.
  3. Tạo bản ghi mới trong `dataset_versions` lưu Transformation Recipe.
  4. Cập nhật đồ thị Neo4j: `(v_old)-[:TRANSFORMED_BY]->(v_new)`.
  5. Cập nhật `dataset.currentVersion = newVersion`.
- **Quyền truy cập:** Chủ sở hữu Dataset.

---

### F7.2: [TÍNH NĂNG ĐỀ XUẤT THÊM] Chạy thử biến đổi trên mẫu dữ liệu (Dry-Run Transformation)
- **Mã Endpoint:** `POST /api/v1/datasets/:datasetId/transformations/dry-run`
- **Actor:** `Data Analyst`.
- **Headers:** `Authorization: Bearer <accessToken>`
- **Dữ liệu đầu vào:** Giống F7.1.
- **Dữ liệu đầu ra (Response JSON - HTTP 200 OK):**
  - `sampleBefore` (Array): 10 dòng mẫu trước khi xử lý.
  - `sampleAfter` (Array): 10 dòng mẫu sau khi áp dụng công thức.
  - `estimatedRowsAffected` (Number): Ước tính số dòng sẽ bị tác động.
- **Mục đích:** Cho phép người dùng xem trước tác động thực tế trên giao diện trước khi quyết định bấm "Lưu mốc phiên bản chính thức".

---

## MODULE 8: PHIÊN BẢN VÀ NGUỒN GỐC (VERSION AND LINEAGE)

---

### F8.1: Lấy danh sách lịch sử các phiên bản biến đổi (Get Version History)
- **Mã Endpoint:** `GET /api/v1/datasets/:datasetId/versions`
- **Actor:** `Data Analyst`, `Admin`.
- **Headers:** `Authorization: Bearer <accessToken>`
- **Dữ liệu đầu vào:** `datasetId` (Path Parameter).
- **Dữ liệu đầu ra (Response JSON - HTTP 200 OK):**
  - `datasetId`, `currentVersion`.
  - `history` (Array of Objects):
    `[ { "versionId", "versionNumber", "versionHash", "parentHash", "actionType", "targetColumn", "rowsAffected", "rowCount", "createdAt" } ]`.
- **Quyền truy cập:** Chủ sở hữu Dataset.

---

### F8.2: Quay lại phiên bản bất kỳ theo ID phiên bản (Rollback to Version)
- **Mã Endpoint:** `POST /api/v1/datasets/:datasetId/rollback`
- **Actor:** `Data Analyst`, `Admin`.
- **Headers:** `Authorization: Bearer <accessToken>`
- **Dữ liệu đầu vào (Request Body JSON):**
  - `targetVersionNumber` (Integer): Số phiên bản muốn quay về ($1 \le target < currentVersion$). Bắt buộc.
- **Dữ liệu đầu ra (Response JSON - HTTP 200 OK):**
  - `datasetId`, `previousVersion`, `currentVersion`: `targetVersionNumber`, `rowCount`, `columnCount`, `message`: `"Hoàn tác thành công về phiên bản chỉ định"`.
- **Ràng buộc nghiệp vụ & Quy trình xử lý:**
  1. Kiểm tra `targetVersionNumber` hợp lệ và tồn tại trong `dataset_versions`.
  2. Cập nhật con trỏ `dataset.currentVersion = targetVersionNumber`.
  3. Dữ liệu bảng khi truy vấn lại sẽ hiển thị đúng trạng thái của phiên bản mục tiêu đó.
- **Quyền truy cập:** Chủ sở hữu Dataset.

---

### F8.3: [TÍNH NĂNG ĐỀ XUẤT THÊM] Lấy đồ thị Data Lineage trực quan
- **Mã Endpoint:** `GET /api/v1/datasets/:datasetId/lineage`
- **Actor:** `Data Analyst`.
- **Headers:** `Authorization: Bearer <accessToken>`
- **Dữ liệu đầu ra (Response JSON - HTTP 200 OK):**
  - `nodes` (Array): Các đỉnh phiên bản `{ id, version, label, rowCount, versionHash }`.
  - `edges` (Array): Các cạnh biến đổi `{ source, target, action }`.
- **Mục đích:** Cung cấp dữ liệu cho thư viện React Flow vẽ sơ đồ nguồn gốc dữ liệu trực quan trên giao diện Web.

---

### F8.4: [TÍNH NĂNG ĐỀ XUẤT THÊM] Xác thực tính toàn vẹn chuỗi phiên bản (Verify Version Integrity via SHA-256)
- **Mã Endpoint:** `POST /api/v1/datasets/:datasetId/versions/verify-integrity`
- **Actor:** `Data Analyst`, `Admin`.
- **Headers:** `Authorization: Bearer <accessToken>`
- **Dữ liệu đầu ra (Response JSON - HTTP 200 OK):**
  - `datasetId`, `isChainValid` (Boolean), `totalVersionsChecked` (Integer), `brokenVersion` (Integer | null), `message` (String).
- **Ràng buộc nghiệp vụ & Quy trình xử lý:**
  1. Lấy toàn bộ các mốc phiên bản của Dataset từ `v1` đến `currentVersion`.
  2. Tính toán lại mã băm kiểm tra: `SHA256(parent_hash + version_number + operations_json + data_checksum)`.
  3. So khớp với `version_hash` lưu trong `dataset_versions`. Nếu phát hiện bất kỳ phiên bản nào bị chỉnh sửa trái phép (giả mạo số liệu trực tiếp trong MongoDB), trả về `isChainValid: false` và chỉ rõ `brokenVersion`.
- **Quyền truy cập:** Chủ sở hữu Dataset.

---

## MODULE 9: XUẤT BẢN DỮ LIỆU (EXPORT)

---

### F9.1: Tải tệp sau khi xử lý về máy (Download Clean Dataset)
- **Mã Endpoint:** `GET /api/v1/datasets/:datasetId/export/download`
- **Actor:** `Data Analyst`, `Admin`.
- **Headers:** `Authorization: Bearer <accessToken>`
- **Dữ liệu đầu vào (Query Parameters):**
  - `version` (Integer, optional): Phiên bản muốn xuất; mặc định phiên bản hiện hành.
  - `format` (Enum): Bắt buộc. `"csv"`, `"xlsx"`, hoặc `"json"`.
  - `encrypt` (Boolean, optional): Mặc định `false`. Nếu `true`, file tải về sẽ được mã hóa đối xứng bảo vệ bằng AES-256-GCM.
  - `password` (String, optional): Mật khẩu bảo vệ tệp (Bắt buộc nếu `encrypt = true`, tối thiểu 8 ký tự).
- **Dữ liệu đầu ra (Binary File Stream - HTTP 200 OK):**
  - Headers:
    - `Content-Type`: Nếu không mã hóa thì trả về MIME tương ứng (`text/csv; charset=utf-8` có BOM, `.xlsx`, `.json`). Nếu `encrypt = true`, trả về `application/octet-stream`.
    - `Content-Disposition`: `attachment; filename="{dataset_name}_v{version}.{format}{.enc if encrypt}"`.
  - Body: Luồng nhị phân tệp dữ liệu sạch (hoặc đã được mã hóa AES-256-GCM).
- **Ràng buộc nghiệp vụ:** Sử dụng MongoDB Cursor đọc streaming theo batch 1,000 dòng để chống tràn RAM Backend khi tải file lớn; nếu có `encrypt=true`, pipe qua cipher AES-256-GCM on-the-fly.
- **Quyền truy cập:** Chủ sở hữu Dataset.

---

### F9.2: Lưu dữ liệu đã xử lý thành Dataset mới (Save as New Dataset)
- **Mã Endpoint:** `POST /api/v1/datasets/:datasetId/export/save-as-new`
- **Actor:** `Data Analyst`, `Admin`.
- **Headers:** `Authorization: Bearer <accessToken>`
- **Dữ liệu đầu vào (Request Body JSON):**
  - `version` (Integer, optional): Phiên bản dữ liệu nguồn cần nhân bản.
  - `newDatasetName` (String): Tên của bộ dữ liệu mới (từ 3 đến 100 ký tự). Bắt buộc.
  - `targetProjectId` (String): ID của Dự án đích muốn lưu Dataset mới này vào. Bắt buộc.
- **Dữ liệu đầu ra (Response JSON - HTTP 201 Created):**
  - `newDatasetId`, `projectId`: `targetProjectId`, `name`: `newDatasetName`, `rowCount`, `currentVersion: 1`, `message`: `"Đã lưu dữ liệu sạch thành Dataset mới thành công"`.
- **Ràng buộc nghiệp vụ & Quy trình xử lý:**
  1. Xác thực quyền đọc tại Dataset nguồn và quyền ghi tại `targetProjectId`.
  2. **Kiểm tra ràng buộc 1 Project = 1 Dataset:** `targetProjectId` bắt buộc **chưa có Dataset nào** (`hasDataset == false`). Nếu đã có, từ chối với HTTP `409 Conflict`.
  3. Sao chép dữ liệu từ mốc phiên bản chỉ định sang gắn với `newDatasetId`.
  4. Cập nhật `project.datasetId = newDatasetId`, `project.hasDataset = true`.
- **Quyền truy cập:** Chủ sở hữu của Project đích.

---

### F9.3: [TÍNH NĂNG ĐỀ XUẤT THÊM] Xem trước dữ liệu trước khi xuất bản (Preview Clean Data)
- **Mã Endpoint:** `GET /api/v1/datasets/:datasetId/export/preview`
- **Actor:** `Data Analyst`.
- **Headers:** `Authorization: Bearer <accessToken>`
- **Dữ liệu đầu vào (Query Parameters):** `version` (Integer, optional), `limit` (Integer, optional, mặc định 20, tối đa 50).
- **Dữ liệu đầu ra (Response JSON - HTTP 200 OK):**
  - `totalRows`, `previewRows: [ ... ]`.
- **Mục đích:** Cho phép người dùng nhìn thấy 20 dòng dữ liệu thực tế trước khi bấm tải file về máy.

---

## BẢNG TỔNG KẾT DANH MỤC ENDPOINTS

| STT | Module | Endpoint | Method | Trạng thái |
|:---:|---|---|:---:|:---:|
| 1 | **AUTH** | `/api/v1/auth/register` | `POST` | Bắt buộc |
| 2 | **AUTH** | `/api/v1/auth/login` | `POST` | Bắt buộc |
| 3 | **AUTH** | `/api/v1/auth/google` | `POST` | Bắt buộc |
| 4 | **AUTH** | `/api/v1/auth/forgot-password` | `POST` | Bắt buộc |
| 5 | **AUTH** | `/api/v1/auth/reset-password` | `POST` | Bắt buộc |
| 6 | **AUTH** | `/api/v1/auth/refresh-token` | `POST` | Bắt buộc |
| 7 | **AUTH** | `/api/v1/auth/logout` | `POST` | Bắt buộc |
| 8 | **AUTH** | `/api/v1/auth/sessions/:sessionId` | `DELETE` | Bắt buộc |
| 9 | **AUTH** | `/api/v1/auth/permissions` | `GET` | Bắt buộc |
| 10 | **AUTH** | `/api/v1/auth/sessions` | `GET` | *Đề xuất thêm* |
| 11 | **USER** | `/api/v1/users/me` | `GET` | Bắt buộc |
| 12 | **USER** | `/api/v1/users/me` | `PATCH` | Bắt buộc |
| 13 | **USER** | `/api/v1/users/me/change-password` | `POST` | Bắt buộc |
| 14 | **USER** | `/api/v1/users` (Cursor Paginated) | `GET` | Bắt buộc |
| 15 | **USER** | `/api/v1/users/:userId` | `GET` | Bắt buộc |
| 16 | **USER** | `/api/v1/users/:userId/block` | `PATCH` | Bắt buộc |
| 17 | **USER** | `/api/v1/users/:userId/unblock` | `PATCH` | Bắt buộc |
| 18 | **WORKSPACE** | `/api/v1/workspaces` | `POST` | Bắt buộc |
| 19 | **WORKSPACE** | `/api/v1/workspaces` | `GET` | Bắt buộc |
| 20 | **WORKSPACE** | `/api/v1/workspaces/:workspaceId` | `GET` | Bắt buộc |
| 21 | **WORKSPACE** | `/api/v1/workspaces/:workspaceId` | `PATCH` | Bắt buộc |
| 22 | **WORKSPACE** | `/api/v1/workspaces/:workspaceId` (Soft Delete) | `DELETE` | Bắt buộc |
| 23 | **WORKSPACE** | `/api/v1/workspaces/:workspaceId/restore` | `POST` | *Đề xuất thêm* |
| 24 | **PROJECT** | `/api/v1/workspaces/:workspaceId/projects` | `POST` | Bắt buộc |
| 25 | **PROJECT** | `/api/v1/workspaces/:workspaceId/projects` | `GET` | Bắt buộc |
| 26 | **PROJECT** | `/api/v1/projects/:projectId` | `GET` | Bắt buộc |
| 27 | **PROJECT** | `/api/v1/projects/:projectId` | `PATCH` | Bắt buộc |
| 28 | **PROJECT** | `/api/v1/projects/:projectId` (Soft Delete) | `DELETE` | Bắt buộc |
| 29 | **PROJECT** | `/api/v1/projects/:projectId/restore` | `POST` | *Đề xuất thêm* |
| 30 | **DATASET** | `/api/v1/projects/:projectId/datasets/upload` (1:1 Constraint) | `POST` | Bắt buộc |
| 31 | **DATASET** | `/api/v1/projects/:projectId/dataset` | `GET` | Bắt buộc |
| 32 | **DATASET** | `/api/v1/projects/:projectId/dataset` (Soft Delete) | `DELETE` | Bắt buộc |
| 33 | **VISUALIZE** | `/api/v1/datasets/:datasetId/query` | `POST` | Bắt buộc |
| 34 | **VISUALIZE** | `/api/v1/datasets/:datasetId/columns/:columnName/profile` | `GET` | Bắt buộc |
| 35 | **TRANSFORM** | `/api/v1/datasets/:datasetId/transformations` | `POST` | Bắt buộc |
| 36 | **TRANSFORM** | `/api/v1/datasets/:datasetId/transformations/dry-run` | `POST` | *Đề xuất thêm* |
| 37 | **VERSION** | `/api/v1/datasets/:datasetId/versions` | `GET` | Bắt buộc |
| 38 | **VERSION** | `/api/v1/datasets/:datasetId/rollback` | `POST` | Bắt buộc |
| 39 | **VERSION** | `/api/v1/datasets/:datasetId/lineage` | `GET` | *Đề xuất thêm* |
| 40 | **VERSION** | `/api/v1/datasets/:datasetId/versions/verify-integrity` | `POST` | *Đề xuất thêm* |
| 41 | **EXPORT** | `/api/v1/datasets/:datasetId/export/download` (Hỗ trợ AES-256) | `GET` | Bắt buộc |
| 42 | **EXPORT** | `/api/v1/datasets/:datasetId/export/save-as-new` | `POST` | Bắt buộc |
| 43 | **EXPORT** | `/api/v1/datasets/:datasetId/export/preview` | `GET` | *Đề xuất thêm* |
