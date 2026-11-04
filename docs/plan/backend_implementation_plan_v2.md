# KẾ HOẠCH TRIỂN KHAI BACKEND TOÀN DIỆN (BACKEND MASTER IMPLEMENTATION PLAN) - V2.0
**Dự án:** Nền tảng Full-stack Quản lý & Giám sát Chất lượng Dữ liệu có AI Hỗ trợ  
*(Full-Stack Data Management & Quality Assurance Platform with AI Assistance)*  
**Tập tin:** `docs/backend_implementation_plan_v2.md`  
**Phiên bản:** v2.0  
**Ngày lập:** 20/10/2026  
**Trạng thái tài liệu:** Kế hoạch kỹ thuật chuyên sâu hiện thực hóa 100% tầng Backend (NestJS Modular Monolith) kết nối trực tiếp **CSDL Cloud thật (MongoDB Atlas + Neo4j AuraDB)**, Mật mã học, Động cơ AI và 43 RESTful Endpoints.

---

## 1. Lịch sử thay đổi (Change Log v1.0 ➔ v2.0)

- **Thay đổi gì:**
  1. **Loại bỏ hạ tầng CSDL Docker cục bộ:** Không cần chạy container `mongodb` và `neo4j` trên máy tính cá nhân.
  2. **Tích hợp CSDL Cloud thật:** 
     - Thiết lập kết nối **MongoDB Atlas** (Cluster M0 Free qua `mongodb+srv://`) với cấu hình `maxPoolSize: 20`, `serverSelectionTimeoutMS: 10000`.
     - Thiết lập kết nối **Neo4j AuraDB** (Free Tier qua `neo4j+s://`) với chứng chỉ SSL/TLS CA-signed.
  3. **Tối ưu hóa Batching cho Độ trễ Mạng:** Bổ sung yêu cầu kỹ thuật bắt buộc sử dụng `bulkWrite` (chunk 500-1000 bản ghi) trong Streaming Ingestion và câu lệnh Cypher gom nhóm `UNWIND $batch` để giảm thiểu round-trips qua Internet.
- **Lý do:** Người dùng chọn Phương án 2 (Kết nối CSDL Cloud thật), giải phóng hoàn toàn $\sim 1.5\text{ GB}$ RAM máy cục bộ.
- **Ảnh hưởng đến đâu:** Điều chỉnh công việc Sprint B1 (thay việc dựng Docker DB bằng cấu hình Cloud), cập nhật các kịch bản kiểm thử kết nối mạng và tài liệu `.env.example`.

---

## 2. Tổng quan & 3 Câu hỏi Cốt lõi (Rule 1)

1. **Đang làm gì?**
   Xây dựng hoàn chỉnh toàn bộ tầng **Backend Service** tại thư mục `src/backend` theo kiến trúc **Modular Monolith (NestJS 10)**, kết nối trực tiếp CSDL đám mây (MongoDB Atlas + Neo4j AuraDB), hiện thực hóa động cơ Mật mã học (SHA-256 + AES-256-GCM), động cơ Làm sạch dữ liệu xác định (Tầng 1), động cơ AI đa tầng (Tầng 0 Schema, Tầng 2 Unsupervised ML, Tầng 3 Gemini Cloud LLM), và cung cấp tài liệu OpenAPI/Swagger cho 43 RESTful Endpoints.
2. **Cho ai?**
   Phục vụ đồ án tốt nghiệp kỹ sư và cung cấp một hệ thống API vững chắc, có độ tin cậy cao, độc lập hoàn toàn với giao diện người dùng.
3. **Để làm gì?**
   Đảm bảo toàn bộ nghiệp vụ xử lý dữ liệu lớn, kiểm soát chất lượng, truy vết nguồn gốc (Data Lineage), băm toàn vẹn chống giả mạo và bảo mật xuất file được kiểm thử (Unit, Integration, E2E) đạt chuẩn 100% trên môi trường Backend trước khi ghép nối giao diện Frontend.

---

## 3. Các Tiêu chuẩn Kỹ thuật Bất biến

1. **Chuẩn Xóa mềm (Soft Delete Invariant):**
   - Bắt buộc dùng `deleted_at: Date | null` (mặc định `null`, khi xóa gán `new Date()`).
   - Mọi truy vấn đọc mặc định phải kèm `{ deleted_at: null }`.
   - Các trường Unique phải cấu hình MongoDB Partial Unique Index: `{ unique: true, partialFilterExpression: { deleted_at: null } }`.
