# BÁO CÁO 02: KIẾN TRÚC HỆ THỐNG VÀ BẢN ĐỒ NGĂN XẾP CÔNG NGHỆ
## HỆ THỐNG AI HỖ TRỢ PHÁT HIỆN VÀ XỬ LÝ VẤN ĐỀ CHẤT LƯỢNG DỮ LIỆU
### (Full-Stack Data Quality Management Platform with AI Assistance)

---

## 1. TỔNG QUAN KIẾN TRÚC HỆ THỐNG TOÀN CẢNH (SYSTEM ARCHITECTURE)

Hệ thống được thiết kế theo mô hình **Kiến trúc Phân tầng Theo Module (Layered Modular Architecture)**, kết hợp các nguyên tắc cốt lõi của **Clean Architecture** và mô hình đồng bộ hướng sự kiện bất đồng bộ **Event-Driven Outbox Pattern**. Toàn bộ mã nguồn backend được cấu trúc hóa nhằm đảm bảo khả năng mở rộng (Scalability), độ ổn định bộ nhớ và tuân thủ các chuẩn mực an toàn thông tin doanh nghiệp.

```
+-----------------------------------------------------------------------------------------+
|                                    CLIENT TIER                                          |
|            Web Browser / Single Page App / Postman / Swagger OpenAPI Clients            |
+-----------------------------------------------------------------------------------------+
                                           │
                                           │ HTTPS (TLS 1.3 - Cổng 443)
                                           ▼
+-----------------------------------------------------------------------------------------+
|                           NETWORK & TRANSPORT SECURITY TIER                             |
|          Cloudflare Zero Trust Tunnel (QUIC / UDP) + Cloudflare Global Edge             |
|          Reverse Proxy Trust / HSTS Preload / Helmet Protection / Dynamic CORS          |
+-----------------------------------------------------------------------------------------+
                                           │
                                           │ HTTP/1.1 (Reverse Proxy Loopback)
                                           ▼
+-----------------------------------------------------------------------------------------+
|                             API GATEWAY & PIPELINE TIER                                 |
|                         NestJS 11 + Express Platform Engine                             |
|  ┌───────────────────┬───────────────────┬────────────────────┬──────────────────────┐  |
|  │ ThrottlerGuard    │ JwtAuthGuard      │ PoliciesGuard      │ AllExceptionsFilter  │  |
|  │ (Rate Limiting)   │ (JWT Xác thực)    │ (CASL ABAC)        │ (Phân cấp Logging)   │  |
|  ├───────────────────┴───────────────────┴────────────────────┴──────────────────────┤  |
|  │                     ZodValidationPipe (Zero Any Validation)                       │  |
|  └───────────────────────────────────────────────────────────────────────────────────┘  |
+-----------------------------------------------------------------------------------------+
                                           │
                                           ▼
+-----------------------------------------------------------------------------------------+
|                               CORE APPLICATION MODULES                                  |
|  ┌───────────────────┬───────────────────┬────────────────────┬──────────────────────┐  |
|  │ Auth & Users      │ Workspaces & Proj │ Datasets & Profiler│ Data View Grid       │  |
|  │ (JWT / Device UA) │ (CASL ABAC Model) │ (Busboy Streaming) │ (Keyset Pagination)  │  |
|  ├───────────────────┼───────────────────┼────────────────────┼──────────────────────┤  |
|  │ Clean Rules Engine│ Data Lineage      │ Cryptographic Audit│ AI Engine Subsystem  │  |
|  │ (Validator Engine)│ (Graph DAG Neo4j) │ (Merkle SHA-256)   │ (Google Gemini API)  │  |
|  └───────────────────┴───────────────────┴────────────────────┴──────────────────────┘  |
+-----------------------------------------------------------------------------------------+
                                           │
                                           ▼
+-----------------------------------------------------------------------------------------+
|                         PERSISTENCE & POLYGLOT STORAGE TIER                             |
|  ┌───────────────────────┬─────────────────────────┬─────────────────────────────────┐  |
|  │    MongoDB Atlas      │      Neo4j AuraDB       │         Cloudflare R2           │  |
|  │  (Document CSDL v8)   │   (Graph Database v5)   │  (S3-Compatible Object Storage) │  |
|  │ Users, Metadata, Rows │   Lineage DAG, Trace    │   Raw Datasets, Exported Files  │  |
|  └───────────────────────┴─────────────────────────┴─────────────────────────────────┘  |
+-----------------------------------------------------------------------------------------+
```

---

## 2. NGÔN NGỮ LẬP TRÌNH VÀ MÔI TRƯỜNG THỰC THI (RUNTIME & LANGUAGES)

