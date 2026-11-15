# ĐẶC TẢ CHI TIẾT TÍNH NĂNG VÀ HỢP ĐỒNG API CHUẨN DOANH NGHIỆP - GIAI ĐOẠN 1
**Dự án:** Nền tảng Full-stack Quản lý & Giám sát Chất lượng Dữ liệu có AI Hỗ trợ  
*(Full-Stack Data Management & Quality Assurance Platform with AI Assistance)*  
**Tập tin:** `docs/feature_spec_v3.md`  
**Phiên bản:** v3.0  
**Giai đoạn áp dụng:** Giai đoạn 1 (Core Platform MVP - Khung nền tảng chạy độc lập)  
**Ngày lập:** 19/10/2026  
**Trạng thái tài liệu:** Tài liệu đặc tả chuẩn hóa toàn bộ các Endpoints theo cấu trúc chuẩn nghiệp vụ và kỹ thuật  

---

## Lịch sử thay đổi (Change Log v2.0 ➔ v3.0)
- **Thay đổi gì:** Tái cấu trúc toàn bộ danh mục tính năng và API sang **Cấu trúc Đặc tả Chuẩn Doanh nghiệp (Enterprise Standard Specification)** gồm 6 mục bắt buộc cho từng Endpoint:
  1. **Mã Endpoint** (HTTP Method + URI chuẩn RESTful).
  2. **Actor** (Chủ thể thực hiện: Public, Data Analyst, Admin, Viewer).
  3. **Dữ liệu đầu vào** (Headers, Path Params, Query Params, Request Body JSON với kiểu dữ liệu và ràng buộc validation cụ thể).
  4. **Dữ liệu đầu ra** (Mã HTTP Status, Response JSON Schema với các trường cụ thể).
  5. **Ràng buộc nghiệp vụ & Quy trình xử lý** (Các bước xác thực token, kiểm tra quyền sở hữu, kiểm tra tính hợp lệ, biến đổi trạng thái, atomic commit và mã lỗi phản hồi).
  6. **Quyền truy cập** (Phạm vi phân quyền chi tiết).
- **Lý do:** Chuẩn hóa tài liệu kỹ thuật theo đúng cấu trúc mẫu yêu cầu, đảm bảo tính chặt chẽ, không mơ hồ, loại bỏ hoàn toàn các giả định ngầm giữa lập trình viên Frontend và Backend.
- **Ảnh hưởng đến đâu:** Là tài liệu quy chuẩn kỹ thuật chính thức và bất biến để triển khai mã nguồn Backend NestJS, thiết kế DTO (Data Transfer Objects), Guards, Interceptors và viết Unit/E2E Tests.

---

## MỤC LỤC DANH MỤC ENDPOINTS

1. **Phân hệ 1: Quản trị Tài khoản & Phiên làm việc (AUTH & USER)**
   - `POST /api/v1/auth/register` (F1.1: Đăng ký tài khoản)
   - `POST /api/v1/auth/login` (F1.2: Đăng nhập hệ thống)
   - `POST /api/v1/auth/refresh-token` (F1.3: Làm mới Access Token)
   - `POST /api/v1/auth/logout` (F1.4: Đăng xuất tài khoản)
   - `GET /api/v1/users/me` (F1.5: Lấy thông tin tài khoản hiện tại)
2. **Phân hệ 2: Quản lý Không gian làm việc (WORKSPACE)**
   - `POST /api/v1/workspaces` (F2.1: Tạo Không gian làm việc mới)
   - `GET /api/v1/workspaces` (F2.2: Lấy danh sách Không gian làm việc)
   - `GET /api/v1/workspaces/:workspaceId` (F2.3: Lấy chi tiết Không gian làm việc)
   - `PATCH /api/v1/workspaces/:workspaceId` (F2.4: Cập nhật Không gian làm việc)
   - `DELETE /api/v1/workspaces/:workspaceId` (F2.5: Xóa Không gian làm việc)
3. **Phân hệ 3: Tiếp nhận và Quản lý Tệp Dữ liệu (DATASET)**
   - `POST /api/v1/workspaces/:workspaceId/datasets/upload` (F3.1: Tải lên tệp dữ liệu)
   - `GET /api/v1/workspaces/:workspaceId/datasets` (F3.2: Danh sách Datasets trong Workspace)
   - `GET /api/v1/datasets/:datasetId` (F3.3: Lấy siêu dữ liệu chi tiết của Dataset)
   - `DELETE /api/v1/datasets/:datasetId` (F3.4: Xóa Dataset)
4. **Phân hệ 4: Bảng Dữ liệu & Trực quan hóa (DATA GRID & VISUALIZATION)**
   - `POST /api/v1/datasets/:datasetId/query` (F4.1: Truy vấn bảng dữ liệu ảo hóa)
   - `GET /api/v1/datasets/:datasetId/columns/:columnName/profile` (F4.2: Thống kê & Biểu đồ cột)
5. **Phân hệ 5: Biến đổi Dữ liệu (TRANSFORMATION)**
   - `POST /api/v1/datasets/:datasetId/transformations` (F5.1: Thực thi biến đổi/làm sạch)
6. **Phân hệ 6: Quản lý Phiên bản & Truy vết (VERSIONING & LINEAGE)**
   - `GET /api/v1/datasets/:datasetId/versions` (F6.1: Lịch sử các phiên bản biến đổi)
   - `POST /api/v1/datasets/:datasetId/rollback` (F6.2: Hoàn tác về phiên bản trước - Undo)
   - `GET /api/v1/datasets/:datasetId/lineage` (F6.3: Truy vấn đồ thị nguồn gốc Data Lineage)
7. **Phân hệ 7: Xuất bản Dữ liệu (EXPORT)**
   - `GET /api/v1/datasets/:datasetId/export/preview` (F7.1: Xem trước dữ liệu sạch)
   - `GET /api/v1/datasets/:datasetId/export/download` (F7.2: Tải về tệp dữ liệu sạch)
   - `POST /api/v1/datasets/:datasetId/export/save-as-new` (F7.3: Lưu thành Dataset mới)

---

## ĐẶC TẢ CHI TIẾT TỪNG ENDPOINT

### PHÂN HỆ 1: QUẢN TRỊ TÀI KHOẢN & PHIÊN LÀM VIỆC (AUTH & USER)

---

