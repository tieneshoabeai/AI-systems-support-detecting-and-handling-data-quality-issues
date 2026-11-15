# KẾ HOẠCH TRIỂN KHAI BACKEND TOÀN DIỆN (BACKEND MASTER IMPLEMENTATION PLAN)
**Dự án:** Nền tảng Full-stack Quản lý & Giám sát Chất lượng Dữ liệu có AI Hỗ trợ  
*(Full-Stack Data Management & Quality Assurance Platform with AI Assistance)*  
**Tập tin:** `docs/backend_implementation_plan_v1.md`  
**Phiên bản:** v1.0  
**Ngày lập:** 20/10/2026  
**Trạng thái tài liệu:** Kế hoạch kỹ thuật chuyên sâu hiện thực hóa 100% tầng Backend (NestJS Modular Monolith, Polyglot Persistence, Mật mã học, Động cơ AI và 43 RESTful Endpoints) trước khi bước sang Frontend.

---

## 1. Tổng quan & 3 Câu hỏi Cốt lõi (Rule 1)

1. **Đang làm gì?**
   Xây dựng hoàn chỉnh toàn bộ tầng **Backend Service** đặt tại thư mục `src/backend` theo kiến trúc **Modular Monolith (NestJS 10)**, tích hợp hạ tầng CSDL kép (MongoDB 7.0 + Neo4j 5.x) qua Docker Compose, hiện thực hóa động cơ Mật mã học (SHA-256 + AES-256-GCM), động cơ Làm sạch dữ liệu xác định (Tầng 1), động cơ AI đa tầng (Tầng 0 Schema, Tầng 2 Unsupervised ML, Tầng 3 Gemini Cloud LLM), và cung cấp tài liệu OpenAPI/Swagger cho toàn bộ 43 RESTful Endpoints.
2. **Cho ai?**
   Phục vụ đồ án tốt nghiệp kỹ sư và cung cấp một hệ thống API vững chắc, có độ tin cậy cao, độc lập hoàn toàn với giao diện người dùng.
3. **Để làm gì?**
   Đảm bảo toàn bộ nghiệp vụ xử lý dữ liệu lớn, kiểm soát chất lượng, truy vết nguồn gốc (Data Lineage), băm toàn vẹn chống giả mạo và bảo mật xuất file được kiểm thử (Unit, Integration, E2E) đạt chuẩn 100% trên môi trường Backend trước khi ghép nối giao diện Frontend.

---

## 2. Các Ràng buộc & Tiêu chuẩn Kỹ thuật Bất biến

Mọi module Backend phải tuân thủ nghiêm ngặt các tiêu chuẩn sau:

1. **Chuẩn Xóa mềm (Soft Delete Invariant):**
   - Tuyệt đối không dùng `is_deleted`.
   - Bắt buộc dùng trường duy nhất `deleted_at: Date | null` (mặc định `null`, khi xóa gán `new Date()`).
   - Mọi truy vấn đọc mặc định phải kèm `{ deleted_at: null }`.
   - Các trường Unique (ví dụ: `email` trong `users`, `name` trong `workspaces`, `projects`) phải cấu hình MongoDB Partial Unique Index: `{ unique: true, partialFilterExpression: { deleted_at: null } }`.
2. **Chuẩn Mật mã học (Cryptographic Security):**
   - Mật khẩu: Băm bằng `bcrypt` với `SALT_ROUNDS = 12`.
   - Checksum tệp & Băm phiên bản: Băm một chiều bằng `SHA-256`. 
     - Tệp gốc: `file_checksum = SHA256(file_stream)`.
     - Phiên bản: `version_hash = SHA256(data_checksum + parent_hash + transformation_log_hash)`.
   - Xuất dữ liệu bảo mật: Mã hóa đối xứng luồng `AES-256-GCM` với khóa dẫn xuất từ PBKDF2 (100.000 vòng lặp, salt 16B, IV 12B, Auth Tag 16B).
