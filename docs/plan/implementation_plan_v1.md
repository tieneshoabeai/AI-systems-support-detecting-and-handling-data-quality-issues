# KẾ HOẠCH TRIỂN KHAI TOÀN DIỆN (MASTER IMPLEMENTATION PLAN) - GIAI ĐOẠN 1 & 2
**Dự án:** Nền tảng Full-stack Quản lý & Giám sát Chất lượng Dữ liệu có AI Hỗ trợ  
*(Full-Stack Data Management & Quality Assurance Platform with AI Assistance)*  
**Tập tin:** `docs/implementation_plan_v1.md`  
**Phiên bản:** v1.0  
**Ngày lập:** 19/10/2026  
**Trạng thái tài liệu:** Kế hoạch hành động kỹ thuật chi tiết (Technical Implementation Roadmap) phân rã theo Sprint, Module, API và Tiêu chí nghiệm thu (Definition of Done).

---

## 1. Tổng quan & 3 Câu hỏi Cốt lõi (Core Context - Rule 1)

1. **Đang làm gì?**
   Thiết lập toàn bộ hạ tầng Docker Compose, khung dự án Monorepo/Modular Monolith (gồm `src/backend` viết bằng NestJS và `src/frontend` viết bằng Vite React), hiện thực hóa 9 modules nghiệp vụ (43 RESTful API endpoints), tích hợp chuỗi phả hệ dữ liệu Neo4j, động cơ mật mã học (SHA-256 Chaining & AES-256-GCM Streaming), và động cơ AI 4 tầng.
2. **Cho ai?**
   Phục vụ đồ án tốt nghiệp kỹ sư và nền tảng thực tế cho các Data Analysts / Data Engineers quản lý, phát hiện bất thường và làm sạch dữ liệu dạng bảng.
3. **Để làm gì?**
   Xây dựng một hệ thống hoàn chỉnh từ lưu trữ, kiểm soát chất lượng, truy vết phả hệ dữ liệu đến xử lý thông minh bằng AI, bảo đảm tính toàn vẹn dữ liệu chống giả mạo, tối ưu hiệu năng bộ nhớ trên máy cá nhân ($\le 2\text{ GB}$ RAM cho các dịch vụ phụ trợ).

---

## 2. Nguyên tắc Kỹ thuật Bất biến (Architectural Invariants)

Mọi dòng mã nguồn được viết trong dự án bắt buộc phải tuân thủ nghiêm ngặt các nguyên tắc sau:
1. **Quy ước Xóa mềm (Soft Delete):** 
   - Tuyệt đối cấm sử dụng cờ boolean `is_deleted`.
   - Bắt buộc dùng `deleted_at: Date | null` (mặc định `null`, khi xóa gán `new Date()`).
   - Mọi truy vấn đọc dữ liệu mặc định phải kèm điều kiện `{ deleted_at: null }`.
   - Các chỉ mục Unique trong MongoDB bắt buộc dùng Partial Filter Expression: `{ partialFilterExpression: { deleted_at: null } }`.
2. **An toàn Mật mã học (Cryptographic Security):**
   - Không băm mật khẩu bằng SHA-256; bắt buộc dùng `bcrypt` với `SALT_ROUNDS = 12`.
   - Băm SHA-256 dùng để tính `file_checksum` (chống trùng lặp và xác thực toàn vẹn tệp gốc) và xây dựng chuỗi băm `version_hash = SHA256(data_checksum + parent_hash + rules_hash)` cho `DatasetVersion`.
   - Xuất dữ liệu bảo mật bằng `AES-256-GCM` qua cơ chế Streaming, dẫn xuất khóa bằng PBKDF2 (100.000 vòng lặp, salt 16 bytes ngẫu nhiên, IV 12 bytes ngẫu nhiên, Auth Tag 16 bytes).
3. **Kiểm soát Bộ nhớ (Memory Budgeting):**
   - Docker Container MongoDB: Giới hạn cứng `mem_limit: 512m`, WiredTiger Cache `256m`.
   - Docker Container Neo4j: Giới hạn cứng `mem_limit: 1024m`, Heap `512m`, Pagecache `256m`.
   - Docker Container Redis: Giới hạn cứng `mem_limit: 128m`, maxmemory `128mb`.
   - Backend NestJS: Giới hạn bộ nhớ Node heap `512m`.
4. **Bảo mật Biến môi trường (Environment Security):**
   - Tuyệt đối không hardcode API keys, JWT Secret, Database URIs vào mã nguồn. Sử dụng `.env` cục bộ và cung cấp `.env.example`.
5. **Cấu trúc Vị trí Mã nguồn (Directory Layout):**
   - Thư mục gốc chứa `docker-compose.yml`, `.env.example`, `docs/`, `package.json`.
   - Backend đặt tại: `src/backend/`
   - Frontend đặt tại: `src/frontend/`

---

## 3. Cấu trúc Dự án (Folder Structure Specification)