#### 1.1. Đăng ký tài khoản người dùng mới
- **Mã Endpoint:** `POST /api/v1/auth/register`
- **Actor:** `Guest / Anonymous` (Người dùng vãng lai chưa xác thực).
- **Dữ liệu đầu vào (Request Body JSON):**
  - `email` (String): Địa chỉ email cá nhân hoặc tổ chức; định dạng chuẩn RFC 5322. Bắt buộc.
  - `password` (String): Mật khẩu người dùng; độ dài tối thiểu 8 ký tự, tối đa 64 ký tự, chứa ít nhất 1 chữ hoa, 1 chữ thường, 1 chữ số và 1 ký tự đặc biệt. Bắt buộc.
  - `fullName` (String): Họ và tên đầy đủ của người dùng; độ dài từ 2 đến 100 ký tự. Bắt buộc.
- **Dữ liệu đầu ra (Response JSON - HTTP 201 Created):**
  - `userId` (String): Mã định danh duy nhất của người dùng vừa tạo (MongoDB ObjectId).
  - `email` (String): Địa chỉ email đã đăng ký.
  - `fullName` (String): Họ và tên người dùng.
  - `role` (String): Quyền hạn mặc định (`"DATA_ANALYST"`).
  - `createdAt` (String ISO-8601): Thời điểm tài khoản được khởi tạo.
- **Ràng buộc nghiệp vụ & Quy trình xử lý:**
  1. Kiểm tra tính hợp lệ của `email`, `password`, `fullName`. Loại bỏ khoảng trắng thừa đầu/cuối của `email` và `fullName`. Chuyển đổi `email` về chữ thường (lowercase) trước khi kiểm tra.
  2. Truy vấn MongoDB collection `users` theo `email`. Nếu email đã tồn tại, từ chối yêu cầu với HTTP `409 Conflict` kèm thông báo: *"Địa chỉ email đã được đăng ký trên hệ thống"*.
  3. Băm mật khẩu bằng thuật toán `bcrypt` với `saltRounds = 10`. Tuyệt đối không lưu mật khẩu thô trong cơ sở dữ liệu hoặc ghi log hệ thống.
  4. Khởi tạo đối tượng người dùng với quyền mặc định `role: "DATA_ANALYST"`, trạng thái hoạt động `status: "ACTIVE"`.
  5. Ghi bản ghi vào cơ sở dữ liệu MongoDB. Nếu ghi thất bại, trả về HTTP `500 Internal Server Error`.
- **Quyền truy cập:** Công khai (Public). Không yêu cầu Access Token.

---

#### 1.2. Đăng nhập hệ thống
- **Mã Endpoint:** `POST /api/v1/auth/login`
- **Actor:** `Guest / Anonymous`.
- **Dữ liệu đầu vào (Request Body JSON):**
  - `email` (String): Email đăng nhập. Bắt buộc.
  - `password` (String): Mật khẩu đăng nhập. Bắt buộc.
- **Dữ liệu đầu ra (Response JSON - HTTP 200 OK):**
  - `accessToken` (String): Chuỗi JWT xác thực (hạn sử dụng 15 phút, thuật toán HMAC-SHA256).
  - `refreshToken` (String): Chuỗi token ngẫu nhiên bảo mật dùng để làm mới phiên (hạn dùng 7 ngày).
  - `tokenType` (String): `"Bearer"`.
  - `expiresIn` (Number): Thời gian sống của Access Token tính bằng giây (`900`).
  - `user` (Object): `{ "id", "email", "fullName", "role" }`.
- **Ràng buộc nghiệp vụ & Quy trình xử lý:**
  1. Chuẩn hóa `email` về chữ thường, kiểm tra `email` và `password` không được để trống. Nếu rỗng, trả về HTTP `400 Bad Request`.
  2. Truy vấn người dùng theo `email`. Nếu không tìm thấy hoặc người dùng có `status != 'ACTIVE'`, trả về HTTP `401 Unauthorized` kèm thông báo: *"Email hoặc mật khẩu không chính xác"*. (Không tiết lộ tài khoản có tồn tại hay không để phòng chống tấn công dò quét tài khoản).
  3. So khớp `password` bằng `bcrypt.compare()`. Nếu sai mật khẩu, tăng biến đếm số lần sai liên tiếp. Nếu sai quá 5 lần, tạm khóa tài khoản trong 15 phút và trả về HTTP `429 Too Many Requests`.
  4. Tạo `accessToken` chứa Payload tối thiểu: `{ "sub": user.id, "email": user.email, "role": user.role }`.
  5. Tạo `refreshToken` bảo mật, băm chuỗi refresh token bằng SHA-256 và lưu vào MongoDB collection `refresh_tokens` gắn với `userId` cùng thời điểm hết hạn để hỗ trợ cơ chế thu hồi (Revocation).
- **Quyền truy cập:** Công khai (Public).

---

#### 1.3. Làm mới Access Token
- **Mã Endpoint:** `POST /api/v1/auth/refresh-token`
- **Actor:** `Client Application / Authenticated User`.
- **Dữ liệu đầu vào (Request Body JSON):**
  - `refreshToken` (String): Chuỗi refresh token hợp lệ đã được cấp trước đó. Bắt buộc.
- **Dữ liệu đầu ra (Response JSON - HTTP 200 OK):**
  - `accessToken` (String): Chuỗi JWT mới (hạn sử dụng 15 phút).
  - `expiresIn` (Number): `900`.
- **Ràng buộc nghiệp vụ & Quy trình xử lý:**
  1. Kiểm tra `refreshToken` không được rỗng.
  2. Băm chuỗi `refreshToken` gửi lên bằng SHA-256 và đối chiếu trong cơ sở dữ liệu `refresh_tokens`.
  3. Nếu không tìm thấy token hoặc token đã hết hạn (`expiresAt < now`), từ chối với HTTP `401 Unauthorized` và thông báo: *"Phiên làm việc đã hết hạn, vui lòng đăng nhập lại"*.
  4. Nếu hợp lệ, sinh `accessToken` mới với thông tin người dùng hiện tại và trả về client.
- **Quyền truy cập:** Công khai (yêu cầu sở hữu Refresh Token hợp lệ).

---

#### 1.4. Đăng xuất tài khoản
- **Mã Endpoint:** `POST /api/v1/auth/logout`
- **Actor:** `Authenticated User` (Người dùng đã đăng nhập).
- **Headers bắt buộc:** `Authorization: Bearer <accessToken>`
- **Dữ liệu đầu vào (Request Body JSON):**
  - `refreshToken` (String): Chuỗi refresh token cần thu hồi. Bắt buộc.
