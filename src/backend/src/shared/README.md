# SHARED ARCHITECTURE & CROSS-CUTTING FOUNDATION

## 1. Tổng quan & Vị trí trong Hệ sinh thái (Overview & System Context)
Module `shared` là khung xương sống hạ tầng (Infrastructural Backbone) của toàn bộ hệ thống. Module này tập trung giải quyết các bài toán kỹ thuật dùng chung (Cross-cutting Concerns) theo chuẩn Enterprise, cung cấp các khối xây dựng cốt lõi (Building Blocks) cho toàn bộ các Feature Modules (`auth`, `users`, `workspaces`, `projects`, `datasets`, `data-view`, `analysis`, `notifications`, `issues`, `feedback`, `realtime`).

- **Các Trụ cột Hạ tầng Chính:**
  - **Phân quyền Thuộc tính Thực thể CASL (ABAC/PBAC):** Phân quyền động theo ngữ cảnh Workspace và giải quyết triệt để lỗi truy vấn CSDL 2 lần (Double Database Query).
  - **Quản lý Giao dịch CSDL Ngầm (Ambient Mongo Transaction):** Tự động lan truyền phiên `ClientSession` qua `AsyncLocalStorage` mà không cần truyền biến thủ công qua từng tầng hàm.
  - **Lưu trữ Đối tượng Đa chế độ (Object Storage):** Tích hợp Cloudflare R2 / AWS S3 tương thích S3 API kèm cơ chế kiểm soát hạn ngạch lưu trữ (Quota Guard 10GB).
  - **Mật mã học & Bảo mật Thông tin Nhạy cảm (Crypto & PII):** Mã hóa luồng AES-256-GCM (PBKDF2 100.000 vòng lặp), băm SHA-256, che giấu dữ liệu PII trong nhật ký hệ thống.
  - **Tự động hóa Swagger từ Zod (OpenAPI Bridge):** Tự động sinh tài liệu Swagger UI từ Zod Schema mà không cần `class-validator`.

---

## 2. Kiến trúc Hạ tầng & Luồng Tương tác Trực quan (Architecture & Subsystems)
Sơ đồ kết nối giữa các Feature Modules, Khung hạ tầng `shared` và các dịch vụ cơ sở hạ tầng bên ngoài:

```mermaid
graph TD
    subgraph Feature Modules ["Tầng Nghiệp vụ (Feature Modules)"]
        FM1["Auth & Users"]
        FM2["Workspaces & Projects"]
        FM3["Datasets & Data View"]
        FM4["Analysis & Feedback"]
    end

    subgraph Shared Layer ["Tầng Hạ tầng Dùng chung (SharedModule)"]
        CASL["🛡️ CASL ABAC Engine<br/><i>PoliciesGuard & CurrentResource</i>"]
        TX["🔄 Ambient Transaction<br/><i>AsyncLocalStorage & Mongoose</i>"]
        STORE["☁️ Storage Service<br/><i>Cloudflare R2 S3 SDK</i>"]
        CRYPTO["🔐 Crypto & PII Masking<br/><i>AES-256-GCM, PBKDF2, Bcrypt</i>"]
        SWAGGER["📜 Zod-OpenAPI Bridge<br/><i>ApiZodBody & ApiZodQuery</i>"]
        REPO["🗄️ BaseMongoRepository<br/><i>CRUD & Soft-delete Filter</i>"]
    end

    subgraph Infrastructure ["Hạ tầng Bên ngoài (Infrastructure)"]
        Mongo[("MongoDB Atlas M0")]
        R2[("Cloudflare R2 Bucket")]
        Redis[("Redis Cache + Rate-limit")]
        Kafka[("Kafka Event Bus")]
    end

    FM1 --> CASL & CRYPTO & REPO
    FM2 --> CASL & REPO
    FM3 --> STORE & TX & REPO & SWAGGER
    FM4 --> TX & REPO

    CASL -.->|"Kiểm tra quyền trên Document"| REPO
    TX -->|"Tự động đính kèm ClientSession"| REPO
    REPO -->|"Mongoose queries"| Mongo
    STORE -->|"Stream Put/Get Object"| R2
    REPO -->|"Outbox events"| Kafka
```

---

## 3. Khái niệm Cốt lõi & Mô hình Nghiệp vụ (Domain Concepts & Patterns)