2. **Chuẩn Mật mã học (Cryptographic Security):**
   - Mật khẩu: Băm bằng `bcrypt` với `SALT_ROUNDS = 12`.
   - Checksum tệp & Băm phiên bản: Băm một chiều bằng `SHA-256`.
     - Tệp gốc: `file_checksum = SHA256(file_stream)`.
     - Phiên bản: `version_hash = SHA256(data_checksum + parent_hash + transformation_log_hash)`.
   - Xuất dữ liệu bảo mật: Mã hóa đối xứng luồng `AES-256-GCM` với khóa dẫn xuất từ PBKDF2 (100.000 vòng lặp, salt 16B, IV 12B, Auth Tag 16B).
3. **Kiểm soát Tải & Độ trễ Mạng (Network & Memory Invariant):**
   - RAM máy cục bộ: Tiến trình Node.js Backend bị khống chế trần `--max-old-space-size=512` (tiêu thụ tối đa 512MB RAM).
   - Truy vấn mạng: Luôn sử dụng Bulk Operations và Cursor Streaming; không fetch toàn bộ collection vào RAM.

---

## 4. Cấu trúc Thư mục Backend (`src/backend`)

```
src/backend/
├── Dockerfile                      # Build container chạy production
├── nest-cli.json                   # Cấu hình Nest CLI
├── package.json                    # Dependencies & Scripts
├── tsconfig.json                   # Cấu hình TypeScript Strict mode
├── tsconfig.build.json
├── .env.example                    # Mẫu biến môi trường kết nối Cloud
├── src/
│   ├── main.ts                     # Điểm khởi chạy: Port 3000, Swagger, Global Pipes/Filters
│   ├── app.module.ts               # Root Module tổng hợp 9 feature modules & core modules
│   │
│   ├── core/                       # Tầng Dùng chung & Hạ tầng (Infrastructure/Core)
│   │   ├── config/                 # Validate biến môi trường bằng class-validator
│   │   │   ├── env.validation.ts
│   │   │   └── configuration.ts
│   │   ├── database/               # Quản lý kết nối CSDL Cloud (Atlas + AuraDB)
│   │   │   ├── mongoose.provider.ts
│   │   │   └── neo4j.service.ts    # Driver wrapper kết nối neo4j+s://
│   │   ├── crypto/                 # Động cơ Mật mã học độc lập
│   │   │   └── crypto.util.ts      # SHA-256, AES-256-GCM, PBKDF2 stream functions
│   │   ├── filters/                # Exception Filter chuẩn hóa lỗi HTTP & Database
│   │   │   └── all-exceptions.filter.ts
│   │   ├── interceptors/           # Response Transform, Logging, Performance Audit
│   │   │   ├── transform.interceptor.ts
│   │   │   └── logging.interceptor.ts
│   │   ├── guards/                 # Phân quyền & Bảo mật
│   │   │   ├── jwt-auth.guard.ts
│   │   │   ├── roles.guard.ts
│   │   │   └── resource-ownership.guard.ts
│   │   └── decorators/             # Custom Decorators (@CurrentUser, @Roles)
│   │       ├── current-user.decorator.ts
│   │       └── roles.decorator.ts
│   │
│   └── modules/                    # 9 Modules Nghiệp vụ theo Feature Specification
│       ├── auth/                   # F1: Authentication, JWT, Refresh Token, Sessions
│       ├── users/                  # F1: Quản lý hồ sơ, quyền Analyst/Admin, Soft Delete
│       ├── workspaces/             # F2: Workspaces & Phân quyền Thành viên
│       ├── projects/               # F3: Projects (Ràng buộc 1 Project = 1 Dataset)
│       ├── datasets/               # F4: Streaming Ingestion, Checksum SHA-256, Schema Detection
│       ├── data-view/              # F5: Cursor Pagination, In-place Cell Edit, Column Stats
│       ├── clean-rules/            # F6: Tầng 0 (Schema Normalizer) & Tầng 1 (Rule Engine)
│       ├── versions/               # F7: Quản lý Phiên bản, Chuỗi băm Merkle, Rollback
│       ├── lineage/                # F8: Neo4j Lineage DAG Traversal, Impact, Verify Integrity
│       ├── exports/                # F9: CSV/Excel Stream Export, AES-256-GCM Encrypted Stream
│       └── ai-engine/              # F6.4-F6.5: Tầng 3 (Gemini API) & Client gọi Python Worker (Tầng 2)
└── test/
    ├── jest-e2e.json
    ├── app.e2e-spec.ts
    ├── crypto.spec.ts
    ├── auth.e2e-spec.ts
    ├── datasets-stream.e2e-spec.ts
    └── lineage-integrity.e2e-spec.ts
```