- **Dữ liệu đầu ra (Response JSON - HTTP 200 OK):**
  - `success` (Boolean): `true`.
  - `message` (String): `"Đăng xuất thành công, phiên làm việc đã bị thu hồi"`.
- **Ràng buộc nghiệp vụ & Quy trình xử lý:**
  1. Xác thực `accessToken` qua JwtAuthGuard; trích xuất `userId`.
  2. Tìm và xóa bản ghi `refreshToken` tương ứng trong MongoDB collection `refresh_tokens`.
  3. Sau khi xóa, refresh token này không thể sử dụng để xin access token mới được nữa.
- **Quyền truy cập:** Yêu cầu đăng nhập.

---

#### 1.5. Lấy thông tin người dùng hiện tại
- **Mã Endpoint:** `GET /api/v1/users/me`
- **Actor:** `Authenticated User`.
- **Headers bắt buộc:** `Authorization: Bearer <accessToken>`
- **Dữ liệu đầu vào:** Không có Request Body.
- **Dữ liệu đầu ra (Response JSON - HTTP 200 OK):**
  - `id` (String): ID người dùng.
  - `email` (String): Email tài khoản.
  - `fullName` (String): Họ và tên.
  - `role` (String): Vai trò hệ thống (`"DATA_ANALYST"`, `"ADMIN"`).
  - `createdAt` (String ISO-8601): Thời điểm tạo tài khoản.
- **Ràng buộc nghiệp vụ & Quy trình xử lý:**
  1. Trích xuất `userId` từ `accessToken`. Không nhận `userId` từ Client query hoặc body.
  2. Truy vấn MongoDB collection `users` theo `_id = userId`. Loại trừ trường `passwordHash`.
  3. Nếu không tìm thấy tài khoản (đã bị xóa), trả về HTTP `404 Not Found`.
- **Quyền truy cập:** Người dùng chỉ được xem thông tin của chính mình.

---

### PHÂN HỆ 2: QUẢN LÝ KHÔNG GIAN LÀM VIỆC (WORKSPACE)

---

#### 2.1. Tạo Không gian làm việc mới
- **Mã Endpoint:** `POST /api/v1/workspaces`
- **Actor:** `Data Analyst`, `Admin`.
- **Headers bắt buộc:** `Authorization: Bearer <accessToken>`
- **Dữ liệu đầu vào (Request Body JSON):**
  - `name` (String): Tên không gian làm việc; độ dài từ 3 đến 100 ký tự. Bắt buộc.
  - `description` (String, optional): Mô tả mục đích dự án; tối đa 500 ký tự.
- **Dữ liệu đầu ra (Response JSON - HTTP 201 Created):**
  - `workspaceId` (String): Mã định danh duy nhất của Workspace.
  - `name` (String): Tên Workspace đã chuẩn hóa.
  - `description` (String): Mô tả.
  - `ownerId` (String): ID của người dùng tạo Workspace.
  - `datasetCount` (Number): Khởi tạo là `0`.
  - `createdAt` (String ISO-8601): Thời điểm tạo.
- **Ràng buộc nghiệp vụ & Quy trình xử lý:**
  1. Trích xuất `ownerId` từ danh tính trong `accessToken`.
  2. Kiểm tra `name` không được rỗng sau khi loại bỏ khoảng trắng thừa đầu/cuối.
  3. Kiểm tra tính duy nhất: Một người dùng không được tạo 2 Workspace có cùng tên (so sánh không phân biệt hoa thường). Nếu trùng, trả về HTTP `409 Conflict`.
  4. Lưu bản ghi Workspace vào MongoDB collection `workspaces`.
- **Quyền truy cập:** Người dùng tạo Workspace trở thành Chủ sở hữu (Owner) của Workspace đó.

---

#### 2.2. Lấy danh sách Không gian làm việc
- **Mã Endpoint:** `GET /api/v1/workspaces`
- **Actor:** `Data Analyst`, `Admin`.
- **Headers bắt buộc:** `Authorization: Bearer <accessToken>`
- **Dữ liệu đầu vào (Query Parameters):**
  - `page` (Integer, optional): Trang hiện tại; mặc định `1`, tối thiểu `1`.
  - `limit` (Integer, optional): Số bản ghi/trang; mặc định `10`, tối đa `50`.
  - `search` (String, optional): Từ khóa tìm kiếm theo tên Workspace.
- **Dữ liệu đầu ra (Response JSON - HTTP 200 OK):**
  - `data` (Array of Objects): Danh sách Workspace gồm `{ workspaceId, name, description, datasetCount, updatedAt }`.
  - `pagination` (Object): `{ page, limit, totalItems, totalPages }`.
- **Ràng buộc nghiệp vụ & Quy trình xử lý:**
  1. Lấy `userId` từ token.
  2. Nếu là `ADMIN`, cho phép xem toàn bộ Workspace của hệ thống. Nếu là `DATA_ANALYST`, chỉ truy vấn các Workspace có `ownerId = userId`.
  3. Áp dụng tìm kiếm regex không phân biệt hoa thường nếu có tham số `search`.
  4. Thực hiện phân trang cơ sở dữ liệu (`skip`, `limit`) và sắp xếp theo `updatedAt` giảm dần.
- **Quyền truy cập:** Người dùng chỉ được xem danh sách Workspace do mình sở hữu.

---

#### 2.3. Lấy chi tiết Không gian làm việc
- **Mã Endpoint:** `GET /api/v1/workspaces/:workspaceId`
- **Actor:** `Data Analyst`, `Admin`.
- **Headers bắt buộc:** `Authorization: Bearer <accessToken>`
- **Dữ liệu đầu vào:**
  - `workspaceId` (Path Parameter, String): Mã Workspace. Bắt buộc.
- **Dữ liệu đầu ra (Response JSON - HTTP 200 OK):**
  - `workspaceId`, `name`, `description`, `ownerId`, `createdAt`, `updatedAt`.
  - `datasets` (Array of Objects): Danh sách tóm tắt các tập dữ liệu trực thuộc `{ datasetId, name, fileFormat, rowCount, columnCount, currentVersion, updatedAt }`.
- **Ràng buộc nghiệp vụ & Quy trình xử lý:**
  1. Kiểm tra định dạng `workspaceId` là MongoDB ObjectId hợp lệ.
  2. Truy vấn Workspace. Nếu không tìm thấy, trả về HTTP `404 Not Found`.
  3. Kiểm tra quyền: Nếu `ownerId != userId` và người dùng không có quyền `ADMIN`, từ chối với HTTP `403 Forbidden`.
  4. Nạp danh sách các Datasets thuộc `workspaceId` từ collection `datasets` và trả về.