3. **Giới hạn Bộ nhớ RAM (Memory Caps):**
   - MongoDB Container: `mem_limit: 512m`, `--wiredTigerCacheSizeGB 0.25`.
   - Neo4j Container: `mem_limit: 1024m`, Heap `512m`, Pagecache `256m`.
   - Redis Container: `mem_limit: 128m`, `maxmemory 128mb`.
   - Backend NestJS: Giới hạn heap `--max-old-space-size=512`.
4. **Quy chuẩn API & Naming Convention (Rule 9):**
   - Đường dẫn API: `kebab-case`, danh từ số nhiều (ví dụ: `/api/v1/datasets`, `/api/v1/workspaces`).
   - Database collections & fields: `snake_case` (ví dụ: `dataset_records`, `deleted_at`).
   - TypeScript classes: `PascalCase` (ví dụ: `DatasetService`, `CreateDatasetDto`).
   - TypeScript variables/functions: `snake_case` hoặc `camelCase` theo chuẩn nội bộ NestJS.
   - Response Format chuẩn hóa qua Interceptor:
     - Thành công: `{ success: true, data: ... }`
     - Thất bại: `{ success: false, error: { code: string, message: string, timestamp: string } }`

---

## 3. Cấu trúc Thư mục Backend (`src/backend`)

```
src/backend/
├── Dockerfile                      # Build container chạy production
├── nest-cli.json                   # Cấu hình Nest CLI
├── package.json                    # Dependencies & Scripts
├── tsconfig.json                   # Cấu hình TypeScript Strict mode
├── tsconfig.build.json
├── .env.example                    # Mẫu biến môi trường
├── src/
│   ├── main.ts                     # Điểm khởi chạy: Port 3000, Swagger, Global Pipes/Filters
│   ├── app.module.ts               # Root Module tổng hợp 9 feature modules & core modules
│   │
│   ├── core/                       # Tầng Dùng chung & Hạ tầng (Infrastructure/Core)
│   │   ├── config/                 # Validate biến môi trường bằng class-validator
│   │   │   ├── env.validation.ts
│   │   │   └── configuration.ts
│   │   ├── database/               # Quản lý kết nối CSDL đa mô hình
│   │   │   ├── mongoose.provider.ts
│   │   │   └── neo4j.service.ts    # Driver wrapper, transaction manager cho Cypher
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
│       │   ├── auth.controller.ts
│       │   ├── auth.service.ts
│       │   ├── auth.module.ts
│       │   ├── strategies/         # jwt.strategy.ts, local.strategy.ts
│       │   └── dto/                # register.dto.ts, login.dto.ts, refresh.dto.ts
│       ├── users/                  # F1: Quản lý hồ sơ, quyền Analyst/Admin, Soft Delete
│       │   ├── users.controller.ts
│       │   ├── users.service.ts
│       │   ├── users.module.ts
│       │   └── schemas/            # user.schema.ts, user-session.schema.ts
│       ├── workspaces/             # F2: Workspaces & Phân quyền Thành viên
│       │   ├── workspaces.controller.ts
│       │   ├── workspaces.service.ts
│       │   ├── workspaces.module.ts
│       │   └── schemas/            # workspace.schema.ts, workspace-member.schema.ts
│       ├── projects/               # F3: Projects (Ràng buộc 1 Project = 1 Dataset)
│       │   ├── projects.controller.ts
│       │   ├── projects.service.ts
│       │   ├── projects.module.ts
│       │   └── schemas/            # project.schema.ts
│       ├── datasets/               # F4: Streaming Ingestion, Checksum SHA-256, Schema Detection
│       │   ├── datasets.controller.ts
│       │   ├── datasets.service.ts
│       │   ├── datasets.module.ts
│       │   ├── services/           # stream-parser.service.ts, schema-detector.service.ts
│       │   └── schemas/            # dataset.schema.ts, dataset-record.schema.ts
│       ├── data-view/              # F5: Cursor Pagination, In-place Cell Edit, Column Stats
│       │   ├── data-view.controller.ts
│       │   ├── data-view.service.ts
│       │   ├── data-view.module.ts
│       │   └── dto/                # query-grid.dto.ts, edit-cell.dto.ts
│       ├── clean-rules/            # F6: Tầng 0 (Schema Normalizer) & Tầng 1 (Rule Engine)
│       │   ├── clean-rules.controller.ts
│       │   ├── clean-rules.service.ts
│       │   ├── clean-rules.module.ts
│       │   └── engine/             # rule-executor.ts, preview-evaluator.ts, built-in-rules/
│       ├── versions/               # F7: Quản lý Phiên bản, Chuỗi băm Merkle, Rollback
│       │   ├── versions.controller.ts
│       │   ├── versions.service.ts
│       │   ├── versions.module.ts
│       │   └── schemas/            # dataset-version.schema.ts
│       ├── lineage/                # F8: Neo4j Lineage DAG Traversal, Impact, Verify Integrity
│       │   ├── lineage.controller.ts
│       │   ├── lineage.service.ts
│       │   ├── lineage.module.ts
│       │   └── cypher/             # lineage-queries.cypher.ts
│       ├── exports/                # F9: CSV/Excel Stream Export, AES-256-GCM Encrypted Stream
│       │   ├── exports.controller.ts
│       │   ├── exports.service.ts
│       │   └── exports.module.ts
│       └── ai-engine/              # F6.4-F6.5: Tầng 3 (Gemini API) & Client gọi Python Worker (Tầng 2)
│           ├── ai-engine.controller.ts
│           ├── ai-engine.service.ts
│           ├── ai-engine.module.ts
│           ├── gemini/             # gemini.client.ts, prompts.ts, response-schemas.ts
│           └── ml-client/          # python-worker.client.ts
└── test/
    ├── jest-e2e.json
    ├── app.e2e-spec.ts
    ├── crypto.spec.ts
    ├── auth.e2e-spec.ts
    ├── datasets-stream.e2e-spec.ts
    └── lineage-integrity.e2e-spec.ts
```