```
.
├── docker-compose.yml              # Quản lý MongoDB, Neo4j, Redis, Nginx
├── .env.example                    # Biến môi trường mẫu cho toàn hệ thống
├── docs/                           # Toàn bộ tài liệu đặc tả & thiết kế
│   ├── feature_spec_v4.md
│   ├── tech_solution_v2.md
│   ├── factors_design_AI_v2.md
│   └── implementation_plan_v1.md
└── src/
    ├── backend/                    # NestJS Modular Monolith Application
    │   ├── package.json
    │   ├── tsconfig.json
    │   ├── nest-cli.json
    │   ├── Dockerfile
    │   ├── src/
    │   │   ├── main.ts             # Bootstrap: Port 3000, Global Pipes, CORS, Interceptors
    │   │   ├── app.module.ts       # Root Module gom 9 feature modules
    │   │   ├── core/               # Shared & Infrastructure layer
    │   │   │   ├── config/         # Config validation qua class-validator
    │   │   │   ├── database/       # MongooseProvider & Neo4jDriverProvider
    │   │   │   ├── crypto/         # crypto.util.ts (SHA-256, AES-256-GCM, PBKDF2)
    │   │   │   ├── filters/        # all-exceptions.filter.ts (Chuẩn hóa lỗi)
    │   │   │   ├── interceptors/   # transform.interceptor.ts, logging.interceptor.ts
    │   │   │   └── guards/         # JwtAuthGuard, RolesGuard, ResourceOwnershipGuard
    │   │   └── modules/            # 9 Domain Feature Modules
    │   │       ├── auth/           # F1: Authentication, Sessions, Password Reset
    │   │       ├── users/          # F1: User Management & Profile
    │   │       ├── workspaces/     # F2: Workspaces Management & Members
    │   │       ├── projects/       # F3: Projects (Constraint 1 Project = 1 Dataset)
    │   │       ├── datasets/       # F4: Streaming Ingestion, SHA-256, Schema Detection
    │   │       ├── data-view/      # F5: Virtual Grid API, Cursor Pagination, Column Stats
    │   │       ├── clean-rules/    # F6: Tầng 0 (Schema Normalizer) & Tầng 1 (Deterministic Rules)
    │   │       ├── versions/       # F7: DatasetVersion, Merkle-like Hash Chaining, Lineage Sync
    │   │       ├── lineage/        # F8: Neo4j Lineage DAG Traversal, Impact Analysis, Integrity Check
    │   │       ├── exports/        # F9: CSV/Excel Stream Export, AES-256-GCM Encrypted Stream
    │   │       └── ai-engine/      # F6: Tầng 3 (Gemini API Integration) & Client cho Tầng 2
    │   └── test/                   # Unit & Integration Tests (Jest)
    │
    └── frontend/                   # Vite + React 18 + TypeScript Application
        ├── package.json
        ├── vite.config.ts
        ├── tsconfig.json
        ├── tailwind.config.js
        ├── postcss.config.js
        ├── index.html
        └── src/
            ├── main.tsx
            ├── App.tsx
            ├── assets/
            ├── components/         # Reusable UI components (shadcn/ui style)
            │   ├── ui/             # Button, Input, Modal, Dropdown, Table, Badge
            │   ├── common/         # Header, Sidebar, ErrorBoundary, LoadingSpinner
            │   ├── virtual-grid/   # Virtual Scroll Data Grid (TanStack Virtual)
            │   └── lineage-graph/  # Lineage DAG Viewer (@xyflow/react)
            ├── features/           # Feature-based pages & components
            │   ├── auth/           # Login, Register, Forgot Password
            │   ├── workspace/      # Workspace Dashboard, Project List
            │   ├── data-studio/    # Data View, Cleaning Rules Panel, Version History
            │   └── analytics/      # Column distribution charts, Anomaly highlights
            ├── hooks/              # Custom React hooks (useAuth, useVirtualGrid, useLineage)
            ├── services/           # Axios API Client & Endpoints mapping
            ├── stores/             # Zustand stores (authStore, gridStore, lineageStore)
            └── types/              # TypeScript Interfaces & DTOs đồng bộ với Backend
```

---

## 4. Phân kỳ Triển khai Chi tiết (Phased Roadmap)

Lộ trình triển khai được chia thành **5 Giai đoạn tuần tự**, tuân thủ nghiêm ngặt nguyên tắc kiểm thử và nghiệm thu từng bước:

```
[ Giai đoạn 1: Khung & Hạ tầng ] ➔ [ Giai đoạn 2: Ingestion & Grid ] ➔ [ Giai đoạn 3: Lineage & Crypto ] ➔ [ Giai đoạn 4: Động cơ AI ] ➔ [ Giai đoạn 5: Kiểm thử & Đóng gói ]
```

---

### GIAI ĐOẠN 1: HẠ TẦNG, KHUNG MÃ NGUỒN & MODULE NỀN TẢNG (Sprint 1)
**Trọng tâm:** Khởi tạo môi trường Docker, cài đặt khung NestJS/React, thiết lập cơ chế kết nối CSDL kép (MongoDB + Neo4j), xây dựng tiện ích mật mã và hệ thống Authentication.

#### 1.1. Hạ tầng Docker Compose (`docker-compose.yml`)
- [ ] **Task 1.1.1:** Viết file `docker-compose.yml` định nghĩa 3 services cơ bản:
  - `mongodb`: Image `mongo:7.0`, port 27017, volume persistent `mongo_data`, cắm chốt tham số `--wiredTigerCacheSizeGB 0.25`, `mem_limit: 512m`.
  - `neo4j`: Image `neo4j:5.20-community`, port 7474 (HTTP) & 7687 (Bolt), volume persistent `neo4j_data`, thiết lập môi trường `NEO4J_server_memory_heap_max__size=512m`, `NEO4J_server_memory_pagecache_size=256m`, `mem_limit: 1024m`.
  - `redis`: Image `redis:7.2-alpine`, port 6379, lệnh `redis-server --maxmemory 128mb --maxmemory-policy allkeys-lru`, `mem_limit: 128m`.
- [ ] **Task 1.1.2:** Thiết lập script kiểm tra tình trạng kết nối tự động (Healthcheck) cho từng container.
- [ ] **Task 1.1.3:** Tạo file mẫu `.env.example` với đầy đủ các biến cấu hình cho cổng, JWT secret, database credentials.

#### 1.2. Khung Backend NestJS Modular Monolith (`src/backend`)
- [ ] **Task 1.2.1:** Khởi tạo cấu hình `package.json` với các dependencies chính:
  - `@nestjs/core`, `@nestjs/common`, `@nestjs/platform-express`, `@nestjs/mongoose`, `mongoose`.
  - `neo4j-driver`.
  - `class-validator`, `class-transformer`, `@nestjs/config`.
  - `@nestjs/jwt`, `@nestjs/passport`, `passport-jwt`, `bcrypt`.
  - `busboy`, `fast-csv`, `xlsx`.