- **Quyền truy cập:** Chỉ Chủ sở hữu Workspace hoặc Admin mới có quyền truy cập.

---

#### 2.4. Cập nhật Không gian làm việc
- **Mã Endpoint:** `PATCH /api/v1/workspaces/:workspaceId`
- **Actor:** `Workspace Owner`, `Admin`.
- **Headers bắt buộc:** `Authorization: Bearer <accessToken>`
- **Dữ liệu đầu vào:**
  - `workspaceId` (Path Parameter, String).
  - Request Body (JSON):
    - `name` (String, optional): Tên mới của Workspace.
    - `description` (String, optional): Mô tả mới.
- **Dữ liệu đầu ra (Response JSON - HTTP 200 OK):**
  - `workspaceId`, `name`, `description`, `updatedAt`.
- **Ràng buộc nghiệp vụ & Quy trình xử lý:**
  1. Xác thực quyền sở hữu: Người dùng phải là `ownerId` của Workspace. Nếu không, trả về HTTP `403 Forbidden`.
  2. Nếu có `name`, kiểm tra không được rỗng và không trùng lặp với Workspace khác của cùng người dùng đó.
  3. Cập nhật thời điểm `updatedAt = now()` và lưu vào cơ sở dữ liệu.
- **Quyền truy cập:** Chỉ Chủ sở hữu Workspace hoặc Admin.

---

#### 2.5. Xóa Không gian làm việc
- **Mã Endpoint:** `DELETE /api/v1/workspaces/:workspaceId`
- **Actor:** `Workspace Owner`, `Admin`.
- **Headers bắt buộc:** `Authorization: Bearer <accessToken>`
- **Dữ liệu đầu vào:**
  - `workspaceId` (Path Parameter, String).
- **Dữ liệu đầu ra (Response JSON - HTTP 200 OK):**
  - `success` (Boolean): `true`.
  - `message` (String): `"Xóa không gian làm việc và toàn bộ tập dữ liệu liên quan thành công"`.
- **Ràng buộc nghiệp vụ & Quy trình xử lý:**
  1. Xác thực quyền sở hữu Workspace.
  2. **Thực thi Giao dịch nguyên tử (Atomic Database Transaction):**
     - Xóa bản ghi Workspace trong `workspaces`.
     - Xóa toàn bộ các Datasets trực thuộc trong `datasets`.
     - Xóa toàn bộ các bản ghi dữ liệu tương ứng trong `dataset_records` và `dataset_versions`.
     - Xóa các Node tương ứng trong đồ thị Neo4j.
  3. Nếu bất kỳ bước nào lỗi, thực hiện Rollback toàn bộ giao dịch để tránh để lại dữ liệu mồ côi (Orphan Data).
- **Quyền truy cập:** Chỉ Chủ sở hữu Workspace hoặc Admin.

---

### PHÂN HỆ 3: TIẾP NHẬN VÀ QUẢN LÝ TỆP DỮ LIỆU (DATASET)

---

#### 3.1. Tải lên tệp dữ liệu đa định dạng (Upload Dataset)
- **Mã Endpoint:** `POST /api/v1/workspaces/:workspaceId/datasets/upload`
- **Actor:** `Data Analyst`, `Admin`.
- **Headers bắt buộc:**
  - `Authorization: Bearer <accessToken>`
  - `Content-Type: multipart/form-data`
- **Dữ liệu đầu vào (Form Data):**
  - `file` (Binary): Tệp dữ liệu người dùng tải lên. Bắt buộc.
    - Định dạng chấp nhận: `.csv` (`text/csv`), `.xlsx` (`application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`), `.json` (`application/json`).
    - Giới hạn dung lượng: Tối đa 50 MB với CSV/JSON; Tối đa 20 MB với Excel.
  - `datasetName` (String, optional): Tên hiển thị của bộ dữ liệu; mặc định lấy tên file gốc nếu rỗng.
- **Dữ liệu đầu ra (Response JSON - HTTP 201 Created):**
  - `datasetId` (String): Mã định danh tập dữ liệu mới.
  - `workspaceId` (String): Mã Workspace trực thuộc.
  - `name` (String): Tên bộ dữ liệu.
  - `fileFormat` (String): `"CSV"`, `"EXCEL"`, hoặc `"JSON"`.
  - `fileSizeBytes` (Number): Kích thước tệp tính bằng byte.
  - `rowCount` (Number): Tổng số dòng dữ liệu hợp lệ (tối đa 200,000 dòng).
  - `columnCount` (Number): Tổng số cột dữ liệu (tối đa 100 cột).
  - `currentVersion` (Number): Khởi tạo là `1`.
  - `columns` (Array of Objects): Danh sách cột gồm `{ name, dataType, nullCount, nullRate }`.
  - `aiProfile` (Null): Trường dự phòng cho AI ở Giai đoạn 2.
  - `aiRecommendations` (Array rỗng `[]`): Trường dự phòng cho AI ở Giai đoạn 2.
  - `createdAt` (String ISO-8601).
- **Ràng buộc nghiệp vụ & Quy trình xử lý:**
  1. Xác thực quyền ghi vào `workspaceId` của người dùng.
  2. Kiểm tra MIME type và dung lượng file tại bộ lọc Multer. Nếu vượt quá giới hạn dung lượng, từ chối với HTTP `413 Payload Too Large`. Nếu sai định dạng, trả về HTTP `400 Bad Request` kèm thông báo: *"Hệ thống chỉ chấp nhận tệp .csv, .xlsx hoặc .json"*.
  3. Kích hoạt luồng bóc tách dữ liệu theo dòng (Streaming Parser):
     - Không nạp toàn bộ file vào RAM một lần để tránh làm tràn bộ nhớ Node.js.
     - Với file CSV: Dùng `csv-parser` xử lý chunking.
     - Với file Excel: Dùng `exceljs.stream.reader` đọc từng dòng.
     - Với file JSON: Nếu là mảng lồng nhau, kích hoạt Schema Normalizer làm phẳng Dot-notation (giới hạn tối đa 3 cấp).
  4. Đếm số cột: Nếu số cột vượt quá 100 cột, từ chối với HTTP `422 Unprocessable Entity` và thông báo vi phạm giới hạn kỹ thuật.
  5. Đếm số dòng: Nếu số dòng vượt quá 200,000 dòng, từ chối với HTTP `422 Unprocessable Entity`.
  6. Phỏng đoán kiểu dữ liệu (Type Inference) cho từng cột: `integer`, `float`, `string`, `date`, `boolean`.
  7. Lưu metadata vào `datasets`, lưu dữ liệu bản ghi vào `dataset_records` với `version = 1`.
  8. Khởi tạo mốc phiên bản gốc `v1` trong `dataset_versions` và tạo node ban đầu trong Neo4j.
