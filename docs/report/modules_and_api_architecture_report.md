# BÁO CÁO KIẾN TRÚC MODULE VÀ DANH MỤC API TOÀN HỆ THỐNG
## HỆ THỐNG AI HỖ TRỢ PHÁT HIỆN VÀ XỬ LÝ VẤN ĐỀ CHẤT LƯỢNG DỮ LIỆU
### (Full-Stack Data Quality Management Platform with AI Assistance)

---

## 1. TỔNG QUAN KIẾN TRÚC PHÂN TẦNG VÀ ĐIỀU PHỐI API (API GATEWAY & MODULAR ARCHITECTURE)

Hệ thống backend được xây dựng trên nền tảng **NestJS 11** kết hợp động cơ **Express**, tuân thủ nghiêm ngặt mô hình **Modular Layered Architecture**. Kiến trúc phân định rõ ràng giữa tầng Giao tiếp (Controllers/Gateways), tầng Nghiệp vụ ứng dụng (Services, Domain Handlers), tầng Xác thực & Kiểm soát truy cập (Guards, Pipes, CASL ABAC), và tầng Lưu trữ (Repositories, Schemas, Drivers).

```
                      [ CLIENTS ] (Web SPA / Mobile / Swagger / SDK)
                                      │
                                      ▼ HTTPS / TLS 1.3
                     [ CLOUDFLARE ZERO TRUST TUNNEL ]
                                      │
                                      ▼ HTTP Loopback (Port 3000)
┌──────────────────────────────────────────────────────────────────────────────────┐
│                             NESTJS 11 PIPELINE ENGINE                            │
│  ┌───────────────────────┬──────────────────────┬─────────────────────────────┐  │
│  │ ThrottlerGuard        │ JwtAuthGuard         │ PoliciesGuard (CASL)        │  │
│  │ (Chống Brute Force)   │ (JWT Xác thực phiên) │ (Kiểm soát truy cập ABAC)   │  │
│  ├───────────────────────┴──────────────────────┴─────────────────────────────┤  │
│  │                     ZodValidationPipe (Zero Any Validation)                │  │
│  └──────────────────────────────────────┬─────────────────────────────────────┘  │
└─────────────────────────────────────────┼────────────────────────────────────────┘
                                          ▼
┌──────────────────────────────────────────────────────────────────────────────────┐
│                                APPLICATION MODULES                               │
│  ┌───────────────┬────────────────┬────────────────┬──────────────────────────┐  │
│  │ 1. Health     │ 2. Auth        │ 3. Users       │ 4. Workspaces            │  │
│  │ Giám sát CSDL │ Xác thực phiên │ Hồ sơ cá nhân  │ Phân chia tổ chức        │  │
│  ├───────────────┼────────────────┼────────────────┼──────────────────────────┤  │
│  │ 5. Projects   │ 6. Datasets    │ 7. Data View   │ 8. Clean Rules           │  │
│  │ Quản lý dự án │ Ingestion CSV  │ Virtual Grid   │ Bộ lọc & khử nhiễu       │  │
│  ├───────────────┼────────────────┴────────────────┴──────────────────────────┤  │
│  │ 9. Lineage    │ 10. Versions                   │ 11. Exports              │  │
│  │ DAG Neo4j     │ Cryptographic Audit Merkle     │ Pipeline Xuất & AES Mã   │  │
│  └───────────────┴────────────────────────────────┴──────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────────────────┘
```

### Cơ chế Bảo vệ & Chuẩn hóa Dữ liệu xuyên suốt mọi Endpoint:
1. **Kiểm tra kiểu tĩnh khắt khe (Zero Any Policy):** Toàn bộ tham số đầu vào (`@Body`, `@Param`, `@Query`) được xác thực bằng schema định nghĩa qua **Zod v3**, chuyển đổi sang DTO an toàn kiểu tuyệt đối.
2. **Kiểm soát phiên làm việc độc lập:** Mọi truy vấn nhạy cảm yêu cầu `Bearer JWT Access Token` (thời hạn 15 phút) gắn liền với một Session định danh trong cơ sở dữ liệu (`user_sessions`).
3. **Kiểm soát truy cập dựa trên thuộc tính (CASL ABAC Model - Attribute-Based Access Control):**
   Hệ thống loại bỏ hoàn toàn mô hình RBAC (Role-Based Access Control) truyền thống vốn thô sơ và tiềm ẩn nguy cơ leo thang đặc quyền ngang (Insecure Direct Object References - IDOR). Thay vào đó, nền tảng ứng dụng mô hình **ABAC** linh hoạt thông qua thư viện `@casl/ability` kết hợp với `PoliciesGuard`. Quyết định cấp quyền không chỉ dựa trên vai trò tĩnh của người dùng, mà dựa trên việc đánh giá tương quan giữa 4 nhóm thuộc tính trong thời gian thực:
   - **Thuộc tính Chủ thể (Subject Attributes):** `user.userId`, `user.role` ('admin' | 'analyst'), `user.workspaceId`, `user.workspaceRole` ('owner' | 'editor' | 'viewer').
   - **Thuộc tính Tài nguyên (Resource Attributes):** `workspace.id`, `project.workspace_id`, `dataset.workspace_id`, `record.dataset_id`, v.v.
   - **Thuộc tính Hành động (Action Attributes):** `Action.Manage`, `Action.Create`, `Action.Read`, `Action.Update`, `Action.Delete`, `Action.Execute`, `Action.Export`.
   - **Điều kiện Ngữ cảnh (Contextual Conditions):** Ràng buộc truy vấn MongoDB Query `{ workspace_id: user.workspaceId }` hoặc `{ id: user.userId }`.


---

## 2. DANH MỤC CHI TIẾT CÁC MODULE VÀ ENDPOINTS

Hệ thống cung cấp tổng cộng **11 Modules** với **43 Endpoints API chuẩn RESTful**, đáp ứng trọn vẹn vòng đời quản lý và giám sát chất lượng dữ liệu:

---

### MODULE 1: HỆ THỐNG VÀ GIÁM SÁT KẾT NỐI (HEALTH MODULE)
*Điều phối bởi:* `AppController` (`src/backend/src/app.controller.ts`)

#### 1.1. `GET /health`
- **Tên nghiệp vụ:** Kiểm tra sức khỏe toàn diện hệ thống và liên kết Cloud CSDL.
- **Quyền hạn truy cập:** Công khai (`@Public()`).
- **Cách thức hoạt động & Luồng xử lý:**
  1. Gọi `mongoConnection.readyState` để kiểm tra kết nối tới cụm **MongoDB Atlas** (trạng thái `1: connected`).
  2. Ủy quyền cho `Neo4jService.verifyConnectivity()` khởi tạo một Cypher query nhẹ (`RETURN 1`) để xác nhận liên kết tới đồ thị **Neo4j AuraDB**.
  3. Kiểm tra trạng thái kết nối Cloud Object Storage từ `StorageService.getCloudStatus()` để kiểm định kết nối với bucket **Cloudflare R2** (S3-compatible).
  4. Trả về payload JSON chi tiết về trạng thái từng dịch vụ cùng nhãn thời gian ISO-8601.
- **Ý nghĩa & Công dụng nghiệp vụ:**
  Cung cấp đầu mối kiểm toán tự động (Liveness/Readiness probe) cho hạ tầng Docker, Kubernetes hoặc Cloudflare Health Monitor; giúp kỹ sư phát hiện tức thời tình trạng đứt gãy kết nối cơ sở dữ liệu trước khi nhận request từ người dùng.

---

### MODULE 2: XÁC THỰC VÀ QUẢN LÝ PHIÊN (AUTHENTICATION MODULE)
*Điều phối bởi:* `AuthController` (`src/backend/src/modules/auth/auth.controller.ts`)

