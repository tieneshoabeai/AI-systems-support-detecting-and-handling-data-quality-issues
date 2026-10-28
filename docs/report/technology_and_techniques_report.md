# BÁO CÁO KỸ THUẬT VÀ CÔNG NGHỆ TOÀN DIỆN
## HỆ THỐNG AI HỖ TRỢ PHÁT HIỆN VÀ XỬ LÝ VẤN ĐỀ CHẤT LƯỢNG DỮ LIỆU
### (Full-Stack Data Quality Management & Remediation Platform with AI Assistance)

---

## 1. TỔNG QUAN KIẾN TRÚC KỸ THUẬT (ARCHITECTURE OVERVIEW)

Hệ thống được thiết kế theo mô hình **Kiến trúc Phân tầng Theo Module (Layered Modular Architecture)**, kết hợp các nguyên lý **Clean Architecture** và mô hình bất đồng bộ **Event-Driven Outbox Pattern**. Toàn bộ mã nguồn backend được tổ chức có tính mở rộng cao (high scalability), khả năng chịu tải tốt và tuân thủ các chuẩn mực an toàn thông tin doanh nghiệp.

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
|  │ Rate Limiter Pipe │ ZodValidationPipe │ Transform & Log    │ AllExceptionsFilter  │  |
|  │ (Throttler 6.7.1) │ (Zod 3.25.76)     │ Interceptors       │ (Tiered Logging)     │  |
|  └───────────────────┴───────────────────┴────────────────────┴──────────────────────┘  |
+-----------------------------------------------------------------------------------------+
                                           │
                                           ▼
+-----------------------------------------------------------------------------------------+
|                               CORE APPLICATION MODULES                                  |
|  ┌───────────────────┬───────────────────┬────────────────────┬──────────────────────┐  |
|  │ Auth & Users      │ Workspaces & Proj │ Datasets & Profiler│ Data View Grid       │  |
|  │ (JWT / Device UA) │ (RBAC / CASL 7)   │ (Busboy Streaming) │ (Virtual Pagination) │  |
|  ├───────────────────┼───────────────────┼────────────────────┼──────────────────────┤  |
|  │ Clean Rules Engine│ Data Lineage      │ Cryptographic Audit│ AI Engine Integration│  |
|  │ (Validator Engine)│ (Graph DAG Neo4j) │ (Merkle SHA-256)   │ (Google Gemini API)  │  |
|  └───────────────────┴───────────────────┴────────────────────┴──────────────────────┘  |
+-----------------------------------------------------------------------------------------+
                                           │
                                           ▼