- [ ] **Task 1.2.2:** Cấu hình `tsconfig.json` với chế độ kiểm tra nghiêm ngặt (`"strict": true`, `"noImplicitAny": true`, path aliases `@/*`).
- [ ] **Task 1.2.3:** Thiết lập kết nối cơ sở dữ liệu:
  - `MongooseModule.forRootAsync` đọc từ biến môi trường.
  - Xây dựng Custom Provider `Neo4jService` bọc `neo4j-driver`, quản lý vòng đời Driver (`onApplicationShutdown` đóng kết nối an toàn).
- [ ] **Task 1.2.4:** Xây dựng các thành phần dùng chung cốt lõi (`src/core`):
  - `AllExceptionsFilter`: Bắt toàn bộ lỗi HTTP, MongoError, Neo4jError, chuẩn hóa response lỗi theo định dạng: `{ success: false, error: { code, message, timestamp } }`.
  - `TransformInterceptor`: Tự động bọc response thành công thành: `{ success: true, data: ... }`.
  - `LoggingInterceptor`: Ghi nhận thời gian thực thi (Latency tracking) của từng API request.
  - `ValidationPipe`: Kích hoạt `{ whitelist: true, forbidNonWhitelisted: true, transform: true }`.

#### 1.3. Động cơ Mật mã học cốt lõi (`src/core/crypto/crypto.util.ts`)
- [ ] **Task 1.3.1:** Xây dựng hàm băm SHA-256:
  - `computeSha256Buffer(data: Buffer): string`
  - `computeSha256Stream(stream: Readable): Promise<string>`
- [ ] **Task 1.3.2:** Xây dựng cơ chế mã hóa luồng AES-256-GCM (`Streaming Encryption`):
  - Sử dụng `crypto.randomBytes(16)` sinh Salt.
  - Sử dụng `crypto.pbkdf2Sync(password, salt, 100000, 32, 'sha512')` dẫn xuất Key 256-bit.
  - Sử dụng `crypto.randomBytes(12)` sinh IV.
  - Ghép Header nhị phân: `[Magic Bytes 8B][Salt 16B][IV 12B]` $\rightarrow$ Luồng mã hóa $\rightarrow$ `[Auth Tag 16B]`.
- [ ] **Task 1.3.3:** Xây dựng cơ chế giải mã luồng tương ứng `createAes256GcmDecryptStream`.
- [ ] **Task 1.3.4:** Viết Unit Test độc lập kiểm tra tính chính xác của `crypto.util.ts` (kiểm tra tính toàn vẹn khi mã hóa - giải mã dữ liệu lớn).

#### 1.4. Module Xác thực & Người dùng (`src/modules/auth` & `src/modules/users`)
- [ ] **Task 1.4.1:** Hiện thực hóa `UserSchema` và `UserSessionSchema` theo đặc tả `tech_solution_v2.md` với `deleted_at: Date | null` và Partial Unique Indexes.
- [ ] **Task 1.4.2:** Hiện thực hóa các API Xác thực (F1.1 $\rightarrow$ F1.10):
  - `POST /api/v1/auth/register`: Đăng ký, băm bcrypt mật khẩu.
  - `POST /api/v1/auth/login`: Xác thực, sinh Access Token (15m) và Refresh Token (7d), băm SHA-256 refresh token lưu vào `user_sessions`.
  - `POST /api/v1/auth/refresh`: Cấp mới Access Token bằng Refresh Token còn hạn.
  - `POST /api/v1/auth/logout`: Đánh dấu `is_revoked: true` cho session hiện hành.
  - `GET /api/v1/auth/sessions` & `DELETE /api/v1/auth/sessions/:id`: Xem danh sách phiên và thu hồi phiên từ xa.
- [ ] **Task 1.4.3:** Xây dựng `JwtAuthGuard` và Decorator `@CurrentUser()` lấy thông tin tài khoản đã xác thực.

#### 1.5. Khung Frontend Vite React (`src/frontend`)
- [ ] **Task 1.5.1:** Khởi tạo cấu hình `package.json` với React 18, Vite, TypeScript, Tailwind CSS, Lucide Icons, Axios, Zustand, TanStack React Query.
- [ ] **Task 1.5.2:** Cấu hình `vite.config.ts` thiết lập proxy chuyển tiếp các request `/api/v1` sang backend NestJS port 3000.
- [ ] **Task 1.5.3:** Cấu hình Tailwind CSS, bảng màu UI chuẩn tối giản.
- [ ] **Task 1.5.4:** Xây dựng `apiClient` (Axios instance) với Interceptor tự động gắn Access Token và tự động gọi endpoint `/api/v1/auth/refresh` khi nhận mã lỗi 401.
- [ ] **Task 1.5.5:** Xây dựng giao diện cơ bản: Trang Đăng nhập, Trang Đăng ký, Layout Dashboard với Sidebar và Header.

---

### GIAI ĐOẠN 2: WORKSPACE, PROJECT & STREAMING INGESTION (Sprint 2)
**Trọng tâm:** Quản lý không gian làm việc, ràng buộc chặt chẽ 1 Project = 1 Dataset, xử lý tải lên tệp tin lớn bằng Stream, tính toán Checksum SHA-256, tự động nhận diện Schema và hiển thị bảng ảo Virtual Grid.