#### 2.1. `POST /auth/register`
- **Tên nghiệp vụ:** Đăng ký tài khoản người dùng mới (F1.1).
- **Quyền hạn truy cập:** Công khai (`@Public()`).
- **Tham số / DTO đầu vào:** `RegisterDto` (`email`, `password`, `first_name`, `last_name`).
- **Cách thức hoạt động & Luồng xử lý:**
  1. Kiểm tra email đã tồn tại hay chưa thông qua `UsersService.findByEmail()` (áp dụng Partial Unique Index).
  2. Băm mật khẩu bằng thuật toán **Argon2id** với độ an toàn cryptographic cao.
  3. Tạo tài khoản trong collection `users` với vai trò mặc định là `analyst` và trạng thái `active`.
- **Ý nghĩa & Công dụng nghiệp vụ:**
  Cho phép chuyên viên phân tích dữ liệu hoặc quản trị viên khởi tạo tài khoản hợp lệ để tham gia vào hệ thống.

#### 2.2. `POST /auth/login`
- **Tên nghiệp vụ:** Đăng nhập hệ thống & Tự động nhận diện thiết bị (F1.2).
- **Quyền hạn truy cập:** Công khai (`@Public()`).
- **Tham số / DTO đầu vào:** `LoginDto` (`email`, `password`). Kèm Header `User-Agent` và `X-Forwarded-For`.
- **Cách thức hoạt động & Luồng xử lý:**
  1. Kiểm tra sự tồn tại của người dùng và so khớp mã băm mật khẩu Argon2id.
  2. Trích xuất thông tin thiết bị (`device_name`, `os`, `browser`) bằng engine phân tích `ua-parser-js` từ `User-Agent`.
  3. Sinh cặp khóa định danh bảo mật: **Access Token** (JWT, sống 15 phút) và **Refresh Token** (chuỗi ngẫu nhiên cryptographically secure, sống 7 ngày).
  4. Băm mã Refresh Token bằng **SHA-256** và lưu vết vào collection `user_sessions`.
  5. Trả về access token, refresh token, thời gian hết hạn và thông tin người dùng.
- **Ý nghĩa & Công dụng nghiệp vụ:**
  Bảo vệ tài khoản thông qua cơ chế nhận diện thiết bị tự động; ngăn chặn gian lận danh tính và tạo tiền đề để theo dõi phiên làm việc theo thời gian thực.

#### 2.3. `POST /auth/refresh`
- **Tên nghiệp vụ:** Cấp mới Access Token thông qua Refresh Token (F1.3).
- **Quyền hạn truy cập:** Công khai (`@Public()`).
- **Tham số / DTO đầu vào:** `RefreshTokenDto` (`refresh_token`).
- **Cách thức hoạt động & Luồng xử lý:**
  1. Băm `refresh_token` nhận được và đối soát trong collection `user_sessions`.
  2. Kiểm tra cờ thu hồi `is_revoked` và thời gian hết hạn `expires_at`.
  3. Nếu phiên hợp lệ, phát hành một `access_token` mới chứa đầy đủ claim người dùng mà không bắt người dùng phải đăng nhập lại.
- **Ý nghĩa & Công dụng nghiệp vụ:**
  Đảm bảo trải nghiệm sử dụng liền mạch không bị ngắt quãng (Seamless UX) trong khi vẫn duy trì nguyên tắc Access Token có vòng đời cực ngắn nhằm giảm thiểu rủi ro rò rỉ token.

#### 2.4. `POST /auth/logout`
- **Tên nghiệp vụ:** Đăng xuất tài khoản và vô hiệu hóa phiên hiện hành (F1.4).
- **Quyền hạn truy cập:** Yêu cầu đăng nhập (`JwtAuthGuard`).
- **Cách thức hoạt động & Luồng xử lý:**
  1. Trích xuất `sessionId` từ JWT payload của phiên hiện tại.
  2. Cập nhật trường `is_revoked: true` trong bảng `user_sessions`.
- **Ý nghĩa & Công dụng nghiệp vụ:**
  Hủy bỏ ngay lập tức tính hiệu lực của Refresh Token, bảo vệ người dùng khi họ rời khỏi máy tính hoặc ngắt phiên làm việc.

#### 2.5. `GET /auth/sessions`
- **Tên nghiệp vụ:** Xem danh sách phiên đăng nhập đang hoạt động (F1.8).
- **Quyền hạn truy cập:** Yêu cầu đăng nhập (`JwtAuthGuard`).
- **Cách thức hoạt động & Luồng xử lý:**
  Truy vấn cơ sở dữ liệu `user_sessions` theo `user_id` hiện tại, lọc các phiên chưa hết hạn và chưa bị thu hồi (`is_revoked: false`), sắp xếp theo thời gian khởi tạo mới nhất.
- **Ý nghĩa & Công dụng nghiệp vụ:**
  Cung cấp cho người dùng bảng điều khiển trực quan để kiểm toán các phiên làm việc từ các thiết bị và vị trí địa lý khác nhau (Audit Log cá nhân).

#### 2.6. `DELETE /auth/sessions/:id`
- **Tên nghiệp vụ:** Thu hồi phiên đăng nhập từ xa (Remote Session Revocation - F1.10).
- **Quyền hạn truy cập:** Yêu cầu đăng nhập (`JwtAuthGuard`).
- **Tham số:** `id` (Mã định danh của phiên cần thu hồi).
- **Cách thức hoạt động & Luồng xử lý:**
  Kiểm tra quyền sở hữu phiên của người dùng và cập nhật cờ `is_revoked: true` cho session tương ứng.
- **Ý nghĩa & Công dụng nghiệp vụ:**
  Cho phép người dùng chủ động ngắt kết nối các thiết bị lạ hoặc thiết bị bị thất lạc từ xa để bảo vệ dữ liệu công ty.

---

### MODULE 3: QUẢN LÝ NGƯỜI DÙNG (USERS MODULE)
*Điều phối bởi:* `UsersController` (`src/backend/src/modules/users/users.controller.ts`)

#### 3.1. `GET /users/me`
- **Tên nghiệp vụ:** Lấy thông tin chi tiết hồ sơ cá nhân hiện tại.
- **Quyền hạn truy cập:** Yêu cầu đăng nhập (`JwtAuthGuard`).
- **Cách thức hoạt động & Luồng xử lý:**
  Dựa trên `userId` trong token, truy vấn bản ghi tương ứng từ `users` collection, tự động loại trừ các trường nhạy cảm như `password_hash`, `password_reset_token_hash`.
- **Ý nghĩa & Công dụng nghiệp vụ:**
  Đồng bộ thông tin người dùng, quyền hạn hệ thống (`role: admin | analyst`) lên giao diện người dùng (Client Profile).

#### 3.2. `PATCH /users/me`
- **Tên nghiệp vụ:** Cập nhật thông tin hồ sơ người dùng.
- **Quyền hạn truy cập:** Yêu cầu đăng nhập (`JwtAuthGuard`).
- **Tham số / DTO đầu vào:** `UpdateUserDto` (`first_name`, `last_name`, `avatar_url`).
- **Cách thức hoạt động & Luồng xử lý:**
  Xác thực tính hợp lệ qua `UpdateUserSchema`, thực hiện cập nhật có chọn lọc (selective update) vào tài liệu người dùng.
- **Ý nghĩa & Công dụng nghiệp vụ:**
  Cho phép nhân viên tự hiệu chỉnh thông tin danh tính hiển thị trên toàn hệ thống làm việc nhóm.

#### 3.3. `DELETE /users/me`
- **Tên nghiệp vụ:** Xóa mềm tài khoản người dùng (Soft Delete).
- **Quyền hạn truy cập:** Yêu cầu đăng nhập (`JwtAuthGuard`).
- **Cách thức hoạt động & Luồng xử lý:**
  Gán nhãn `deleted_at: new Date()`, đồng thời thu hồi toàn bộ các phiên làm việc đang hoạt động của người dùng đó.
