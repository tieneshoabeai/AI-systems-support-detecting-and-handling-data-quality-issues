# AI Data Quality Management Platform — Backend Engine
> **Dự án:** Nền tảng Quản lý & Giám sát Chất lượng Dữ liệu có Hỗ trợ của Trí tuệ Nhân tạo  
> **Đơn vị:** Trường Đại học Giao thông Vận tải TP.HCM (UTH) — Học phần: Lập trình JS & TS Nâng Cao  
> **Kiến trúc:** Layered Modular Architecture | Clean Architecture | Polyglot Persistence | Event-Driven Outbox  
> **Quy chuẩn mã nguồn:** TypeScript Strict (Zero Any Policy) | CASL ABAC Model | Streaming Memory-Safe

[![TypeScript Strict](https://img.shields.io/badge/TypeScript-7.0.2_%7C_6.0_Strict-blue.svg)](https://www.typescriptlang.org/)
[![NestJS](https://img.shields.io/badge/Backend-NestJS_11-red.svg)](https://nestjs.com/)
[![Security](https://img.shields.io/badge/Security-Cloudflare_TLS_1.3_Port_443-blue.svg)](#4-công-nghệ--hạ-tầng-đám-mây-tech-stack)
[![Database](https://img.shields.io/badge/Database-MongoDB_Atlas_%7C_Neo4j_AuraDB_%7C_Cloudflare_R2-green.svg)](#4-công-nghệ--hạ-tầng-đám-mây-tech-stack)
[![Zero Any](https://img.shields.io/badge/Type_Safety-Zero_Any_Policy-success.svg)](#5-ràng-buộc-chất-lượng--tiêu-chuẩn-bất-biến-quality--safety-invariants)
[![License](https://img.shields.io/badge/License-Academic_Project_UTH-orange.svg)](#)

---

## 1. TỔNG QUAN KIẾN TRÚC VÀ BÀI TOÁN NGHIỆP VỤ

### 1.1. Sứ mệnh của Phân hệ Backend
Trong kỹ thuật dữ liệu và khoa học dữ liệu, dữ liệu bẩn (Missing values, Outliers, Format anomalies, Duplicates) là nguyên nhân chính dẫn đến sự sai lệch trong các mô hình AI và báo cáo phân tích. Các công cụ bảng tính thông thường (như Excel) thường bị treo đơ khi tệp vượt quá 1 triệu dòng, tiêu tốn cạn kiệt bộ nhớ RAM máy trạm, và không có cơ chế truy vết lịch sử sửa đổi đáng tin cậy.

Phân hệ Backend được xây dựng nhằm đóng vai trò là **Hệ thống Xử lý & Kiểm chuẩn Dữ liệu Trung tâm cấp Doanh nghiệp**:
- **Tiếp nhận dữ liệu lớn dạng luồng (Streaming Ingestion):** Tải lên các tệp CSV/Excel hàng triệu dòng thông qua luồng nhị phân trực tiếp (`busboy`), duy trì mức tiêu thụ RAM luôn $\le 50\text{MB}$.
- **Hiển thị lưới bảng ảo siêu tốc (Virtual Grid Keyset Pagination):** Phân trang dựa trên con trỏ chỉ mục phức hợp với độ trễ $\le 10\text{ms}$ bất kể kích thước bảng.
- **Thử nghiệm luật làm sạch an toàn (Sandbox Dry-run):** Cho phép chuyên viên chạy thử nghiệm các quy tắc lọc trên 100 dòng mẫu đầu tiên trong RAM trước khi áp dụng vào kho dữ liệu thật.
- **Kiểm toán mật mã học Merkle DAG chống giả mạo:** Lưu vết toàn bộ chuỗi phiên bản dữ liệu và đồ thị phả hệ trên **Neo4j AuraDB**, liên kết bằng chuỗi băm $\text{SHA-256}(\text{parent} + \text{rules} + \text{data})$.
- **Xuất khẩu dữ liệu mã hóa chuẩn quân sự:** Mã hóa luồng tệp đầu ra bằng thuật toán **AES-256-GCM** với khóa dẫn xuất PBKDF2 (100,000 vòng lặp).
- **Phân quyền dựa trên thuộc tính hạt mịn (CASL ABAC):** Đánh giá quyền truy cập dựa trên 4 nhóm thuộc tính (Chủ thể, Tài nguyên, Hành động, Ngữ cảnh), triệt tiêu hoàn toàn nguy cơ leo thang đặc quyền ngang (IDOR).

---

## 2. BẢN ĐỒ KIẾN TRÚC TOÀN CẢNH (END-TO-END SYSTEM ARCHITECTURE)

```
+-----------------------------------------------------------------------------------------+
|                                    CLIENT TIER                                          |
|            Web Single Page App (React / Vite) │ Postman │ Swagger OpenAPI               |
+-----------------------------------------------------------------------------------------+
                                           │
                                           │ HTTPS (TLS 1.3 - Cổng 443)
                                           ▼
+-----------------------------------------------------------------------------------------+
|                           NETWORK & TRANSPORT SECURITY TIER                             |
|          Cloudflare Zero Trust Tunnel (QUIC Protocol / UDP)                             |
|          Reverse Proxy Trust │ HSTS Preload │ Helmet Headers │ Dynamic CORS Whitelist   |
+-----------------------------------------------------------------------------------------+
                                           │
                                           │ HTTP/1.1 (Loopback Port 3000)
                                           ▼
+-----------------------------------------------------------------------------------------+
|                             API GATEWAY & PIPELINE ENGINE                               |
|                         NestJS 11 + Express Platform Adapter                            |
|  ┌───────────────────┬───────────────────┬────────────────────┬──────────────────────┐  |
|  │ ThrottlerGuard    │ JwtAuthGuard      │ PoliciesGuard      │ AllExceptionsFilter  │  |
|  │ (Rate Limiting)   │ (JWT Access 15m)  │ (CASL ABAC Engine) │ (Tiered Logging)     │  |
|  ├───────────────────┴───────────────────┴────────────────────┴──────────────────────┤  |
|  │                 ZodValidationPipe (Strict Schema Validation - Zero Any)           │  |
|  └──────────────────────────────────────┬────────────────────────────────────────────┘  |
+-----------------------------------------------------------------------------------------+
                                           │
                                           ▼
+-----------------------------------------------------------------------------------------+
|                           CORE APPLICATION MODULES (11 PHÂN HỆ)                         |
|  ┌──────────────────────┬──────────────────────┬─────────────────────────────────────┐  |
|  │ Auth & Users         │ Workspaces & Projects│ Datasets & Data Profiler            │  |
|  │ (JWT, Device Detect) │ (Multi-tenant, CASL) │ (Busboy Multipart Streaming)        │  |
|  ├──────────────────────┼──────────────────────┼─────────────────────────────────────┤  |
|  │ Data View            │ Clean Rules Engine   │ Dataset Versions                    │  |
|  │ (Keyset Virtual Grid)│ (Dry-run Sandbox)    │ (Merkle DAG Hash Chaining)          │  |
|  ├──────────────────────┼──────────────────────┼─────────────────────────────────────┤  |
|  │ Data Lineage         │ Secure Exports       │ Transactional Outbox                │  |
|  │ (Neo4j Graph DAG)    │ (AES-256-GCM Stream) │ (Reliable Event Sync)               │  |
|  └──────────────────────┴──────────────────────┴─────────────────────────────────────┘  |
+-----------------------------------------------------------------------------------------+
                                           │
                                           ▼
+-----------------------------------------------------------------------------------------+
|                         POLYGLOT STORAGE TIER (HẠ TẦNG LƯU TRỮ)                         |
|  ┌─────────────────────────┬──────────────────────────┬──────────────────────────────┐  |
|  │      MongoDB Atlas      │       Neo4j AuraDB       │        Cloudflare R2         │  |
|  │  (Document Database v8) │   (Graph Database v5)    │ (S3-Compatible Object Store) │  |
|  │ Users, Metadata, Rows   │ Phả hệ DAG, Truy vết     │ Tệp thô, Snapshot CSV nén,   │  |
|  │ Outbox Event Log        │ Upstream/Downstream      │ Bản xuất mã hóa (.enc)       │  |
|  └─────────────────────────┴──────────────────────────┴──────────────────────────────┘  |
+-----------------------------------------------------------------------------------------+
```

---

## 3. VÒNG ĐỜI DỮ LIỆU TOÀN TRÌNH (END-TO-END DATA LIFECYCLE)

```
[ 1. INGESTION ] ────> [ 2. PROFILING ] ────> [ 3. CLEANING ]
Nạp luồng Busboy       Suy luận Schema       Chạy thử Sandbox
RAM <= 50MB            & Missing Counts       100 dòng mẫu
       │                                             │
       ▼                                             ▼
[ 6. EXPORT ]    <──── [ 5. AUDIT & DAG ] <─── [ 4. COMMIT ]
Mã hóa AES-256-GCM     Đồng bộ Neo4j Phả hệ   Tính Merkle Hash
Tải về tệp .enc        Kiểm toán chuỗi băm     Tạo Snapshot R2
```

1. **Nạp Dữ liệu Dạng Luồng (Streaming Ingestion):** Bóc tách tệp CSV/Excel qua `busboy`; một nhánh tải lên Cloudflare R2 và tính Checksum SHA-256 song song với việc nạp từng lô 1,000 dòng vào MongoDB.
2. **Khám phá & Thống kê Cột (Data Profiling):** Tự động suy luận kiểu dữ liệu (`string`, `number`, `boolean`, `date`), đếm ô rỗng và tính Histogram 10 khoảng bằng Aggregation Framework.
3. **Thử nghiệm Luật Làm sạch (Sandbox Dry-run):** Thực thi thử nghiệm các luật (`null_handling`, `standardization`, `deduplication`, `regex`) trên 100 dòng mẫu trong RAM mà không ghi đè CSDL.
4. **Cam kết Phiên bản (Version Commit):** Tạo bản snapshot nén trên Cloudflare R2, tính toán mã băm gốc Merkle DAG:
   $$\text{version\_hash} = \text{SHA-256}(\text{parent\_hash} + \text{rules\_hash} + \text{data\_checksum})$$
5. **Đồng bộ Phả hệ & Kiểm toán (Lineage Sync):** Ghi sự kiện vào `outbox_events`; Outbox Dispatcher đồng bộ sang **Neo4j AuraDB**, tạo các nút `:VersionNode`, `:TransformationNode` và quan hệ `[:DERIVED_FROM]`.
6. **Xuất Dữ liệu Bảo mật (Secure Export):** Xuất luồng CSV sạch hoặc đóng gói mã hóa **AES-256-GCM** bảo vệ bằng mật khẩu (với muối Salt 16 bytes, vector IV 12 bytes, và thẻ xác thực Auth Tag 16 bytes).

---

## 4. CHI TIẾT 11 PHÂN HỆ VÀ 43 ENDPOINTS RESTFUL

| Phân hệ (Module) | Trách nhiệm Nghiệp vụ | Endpoints Tiêu biểu | Quyền hạn (CASL ABAC) |
|---|---|---|---|
| **Health** | Giám sát trạng thái 3 CSDL Cloud | `GET /health` | `@Public()` |
| **Auth** | Đăng ký, Đăng nhập, Device Detection, Quản lý Session | `POST /auth/login`<br>`POST /auth/refresh`<br>`GET /auth/sessions` | `@Public()` / `JwtAuthGuard` |
| **Users** | Hồ sơ người dùng cá nhân, Soft Delete | `GET /users/me`<br>`PATCH /users/me` | `JwtAuthGuard` |
| **Workspaces** | Không gian làm việc Multi-tenant, quản lý thành viên | `POST /workspaces`<br>`POST /workspaces/:id/members` | `Create / Update Workspace` |
| **Projects** | Quản lý dự án làm sạch dữ liệu trong Workspace | `POST /workspaces/:wId/projects`<br>`GET /projects/:id` | `Create / Read Project` |
| **Datasets** | Streaming upload tệp, suy luận Schema cột | `POST /projects/:pId/datasets/upload`<br>`GET /datasets/:id/schema` | `Create / Read Dataset` |
| **Data View** | Lưới dữ liệu Virtual Grid, Cell Edit, Histogram | `GET /datasets/:id/records`<br>`PATCH /datasets/:id/records/:idx` | `Read / Update DataRecord` |
| **Clean Rules** | Động cơ kiểm tra & thực thi luật làm sạch | `POST /datasets/:id/rules/preview`<br>`POST /datasets/:id/rules/apply` | `Execute CleanRule` |
| **Lineage** | Đồ thị phả hệ Neo4j DAG, Root Cause, Kiểm toán Merkle | `GET /lineage/:id`<br>`GET /lineage/verify-integrity/:id` | `Read Lineage` |
| **Versions** | Snapshot tệp, so sánh Diff, In-place Rollback | `POST /datasets/:id/versions`<br>`POST /datasets/:id/versions/:v/rollback` | `Create / Update DatasetVersion` |
| **Exports** | Xuất luồng CSV sạch, xuất mã hóa luồng AES-256-GCM | `GET /datasets/:id/export/csv`<br>`POST /datasets/:id/export/secure` | `Export Dataset` |

---

## 5. HƯỚNG DẪN CHI TIẾT TOÀN BỘ CÁC LỆNH HỆ THỐNG (COMMAND REFERENCE)

Dưới đây là cẩm nang hướng dẫn đầy đủ tất cả các câu lệnh thực thi có trong hệ thống, phân loại theo từng nhóm mục đích vận hành:

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                                 BẢN ĐỒ CÁC LỆNH HỆ THỐNG                               │
├──────────────────────────┬──────────────────────────┬──────────────────────────────────┤
│ 1. Khởi chạy Ứng dụng    │ 2. Quản lý Cơ sở Dữ liệu │ 3. Kiểm tra Mã nguồn & Kiểm thử  │
│  - start:dev             │  - db:bootstrap          │  - type-check                    │
│  - start:prod            │  - db:seed               │  - lint / format                 │
│  - start:debug           │  - db:reset:all          │  - test / test:cov / test:e2e    │
├──────────────────────────┼──────────────────────────┴──────────────────────────────────┤
│ 4. Kênh truyền & Mạng    │ 5. Khắc phục Sự cố & Vận hành Chuyên sâu                    │
│  - tunnel:install        │  - curl Health Check                                        │
│  - tunnel:start          │  - Quét kiểm tra AST Zero Any                               │
│  - ssl:generate          │  - Kiểm tra kết nối đa CSDL (MongoDB, Neo4j, Cloudflare R2) │
└──────────────────────────┴─────────────────────────────────────────────────────────────┘
```

---

### NHÓM 1: CÁC LỆNH KHỞI CHẠY ỨNG DỤNG (APPLICATION RUNTIME)

#### 1. Khởi chạy chế độ phát triển (Development Mode):
```bash
pnpm run start:dev
```
- **Cơ chế:** Biên dịch trước tệp `tsconfig.build.json` và khởi chạy NestJS ở chế độ giám sát tệp (`--watch`). Mọi thay đổi trong thư mục `src/` sẽ tự động trigger quá trình hot-reload trong vòng < 500ms.
- **Thời điểm sử dụng:** Lập trình viên sử dụng hàng ngày khi viết code và sửa đổi tính năng.

#### 2. Khởi chạy chế độ gỡ lỗi (Debugging Mode):
```bash
pnpm run start:debug
```
- **Cơ chế:** Khởi động ứng dụng cùng tiến trình Node.js Inspector trên cổng mặc định `9229`. 
- **Thời điểm sử dụng:** Kết nối VS Code hoặc Chrome DevTools (`chrome://inspect`) để đặt các điểm dừng (Breakpoints) kiểm tra biến thời gian chạy.

#### 3. Biên dịch mã nguồn cho môi trường sản xuất (Production Build):
```bash
pnpm run build
```
- **Cơ chế:** Gọi Nest CLI (`nest build`) để biên dịch toàn bộ mã nguồn TypeScript nghiêm ngặt sang JavaScript ES2022 trong thư mục `dist/`, tối ưu hóa kích thước gói nhị phân.
- **Đầu ra:** Thư mục `src/backend/dist/` chứa `main.js` và các modules đã được compile.

#### 4. Khởi chạy bản dựng sản xuất (Production Run):
```bash
pnpm run start:prod
```
- **Cơ chế:** Thực thi trực tiếp tệp JavaScript đã biên dịch `node dist/main` với hiệu năng tối đa, không tốn tài nguyên cho TypeScript Compiler runtime.
- **Thời điểm sử dụng:** Chạy ứng dụng trên máy chủ production, VPS hoặc trong Docker container.

---

### NHÓM 2: CÁC LỆNH KHỞI TẠO, QUẢN LÝ VÀ RESET CƠ SỞ DỮ LIỆU (DATABASE OPERATIONS)

#### 1. Khởi tạo toàn bộ cấu trúc CSDL và Chỉ mục (Bootstrap Database):
```bash
pnpm run db:bootstrap
```
- **Cơ chế:** Thực thi kịch bản `scripts/bootstrap-database.ts`:
  - Kết nối MongoDB Atlas, tự động thiết lập toàn bộ các chỉ mục cốt lõi: Keyset Index `{ dataset_id: 1, row_index: 1, deleted_at: 1 }`, Partial Unique Index `{ email: 1 }`, và TTL Index tự động dọn session sau 7 ngày.
  - Kết nối Neo4j AuraDB, tạo các ràng buộc duy nhất (Unique Constraints) và chỉ mục trên nút `:VersionNode(id)` và `:DatasetNode(id)`.
- **Thời điểm sử dụng:** Chạy **1 lần duy nhất** khi thiết lập dự án trên môi trường mới hoặc sau khi vừa thay đổi cấu trúc Schema/Index.

#### 2. Nạp dữ liệu mẫu ban đầu (Seed Initial Data):
```bash
pnpm run db:seed
```
- **Cơ chế:** Thực thi kịch bản `scripts/seed-initial-data.ts`:
  - Khởi tạo tài khoản Quản trị viên cấp cao: `admin@dataquality.io` (Mật khẩu: `Admin@123456`, băm bằng Argon2id).
  - Khởi tạo không gian làm việc mặc định `"Enterprise Data Governance"` và gán quyền sở hữu cho tài khoản Admin.
- **Thời điểm sử dụng:** Chạy ngay sau lệnh `db:bootstrap` để tạo sẵn tài khoản quản trị phục vụ đăng nhập vào hệ thống.

#### 3. Xóa sạch và tái thiết lập toàn bộ hệ thống (Reset All Databases):
```bash
pnpm run db:reset:all
```
- **Cơ chế:** Thực thi `TARGET=all ts-node scripts/bootstrap-database.ts`:
  - Xóa toàn bộ collections trong MongoDB Atlas (ngoại trừ các chỉ mục hệ thống).
  - Thực thi Cypher `MATCH (n) DETACH DELETE n` xóa sạch toàn bộ các nút và cạnh trên Neo4j AuraDB.
  - Dọn dẹp các tệp tạm trên Cloudflare R2 / Local Storage.
  - Tự động gửi thông báo kiểm toán bảo mật (Audit Notification) qua kênh **ntfy.sh** (`https://ntfy.sh/AI-SYSTEM-DATA-QUALITY`).
- **Thời điểm sử dụng:** Dọn dẹp triệt để dữ liệu rác sau khi chạy xong các bài kiểm thử tự động quy mô lớn.

#### 4. Reset cục bộ từng cơ sở dữ liệu riêng biệt:
```bash
# Chỉ xóa và tái tạo lại toàn bộ MongoDB Atlas:
pnpm run db:reset:mongo

# Chỉ xóa sạch đồ thị phả hệ trên Neo4j AuraDB:
pnpm run db:reset:neo4j

# Chỉ dọn dẹp các tệp snapshot và tệp xuất trên Cloudflare R2 / Local Storage:
pnpm run db:reset:storage
```

---

### NHÓM 3: CÁC LỆNH KIỂM THỬ VÀ ĐẢM BẢO CHẤT LƯỢNG MÃ NGUỒN (TESTING & QA)

#### 1. Kiểm tra an toàn kiểu tĩnh (Strict Zero Any Type-check):
```bash
pnpm run type-check
```
- **Cơ chế:** Thực thi `tsc --noEmit` theo cấu hình khắt khe nhất trong `tsconfig.json`. Quét toàn bộ mã nguồn mà không sinh tệp `.js`, phát hiện sớm mọi lỗi sai lệch kiểu dữ liệu hoặc tham số `undefined`.
- **Thời điểm sử dụng:** Trước khi commit mã nguồn hoặc trước khi chạy lệnh build sản xuất.

#### 2. Định dạng mã nguồn tự động (Prettier Format):
```bash
pnpm run format
```
- **Cơ chế:** Tự động chuẩn hóa dấu thụt dòng, khoảng trắng, dấu chấm phẩy theo quy chuẩn Prettier cho toàn bộ các tệp `.ts` trong `src/` và `test/`.

#### 3. Quét lỗi cú pháp và chất lượng mã nguồn (ESLint):
```bash
pnpm run lint
```
- **Cơ chế:** Chạy ESLint kiểm tra các vi phạm coding convention và tự động sửa các lỗi cú pháp cơ bản (`--fix`).

#### 4. Thực thi toàn bộ 16 bộ kiểm thử tự động (Jest Test Suites):
```bash
pnpm run test
```
- **Cơ chế:** Chạy Jest thực thi toàn bộ 16 bộ kiểm thử tự động trong `src/backend/test/`:
  - Kiểm thử tĩnh quét AST Zero Any (`zero-any.spec.ts`).
  - Kiểm thử ma trận phân quyền CASL ABAC 4 vai trò (`casl.spec.ts`).
  - Kiểm thử streaming nạp tệp $\le 50\text{MB}$ RAM (`datasets-ingestion.spec.ts`).
  - Kiểm thử băm Argon2id, PBKDF2 và Merkle Tree SHA-256 (`crypto.spec.ts`).
  - Kiểm thử mã hóa luồng AES-256-GCM (`exports.spec.ts`).
  - Kiểm thử phân trang Keyset Virtual Grid và In-place Cell Edit (`data-view.spec.ts`).

#### 5. Chạy kiểm thử có theo dõi thay đổi (Watch Mode):
```bash
pnpm run test:watch
```
- **Cơ chế:** Jest tự động re-run các test cases liên quan ngay khi bạn lưu một tệp code. Rất hữu ích khi áp dụng quy trình Phát triển Hướng Kiểm thử (Test-Driven Development - TDD).

#### 6. Xuất báo cáo độ bao phủ mã nguồn (Code Coverage):
```bash
pnpm run test:cov
```
- **Cơ chế:** Đo lường tỷ lệ các dòng lệnh, hàm và nhánh logic (`branch coverage`) đã được test bao phủ.
- **Đầu ra:** Báo cáo HTML trực quan tại `src/backend/coverage/lcov-report/index.html`.

#### 7. Thực thi kiểm thử tích hợp đầu cuối (End-to-End Tests):
```bash
pnpm run test:e2e
```
- **Cơ chế:** Khởi chạy một phiên bản ứng dụng đầy đủ trên môi trường test và gửi các HTTP Request mô phỏng người dùng qua Supertest để kiểm tra luồng nghiệp vụ xuyên suốt.

#### 8. Hướng dẫn chạy riêng từng ca kiểm thử đặc thù:
```bash
# Kiểm tra cam kết Zero Any trên toàn bộ codebase:
pnpm exec jest test/zero-any.spec.ts

# Kiểm tra ma trận phân quyền CASL ABAC:
pnpm exec jest test/casl.spec.ts

# Kiểm tra đảm bảo 100% API đều được gắn Guard:
pnpm exec jest test/guard-coverage.spec.ts

# Kiểm tra hiệu năng nạp luồng và giới hạn RAM:
pnpm exec jest test/datasets-ingestion.spec.ts
```

---

### NHÓM 4: CÁC LỆNH KÊNH TRUYỀN BẢO MẬT VÀ MẠNG (TUNNEL & SSL/TLS)

#### 1. Cài đặt binary Cloudflare Tunnel tự động:
```bash
pnpm run tunnel:install
```
- **Cơ chế:** Thực thi `scripts/install-cloudflared.sh`, tự động tải và cài đặt binary `cloudflared` mới nhất từ kho chính thức của Cloudflare về máy trạm (hỗ trợ Linux và macOS).

#### 2. Khởi chạy Cloudflare Zero Trust Tunnel (Public HTTPS Cổng 443):
```bash
pnpm run tunnel:start
# (Hoặc lệnh rút gọn: pnpm run tunnel)
```
- **Cơ chế:** Mở một đường hầm mã hóa bảo mật thông qua giao thức QUIC (UDP) kết nối trực tiếp cổng nội bộ `localhost:3000` với mạng biên Cloudflare Global Edge.
- **Đầu ra:** Cung cấp đường dẫn HTTPS công khai có chứng chỉ SSL hợp lệ (ví dụ: `https://example-random.trycloudflare.com`). Cho phép truy cập Swagger UI và API từ điện thoại di động hoặc các máy tính ngoài Internet mà **hoàn toàn không cần mở port modem (No Port Forwarding)**.

#### 3. Tự động sinh chứng chỉ SSL/TLS tự ký (Self-signed Certificates):
```bash
pnpm run ssl:generate
```
- **Cơ chế:** Chạy kịch bản `scripts/generate-ssl-certs.sh` sử dụng OpenSSL để tạo cặp khóa mã hóa:
  - Khóa riêng tư: `certs/privkey.pem`
  - Chứng chỉ số: `certs/fullchain.pem`
- **Thời điểm sử dụng:** Chuẩn bị chứng chỉ phục vụ chạy máy chủ HTTPS cục bộ.

#### 4. Khởi chạy NestJS trực tiếp trên cổng HTTPS 443 (Local SSL):
```bash
pnpm run start:ssl
```
- **Cơ chế:** Tự động tạo chứng chỉ nếu chưa có, thiết lập cờ `SSL_ENABLED=true SSL_PORT=443` và khởi chạy HTTP/HTTPS song song. *(Lưu ý: Trên Linux yêu cầu quyền `sudo` để bind cổng 443)*.

#### 5. Khởi chạy HTTPS cổng phát triển (Port 8443):
```bash
pnpm run start:ssl:dev
```
- **Cơ chế:** Tương tự `start:ssl` nhưng bind vào cổng `8443` ở chế độ Watch mode, không đòi hỏi quyền root của hệ điều hành.

---

### NHÓM 5: KHẮC PHỤC SỰ CỐ VÀ VẬN HÀNH THỰC TẾ (TROUBLESHOOTING & MAINTENANCE)

#### 1. Kiểm tra sức khỏe toàn diện hệ thống qua cURL:
```bash
curl -s http://localhost:3000/health | jq
```
- **Kết quả trả về chuẩn:**
  ```json
  {
    "status": "ok",
    "timestamp": "2026-10-29T00:30:00.000Z",
    "services": {
      "mongodb_atlas": { "status": "connected", "readyState": 1 },
      "neo4j_auradb": { "status": "connected" },
      "storage": { "mode": "cloud_s3_r2", "bucket": "data-quality-storage" }
    }
  }
  ```

#### 2. Tắt các tiến trình Cloudflare Tunnel chạy ngầm bị treo:
Nếu terminal báo lỗi cổng bị chiếm dụng hoặc tunnel không nhận diện được URL:
```bash
killall cloudflared 2>/dev/null || true
```

#### 3. Xóa bộ nhớ đệm và biên dịch lại từ đầu (Clean Rebuild):
Khi nâng cấp thư viện hoặc gặp lỗi bộ nhớ đệm TypeScript:
```bash
rm -rf dist node_modules/.cache
pnpm run build
```

---

## 6. TÀI LIỆU HÓA API (SWAGGER OPENAPI 3.0)

Khi máy chủ khởi chạy thành công, tài liệu đặc tả API tương tác Swagger UI tự động phát hành tại:
- **Giao diện Swagger UI:** `http://localhost:3000/api/docs`
- **Đặc tả chuẩn OpenAPI JSON:** `http://localhost:3000/api/docs-json`
- **Truy cập từ xa bảo mật qua Cloudflare Tunnel:** `https://<your-subdomain>.trycloudflare.com/api/docs`

---

## 7. BỘ TÀI LIỆU KỸ THUẬT THAM CHIẾU (TECHNICAL REPORTS)

Để tìm hiểu sâu hơn về từng khía cạnh kiến trúc và thuật toán của hệ thống, vui lòng tham chiếu bộ 8 tệp báo cáo chuyên sâu tại thư mục [`docs/report/`](file:///home/hoa/Documents/UTH/L%E1%BA%ADp%20tr%C3%ACnh%20JS%20&%20TS/AI%20systems%20support%20detecting%20and%20handling%20data%20quality%20issues%20/docs/report/):
1. [`01_business_context_and_objectives.md`](file:///home/hoa/Documents/UTH/L%E1%BA%ADp%20tr%C3%ACnh%20JS%20&%20TS/AI%20systems%20support%20detecting%20and%20handling%20data%20quality%20issues%20/docs/report/01_business_context_and_objectives.md): Bối cảnh dự án, bài toán kinh doanh, mục tiêu định lượng.
2. [`02_system_architecture_and_tech_stack.md`](file:///home/hoa/Documents/UTH/L%E1%BA%ADp%20tr%C3%ACnh%20JS%20&%20TS/AI%20systems%20support%20detecting%20and%20handling%20data%20quality%20issues%20/docs/report/02_system_architecture_and_tech_stack.md): Kiến trúc hệ thống, bản đồ Tech Stack, an ninh giao vận.
3. [`03_polyglot_data_modeling_and_storage.md`](file:///home/hoa/Documents/UTH/L%E1%BA%ADp%20tr%C3%ACnh%20JS%20&%20TS/AI%20systems%20support%20detecting%20and%20handling%20data%20quality%20issues%20/docs/report/03_polyglot_data_modeling_and_storage.md): 10 Collections MongoDB, Đồ thị phả hệ Neo4j AuraDB DAG, Cloudflare R2.
4. [`04_modules_and_api_architecture.md`](file:///home/hoa/Documents/UTH/L%E1%BA%ADp%20tr%C3%ACnh%20JS%20&%20TS/AI%20systems%20support%20detecting%20and%20handling%20data%20quality%20issues%20/docs/report/04_modules_and_api_architecture.md): Phân rã 11 Modules, danh mục 43 Endpoints, chính sách phân quyền CASL ABAC.
5. [`05_core_mechanisms_and_cryptography.md`](file:///home/hoa/Documents/UTH/L%E1%BA%ADp%20tr%C3%ACnh%20JS%20&%20TS/AI%20systems%20support%20detecting%20and%20handling%20data%20quality%20issues%20/docs/report/05_core_mechanisms_and_cryptography.md): Streaming $\le 50\text{MB}$ RAM, chuỗi băm Merkle DAG, mã hóa AES-256-GCM, Outbox Pattern.
6. [`06_testing_and_quality_assurance.md`](file:///home/hoa/Documents/UTH/L%E1%BA%ADp%20tr%C3%ACnh%20JS%20&%20TS/AI%20systems%20support%20detecting%20and%20handling%20data%20quality%20issues%20/docs/report/06_testing_and_quality_assurance.md): 16 bộ test suites tự động, kiểm thử tĩnh AST Zero Any, kiểm thử phân quyền ABAC.
7. [`07_ai_integration_and_gemini_engine.md`](file:///home/hoa/Documents/UTH/L%E1%BA%ADp%20tr%C3%ACnh%20JS%20&%20TS/AI%20systems%20support%20detecting%20and%20handling%20data%20quality%20issues%20/docs/report/07_ai_integration_and_gemini_engine.md): Thiết kế phân hệ AI Google Gemini, chuẩn hóa Semi-structured, phát hiện dị thường 3 tầng.
8. [`08_risks_limitations_and_future_roadmap.md`](file:///home/hoa/Documents/UTH/L%E1%BA%ADp%20tr%C3%ACnh%20JS%20&%20TS/AI%20systems%20support%20detecting%20and%20handling%20data%20quality%20issues%20/docs/report/08_risks_limitations_and_future_roadmap.md): Ma trận rủi ro, điểm nghẽn hiệu năng, nợ kỹ thuật và lộ trình mở rộng tương lai.