#### 2.1. Module Workspaces & Projects (`src/modules/workspaces` & `src/modules/projects`)
- [ ] **Task 2.1.1:** Hiện thực hóa `WorkspaceSchema` và `ProjectSchema` với ràng buộc `deleted_at: Date | null` và Partial Unique Indexes.
- [ ] **Task 2.1.2:** Hiện thực hóa các API Workspaces (F2.1 $\rightarrow$ F2.7):
  - CRUD Workspace, hỗ trợ chuyển quyền sở hữu (Transfer Ownership).
  - Quản lý thành viên Workspace: Thêm thành viên, cập nhật vai trò (`owner`, `editor`, `viewer`), xóa thành viên.
- [ ] **Task 2.1.3:** Hiện thực hóa các API Projects (F3.1 $\rightarrow$ F3.5):
  - CRUD Project trong Workspace.
  - Kiểm tra ràng buộc nghiệp vụ: Một Project chỉ được phép chứa tối đa 1 Dataset hoạt động (`has_dataset: true`). Khi tạo Dataset mới trong Project đã có dữ liệu, bắt buộc yêu cầu tạo Project mới hoặc ghi đè phiên bản theo đúng quy trình.
- [ ] **Task 2.1.4:** Xây dựng `ResourceOwnershipGuard` kiểm tra quyền hạn truy cập tài nguyên (RBAC / ABAC) trước khi cho phép thao tác trên Project/Workspace.

#### 2.2. Module Ingestion & Quản lý Dataset (`src/modules/datasets`)
- [ ] **Task 2.2.1:** Hiện thực hóa `DatasetSchema` và `DatasetRecordSchema`:
  - `file_checksum: string` (SHA-256).
  - Mảng `columns`: Tên cột, kiểu dữ liệu suy luận (`string`, `number`, `boolean`, `date`), số lượng null.
  - `DatasetRecord`: Lưu trữ từng dòng dữ liệu dạng chuẩn hóa `{ dataset_id, row_index, data: { ... } }`. Đánh Compound Index `{ dataset_id: 1, row_index: 1 }`.
- [ ] **Task 2.2.2:** Hiện thực hóa API Tải lên theo Luồng (Streaming Upload - F4.1):
  - Sử dụng thư viện `busboy` tiếp nhận luồng nhị phân trực tiếp từ HTTP multipart request, không ghi toàn bộ file vào RAM.
  - Vừa stream qua hàm tính `computeSha256Stream`, vừa stream qua bộ Parser (`fast-csv` cho CSV, `xlsx` cho Excel).
  - Kiểm tra trùng lặp tệp: Tìm kiếm trong MongoDB xem đã tồn tại Dataset có cùng `file_checksum` chưa (Deduplication check).
  - Tự động suy luận kiểu dữ liệu (Schema Inference) trên 500 dòng đầu tiên (Tầng 0 Schema Normalizer).
  - Ghi bản ghi hàng loạt (Bulk Write) vào `dataset_records` theo từng chunk 1.000 dòng để tránh nghẽn I/O.
- [ ] **Task 2.2.3:** Hiện thực hóa các API quản lý Dataset (F4.2 $\rightarrow$ F4.6): Lấy thông tin chi tiết, cập nhật tên/mô tả, xóa mềm Dataset (`deleted_at: Date`), lấy tóm tắt phân phối cột.

#### 2.3. Module Virtual Data Grid Backend (`src/modules/data-view`)
- [ ] **Task 2.3.1:** Hiện thực hóa API Phân trang Dữ liệu Bảng (F5.1):
  - Hỗ trợ Cursor Pagination và Keyset Pagination dựa trên `row_index` để phản hồi trong thời gian $\le 50\text{ ms}$ dù bảng có hàng trăm nghìn dòng.
  - Hỗ trợ lọc (Filtering) động theo giá trị cell, điều kiện số học (`>`, `<`, `=`), hoặc tìm kiếm text.
  - Hỗ trợ sắp xếp (Sorting) nhiều cột.
- [ ] **Task 2.3.2:** Hiện thực hóa API Chỉnh sửa Cell trực tiếp (F5.2 - In-place Cell Edit):
  - Cập nhật giá trị trực tiếp tại `{ dataset_id, row_index, column_name }`.
  - Tự động đánh dấu trạng thái "dữ liệu đã bị biến đổi so với phiên bản gốc".
- [ ] **Task 2.3.3:** Hiện thực hóa API Thống kê Phân phối Cột (F5.3):
  - Sử dụng MongoDB Aggregation Pipeline tính toán số lượng null, min, max, trung bình, median, và histogram 10 khoảng (buckets).

#### 2.4. Giao diện Virtual Data Grid Frontend (`src/frontend/src/features/data-studio`)
- [ ] **Task 2.4.1:** Tích hợp thư viện `@tanstack/react-virtual` và `@tanstack/react-table` xây dựng thành phần `VirtualGrid`:
  - Chỉ render trên DOM các hàng đang hiển thị trong Viewport (khoảng 30-50 dòng), cuộn siêu mượt với 100.000 dòng dữ liệu.
- [ ] **Task 2.4.2:** Tích hợp tính năng Infinite Scroll / Virtual Pagination tự động fetch thêm trang dữ liệu tiếp theo khi người dùng cuộn đến đáy.
- [ ] **Task 2.4.3:** Xây dựng UI chỉnh sửa cell trực tiếp với cơ chế Optimistic Update (cập nhật UI ngay lập tức, rollback nếu API báo lỗi).
- [ ] **Task 2.4.4:** Tích hợp biểu đồ nhỏ (Sparkline / Mini Histogram) trên thanh tiêu đề của từng cột để hiển thị phân phối dữ liệu trực quan.

---

### GIAI ĐOẠN 3: PHẢ HỆ NEO4J, PHIÊN BẢN HÓA & MẬT MÃ HỌC (Sprint 3)
**Trọng tâm:** Xây dựng đồ thị Directed Acyclic Graph (DAG) trên Neo4j theo dõi nguồn gốc dữ liệu, thiết lập chuỗi băm bảo toàn tính toàn vẹn (Merkle-like Version Chaining), bộ quy tắc làm sạch dữ liệu xác định (Tầng 1), và xuất file mã hóa AES-256-GCM.