- **Quyền truy cập:** Người dùng có quyền truy cập Workspace đích.

---

#### 3.2. Lấy danh sách Tập dữ liệu trong Không gian làm việc
- **Mã Endpoint:** `GET /api/v1/workspaces/:workspaceId/datasets`
- **Actor:** `Data Analyst`, `Admin`.
- **Headers bắt buộc:** `Authorization: Bearer <accessToken>`
- **Dữ liệu đầu vào:**
  - `workspaceId` (Path Parameter, String).
- **Dữ liệu đầu ra (Response JSON - HTTP 200 OK):**
  - `data` (Array of Objects): Danh sách các tập dữ liệu thuộc Workspace, mỗi phần tử gồm:
    `{ datasetId, name, fileFormat, rowCount, columnCount, currentVersion, createdAt, updatedAt }`.
- **Ràng buộc nghiệp vụ & Quy trình xử lý:**
  1. Xác thực quyền truy cập vào `workspaceId`.
  2. Truy vấn collection `datasets` theo `workspaceId`, sắp xếp theo `updatedAt` mới nhất lên đầu.
- **Quyền truy cập:** Thành viên sở hữu Workspace.

---

#### 3.3. Lấy siêu dữ liệu chi tiết của Tập dữ liệu (Get Dataset Metadata)
- **Mã Endpoint:** `GET /api/v1/datasets/:datasetId`
- **Actor:** `Data Analyst`, `Admin`.
- **Headers bắt buộc:** `Authorization: Bearer <accessToken>`
- **Dữ liệu đầu vào:**
  - `datasetId` (Path Parameter, String).
  - `version` (Query Parameter, Integer, optional): Phiên bản cụ thể cần xem; mặc định lấy `currentVersion`.
- **Dữ liệu đầu ra (Response JSON - HTTP 200 OK):**
  - `datasetId`, `name`, `workspaceId`, `fileFormat`, `rowCount`, `columnCount`, `currentVersion`.
  - `columns` (Array of Objects): Danh sách chi tiết các cột:
    `{ name, dataType, nullCount, nullRate, uniqueCount, aiProfile }`.
  - `createdAt`, `updatedAt`.
- **Ràng buộc nghiệp vụ & Quy trình xử lý:**
  1. Kiểm tra tồn tại của `datasetId`. Nếu không thấy, trả về HTTP `404 Not Found`.
  2. Kiểm tra quyền sở hữu Workspace chứa tập dữ liệu này. Nếu không thuộc quyền, trả về HTTP `403 Forbidden`.
  3. Trích xuất metadata tương ứng với phiên bản `version` được yêu cầu.
- **Quyền truy cập:** Chủ sở hữu tập dữ liệu.

---

#### 3.4. Xóa Tập dữ liệu
- **Mã Endpoint:** `DELETE /api/v1/datasets/:datasetId`
- **Actor:** `Data Analyst`, `Admin`.
- **Headers bắt buộc:** `Authorization: Bearer <accessToken>`
- **Dữ liệu đầu vào:**
  - `datasetId` (Path Parameter, String).
- **Dữ liệu đầu ra (Response JSON - HTTP 200 OK):**
  - `success` (Boolean): `true`.
  - `message` (String): `"Tập dữ liệu và toàn bộ lịch sử phiên bản đã được xóa thành công"`.
- **Ràng buộc nghiệp vụ & Quy trình xử lý:**
  1. Xác thực quyền sở hữu Dataset.
  2. Xóa Dataset trong `datasets`, xóa toàn bộ dữ liệu dòng trong `dataset_records`, xóa toàn bộ các bước biến đổi trong `dataset_versions`, và xóa các Node liên quan trong Neo4j qua Transaction nguyên tử.
- **Quyền truy cập:** Chỉ chủ sở hữu Dataset hoặc Admin.

---

### PHÂN HỆ 4: BẢNG DỮ LIỆU TƯƠNG TÁC & TRỰC QUAN HÓA (GRID & VIS)

---

#### 4.1. Truy vấn dữ liệu bảng có phân trang, lọc và sắp xếp (Query Data Grid)
- **Mã Endpoint:** `POST /api/v1/datasets/:datasetId/query`
- **Actor:** `Data Analyst`, `Admin`.
- **Headers bắt buộc:** `Authorization: Bearer <accessToken>`
- **Dữ liệu đầu vào:**
  - `datasetId` (Path Parameter, String).
  - Request Body (JSON):
    - `version` (Integer, optional): Phiên bản dữ liệu cần truy vấn; mặc định lấy phiên bản hiện tại.
    - `page` (Integer): Số trang cần lấy; tối thiểu `1`, mặc định `1`. Bắt buộc.
    - `pageSize` (Integer): Số dòng trên một trang; tối thiểu `10`, tối đa `200` (để bảo vệ hiệu năng); mặc định `50`. Bắt buộc.
    - `sortBy` (String, optional): Tên cột cần sắp xếp.
    - `sortDirection` (Enum, optional): `"asc"` hoặc `"desc"`.
    - `searchKeyword` (String, optional): Từ khóa tìm kiếm toàn cục trên tất cả các cột chuỗi.
    - `filters` (Array of Objects, optional): Danh sách bộ lọc theo từng cột. Mỗi phần tử gồm:
      - `column` (String): Tên cột cần lọc.
      - `operator` (Enum): `"equals"`, `"not_equals"`, `"contains"`, `"greater_than"`, `"less_than"`, `"is_null"`, `"is_not_null"`.
      - `value` (Any): Giá trị cần so sánh.
- **Dữ liệu đầu ra (Response JSON - HTTP 200 OK):**
  - `page` (Number): Trang hiện tại.
  - `pageSize` (Number): Kích thước trang.
  - `totalMatchingRows` (Number): Tổng số dòng thỏa mãn điều kiện lọc.
  - `totalPages` (Number): Tổng số trang tương ứng.
  - `rows` (Array of Objects): Danh sách các dòng dữ liệu dạng JSON, mỗi dòng chứa `_rowId` và các cặp `{ column_name: value }`.
