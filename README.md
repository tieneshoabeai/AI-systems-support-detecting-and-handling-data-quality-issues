# NỀN TẢNG FULL-STACK QUẢN LÝ & GIÁM SÁT CHẤT LƯỢNG DỮ LIỆU CÓ AI HỖ TRỢ
### (AI Systems Support Detecting and Handling Data Quality Issues)

[![TypeScript Strict](https://img.shields.io/badge/TypeScript-7.0.2_%7C_6.0_Strict-blue.svg)](https://www.typescriptlang.org/)
[![NestJS](https://img.shields.io/badge/Backend-NestJS_11-red.svg)](https://nestjs.com/)
[![Security](https://img.shields.io/badge/Security-Cloudflare_TLS_1.3_Port_443-blue.svg)](#4-công-nghệ--hạ-tầng-đám-mây-tech-stack)
[![Database](https://img.shields.io/badge/Database-MongoDB_Atlas_%7C_Kafka_%7C_Redis_%7C_R2-green.svg)](#4-công-nghệ--hạ-tầng-đám-mây-tech-stack)
[![Zero Any](https://img.shields.io/badge/Type_Safety-Zero_Any_Policy-success.svg)](#5-ràng-buộc-chất-lượng--tiêu-chuẩn-bất-biến-quality--safety-invariants)
[![License](https://img.shields.io/badge/License-Academic_Project_UTH-orange.svg)](#)

---

## 1. Định vị & Tuyên ngôn Giá trị của Hệ thống (Problem & Vision)

Trong kỷ nguyên Trí tuệ Nhân tạo và Ra quyết định dựa trên Dữ liệu (Data-Driven Decision Making), vấn đề **"Dữ liệu rác vào $\rightarrow$ Kết quả rác ra" (Garbage In, Garbage Out)** là rào cản lớn nhất của các kỹ sư và chuyên viên phân tích dữ liệu. Các vấn đề chất lượng dữ liệu phổ biến bao gồm:
- Dữ liệu bị khuyết thiếu (Missing values), dị biệt ngoài ngưỡng (Outliers), định dạng không đồng nhất.
- Thiếu công cụ truy vết nguồn gốc (Data Lineage), không biết dữ liệu lỗi bắt nguồn từ đâu và ảnh hưởng đến những hệ thống nào.
- Việc sửa đổi dữ liệu thủ công tiềm ẩn rủi ro phá hủy dữ liệu gốc, không có cơ chế khôi phục phiên bản (Data Versioning & Rollback) và không thể đối soát tính toàn vẹn (Integrity Verification).

**Hệ thống AI Hỗ trợ Phát hiện & Xử lý Vấn đề Chất lượng Dữ liệu** được xây dựng như một nền tảng tập trung (Enterprise Full-Stack Data Quality Platform) giải quyết toàn diện các thách thức trên:
1. **Tiếp nhận Dữ liệu Chỉ-Đọc:** Streaming Ingestion **`.csv` duy nhất** dung lượng lớn với mức tiêu thụ RAM $\le 20\text{ MB}$; dữ liệu bất biến — hệ thống **không sửa, xoá hay thay đổi** dòng/ô.
2. **Khám phá & Thống kê Tốc độ cao:** Lưới dữ liệu ảo (Virtual Grid) phân trang **con trỏ Keyset (cursor)** $\le 50\text{ ms}$ cho hàng triệu dòng dữ liệu — không `offset`, không `countDocuments`.
3. **AI Cục bộ — Dữ liệu Không Rời Hệ thống:** Mô hình ngôn ngữ lớn chạy **nội bộ** qua `vLLM`/`Ollama`, **không** gọi API bên ngoài. **Năm ứng viên được benchmark** (`Qwen3-14B` · `Gemma-3-12B` · `Qwen3-8B` · `Llama-3.1-8B` · `Vistral-7B`) trên **9 chỉ số** + kiểm định thống kê + đường Pareto; model chốt theo số liệu, không chốt trước.
4. **Vòng lặp Người dùng → AI (Human-in-the-Loop):** Mỗi kết quả có khối đánh giá để người dùng nhận xét; phản hồi lưu bất biến và được dùng để **AI học lại** qua RAG few-shot động.
5. **Sự kiện & Realtime:** **Kafka** làm event bus + hàng đợi nền (có dead-letter queue); **Socket.IO** đẩy thông báo và tiến độ tới client.

---

## 2. Bức tranh Tổng quan Kiến trúc Toàn diện (System Architecture)

Hệ thống được thiết kế theo mô hình **Modular Monolith** phân tầng rõ ràng, kết hợp cơ chế lưu trữ đa đám mây (Polyglot Persistence) và phân tách giao dịch bất đồng bộ qua **Transactional Outbox Pattern**:

```mermaid
graph TD
    subgraph ClientLayer ["1. Tầng Giao diện Người dùng (Presentation Layer)"]
        UI["🖥️ Web App (Vite + React / React Flow)"]
        Grid["📊 Virtual Data Grid (Keyset Cursor)"]
        DAG["🕸️ Interactive Lineage Graph (React Flow)"]
        UI --> Grid & DAG
    end

    subgraph GatewayLayer ["2. Tầng Bảo vệ & Điều phối API (API Gateway / NestJS)"]
        JWT["🛡️ JwtAuthGuard (Xác thực Phiên / Bỏ qua @Public)"]
        CASL["🔒 PoliciesGuard (Phân quyền CASL ABAC theo Workspace)"]
        ZOD["📋 ZodValidationPipe (Kiểm thực Schema & Zero Any)"]
        CTRL["🎛️ RESTful Controllers (32+ Endpoints)"]
        
        UI -->|"HTTPS (TLS 1.3 - Cổng 443) / Cloudflare Zero Trust Tunnel"| JWT
        JWT --> CASL --> ZOD --> CTRL
    end

    subgraph ServiceLayer ["3. Tầng Nghiệp vụ Cốt lõi (Core Business Modules)"]
        CTRL --> M_Auth["Auth & Users"]
        CTRL --> M_WS["Workspaces & Projects"]
        CTRL --> M_DS["Datasets (Streaming CSV Ingestion)"]
        CTRL --> M_DV["Data View (Virtual Grid & Stats)"]
        CTRL --> M_AN["Analysis & AI (Local Inference)"]
        CTRL --> M_FB["Feedback (Đánh giá & Học lại)"]
    end

    subgraph StorageLayer ["4. Hạ tầng Lưu trữ Đa mô hình (Polyglot Storage & Cloud)"]
        Mongo[("🍃 MongoDB Atlas M0/M10<br/><i>Metadata, Records, Sessions, Outbox, Feedback</i>")]
        R2[("☁️ Cloudflare R2 Storage<br/><i>Raw CSV Files, Reports</i>")]
        Kafka[("📨 Kafka (KRaft)<br/><i>domain.events · ai.jobs · realtime.push · DLQ</i>")]
        AISvc[("🧠 ai-engine (vLLM)<br/><i>5 model ứng viên + Embedding-0.6B</i>")]
    end

    subgraph AsyncWorker ["5. Phân hệ Đồng bộ Bất đồng bộ (Kafka Workers)"]
        OutboxQueue["📦 outbox_events (Transactional Outbox)"]
        Worker["⚙️ Kafka Consumers (idempotent, 6 consumer groups)"]
        Realtime["📡 Socket.IO Gateway (/api/v1/realtime)"]
    end

        M_DS & M_AN -.->|"Ghi sự kiện Domain"| OutboxQueue
        OutboxQueue --> Kafka
        Kafka --> Worker
        Kafka --> Realtime
        Worker -->|"HTTP nội bộ"| AISvc
    end

    M_Auth & M_WS & M_DV & M_FB --> Mongo
    M_DS -->|"Stream PutObject (CSV)"| R2
    M_DS -->|"bulkWrite 1.000 records"| Mongo
    M_FB -.->|"few-shot động top-5"| AISvc
```

> ❌ **Không có mũi tên dữ liệu ra Internet.** `ai-engine` chạy trong cùng Docker network và không có egress; dự án không cài bất kỳ SDK AI bên ngoài nào.

---

## 3. Bản đồ Tính năng & Phân hệ Nghiệp vụ (Feature Modules)

Hệ thống backend được phân rã thành các phân hệ nghiệp vụ độc lập, mỗi module chịu trách nhiệm duy nhất (Single Responsibility) và có tài liệu chi tiết riêng:

| Module | Vị trí Thư mục | Trách nhiệm Nghiệp vụ Cốt lõi | Tài liệu Module |
| :--- | :--- | :--- | :---: |
| **Auth** | `src/backend/src/modules/auth/` | Đăng ký, đăng nhập, cấp phát Access Token (JWT 15m) & Refresh Token (7d), băm một chiều SHA-256 cho phiên làm việc `user_sessions`, thu hồi phiên từ xa. | [Chi tiết](file:///home/hoa/Documents/UTH/L%E1%BA%ADp%20tr%C3%ACnh%20JS%20&%20TS/AI%20systems%20support%20detecting%20and%20handling%20data%20quality%20issues%20/src/backend/src/modules/auth/README.md) |
| **Users** | `src/backend/src/modules/users/` | Quản lý hồ sơ người dùng, phân tách vai trò hệ thống, chuẩn hóa xóa mềm `deleted_at: Date`, chỉ mục một phần cho phép tái sử dụng email. | [Chi tiết](file:///home/hoa/Documents/UTH/L%E1%BA%ADp%20tr%C3%ACnh%20JS%20&%20TS/AI%20systems%20support%20detecting%20and%20handling%20data%20quality%20issues%20/src/backend/src/modules/users/README.md) |
| **Workspaces** | `src/backend/src/modules/workspaces/` | Ranh giới cô lập dữ liệu cấp cao nhất (Multi-tenancy Boundary), quản lý nhóm thành viên và phân quyền theo mô hình CASL: `Owner`, `Editor`, `Viewer`. | [Chi tiết](file:///home/hoa/Documents/UTH/L%E1%BA%ADp%20tr%C3%ACnh%20JS%20&%20TS/AI%20systems%20support%20detecting%20and%20handling%20data%20quality%20issues%20/src/backend/src/modules/workspaces/README.md) |
| **Projects** | `src/backend/src/modules/projects/` | Quản lý dự án trực thuộc Workspace, thực thi ràng buộc Single Dataset (`has_dataset`) nhằm đơn giản hóa cây phả hệ dữ liệu. | [Chi tiết](file:///home/hoa/Documents/UTH/L%E1%BA%ADp%20tr%C3%ACnh%20JS%20&%20TS/AI%20systems%20support%20detecting%20and%20handling%20data%20quality%20issues%20/src/backend/src/modules/projects/README.md) |
| **Datasets** | `src/backend/src/modules/datasets/` | Cổng Ingestion Gateway đa luồng song song: **chỉ nhận `.csv`**, tính SHA-512 on-the-fly, stream upload Cloudflare R2, suy luận schema 100 dòng đầu, nạp MongoDB theo mẻ 1.000 dòng. | [Chi tiết](file:///home/hoa/Documents/UTH/L%E1%BA%ADp%20tr%C3%ACnh%20JS%20&%20TS/AI%20systems%20support%20detecting%20and%20handling%20data%20quality%20issues%20/src/backend/src/modules/datasets/README.md) |
| **Data View** | `src/backend/src/modules/data-view/` | Động cơ phân trang **Keyset Cursor** $O(1)$ $\le 50\text{ ms}$ (cursor ký HMAC, trả `nextCursor`/`hasMore`) và tính toán biểu đồ Histogram 10 khoảng qua MongoDB Aggregation `$bucket`. | [Chi tiết](file:///home/hoa/Documents/UTH/L%E1%BA%ADp%20tr%C3%ACnh%20JS%20&%20TS/AI%20systems%20support%20detecting%20and%20handling%20data%20quality%20issues%20/src/backend/src/modules/data-view/README.md) |
| **AI & Feedback** | `apps/api/src/modules/ai/`, `apps/api/src/modules/feedback/` | Suy luận **cục bộ** (5 model ứng viên qua vLLM/Ollama, chốt theo benchmark) và vòng lặp Human-in-the-Loop: thu nhận nhận xét người dùng, lưu bất biến, sinh mẫu few-shot động cho vòng lặp học lại. | [Đặc tả](file:///home/hoa/Documents/UTH/L%E1%BA%ADp%20tr%C3%ACnh%20JS%20&%20TS/AI%20systems%20support%20detecting%20and%20handling%20data%20quality%20issues%20/docs/restructures/12_processing_logic_ai_v6.md) |
| **Shared** | `src/backend/src/shared/` | Khung hạ tầng dùng chung: CASL ABAC Factory, Ambient Mongo Transaction (`AsyncLocalStorage`), S3 Quota Guard, PII Data Masking, Zod OpenAPI Bridge, BaseMongoRepository. | [Chi tiết](file:///home/hoa/Documents/UTH/L%E1%BA%ADp%20tr%C3%ACnh%20JS%20&%20TS/AI%20systems%20support%20detecting%20and%20handling%20data%20quality%20issues%20/src/backend/src/shared/README.md) |

---

## 4. Công nghệ & Hạ tầng Đám mây (Tech Stack)

### Backend & Công nghệ Lập trình
- **Ngôn ngữ:** TypeScript 5.6+ (`^5.6.3` trong `package.json`, chế độ `strict: true`, kích hoạt bắt buộc **Zero Any Policy**).
- **Khung ứng dụng (Framework):** NestJS 11 (`^11.1.21`, Kiến trúc Modular Monolith, Dependency Injection, Pipes, Interceptors, Guards).
- **Kiểm thực Dữ liệu (Validation):** Zod 3 + `zod-to-json-schema` (Tự động sinh đặc tả Swagger OpenAPI 3.0).
- **Bảo mật & Phân quyền:** Passport JWT, `@casl/ability` (Attribute-based Access Control), Bcrypt (Salt 12).
- **Mật mã học & Xử lý Luồng:** Node.js Native Crypto (AES-256-GCM, PBKDF2 100.000 vòng, **SHA-512**), `busboy`, `fast-csv` (**không dùng thư viện Excel**).
- **AI cục bộ:** `vLLM` (production) / `Ollama` (dev) — model **5 model ứng viên** `Qwen3-14B` / `Gemma-3-12B` / `Qwen3-8B` / `Llama-3.1-8B` / `Vistral-7B` (Q4_K_M / QAT), `Qwen3-Embedding-0.6B` (vector kho học lại); model chốt theo benchmark 9 chỉ số. Timeout 180s, đồng thời 1 job, RAM guard khi RSS > 85% RAM host.
- **Sự kiện & Hàng đợi:** `kafkajs` (Kafka KRaft — 5 topic, 6 consumer group, DLQ), `socket.io` + Redis adapter (realtime tại `/api/v1/realtime?token=…`).

### Hệ thống Lưu trữ Đa tầng (Multi-Database Infrastructure)
- **MongoDB Atlas (Database `test-ai-system-jsts-db`):** Lưu trữ tài liệu phi cấu trúc, metadata, bản ghi dữ liệu thô (`dataset_records`, **insert-only**), phiên làm việc, Outbox và phản hồi người dùng (`finding_feedback`, `feedback_example`).
- **Cloudflare R2 (Tương thích Amazon S3 API):** Lưu trữ tệp `.csv` gốc và các báo cáo sinh ra.
- **Kafka (KRaft single-node) + Redis 7:** Kafka làm event bus + hàng đợi nền (có dead-letter queue); Redis làm cache, rate-limit và Socket.IO adapter.
- **AI cục bộ (container `ai-engine`):** Suy luận nội bộ, **không có egress ra Internet**.
- **Hệ thống Cảnh báo SRE:** `https://ntfy.sh/AI-SYSTEM-DATA-QUALITY` (Thông báo đẩy sự cố khẩn cấp P0 tới thiết bị di động).

### Bảo mật Kênh truyền & Mạng (Transport Layer Security - TLS 1.3 & Cổng 443)
- **Cloudflare Zero Trust Tunnel (`cloudflared`):** Tạo đường hầm outbound bảo mật qua giao thức QUIC/HTTP2 nối NestJS tới mạng lưới Cloudflare Edge; xuất bản địa chỉ **HTTPS Cổng 443 thực tế** có chứng chỉ CA quốc tế hợp lệ 100% (Google Trust Services / DigiCert), hiển thị ổ khóa xanh bảo mật trên mọi trình duyệt.
- **Nhận diện Proxy Cloudflare (`trust proxy`):** Kích hoạt `app.set('trust proxy', 1)` trong NestJS, ưu tiên trích xuất IP thực từ tiêu đề `CF-Connecting-IP` và mã định danh luồng `CF-Ray` phục vụ Rate Limiting, Audit Logging và chống giả mạo IP.
- **Bảo mật Cưỡng bức (HSTS via Helmet):** Kích hoạt tiêu đề `Strict-Transport-Security: max-age=31536000; includeSubDomains; preload`, ngăn chặn hoàn toàn tấn công hạ cấp kết nối (SSL Stripping).
- **Dynamic OpenAPI Gateway:** Swagger UI tự động nhận diện URL tunnel `https://*.trycloudflare.com` trên Cổng 443 để cho phép người dùng/người chấm kiểm thử trực tiếp API qua HTTPS.

---

## 5. Ràng buộc Chất lượng & Tiêu chuẩn Bất biến (Quality & Safety Invariants)

Hệ thống được phát triển tuân thủ nghiêm ngặt các nguyên tắc kỹ thuật trong tài liệu nội bộ:

1. **Nguyên tắc Zero Any (Mục 13 WORKING RULE):**
   - Cấm tuyệt đối kiểu dữ liệu `any` trong toàn bộ mã nguồn ứng dụng, scripts và test suites (`: any`, `as any`, `<any>`, `Record<string, any>`).
   - Mọi dữ liệu không chắc chắn phải được bọc trong `unknown`, kiểm tra bằng Type Guards (`instanceof`, `typeof`) hoặc kiểm thực an toàn qua Zod (`schema.safeParse()`).
   - Tệp kiểm thử tự động [`test/zero-any.spec.ts`](file:///home/hoa/Documents/UTH/L%E1%BA%ADp%20tr%C3%ACnh%20JS%20&%20TS/AI%20systems%20support%20detecting%20and%20handling%20data%20quality%20issues%20/src/backend/test/zero-any.spec.ts) quét toàn bộ cây thư mục mã nguồn để đảm bảo không một vi phạm nào bị lọt.

2. **An toàn Truy vấn CSDL & Chống Injection (Mục 6 WORKING RULE):**
   - **MongoDB:** Bắt buộc dùng Parameterized Query / Mongoose Query Builder, tuyệt đối không nối chuỗi dữ liệu đầu vào từ người dùng.
   - **MongoDB Aggregation:** mọi bộ lọc động dùng Query Builder có tham số hóa, nghiêm cấm nối chuỗi giá trị người dùng vào pipeline.
   - **AI cục bộ:** `ai-engine` không có egress ra Internet; dữ liệu đưa vào prompt luôn được che PII trước.

3. **Bảo mật Dữ liệu Nhạy cảm (PII Masking):**
   - Tiện ích `mask-pii.ts` tự động che giấu Email (`us***@gmail.com`), Số điện thoại (`090*****67`) và Căn cước công dân trong toàn bộ log hệ thống.
   - Mật khẩu người dùng (`password_hash`) được bảo vệ bằng `select: false` ở cấp độ Schema Mongoose.

4. **Bất biến dữ liệu (Data Immutability Invariant):**
   - `dataset_record` là **insert-only**: đường ghi duy nhất là Import. Không `updateOne`, `deleteMany`, `findOneAndUpdate`, không soft-delete.
   - Giá trị thiếu / không hợp lệ chỉ bị **loại khỏi phép tính thống kê cụ thể**, không bị xoá khỏi dataset.
   - Mọi thao tác can thiệp dữ liệu trực tiếp trong database đều bị chặn bởi checker kiến trúc và quy tắc kiểm thử.

5. **Chuẩn hóa Xóa mềm (Soft Delete Invariant):**
   - Bắt buộc sử dụng `deleted_at: Date | null`. Nghiêm cấm dùng cờ boolean `is_deleted`.
   - Sử dụng MongoDB Partial Unique Index `{ partialFilterExpression: { deleted_at: null } }` để hỗ trợ tái đăng ký hoặc tái sử dụng tên tài nguyên khi bản ghi cũ đã bị xóa mềm.

6. **Bảo mật Kênh truyền An toàn (Data in Transit TLS 1.3 Invariant):**
   - 100% dữ liệu truyền qua mạng công cộng (gồm Access Token, mật khẩu, dữ liệu bảng chứa PII) bắt buộc phải được mã hóa bằng giao thức **TLS 1.3 trên Cổng 443** qua Cloudflare Edge. Cấm tuyệt đối truyền tải văn bản thô (Plaintext HTTP) trong môi trường sản phẩm.

## 6. Cấu trúc Thư mục Dự án (Project Directory Structure)

```
.
├── .agent/                      # Quy tắc và hướng dẫn cấu hình AI Agent
├── docs/                        # Tài liệu đặc tả kỹ thuật, kế hoạch Sprint và phân tích kiến trúc
│   ├── build_env.md             # Hướng dẫn thiết lập môi trường CSDL & biến .env
│   ├── feature_spec_v4.md       # Đặc tả chi tiết 9 nhóm tính năng
│   ├── report_overview_v5.md    # Báo cáo tổng quan dự án
│   └── sprint_b1..b3_plan.md    # Kế hoạch chi tiết các Sprint Backend
├── remember/                    # Quy chuẩn bắt buộc nội bộ (Module Documentation Rule, Zero Any)
│   └── module_documentation_rule.md # Quy định cấu trúc 6 phần cho README module
├── src/
│   ├── frontend/                # Thư mục mã nguồn Giao diện Người dùng (React / Vite)
│   └── backend/                 # Khung ứng dụng NestJS Backend
│       ├── package.json         # Danh mục dependencies, build scripts và test commands
│       ├── tsconfig.json        # Cấu hình TypeScript Strict Mode
│       ├── src/
│       │   ├── app.module.ts    # Root Module liên kết các phân hệ
│       │   ├── main.ts          # Điểm khởi chạy ứng dụng, cấu hình Swagger và Global Pipes
│       │   ├── modules/         # Các Module Nghiệp vụ (Auth, Users, Workspaces, Datasets, AI, Feedback...)
│       │   │   ├── auth/        # Xác thực JWT, Refresh Token & Quản lý Session
│       │   │   ├── data-view/   # Cursor Pagination (Keyset) & Histogram Aggregation
│       │   │   ├── datasets/    # Streaming CSV Upload, Ingestion Pipeline & Checksum
│       │   │   ├── projects/    # Quản lý Dự án & Ràng buộc has_dataset
│       │   │   ├── users/       # Hồ sơ Người dùng & Vòng đời tài khoản
│       │   │   └── workspaces/  # Multi-tenancy Workspace & Phân quyền CASL
│       │   └── shared/          # Khung hạ tầng dùng chung (Crypto, Storage, CASL, Swagger, DB)
│       ├── scripts/             # Scripts hỗ trợ vận hành (Bootstrap DB, Reset CSDL, Seed Data)
│       └── test/                # Bộ kiểm thử Unit Test & End-to-End Test (Jest)
└── README.md                    # Tài liệu tổng quan toàn bộ dự án (Tệp hiện tại)
```

---

## 7. Hướng dẫn Cài đặt & Vận hành (Getting Started & Operations)

### 7.1. Yêu cầu Tiên quyết (Prerequisites)
- **Node.js:** Phiên bản $\ge 20.10.0$ LTS
- **Trình quản lý gói:** `pnpm` phiên bản $\ge 9.0.0$ (Khuyến nghị sử dụng `pnpm` để tối ưu hóa bộ nhớ)
- **Tài khoản Đám mây (Đã cấu hình sẵn sàng):**
  - Cụm MongoDB Atlas (Database `test-ai-system-jsts-db`)
  - Cloudflare R2 Bucket (`test-ai-system-storage`)
  - Model AI cục bộ (Ollama ở dev: `qwen3:14b`, `qwen3:8b`, `qwen3-embedding:0.6b`)

### 7.2. Thiết lập Biến Môi trường (.env)
Sao chép tệp cấu hình mẫu và cập nhật các thông tin kết nối thực tế:
```bash
cd src/backend
cp .env.example .env
```
*(Chi tiết cấu hình từng biến môi trường được trình bày đầy đủ tại [`docs/build_env.md`](file:///home/hoa/Documents/UTH/L%E1%BA%ADp%20tr%C3%ACnh%20JS%20&%20TS/AI%20systems%20support%20detecting%20and%20handling%20data%20quality%20issues%20/docs/build_env.md)).*

### 7.3. Cài đặt Phụ thuộc & Khởi tạo CSDL
```bash
# 1. Cài đặt các gói thư viện
pnpm install

# 2. Khởi tạo Schema, Indexes và nạp dữ liệu mẫu ban đầu
pnpm run db:bootstrap

# 3. (Tùy chọn) Reset từng dịch vụ CSDL độc lập khi cần làm sạch môi trường:
# Reset chỉ MongoDB:
CONFIRM_RESET=DROP_ALL_DATA pnpm run db:reset:mongo
# Reset chỉ Cloudflare R2:
CONFIRM_RESET=DROP_ALL_DATA pnpm run db:reset:storage
```

### 7.4. Khởi chạy Ứng dụng
```bash
# Chạy ứng dụng ở chế độ Phát triển (Watch Mode):
pnpm run start:dev

# Kiểm tra an toàn kiểu dữ liệu TypeScript (Zero Any Check):
pnpm run type-check

# Chạy toàn bộ bộ kiểm thử tự động (Unit Tests & Guard Coverage):
pnpm test
```

Sau khi khởi chạy thành công, truy cập tài liệu API trực quan tại:
- **Swagger OpenAPI 3.0 UI:** `http://localhost:3000/api/v1/docs`

---

## 8. Lộ trình Phát triển & Trạng thái Dự án (Project Roadmap)

Dự án được phân kỳ thành 2 giai đoạn lớn với các Sprint phát triển rõ ràng:

### Giai đoạn 1: Nền tảng Cốt lõi Full-Stack (Core Platform MVP)
- [x] **Sprint B1 (Hạ tầng Nền tảng & Định danh):**
  - Mật mã học AES-256-GCM / SHA-512, Cloudflare R2 S3 Client với Quota Guard.
  - Phân quyền CASL ABAC đa tầng, Ambient Transaction qua `AsyncLocalStorage`.
  - Module `auth` (JWT, Refresh Token, Session Hash) và Module `users` (Soft delete, Partial Index).
- [x] **Sprint B2 (Tổ chức Không gian & Tiếp nhận Dữ liệu Thô):**
  - Module `workspaces` (Owner/Member) & Module `projects` (Ràng buộc Single Dataset).
  - Module `datasets`: Streaming Ingestion **CSV** đa luồng song song, Schema Inference 100 dòng đầu.
  - Module `data-view`: **Cursor Pagination (Keyset)** $\le 50\text{ ms}$, Histogram Aggregation.
- [ ] **Sprint B3 (Tái cấu trúc Backend — *đang thực hiện*):**
  - Viết lại toàn bộ backend theo **Ports & Adapters** trong monorepo pnpm (`apps/api`, `apps/worker`, `packages/core`, `packages/contracts`, `packages/config`).
  - Thay BullMQ bằng **Kafka** (5 topic, 6 consumer group, DLQ) và thêm **Socket.IO** realtime.
  - Bỏ các module `versions`, `cell-edit`, `clean-rules`, `lineage`, `exports` theo quyết định **dữ liệu bất biến**.
- [ ] **Sprint F1 - F4 (Giao diện Web Frontend):**
  - Phát triển giao diện React + Tailwind CSS, Virtual Data Grid, Dashboard phân tích chất lượng và cửa sổ nhận xét kết quả.

### Giai đoạn 2: Tích hợp Động cơ AI Trợ lý Thông minh (AI Copilot Integration)
- [ ] **Tier 1 — AI cục bộ + Học lại (Human-in-the-Loop):** Triển khai `ai-engine` (vLLM/Ollama) + **benchmark 5 model / 9 chỉ số** để chốt cặp model định tuyến hai tầng, module `feedback` thu nhận nhận xét người dùng, kho `feedback_example` và cơ chế RAG few-shot động.
- [ ] **Tier 2 Anomaly Detection:** Tích hợp học máy không giám sát phát hiện ngoại lai phân phối (chạy cục bộ, không dùng dịch vụ ngoài).
- [ ] **Tier 3 Benchmark & Tinh chỉnh:** Bộ benchmark **5 model × 9 chỉ số** (F1 micro/macro, JSON, ảo giác, chất lượng giải thích, p95, throughput, RSS, độ ổn định) với McNemar/Wilcoxon + đường Pareto; đánh giá A/B hiệu quả few-shot; định kỳ chạy lại để chống hồi quy chất lượng.

---

## 9. Đội ngũ Phát triển & Giảng viên Hướng dẫn

- **Đơn vị Đào tạo:** Trường Đại học Giao thông Vận tải TP.HCM (UTH) - Khoa Công nghệ Thông tin.
- **Học phần:** Lập trình JavaScript & TypeScript Nâng cao.
- **Đề tài:** Hệ thống AI Hỗ trợ Phát hiện và Xử lý Vấn đề về Chất lượng Dữ liệu.
- **Nhóm Sinh viên Thực hiện:** Tienes Hoa & Đội ngũ Phát triển.