- **Ý nghĩa & Công dụng nghiệp vụ:**
  Đảm bảo tuân thủ quyền riêng tư dữ liệu (Right to be Forgotten) trong khi vẫn bảo toàn tính toàn vẹn dữ liệu (Audit Trail) trong các bản ghi lịch sử phả hệ dữ liệu.

---

### MODULE 4: KHÔNG GIAN LÀM VIỆC (WORKSPACES MODULE)
*Điều phối bởi:* `WorkspacesController` (`src/backend/src/modules/workspaces/workspaces.controller.ts`)

#### 4.1. `POST /workspaces`
- **Tên nghiệp vụ:** Khởi tạo Không gian làm việc mới (F2.1).
- **Quyền hạn truy cập:** Yêu cầu đăng nhập & Quyền `Create Workspace`.
- **Tham số / DTO đầu vào:** `CreateWorkspaceDto` (`name`, `description`).
- **Cách thức hoạt động & Luồng xử lý:**
  Tạo bản ghi trong `workspaces`, tự động gán `owner_id` là người tạo, đồng thời thêm người tạo vào mảng `members` với vai trò `owner`.
- **Ý nghĩa & Công dụng nghiệp vụ:**
  Tạo môi trường độc lập (Multi-tenant partition) để quản lý tập trung các dự án, dữ liệu và nhân sự theo từng phòng ban/tổ chức.

#### 4.2. `GET /workspaces`
- **Tên nghiệp vụ:** Liệt kê danh sách Không gian làm việc của người dùng (F2.2).
- **Quyền hạn truy cập:** Yêu cầu đăng nhập & Quyền `Read Workspace`.
- **Cách thức hoạt động & Luồng xử lý:**
  Tìm kiếm các workspace mà người dùng là chủ sở hữu (`owner_id`) hoặc là thành viên (`members.user_id`), bỏ qua các bản ghi đã xóa mềm (`deleted_at: null`).
- **Ý nghĩa & Công dụng nghiệp vụ:**
  Giúp chuyên viên nhanh chóng chuyển đổi ngữ cảnh làm việc giữa các phòng ban.

#### 4.3. `GET /workspaces/:id`
- **Tên nghiệp vụ:** Xem chi tiết một Không gian làm việc (F2.3).
- **Quyền hạn truy cập:** Yêu cầu đăng nhập & Quyền `Read Workspace`.
- **Tham số:** `id` (Mã định danh Workspace).
- **Cách thức hoạt động & Luồng xử lý:**
  Truy vấn thông tin chi tiết và danh sách thành viên kèm vai trò tương ứng (`owner`, `editor`, `viewer`).
- **Ý nghĩa & Công dụng nghiệp vụ:**
  Hiển thị bảng điều khiển quản trị thành viên và các chỉ số tài nguyên của không gian làm việc.

#### 4.4. `PATCH /workspaces/:id`
- **Tên nghiệp vụ:** Cập nhật thông tin Không gian làm việc (F2.4).
- **Quyền hạn truy cập:** Quyền `Update Workspace` (Chỉ Owner/Admin).
- **Tham số / DTO đầu vào:** `UpdateWorkspaceDto` (`name`, `description`).
- **Cách thức hoạt động & Luồng xử lý:**
  Xác thực quyền của người gọi thông qua CASL Ability, sau đó lưu thay đổi vào cơ sở dữ liệu.
- **Ý nghĩa & Công dụng nghiệp vụ:**
  Hiệu chỉnh tên gọi hoặc phạm vi hoạt động của phòng ban/workspace.

#### 4.5. `DELETE /workspaces/:id`
- **Tên nghiệp vụ:** Xóa mềm Không gian làm việc (F2.5).
- **Quyền hạn truy cập:** Quyền `Delete Workspace` (Chỉ Owner/Admin).
- **Tham số:** `id` (Mã định danh Workspace).
- **Cách thức hoạt động & Luồng xử lý:**
  Gán `deleted_at: new Date()`, đồng thời kích hoạt xóa mềm chuỗi các dự án phụ thuộc bên trong.
- **Ý nghĩa & Công dụng nghiệp vụ:**
  Đóng phòng ban hoặc dọn dẹp các không gian làm việc thử nghiệm không còn sử dụng.

#### 4.6. `POST /workspaces/:id/members`
- **Tên nghiệp vụ:** Thêm thành viên vào Không gian làm việc (F2.6).
- **Quyền hạn truy cập:** Quyền `Update Workspace` (Chủ sở hữu).
- **Tham số / DTO đầu vào:** `AddMemberDto` (`user_id`, `role: 'editor' | 'viewer'`).
- **Cách thức hoạt động & Luồng xử lý:**
  Kiểm tra sự tồn tại của người dùng, kiểm tra thành viên đã có trong workspace chưa, sau đó đẩy một đối tượng `WorkspaceMember` mới vào mảng `members`.
- **Ý nghĩa & Công dụng nghiệp vụ:**
  Mở rộng cộng tác nhóm, phân quyền chuyên viên chỉ có quyền xem hoặc có quyền can thiệp dữ liệu.

#### 4.7. `DELETE /workspaces/:id/members/:userId`
- **Tên nghiệp vụ:** Loại bỏ thành viên khỏi Không gian làm việc (F2.7).
- **Quyền hạn truy cập:** Quyền `Update Workspace` (Chủ sở hữu).
- **Tham số:** `id` (Mã Workspace), `userId` (Mã người dùng bị gỡ).
- **Cách thức hoạt động & Luồng xử lý:**
  Xóa phần tử thành viên tương ứng khỏi mảng `members`, cấm chủ sở hữu tự xóa chính mình nếu chưa chuyển giao quyền sở hữu.
- **Ý nghĩa & Công dụng nghiệp vụ:**
  Thu hồi quyền truy cập khi nhân sự chuyển dự án hoặc nghỉ việc, bảo đảm an toàn dữ liệu nội bộ.

---

### MODULE 5: DỰ ÁN DỮ LIỆU (PROJECTS MODULE)
*Điều phối bởi:* `ProjectsController` (`src/backend/src/modules/projects/projects.controller.ts`)

#### 5.1. `POST /workspaces/:workspaceId/projects`
- **Tên nghiệp vụ:** Khởi tạo Dự án chất lượng dữ liệu mới (F3.1).
- **Quyền hạn truy cập:** Quyền `Create Project`.
- **Tham số / DTO đầu vào:** `CreateProjectDto` (`name`, `description`).
- **Cách thức hoạt động & Luồng xử lý:**
  Xác thực quyền hạn trong `workspaceId`, khởi tạo thực thể `Project` với cờ `has_dataset: false`.
- **Ý nghĩa & Công dụng nghiệp vụ:**
  Thiết lập một dự án chuyên biệt cho một bài toán làm sạch dữ liệu cụ thể (ví dụ: "Làm sạch dữ liệu khách hàng CRM 2026").

#### 5.2. `GET /workspaces/:workspaceId/projects`
- **Tên nghiệp vụ:** Liệt kê danh sách dự án trong Workspace (F3.2).
- **Quyền hạn truy cập:** Quyền `Read Project`.
- **Cách thức hoạt động & Luồng xử lý:**
  Lấy toàn bộ các dự án chưa xóa thuộc workspace chỉ định, hiển thị trạng thái `has_dataset` để người dùng biết dự án đã nạp dữ liệu hay chưa.
- **Ý nghĩa & Công dụng nghiệp vụ:**
  Cung cấp cái nhìn tổng quan về tiến độ các pipeline dữ liệu trong một phòng ban.

#### 5.3. `GET /projects/:id`
- **Tên nghiệp vụ:** Xem chi tiết dự án (F3.3).
- **Quyền hạn truy cập:** Quyền `Read Project`.
- **Tham số:** `id` (Mã định danh Dự án).
- **Cách thức hoạt động & Luồng xử lý:**
  Trả về thông tin chi tiết của dự án, phục vụ hiển thị metadata trên trang Dashboard.