---

## 4. Phân kỳ Triển khai Backend Chi tiết (4 Sprints)

---

### SPRINT B1: HẠ TẦNG DOCKER, CORE KỸ THUẬT & AUTHENTICATION
**Thời lượng dự kiến:** 4 - 5 ngày  
**Mục tiêu:** Dựng xong môi trường Docker, bộ khung NestJS hoàn chỉnh với kết nối MongoDB & Neo4j, module mật mã học độc lập có unit test, và hoàn tất 10 APIs Xác thực & Người dùng (F1.1 $\rightarrow$ F1.10).

#### Công việc chi tiết:
1. **Thiết lập Hạ tầng CSDL (`docker-compose.yml` & `.env.example`):**
   - [ ] Viết `docker-compose.yml` định cấu hình 3 containers: `mongodb` (512MB RAM cap), `neo4j` (1024MB RAM cap), `redis` (128MB RAM cap).
   - [ ] Cấu hình persistent storage volumes: `mongo_data`, `neo4j_data`, `redis_data`.
   - [ ] Tạo file `.env.example` chứa toàn bộ biến cấu hình (PORT, MONGODB_URI, NEO4J_URI, NEO4J_USER, NEO4J_PASSWORD, JWT_SECRET, JWT_EXPIRATION, GEMINI_API_KEY).
