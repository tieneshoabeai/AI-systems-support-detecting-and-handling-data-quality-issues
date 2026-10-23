# SHARED ARCHITECTURE SPECIFICATION & DOCUMENTATION

## 1. Thông tin Phiên bản (Version Information)
- **Current Version:** v1.2.0
- **Last Updated:** 2026-10-21
- **Module Path:** `src/backend/src/shared/`
- **Tình trạng:** Sẵn sàng kiểm thử, vượt qua 100% (6/6 Test Suites, 19/19 Tests) và biên dịch sạch `nest build`

## 2. Mục đích & Phạm vi Nghiệp vụ (Scope & Responsibility)
- Cung cấp toàn bộ nền tảng hạ tầng và các cơ chế dùng chung (Cross-cutting Concerns) chuẩn Enterprise cho 9 Feature Modules:
  - **Phân quyền Thuộc tính Thực thể CASL (ABAC/PBAC):**
    - `@casl/ability` kết hợp `CaslAbilityFactory`, `PoliciesGuard`, `@CheckPolicies()`, `@PolicyResource()`, `@CurrentResource()`.
    - Phân quyền theo ngữ cảnh Không gian làm việc (`Workspace`: Owner, Editor, Viewer) và Quản trị viên hệ thống (`Admin`).
    - Khắc phục triệt để lỗi Double Database Query bằng cách inject trực tiếp entity đã nạp trong Guard qua `@CurrentResource()`.
  - **Tự động hóa Tài liệu API Swagger từ Zod (OpenAPI Auto-generation):**
    - `zod-to-json-schema` kết hợp `@ApiZodBody(Schema)` và `@ApiZodQuery(Schema)` giúp Swagger UI (`/api/v1/docs`) tự động hiển thị đầy đủ chi tiết request body và query params mà không cần dùng decorator của `class-validator`.
    - `@ApiOptimisticLock()`: Tài liệu hóa header `If-Match` cho tính năng khóa lạc quan.
  - **Quản lý Giao dịch CSDL Ngầm (Ambient Mongo Transaction):**
    - `MongooseTransactionService`: Quản lý giao dịch MongoDB Multi-document an toàn với `session.withTransaction()`.
    - `MongoSessionContext`: Sử dụng `AsyncLocalStorage` để lưu `ClientSession` ngầm, cho phép `BaseMongoRepository` tự động gia nhập transaction mà không cần truyền biến `session` thủ công qua từng tầng hàm.
  - **Bảo mật Dữ liệu Nhạy cảm PII (Data Privacy & PII Masking):**
    - `mask-pii.ts`: Tiện ích che giấu Email (`us***@gmail.com`), Số điện thoại (`090*****67`), CCCD/ID.
    - `sanitizeObjectForLog`: Đệ quy làm sạch object trước khi log để che giấu mật khẩu, token và thông tin định danh cá nhân (tuân thủ nghiêm ngặt Rule 6 Bảo mật).
  - **Mật mã học & Lưu trữ Đối tượng Đa chế độ:**
    - SHA-256 Checksum, AES-256-GCM Streaming Encryption (PBKDF2 100.000 vòng lặp).
    - Dual-mode Object Storage (Cloudflare R2 / AWS S3 + Local Storage fallback).
    - Transactional Outbox Pattern cho Neo4j Lineage DAG.
    - Base64 Cursor Codec cho Virtual Grid.

## 3. Nhật ký Prompting & Quyết định Kỹ thuật (Prompting Log & Rationale)
- **User Prompt / Business Intent:**
  - *"đúng là hệ thống ta đang thiếu casl, nhưng casl chỉ là một phần ví dụ, bạn phải xem các phần khác có thiếu thứ gì không?"*
  - *"đồng ý lộ trình 1 (Gói hoàn thiện Foundation v1.2.0 gồm: CASL, Zod-OpenAPI Swagger, AsyncLocalStorage Mongo Transaction, Mask PII)"*
- **Technical Reasoning & Decisions:**
  - **CASL ABAC vs Static Roles:** RBAC tĩnh không thể giải quyết bài toán: *"User là Editor ở Workspace 1 nhưng không được xem/sửa Dataset thuộc Workspace 2"*. CASL `MongoAbility` cho phép kiểm tra quyền bằng cú pháp truy vấn MongoDB `{ workspace_id: user.workspaceId }` trực tiếp trên entity.
  - **Loại bỏ Double Database Query:** Trong `sgod-rental-management`, `PoliciesGuard` nạp entity qua loader rồi Controller lại `findById()` lần 2. Dự án ta khắc phục bằng `@CurrentResource()` decorator, gán entity vào `request.resource` và tái sử dụng ngay trong handler.
  - **Zod Swagger Documentation:** Khi gỡ bỏ `class-validator`, Swagger UI mất khả năng hiển thị các trường DTO. `@ApiZodBody` chuyển đổi AST của Zod sang OpenAPI 3.0 JSON Schema thông qua `zod-to-json-schema`, khôi phục 100% trải nghiệm Swagger UI.
  - **AsyncLocalStorage cho Transaction:** Tránh anti-pattern truyền tham số `session: ClientSession` qua 5-7 tầng gọi hàm nghiệp vụ. `BaseMongoRepository` tự động gọi `resolveMongoSession()` để lấy ambient session nếu đang nằm trong `MongooseTransactionService.runInTransaction()`.