---

## 5. Phân kỳ Triển khai Backend Chi tiết (4 Sprints thích ứng Cloud)

---

### SPRINT B1: KẾT NỐI CLOUD, CORE KỸ THUẬT & AUTHENTICATION
**Thời lượng dự kiến:** 4 - 5 ngày  
**Mục tiêu:** Thiết lập kết nối thành công tới MongoDB Atlas và Neo4j AuraDB, hoàn thiện bộ khung NestJS với Global Pipes/Filters, xây dựng động cơ mật mã học độc lập có Unit Test, và hoàn tất 10 APIs Xác thực & Quản lý Người dùng (F1.1 $\rightarrow$ F1.10).

#### Công việc chi tiết:
1. **Thiết lập Môi trường & Biến Cấu hình (`.env.example`):**
   - [ ] Tạo file mẫu `.env.example` với đầy đủ tham số kết nối Cloud:
     - `MONGODB_URI`: Chuỗi kết nối MongoDB Atlas (`mongodb+srv://...`).
     - `NEO4J_URI`, `NEO4J_USERNAME`, `NEO4J_PASSWORD`: Chuỗi kết nối Neo4j AuraDB (`neo4j+s://...`).
     - Cấu hình JWT, Salt Rounds và Gemini API Key.
   - [ ] Hướng dẫn kiểm tra cấu hình Network Access trên MongoDB Atlas: Mở quyền truy cập IP `0.0.0.0/0` để máy local kết nối không bị chặn tường lửa.
2. **Khởi tạo Khung NestJS (`src/backend`):**
   - [ ] Cài đặt các dependencies chính trong `package.json` (@nestjs/core, @nestjs/common, @nestjs/mongoose, mongoose, neo4j-driver, bcrypt, passport-jwt, class-validator, class-transformer).
   - [ ] Cấu hình `tsconfig.json` (`strict: true`, path alias `@/*`).
   - [ ] Viết `src/main.ts`:
     - Thiết lập Global Prefix `/api/v1`.
     - Kích hoạt `ValidationPipe` (`whitelist: true`, `transform: true`).
     - Tích hợp Swagger OpenAPI (`@nestjs/swagger`) tại `/api/v1/docs`.
     - Đăng ký `AllExceptionsFilter` và `TransformInterceptor`.
3. **Hiện thực hóa Tầng Kết nối CSDL Cloud Cơ sở (`src/backend/src/core/database`):**
   - [ ] `MongooseProvider`: Kết nối MongoDB Atlas qua TLS 1.3, cấu hình connection pooling (`maxPoolSize: 20`, `minPoolSize: 5`), thiết lập timeout 10s đề phòng mạng chậm.
   - [ ] `Neo4jService`: Wrapper bọc `neo4j-driver` với cấu hình mã hóa bắt buộc `encrypted: 'ENCRYPTION_ON'` và `trust: 'TRUST_SYSTEM_CA_SIGNED_CERTIFICATES'`. Quản lý mở/đóng driver an toàn qua `onApplicationShutdown`.
   - [ ] Xây dựng endpoint kiểm tra sức khỏe hệ thống: `GET /api/v1/health` kiểm tra ping đồng thời tới MongoDB Atlas và Neo4j AuraDB.
4. **Hiện thực hóa Động cơ Mật mã học (`src/core/crypto/crypto.util.ts`):**
   - [ ] Hàm băm SHA-256 buffer và SHA-256 stream (`computeSha256Buffer`, `computeSha256Stream`).
   - [ ] Hàm mã hóa/giải mã luồng AES-256-GCM (`createAes256GcmEncryptStream`, `createAes256GcmDecryptStream`) với PBKDF2 100.000 vòng lặp.
   - [ ] **Viết Unit Test Jest (`crypto.spec.ts`):** Kiểm thử tính chính xác của hàm băm và bảo toàn tính toàn vẹn 100% khi mã hóa - giải mã dữ liệu nhị phân.