2. **Khởi tạo Khung NestJS (`src/backend`):**
   - [ ] Khởi tạo `package.json`, cài đặt các thư viện lõi (@nestjs/core, @nestjs/common, @nestjs/mongoose, mongoose, neo4j-driver, bcrypt, passport-jwt, class-validator, class-transformer).
   - [ ] Cấu hình `tsconfig.json` (`strict: true`, path alias `@/*`).
   - [ ] Viết `src/main.ts`:
     - Thiết lập Global Prefix `/api/v1`.
     - Kích hoạt `ValidationPipe` (`whitelist: true`, `transform: true`).
     - Tích hợp Swagger OpenAPI (`@nestjs/swagger`) tại `/api/v1/docs`.
     - Đăng ký `AllExceptionsFilter` và `TransformInterceptor`.
3. **Hiện thực hóa Tầng Hạ tầng Cơ sở (`src/backend/src/core`):**
   - [ ] `MongooseProvider`: Kết nối MongoDB, cấu hình auto-reconnect và debug mode khi ở môi trường dev.
   - [ ] `Neo4jService`: Wrapper bọc `neo4j-driver`, quản lý mở/đóng driver an toàn qua `onApplicationShutdown`, cung cấp hàm `runQuery(cypher, params)`.
   - [ ] `AllExceptionsFilter`: Bắt tất cả lỗi, chuẩn hóa response trả về dạng `{ success: false, error: { code, message, timestamp } }`.
   - [ ] `TransformInterceptor`: Tự động bọc dữ liệu trả về dạng `{ success: true, data: ... }`.
4. **Hiện thực hóa Động cơ Mật mã học (`src/core/crypto/crypto.util.ts`):**
   - [ ] Hàm băm SHA-256 buffer: `computeSha256Buffer(data: Buffer): string`.
   - [ ] Hàm băm SHA-256 stream: `computeSha256Stream(stream: Readable): Promise<string>`.
   - [ ] Hàm mã hóa luồng AES-256-GCM: `createAes256GcmEncryptStream(password: string): { stream: Transform, getAuthTag: () => Buffer }`.
   - [ ] Hàm giải mã luồng AES-256-GCM: `createAes256GcmDecryptStream(password: string, authTag: Buffer): Transform`.
   - [ ] **Viết Unit Test Jest (`crypto.spec.ts`):** Kiểm thử băm dữ liệu mẫu và kiểm thử mã hóa - giải mã chuỗi dữ liệu nhị phân 10MB khớp 100%.
5. **Hiện thực hóa Module Auth & Users (`src/modules/auth` & `src/modules/users`):**
   - [ ] Schemas: `UserSchema` (với `deleted_at: Date | null`, partial unique email) và `UserSessionSchema` (với TTL Index tự hủy sau 7 ngày).
   - [ ] Hiện thực hóa 10 Endpoints (F1.1 $\rightarrow$ F1.10):
     - `POST /api/v1/auth/register` (băm bcrypt salt 12).
     - `POST /api/v1/auth/login` (sinh access_token 15m, refresh_token 7d; lưu hash SHA-256 của refresh token vào `user_sessions`).
     - `POST /api/v1/auth/refresh` (cấp mới access token).
     - `POST /api/v1/auth/logout` (thu hồi refresh token).
     - `POST /api/v1/auth/forgot-password` & `POST /api/v1/auth/reset-password`.
     - `GET /api/v1/users/me` & `PATCH /api/v1/users/me`.
     - `GET /api/v1/auth/sessions` & `DELETE /api/v1/auth/sessions/:id` (thu hồi phiên từ xa).
   - [ ] Xây dựng `JwtAuthGuard`, `RolesGuard`, và Decorator `@CurrentUser()`.

---

### SPRINT B2: WORKSPACES, STREAMING INGESTION & VIRTUAL GRID API
**Thời lượng dự kiến:** 5 - 6 ngày  
**Mục tiêu:** Hiện thực hóa quản lý Workspace/Project (ràng buộc 1 Project = 1 Dataset), Streaming Ingestion tiếp nhận tệp lớn bằng Busboy + fast-csv với kiểm tra checksum SHA-256, và cung cấp API phân trang Virtual Grid $\le 50\text{ ms}$.