### 3.1. Phân quyền Thuộc tính Thực thể CASL (ABAC vs RBAC tĩnh)
- **Hạn chế của RBAC tĩnh:** Không thể kiểm soát ngữ cảnh: *"Người dùng A có vai trò Editor ở Workspace 1 nhưng không có quyền can thiệp vào Project của Workspace 2"*.
- **Giải pháp CASL Ability:** `CaslAbilityFactory` kết hợp với `PoliciesGuard` đánh giá quyền dựa trên điều kiện của thuộc tính thực thể `{ workspace_id: user.workspaceId }`.
- **Khắc phục lỗi Double Database Query:** Bằng cách sử dụng `@PolicyResource()` và `@CurrentResource()`, thực thể sau khi được Guard nạp từ CSDL để kiểm tra quyền sẽ được đính kèm trực tiếp vào `request.resource`. Handler trong Controller chỉ việc lấy ra sử dụng, tiết kiệm 50% số lượng truy vấn CSDL.

### 3.2. Quản lý Giao dịch Ngầm (Ambient Transaction via AsyncLocalStorage)
- **Vấn đề truyền thống:** Bắt buộc phải truyền biến `session: ClientSession` qua 4-5 tầng hàm gọi nhau (`Service -> Repository -> Helper`), làm ô nhiễm signature của hàm và dễ gây quên session dẫn đến rò rỉ dữ liệu ngoài transaction.
- **Giải pháp AsyncLocalStorage:** `MongooseTransactionService.runInTransaction(async () => { ... })` lưu trữ session trong ngữ cảnh luồng thực thi ngầm (`AsyncLocalStorage`). Mọi phương thức trong `BaseMongoRepository` tự động phát hiện và đính kèm session nếu đang chạy trong transaction.

### 3.3. Bảo mật Thông tin Nhạy cảm (PII Masking & Log Sanitization)
Tuân thủ nghiêm ngặt **WORKING RULE (Mục 6 - Bảo mật)**:
- Không bao giờ in ra console email, số điện thoại hoặc token ở dạng thô.
- `maskEmail('user@gmail.com')` $\rightarrow$ `us***@gmail.com`.
- `maskPhone('0901234567')` $\rightarrow$ `090*****67`.
- Hàm `sanitizeObjectForLog(obj)` đệ quy làm sạch object trước khi chuyển vào Logger.

---

## 4. Ma trận Đường ống Bảo vệ (Zero-Trust Guarding Pipeline)
Mỗi yêu cầu HTTP đi vào hệ thống đều phải đi qua chuỗi lọc bảo mật đa tầng:

```
Request 
  ──► JwtAuthGuard (Xác thực danh tính / Bỏ qua nếu có @Public)
  ──► PoliciesGuard (Kiểm tra quyền CASL trên Resource)
  ──► ZodValidationPipe (Kiểm thực và ép kiểu Schema)
  ──► Controller Handler (Xử lý logic nghiệp vụ)
  ──► LoggingInterceptor (Ghi log an toàn đã mask PII)
  ──► Response
```

---

## 5. Danh mục Providers & Tiện ích Xuất bản (Exported Contracts)

| Provider / Utility | Thư mục | Mục đích Nghiệp vụ |
| :--- | :--- | :--- |
| `CaslAbilityFactory` | `src/shared/interfaces/casl/` | Tạo đối tượng `AppAbility` tương ứng với vai trò và ngữ cảnh người dùng |
| `PoliciesGuard` | `src/shared/interfaces/casl/` | Guard kiểm tra quyền hạn đa tầng (Static $\rightarrow$ Instance) |
| `@CurrentResource()` | `src/shared/interfaces/casl/` | Decorator inject thực thể đã nạp trong Guard vào Controller |
| `MongooseTransactionService` | `src/shared/infrastructure/database/` | Dịch vụ bọc khối lệnh trong MongoDB Multi-document Transaction |
| `BaseMongoRepository<T>` | `src/shared/infrastructure/database/` | Lớp cơ sở trừu tượng cho Repository, tự động lọc `deleted_at: null` |
| `StorageService` | `src/shared/infrastructure/storage/` | Dịch vụ tải tệp, kiểm tra hạn mức Quota 10GB trên Cloudflare R2 |
| `CryptoUtil` | `src/shared/domain/crypto/` | Tiện ích băm Bcrypt, SHA-256, mã hóa dòng AES-256-GCM |
| `sanitizeObjectForLog` | `src/shared/domain/crypto/` | Làm sạch đối tượng trước khi log (ẩn password, token, PII) |
| `@ApiZodBody()`, `@ApiZodQuery()` | `src/shared/interfaces/swagger/` | Tự động sinh đặc tả OpenAPI 3.0 cho Swagger UI từ Zod Schema |