### 2.1. Ngôn ngữ Lập trình: TypeScript
- **Phiên bản trình biên dịch:** `npm:@typescript/typescript6@6.0.2` (TypeScript 6.0 Strict) song hành cùng `@typescript/native@7.0.2` (TypeScript 7.0 Native Tooling).
- **Cấu hình Trình biên dịch (`tsconfig.json`):**
  - `target`: `ES2022`
  - `module`: `commonjs`
  - `strict`: `true` (Kích hoạt toàn bộ các cờ kiểm tra tĩnh khắt khe nhất)
  - `noImplicitAny`: `true`
  - `strictNullChecks`: `true`
  - `strictFunctionTypes`: `true`
- **Nguyên tắc "Zero Any" (Tuyệt đối không dùng `any`):**
  - Toàn bộ codebase (mã nguồn ứng dụng, scripts, và test suites) không chứa bất kỳ khai báo `: any`, `as any`, `<any>` hay `Record<string, any>`.
  - Khối `try...catch` bắt buộc xử lý kiểu an toàn: `catch (err: unknown)` và thu hẹp kiểu bằng Type Guard (`err instanceof Error ? err.message : String(err)`).
  - Dữ liệu chưa xác định cấu trúc bắt buộc dùng `unknown`, Generics `<T>`, hoặc Zod Schema Inference (`z.infer<typeof Schema>`).

### 2.2. Môi trường Thực thi: Node.js Runtime
- **Phiên bản:** `v22.22.3 LTS` (Long Term Support).
- **Động cơ:** Google V8 JavaScript Engine.
- **Tính năng khai thác:**
  - Native Crypto Module (tính toán hàm băm SHA-256, sinh chuỗi ngẫu nhiên bảo mật, dẫn xuất khóa PBKDF2).
  - Native Stream Pipeline (xử lý dòng nhị phân cho các tập tin dữ liệu lớn, kiểm soát bộ nhớ RAM $\le 50\text{MB}$).
  - AsyncLocalStorage (truyền tải ClientSession Context xuyên suốt các tầng nghiệp vụ mà không cần truyền tham số thủ công).

### 2.3. Trình Quản lý Gói: pnpm
- **Phiên bản:** `11.3.0`.
- **Cơ chế:** Content-addressable storage kết hợp hard link và symlink, giúp cô lập `node_modules`, loại bỏ tình trạng Phantom Dependencies và tiết kiệm dung lượng đĩa tối đa.

---

## 3. FRAMEWORK VÀ KIẾN TRÚC BACKEND (NESTJS & EXPRESS PLATFORM)

### 3.1. Danh mục Thư viện & Phiên bản Cốt lõi
- **`@nestjs/core` (`11.2.8`):** Động cơ điều phối Dependency Injection, vòng đời module và router resolving.
- **`@nestjs/common` (`11.2.8`):** Chứa toàn bộ Decorator, Pipes, Filters, Guards và Interface chuẩn.
- **`@nestjs/platform-express` (`11.2.8`):** Adapter tích hợp tầng HTTP engine Express.
- **`@types/express` (`5.0.6`):** Định kiểu kiểu dữ liệu chặt chẽ cho Request, Response.
- **`@nestjs/config` (`4.0.4`):** Module quản lý biến môi trường tích hợp thẩm định Zod schema.
- **`dotenv` (`16.6.1`):** Đọc và nạp các tệp cấu hình `.env`.
- **`@nestjs/throttler` (`6.7.1`):** Module kiểm soát lưu lượng request (Rate Limiting), bảo vệ các endpoint nhạy cảm (như `/auth/login`, `/auth/register`) khỏi nguy cơ tấn công Brute Force.

### 3.2. Triết lý Tổ chức Codebase: Clean Modular Architecture
Hệ thống kết hợp chặt chẽ 2 nguyên tắc kiến trúc:
1. **Phân rã theo Module (Modular Architecture):** Mỗi miền nghiệp vụ (`auth`, `workspaces`, `datasets`, `lineage`...) là một hộp đen độc lập, chỉ chia sẻ tính năng thông qua mảng `exports` của module.
2. **Quy tắc Phụ thuộc (The Dependency Rule trong Clean Architecture):** Lõi nghiệp vụ (Domain Logic) như thuật toán băm Merkle, quy tắc làm sạch dữ liệu không phụ thuộc vào công nghệ CSDL hay Framework cụ thể, sẵn sàng cho việc kiểm thử tự động (Unit Testable).

---

## 4. BẢN ĐỒ NGĂN XẾP CÔNG NGHỆ CHÍNH (TECH STACK MAP)