- **Ràng buộc nghiệp vụ & Quy trình xử lý:**
  1. Xác thực quyền đọc Dataset.
  2. Kiểm tra các cột trong `filters` và `sortBy` có thực sự tồn tại trong danh sách cột của Dataset hay không. Nếu không, từ chối với HTTP `400 Bad Request` (tránh injection và lỗi truy vấn).
  3. Xây dựng truy vấn MongoDB Aggregation Pipeline:
     - Khâu lọc (Match stage): Ghép các điều kiện lọc cột và điều kiện `searchKeyword`.
     - Khâu sắp xếp (Sort stage): Sắp xếp theo cột chỉ định (có index hỗ trợ).
     - Khâu phân trang (Facet stage): Kết hợp đếm tổng (`$count`) và phân trang (`$skip`, `$limit`).
  4. Trả kết quả tối ưu để Frontend Data Grid render qua Virtual Scrolling.
- **Quyền truy cập:** Người dùng có quyền xem Dataset.

---

#### 4.2. Lấy thông tin thống kê mô tả và phân phối biểu đồ của cột
- **Mã Endpoint:** `GET /api/v1/datasets/:datasetId/columns/:columnName/profile`
- **Actor:** `Data Analyst`, `Admin`.
- **Headers bắt buộc:** `Authorization: Bearer <accessToken>`
- **Dữ liệu đầu vào:**
  - `datasetId` (Path Parameter, String).
  - `columnName` (Path Parameter, String): Tên cột cần lấy thống kê.
  - `version` (Query Parameter, Integer, optional): Phiên bản dữ liệu; mặc định phiên bản hiện tại.
- **Dữ liệu đầu ra (Response JSON - HTTP 200 OK):**
  - `columnName` (String): Tên cột.
  - `dataType` (String): Kiểu dữ liệu (`"integer"`, `"float"`, `"string"`, v.v.).
  - `totalRows` (Number): Tổng số dòng.
  - `nullCount` (Number): Số lượng ô rỗng.
  - `nullRate` (Number): Tỷ lệ rỗng ($0.0 \to 1.0$).
  - `uniqueCount` (Number): Số lượng giá trị khác nhau (Cardinality).
  - `statistics` (Object, chỉ có với cột số):
    - `min`, `max`, `mean`, `median`, `stdDev`.
  - `histogram` (Array of Objects, chỉ có với cột số):
    - Mảng các khoảng giá trị và tần suất: `[ { "binRange": "0 - 10", "count": 1500 }, ... ]`.
  - `topCategories` (Array of Objects, chỉ có với cột chuỗi/danh mục):
    - Top 10 giá trị xuất hiện nhiều nhất: `[ { "value": "Hà Nội", "count": 12000, "percentage": 24.0 }, ... ]`.
- **Ràng buộc nghiệp vụ & Quy trình xử lý:**
  1. Kiểm tra tồn tại của Dataset và cột `columnName`. Nếu cột không có trong schema, trả về HTTP `404 Not Found`.
  2. Thực hiện tính toán thống kê mô tả nhanh qua MongoDB Aggregation (`$bucket` cho histogram đối với cột số; `$sortByCount` cho cột danh mục).
  3. Trả về payload định dạng trực quan để Frontend vẽ biểu đồ bằng Recharts hoặc Chart.js.
- **Quyền truy cập:** Người dùng có quyền xem Dataset.

---

### PHÂN HỆ 5: BỘ CÔNG CỤ BIẾN ĐỔI VÀ LÀM SẠCH DỮ LIỆU (TRANSFORMATION)

---

#### 5.1. Thực thi phép biến đổi dữ liệu (Execute Transformation)
- **Mã Endpoint:** `POST /api/v1/datasets/:datasetId/transformations`
- **Actor:** `Data Analyst`, `Admin`.
- **Headers bắt buộc:** `Authorization: Bearer <accessToken>`
- **Dữ liệu đầu vào (Request Body JSON):**
  - `currentVersion` (Integer): Phiên bản dữ liệu mà Client đang thao tác. Bắt buộc.
  - `actionType` (Enum): Loại hành động biến đổi. Bắt buộc. Chấp nhận các giá trị:
    - `"DROP_NULL_ROWS"`: Xóa các dòng có ô trống.
    - `"IMPUTE_VALUE"`: Điền giá trị vào ô trống.
    - `"SANITIZE_STRING"`: Chuẩn hóa chuỗi ký tự (Trim, đổi hoa/thường).
    - `"REPLACE_REGEX"`: Tìm kiếm và thay thế theo chuỗi hoặc Regex.
    - `"DROP_COLUMN"`: Xóa một cột khỏi bảng.
    - `"RENAME_COLUMN"`: Đổi tên một cột.
  - `targetColumn` (String): Tên cột mục tiêu cần áp dụng biến đổi. Bắt buộc (trừ khi `actionType = "DROP_NULL_ROWS"` áp dụng toàn bảng).
  - `parameters` (Object): Các tham số chi tiết cho từng loại hành động:
    - Với `IMPUTE_VALUE`: `{ "strategy": "CUSTOM" | "MEAN" | "MEDIAN" | "MODE", "customValue": Any }`.
    - Với `SANITIZE_STRING`: `{ "trim": Boolean, "textCase": "UPPER" | "LOWER" | "CAPITALIZE" }`.
    - Với `REPLACE_REGEX`: `{ "pattern": String, "replacement": String }`.
    - Với `RENAME_COLUMN`: `{ "newColumnName": String }`.
- **Dữ liệu đầu ra (Response JSON - HTTP 200 OK):**
  - `datasetId` (String).
  - `previousVersion` (Number): Phiên bản trước khi sửa ($v$).
  - `newVersion` (Number): Phiên bản mới được sinh ra ($v + 1$).
  - `actionType` (String): Hành động vừa thực thi.
  - `rowsAffected` (Number): Số lượng dòng chịu tác động của phép biến đổi.
  - `newRowCount` (Number): Tổng số dòng của bộ dữ liệu sau khi biến đổi.
  - `message` (String): Thông báo kết quả thực thi chi tiết.
  - `updatedAt` (String ISO-8601).