#### 3.1. Động cơ Phả hệ Dữ liệu Neo4j (`src/modules/lineage`)
- [ ] **Task 3.1.1:** Định nghĩa cấu trúc Node và Quan hệ (Relationships) trên Neo4j bằng Cypher Schema:
  - Nodes: `(:Dataset { id, name, created_at })`, `(:Version { id, version_number, version_hash, created_at })`, `(:Transformation { id, rule_name, params, applied_at })`.
  - Relationships: `[:HAS_VERSION]`, `[:DERIVED_FROM { timestamp }]`, `[:APPLIED_BY]`.
- [ ] **Task 3.1.2:** Thiết lập cơ chế Đồng bộ Kép (Dual-write Synchronization Service):
  - Mỗi khi một DatasetVersion hoặc Transformation được ghi nhận trong MongoDB, một transaction Cypher tương ứng được thực thi trên Neo4j.
  - Áp dụng cơ chế Retry (3 lần) và ghi log lỗi nếu Neo4j tạm thời không khả dụng.
- [ ] **Task 3.1.3:** Hiện thực hóa API Truy vấn Đồ thị Phả hệ (F8.1 $\rightarrow$ F8.4):
  - `GET /api/v1/lineage/:dataset_id`: Truy vấn Cypher Graph Traversal trả về danh sách Nodes và Edges của toàn bộ cây phả hệ.
  - `GET /api/v1/lineage/node/:id/upstream`: Truy vết ngược về gốc (Root Cause Lineage Analysis).
  - `GET /api/v1/lineage/node/:id/downstream`: Phân tích tầm ảnh hưởng (Impact Analysis) nếu dữ liệu phiên bản cũ bị chỉnh sửa.
  - `GET /api/v1/lineage/verify-integrity/:dataset_id`: So khớp chuỗi băm Neo4j với MongoDB để phát hiện can thiệp dữ liệu trái phép.

#### 3.2. Quản lý Phiên bản Dữ liệu & Chuỗi Băm Chống Giả Mạo (`src/modules/versions`)
- [ ] **Task 3.2.1:** Hiện thực hóa `DatasetVersionSchema` trong MongoDB:
  - `version_number: number`
  - `parent_version_id: ObjectId | null`
  - `data_checksum: string` (SHA-256 băm từ toàn bộ nội dung bản ghi của phiên bản này).
  - `parent_hash: string` (Băm của phiên bản cha, phiên bản 1 gán chuỗi rỗng hoặc Genesis hash).
  - `version_hash: string` = `SHA256(data_checksum + parent_hash + transformation_log_hash)`.
  - `change_summary`: Mô tả các thay đổi (số dòng sửa, số dòng xóa, rules đã chạy).
- [ ] **Task 3.2.2:** Hiện thực hóa các API Phiên bản (F7.1 $\rightarrow$ F7.5):
  - `POST /api/v1/datasets/:id/versions/commit`: Đóng gói trạng thái hiện tại thành một phiên bản bất biến (Immutable Checkpoint), tính toán chuỗi hash và đồng bộ sang Neo4j.
  - `GET /api/v1/datasets/:id/versions`: Lịch sử các phiên bản.
  - `POST /api/v1/datasets/:id/versions/:v_id/rollback`: Hoàn nguyên bảng dữ liệu về trạng thái của một phiên bản trong quá khứ.
  - `GET /api/v1/datasets/:id/versions/diff`: So sánh khác biệt giữa 2 phiên bản (Diff view).

#### 3.3. Động cơ Quy tắc Làm sạch Xác định - Tầng 1 (`src/modules/clean-rules`)
- [ ] **Task 3.3.1:** Thiết kế Rule Engine có khả năng chạy Deterministic Rules:
  - **Nhóm Xử lý Thiếu dữ liệu (Null Handling):** Drop rows có null, Impute bằng hằng số, Mean, Median, Mode, Forward Fill.
  - **Nhóm Chuẩn hóa Dữ liệu (Standardization):** Trim khoảng trắng, Chuyển chữ hoa/thường, Chuẩn hóa định dạng Date ISO 8601, Ép kiểu dữ liệu an toàn (Safe Type Cast).
  - **Nhóm Lọc & Khử trùng lặp (Deduplication & Filtering):** Xóa các dòng trùng lặp hoàn toàn hoặc trùng lặp theo danh sách khóa chính.
  - **Nhóm Ràng buộc Biểu thức Chính quy (Regex Validation):** Kiểm tra Email, Số điện thoại Việt Nam, Mã số thuế, Định dạng tùy chỉnh.
- [ ] **Task 3.3.2:** Hiện thực hóa API Chạy Thử nghiệm (Dry-run / Preview - F6.1):
  - Áp dụng luật trên tập mẫu 100 dòng, trả về kết quả trước/sau (Diff Preview) và số lượng bản ghi bị ảnh hưởng mà chưa làm thay đổi dữ liệu thật.
- [ ] **Task 3.3.3:** Hiện thực hóa API Áp dụng Luật Hàng loạt (Batch Apply - F6.2):
  - Chạy luật trên toàn bộ dữ liệu qua bulkWrite của MongoDB, tự động tạo một biến đổi trong Lineage Graph.

#### 3.4. Module Xuất Dữ liệu Bảo mật (`src/modules/exports`)
- [ ] **Task 3.4.1:** Hiện thực hóa API Xuất dữ liệu Thường (F9.1):
  - Sử dụng MongoDB Cursor stream dữ liệu từ `dataset_records` $\rightarrow$ Thư viện `fast-csv` biến đổi sang CSV $\rightarrow$ Ghi trực tiếp ra HTTP Response Stream.
  - Bộ nhớ RAM tiêu thụ duy trì ở mức $\le 20\text{ MB}$ bất kể tệp 100.000 dòng.