#### Công việc chi tiết:
1. **Module Workspaces & Projects (`src/modules/workspaces` & `src/modules/projects`):**
   - [ ] Schemas: `WorkspaceSchema` và `ProjectSchema` kèm điều kiện `deleted_at: Date | null` và Partial Unique Indexes.
   - [ ] Hiện thực hóa 7 Endpoints Workspace (F2.1 $\rightarrow$ F2.7): Tạo, xem danh sách, cập nhật, xóa mềm workspace; quản lý thành viên (thêm, cập nhật role, xóa).
   - [ ] Hiện thực hóa 5 Endpoints Project (F3.1 $\rightarrow$ F3.5): Tạo project, xem danh sách, đổi tên, xóa mềm.
   - [ ] **Ràng buộc nghiệp vụ cốt lõi:** Một Project chỉ được chứa tối đa 1 Dataset (`has_dataset: true`). Khi có yêu cầu upload dataset vào project đã có dữ liệu, chặn và yêu cầu tạo project mới hoặc xác nhận ghi đè.
   - [ ] Hiện thực hóa `ResourceOwnershipGuard` kiểm tra quyền sở hữu workspace/project.
2. **Module Dataset Ingestion theo Luồng (`src/modules/datasets`):**
   - [ ] Schemas: `DatasetSchema` (lưu metadata, `file_checksum`, danh sách columns) và `DatasetRecordSchema` (lưu từng row normalized `{ dataset_id, row_index, data }`). Đánh index `{ dataset_id: 1, row_index: 1 }`.
   - [ ] **Streaming Ingestion API (`POST /api/v1/datasets/upload` - F4.1):**
     - Dùng `busboy` nhận multipart stream trực tiếp từ HTTP connection.
     - Vừa stream qua hàm tính `computeSha256Stream`, vừa stream qua parser (`fast-csv` cho `.csv`, `xlsx` cho `.xlsx`).
     - **Deduplication Check:** Tìm kiếm trong MongoDB xem đã có dataset nào có cùng `file_checksum` chưa; nếu có thì flag cảnh báo hoặc tái sử dụng.
     - **Tầng 0 Schema Normalizer:** Quét 500 dòng đầu tiên để suy luận kiểu dữ liệu (`string`, `number`, `boolean`, `date`) và phát hiện schema drift.
     - Sử dụng `bulkWrite` chèn dữ liệu vào `dataset_records` theo từng chunk 1.000 dòng.
   - [ ] Hiện thực hóa các API quản lý Dataset (F4.2 $\rightarrow$ F4.6): Lấy chi tiết, đổi tên, cập nhật mô tả, xóa mềm dataset.
3. **Module Virtual Grid API & Thống kê Cột (`src/modules/data-view`):**
   - [ ] `GET /api/v1/datasets/:id/records` (F5.1):
     - Phân trang con trỏ (Cursor Pagination / Keyset Pagination) dựa trên `row_index` để phản hồi $\le 50\text{ ms}$ trên tập dữ liệu 100.000 dòng.
     - Hỗ trợ lọc động: lọc theo giá trị cell, khoảng số học (`min`, `max`), lọc chuỗi (`contains`, `startsWith`).
     - Hỗ trợ sắp xếp nhiều cột: `{ sort_by: "age", order: "desc" }`.
   - [ ] `PATCH /api/v1/datasets/:id/records/:row_index` (F5.2):
     - In-place Cell Edit: Cập nhật trực tiếp giá trị của 1 cell tại `row_index` và `column_name`.
     - Tự động cập nhật cờ `is_dirty` để nhắc nhở người dùng cần commit phiên bản mới.
   - [ ] `GET /api/v1/datasets/:id/columns/:column_name/stats` (F5.3):
     - Dùng MongoDB Aggregation Pipeline tính toán thống kê: Số lượng giá trị thiếu (missing count), Min, Max, Mean, Median, và tần suất phân phối dữ liệu 10 khoảng (Histogram 10 buckets).

