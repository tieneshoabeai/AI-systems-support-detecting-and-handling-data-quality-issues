# BẢN THIẾT KẾ KỸ THUẬT SPRINT B1 (SPRINT B1 DESIGN SPECIFICATION)
**Dự án:** Nền tảng Full-stack Quản lý & Giám sát Chất lượng Dữ liệu có AI Hỗ trợ  
*(Full-Stack Data Management & Quality Assurance Platform with AI Assistance)*  
**Tập tin:** `docs/sprint_b1_design.md`  
**Phiên bản:** v1.0  
**Giai đoạn:** Sprint B1 (Tầng Nền tảng Shared, Hybrid Cloud, Mật mã học & Module Xác thực)  
**Trạng thái:** Đã hoàn thành và nghiệm thu thực tế 100% (7/7 Test Suites, 20/20 Tests PASS)

---

## 1. Lý do & Mục tiêu Thiết kế Sprint B1

### 1.1. Bối cảnh
Trước khi xây dựng các nghiệp vụ cốt lõi về dữ liệu (Workspaces, Projects, Datasets Streaming Ingestion ở Sprint B2), hệ thống bắt buộc phải có một **Tầng Nền tảng (Shared Foundation)** vững chắc và độc lập, giải quyết các bài toán hạ tầng:
- Kết nối CSDL Đa mô hình Đám mây (Multi-model Cloud Database): MongoDB Atlas (Document) + Neo4j AuraDB (Graph).
- Tầng Lưu trữ Đối tượng (Cloudflare R2 Object Storage / S3 Compatible) kèm cơ chế Local Fallback để không bị phụ thuộc vào môi trường.
- Động cơ Mật mã học độc lập: SHA-256 xác thực toàn vẹn và AES-256-GCM bảo mật xuất dữ liệu.
- Cơ chế Kiểm soát Truy cập Dựa trên Thuộc tính (ABAC) với CASL và Guard 2 tầng loại bỏ Double Query.
- Xác thực Zero-Trust, Quản lý Phiên đăng nhập (Session Management) với TTL Index, Refresh Token Hash SHA-256.
- Đảm bảo an toàn tuyệt đối về kiểu dữ liệu (**Zero Any Policy**).

---

## 2. Kiến trúc Tầng Nền tảng (`src/backend/src/shared`)

### 2.1. Phân quyền Thuộc tính Thực thể CASL (`shared/casl/`)
Khác với RBAC (Role-Based Access Control) thông thường chỉ kiểm tra vai trò thô sơ, hệ thống áp dụng **ABAC (Attribute-Based Access Control)** qua thư viện `@casl/ability`:
- **Thực thể phân quyền (Subjects):** `Workspace`, `Project`, `Dataset`, `DataRecord`, `CleanRule`, `DatasetVersion`, `Lineage`, `ExportTask`, `User`, `Session`.
- **Hành động (Actions):** `Manage`, `Create`, `Read`, `Update`, `Delete`, `Execute`, `Export`.
- **Thiết kế phân tầng quyền trong `casl-ability.factory.ts`:**
  - `admin`: Có quyền `can(Action.Manage, 'all')`.
  - `owner`: Toàn quyền trên Workspace và toàn bộ tài nguyên con (`Project`, `Dataset`, `Lineage`, v.v.) thuộc workspace đó.
  - `editor`: Được phép tạo, đọc, cập nhật, áp dụng luật và xuất file; **nghiêm cấm quyền xóa** (`cannot(Action.Delete, 'Workspace')`, `cannot(Action.Delete, 'Dataset')`).
  - `viewer`: Chỉ có quyền `Action.Read` và `Action.Export`.
- **`PoliciesGuard` 2 tầng (Two-phase Policy Check):**
  - **Tầng 1 (Static Check):** Kiểm tra quyền tổng quát dựa trên vai trò của người dùng trên kiểu thực thể (ví dụ: User có quyền tạo Dataset không?).
  - **Tầng 2 (Instance Check qua Loader):** Nạp thực thể từ CSDL qua `PolicyResourceLoader` và gán vào `request.resource`. Decorator `@CurrentResource()` giúp Controller/Service tái sử dụng ngay thực thể này, **loại bỏ hoàn toàn lỗi Double Database Query**.

---