- [ ] **Task 3.4.2:** Hiện thực hóa API Xuất dữ liệu Mã hóa AES-256-GCM (F9.2):
  - Nếu người dùng cung cấp `encryption_password`:
  - Pipeline xử lý luồng: `MongoCursor Stream` $\rightarrow$ `CSV Formatter Stream` $\rightarrow$ `Aes256GcmEncryptStream` $\rightarrow$ `HTTP Response`.
  - Định dạng file tải về: `.enc.csv`.
- [ ] **Task 3.4.3:** Xây dựng script tiện ích mã nguồn mở nhỏ (CLI Utility / Python snippet) đính kèm cho người dùng để họ có thể tự giải mã tệp `.enc.csv` trên máy cục bộ với mật khẩu của họ.

#### 3.5. Giao diện Đồ thị Phả hệ & Quản lý Phiên bản Frontend (`src/frontend`)
- [ ] **Task 3.5.1:** Tích hợp thư viện `@xyflow/react` xây dựng thành phần `LineageViewer`:
  - Vẽ đồ thị DAG trực quan từ dữ liệu Nodes/Edges của Neo4j.
  - Node biểu diễn DatasetVersion (màu xanh lá), Node biểu diễn Clean Rule Transformation (màu xanh dương).
  - Cho phép click vào Node để xem chi tiết Metadata, mã băm SHA-256, và tóm tắt biến đổi.
- [ ] **Task 3.5.2:** Xây dựng giao diện Danh sách Phiên bản (Version History Panel) với nút "Rollback" và nút "Tải về bản sao lưu".
- [ ] **Task 3.5.3:** Xây dựng Modal Xuất dữ liệu có tùy chọn checkbox "Bảo vệ tệp bằng mật mã AES-256-GCM".

---

### GIAI ĐOẠN 4: ĐỘNG CƠ AI ĐA TẦNG & GỢI Ý LÀM SẠCH (Sprint 4)
**Trọng tâm:** Kết nối Google Gemini API (Tầng 3) để phân tích ngữ cảnh, giải thích nguyên nhân lỗi và gợi ý chiến lược làm sạch; Tích hợp Tầng 0 (Schema Normalizer) và Tầng 2 (Unsupervised ML Anomaly Detection).

#### 4.1. Tích hợp AI Tầng 3 - Cloud LLM Orchestrator (`src/modules/ai-engine`)
- [ ] **Task 4.1.1:** Cài đặt SDK chính thức `@google/genai` (hoặc REST client tương thích) giao tiếp với Gemini API.
- [ ] **Task 4.1.2:** Thiết kế System Prompts và Cấu trúc Đầu ra có Cấu trúc (Structured JSON Output):
  - Yêu cầu Gemini trả về đúng JSON Schema:
    ```json
    {
      "column_name": "string",
      "issue_type": "invalid_format | semantic_anomaly | schema_drift",
      "severity": "high | medium | low",
      "explanation": "string (tiếng Việt)",
      "suggested_rule": {
        "rule_type": "regex_replace | impute | cast_type",
        "parameters": {}
      }
    }
    ```
- [ ] **Task 4.1.3:** Hiện thực hóa API Phân tích Chất lượng Bằng AI (F6.4):
  - Trích xuất Metadata, 20 dòng mẫu chứa lỗi, thống kê phân phối cột (không gửi toàn bộ file lên cloud để tiết kiệm token và bảo mật dữ liệu).
  - Gửi request phân tích lên Gemini API, lưu kết quả gợi ý vào MongoDB.
- [ ] **Task 4.1.4:** Thiết lập cơ chế kiểm soát lỗi (Fallback & Timeout):
  - Timeout 15s; nếu Gemini API không phản hồi hoặc hết quota, tự động fallback về gợi ý dựa trên bộ luật cứng Tầng 1.

#### 4.2. Tích hợp AI Tầng 2 - Phát hiện Bất thường Học máy Phi giám sát
- [ ] **Task 4.2.1:** Xây dựng dịch vụ Worker bằng Python (FastAPI):
  - Cài đặt `scikit-learn`, `numpy`, `polars`.
  - Hiện thực hóa thuật toán **Isolation Forest** và **Local Outlier Factor (LOF)** trên các cột kiểu số.
  - Hiện thực hóa thuật toán **Median Absolute Deviation (MAD)** để tìm các giá trị ngoại lai (Outliers) có tính ổn định cao.
- [ ] **Task 4.2.2:** Xây dựng giao tiếp nội bộ giữa NestJS Backend và Python Worker:
  - NestJS gửi mảng dữ liệu cột số sang Python Worker qua HTTP POST nội bộ.
  - Python Worker trả về danh sách chỉ số dòng bị nghi ngờ bất thường (`outlier_row_indices`) kèm điểm tin cậy (Anomaly Score từ 0.0 đến 1.0).
- [ ] **Task 4.2.3:** Hiển thị cờ cảnh báo bất thường trực tiếp trên Virtual Grid ở Frontend.

#### 4.3. Giao diện Trợ lý AI & Duyệt Gợi ý (Human-in-the-Loop UI)
- [ ] **Task 4.3.1:** Xây dựng thanh công cụ AI (AI Assistant Sidebar):
  - Hiển thị danh sách các vấn đề chất lượng dữ liệu được AI phát hiện.
  - Hiển thị giải thích nguyên nhân bằng ngôn ngữ tự nhiên.
- [ ] **Task 4.3.2:** Nút hành động "Xem thử biến đổi" (Preview Transformation) và "Chấp nhận sửa đổi" (Accept & Apply).
  - Khi người dùng đồng ý, kích hoạt Clean Rule Engine chạy tự động và commit một DatasetVersion mới.