---

### SPRINT B3: PHẢ HỆ NEO4J, PHIÊN BẢN HÓA MERKLE & CLEAN RULES
**Thời lượng dự kiến:** 5 - 6 ngày  
**Mục tiêu:** Tích hợp đồ thị phả hệ dữ liệu Neo4j bằng Cypher, quản lý phiên bản với chuỗi băm Merkle-like, động cơ làm sạch xác định Tầng 1 (Dry-run & Apply), và xuất dữ liệu mã hóa luồng AES-256-GCM.

#### Công việc chi tiết:
1. **Module Phả hệ Dữ liệu Neo4j (`src/modules/lineage`):**
   - [ ] Xây dựng các câu truy vấn Cypher (`lineage-queries.cypher.ts`):
     - Tạo nodes: `MERGE (d:Dataset { id: $dataset_id, name: $name })`
     - Tạo version node: `CREATE (v:Version { id: $version_id, version_num: $v_num, hash: $hash })`
     - Tạo relationship: `CREATE (v)-[:DERIVED_FROM { timestamp: $ts }]->(parent_v)`
     - Tạo transform node: `CREATE (t:Transformation { rule: $rule_name, params: $params })`
   - [ ] **Dual-write Synchronization Service:**
     - Đồng bộ mỗi thay đổi phiên bản từ MongoDB sang Neo4j.
     - Có bảng trung gian `outbox_events` và cơ chế retry khi Neo4j tạm thời bận.
   - [ ] Hiện thực hóa 4 API Lineage (F8.1 $\rightarrow$ F8.4):
     - `GET /api/v1/lineage/:dataset_id`: Trả về toàn bộ đồ thị DAG dạng `{ nodes, edges }`.
     - `GET /api/v1/lineage/node/:id/upstream`: Truy vết ngược nguồn gốc dữ liệu (Root-cause analysis).
     - `GET /api/v1/lineage/node/:id/downstream`: Phân tích tác động lan truyền (Impact analysis).
     - `GET /api/v1/lineage/verify-integrity/:dataset_id`: So sánh mã băm trong MongoDB với đường đi trên Neo4j để phát hiện can thiệp giả mạo.
2. **Module Quản lý Phiên bản Dữ liệu (`src/modules/versions`):**
   - [ ] Schema `DatasetVersionSchema`: `version_number`, `parent_version_id`, `data_checksum`, `parent_hash`, `version_hash`, `change_summary`.
   - [ ] Hiện thực hóa các API Phiên bản (F7.1 $\rightarrow$ F7.5):
     - `POST /api/v1/datasets/:id/versions/commit` (F7.1): Đóng gói bản ghi hiện tại thành phiên bản mới, tính `version_hash = SHA256(data_checksum + parent_hash + rules_hash)`, đồng bộ node sang Neo4j.
     - `GET /api/v1/datasets/:id/versions` (F7.2): Danh sách lịch sử phiên bản.
     - `POST /api/v1/datasets/:id/versions/:v_id/rollback` (F7.3): Khôi phục toàn bộ bảng dữ liệu về trạng thái của phiên bản cũ.
     - `GET /api/v1/datasets/:id/versions/diff` (F7.4): So sánh khác biệt giữa 2 phiên bản.