+-----------------------------------------------------------------------------------------+
|                              PERSISTENCE & STORAGE TIER                                 |
|  ┌───────────────────────┬─────────────────────────┬─────────────────────────────────┐  |
|  │    MongoDB Atlas      │      Neo4j AuraDB       │         Cloudflare R2           │  |
|  │  (Document CSDL v9)   │   (Graph Database v5)   │  (S3-Compatible Object Storage) │  |
|  │ Users, Metadata, Rows │   Lineage DAG, Trace    │   Raw Datasets, Exported Files  │  |
|  └───────────────────────┴─────────────────────────┴─────────────────────────────────┘  |
+-----------------------------------------------------------------------------------------+
```

---

## 2. NGÔN NGỮ LẬP TRÌNH & MÔI TRƯỜNG THỰC THI (RUNTIME & LANGUAGES)

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
  - Native Crypto Module (tính toán hàm băm SHA-256 và sinh chuỗi ngẫu nhiên bảo mật).
  - Native Stream Pipeline (xử lý dòng nhị phân cho các tập tin dữ liệu lớn).
  - Chuẩn ECMAScript 2024+ hỗ trợ cấu trúc dữ liệu hiện đại và tối ưu hóa bộ nhớ heap.

### 2.3. Trình Quản lý Gói: pnpm
- **Phiên bản:** `11.3.0`.
- **Cơ chế:** Content-addressable storage kết hợp hard link và symlink, giúp cô lập `node_modules`, loại bỏ tình trạng Phantom Dependencies và tiết kiệm dung lượng đĩa tối đa.

---

## 3. FRAMEWORK & KIẾN TRÚC BACKEND (NESTJS & EXPRESS PLATFORM)

### 3.1. Danh mục Thư viện & Phiên bản Cốt lõi
- **`@nestjs/core`:** `11.2.8` — Động cơ điều phối Dependency Injection, vòng đời module và router resolving.
- **`@nestjs/common`:** `11.2.8` — Chứa toàn bộ Decorator, Pipes, Filters, Guards và Interface chuẩn.
- **`@nestjs/platform-express`:** `11.2.8` — Adapter tích hợp tầng HTTP engine Express.
- **`@types/express`:** `5.0.6` — Định kiểu kiểu dữ liệu chặt chẽ cho Request, Response.
- **`@nestjs/config`:** `4.0.4` — Module quản lý biến môi trường tích hợp thẩm định Zod schema.
- **`dotenv`:** `16.6.1` — Đọc và nạp các tệp `.env`, `.env.example`.
- **`@nestjs/throttler`:** `6.7.1` — Module kiểm soát lưu lượng request (Rate Limiting), bảo vệ các endpoint nhạy cảm (như `/auth/login`, `/auth/register`) khỏi nguy cơ tấn công từ chối dịch vụ (DoS) hoặc dò mật khẩu (Brute Force).
- **`rxjs`:** `7.8.2` — Xử lý các luồng dữ liệu bất đồng bộ (Observables/Pipelines) trong Interceptors.
- **`reflect-metadata`:** `0.2.2` — Hỗ trợ reflection và metadata decorators của TypeScript.

### 3.2. Các Thành phần Kiến trúc Đã Được Chuẩn Hóa
1. **Interceptors:**
   - `TransformInterceptor`: Tự động bao bọc dữ liệu phản hồi theo format RESTful chuẩn doanh nghiệp:
     ```json
     {
       "success": true,
       "data": { ... },
       "timestamp": "2026-10-27T10:00:00.000Z"
     }
     ```
   - `LoggingInterceptor`: Đo lường chính xác thời gian xử lý (Execution Time tính bằng milliseconds) và ghi log mọi request đến hệ thống.
2. **Filters (Xử lý Ngoại lệ):**
   - `AllExceptionsFilter`: Bộ lọc toàn cục phân tầng thông minh (theo tiêu chuẩn Observability):
     - **Lỗi 5xx (Lỗi hệ thống):** Ghi log mức `ERROR` kèm toàn bộ Stack Trace để điều tra lỗi.
     - **Lỗi 4xx (Lỗi phía người dùng):** Ghi log mức `WARN` một dòng ngắn gọn, không spam Stack Trace.
     - **Request tĩnh ngầm (`/favicon.ico`):** Bỏ qua hoàn toàn, giữ log terminal luôn sạch sẽ.
3. **Pipes:**
   - `ZodValidationPipe`: Đón bắt payload đầu vào, đối soát với Zod Schema và chuyển đổi lỗi `ZodError` thành thông điệp tiếng Việt thân thiện.
4. **Guards:**
   - `JwtAuthGuard`: Xác thực chữ ký số của JWT Token.
   - `Public` Decorator: Bỏ qua kiểm tra JWT cho các endpoint mở (như `/auth/login`, `/auth/register`, `/health`).

---

## 4. HỆ THỐNG CƠ SỞ DỮ LIỆU & LƯU TRỮ ĐA TẦNG (MULTI-TIER STORAGE)

Hệ thống kết hợp 3 mô hình cơ sở dữ liệu chuyên biệt để phục vụ tối ưu cho từng loại dữ liệu:

```
                  ┌────────────────────────────────────────────────────────┐
                  │                 HỆ THỐNG LƯU TRỮ ĐA TẦNG               │
                  └───────────────────────────┬────────────────────────────┘
                                              │
         ┌────────────────────────────────────┼────────────────────────────────────┐
         ▼                                    ▼                                    ▼
