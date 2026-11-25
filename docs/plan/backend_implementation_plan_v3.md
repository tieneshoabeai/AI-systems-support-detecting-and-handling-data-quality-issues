# KẾ HOẠCH TRIỂN KHAI BACKEND TOÀN DIỆN (BACKEND MASTER IMPLEMENTATION PLAN) - V3.0
**Dự án:** Nền tảng Full-stack Quản lý & Giám sát Chất lượng Dữ liệu có AI Hỗ trợ  
*(Full-Stack Data Management & Quality Assurance Platform with AI Assistance)*  
**Tập tin:** `docs/backend_implementation_plan_v3.md`  
**Phiên bản:** v3.0  
**Ngày lập:** 20/10/2026  
**Trạng thái tài liệu:** Kế hoạch kỹ thuật chuyên sâu hiện thực hóa 100% tầng Backend (NestJS Modular Monolith) tích hợp **Kiến trúc Hybrid Storage (MongoDB Atlas + Neo4j AuraDB + Cloudflare R2 / S3)**, Mật mã học, Động cơ AI và 43 RESTful Endpoints.

---

## 1. Lịch sử thay đổi (Change Log v2.0 ➔ v3.0)

- **Thay đổi gì:**
  1. **Bổ sung Module Quản lý Lưu trữ Đối tượng (`src/core/storage`):**
     - Tích hợp `@aws-sdk/client-s3` và `@aws-sdk/lib-storage` giao tiếp với Cloudflare R2 (10GB miễn phí, zero egress fees) hoặc AWS S3.
     - Hiện thực hóa cơ chế **Dual-mode Storage Adapter**:
       - *Chế độ Cloud:* Đẩy tệp lên Cloudflare R2 khi có cấu hình biến môi trường `S3_*`.
       - *Chế độ Local Fallback:* Tự động lưu tệp vào `./storage/` nếu chưa cấu hình Cloud, giúp lập trình viên chạy thử nghiệm ngay lập tức.
  2. **Tối ưu hóa Pipeline Tải lên (Upload Pipeline Streaming):**
     - Luồng tệp nhị phân từ HTTP multipart request được phân nhánh song song (T-pipe):
       - Một nhánh ghi trực tiếp lên Object Storage (R2/S3).
       - Một nhánh tính mã băm `file_checksum` SHA-256.
       - Một nhánh đưa vào parser (`fast-csv`) để trích xuất 500 dòng đầu nhận diện Schema và ghi các bản ghi vào MongoDB Atlas.
  3. **Lưu trữ Snapshot Phiên bản và Xuất tệp An toàn:**
     - Bản chụp dữ liệu theo từng `DatasetVersion` được lưu dạng tệp trên R2 (`snapshots/`), giải phóng hoàn toàn gánh nặng dung lượng 512MB của MongoDB Atlas.
  4. **Tích hợp Bảo mật Kênh truyền Cloudflare TLS 1.3 & Cổng 443 (HTTPS):**
     - Xuất bản dịch vụ Backend ra Internet thông qua **Cloudflare Zero Trust Tunnel (`cloudflared`)** trên **Cổng 443** với chứng chỉ số CA quốc tế hợp lệ 100% (Google Trust Services / DigiCert), hiển thị ổ khóa xanh bảo mật.
     - Cấu hình `trust proxy` trong `main.ts` nhận diện chính xác IP thực (`CF-Connecting-IP`), mã định danh truy vết `CF-Ray` và tiêu đề `X-Forwarded-Proto: https`.
     - Tự động hóa qua các scripts: `scripts/install-cloudflared.sh`, `scripts/start-cloudflare-tunnel.sh`.
- **Lý do:** Đáp ứng chuẩn mã hóa đường truyền toàn trình (Data in Transit) trên Cổng 443, bảo vệ JWT Access Token và dữ liệu PII theo đúng tiêu chuẩn an toàn thông tin hiện đại.
- **Ảnh hưởng đến đâu:** Bổ sung Task thiết lập `StorageService` trong Sprint B1; điều chỉnh quy trình Ingestion trong Sprint B2; cập nhật `main.ts`, `env.validation.ts`, `.env.example`, `package.json` và bổ sung tài liệu `docs/cloudflare_tunnel_setup.md`.

---

## 2. Tổng quan & 3 Câu hỏi Cốt lõi (Rule 1)