3. **Module Động cơ Làm sạch Xác định - Tầng 1 (`src/modules/clean-rules`):**
   - [ ] Xây dựng `RuleExecutor` với 4 nhóm luật chuẩn hóa:
     - **Nhóm Null:** Drop rows, Impute hằng số, Impute Mean/Median/Mode, Forward Fill.
     - **Nhóm Format:** Trim whitespace, Upper/Lower case, Chuẩn hóa Date ISO 8601, Ép kiểu an toàn.
     - **Nhóm Deduplication:** Xóa dòng trùng lặp dựa trên tập cột chỉ định.
     - **Nhóm Regex:** Kiểm tra định dạng Email, SĐT Việt Nam, Regex tùy chỉnh.
   - [ ] `POST /api/v1/datasets/:id/rules/preview` (F6.1):
     - Chạy thử luật trên mẫu 100 dòng, trả về kết quả trước/sau (Diff view) và số dòng bị ảnh hưởng mà **không làm thay đổi dữ liệu thật**.
   - [ ] `POST /api/v1/datasets/:id/rules/apply` (F6.2):
     - Chạy luật hàng loạt trên toàn bộ bảng qua `bulkWrite`, tự động ghi nhận biến đổi vào lịch sử.
4. **Module Xuất Dữ liệu Bảo mật (`src/modules/exports`):**
   - [ ] `GET /api/v1/datasets/:id/export/csv` (F9.1):
     - Stream từ MongoDB cursor $\rightarrow$ format CSV qua `fast-csv` $\rightarrow$ ghi ra HTTP Response (RAM tiêu thụ $\le 20\text{ MB}$).
   - [ ] `POST /api/v1/datasets/:id/export/secure` (F9.2):
     - Nhận mật khẩu bảo vệ `encryption_password`.
     - Stream qua `createAes256GcmEncryptStream(password)` $\rightarrow$ trả về tệp nhị phân `.enc.csv`.

---

### SPRINT B4: ĐỘNG CƠ AI ĐA TẦNG, KIỂM THỬ E2E & HARDENING
**Thời lượng dự kiến:** 4 - 5 ngày  
**Mục tiêu:** Tích hợp Google Gemini API (Tầng 3) với Structured JSON Output, cắm worker Python (Tầng 2 Unsupervised ML), hoàn thành bộ kiểm thử tự động $\ge 85\%$ coverage, đo kiểm RAM $\le 2\text{ GB}$, và xuất bản Swagger Docs.

#### Công việc chi tiết:
1. **Module Tích hợp AI Tầng 3 - Google Gemini API (`src/modules/ai-engine`):**
   - [ ] Cài đặt SDK `@google/genai` (hoặc REST client chuẩn), cấu hình `GEMINI_API_KEY` từ biến môi trường.
   - [ ] Xây dựng Prompt Templates hướng dẫn Gemini phân tích lỗi dữ liệu và trả về định dạng JSON nghiêm ngặt (`responseSchema`):
     ```json
     {
       "column_name": "string",
       "issue_type": "string",
       "severity": "high | medium | low",
       "explanation": "string",
       "suggested_rule": {
         "rule_type": "string",
         "parameters": {}
       }
     }
     ```
   - [ ] `POST /api/v1/datasets/:id/ai/analyze` (F6.4):
     - Lấy 20 dòng mẫu chứa lỗi + metadata cột gửi lên Gemini API.
     - Lưu các gợi ý làm sạch vào MongoDB.
   - [ ] Thiết lập Timeout (15s) và cơ chế Fallback tự động sang bộ luật Tầng 1 nếu Gemini API gặp sự cố hoặc vượt giới hạn quota.
2. **Tích hợp AI Tầng 2 - Unsupervised ML Worker (Python FastAPI Service):**
   - [ ] Xây dựng Python Worker độc lập trong thư mục `src/ai-worker` (hoặc module tương ứng):
     - Viết các hàm chạy thuật toán **Isolation Forest**, **Local Outlier Factor (LOF)**, và **Median Absolute Deviation (MAD)** trên các cột số.
   - [ ] Xây dựng `PythonWorkerClient` trong NestJS để gọi endpoint nội bộ của Python Worker, nhận về danh sách chỉ mục dòng bất thường (`outlier_row_indices`).