5. **Hiện thực hóa Module Auth & Users (`src/modules/auth` & `src/modules/users`):**
   - [ ] Schemas: `UserSchema` (với `deleted_at: Date | null`, partial unique email) và `UserSessionSchema` (với TTL Index tự hủy sau 7 ngày trên Atlas).
   - [ ] Hiện thực hóa 10 Endpoints (F1.1 $\rightarrow$ F1.10):
     - `POST /api/v1/auth/register`, `POST /api/v1/auth/login`, `POST /api/v1/auth/refresh`, `POST /api/v1/auth/logout`.
     - `POST /api/v1/auth/forgot-password`, `POST /api/v1/auth/reset-password`.
     - `GET /api/v1/users/me`, `PATCH /api/v1/users/me`.
     - `GET /api/v1/auth/sessions`, `DELETE /api/v1/auth/sessions/:id`.
   - [ ] Xây dựng `JwtAuthGuard`, `RolesGuard`, và Decorator `@CurrentUser()`.

---

### SPRINT B2: WORKSPACES, STREAMING INGESTION & VIRTUAL GRID API
**Thời lượng dự kiến:** 5 - 6 ngày  
**Mục tiêu:** Quản lý Workspace/Project (ràng buộc 1 Project = 1 Dataset), Streaming Ingestion tiếp nhận tệp lớn với cơ chế BulkWrite Chunks 1.000 bản ghi tối ưu độ trễ Cloud, tính checksum SHA-256, và cung cấp API phân trang Virtual Grid.

#### Công việc chi tiết:
1. **Module Workspaces & Projects (`src/modules/workspaces` & `src/modules/projects`):**
   - [ ] Schemas: `WorkspaceSchema` và `ProjectSchema` kèm `deleted_at: Date | null` và Partial Unique Indexes.
   - [ ] Hiện thực hóa 7 Endpoints Workspace (F2.1 $\rightarrow$ F2.7) và 5 Endpoints Project (F3.1 $\rightarrow$ F3.5).
   - [ ] **Ràng buộc nghiệp vụ:** Kiểm tra `has_dataset: true` để đảm bảo 1 Project chỉ có tối đa 1 Dataset hoạt động.
   - [ ] Hiện thực hóa `ResourceOwnershipGuard` phân quyền truy cập tài nguyên.
2. **Module Dataset Ingestion theo Luồng Tối ưu Mạng (`src/modules/datasets`):**
   - [ ] Schemas: `DatasetSchema` và `DatasetRecordSchema` (đánh index `{ dataset_id: 1, version_number: 1, row_index: 1 }`).
   - [ ] **Streaming Ingestion API (`POST /api/v1/projects/:id/datasets/upload` - F4.1):**
     - Dùng `busboy` nhận multipart stream nhị phân.
     - Vừa stream qua hàm tính `computeSha256Stream`, vừa stream qua parser (`fast-csv` hoặc `xlsx`).
     - **Deduplication Check:** Tìm kiếm trên Atlas xem đã tồn tại `file_checksum` chưa.
     - **Tầng 0 Schema Normalizer:** Quét 500 dòng đầu tiên để suy luận kiểu dữ liệu.
     - **BulkWrite Chunks:** Gom bản ghi thành từng mảng 1.000 records và thực hiện `bulkWrite` lên Atlas để giảm thiểu round-trips qua Internet.
   - [ ] Hiện thực hóa các API quản lý Dataset (F4.2 $\rightarrow$ F4.6).
3. **Module Virtual Grid API & Thống kê Cột (`src/modules/data-view`):**
   - [ ] `GET /api/v1/datasets/:id/records` (F5.1):
     - Keyset Cursor Pagination dựa vào `{ row_index: { $gt: last_seen_index } }` kết hợp `.lean()` để phản hồi trong thời gian $\le 80\text{ ms}$ qua Internet.
     - Hỗ trợ lọc động (Filter) và sắp xếp (Sort).
   - [ ] `PATCH /api/v1/datasets/:id/records/:row_index` (F5.2): In-place Cell Edit.
   - [ ] `GET /api/v1/datasets/:id/columns/:col/stats` (F5.3): MongoDB Aggregation Pipeline tính toán Null count, Min, Max, Mean, Median, và Histogram 10 khoảng.

---