| Phân hệ / Trách nhiệm | Công nghệ / Thư viện | Phiên bản | Vai trò & Lý do lựa chọn kỹ thuật |
|---|---|:---:|---|
| **Ngôn ngữ lập trình** | TypeScript Native | `7.0.2` / `6.0.2` | Đảm bảo an toàn kiểu tĩnh toàn diện, loại bỏ lỗi thời gian chạy |
| **Môi trường thực thi** | Node.js Runtime | `v22.22.3 LTS` | Hiệu năng xử lý bất đồng bộ cao, tích hợp native Streams và Crypto |
| **Quản lý gói** | pnpm | `11.3.0` | Cô lập dependencies, tiết kiệm dung lượng và tránh xung đột gói |
| **Framework Backend** | NestJS | `11.2.8` | Kiến trúc module doanh nghiệp, hỗ trợ Dependency Injection mạnh mẽ |
| **Cơ sở dữ liệu Document** | MongoDB Atlas / Mongoose | `8.10.1` | Lưu trữ linh hoạt Metadata, User Profiles và hàng triệu bản ghi Records |
| **Cơ sở dữ liệu Graph** | Neo4j AuraDB / neo4j-driver | `5.28.1` | Truy vết đồ thị Directed Acyclic Graph (DAG) cho phả hệ dữ liệu |
| **Lưu trữ Đối tượng Đám mây** | Cloudflare R2 / AWS S3 SDK | `3.750.0` | Lưu trữ tệp thô, snapshot CSV và bản mã hóa không tốn phí Egress |
| **Xác thực đầu vào** | Zod | `3.25.76` | Thẩm định Schema kiểu tĩnh khắt khe, tự động suy luận TypeScript types |
| **Phân quyền truy cập** | @casl/ability | `7.0.2` | Kiểm soát truy cập dựa trên thuộc tính **ABAC** hạt mịn |
| **Mật mã học & Băm mật khẩu** | Argon2 / Crypto Native | `0.41.1` | Chống tấn công dò mật khẩu qua GPU; băm SHA-256 Merkle Chain |
| **Mã hóa luồng dữ liệu** | AES-256-GCM + PBKDF2 | Node Crypto | Mã hóa xác thực authenticated encryption cho tệp xuất khẩu |
| **Xử lý luồng Multipart** | Busboy / fast-csv | `1.0.0` / `5.0.2` | Phân giải và định dạng dữ liệu dạng Stream, kiểm soát RAM $\le 50\text{MB}$ |
| **Tài liệu hóa API tự động** | OpenAPI 3.0 / Swagger | `11.0.4` | Tự động tạo Swagger UI và đặc tả JSON tương thích Postman |
| **Kiểm thử phần mềm** | Jest / Supertest | `29.7.0` / `7.0.0` | Kiểm thử đơn vị, kiểm thử tích hợp API và kiểm thử ma trận CASL ABAC |
| **Hạ tầng Mạng & Bảo mật** | Cloudflare Zero Trust Tunnel | Quick QUIC | Cung cấp kết nối HTTPS TLS 1.3 cổng 443 an toàn mà không cần mở port modem |

---

## 5. HẠ TẦNG KÊNH TRUYỀN VÀ BẢO MẬT GIAO VẬN (TRANSPORT SECURITY)

### 5.1. Cloudflare Zero Trust Tunnel (TLS 1.3 - Cổng 443)
- **Cơ chế vận hành:** 
  Hệ thống sử dụng tiến trình `cloudflared` tạo một đường hầm mã hóa bảo mật ra thế giới bên ngoài thông qua giao thức **QUIC / UDP**. Toàn bộ lưu lượng truy cập từ Internet đi qua mạng lưới phân tán toàn cầu của Cloudflare (Cloudflare Global Anycast Edge), nơi thực hiện các tác vụ:
  - Chấm dứt TLS (TLS Termination) tại biên mạng với chứng chỉ hợp lệ.
  - Chống tấn công từ chối dịch vụ phân tán (DDoS Protection).
  - Tự động chuyển đổi giao thức sang HTTP/1.1 chuyển tiếp về cổng nội bộ `localhost:3000`.
- **Lợi ích an ninh:**
  - Không cần mở bất kỳ cổng nào (No Port Forwarding) trên modem/router mạng nội bộ, loại bỏ nguy cơ bị máy quét mạng phát hiện.
  - Che giấu hoàn toàn địa chỉ IP thực của máy chủ lưu trữ.

### 5.2. Các Lớp Bảo vệ Tầng HTTP Pipeline
- **HTTP Strict Transport Security (HSTS):** Ép buộc mọi trình duyệt chỉ được giao tiếp qua HTTPS với cấu hình `max-age=31536000; includeSubDomains; preload`.
- **Helmet Middleware:** Loại bỏ header `X-Powered-By`, kích hoạt `X-Content-Type-Options: nosniff`, `X-Frame-Options: SAMEORIGIN` chống Clickjacking và MIME-sniffing.
- **Dynamic CORS Policy:** Kiểm soát danh sách trắng (Whitelist) các tên miền được phép gọi API, ngăn chặn các cuộc tấn công Cross-Origin từ các trang web giả mạo.
- **Reverse Proxy Trust:** Cấu hình `app.set('trust proxy', 1)` giúp hệ thống đọc chính xác IP thực của người dùng từ header `X-Forwarded-For` phục vụ việc nhận diện thiết bị và Rate Limiting.