3. **Bộ Kiểm thử Tự động Toàn diện Backend (`src/backend/test`):**
   - [ ] **Unit Tests (Jest):**
     - Đạt độ phủ $\ge 85\%$ cho `crypto.util.ts`, `clean-rules.engine.ts`, `auth.service.ts`.
     - Test băm Merkle: Sửa 1 ký tự trong bản ghi cũ phải làm gãy chuỗi băm `version_hash`.
     - Test AES-256-GCM: Mã hóa đúng pass thì giải mã được; sai pass ném lỗi xác thực.
   - [ ] **Integration Tests (Supertest):**
     - Kiểm thử đầy đủ 43/43 API endpoints với các mã phản hồi HTTP chuẩn (200, 201, 400, 401, 403, 404, 422).
     - Kiểm thử ràng buộc Unique Email và Unique Project Name khi có Soft Delete.
   - [ ] **E2E Pipeline Test (`app.e2e-spec.ts`):**
     - Luồng: Đăng ký $\rightarrow$ Login $\rightarrow$ Tạo Workspace $\rightarrow$ Tạo Project $\rightarrow$ Stream Upload 10.000 dòng $\rightarrow$ Kiểm tra `file_checksum` $\rightarrow$ Áp dụng Clean Rule $\rightarrow$ Commit Version 2 $\rightarrow$ Xác minh Integrity Neo4j $\rightarrow$ Xuất mã hóa AES-256-GCM.
4. **Kiểm tra Tải, Bộ nhớ & Rà soát Bảo mật:**
   - [ ] Dùng `docker stats` xác nhận tổng RAM của MongoDB (512MB) + Neo4j (1024MB) + Redis (128MB) + NestJS (512MB) không vượt quá $2.1\text{ GB}$ khi xử lý file 100.000 dòng.
   - [ ] Cấu hình Helmet, CORS chặt chẽ, và Throttler (Rate Limiting 100 requests/phút).
   - [ ] Xuất bản Swagger JSON & Postman Collection đầy đủ 43 endpoints kèm ví dụ dữ liệu mẫu để sẵn sàng tích hợp Frontend.

---

## 5. Danh mục 43 RESTful Endpoints & Ma trận Kiểm thử

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
| 27 | `/api/v1/datasets/:id/records` | GET | Phân trang con trỏ (Cursor Pagination $\le 50\text{ ms}$), Lọc & Sắp xếp | B2 |
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

## 6. Tiêu chuẩn Nghiệm thu Backend (Definition of Done - DoD)

Một task/endpoint Backend chỉ được coi là hoàn thành (DONE) khi đáp ứng đủ 5 điều kiện sau:
1. **Mã nguồn chuẩn mực:** Tuân thủ TypeScript Strict mode, không dùng `any`, tuân thủ quy ước đặt tên (Rule 9).
2. **Soft Delete chuẩn hóa:** Truy vấn luôn có `{ deleted_at: null }`, Unique Index dùng partialFilterExpression.
3. **Kiểm thử tự động:** Có Unit Test hoặc Integration Test tương ứng, test pass 100%.
4. **Tài liệu hóa API:** Được khai báo đầy đủ Decorators Swagger (`@ApiOperation`, `@ApiResponse`, `@ApiBody`), xuất hiện chuẩn xác trên giao diện `/api/v1/docs`.
5. **Hiệu năng & An toàn:** Không gây Memory Leak, có kiểm tra quyền hạn (Guards), tham số đầu vào được lọc qua DTO ValidationPipe.

---

## 7. Kết luận & Hành động Tiếp theo

Tài liệu này là bản quy hoạch hành động độc lập, tập trung 100% vào việc hoàn thiện tầng **Backend vững chắc**. 

Khi bạn phê duyệt bản kế hoạch này:
- Chúng ta sẽ bắt đầu thực thi **Sprint B1**: Tạo file `docker-compose.yml`, khởi tạo khung mã nguồn `src/backend`, thiết lập `crypto.util.ts` và hiện thực hóa nhóm API Authentication đầu tiên.