- **Ràng buộc nghiệp vụ & Quy trình xử lý:**
  1. Xác thực quyền ghi của người dùng đối với Dataset.
  2. **Kiểm tra Khóa lạc quan (Optimistic Concurrency Control):**
     - So sánh `currentVersion` gửi lên với `dataset.currentVersion` hiện tại trong MongoDB.
     - Nếu không khớp (ví dụ: client gửi `currentVersion = 1` nhưng trên DB đã là `2` do có tab khác vừa sửa), từ chối ngay với HTTP `409 Conflict` kèm thông báo: *"Dữ liệu đã bị thay đổi bởi một phiên khác. Vui lòng tải lại dữ liệu mới nhất trước khi thao tác"*.
  3. Kiểm tra tính hợp lệ của tham số:
     - Nếu `actionType = "IMPUTE_VALUE"` với `strategy = "MEAN"` hoặc `"MEDIAN"`, cột `targetColumn` bắt buộc phải là kiểu số (`integer` hoặc `float`). Nếu là cột chuỗi, từ chối với HTTP `400 Bad Request`.
     - Nếu `actionType = "RENAME_COLUMN"`, `newColumnName` không được trùng với bất kỳ cột nào đã có trong bảng.
  4. Thực thi phép biến đổi trên dữ liệu bản ghi `dataset_records`:
     - Áp dụng cập nhật hàng loạt (Bulk Write / Update) trong MongoDB.
     - Tính toán số lượng dòng bị tác động (`rowsAffected`).
  5. Tăng số phiên bản: `newVersion = currentVersion + 1`.
  6. Lưu nhật ký công thức biến đổi (Transformation Recipe) vào collection `dataset_versions`.
  7. Ghi nhận bước biến đổi vào đồ thị Neo4j:
     `CREATE (vNew:DatasetVersion {v: $newVersion}) CREATE (vOld)-[:TRANSFORMED_BY {action: $actionType, column: $targetColumn}]->(vNew)`.
  8. Cập nhật lại các chỉ số thống kê (Metadata) của cột bị tác động trong `datasets`.
- **Quyền truy cập:** Chỉ chủ sở hữu Dataset hoặc Admin.

---

### PHÂN HỆ 6: QUẢN LÝ PHIÊN BẢN & TRUY VẾT DỮ LIỆU (VERSIONING & LINEAGE)

---

#### 6.1. Lấy lịch sử các phiên bản biến đổi (Get Version History)
- **Mã Endpoint:** `GET /api/v1/datasets/:datasetId/versions`
- **Actor:** `Data Analyst`, `Admin`.
- **Headers bắt buộc:** `Authorization: Bearer <accessToken>`
- **Dữ liệu đầu vào:**
  - `datasetId` (Path Parameter, String).
- **Dữ liệu đầu ra (Response JSON - HTTP 200 OK):**
  - `datasetId` (String).
  - `currentVersion` (Number): Phiên bản hiện hành.
  - `history` (Array of Objects): Danh sách các phiên bản từ $v_1$ đến hiện tại:
    - `version` (Number): Số phiên bản.
    - `actionType` (String): Hành động thực hiện để tạo ra phiên bản này.
    - `targetColumn` (String, optional): Cột chịu tác động.
    - `parameters` (Object): Các tham số đã dùng.
    - `rowsAffected` (Number): Số dòng chịu tác động.
    - `rowCount` (Number): Tổng số dòng tại mốc này.
    - `performedBy` (String): ID người thực hiện.
    - `createdAt` (String ISO-8601).
- **Ràng buộc nghiệp vụ & Quy trình xử lý:**
  1. Xác thực quyền đọc Dataset.
  2. Truy vấn collection `dataset_versions` theo `datasetId`, sắp xếp theo `version` tăng dần.
- **Quyền truy cập:** Người dùng có quyền xem Dataset.

---

#### 6.2. Hoàn tác về phiên bản trước (Rollback / Undo)
- **Mã Endpoint:** `POST /api/v1/datasets/:datasetId/rollback`
- **Actor:** `Data Analyst`, `Admin`.
- **Headers bắt buộc:** `Authorization: Bearer <accessToken>`
- **Dữ liệu đầu vào:**
  - `datasetId` (Path Parameter, String).
  - Request Body (JSON):
    - `targetVersion` (Integer): Phiên bản muốn quay về ($1 \le targetVersion < currentVersion$). Bắt buộc.
- **Dữ liệu đầu ra (Response JSON - HTTP 200 OK):**
  - `datasetId` (String).
  - `previousVersion` (Number): Phiên bản trước khi hoàn tác.
  - `currentVersion` (Number): Phiên bản hiện hành sau khi hoàn tác (bằng `targetVersion`).
  - `rowCount` (Number): Số lượng dòng của phiên bản sau hoàn tác.
  - `columnCount` (Number): Số lượng cột.
  - `message` (String): `"Đã hoàn tác thành công về phiên bản mục tiêu"`.
- **Ràng buộc nghiệp vụ & Quy trình xử lý:**
  1. Xác thực quyền ghi của người dùng đối với Dataset.
  2. Kiểm tra `targetVersion`:
     - Nếu `targetVersion >= dataset.currentVersion`, từ chối với HTTP `400 Bad Request` (Chỉ cho phép hoàn tác về mốc cũ hơn mốc hiện tại).
     - Kiểm tra sự tồn tại của `targetVersion` trong lịch sử `dataset_versions`. Nếu không có, trả về HTTP `404 Not Found`.
  3. Cập nhật con trỏ `currentVersion` của Dataset trong MongoDB về `targetVersion`.
  4. Phục hồi trạng thái metadata (danh sách cột, số dòng) khớp với mốc `targetVersion`.
  5. Ghi nhận hành động hoàn tác vào Audit Log.
- **Quyền truy cập:** Chỉ chủ sở hữu Dataset hoặc Admin.

---

#### 6.3. Truy vấn đồ thị nguồn gốc dữ liệu (Get Data Lineage Graph)
- **Mã Endpoint:** `GET /api/v1/datasets/:datasetId/lineage`
- **Actor:** `Data Analyst`, `Admin`.
- **Headers bắt buộc:** `Authorization: Bearer <accessToken>`
- **Dữ liệu đầu vào:**
  - `datasetId` (Path Parameter, String).
- **Dữ liệu đầu ra (Response JSON - HTTP 200 OK):**
  - `datasetId` (String).
  - `nodes` (Array of Objects): Danh sách các đỉnh đại diện cho các phiên bản dữ liệu:
    `[ { "id": "v1", "label": "Version 1 (Initial)", "rowCount": 50000 }, ... ]`.
  - `edges` (Array of Objects): Danh sách các cạnh đại diện cho hành động biến đổi:
    `[ { "source": "v1", "target": "v2", "label": "IMPUTE_VALUE: salary (median)" }, ... ]`.