### SPRINT B3: PHẢ HỆ AURA, PHIÊN BẢN HÓA MERKLE & CLEAN RULES
**Thời lượng dự kiến:** 5 - 6 ngày  
**Mục tiêu:** Tích hợp đồ thị phả hệ trên Neo4j AuraDB bằng Cypher Batching, quản lý phiên bản với chuỗi băm Merkle-like, động cơ làm sạch xác định Tầng 1, và xuất dữ liệu mã hóa luồng AES-256-GCM.

#### Công việc chi tiết:
1. **Module Phả hệ Dữ liệu Neo4j AuraDB (`src/modules/lineage`):**
   - [ ] Viết các câu truy vấn Cypher tối ưu hóa gom nhóm tham số (`lineage-queries.cypher.ts`) sử dụng mệnh đề `UNWIND $batch` để hạn chế latency mạng.
   - [ ] **Dual-write Synchronization Service:**
     - Đồng bộ mỗi phiên bản mới hoặc biến đổi từ MongoDB Atlas sang Neo4j AuraDB.
     - Cơ chế Retry 3 lần với Exponential Backoff đề phòng mạng quốc tế chập chờn hoặc AuraDB đang ở trạng thái resume.
   - [ ] Hiện thực hóa 4 API Lineage (F8.1 $\rightarrow$ F8.4):
     - `GET /api/v1/lineage/:dataset_id`: Trả về toàn bộ DAG `{ nodes, edges }`.
     - `GET /api/v1/lineage/node/:id/upstream` & `GET /api/v1/lineage/node/:id/downstream`.
     - `GET /api/v1/lineage/verify-integrity/:dataset_id`: So sánh mã băm trong MongoDB Atlas với đường đi trên AuraDB để phát hiện can thiệp giả mạo.
2. **Module Quản lý Phiên bản Dữ liệu (`src/modules/versions`):**
   - [ ] Schema `DatasetVersionSchema` với chuỗi băm Merkle-like `version_hash = SHA256(data_checksum + parent_hash + rules_hash)`.
   - [ ] Hiện thực hóa các API Phiên bản (F7.1 $\rightarrow$ F7.5): Commit version snapshot, danh sách phiên bản, Rollback dữ liệu, và Diff so sánh 2 phiên bản.
3. **Module Động cơ Làm sạch Xác định - Tầng 1 (`src/modules/clean-rules`):**
   - [ ] Xây dựng `RuleExecutor` với 4 nhóm luật chuẩn hóa: Null Handling, Standardization, Deduplication, Regex Validation.
   - [ ] `POST /api/v1/datasets/:id/rules/preview` (F6.1): Dry-run chạy thử trên 100 dòng mẫu không chạm vào dữ liệu thật.
   - [ ] `POST /api/v1/datasets/:id/rules/apply` (F6.2): Chạy luật hàng loạt trên toàn bộ bảng qua `bulkWrite` trên Atlas.
4. **Module Xuất Dữ liệu Bảo mật (`src/modules/exports`):**
   - [ ] `GET /api/v1/datasets/:id/export/csv` (F9.1): Stream từ Atlas cursor $\rightarrow$ fast-csv $\rightarrow$ ghi ra HTTP Response (RAM tiêu thụ $\le 20\text{ MB}$).
   - [ ] `POST /api/v1/datasets/:id/export/secure` (F9.2): Stream mã hóa AES-256-GCM bảo vệ bằng mật khẩu người dùng $\rightarrow$ trả về file `.enc.csv`.

---

### SPRINT B4: ĐỘNG CƠ AI ĐA TẦNG, KIỂM THỬ E2E & XUẤT BẢN SWAGGER
**Thời lượng dự kiến:** 4 - 5 ngày  
**Mục tiêu:** Tích hợp Google Gemini API (Tầng 3) với Structured JSON Output và fallback an toàn, cắm worker Python (Tầng 2 Unsupervised ML), hoàn thành bộ kiểm thử tự động $\ge 85\%$ coverage, đo kiểm RAM $\le 512\text{ MB}$, và xuất bản Swagger Docs.

#### Công việc chi tiết:
1. **Module Tích hợp AI Tầng 3 - Google Gemini API (`src/modules/ai-engine`):**
   - [ ] Cài đặt SDK `@google/genai`, cấu hình `GEMINI_API_KEY` từ biến môi trường.
   - [ ] Xây dựng Prompt Templates hướng dẫn Gemini phân tích lỗi dữ liệu và trả về JSON Schema nghiêm ngặt (`responseSchema`).
   - [ ] `POST /api/v1/datasets/:id/ai/analyze` (F6.4): Lấy 20 dòng mẫu chứa lỗi + metadata cột gửi lên Gemini API; lưu kết quả gợi ý vào Atlas.
   - [ ] Timeout 15s và cơ chế Fallback tự động sang bộ luật Tầng 1 nếu Gemini API gặp sự cố hoặc cạn quota.