---

### GIAI ĐOẠN 5: KIỂM THỬ TOÀN DIỆN, BẢO MẬT & ĐÓNG GÓI HỆ THỐNG (Sprint 5)
**Trọng tâm:** Kiểm thử đơn vị, kiểm thử tích hợp luồng dữ liệu lớn, đo kiểm giới hạn RAM, rà soát an toàn thông tin và hoàn thiện tài liệu hướng dẫn vận hành.

#### 5.1. Bộ Kiểm thử Tự động (Automated Testing Suite)
- [ ] **Task 5.1.1: Unit Tests (Jest):**
  - Đạt độ phủ mã nguồn (Coverage) $\ge 85\%$ cho các module lõi: `crypto.util.ts`, `clean-rules.engine.ts`, `auth.service.ts`.
  - Test case kiểm tra chuỗi băm Merkle: Sửa đổi 1 ký tự trong bản ghi cũ phải làm gãy toàn bộ chuỗi `version_hash`.
  - Test case kiểm tra AES-256-GCM: Mã hóa với password đúng thì giải mã thành công; sai 1 ký tự password hoặc sai Auth Tag phải ném lỗi xác thực (`Error: Unsupported state or unable to authenticate data`).
- [ ] **Task 5.1.2: Integration Tests (Supertest):**
  - Kiểm thử toàn bộ 43 API endpoints với các kịch bản thành công (200, 201) và kịch bản lỗi (400, 401, 403, 404, 422).
  - Kiểm thử ràng buộc Unique Email và Unique Project Name với Soft Delete: Tạo mới $\rightarrow$ Xóa mềm $\rightarrow$ Tạo mới lại với cùng tên (phải thành công).
- [ ] **Task 5.1.3: End-to-End (E2E) Flow Test:**
  - Viết kịch bản E2E kiểm tra toàn bộ vòng đời dữ liệu:
    1. Đăng ký & Đăng nhập $\rightarrow$ Tạo Workspace $\rightarrow$ Tạo Project.
    2. Upload file CSV 10.000 dòng $\rightarrow$ Kiểm tra `file_checksum` SHA-256.
    3. Chạy Clean Rule xóa dòng null và chuẩn hóa ngày tháng.
    4. Commit Version 2 $\rightarrow$ Xác nhận chuỗi hash liên kết với Version 1.
    5. Kiểm tra cây đồ thị Neo4j có đủ các quan hệ `[:DERIVED_FROM]`.
    6. Xuất dữ liệu với mật khẩu AES-256-GCM $\rightarrow$ Giải mã tệp và so sánh checksum với bản ghi trong cơ sở dữ liệu.

#### 5.2. Đo kiểm Tải & Giới hạn Bộ nhớ (Stress & Memory Benchmarking)
- [ ] **Task 5.2.1:** Chạy kịch bản upload và phân trang tệp CSV 100.000 dòng.
- [ ] **Task 5.2.2:** Sử dụng lệnh `docker stats` theo dõi mức tiêu thụ RAM trong suốt quá trình chạy:
  - MongoDB: Không vượt quá 512MB RAM.
  - Neo4j: Không vượt quá 1024MB RAM.
  - NestJS Backend: Không vượt quá 512MB RAM.
  - Đảm bảo hệ thống giải phóng bộ nhớ triệt để sau khi kết thúc stream (không xảy ra Memory Leak).

#### 5.3. Rà soát An toàn Thông tin & Đóng gói
- [ ] **Task 5.3.1:** Rà soát OWASP Top 10:
  - Kiểm tra chống NoSQL Injection (tất cả truy vấn MongoDB dùng parameterized object, không concatenate chuỗi từ client).
  - Kiểm tra chống Cypher Injection (tất cả truy vấn Neo4j dùng tham số `{ params }`).
  - Cấu hình Helmet HTTP Headers và Rate Limiter (`@nestjs/throttler`: tối đa 100 requests/phút).
- [ ] **Task 5.3.2:** Soạn thảo tài liệu bàn giao `README.md` tại thư mục gốc với hướng dẫn 3 bước:
  1. `cp .env.example .env`
  2. `docker compose up -d`
  3. Khởi chạy backend và frontend.

---

## 5. Ma trận Phân công & Tiêu chí Nghiệm thu (Definition of Done - DoD)