### 5.1. Phân tầng của `shared/` (Clean Architecture)

`shared/` được chia thành 4 tầng, cùng nguyên tắc chiều phụ thuộc với module nghiệp vụ
(Phần 16 §3.1). Mũi tên phụ thuộc luôn hướng vào trong:

```
shared/interfaces ─┐
                    ├─→ shared/application ─→ shared/domain
shared/infrastructure ┘
```

| Tầng | Thư mục | Nội dung | Được phép import |
| :--- | :--- | :--- | :--- |
| **Domain** | `shared/domain/` | `crypto/`, `pagination/`, `utils/`, `validation/`, `security/` | chỉ `shared/domain/` |
| **Application** | `shared/application/` | `ports/` — hợp đồng hạ tầng dùng chung | `shared/domain/`, `shared/application/` |
| **Infrastructure** | `shared/infrastructure/` | `database/`, `events/`, `outbox/`, `storage/`, `adapters/`, `config/` | `shared/domain/`, `shared/application/` |
| **Interfaces** | `shared/interfaces/` | `casl/`, `decorators/`, `filters/`, `guards/`, `interceptors/`, `middleware/`, `pipes/`, `swagger/` | `shared/domain/`, `shared/application/` |

`shared/shared.module.ts` nằm ở gốc `shared/` vì là **composition root** — được phép
import mọi tầng của `shared/`, giống `app.module.ts` ở gốc `src/`.

Các quy tắc trên được kiểm chứng tự động bằng rule **CA13–CA16**, **CA19** trong
`test/clean-architecture.spec.ts`; vi phạm mới sẽ chặn CI.

### 5.2. Kiểu thuần trong `shared/domain/security/`

Các kiểu dữ liệu thuần (không framework) được tách ra khỏi `shared/interfaces/`
để **tầng `infrastructure` không phải import ngược tầng giao diện**:

| File | Kiểu | Nơi dùng |
| :--- | :--- | :--- |
| `current-user-payload.ts` | `CurrentUserPayload` | `JwtStrategy` (infrastructure) trả về; decorator `@CurrentUser()` và `RolesGuard` đọc |
| `current-user.ts` | `CurrentUser` (= payload + ngữ cảnh workspace/project) | `PoliciesGuard`, `CaslAbilityFactory` |
| `action.ts` | `Action` (enum quyền) | `CaslAbilityFactory`, `PoliciesGuard` |
| `subjects.ts` | `SubjectName`, `AppSubjects` | CASL |
| `policy-resource-loader.ts` | `PolicyResourceLoader` | Policy loader ở tầng `application` |

> **Ghi chú.** File trong `shared/interfaces/` vẫn **re-export** các kiểu này để giữ
> public contract cũ — ví dụ `import { CurrentUserPayload } from
> '.../shared/interfaces/decorators/current-user.decorator'` vẫn chạy.

### 5.3. Hệ thống lỗi nghiệp vụ (`DomainError`)

Từ Bước 2 của Phần 16, toàn hệ thống lỗi được chuẩn hoá theo **3 tầng**:

| Tầng | Thư mục | Trách nhiệm |
| :--- | :--- | :--- |
| **Domain** | `shared/domain/errors/` | `DomainError` + 13 subclass — mã lỗi nghiệp vụ `SCREAMING_SNAKE_CASE`, **không** biết HTTP |
| **Application** | `shared/application/errors/` | `StatusError` — lỗi có HTTP status tường minh (escape hatch) |
| **Interfaces** | `shared/interfaces/errors/` | `ERROR_CODE_TO_HTTP_STATUS` — **ranh giới duy nhất** biết HTTP status |