2. **Tích hợp AI Tầng 2 - Unsupervised ML Worker (Python FastAPI Service):**
   - [ ] Worker Python chạy thuật toán Isolation Forest, Local Outlier Factor (LOF), và Median Absolute Deviation (MAD).
   - [ ] Xây dựng client gọi nội bộ trong NestJS nhận danh sách `outlier_row_indices`.
3. **Bộ Kiểm thử Tự động Toàn diện Backend (`src/backend/test`):**
   - [ ] **Unit Tests (Jest):** Đạt độ phủ $\ge 85\%$ cho `crypto.util.ts`, `clean-rules.engine.ts`, `auth.service.ts`.
   - [ ] **Integration Tests (Supertest):** Kiểm thử 43/43 API endpoints kết nối trực tiếp Atlas/AuraDB.
   - [ ] **E2E Pipeline Test (`app.e2e-spec.ts`):** Kiểm thử toàn bộ vòng đời: Đăng ký $\rightarrow$ Upload $\rightarrow$ Checksum $\rightarrow$ Clean Rule $\rightarrow$ Commit Version $\rightarrow$ Lineage Integrity $\rightarrow$ AES-256 Export.
4. **Kiểm tra Tải, Bộ nhớ & Xuất bản Tài liệu:**
   - [ ] Xác nhận mức tiêu thụ RAM của tiến trình NestJS Backend không vượt quá $512\text{ MB}$.
   - [ ] Cấu hình Helmet, CORS chặt chẽ, và Rate Limiting (100 req/phút).
   - [ ] Hoàn thiện Swagger UI tại `/api/v1/docs` đầy đủ schemas, request body và sample responses cho cả 43 endpoints.

---

## 6. Danh mục 43 RESTful Endpoints