| Module | Tệp tin trọng tâm | API liên quan | Rủi ro kỹ thuật chính | Tiêu chí hoàn thành (DoD) |
| :--- | :--- | :--- | :--- | :--- |
| **Infrastructure** | `docker-compose.yml`, `.env.example` | N/A | Tràn RAM máy local sập container. | Cả 3 container (Mongo, Neo4j, Redis) khởi động ổn định, RAM $\le 1.65\text{ GB}$. |
| **Core Crypto** | `src/backend/src/core/crypto/crypto.util.ts` | F8.4, F9.2 | Mã hóa stream bị corrupt Auth Tag hoặc sai Salt. | Unit test mã hóa - giải mã dữ liệu 50MB khớp byte 100%. |
| **Auth & Users** | `modules/auth/*`, `modules/users/*` | F1.1 $\rightarrow$ F1.10 | Rò rỉ token, quên xóa session hết hạn. | TTL Index dọn session tự động; Soft delete hoạt động đúng với `deleted_at: Date`. |
| **Workspaces & Projects** | `modules/workspaces/*`, `modules/projects/*` | F2.1 $\rightarrow$ F3.5 | Vi phạm ràng buộc 1 Project = 1 Dataset. | Chặn đứng việc tạo dataset thứ hai trong cùng project trừ khi ghi đè có chủ đích. |
| **Datasets Ingestion** | `modules/datasets/*` | F4.1 $\rightarrow$ F4.6 | Đọc file lớn tràn Heap Node.js. | Stream Busboy parse CSV 100k dòng tiêu thụ RAM NestJS $\le 150\text{ MB}$. |
| **Virtual Grid** | `modules/data-view/*`, `components/virtual-grid/*` | F5.1 $\rightarrow$ F5.3 | Cuộn lag, phản hồi chậm khi dữ liệu lớn. | Phân trang cursor trả về $\le 50\text{ ms}$; Frontend duy trì 60 FPS khi cuộn bảng. |
| **Clean Rules** | `modules/clean-rules/*` | F6.1 $\rightarrow$ F6.3 | Dry-run làm sai lệch dữ liệu thật. | Dry-run trả về diff chuẩn xác mà không sửa 1 cell nào trong database. |
| **Versions & Audit** | `modules/versions/*` | F7.1 $\rightarrow$ F7.5 | Sai lệch liên kết chuỗi băm cha - con. | Xâu chuỗi `parent_hash` và `version_hash` chuẩn Merkle, verify integrity báo đúng. |
| **Lineage DAG** | `modules/lineage/*`, `components/lineage-graph/*` | F8.1 $\rightarrow$ F8.4 | Mất đồng bộ giữa Mongo và Neo4j. | Cypher graph hiển thị chuẩn xác toàn bộ nhánh rẽ biến đổi dữ liệu. |
| **Secure Export** | `modules/exports/*` | F9.1 $\rightarrow$ F9.2 | Export file lớn bị nghẽn HTTP pipe. | Tệp `.enc.csv` được stream hoàn chỉnh kèm xác thực mật khẩu. |
| **AI Orchestrator** | `modules/ai-engine/*` | F6.4 $\rightarrow$ F6.5 | Gemini API timeout hoặc trả về sai JSON schema. | Fallback an toàn khi API lỗi; Structured output map chuẩn vào Rule Engine. |

---

## 6. Ma trận Rủi ro Kỹ thuật & Chiến lược Ứng phó (Risk Mitigation)

1. **Rủi ro 1: Quá tải RAM máy phát triển khi chạy toàn bộ hệ thống**
   - *Mức độ:* Nghiêm trọng (High).
   - *Nguyên nhân:* Neo4j và MongoDB nếu để mặc định sẽ chiếm dụng toàn bộ RAM có sẵn của hệ điều hành để làm bộ đệm cache.
   - *Giải pháp:* Khống chế cứng ngay trong file `docker-compose.yml` (`mem_limit`, `wiredTigerCacheSizeGB`, `NEO4J_server_memory_heap_max__size`). Nếu RAM máy quá thấp, cung cấp cấu hình tắt Redis và chuyển sang lưu session trong MongoDB.
2. **Rủi ro 2: Block Event Loop của Node.js khi xử lý tệp dữ liệu lớn**
   - *Mức độ:* Cao (High).
   - *Nguyên nhân:* Xử lý vòng lặp tính toán trên hàng trăm nghìn phần tử trong một tiến trình duy nhất.
   - *Giải pháp:* Sử dụng Node.js Stream kết hợp phân mảng thành các Batch nhỏ (Batch Processing 1.000 records). Các thuật toán tính toán ma trận phức tạp của Tầng 2 được đẩy sang Python Worker.
3. **Rủi ro 3: Bất đồng bộ dữ liệu giữa MongoDB và Neo4j (Dual-write Inconsistency)**
   - *Mức độ:* Trung bình (Medium).
   - *Nguyên nhân:* Ghi MongoDB thành công nhưng Neo4j sập mạng dẫn đến đồ thị thiếu node.
   - *Giải pháp:* MongoDB đóng vai trò là "Single Source of Truth". Xây dựng bảng `outbox_events` hoặc hàng đợi retry; đồng thời xây dựng API `POST /api/v1/lineage/rebuild/:dataset_id` để tự động quét lại toàn bộ lịch sử `dataset_versions` trong MongoDB và tái lập đồ thị Neo4j khi cần.
4. **Rủi ro 4: Gemini API trả về cấu trúc không khớp hoặc cạn quota**
   - *Mức độ:* Trung bình (Medium).
   - *Nguyên nhân:* Mạng chập chờn, API rate limit hoặc mô hình LLM hallucinate ra cú pháp lạ.
   - *Giải pháp:* Cấu hình `responseSchema` chặt chẽ trong SDK của Gemini. Bọc khối gọi API bằng `try/catch` có cơ chế retry với exponential backoff và luôn có bộ luật cứng (Fallback Rules) của Tầng 1 sẵn sàng thay thế.

---

## 7. Kết luận & Các bước Tiếp theo

Tài liệu này là bản kim chỉ nam kỹ thuật chuẩn xác, kết nối chặt chẽ:
- Đặc tả tính năng tại [feature_spec_v4.md](file:///home/hoa/Documents/UTH/Lập%20trình%20JS%20&%20TS/AI%20systems%20support%20detecting%20and%20handling%20data%20quality%20issues%20/docs/feature_spec_v4.md)
- Giải pháp kỹ thuật tại [tech_solution_v2.md](file:///home/hoa/Documents/UTH/Lập%20trình%20JS%20&%20TS/AI%20systems%20support%20detecting%20and%20handling%20data%20quality%20issues%20/docs/tech_solution_v2.md)
- Thiết kế AI tại [factors_design_AI_v2.md](file:///home/hoa/Documents/UTH/Lập%20trình%20JS%20&%20TS/AI%20systems%20support%20detecting%20and%20handling%20data%20quality%20issues%20/docs/factors_design_AI_v2.md)

Khi bạn xem xét và phê duyệt bản kế hoạch này, chúng ta sẽ bắt đầu thực thi **Giai đoạn 1 (Sprint 1)**: Thiết lập file `docker-compose.yml`, tạo cấu trúc thư mục `src/backend` và `src/frontend`.