- **Ý nghĩa & Công dụng nghiệp vụ:**
  Kiểm tra cấu hình và người khởi tạo dự án.

#### 5.4. `PATCH /projects/:id`
- **Tên nghiệp vụ:** Cập nhật thông tin dự án (F3.4).
- **Quyền hạn truy cập:** Quyền `Update Project`.
- **Tham số / DTO đầu vào:** `UpdateProjectDto` (`name`, `description`).
- **Cách thức hoạt động & Luồng xử lý:**
  Kiểm tra quyền và cập nhật thông tin tên, mô tả dự án.
- **Ý nghĩa & Công dụng nghiệp vụ:**
  Hiệu chỉnh thông tin mô tả phạm vi bài toán dữ liệu.

#### 5.5. `DELETE /projects/:id`
- **Tên nghiệp vụ:** Xóa mềm dự án (F3.5).
- **Quyền hạn truy cập:** Quyền `Delete Project`.
- **Tham số:** `id` (Mã định danh Dự án).
- **Cách thức hoạt động & Luồng xử lý:**
  Đánh dấu `deleted_at: new Date()`, khóa truy cập vào tập dữ liệu và các luật làm sạch thuộc dự án.
- **Ý nghĩa & Công dụng nghiệp vụ:**
  Lưu trữ hoặc loại bỏ các dự án đã hoàn thành mà vẫn giữ được tính toàn vẹn trong lịch sử phả hệ.

---

### MODULE 6: TẬP DỮ LIỆU VÀ NẠP DỮ LIỆU (DATASETS MODULE)
*Điều phối bởi:* `DatasetsController` (`src/backend/src/modules/datasets/datasets.controller.ts`)

#### 6.1. `POST /projects/:projectId/datasets/upload`
- **Tên nghiệp vụ:** Nạp dữ liệu bằng cơ chế Streaming Multipart Upload (F4.1).
- **Quyền hạn truy cập:** Quyền `Create Dataset`.
- **Giao thức truyền:** `multipart/form-data` qua thư viện phân giải luồng `busboy`.
- **Cách thức hoạt động & Luồng xử lý:**
  1. Sử dụng luồng nhị phân trực tiếp (`Readable Stream`), không tải toàn bộ tệp vào RAM server.
  2. Vừa đẩy luồng dữ liệu lên kho **Cloudflare R2** (S3 Storage), vừa tính toán mã băm toàn vẹn **SHA-256 Checksum**.
  3. Đồng thời truyền luồng qua bộ phân tích cú pháp CSV/Excel (`csv-parser`) để trích xuất cấu trúc Schema cột (`columns`), suy luận kiểu dữ liệu (`string`, `number`, `boolean`, `date`), và đếm tỷ lệ khuyết thiếu (`missing_count`).
  4. Ghi nhận các dòng dữ liệu vào collection `dataset_records` theo từng lô (Batch Insert).
  5. Cập nhật `has_dataset: true` cho dự án và tạo phiên bản gốc `v1` trên Neo4j DAG.
- **Ý nghĩa & Công dụng nghiệp vụ:**
  Cho phép nạp các tệp dữ liệu khổng lồ (hàng trăm megabytes đến gigabytes) với mức tiêu thụ RAM ổn định dưới 50MB, tránh hiện tượng sập server vì quá tải bộ nhớ (OOM).

#### 6.2. `GET /projects/:projectId/datasets`
- **Tên nghiệp vụ:** Lấy thông tin tập dữ liệu hiện hành của dự án (F4.2).
- **Quyền hạn truy cập:** Quyền `Read Dataset`.
- **Tham số:** `projectId` (Mã Dự án).
- **Cách thức hoạt động & Luồng xử lý:**
  Tìm kiếm bản ghi `Dataset` hoạt động gắn liền với dự án tương ứng.
- **Ý nghĩa & Công dụng nghiệp vụ:**
  Xác định trạng thái dữ liệu của dự án (`INGESTING`, `READY`, `FAILED`).

#### 6.3. `GET /datasets/:id`
- **Tên nghiệp vụ:** Xem thông tin chi tiết tập dữ liệu (F4.3).
- **Quyền hạn truy cập:** Quyền `Read Dataset`.
- **Tham số:** `id` (Mã Dataset).
- **Cách thức hoạt động & Luồng xử lý:**
  Trả về tổng số dòng (`row_count`), số cột (`column_count`), kích thước tệp (`file_size_bytes`), phiên bản hiện tại (`current_version`) và mã kiểm tra tính toàn vẹn `file_checksum`.
- **Ý nghĩa & Công dụng nghiệp vụ:**
  Cung cấp bức tranh toàn cảnh về quy mô và đặc tính kỹ thuật của tập dữ liệu đang được phân tích.

#### 6.4. `PATCH /datasets/:id`
- **Tên nghiệp vụ:** Cập nhật tên/thông tin tập dữ liệu (F4.4).
- **Quyền hạn truy cập:** Quyền `Update Dataset`.
- **Tham số / DTO đầu vào:** `UpdateDatasetDto` (`name`).
- **Cách thức hoạt động & Luồng xử lý:**
  Cập nhật nhãn hiển thị của tập dữ liệu trong hệ thống.
- **Ý nghĩa & Công dụng nghiệp vụ:**
  Chuẩn hóa tên gọi của tập dữ liệu theo quy chuẩn doanh nghiệp.

#### 6.5. `DELETE /datasets/:id`
- **Tên nghiệp vụ:** Xóa mềm tập dữ liệu & giải phóng dự án (F4.5).
- **Quyền hạn truy cập:** Quyền `Delete Dataset`.
- **Tham số:** `id` (Mã Dataset).
- **Cách thức hoạt động & Luồng xử lý:**
  Gán nhãn xóa mềm tập dữ liệu, chuyển cờ `has_dataset` của dự án về `false` để cho phép nạp tệp dữ liệu mới thay thế.
- **Ý nghĩa & Công dụng nghiệp vụ:**
  Tái sử dụng dự án cho các đợt kiểm toán chất lượng dữ liệu tiếp theo.

#### 6.6. `GET /datasets/:id/schema`
- **Tên nghiệp vụ:** Xem cấu trúc Schema và thống kê kiểu dữ liệu các cột (F4.6).
- **Quyền hạn truy cập:** Quyền `Read Dataset`.
- **Tham số:** `id` (Mã Dataset).
- **Cách thức hoạt động & Luồng xử lý:**
  Trả về mảng `columns` chứa thông tin chi tiết từng cột: tên chuẩn hóa, tên gốc trong tệp, kiểu dữ liệu suy luận và số lượng ô bị trống (`missing_count`).
- **Ý nghĩa & Công dụng nghiệp vụ:**
  Cung cấp cơ sở tiền đề để các thuật toán AI và chuyên viên thiết lập các luật làm sạch phù hợp (ví dụ: biết cột có bao nhiêu ô `NULL`).

---

### MODULE 7: LƯỚI HIỂN THỊ DỮ LIỆU ẢO (DATA VIEW MODULE)
*Điều phối bởi:* `DataViewController` (`src/backend/src/modules/data-view/data-view.controller.ts`)

#### 7.1. `GET /datasets/:datasetId/records`
- **Tên nghiệp vụ:** Phân trang Keyset/Cursor siêu tốc cho lưới dữ liệu ảo (Virtual Grid - F5.1).
- **Quyền hạn truy cập:** Quyền `Read DataRecord`.
- **Tham số truy vấn (`Query`):** `limit` (mặc định 50, tối đa 200), `cursor` (`row_index` làm mốc), `direction` (`next` | `prev`).
- **Cách thức hoạt động & Luồng xử lý:**
  1. Loại bỏ hoàn toàn phương pháp phân trang truyền thống `skip/limit` (gây quét tuần tự chậm chạp trên bảng lớn).
  2. Sử dụng **Keyset Indexing** trên trường `{ dataset_id: 1, row_index: 1 }` để thực hiện truy vấn trực tiếp bằng toán tử so sánh (`row_index > cursor`).
  3. Trả về mảng các dòng dữ liệu cùng con trỏ `next_cursor` và cờ `has_more`.