1. **Đang làm gì?**
   Xây dựng hoàn chỉnh toàn bộ tầng **Backend Service** tại thư mục `src/backend` theo kiến trúc **Modular Monolith (NestJS 11)**, tích hợp kiến trúc Hybrid Cloud (MongoDB Atlas + Neo4j AuraDB + Cloudflare R2/S3), bảo mật kênh truyền **Cloudflare TLS 1.3 Cổng 443**, động cơ Mật mã học (SHA-256 + AES-256-GCM), động cơ Làm sạch dữ liệu xác định (Tầng 1), động cơ AI đa tầng (Tầng 0 Schema, Tầng 2 Unsupervised ML, Tầng 3 Gemini Cloud LLM), và cung cấp tài liệu OpenAPI/Swagger cho 43 RESTful Endpoints.
2. **Cho ai?**
   Phục vụ đồ án tốt nghiệp kỹ sư và cung cấp một hệ thống API vững chắc, có độ tin cậy cao, độc lập hoàn toàn với giao diện người dùng.
3. **Để làm gì?**
   Đảm bảo toàn bộ nghiệp vụ xử lý dữ liệu lớn, kiểm soát chất lượng, truy vết nguồn gốc (Data Lineage), băm toàn vẹn chống giả mạo và bảo mật xuất file được kiểm thử (Unit, Integration, E2E) đạt chuẩn 100% trên môi trường Backend trước khi ghép nối giao diện Frontend.

---

## 3. Cấu trúc Thư mục Backend (`src/backend`)

```
src/backend/
├── Dockerfile                      # Build container chạy production
├── nest-cli.json                   # Cấu hình Nest CLI
├── package.json                    # Dependencies & Scripts
├── tsconfig.json                   # Cấu hình TypeScript Strict mode (Zero Any)
├── tsconfig.build.json
├── .env.example                    # Mẫu biến môi trường kết nối Cloud (Atlas, Aura, R2, Tunnel)
├── scripts/                        # Scripts tự động hóa hạ tầng & bảo mật
│   ├── install-cloudflared.sh      # Tự động tải binary cloudflared chính thức
│   ├── start-cloudflare-tunnel.sh  # Khởi chạy Cloudflare Quick Tunnel Cổng 443
│   └── generate-ssl-certs.sh       # Sinh chứng chỉ X.509 tự ký dự phòng cục bộ
├── storage/                        # Thư mục lưu file cục bộ (Local Fallback Mode)
│   ├── raw_files/
│   ├── snapshots/
│   └── exports/
├── src/
│   ├── main.ts                     # Điểm khởi chạy: Trust Proxy Cloudflare, Port 3000, Swagger, Helmet HSTS
│   ├── app.module.ts               # Root Module tổng hợp 9 feature modules & core modules
│   │
│   ├── core/                       # Tầng Dùng chung & Hạ tầng (Infrastructure/Core)
│   │   ├── config/                 # Validate biến môi trường bằng class-validator
│   │   │   ├── env.validation.ts
│   │   │   └── configuration.ts
│   │   ├── database/               # Quản lý kết nối CSDL Cloud (Atlas + AuraDB)
│   │   │   ├── mongoose.provider.ts
│   │   │   └── neo4j.service.ts    # Driver wrapper kết nối neo4j+s://
│   │   ├── storage/                # Tầng Lưu trữ Tệp Đối tượng (S3 / R2 / Local)
│   │   │   ├── storage.interface.ts
│   │   │   └── storage.service.ts  # Dual-mode S3 Client & Local Fallback
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
    ├── storage.spec.ts
    ├── auth.e2e-spec.ts
    ├── datasets-stream.e2e-spec.ts
    └── lineage-integrity.e2e-spec.ts
```

---

## 4. Phân kỳ Triển khai Backend Chi tiết (4 Sprints)

---

### SPRINT B1: KẾT NỐI HYBRID CLOUD, STORAGE & AUTHENTICATION
**Thời lượng dự kiến:** 4 - 5 ngày  
**Mục tiêu:** Thiết lập kết nối thành công tới MongoDB Atlas, Neo4j AuraDB, xây dựng `StorageService` (Cloudflare R2 + Local fallback), động cơ mật mã học `crypto.util.ts` kèm Unit Tests, và hoàn tất 10 APIs Xác thực & Quản lý Người dùng (F1.1 $\rightarrow$ F1.10).