| STT | Endpoint | Method | Chức năng chính | Sprint |
| :---: | :--- | :---: | :--- | :---: |
| 1 | `/api/v1/auth/register` | POST | Đăng ký tài khoản (bcrypt hash) | B1 |
| 2 | `/api/v1/auth/login` | POST | Đăng nhập (JWT access + refresh token) | B1 |
| 3 | `/api/v1/auth/refresh` | POST | Cấp mới Access Token | B1 |
| 4 | `/api/v1/auth/logout` | POST | Thu hồi refresh token hiện hành | B1 |
| 5 | `/api/v1/auth/forgot-password` | POST | Yêu cầu link đặt lại mật khẩu | B1 |
| 6 | `/api/v1/auth/reset-password` | POST | Đặt lại mật khẩu mới qua token | B1 |
| 7 | `/api/v1/auth/sessions` | GET | Xem danh sách phiên đăng nhập | B1 |
| 8 | `/api/v1/auth/sessions/:id` | DELETE | Thu hồi phiên từ xa | B1 |
| 9 | `/api/v1/users/me` | GET | Lấy thông tin tài khoản hiện tại | B1 |
| 10 | `/api/v1/users/me` | PATCH | Cập nhật hồ sơ tài khoản | B1 |
| 11 | `/api/v1/workspaces` | POST | Tạo mới Workspace | B2 |
| 12 | `/api/v1/workspaces` | GET | Danh sách Workspace của tôi | B2 |
| 13 | `/api/v1/workspaces/:id` | GET | Chi tiết Workspace | B2 |
| 14 | `/api/v1/workspaces/:id` | PATCH | Cập nhật tên/mô tả Workspace | B2 |
| 15 | `/api/v1/workspaces/:id` | DELETE | Xóa mềm Workspace (`deleted_at`) | B2 |
| 16 | `/api/v1/workspaces/:id/members` | POST | Thêm thành viên vào Workspace | B2 |
| 17 | `/api/v1/workspaces/:id/members/:uid` | DELETE | Xóa thành viên khỏi Workspace | B2 |
| 18 | `/api/v1/workspaces/:id/projects` | POST | Tạo Project mới (Ràng buộc 1 Prj = 1 Dts) | B2 |
| 19 | `/api/v1/workspaces/:id/projects` | GET | Danh sách Projects trong Workspace | B2 |
| 20 | `/api/v1/projects/:id` | GET | Chi tiết Project | B2 |
| 21 | `/api/v1/projects/:id` | PATCH | Cập nhật tên Project | B2 |
| 22 | `/api/v1/projects/:id` | DELETE | Xóa mềm Project | B2 |
| 23 | `/api/v1/projects/:id/datasets/upload` | POST | Streaming upload, SHA-256 checksum, Schema Tầng 0 | B2 |
| 24 | `/api/v1/datasets/:id` | GET | Chi tiết Metadata của Dataset | B2 |
| 25 | `/api/v1/datasets/:id` | PATCH | Cập nhật tên/mô tả Dataset | B2 |
| 26 | `/api/v1/datasets/:id` | DELETE | Xóa mềm Dataset | B2 |
| 27 | `/api/v1/datasets/:id/records` | GET | Keyset Cursor Pagination, Lọc & Sắp xếp | B2 |
| 28 | `/api/v1/datasets/:id/records/:row_index` | PATCH | In-place Cell Edit cập nhật trực tiếp | B2 |
| 29 | `/api/v1/datasets/:id/columns/:col/stats` | GET | Thống kê phân phối cột & Histogram 10 khoảng | B2 |
| 30 | `/api/v1/datasets/:id/rules/preview` | POST | Dry-run thử nghiệm luật trên 100 dòng mẫu | B3 |
| 31 | `/api/v1/datasets/:id/rules/apply` | POST | Áp dụng luật hàng loạt vào toàn bộ bảng | B3 |
| 32 | `/api/v1/datasets/:id/rules/history` | GET | Xem lịch sử các luật đã áp dụng | B3 |
| 33 | `/api/v1/datasets/:id/versions/commit` | POST | Commit phiên bản mới (Merkle-like `version_hash`) | B3 |
| 34 | `/api/v1/datasets/:id/versions` | GET | Lịch sử các phiên bản | B3 |
| 35 | `/api/v1/datasets/:id/versions/:vid/rollback` | POST | Rollback dữ liệu về phiên bản cũ | B3 |
| 36 | `/api/v1/datasets/:id/versions/diff` | GET | So sánh khác biệt giữa 2 phiên bản | B3 |
| 37 | `/api/v1/lineage/:dataset_id` | GET | Lấy đồ thị phả hệ dữ liệu Neo4j DAG | B3 |
| 38 | `/api/v1/lineage/node/:id/upstream` | GET | Truy vết ngược về nguồn gốc (Root Cause) | B3 |
| 39 | `/api/v1/lineage/node/:id/downstream` | GET | Phân tích tác động lan truyền (Impact Analysis) | B3 |
| 40 | `/api/v1/lineage/verify-integrity/:dataset_id` | GET | Xác minh chuỗi băm chống giả mạo | B3 |
| 41 | `/api/v1/datasets/:id/export/csv` | GET | Xuất dữ liệu CSV theo luồng stream | B3 |
| 42 | `/api/v1/datasets/:id/export/secure` | POST | Xuất dữ liệu mã hóa AES-256-GCM bảo vệ bằng mật khẩu | B3 |
| 43 | `/api/v1/datasets/:id/ai/analyze` | POST | Phân tích chất lượng dữ liệu bằng AI (Gemini + ML) | B4 |

---

## 7. Tiêu chuẩn Nghiệm thu Backend (Definition of Done - DoD)

1. **Mã nguồn chuẩn mực:** Tuân thủ TypeScript Strict mode, không dùng `any`, tuân thủ quy ước đặt tên (Rule 9).
2. **Soft Delete chuẩn hóa:** Truy vấn luôn có `{ deleted_at: null }`, Unique Index dùng partialFilterExpression trên Atlas.
3. **Độ trễ & Kết nối Cloud an toàn:** Cấu hình connection pooling, retry logic; các tác vụ nặng dùng BulkWrite chunks $\le 1000$ records.
4. **Tài liệu hóa API:** Khai báo đầy đủ Decorators Swagger (`@ApiOperation`, `@ApiResponse`, `@ApiBody`), xuất hiện chuẩn xác trên `/api/v1/docs`.
5. **Kiểm thử tự động:** Test suite Jest đạt coverage $\ge 85\%$ cho Core Logic.