### 2.2. Tầng Lưu trữ Đối tượng Dual-mode (`shared/storage/`)
Áp dụng **Strategy Pattern** cho phép hệ thống hoạt động liền mạch trên cả môi trường Production Cloud và môi trường Local Development:
- **Chế độ Cloud (Cloudflare R2 / AWS S3):**
  - Kích hoạt khi có đầy đủ biến môi trường `S3_ENDPOINT`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_BUCKET_NAME`.
  - Sử dụng `@aws-sdk/client-s3` và `@aws-sdk/lib-storage` để upload dạng luồng (`Upload` parallel streams).
  - Tận dụng gói **10 GB miễn phí vĩnh viễn** và **0 đồng phí truyền tải (Zero Egress Fees)** của Cloudflare R2.
- **Chế độ Cục bộ (Local Fallback):**
  - Tự động kích hoạt khi các khóa S3 bị bỏ trống.
  - Ghi và đọc file nhị phân trực tiếp từ thư mục `./storage/` (`raw_files/`, `snapshots/`, `exports/`).
- **Cơ chế Kiểm soát Hạn mức (Storage Quota Guard):**
  - Hạn mức tối đa: `STORAGE_MAX_QUOTA_BYTES=10737418240` (10 GB).
  - Ngưỡng cảnh báo sớm: `STORAGE_WARN_THRESHOLD_RATIO=0.9` (90% = 9 GB) kích hoạt cảnh báo ntfy.sh.
  - Ngưỡng chặn cứng: 100% từ chối upload với mã `HTTP 413` để ngăn chặn rủi ro phát sinh cước trên thẻ tín dụng.

---

### 2.3. Động cơ Mật mã học (`shared/crypto/crypto.util.ts`)
- **Băm SHA-256 xác thực toàn vẹn (Integrity Hashing):**
  - `computeSha256Buffer(data: Buffer | string): string`
  - `computeSha256Stream(stream: Readable): Promise<string>`
  - Phục vụ băm chuỗi Refresh Token, băm dữ liệu tệp tải lên (`file_checksum`), và chuỗi băm Merkle-like cho các phiên bản dữ liệu (`version_hash`).
- **Mã hóa luồng AES-256-GCM (Authenticated Encryption):**
  - `createAes256GcmEncryptStream(password: string): { stream: Transform; salt: Buffer; iv: Buffer; getAuthTag: () => Buffer }`
  - `createAes256GcmDecryptStream(password: string, salt: Buffer, iv: Buffer, authTag: Buffer): Transform`
  - Dẫn xuất khóa mã hóa qua **PBKDF2** (100.000 vòng lặp, SHA-512, Salt 16 bytes).
  - Đảm bảo tính toàn vẹn (Tamper-proof) với Authentication Tag 16 bytes (GCM mode).
- **Che giấu Dữ liệu Nhạy cảm (PII Data Masking - `mask-pii.ts`):**
  - Che giấu Email (`us***@gmail.com`), Số điện thoại (`090*****67`), CCCD/ID.
  - `sanitizeObjectForLog`: Đệ quy làm sạch các đối tượng trước khi ghi log, tự động thay thế `[REDACTED]` cho các khóa `password`, `token`, `secret`, `api_key` (tuân thủ Quy tắc 6 Bảo mật).

---

### 2.4. Quản lý Giao dịch CSDL Ngầm (Ambient Mongo Transaction - `shared/database/`)
- **Vấn đề:** Tránh việc phải truyền thủ công đối tượng `session: ClientSession` qua hàng loạt tầng Service và Repository gây rối mã nguồn (leaky abstraction).
- **Giải pháp:** Sử dụng `AsyncLocalStorage<ClientSession>` của Node.js:
  - `mongo-session-context.ts`: Lưu trữ session ngầm cho từng luồng xử lý bất đồng bộ.
  - `mongoose-transaction.service.ts`: Cung cấp hàm `runInTransaction<T>(work: () => Promise<T>): Promise<T>` tự động khởi tạo session, mở transaction, commit hoặc abort khi có lỗi.
  - `base-mongo.repository.ts`: Tự động nhận diện ambient session thông qua `resolveMongoSession()`, đồng thời áp dụng ràng buộc xóa mềm `{ deleted_at: null }`.

---

### 2.5. Tự động hóa Tài liệu Swagger từ Zod (`shared/swagger/`)
- Không sử dụng `class-validator` hay `class-transformer` để tránh xung đột mô hình dữ liệu.
- `zodToOpenApiSchema`: Chuyển đổi Zod AST sang OpenAPI 3.0 Schema Object qua `zod-to-json-schema`.
- `@ApiZodBody(Schema)` và `@ApiZodQuery(Schema)`: Tự động tài liệu hóa Body và Query parameters trên Swagger UI tại `/api/v1/docs`.

---

## 3. Thiết kế Module Xác thực & Người dùng (`src/modules/auth` & `src/modules/users`)

### 3.1. Schemas CSDL MongoDB Atlas
1. **Collection `users`:**
   - `_id`: ObjectId
   - `email`: string (lowercase, trimmed, unique partial filter `{ deleted_at: null }`)
   - `password_hash`: string (bcrypt 12 rounds)
   - `first_name`: string
   - `last_name`: string
   - `role`: 'admin' | 'analyst'
   - `status`: 'active' | 'blocked'
   - `deleted_at`: Date | null (hỗ trợ xóa mềm)
   - `created_at`, `updated_at`
2. **Collection `user_sessions`:**
   - `_id`: ObjectId
   - `user_id`: ObjectId (ref: 'User', index: true)
   - `refresh_token_hash`: string (băm SHA-256, không lưu token gốc)
   - `device_name`: string
   - `ip_address`: string
   - `user_agent`: string
   - `is_revoked`: boolean (default: false)
   - `expires_at`: Date (TTL Index tự động xóa document sau 7 ngày trên Atlas)
   - `created_at`, `updated_at`

### 3.2. Danh sách 10 RESTful Endpoints (F1.1 $\to$ F1.10)
| Endpoint | Method | Quyền hạn | Mô tả |
|---|---|---|---|
| `/api/v1/auth/register` | POST | Public | Đăng ký tài khoản người dùng mới (vai trò analyst) |
| `/api/v1/auth/login` | POST | Public | Đăng nhập bằng Email/Password, sinh Access Token (15m) và Refresh Token (7d) |
| `/api/v1/auth/refresh` | POST | Public | Cấp mới Access Token bằng Refresh Token (kiểm tra SHA-256 hash và trạng thái revoked) |
| `/api/v1/auth/logout` | POST | Bearer JWT | Đăng xuất, thu hồi phiên làm việc hiện tại (`is_revoked = true`) |
| `/api/v1/auth/forgot-password` | POST | Public | Yêu cầu mã đặt lại mật khẩu |
| `/api/v1/auth/reset-password` | POST | Public | Đặt lại mật khẩu mới |
| `/api/v1/users/me` | GET | Bearer JWT | Xem thông tin hồ sơ của chính người dùng hiện tại |
| `/api/v1/users/me` | PATCH | Bearer JWT | Cập nhật họ tên, avatar cá nhân |
| `/api/v1/auth/sessions` | GET | Bearer JWT | Xem danh sách các phiên đăng nhập đang hoạt động |
| `/api/v1/auth/sessions/:id` | DELETE | Bearer JWT | Thu hồi phiên đăng nhập từ xa trên thiết bị khác |

---

## 4. Nguyên tắc Zero Any Policy (Mục 13)
Toàn bộ mã nguồn Sprint B1 được rà soát và chuẩn hóa nghiêm ngặt:
- 100% không chứa kiểu `any` (`: any`, `as any`, `<any>`, `Record<string, any>`).
- Toàn bộ được thay thế bằng `unknown`, generics chuẩn, Mongoose `FilterQuery<T>`, `UpdateQuery<T>`, `ProjectionType<T>`.
- Kiểm thử kiến trúc tự động `test/zero-any.spec.ts` quét toàn bộ dự án, bảo vệ vĩnh viễn không để `any` xuất hiện trở lại.

---

## 5. Kết quả Nghiệm thu Thực tế Sprint B1
- **Biên dịch TypeScript:** `tsc --noEmit` đạt 0 lỗi (Exit code 0).
- **Nest Build:** `nest build` biên dịch sạch vào `dist/` (Exit code 0).
- **Kiểm thử tự động (Jest):** 7/7 Test Suites PASS 100% (20/20 tests):
  1. `PASS test/mask-pii.spec.ts` (Bảo mật PII & Masking)
  2. `PASS test/zero-any.spec.ts` (Kiểm thử kiến trúc Zero Any)
  3. `PASS test/casl.spec.ts` (Phân quyền thực thể CASL)
  4. `PASS test/zod-openapi.spec.ts` (Tự động hóa Swagger từ Zod)
  5. `PASS test/crypto.spec.ts` (SHA-256, AES-256-GCM, PBKDF2)
  6. `PASS test/storage.spec.ts` (Dual-mode Storage S3/Local)
  7. `PASS test/guard-coverage.spec.ts` (Zero-Trust Guard Coverage 100% routes)
- **Kiểm thử Live Database:** Kết nối thành công MongoDB Atlas, Neo4j AuraDB, và ntfy.sh alert channel.