#### Công việc chi tiết:
1. **Thiết lập Môi trường & Biến Cấu hình (`.env.example`):**
   - [ ] Tạo file mẫu `.env.example` với đầy đủ tham số kết nối:
     - `MONGODB_URI`: Chuỗi kết nối MongoDB Atlas (`mongodb+srv://...`).
     - `NEO4J_URI`, `NEO4J_USERNAME`, `NEO4J_PASSWORD`: Chuỗi kết nối Neo4j AuraDB (`neo4j+s://...`).
     - `S3_ENDPOINT`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_BUCKET_NAME`: Cấu hình Cloudflare R2 / S3 (hỗ trợ để trống để chạy Local Fallback).
     - Cấu hình JWT, Salt Rounds và Gemini API Key.
2. **Khởi tạo Khung NestJS (`src/backend`):**
   - [ ] Cài đặt các dependencies chính trong `package.json` (@nestjs/core, @nestjs/common, @nestjs/mongoose, mongoose, neo4j-driver, @aws-sdk/client-s3, @aws-sdk/lib-storage, bcrypt, passport-jwt, class-validator, class-transformer).
   - [ ] Cấu hình `tsconfig.json` (`strict: true`, path alias `@/*`).
   - [ ] Viết `src/main.ts`: Global Prefix `/api/v1`, ValidationPipe, Swagger OpenAPI tại `/api/v1/docs`, AllExceptionsFilter, TransformInterceptor.
3. **Hiện thực hóa Tầng Lưu trữ Đối tượng (`src/backend/src/core/storage`):**
   - [ ] Viết `StorageService` hiện thực hóa interface `IStorageService`:
     - Hàm `uploadStream(key: string, stream: Readable, contentType?: string): Promise<string>`.
     - Hàm `downloadStream(key: string): Promise<Readable>`.
     - Tự động nhận diện: Nếu có khóa S3 thì upload lên R2/S3; nếu không có thì ghi vào thư mục `./storage/`.
   - [ ] **Viết Unit Test Jest (`storage.spec.ts`):** Kiểm thử upload và download stream nhị phân trong chế độ Local Fallback.
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
**Mục tiêu:** Quản lý Workspace/Project (ràng buộc 1 Project = 1 Dataset), Streaming Ingestion tiếp nhận tệp lớn ghi song song lên Object Storage (R2/S3) và Atlas, tính checksum SHA-256, và cung cấp API phân trang Virtual Grid.

#### Công việc chi tiết:
1. **Module Workspaces & Projects (`src/modules/workspaces` & `src/modules/projects`):**
   - [ ] Schemas: `WorkspaceSchema` và `ProjectSchema` kèm `deleted_at: Date | null` và Partial Unique Indexes.
   - [ ] Hiện thực hóa 7 Endpoints Workspace (F2.1 $\rightarrow$ F2.7) và 5 Endpoints Project (F3.1 $\rightarrow$ F3.5).
   - [ ] **Ràng buộc nghiệp vụ:** Kiểm tra `has_dataset: true` để đảm bảo 1 Project chỉ có tối đa 1 Dataset hoạt động.
   - [ ] Hiện thực hóa `ResourceOwnershipGuard` phân quyền truy cập tài nguyên.
2. **Module Dataset Ingestion theo Luồng Tối ưu Hybrid Storage (`src/modules/datasets`):**
   - [ ] Schemas: `DatasetSchema` (thêm con trỏ `storage_key`) và `DatasetRecordSchema`.
   - [ ] **Streaming Ingestion API (`POST /api/v1/projects/:id/datasets/upload` - F4.1):**
     - Dùng `busboy` nhận multipart stream nhị phân.
     - Phân nhánh luồng xử lý:
       - Đẩy tệp thô lên R2/S3 qua `StorageService.uploadStream('raw_files/...')`.
       - Tính toán song song `file_checksum` SHA-256.
       - Stream qua parser (`fast-csv` hoặc `xlsx`) lấy 500 dòng đầu suy luận Schema (Tầng 0).
       - Gom mảng 1.000 records thực hiện `bulkWrite` lên Atlas phục vụ phân trang Virtual Grid.
   - [ ] Hiện thực hóa các API quản lý Dataset (F4.2 $\rightarrow$ F4.6).
3. **Module Virtual Grid API & Thống kê Cột (`src/modules/data-view`):**
   - [ ] `GET /api/v1/datasets/:id/records` (F5.1):
     - Keyset Cursor Pagination dựa vào `{ row_index: { $gt: last_seen_index } }` kết hợp `.lean()`.
     - Hỗ trợ lọc động (Filter) và sắp xếp (Sort).
   - [ ] `PATCH /api/v1/datasets/:id/records/:row_index` (F5.2): In-place Cell Edit.
   - [ ] `GET /api/v1/datasets/:id/columns/:col/stats` (F5.3): MongoDB Aggregation Pipeline tính toán Null count, Min, Max, Mean, Median, và Histogram 10 khoảng.

---

### SPRINT B3: PHẢ HỆ AURA, SNAPSHOTS MERKLE & CLEAN RULES
**Thời lượng dự kiến:** 5 - 6 ngày  
**Mục tiêu:** Tích hợp đồ thị phả hệ trên Neo4j AuraDB bằng Cypher Batching, quản lý phiên bản với snapshot tệp trên R2/S3 và chuỗi băm Merkle-like, động cơ làm sạch xác định Tầng 1, và xuất dữ liệu mã hóa luồng AES-256-GCM.

#### Công việc chi tiết:
1. **Module Phả hệ Dữ liệu Neo4j AuraDB (`src/modules/lineage`):**
   - [ ] Viết các câu truy vấn Cypher gom nhóm tham số (`lineage-queries.cypher.ts`) sử dụng mệnh đề `UNWIND $batch`.
   - [ ] **Dual-write Synchronization Service:** Đồng bộ phiên bản sang AuraDB với cơ chế Retry 3 lần.
   - [ ] Hiện thực hóa 4 API Lineage (F8.1 $\rightarrow$ F8.4): Đồ thị DAG, Upstream root-cause, Downstream impact, và Verify integrity.
2. **Module Quản lý Phiên bản Dữ liệu & Snapshots (`src/modules/versions`):**
   - [ ] Schema `DatasetVersionSchema` với `snapshot_storage_key` và chuỗi băm Merkle-like `version_hash = SHA256(data_checksum + parent_hash + rules_hash)`.
   - [ ] Khi commit phiên bản mới: Tạo bản snapshot tệp CSV đẩy lên `snapshots/` trên R2/S3, giải phóng dung lượng bản ghi cũ trong Atlas khi cần.
   - [ ] Hiện thực hóa các API Phiên bản (F7.1 $\rightarrow$ F7.5): Commit snapshot, danh sách phiên bản, Rollback dữ liệu, và Diff so sánh 2 phiên bản.
3. **Module Động cơ Làm sạch Xác định - Tầng 1 (`src/modules/clean-rules`):**
   - [ ] Xây dựng `RuleExecutor` với 4 nhóm luật chuẩn hóa: Null Handling, Standardization, Deduplication, Regex Validation.
   - [ ] `POST /api/v1/datasets/:id/rules/preview` (F6.1): Dry-run chạy thử trên 100 dòng mẫu không chạm vào dữ liệu thật.
   - [ ] `POST /api/v1/datasets/:id/rules/apply` (F6.2): Chạy luật hàng loạt trên toàn bộ bảng qua `bulkWrite` trên Atlas.
4. **Module Xuất Dữ liệu Bảo mật (`src/modules/exports`):**
   - [ ] `GET /api/v1/datasets/:id/export/csv` (F9.1): Stream từ Atlas cursor $\rightarrow$ fast-csv $\rightarrow$ ghi ra HTTP Response (RAM tiêu thụ $\le 20\text{ MB}$).
   - [ ] `POST /api/v1/datasets/:id/export/secure` (F9.2): Stream mã hóa AES-256-GCM bảo vệ bằng mật khẩu người dùng $\rightarrow$ lưu file `.enc.csv` tại `exports/` trên R2 và trả về luồng tải về an toàn.

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
   - [ ] **Unit Tests (Jest):** Đạt độ phủ $\ge 85\%$ cho `crypto.util.ts`, `storage.service.ts`, `clean-rules.engine.ts`, `auth.service.ts`.
   - [ ] **Integration Tests (Supertest):** Kiểm thử 43/43 API endpoints kết nối trực tiếp Atlas/AuraDB/R2.
   - [ ] **E2E Pipeline Test (`app.e2e-spec.ts`):** Kiểm thử toàn bộ vòng đời: Đăng ký $\rightarrow$ Upload R2 $\rightarrow$ Checksum $\rightarrow$ Clean Rule $\rightarrow$ Commit Version $\rightarrow$ Lineage Integrity $\rightarrow$ AES-256 Export.
4. **Kiểm tra Tải, Bộ nhớ & Xuất bản Tài liệu:**
   - [ ] Xác nhận mức tiêu thụ RAM của tiến trình NestJS Backend không vượt quá $512\text{ MB}$.
   - [ ] Cấu hình Helmet, CORS chặt chẽ, và Rate Limiting (100 req/phút).
   - [ ] Hoàn thiện Swagger UI tại `/api/v1/docs` đầy đủ schemas, request body và sample responses cho cả 43 endpoints.

---

## 5. Danh mục 43 RESTful Endpoints

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
| 23 | `/api/v1/projects/:id/datasets/upload` | POST | Streaming upload song song R2 + Atlas, SHA-256 | B2 |
| 24 | `/api/v1/datasets/:id` | GET | Chi tiết Metadata của Dataset | B2 |
| 25 | `/api/v1/datasets/:id` | PATCH | Cập nhật tên/mô tả Dataset | B2 |
| 26 | `/api/v1/datasets/:id` | DELETE | Xóa mềm Dataset | B2 |
| 27 | `/api/v1/datasets/:id/records` | GET | Keyset Cursor Pagination, Lọc & Sắp xếp | B2 |
| 28 | `/api/v1/datasets/:id/records/:row_index` | PATCH | In-place Cell Edit cập nhật trực tiếp | B2 |
| 29 | `/api/v1/datasets/:id/columns/:col/stats` | GET | Thống kê phân phối cột & Histogram 10 khoảng | B2 |
| 30 | `/api/v1/datasets/:id/rules/preview` | POST | Dry-run thử nghiệm luật trên 100 dòng mẫu | B3 |
| 31 | `/api/v1/datasets/:id/rules/apply` | POST | Áp dụng luật hàng loạt vào toàn bộ bảng | B3 |
| 32 | `/api/v1/datasets/:id/rules/history` | GET | Xem lịch sử các luật đã áp dụng | B3 |
| 33 | `/api/v1/datasets/:id/versions/commit` | POST | Commit phiên bản mới (Merkle hash + R2 snapshot) | B3 |
| 34 | `/api/v1/datasets/:id/versions` | GET | Lịch sử các phiên bản | B3 |
| 35 | `/api/v1/datasets/:id/versions/:vid/rollback` | POST | Rollback dữ liệu về phiên bản cũ | B3 |
| 36 | `/api/v1/datasets/:id/versions/diff` | GET | So sánh khác biệt giữa 2 phiên bản | B3 |
| 37 | `/api/v1/lineage/:dataset_id` | GET | Lấy đồ thị phả hệ dữ liệu Neo4j DAG | B3 |
| 38 | `/api/v1/lineage/node/:id/upstream` | GET | Truy vết ngược về nguồn gốc (Root Cause) | B3 |
| 39 | `/api/v1/lineage/node/:id/downstream` | GET | Phân tích tác động lan truyền (Impact Analysis) | B3 |
| 40 | `/api/v1/lineage/verify-integrity/:dataset_id` | GET | Xác minh chuỗi băm chống giả mạo | B3 |
| 41 | `/api/v1/datasets/:id/export/csv` | GET | Xuất dữ liệu CSV theo luồng stream | B3 |
| 42 | `/api/v1/datasets/:id/export/secure` | POST | Xuất dữ liệu mã hóa AES-256-GCM lưu R2 an toàn | B3 |
| 43 | `/api/v1/datasets/:id/ai/analyze` | POST | Phân tích chất lượng dữ liệu bằng AI (Gemini + ML) | B4 |

---

## 6. Tiêu chuẩn Nghiệm thu Backend (Definition of Done - DoD)

1. **Mã nguồn chuẩn mực:** Tuân thủ TypeScript Strict mode, không dùng `any`, tuân thủ quy ước đặt tên (Rule 9).
2. **Soft Delete chuẩn hóa:** Truy vấn luôn có `{ deleted_at: null }`, Unique Index dùng partialFilterExpression trên Atlas.
3. **Độ trễ & Kết nối Cloud an toàn:** Cấu hình connection pooling, retry logic; các tác vụ nặng dùng BulkWrite chunks $\le 1000$ records.
4. **Lưu trữ tệp Hybrid:** Tệp thô và snapshot được lưu trữ an toàn trên Cloudflare R2 / S3 (hoặc fallback cục bộ), không làm phình MongoDB Atlas.
5. **Tài liệu hóa API:** Khai báo đầy đủ Decorators Swagger (`@ApiOperation`, `@ApiResponse`, `@ApiBody`), xuất hiện chuẩn xác trên `/api/v1/docs`.
6. **Kiểm thử tự động:** Test suite Jest đạt coverage $\ge 85\%$ cho Core Logic (`crypto.util.ts`, `storage.service.ts`, `clean-rules.engine.ts`, `auth.service.ts`).
7. **Bảo mật Kênh truyền Toàn trình (TLS 1.3 & Cổng 443):** Dịch vụ API xuất bản qua Cloudflare Zero Trust Tunnel đạt chuẩn HTTPS TLS 1.3 Cổng 443, hiển thị chứng chỉ CA quốc tế hợp lệ, tích hợp đầy đủ cơ chế HSTS và `trust proxy` nhận diện IP thực (`CF-Connecting-IP`).