┌──────────────────┐                ┌──────────────────┐                ┌──────────────────┐
│  MongoDB Atlas   │                │   Neo4j AuraDB   │                │  Cloudflare R2   │
│  (Document DB)   │                │   (Graph DB)     │                │ (Object Storage) │
├──────────────────┤                ├──────────────────┤                ├──────────────────┤
│ - Users, Session │                │ - Data Lineage   │                │ - Raw CSV/JSON   │
│ - Workspaces     │                │ - Pipeline DAG   │                │ - Large Parquet  │
│ - Grid Cell Data │                │ - Cypher Queries │                │ - Export Files   │
│ - Audit Records  │                │ - Trace Root     │                │ - Zero Egress    │
└──────────────────┘                └──────────────────┘                └──────────────────┘
```

### 4.1. Cơ sở Dữ liệu Tài liệu: MongoDB Atlas (Cloud Cluster)
- **Thư viện kết nối:** `mongoose@9.11.3` và `@nestjs/mongoose@11.0.4`.
- **Mục đích:** Lưu trữ các thực thể nghiệp vụ có cấu trúc linh hoạt (Unstructured & Semi-structured data):
  - `users`: Thông tin người dùng, mật khẩu băm bcrypt, vai trò (role).
  - `sessions`: Phiên đăng nhập đa thiết bị, refresh token băm SHA-256, User-Agent, địa chỉ IP.
  - `workspaces` & `projects`: Cây phân cấp không gian làm việc.
  - `datasets`: Thông tin metadata của tập dữ liệu (tổng dòng, tổng cột, loại tệp, storage key).
  - `data_grid_cells`: Lưu trữ từng ô dữ liệu ảo cho phép xem phân trang và chỉnh sửa trực tiếp.
  - `clean_rules`: Các định nghĩa quy tắc kiểm tra chất lượng (missing check, regex check, range check).
  - `audit_events` & `outbox_events`: Lịch sử kiểm toán và hàng đợi đồng bộ sự kiện.
- **Tối ưu hóa Index:** Thiết lập Compound Index (`workspace_id + name`), Unique Index (`email`), và TTL Index (tự động xóa session hết hạn).

### 4.2. Cơ sở Dữ liệu Đồ thị: Neo4j AuraDB (Cloud Instance)
- **Thư viện kết nối:** `neo4j-driver@5.28.3` (Giao thức Bolt nhị phân mã hóa TLS).
- **Mục đích:** Quản lý phả hệ dòng dõi dữ liệu (**Data Lineage Directed Acyclic Graph - DAG**):
  - Khi một tập dữ liệu được nạp vào, tạo Node `(:Dataset {id, name, created_at})`.
  - Khi một quy tắc làm sạch hoặc biến đổi được áp dụng, tạo Node `(:Rule)` và `(:Version)`.
  - Tạo các liên kết có hướng: `(source:Dataset)-[:TRANSFORMED_BY]->(rule:Rule)-[:PRODUCED]->(target:Dataset)`.
- **Ngôn ngữ truy vấn:** **Cypher**. Hỗ trợ truy vấn đệ quy tìm kiếm toàn bộ chuỗi nguồn gốc phát sinh dữ liệu (Root Cause Analysis).

### 4.3. Lưu trữ Đối tượng Đám mây: Cloudflare R2
- **Thư viện kết nối:** `@aws-sdk/client-s3@3.1152.0` và `@aws-sdk/lib-storage@3.1152.0`.
- **Chuẩn giao tiếp:** S3-Compatible API kết nối tới Endpoint Cloudflare R2 qua HTTPS Cổng 443.
- **Đặc điểm nổi trội:** **Zero Egress Fees** (Hoàn toàn miễn phí cước tải dữ liệu ra Internet), giúp hệ thống nạp và xuất các tập dữ liệu dung lượng lớn (hàng trăm MB đến hàng GB) mà không phát sinh chi phí băng thông đắt đỏ như AWS S3.
- **Cơ chế Upload:** Khai thác `Upload` class từ `@aws-sdk/lib-storage` để thực hiện **Multipart Upload** dạng streaming buffer, chia nhỏ tệp thành các part 5MB để truyền song song.

### 4.4. Cơ chế Lưu trữ Dự phòng Cục bộ (Local Fallback Storage)
- **Cơ chế:** Khi biến môi trường Cloudflare R2 chưa được cấu hình hoặc gặp sự cố mạng, `StorageService` tự động chuyển sang lưu trữ tệp tin tại thư mục nội bộ `/storage` bằng Node.js `fs` streams, đảm bảo hệ thống không bao giờ bị dừng hoạt động (High Availability).

---

## 5. THẨM ĐỊNH DỮ LIỆU & AN TOÀN KIỂU RUNTIME (VALIDATION WITH ZOD)

### 5.1. Thư viện Sử dụng
- **`zod`:** `3.25.76` — Thư viện Schema Validation hàng đầu cho TypeScript.
- **`zod-to-json-schema`:** `3.25.2` — Cầu nối chuyển đổi Zod Schema sang chuẩn JSON Schema / OpenAPI 3.0.

### 5.2. Kỹ thuật "Single Source of Truth" (Một Nguồn Chân lý Duy nhất)
Hệ thống loại bỏ hoàn toàn việc sử dụng song song `class-validator` và `class-transformer` (vốn dễ gây lọt lỗi do phụ thuộc vào metadata reflection thử nghiệm). Thay vào đó:
1. Định nghĩa Zod Schema cho dữ liệu nghiệp vụ:
   ```typescript
   export const LoginSchema = z.object({
     email: EmailSchema,
     password: z.string().min(1, 'Mật khẩu không được để trống'),
     device_name: z.string().optional(),
   });
   ```
2. Tự động suy diễn kiểu TypeScript tĩnh (Static Type Inference):
   ```typescript
   export type LoginDto = z.infer<typeof LoginSchema>;
   ```
3. Kết nối với Swagger OpenAPI thông qua Custom Decorator `@ApiZodBody(LoginSchema)`:
   - Tự động tạo tài liệu Request Body và Example trực quan trên Swagger UI mà không cần viết lại `@ApiProperty()` thủ công.

---

## 6. BẢO MẬT KÊNH TRUYỀN & MẠNG (TLS 1.3 & CỔNG 443)

Hệ thống áp dụng toàn diện nguyên tắc **Bảo vệ Dữ liệu Khi Đang Truyền (Data in Transit Invariant)**:

### 6.1. Giao thức Bảo mật: TLS 1.3 trên Cổng 443
- Tuân thủ tiêu chuẩn **RFC 8446**, sử dụng các thuật toán mã hóa hiện đại nhất (AES-256-GCM, ChaCha20-Poly1305, Elliptic Curve Diffie-Hellman Ephemeral - ECDHE).
- Loại bỏ hoàn toàn các lỗ hổng của các phiên bản cũ (SSL 3.0, TLS 1.0, TLS 1.1).

### 6.2. Công nghệ Cloudflare Zero Trust Tunnel
- **Phiên bản binary:** `cloudflared` `2026.10.3` (Kiến trúc `linux_amd64`, built with Go 1.27.3).
- **Cơ chế hoạt động:**
  - Thiết lập đường hầm mã hóa **QUIC (HTTP/3 trên nền UDP)** từ máy chủ nội bộ tới mạng lưới Cloudflare Global Edge (kết nối trực tiếp tới các cụm máy chủ Hong Kong `hkg01`, `hkg11`, `hkg13`).
  - Toàn bộ lưu lượng Internet từ người dùng truy cập vào Cổng 443 HTTPS được Cloudflare Edge kiểm tra, gắn chứng chỉ số CA quốc tế hợp lệ (Google Trust Services / DigiCert) rồi chuyển tiếp an toàn qua đường hầm.
  - **Lợi ích an ninh:** Máy chủ backend **không cần mở cổng port-forwarding trên Router**, không cần địa chỉ IP tĩnh công khai (Public IP) và hoàn toàn miễn nhiễm với các đòn tấn công quét cổng (Port Scanning) hoặc DDoS trực tiếp vào hạ tầng nội bộ.

### 6.3. Cấu hình Bảo vệ HTTP & Proxy
- **`helmet`:** `8.3.0` — Kích hoạt bộ tiêu đề bảo mật nâng cao:
  - `Strict-Transport-Security: max-age=31536000; includeSubDomains; preload` (Ép buộc trình duyệt chỉ được dùng HTTPS trong vòng ít nhất 1 năm).
  - `Content-Security-Policy`: Ngăn chặn tấn công chèn mã độc (XSS).
  - `X-Content-Type-Options: nosniff`: Ngăn chặn tấn công đánh tráo kiểu MIME.
  - `X-Frame-Options: SAMEORIGIN`: Chống tấn công Clickjacking.
- **Trust Proxy Configuration:** 
  - Kích hoạt `app.set('trust proxy', 1)` trong Express để nhận diện chính xác giao thức thực tế (`X-Forwarded-Proto: https`) và trích xuất đúng địa chỉ IP thực của người dùng thông qua header `CF-Connecting-IP`.
- **CORS Whitelist:** Cấu hình regex thông minh tự động chấp nhận kết nối từ các frontend local (`localhost:5173`, `localhost:3001`) và toàn bộ các miền tunnel `*.trycloudflare.com` kèm cờ `credentials: true`.

### 6.4. Chứng chỉ SSL/TLS Nội bộ Dự phòng (Native HTTPS)
- Script `scripts/generate-ssl-certs.sh` sử dụng OpenSSL để sinh cặp khóa X.509 RSA-2048 / SAN cho `localhost:8443` (`certs/privkey.pem`, `certs/fullchain.pem`) với quyền tệp nghiêm ngặt `chmod 600`, cho phép chạy HTTPS native nội bộ khi không có Internet.

---

## 7. XÁC THỰC, PHÂN QUYỀN & MÃ HÓA (AUTH & CRYPTOGRAPHY)

### 7.1. Cơ chế Xác thực JWT (JSON Web Token)
- **Thư viện:** `@nestjs/jwt@11.0.2`, `passport@0.7.0`, `passport-jwt@4.0.1`, `@types/passport-jwt@4.0.1`.
- **Mô hình Dual-Token:**
  - **Access Token:** Ký bằng thuật toán `HS256`, thời hạn sống ngắn (15 phút). Chứa payload thông tin người dùng (`sub`, `email`, `role`, `sessionId`).
  - **Refresh Token:** Chuỗi ngẫu nhiên 40-byte cryptographically secure (`crypto.randomBytes(40)`), thời hạn sống 7 ngày.
  - **Lưu trữ An toàn:** Refresh Token trước khi lưu vào MongoDB bắt buộc phải được băm bằng hàm **SHA-256 Buffer**. Khi người dùng gửi Refresh Token lên, hệ thống băm chuỗi nhận được rồi đối soát trong CSDL (chống rủi ro rò rỉ token nếu database bị xâm nhập).

### 7.2. Mã hóa Băm Mật khẩu
- **Thư viện:** `bcrypt@5.1.1` (`@types/bcrypt@5.0.2`).
- **Thuật toán:** Adaptive Blowfish-based key derivation.
- **Độ phức tạp (Salt Rounds):** `12` rounds (thời gian tính toán tối ưu chống vét cạn brute-force trên phần cứng GPU hiện đại).

### 7.3. Chuỗi Băm Mật Mã Kiểm Toán (Cryptographic Merkle Audit Chaining)
- **Công nghệ:** Node.js Native `crypto` module, thuật toán `SHA-256`.
- **Nguyên lý:**
  - Mỗi khi một tập dữ liệu hoặc phiên bản mới được chỉnh sửa, hệ thống tạo một bản ghi Version chứa:
    $$\text{current\_hash} = \text{SHA256}(\text{dataset\_id} + \text{data\_payload} + \text{prev\_hash} + \text{timestamp})$$
  - Liên kết `prev_hash` trỏ về phiên bản trước đó tạo thành một chuỗi **Merkle Chain**.
  - Bất kỳ hành vi sửa đổi lén dữ liệu trong quá khứ sẽ làm sai lệch toàn bộ chuỗi băm tiếp theo, biến hệ thống thành một sổ cái kiểm toán **bất biến và có thể phát hiện gian lận (Tamper-evident Audit Trail)**.

### 7.4. Phân Quyền Thuộc Tính Hạt Mịn (ABAC) với CASL
- **Thư viện:** `@casl/ability@7.0.2`.
- **Ma trận Quyền hạn:**
  - **Admin:** Toàn quyền quản trị hệ thống (`manage: all`).
  - **Manager:** Quản lý không gian làm việc, tạo dự án, duyệt quy tắc làm sạch.
  - **Analyst:** Tải dữ liệu, chạy phân tích chất lượng dữ liệu, áp dụng quy tắc.
  - **Viewer:** Chỉ có quyền đọc và xuất báo cáo.
- **Ràng buộc Sở hữu (Ownership Constraint):** Người dùng thông thường chỉ có thể chỉnh sửa các tài nguyên do chính mình tạo ra (`{ owner_id: user.id }`).

### 7.5. Tự Động Nhận Diện Thiết Bị (Auto Device Detection)
- **Module:** `device-detector.util.ts`.
- **Cơ chế:** Phân tích tiêu đề HTTP `User-Agent` thông qua hệ thống biểu thức chính quy (Regex Engine) để bóc tách:
  - Hệ điều hành: Linux, Windows, macOS, Android, iOS, ChromeOS.
  - Trình duyệt / Client: Chrome, Edge, Firefox, Safari, Opera, Postman, cURL.
- Tự động gắn tên thiết bị (ví dụ: `"Chrome on Linux"`, `"Safari on iPhone (iOS)"`) vào `Session`, hỗ trợ người dùng theo dõi và thu hồi phiên đăng nhập từ xa.

---

## 8. XỬ LÝ DỮ LIỆU LỚN & STREAMING PIPELINE (INGESTION & DATA PROCESSING)

### 8.1. Kỹ thuật Nạp Dữ Liệu Dòng (Streaming Ingestion)
- **Thư viện:** `busboy@1.6.0` (`@types/busboy@1.5.5`).
- **Vấn đề giải quyết:** Các framework thông thường sử dụng `multer` lưu toàn bộ tệp vào bộ nhớ RAM hoặc tệp tạm trên đĩa trước khi xử lý, dễ dẫn đến lỗi **Out Of Memory (OOM)** khi người dùng tải tệp CSV hàng triệu dòng.
- **Giải pháp của hệ thống:** Sử dụng `busboy` lắng nghe từng chunk dữ liệu 64KB từ HTTP Multipart Stream, đẩy trực tiếp qua pipeline nén/tính toán đồng thời stream lên Cloudflare R2, giữ mức sử dụng RAM máy chủ luôn ổn định dưới 150MB.

### 8.2. Bộ Phân Tích Cú Pháp CSV Tốc Độ Cao
- **Thư viện:** `fast-csv@5.0.8`.
- **Cơ chế:** Phân tích cú pháp dòng dữ liệu dựa trên Node.js Transform Stream có cơ chế kiểm soát áp lực ngược (**Backpressure Handling**), ngăn chặn tình trạng tràn bộ đệm khi tốc độ đọc file nhanh hơn tốc độ ghi vào cơ sở dữ liệu.

### 8.3. Động Cơ Xử Lý Bảng Tính Excel
- **Thư viện:** `xlsx@0.18.5` (SheetJS).
- **Ứng dụng:** Hỗ trợ người dùng nhập và xuất dữ liệu các định dạng bảng tính thông dụng của khối doanh nghiệp (`.xlsx`, `.xls`).

### 8.4. Động Cơ Phân Tích Chất Lượng Dữ Liệu (Data Profiling Engine)
- Thuật toán tính toán trực tiếp trên luồng dữ liệu nạp:
  - **Completeness:** Tính tỷ lệ ô rỗng (`null`, `undefined`, chuỗi trắng `""`).
  - **Data Type Inference:** Tự động nhận diện kiểu dữ liệu của từng cột (`INTEGER`, `FLOAT`, `BOOLEAN`, `DATETIME`, `STRING`, `EMAIL`, `PHONE`).
  - **Cardinality & Uniqueness:** Tính toán số lượng giá trị phân biệt để phát hiện trùng lặp hoặc khóa chính tiềm năng.
  - **Boundary Analysis:** Xác định giá trị nhỏ nhất (Min), lớn nhất (Max), độ dài chuỗi trung bình.

---

## 9. TÍCH HỢP TRÍ TUỆ NHÂN TẠO (AI ENGINE INTEGRATION)

### 9.1. Nhà Cung Cấp & Mô Hình AI
- **Nền tảng:** **Google Gemini API** (Google DeepMind).
- **Mô hình Khai thác:**
  - `gemini-1.5-pro`: Dành cho các bài toán phân tích phức tạp, đối soát ngữ nghĩa sâu và lý giải phả hệ dữ liệu.
  - `gemini-1.5-flash` / `gemini-2.0-flash`: Tối ưu hóa cho các tác vụ kiểm tra thời gian thực, độ trễ thấp (< 1 giây) và chi phí token thấp.

### 9.2. Các Nghiệp Vụ Ứng Dụng AI Cụ Thể
1. **Phát hiện Bất thường Ngữ nghĩa (Semantic Anomaly Detection):**
   - Các quy tắc regex thông thường chỉ kiểm tra được định dạng cú pháp. AI Engine có khả năng phân tích ngữ cảnh để phát hiện các giá trị bất thường về mặt logic (ví dụ: Địa chỉ ghi ở TP.HCM nhưng Mã bưu chính lại thuộc Hà Nội; Tên sản phẩm không khớp với phân loại ngành hàng).
2. **Gợi ý Quy tắc Làm sạch Tự động (Smart Rule Recommendation):**
   - Dựa trên kết quả Data Profiling, AI tự động đề xuất danh sách các quy tắc làm sạch tối ưu (như chuẩn hóa định dạng ngày tháng `YYYY-MM-DD`, loại bỏ khoảng trắng thừa, điền giá trị khuyết thiếu bằng kỹ thuật imputation).
3. **Giải thích Lỗi Dữ liệu bằng Ngôn ngữ Tự nhiên:**
   - Thay vì chỉ đưa ra mã lỗi khô khan, AI sinh ra các đoạn giải thích rõ ràng cho người dùng doanh nghiệp (Data Analyst / Business User) hiểu được nguyên nhân và cách khắc phục.

---

## 10. BỘ CÔNG CỤ KIỂM THỬ & ĐẢM BẢO CHẤT LƯỢNG (TESTING & QA TOOLING)

### 10.1. Danh mục Thư viện Kiểm thử
- **`jest`:** `30.5.2` — Test Runner chính của toàn bộ dự án.
- **`ts-jest`:** `29.4.15` — TypeScript preprocessor cho Jest, hỗ trợ biên dịch in-memory và source map chính xác.
- **`@types/jest`:** `30.0.0` — Định kiểu cho các hàm matcher `expect()`, `describe()`, `it()`.
- **`supertest`:** `7.3.1` (`@types/supertest@6.0.3`) — Kiểm thử tích hợp HTTP API endpoint không cần khởi động port mạng ngoài.
- **`@nestjs/testing`:** `11.2.8` — Tạo Test Module cô lập (Mock Testing) cho các tầng Service và Controller.

### 10.2. Quy mô Kiểm thử Hiện tại
- **Tổng số Test Suites:** `16` suites (100% PASS).
- **Tổng số Unit & Integration Tests:** `80` tests (100% PASS).
- **Các Module được Kiểm thử:**
  - `zero-any.spec.ts`: Quét tĩnh toàn bộ codebase để đảm bảo không vi phạm kiểu `any`.
  - `crypto.spec.ts`: Kiểm thử tính toán băm Merkle SHA-256.
  - `device-detector.spec.ts`: Kiểm thử nhận diện các loại trình duyệt và hệ điều hành.
  - `workspaces.spec.ts`, `projects.spec.ts`, `datasets-ingestion.spec.ts`, `data-view.spec.ts`, `clean-rules.spec.ts`, `lineage.spec.ts`, `versions.spec.ts`, `exports.spec.ts`, `storage.spec.ts`, `casl.spec.ts`, `mask-pii.spec.ts`, `guard-coverage.spec.ts`, `zod-openapi.spec.ts`.

---

## 11. BẢNG TỔNG HỢP TOÀN BỘ PHIÊN BẢN CÔNG NGHỆ (VERSION MANIFEST)

Dưới đây là bảng tra cứu chính xác 100% toàn bộ các thành phần công nghệ đang được khóa (locked) trong hệ thống:

| Phân nhóm | Tên Công nghệ / Thư viện | Phiên bản Thực tế (Locked) | Vai trò trong Dự án |
|---|---|---|---|
| **Môi trường & Ngôn ngữ** | Node.js | `v22.22.3 LTS` | Runtime thực thi JavaScript/V8 |
| | pnpm | `11.3.0` | Package manager |
| | TypeScript (Strict) | `6.0.2` (`npm:@typescript/typescript6@^6.0.2`) | Ngôn ngữ lập trình chính |
| | TypeScript (Native) | `7.0.2` (`@typescript/native@^7.0.2`) | Công cụ biên dịch native |
| **Backend Framework** | @nestjs/core | `11.2.8` | Động cơ IoC & DI của NestJS |
| | @nestjs/common | `11.2.8` | Decorators, Pipes, Filters, Guards |
| | @nestjs/platform-express | `11.2.8` | HTTP Adapter Express |
| | @types/express | `5.0.6` | TypeScript types cho Express |
| | @nestjs/config | `4.0.4` | Quản lý biến môi trường |
| | dotenv | `16.6.1` | Tải tệp cấu hình .env |
| | @nestjs/throttler | `6.7.1` | Rate limiting chống brute-force |
| | rxjs | `7.8.2` | Xử lý bất đồng bộ reactive |
| | reflect-metadata | `0.2.2` | Hỗ trợ reflection decorators |
| **Cơ sở Dữ liệu & Lưu trữ** | MongoDB Atlas | Cloud Cluster | CSDL tài liệu (Metadata, Users, Cells) |
| | mongoose | `9.11.3` | ODM driver cho MongoDB |
| | @nestjs/mongoose | `11.0.4` | Module tích hợp Mongoose vào NestJS |
| | Neo4j AuraDB | Cloud Instance | CSDL đồ thị (Data Lineage DAG) |
| | neo4j-driver | `5.28.3` | Driver kết nối Neo4j giao thức Bolt |
| | Cloudflare R2 | S3-Compatible Cloud | Lưu trữ dataset dung lượng lớn (Zero Egress) |
| | @aws-sdk/client-s3 | `3.1152.0` | AWS S3 Client SDK cho Cloudflare R2 |
| | @aws-sdk/lib-storage | `3.1152.0` | Multipart Upload streaming buffer |
| **Thẩm định & Schema** | zod | `3.25.76` | Thư viện Schema Validation chính |
| | zod-to-json-schema | `3.25.2` | Chuyển đổi Zod sang JSON Schema / OpenAPI |
| **Bảo mật Kênh truyền** | Cloudflare Zero Trust Tunnel | `2026.10.3` (cloudflared) | Đường hầm QUIC HTTPS Cổng 443 |
| | TLS Protocol | `TLS 1.3` (RFC 8446) / `TLS 1.2` | Mã hóa kênh truyền mạng |
| | helmet | `8.3.0` | Tiêu đề HTTP an ninh (HSTS, CSP, X-Frame) |
| **Xác thực & Mã hóa** | @nestjs/jwt | `11.0.2` | Ký và xác thực JWT token |
| | passport | `0.7.0` | Framework xác thực |
| | passport-jwt | `4.0.1` | Chiến lược xác thực JWT |
| | @types/passport-jwt | `4.0.1` | TypeScript types cho Passport JWT |
| | bcrypt | `5.1.1` | Băm mật khẩu người dùng (Salt 12) |
| | @types/bcrypt | `5.0.2` | TypeScript types cho Bcrypt |
| | Node Crypto | Native Node.js | Băm SHA-256 Merkle chain kiểm toán |
| | @casl/ability | `7.0.2` | Phân quyền hạt mịn ABAC / RBAC |
| **Xử lý Dữ liệu Lớn** | busboy | `1.6.0` | Đọc stream file multipart 64KB chunk |
| | @types/busboy | `1.5.5` | TypeScript types cho Busboy |
| | fast-csv | `5.0.8` | Streaming parser file CSV lớn |
| | xlsx | `0.18.5` | Đọc và xuất bảng tính Excel (SheetJS) |
| **Trí tuệ Nhân tạo** | Google Gemini API | `gemini-1.5-pro` / `gemini-1.5-flash` | Phát hiện bất thường & gợi ý quy tắc |
| **Tài liệu & Kiểm thử** | @nestjs/swagger | `11.4.7` | Tự động sinh Swagger OpenAPI 3.0 |
| | jest | `30.5.2` | Test runner tự động |
| | ts-jest | `29.4.15` | TypeScript preprocessor cho Jest |
| | @types/jest | `30.0.0` | TypeScript types cho Jest |
| | supertest | `7.3.1` | Kiểm thử tích hợp HTTP API |
| | @types/supertest | `6.0.3` | TypeScript types cho Supertest |
| | @nestjs/testing | `11.2.8` | Module mock testing của NestJS |
| | ts-node | `10.9.2` | Thực thi mã TypeScript trực tiếp |
| | ts-loader | `9.6.2` | Webpack loader cho TypeScript |
| | tsconfig-paths | `4.2.0` | Hỗ trợ path mapping `@/...` |
| | @nestjs/cli | `11.0.24` | Công cụ dòng lệnh NestJS |
| | @nestjs/schematics | `11.1.0` | Schematics generator cho NestJS |
| | source-map-support | `0.5.21` | Hỗ trợ source map khi debug |