- **Ý nghĩa & Công dụng nghiệp vụ:**
  Đem lại tốc độ phản hồi dưới 10ms ngay cả khi bảng dữ liệu có hàng triệu dòng; tích hợp hoàn hảo với thư viện hiển thị lưới ảo Infinite Scroll phía Frontend.

#### 7.2. `PATCH /datasets/:datasetId/records/:rowIndex`
- **Tên nghiệp vụ:** Hiệu chỉnh ô dữ liệu trực tiếp trong lưới (In-place Cell Edit - F5.2).
- **Quyền hạn truy cập:** Quyền `Update DataRecord`.
- **Tham số:** `datasetId`, `rowIndex` (Vị trí dòng), DTO `UpdateCellDto` (`column_name`, `new_value`).
- **Cách thức hoạt động & Luồng xử lý:**
  1. Kiểm tra sự tồn tại của dòng dữ liệu và tính hợp lệ của tên cột.
  2. Cập nhật giá trị trường con trong tài liệu BSON: `data.<column_name> = new_value`.
  3. Cập nhật `version_number` và nhãn thời gian `updated_at`.
- **Ý nghĩa & Công dụng nghiệp vụ:**
  Cho phép chuyên viên phân tích sửa nhanh các điểm sai sót cục bộ (nhập sai chính tả, sửa giá trị ngoại lai) ngay trên giao diện bảng mà không cần phải chạy lại toàn bộ pipeline làm sạch phức tạp.

#### 7.3. `GET /datasets/:datasetId/columns/:columnName/stats`
- **Tên nghiệp vụ:** Thống kê phân phối cột và Histogram 10 khoảng (F5.3).
- **Quyền hạn truy cập:** Quyền `Read Dataset`.
- **Tham số:** `datasetId`, `columnName`.
- **Cách thức hoạt động & Luồng xử lý:**
  1. Sử dụng pipeline tổng hợp **MongoDB Aggregation Framework** (`$facet`, `$bucketAuto` hoặc chia khoảng đều 10 buckets).
  2. Tính toán các chỉ số thống kê mô tả: giá trị nhỏ nhất (min), lớn nhất (max), trung bình (mean), độ lệch chuẩn, số lượng giá trị rỗng và số lượng giá trị duy nhất (unique count).
  3. Trả về mảng 10 khoảng phân phối kèm tần suất xuất hiện của từng khoảng.
- **Ý nghĩa & Công dụng nghiệp vụ:**
  Trợ giúp trực quan hóa phân phối dữ liệu (Data Profiling), phát hiện tức thì hiện tượng phân phối lệch, khoảng trắng bất thường hoặc các điểm dị biệt (outliers).

---

### MODULE 8: ĐỘNG CƠ LUẬT LÀM SẠCH (CLEAN RULES MODULE)
*Điều phối bởi:* `CleanRulesController` (`src/backend/src/modules/clean-rules/clean-rules.controller.ts`)

#### 8.1. `POST /datasets/:id/rules/preview`
- **Tên nghiệp vụ:** Chạy thử nghiệm danh sách luật trên 100 dòng mẫu (Dry-run Preview - F6.1).
- **Quyền hạn truy cập:** Quyền `Execute CleanRule`.
- **Tham số / DTO đầu vào:** `PreviewRulesDto` (Danh sách các định nghĩa luật: `category`, `action`, `target_column`, `parameters`).
- **Cách thức hoạt động & Luồng xử lý:**
  1. Trích xuất 100 bản ghi đầu tiên của tập dữ liệu từ bộ nhớ.
  2. Thực thi tuần tự các luật biến đổi trong bộ nhớ RAM mà **hoàn toàn không ghi đè vào database**:
     - *Xử lý Null (`null_handling`):* Điền giá trị trung vị, trung bình, giá trị cố định hoặc xóa dòng.
     - *Chuẩn hóa (`standardization`):* Chuyển chữ hoa, chữ thường, cắt khoảng trắng, ép kiểu ngày tháng.
     - *Khử trùng lặp (`deduplication`):* Nhận diện các dòng trùng khớp dựa trên danh sách cột khóa.
     - *Biểu thức chính quy (`regex`):* Trích xuất hoặc thay thế chuỗi theo mẫu định sẵn.
  3. Trả về bản xem trước so sánh trực quan dòng gốc và dòng sau xử lý kèm số lượng ô bị biến đổi.
- **Ý nghĩa & Công dụng nghiệp vụ:**
  Đem lại môi trường thử nghiệm an toàn tuyệt đối (Sandbox Mode); giúp chuyên viên kiểm chứng tính đúng đắn của luật trước khi tác động vào kho dữ liệu thật.

#### 8.2. `POST /datasets/:id/rules/apply`
- **Tên nghiệp vụ:** Áp dụng hàng loạt luật làm sạch vào tập dữ liệu & Tạo Commit (F6.2).
- **Quyền hạn truy cập:** Quyền `Execute CleanRule`.
- **Tham số / DTO đầu vào:** `ApplyRulesDto` (`rule_ids`, `commit_message`).
- **Cách thức hoạt động & Luồng xử lý:**
  1. Khởi tạo một MongoDB Session và bắt đầu **Database Transaction**.
  2. Đọc toàn bộ danh sách luật đang kích hoạt và áp dụng biến đổi tuần tự qua từng lô dữ liệu (`bulkWrite`).
  3. Tính toán lại mã băm nội dung dữ liệu sau biến đổi (`data_checksum` qua SHA-256).
  4. Tạo một bản ghi phiên bản mới trong `dataset_versions`.
  5. Đẩy sự kiện biến đổi sang đồ thị **Neo4j AuraDB** và phát hành sự kiện Outbox Pattern.
  6. Commit transaction để đảm bảo dữ liệu luôn nhất quán tuyệt đối.
- **Ý nghĩa & Công dụng nghiệp vụ:**
  Thực hiện khâu làm sạch cốt lõi của hệ thống, chuẩn hóa hàng loạt triệu bản ghi và lưu trữ lịch sử xử lý phục vụ kiểm toán.

#### 8.3. `GET /datasets/:id/rules`
- **Tên nghiệp vụ:** Xem danh sách các luật đã lưu của tập dữ liệu (F6.3).
- **Quyền hạn truy cập:** Quyền `Read CleanRule`.
- **Tham số:** `id` (Mã Dataset).
- **Cách thức hoạt động & Luồng xử lý:**
  Lấy toàn bộ các luật đã từng được tạo cho tập dữ liệu, sắp xếp theo thời gian khởi tạo.
- **Ý nghĩa & Công dụng nghiệp vụ:**
  Quản lý danh mục luật, cho phép tái sử dụng hoặc kiểm tra lại các bước xử lý dữ liệu trước đó.

---

### MODULE 9: PHẢ HỆ DỮ LIỆU & KIỂM TOÁN MERKLE DAG (LINEAGE MODULE)
*Điều phối bởi:* `LineageController` (`src/backend/src/modules/lineage/lineage.controller.ts`)

#### 9.1. `GET /lineage/:dataset_id`
- **Tên nghiệp vụ:** Xuất đồ thị phả hệ dữ liệu Neo4j DAG cho React Flow (F8.1).
- **Quyền hạn truy cập:** Quyền `Read Lineage`.
- **Tham số:** `dataset_id` (Mã Dataset).
- **Cách thức hoạt động & Luồng xử lý:**
  1. Thực thi câu truy vấn Cypher trên **Neo4j AuraDB** để lấy toàn bộ các nút phiên bản (`VersionNode`), các thao tác biến đổi (`TransformationNode`), và các cạnh quan hệ phụ thuộc (`DERIVED_FROM`, `TRANSFORMED_BY`).
  2. Định dạng cấu trúc dữ liệu trả về tương thích 100% với chuẩn node/edge của thư viện biểu diễn đồ thị `@xyflow/react` (React Flow).