- **Ràng buộc nghiệp vụ & Quy trình xử lý:**
  1. Xác thực quyền xem Dataset.
  2. Mở phiên kết nối tới cơ sở dữ liệu đồ thị **Neo4j**.
  3. Thực thi câu truy vấn Cypher:
     ```cypher
     MATCH (d:Dataset {id: $datasetId})-[:HAS_VERSION]->(v:DatasetVersion)
     OPTIONAL MATCH (v)-[r:TRANSFORMED_BY]->(vNext:DatasetVersion)
     RETURN v, r, vNext
     ORDER BY v.versionNumber ASC
     ```
  4. Chuyển đổi định dạng kết quả đồ thị sang chuẩn JSON của thư viện React Flow và trả về cho Frontend hiển thị.
- **Quyền truy cập:** Người dùng có quyền xem Dataset.

---

### PHÂN HỆ 7: XUẤT BẢN DỮ LIỆU SẠCH (DATA EXPORT)

---

#### 7.1. Xem trước dữ liệu sạch trước khi xuất bản (Preview Clean Data)
- **Mã Endpoint:** `GET /api/v1/datasets/:datasetId/export/preview`
- **Actor:** `Data Analyst`, `Admin`.
- **Headers bắt buộc:** `Authorization: Bearer <accessToken>`
- **Dữ liệu đầu vào:**
  - `datasetId` (Path Parameter, String).
  - `version` (Query Parameter, Integer, optional): Phiên bản cần xem; mặc định phiên bản hiện hành.
  - `limit` (Query Parameter, Integer, optional): Số dòng xem trước; mặc định `20`, tối đa `50`.
- **Dữ liệu đầu ra (Response JSON - HTTP 200 OK):**
  - `datasetId`, `version`, `totalRows`.
  - `columns` (Array of Strings): Tên các cột.
  - `previewRows` (Array of Objects): 20 dòng dữ liệu đại diện sau làm sạch.
- **Ràng buộc nghiệp vụ & Quy trình xử lý:**
  1. Xác thực quyền đọc Dataset.
  2. Lấy 20 bản ghi đầu tiên tương ứng với phiên bản `version` từ `dataset_records`.
- **Quyền truy cập:** Người dùng có quyền xem Dataset.

---

#### 7.2. Tải về tệp dữ liệu đã làm sạch (Download Clean Dataset File)
- **Mã Endpoint:** `GET /api/v1/datasets/:datasetId/export/download`
- **Actor:** `Data Analyst`, `Admin`.
- **Headers bắt buộc:** `Authorization: Bearer <accessToken>`
- **Dữ liệu đầu vào (Query Parameters):**
  - `version` (Integer, optional): Phiên bản dữ liệu cần tải; mặc định lấy phiên bản hiện tại.
  - `format` (Enum): Định dạng tệp tải về. Bắt buộc. Chấp nhận các giá trị:
    - `"csv"`: Tệp Comma-Separated Values.
    - `"xlsx"`: Tệp bảng tính Microsoft Excel.
    - `"json"`: Tệp JSON Array.
- **Dữ liệu đầu ra (Binary Stream - HTTP 200 OK):**
  - Headers phản hồi:
    - Với `csv`: `Content-Type: text/csv; charset=utf-8`, kèm chuỗi UTF-8 BOM (`\uFEFF`) ở đầu stream để Excel mở tiếng Việt không bị lỗi font.
    - Với `xlsx`: `Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`.
    - Với `json`: `Content-Type: application/json; charset=utf-8`.
    - Header bắt buộc: `Content-Disposition: attachment; filename="{dataset_name}_clean_v{version}.{format}"`.
  - Body: Luồng nhị phân (Binary Stream) của tệp dữ liệu.
- **Ràng buộc nghiệp vụ & Quy trình xử lý:**
  1. Xác thực quyền đọc Dataset.
  2. Truy vấn dữ liệu bản ghi từ MongoDB bằng Cursor (con trỏ dòng) kết hợp **Stream Generator**:
     - Tuyệt đối không nạp toàn bộ 200,000 dòng vào một mảng trong bộ nhớ RAM rồi mới xuất file (sẽ làm crash Backend do tràn bộ nhớ).
     - Đọc từng batch (1,000 dòng/lần) từ MongoDB Cursor, chuyển đổi sang định dạng CSV/Excel/JSON tương ứng và ghi trực tiếp vào `response stream` gửi về cho trình duyệt.
  3. Ghi nhận lượt tải xuống vào Audit Log.
- **Quyền truy cập:** Người dùng có quyền xem Dataset.

---

#### 7.3. Lưu dữ liệu sạch thành Tập dữ liệu mới độc lập (Save as New Dataset)
- **Mã Endpoint:** `POST /api/v1/datasets/:datasetId/export/save-as-new`
- **Actor:** `Data Analyst`, `Admin`.
- **Headers bắt buộc:** `Authorization: Bearer <accessToken>`
- **Dữ liệu đầu vào (Request Body JSON):**
  - `version` (Integer): Phiên bản dữ liệu sạch cần nhân bản; mặc định phiên bản hiện tại.
  - `newDatasetName` (String): Tên của bộ dữ liệu mới; độ dài từ 3 đến 100 ký tự. Bắt buộc.
  - `targetWorkspaceId` (String): ID của Không gian làm việc muốn lưu bộ dữ liệu mới vào. Bắt buộc.
- **Dữ liệu đầu ra (Response JSON - HTTP 201 Created):**
  - `newDatasetId` (String): Mã định danh của Dataset mới vừa được tạo ra.
  - `name` (String): Tên bộ dữ liệu mới.
  - `workspaceId` (String): Workspace đích.
  - `rowCount` (Number): Số dòng.
  - `columnCount` (Number): Số cột.
  - `currentVersion` (Number): Khởi tạo là `1`.
  - `message` (String): `"Tập dữ liệu sạch đã được nhân bản thành Dataset mới thành công"`.
- **Ràng buộc nghiệp vụ & Quy trình xử lý:**
  1. Xác thực quyền đọc tại Dataset nguồn và quyền ghi tại `targetWorkspaceId`.
  2. Kiểm tra `newDatasetName` không trùng lặp với các Dataset đã có trong `targetWorkspaceId`.
  3. Tạo một bản ghi mới trong `datasets` với `version = 1`.
  4. Sao chép toàn bộ các dòng dữ liệu của phiên bản `version` từ `dataset_records` nguồn sang gắn với `newDatasetId`.
  5. Khởi tạo mốc `v1` trong `dataset_versions` của tập dữ liệu mới và tạo node gốc mới trong Neo4j.
- **Quyền truy cập:** Người dùng có quyền tạo Dataset tại Workspace đích.