- **Generated Artifacts:**
  - `casl/actions.enum.ts`, `casl/subjects.type.ts`, `casl/casl-ability.factory.ts`, `casl/policy-resource.decorator.ts`, `casl/current-resource.decorator.ts`, `casl/check-policies.decorator.ts`, `casl/subject.helper.ts`, `casl/policies.guard.ts`, `casl/casl.module.ts`.
  - `swagger/zod-openapi.ts`, `swagger/api-zod.decorator.ts`.
  - `database/mongo-session-context.ts`, `database/mongoose-transaction.service.ts`.
  - `crypto/mask-pii.ts`.
  - Test suites: `test/casl.spec.ts`, `test/zod-openapi.spec.ts`, `test/mask-pii.spec.ts`.

## 4. Đặc tả Giao tiếp Kỹ thuật (Technical Contracts & API Specifications)
- **Exported Providers & Modules:**
  - `CaslAbilityFactory`: Tạo `AppAbility` tương ứng với `CurrentUser` và vai trò Workspace.
  - `PoliciesGuard`: NestJS CanActivate thực thi 2 tầng kiểm tra quyền (Static $\to$ Instance).
  - `MongooseTransactionService`: Hàm `runInTransaction(fn)` bọc transaction tự động.
  - `MongoSessionContext`: Đối tượng quản lý ambient session qua `AsyncLocalStorage`.
  - `ApiZodBody`, `ApiZodQuery`, `ApiOptimisticLock`: Decorators tài liệu hóa Swagger từ Zod.
  - `maskEmail`, `maskPhone`, `maskCitizenId`, `sanitizeObjectForLog`: Hàm che giấu dữ liệu PII.

## 5. Ràng buộc & Tiêu chuẩn Bất biến (Invariants & Security Rules)
- **Zero-Trust Guarding:** Mọi route nghiệp vụ bắt buộc phải gắn `JwtAuthGuard` hoặc đánh dấu `@Public()`, đồng thời được bảo vệ bởi `PoliciesGuard` và `@CheckPolicies()`.
- **Privacy Rule (Rule 6):** Tuyệt đối không log mật khẩu, token, hoặc email/phone ở dạng plain text ra console; bắt buộc qua `sanitizeObjectForLog`.
- **Transaction Safety:** Bất kỳ thao tác ghi đa tài liệu (Multi-write: Ingestion, Version Snapshot + Outbox) bắt buộc phải bọc trong `MongooseTransactionService.runInTransaction()`.

## 6. Lịch sử Thay đổi (Change Log & Version History)
- `v1.2.0` / `2026-10-21`:
  - *Thay đổi gì:* Tích hợp toàn diện 4 thành phần tinh hoa từ dự án mẫu `sgod-rental-management`: CASL ABAC/PBAC (`casl/`), Zod-OpenAPI Swagger Decorators (`swagger/`), Ambient Mongo Transaction qua `AsyncLocalStorage` (`database/`), và Bộ che giấu PII (`crypto/mask-pii.ts`). Vượt qua 100% 6 bộ unit tests và build thành công.
  - *Lý do:* Hiện thực hóa Lộ trình 1 theo chỉ thị của người dùng để hoàn thiện tầng nền tảng vững chắc trước khi bước vào Sprint B2.
  - *Ảnh hưởng đến đâu:* Cung cấp khung phân quyền, tài liệu hóa và bảo vệ giao dịch chuẩn mực cho toàn bộ 9 Modules nghiệp vụ.
- `v1.1.0` / `2026-10-20`:
  - *Thay đổi gì:* Tái cấu trúc toàn bộ tầng cơ sở từ `core/` sang `shared/`, thay thế `class-validator` bằng `Zod`, cấu hình `pnpm@11.3.0`.
- `v1.0.0` / `2026-10-20`:
  - *Thay đổi gì:* Khởi tạo khung tầng `core/` ban đầu với Mongoose, Neo4j, S3 và Crypto cơ bản.