- **Ý nghĩa & Công dụng nghiệp vụ:**
  Biểu diễn trực quan dòng chảy dữ liệu từ trạng thái nguyên bản qua các bước biến đổi đến trạng thái sạch; giúp người quản lý nắm bắt toàn diện hành trình dữ liệu.

#### 9.2. `GET /lineage/node/:id/upstream`
- **Tên nghiệp vụ:** Phân tích nguyên nhân gốc rễ (Root Cause Analysis - F8.2).
- **Quyền hạn truy cập:** Quyền `Read Lineage`.
- **Tham số:** `id` (Mã node phiên bản hiện tại).
- **Cách thức hoạt động & Luồng xử lý:**
  Sử dụng thuật toán duyệt đồ thị ngược chiều mũi tên quan hệ:
  `MATCH (target:VersionNode {id: $id})<-[:DERIVED_FROM*1..10]-(ancestor) RETURN ancestor`
  Truy vết ngược toàn bộ các quy tắc làm sạch và tập dữ liệu nguồn đã dẫn đến trạng thái của phiên bản này.
- **Ý nghĩa & Công dụng nghiệp vụ:**
  Xác định chính xác quy tắc làm sạch hoặc bước xử lý nào đã vô tình gây ra lỗi hoặc làm sai lệch dữ liệu ở phiên bản hiện tại.

#### 9.3. `GET /lineage/node/:id/downstream`
- **Tên nghiệp vụ:** Phân tích tác động lan truyền (Downstream Impact Analysis - F8.3).
- **Quyền hạn truy cập:** Quyền `Read Lineage`.
- **Tham số:** `id` (Mã node phiên bản).
- **Cách thức hoạt động & Luồng xử lý:**
  Duyệt đồ thị xuôi chiều quan hệ:
  `MATCH (source:VersionNode {id: $id})-[:DERIVED_FROM*1..10]->(descendant) RETURN descendant`
  Liệt kê toàn bộ các báo cáo, tập dữ liệu con, hoặc mô hình AI đang phụ thuộc vào phiên bản này.
- **Ý nghĩa & Công dụng nghiệp vụ:**
  Đánh giá rủi ro trước khi thực hiện thu hồi hoặc rollback phiên bản; cảnh báo cho các bộ phận liên quan nếu dữ liệu nguồn bị thay đổi.

#### 9.4. `GET /lineage/verify-integrity/:dataset_id`
- **Tên nghiệp vụ:** Kiểm toán tính toàn vẹn chuỗi Merkle chống giả mạo (F8.4 - GET).
- **Quyền hạn truy cập:** Quyền `Read Lineage`.
- **Tham số:** `dataset_id`.
- **Cách thức hoạt động & Luồng xử lý:**
  1. Duyệt toàn bộ chuỗi phiên bản từ `v1` đến `vN` được liên kết trong đồ thị phả hệ.
  2. Tại mỗi mắt xích, tính toán lại giá trị hàm băm Merkle:
     $$\text{Merkle Hash} = \text{SHA-256}(\text{parent\_hash} + \text{rules\_hash} + \text{data\_checksum})$$
  3. So khớp giá trị vừa tính với trường `version_hash` lưu trong CSDL.
  4. Nếu phát hiện bất kỳ sự sai lệch nào, chỉ ra chính xác phiên bản bị đứt gãy và cảnh báo giả mạo.
- **Ý nghĩa & Công dụng nghiệp vụ:**
  Cung cấp bằng chứng kiểm toán độc lập, chứng minh dữ liệu chưa từng bị can thiệp trái phép trực tiếp vào database ngoài luồng ứng dụng.

#### 9.5. `POST /lineage/verify-integrity/:dataset_id`
- **Tên nghiệp vụ:** Kích hoạt quy trình kiểm toán toàn vẹn dữ liệu chuỗi Merkle (F8.4 - POST).
- **Quyền hạn truy cập:** Quyền `Read Lineage`.
- **Tham số:** `dataset_id`.
- **Cách thức hoạt động & Luồng xử lý:**
  Tương đương endpoint GET, nhưng hỗ trợ kích hoạt quy trình từ các webhook hoặc hệ thống lập lịch tự động (Scheduled Audit Jobs).
- **Ý nghĩa & Công dụng nghiệp vụ:**
  Tự động hóa công tác kiểm toán định kỳ tính toàn vẹn của kho dữ liệu lớn.

---

### MODULE 10: QUẢN LÝ PHIÊN BẢN (VERSIONS MODULE)
*Điều phối bởi:* `VersionsController` (`src/backend/src/modules/versions/versions.controller.ts`)

#### 10.1. `POST /datasets/:id/versions`
- **Tên nghiệp vụ:** Tạo Snapshot CSV & Commit phiên bản Merkle mới (F7.1).
- **Quyền hạn truy cập:** Quyền `Create DatasetVersion`.
- **Tham số / DTO đầu vào:** `CommitVersionDto` (`description`, `rule_ids`).
- **Cách thức hoạt động & Luồng xử lý:**
  1. Xuất snapshot toàn bộ trạng thái hiện tại của dữ liệu thành một tệp CSV nén lưu trên **Cloudflare R2**.
  2. Tính toán `data_checksum` của tệp snapshot.
  3. Lấy `parent_hash` của phiên bản trước đó, tổng hợp các luật áp dụng thành `rules_hash`.
  4. Tạo mã băm chuỗi Merkle `version_hash` và ghi vào `dataset_versions`.
  5. Đồng bộ một Node phiên bản mới lên đồ thị **Neo4j AuraDB**.
- **Ý nghĩa & Công dụng nghiệp vụ:**
  Đóng băng trạng thái dữ liệu (Git-like Data Versioning); tạo điểm phục hồi an toàn trong quy trình xử lý dữ liệu.

#### 10.2. `GET /datasets/:id/versions`
- **Tên nghiệp vụ:** Danh sách lịch sử các phiên bản của tập dữ liệu (F7.2).
- **Quyền hạn truy cập:** Quyền `Read DatasetVersion`.
- **Tham số truy vấn (`Query`):** `page`, `limit`.
- **Cách thức hoạt động & Luồng xử lý:**
  Truy vấn các bản ghi từ collection `dataset_versions`, sắp xếp theo `version_number` giảm dần.
- **Ý nghĩa & Công dụng nghiệp vụ:**
  Cho phép người dùng xem lại toàn bộ dòng lịch sử tiến hóa của bộ dữ liệu qua từng bước làm sạch.

#### 10.3. `GET /datasets/:id/versions/diff`
- **Tên nghiệp vụ:** So sánh sai khác cấu trúc và dữ liệu giữa 2 phiên bản (F7.4).
- **Quyền hạn truy cập:** Quyền `Read DatasetVersion`.
- **Tham số truy vấn (`Query`):** `v1` (Số phiên bản gốc), `v2` (Số phiên bản đích).
- **Cách thức hoạt động & Luồng xử lý:**
  1. Đọc metadata và thông tin tổng quan của phiên bản $v_1$ và $v_2$.
  2. So sánh danh sách cột (các cột được thêm mới, đổi tên hoặc bị loại bỏ).
  3. So sánh biến động về số lượng dòng, số ô rỗng và các quy tắc làm sạch đã được thực thi giữa 2 thời điểm.
- **Ý nghĩa & Công dụng nghiệp vụ:**
  Cung cấp cái nhìn trực quan (Visual Data Diff) tương tự lệnh `git diff` trong mã nguồn, giúp đánh giá định lượng hiệu quả làm sạch của các bộ luật.