```ts
// ✅ Tầng application — thuần nghiệp vụ
throw new NotFoundError('Chưa có Tổng kết cho project này');
// → HTTP 404, error.code = 'NOT_FOUND'

// ✅ Khi hợp đồng API bắt buộc status khác mặc định
throw new StatusError(401, ERROR_CODES.VALIDATION_ERROR, 'Google từ chối yêu cầu.');
// → HTTP 401, error.code = 'VALIDATION_ERROR'
```

**Quy tắc:** tên mã lỗi **không** chứa số HTTP (`NOT_FOUND` chứ không phải
`HTTP_404`) và **không** chứa từ khoá HTTP (`VALIDATION_ERROR` chứ không phải
`BAD_REQUEST`) — vì đó là khái niệm nghiệp vụ, không phải khái niệm giao thức.

**Rule CA20** chặn CI nếu tầng `application` import `*Exception` hoặc `HttpStatus`
từ `@nestjs/common`. Xem `Phần 16 §6` để biết chi tiết.

---

## 6. Đánh đổi Kỹ thuật & Lịch sử Phiên bản (Trade-offs & Changelog)

### 6.1. Đánh đổi Kỹ thuật (Technical Trade-offs)
- **AsyncLocalStorage cho Transaction:** Mang lại kiến trúc code cực kỳ sạch sẽ và an toàn, nhưng phụ thuộc vào tính năng ngữ cảnh bất đồng bộ của Node.js runtime (tương thích hoàn toàn từ Node.js v16+).
- **Zod-to-JSON-Schema thay cho Class-Validator:** Loại bỏ hoàn toàn sự phụ thuộc vào decorator reflection và cho phép suy diễn kiểu dữ liệu 100% tự nhiên (`z.infer<typeof Schema>`), đáp ứng tuyệt đối nguyên tắc **Zero Any**.

### 6.2. Lịch sử Thay đổi (Change Log)
- `v1.5.0` (2026-11-17):
  - *Thay đổi gì:* Chuẩn hoá toàn hệ thống lỗi theo 3 tầng — `shared/domain/errors/` (mã lỗi nghiệp vụ thuần), `shared/application/errors/` (`StatusError`), `shared/interfaces/errors/` (`ERROR_CODE_TO_HTTP_STATUS`). Thay 202 throw site `HttpException` trong 81 file `modules/*/application/` bằng `DomainError`. Chuẩn hoá `error.code` sang `SCREAMING_SNAKE_CASE` theo hợp đồng API Phần 7 §3.4.
  - *Lý do:* Tầng trung bị ràng buộc vào HTTP framework — mỗi endpoint mới phải viết lại logic lỗi. Nay tầng application không còn biết HTTP, và mã lỗi trở thành hợp đồng ổn định mà frontend kiểm tra được. Rule **CA20** chặn CI nếu `application` import `*Exception`/`HttpStatus` từ `@nestjs/common`.
- `v1.4.0` (2026-11-17):
  - *Thay đổi gì:* Tái cấu trúc `shared/` thành 4 phân tầng `domain/` · `application/` · `infrastructure/` · `interfaces/` theo Clean Architecture (Phần 16 §3.1). Tách `CurrentUserPayload` sang `shared/domain/security/` để `infrastructure` không phải import ngược `shared/interfaces/` (rule CA19).
  - *Lý do:* Trước đây `shared/` phẳng 18 thư mục trộn lẫn framework, hạ tầng và hợp đồng — không có ranh giới nào chặn việc domain import nhầm framework. Nay chiều phụ thuộc được kiểm chứng tự động bằng rule CA13–CA16, CA19.
- `v1.3.0` (2026-10-24):
  - *Thay đổi gì:* Nâng cấp tài liệu sang chuẩn kiến trúc trực quan, bổ sung sơ đồ Mermaid liên kết các phân hệ và mô tả chuỗi lọc bảo vệ Zero-Trust.
  - *Lý do:* Giúp người xem nắm bắt nền tảng kỹ thuật của toàn bộ dự án mà không cần đọc code.
- `v1.2.0` (2026-10-21):
  - *Thay đổi gì:* Tích hợp CASL ABAC, Zod-OpenAPI Swagger Bridge, AsyncLocalStorage Mongo Transaction và PII Masking.
- `v1.0.0` (2026-10-20):
  - *Thay đổi gì:* Khởi tạo khung hạ tầng shared, CryptoUtil, StorageService và BaseMongoRepository.