#### 10.4. `GET /datasets/:id/versions/:versionNumber`
- **Tên nghiệp vụ:** Xem thông tin chi tiết một phiên bản chỉ định (F7.3).
- **Quyền hạn truy cập:** Quyền `Read DatasetVersion`.
- **Tham số:** `id`, `versionNumber`.
- **Cách thức hoạt động & Luồng xử lý:**
  Truy vấn bản ghi phiên bản theo số thứ tự; cung cấp mã băm, số lượng bản ghi và đường dẫn tải tệp snapshot tương ứng.
- **Ý nghĩa & Công dụng nghiệp vụ:**
  Kiểm tra chi tiết thông số của một cột mốc dữ liệu cụ thể trong quá khứ.

#### 10.5. `POST /datasets/:id/versions/:versionNumber/rollback`
- **Tên nghiệp vụ:** Khôi phục tại chỗ về phiên bản lịch sử (In-place Rollback - F7.5).
- **Quyền hạn truy cập:** Quyền `Update DatasetVersion`.
- **Tham số:** `id`, `versionNumber`.
- **Cách thức hoạt động & Luồng xử lý:**
  1. Lấy thông tin tệp snapshot của `versionNumber` từ Cloudflare R2.
  2. Dùng luồng Stream nạp lại dữ liệu vào collection `dataset_records`, thay thế toàn bộ dữ liệu hiện tại trong một Transaction an toàn.
  3. Cập nhật `current_version` của Dataset.
  4. Tạo một nút quan hệ đảo ngược trong đồ thị Neo4j ghi nhận hành vi rollback.
- **Ý nghĩa & Công dụng nghiệp vụ:**
  Tính năng cứu hộ khẩn cấp; lập tức đưa tập dữ liệu quay trở lại trạng thái tốt đã biết nếu quá trình áp dụng luật tự động gây sai lệch dữ liệu diện rộng.

---

### MODULE 11: XUẤT DỮ LIỆU & BẢO MẬT ĐẦU RA (EXPORTS MODULE)
*Điều phối bởi:* `ExportsController` (`src/backend/src/modules/exports/exports.controller.ts`)

#### 11.1. `GET /datasets/:id/export/csv`
- **Tên nghiệp vụ:** Xuất dữ liệu CSV sạch dạng luồng trực tiếp (Streaming Plaintext Export - F9.1).
- **Quyền hạn truy cập:** Quyền `Export Dataset`.
- **Tham số:** `id` (Mã Dataset), `version` (tùy chọn phiên bản).
- **Cách thức hoạt động & Luồng xử lý:**
  1. Thiết lập các HTTP response headers: `Content-Type: text/csv; charset=utf-8` và `Content-Disposition: attachment; filename="dataset_clean.csv"`.
  2. Mở một Mongoose Cursor duyệt từng tài liệu từ `dataset_records`.
  3. Sử dụng luồng biến đổi `fast-csv` định dạng từng dòng sang cú pháp CSV chuẩn và pipe trực tiếp vào `express.Response`.
  4. Mức tiêu thụ bộ nhớ RAM máy chủ duy trì dưới 20MB bất kể kích thước tệp xuất.
- **Ý nghĩa & Công dụng nghiệp vụ:**
  Cho phép người dùng tải tệp dữ liệu sạch về máy để phục vụ các phần mềm phân tích như Excel, Tableau, PowerBI hoặc huấn luyện mô hình học máy.

#### 11.2. `POST /datasets/:id/export/secure`
- **Tên nghiệp vụ:** Xuất dữ liệu mã hóa luồng AES-256-GCM bảo vệ bằng mật khẩu (Secure Encrypted Export - F9.2).
- **Quyền hạn truy cập:** Quyền `Export Dataset`.
- **Tham số / DTO đầu vào:** `SecureExportDto` (`passphrase`, `version`).
- **Cách thức hoạt động & Luồng xử lý:**
  1. Tạo muối ngẫu nhiên bảo mật 16 bytes (`Salt`) và vector khởi tạo 12 bytes (`IV`) bằng `crypto.randomBytes`.
  2. Dẫn xuất khóa mã hóa 256-bit bằng thuật toán chuẩn công nghiệp **PBKDF2** (với 100,000 vòng lặp HMAC-SHA256).
  3. Khởi tạo đối tượng mã hóa luồng `crypto.createCipheriv('aes-256-gcm', key, iv)`.
  4. Đọc luồng dữ liệu từ CSDL $\rightarrow$ định dạng CSV $\rightarrow$ mã hóa AES-256-GCM $\rightarrow$ đóng gói cấu trúc nhị phân (Header chứa Salt + IV, Body chứa bản mã, Footer chứa Auth Tag 16 bytes).
  5. Đồng thời đẩy tệp mã hóa lên kho lưu trữ Cloudflare R2 và ghi nhận vào collection `export_tasks`.
  6. Truyền luồng tệp mã hóa `.enc` về cho client tải về.
- **Ý nghĩa & Công dụng nghiệp vụ:**
  Bảo vệ tuyệt mật các tập dữ liệu nhạy cảm (tài chính, hồ sơ y tế, thông tin cá nhân PII) khi truyền qua môi trường internet công cộng hoặc chia sẻ cho bên thứ ba. Chỉ người sở hữu mật khẩu chính xác mới có thể giải mã tệp.

#### 11.3. `GET /datasets/:id/exports`
- **Tên nghiệp vụ:** Lịch sử các tác vụ xuất dữ liệu (Export Tasks Audit Trail).
- **Quyền hạn truy cập:** Quyền `Read ExportTask`.
- **Tham số:** `id` (Mã Dataset).
- **Cách thức hoạt động & Luồng xử lý:**
  Truy vấn các bản ghi tác vụ xuất từ `export_tasks`, cung cấp mã băm toàn vẹn SHA-256, dung lượng, định dạng xuất (`csv` hoặc `aes256_gcm`) và trạng thái mã hóa.
- **Ý nghĩa & Công dụng nghiệp vụ:**
  Kiểm toán việc rò rỉ dữ liệu (Data Loss Prevention - DLP); theo dõi chính xác ai đã tải dữ liệu vào thời điểm nào và dưới hình thức nào.

---

## 3. BẢNG TỔNG HỢP DANH MỤC 43 ENDPOINTS VÀ CHÍNH SÁCH KIỂM SOÁT TRUY CẬP CASL ABAC

| STT | Phương thức | Endpoint | Module | Chính sách Quyền hạn (CASL ABAC / Guard) | Công dụng & Ý nghĩa tóm tắt |
|:---:|:---:|---|---|---|---|
| 1 | `GET` | `/health` | Health | `@Public()` | Kiểm tra kết nối MongoDB, Neo4j, Cloudflare R2 |
| 2 | `POST` | `/auth/register` | Auth | `@Public()` | Đăng ký tài khoản người dùng mới (F1.1) |
| 3 | `POST` | `/auth/login` | Auth | `@Public()` | Đăng nhập & Auto Device Detection (F1.2) |
| 4 | `POST` | `/auth/refresh` | Auth | `@Public()` | Cấp mới JWT Access Token qua Refresh Token (F1.3) |
| 5 | `POST` | `/auth/logout` | Auth | `JwtAuthGuard` | Đăng xuất và thu hồi phiên hiện hành (F1.4) |
| 6 | `GET` | `/auth/sessions` | Auth | `JwtAuthGuard` | Xem danh sách các phiên hoạt động (F1.8) |
| 7 | `DELETE` | `/auth/sessions/:id` | Auth | `JwtAuthGuard` | Thu hồi phiên làm việc từ xa (F1.10) |
| 8 | `GET` | `/users/me` | Users | `JwtAuthGuard` | Lấy thông tin hồ sơ người dùng hiện tại |
| 9 | `PATCH` | `/users/me` | Users | `JwtAuthGuard` | Cập nhật thông tin hồ sơ cá nhân |
| 10 | `DELETE` | `/users/me` | Users | `JwtAuthGuard` | Xóa mềm tài khoản cá nhân (Soft Delete) |
| 11 | `POST` | `/workspaces` | Workspaces | `Create Workspace` | Tạo Không gian làm việc mới (F2.1) |
| 12 | `GET` | `/workspaces` | Workspaces | `Read Workspace` | Lấy danh sách Không gian làm việc (F2.2) |
| 13 | `GET` | `/workspaces/:id` | Workspaces | `Read Workspace` | Xem chi tiết Không gian làm việc (F2.3) |
| 14 | `PATCH` | `/workspaces/:id` | Workspaces | `Update Workspace` | Cập nhật tên/mô tả Không gian làm việc (F2.4) |
| 15 | `DELETE` | `/workspaces/:id` | Workspaces | `Delete Workspace` | Xóa mềm Không gian làm việc (F2.5) |
| 16 | `POST` | `/workspaces/:id/members` | Workspaces | `Update Workspace` | Thêm thành viên vào Không gian làm việc (F2.6) |
| 17 | `DELETE` | `/workspaces/:id/members/:userId` | Workspaces | `Update Workspace` | Gỡ bỏ thành viên khỏi Không gian làm việc (F2.7) |
| 18 | `POST` | `/workspaces/:workspaceId/projects` | Projects | `Create Project` | Tạo Dự án mới trong Workspace (F3.1) |
| 19 | `GET` | `/workspaces/:workspaceId/projects` | Projects | `Read Project` | Lấy danh sách Dự án trong Workspace (F3.2) |
| 20 | `GET` | `/projects/:id` | Projects | `Read Project` | Xem chi tiết cấu hình Dự án (F3.3) |
| 21 | `PATCH` | `/projects/:id` | Projects | `Update Project` | Cập nhật tên/mô tả Dự án (F3.4) |
| 22 | `DELETE` | `/projects/:id` | Projects | `Delete Project` | Xóa mềm Dự án (F3.5) |
| 23 | `POST` | `/projects/:projectId/datasets/upload` | Datasets | `Create Dataset` | Streaming tải lên tệp CSV/Excel (F4.1) |
| 24 | `GET` | `/projects/:projectId/datasets` | Datasets | `Read Dataset` | Lấy Dataset hiện hành của Dự án (F4.2) |
| 25 | `GET` | `/datasets/:id` | Datasets | `Read Dataset` | Xem thông tin chi tiết tập dữ liệu (F4.3) |
| 26 | `PATCH` | `/datasets/:id` | Datasets | `Update Dataset` | Hiệu chỉnh thông tin tập dữ liệu (F4.4) |
| 27 | `DELETE` | `/datasets/:id` | Datasets | `Delete Dataset` | Xóa mềm tập dữ liệu & giải phóng dự án (F4.5) |
| 28 | `GET` | `/datasets/:id/schema` | Datasets | `Read Dataset` | Trích xuất Schema & kiểu dữ liệu các cột (F4.6) |
| 29 | `GET` | `/datasets/:datasetId/records` | Data View | `Read DataRecord` | Phân trang Keyset/Cursor Virtual Grid (F5.1) |
| 30 | `PATCH` | `/datasets/:datasetId/records/:rowIndex` | Data View | `Update DataRecord` | Sửa ô dữ liệu trực tiếp trong lưới (F5.2) |
| 31 | `GET` | `/datasets/:datasetId/columns/:columnName/stats` | Data View | `Read Dataset` | Thống kê cột & Histogram 10 khoảng (F5.3) |
| 32 | `POST` | `/datasets/:id/rules/preview` | Clean Rules | `Execute CleanRule` | Dry-run chạy thử luật trên 100 dòng mẫu (F6.1) |
| 33 | `POST` | `/datasets/:id/rules/apply` | Clean Rules | `Execute CleanRule` | Áp dụng luật làm sạch vào dữ liệu & Commit (F6.2) |
| 34 | `GET` | `/datasets/:id/rules` | Clean Rules | `Read CleanRule` | Xem danh sách các luật đã lưu (F6.3) |
| 35 | `GET` | `/lineage/:dataset_id` | Lineage | `Read Lineage` | Xuất đồ thị Neo4j DAG cho React Flow (F8.1) |
| 36 | `GET` | `/lineage/node/:id/upstream` | Lineage | `Read Lineage` | Truy vết ngược nguồn gốc Root Cause (F8.2) |
| 37 | `GET` | `/lineage/node/:id/downstream` | Lineage | `Read Lineage` | Phân tích tác động lan truyền Downstream (F8.3) |
| 38 | `GET` | `/lineage/verify-integrity/:dataset_id` | Lineage | `Read Lineage` | Đối soát chuỗi băm Merkle chống giả mạo (F8.4) |
| 39 | `POST` | `/lineage/verify-integrity/:dataset_id` | Lineage | `Read Lineage` | Kích hoạt kiểm toán toàn vẹn Merkle (F8.4) |
| 40 | `POST` | `/datasets/:id/versions` | Versions | `Create DatasetVersion` | Tạo Snapshot CSV & Commit phiên bản (F7.1) |
| 41 | `GET` | `/datasets/:id/versions` | Versions | `Read DatasetVersion` | Xem danh sách lịch sử các phiên bản (F7.2) |
| 42 | `GET` | `/datasets/:id/versions/diff` | Versions | `Read DatasetVersion` | So sánh sai khác dữ liệu giữa 2 phiên bản (F7.4) |
| 43 | `GET` | `/datasets/:id/versions/:versionNumber` | Versions | `Read DatasetVersion` | Xem chi tiết một phiên bản chỉ định (F7.3) |
| 44 | `POST` | `/datasets/:id/versions/:versionNumber/rollback` | Versions | `Update DatasetVersion` | Khôi phục tại chỗ In-place Rollback (F7.5) |
| 45 | `GET` | `/datasets/:id/export/csv` | Exports | `Export Dataset` | Xuất luồng dữ liệu CSV sạch sang Response (F9.1) |
| 46 | `POST` | `/datasets/:id/export/secure` | Exports | `Export Dataset` | Xuất dữ liệu mã hóa luồng AES-256-GCM (F9.2) |
| 47 | `GET` | `/datasets/:id/exports` | Exports | `Read ExportTask` | Xem lịch sử các tác vụ xuất dữ liệu |

---

## 4. KẾT LUẬN VÀ GIÁ TRỊ VẬN HÀNH

Hệ thống kiến trúc API của nền tảng thể hiện sự vượt trội qua 4 trụ cột công nghệ chính:
1. **Khả năng chịu tải cao và tối ưu bộ nhớ:** Khai thác triệt để kỹ thuật **Node.js Stream Pipeline** ở cả hai chiều Ingestion (đầu vào) và Export (đầu ra), duy trì mức tiêu thụ RAM luôn $\le 50\text{MB}$ khi làm việc với các tập dữ liệu lớn.
2. **Hiệu năng hiển thị cực nhanh:** Giải pháp phân trang **Keyset Cursor Pagination** trên chỉ mục phức hợp loại bỏ độ trễ phân trang truyền thống, hỗ trợ cuộn mượt mà trên giao diện Web Virtual Grid.
3. **An toàn bảo mật đa tầng:** Kết hợp mã hóa phiên, băm mật khẩu Argon2id, mã hóa tệp AES-256-GCM chuẩn quân sự, cùng mô hình kiểm soát truy cập dựa trên thuộc tính **CASL ABAC** loại bỏ hoàn toàn nguy cơ leo thang đặc quyền ngang (IDOR).
4. **Minh bạch và toàn vẹn dữ liệu:** Toàn bộ lịch sử can thiệp dữ liệu được lưu trữ có cấu trúc trên đồ thị **Neo4j AuraDB** và liên kết bảo chứng bằng chuỗi băm mật mã học **Merkle DAG Tree**, sẵn sàng phục vụ cho các tiêu chuẩn kiểm toán doanh nghiệp khắt khe.
