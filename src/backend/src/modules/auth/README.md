# AUTHENTICATION MODULE SPECIFICATION & DOCUMENTATION

## 1. Thông tin Phiên bản (Version Information)
- **Current Version:** v1.1.0
- **Last Updated:** 2026-10-20
- **Module Path:** `src/backend/src/modules/auth/`
- **Tình trạng:** Sẵn sàng kiểm thử, tuân thủ 100% NestJS Modular Monolith & Zod Validation

## 2. Mục đích & Phạm vi Nghiệp vụ (Scope & Responsibility)
- Quản lý toàn bộ chu trình định danh và xác thực người dùng trong hệ thống (F1.1 $\rightarrow$ F1.10).
- Đăng ký tài khoản mới với mật mã hóa `bcrypt` (Salt Rounds = 12).
- Đăng nhập, cấp phát Access Token (JWT 15m) và Refresh Token ngẫu nhiên (7d).
- Quản lý phiên đăng nhập (`user_sessions`), lưu mã băm `SHA-256` của refresh token để phát hiện rò rỉ token và hỗ trợ thu hồi từ xa (Revoke Session).

## 3. Nhật ký Prompting & Quyết định Kỹ thuật (Prompting Log & Rationale)
- **User Prompt / Business Intent:**
  - *"tinh chỉnh lại là dùng zod chứ không dùng class-validator + class-transformer"*
  - *"thay vì dùng từ core, tôi đề xuất tinh chỉnh lại là shared/"*
  - *"vấn đề 1: chọn hướng 1, vấn đề 2: chọn hướng A"*
- **Technical Reasoning & Decisions:**
  - Chuyển toàn bộ DTO sang định dạng `ZodSchema` và kiểu dữ liệu suy diễn `z.infer<typeof Schema>`. Điều này loại bỏ runtime overhead của decorators và đảm bảo đồng nhất hoàn toàn giữa schema runtime và TypeScript type.
  - Áp dụng `ZodValidationPipe` trực tiếp trên các route `@Body(new ZodValidationPipe(Schema))` để kiểm định nghiêm ngặt dữ liệu đầu vào.
  - Sử dụng `@Public()` decorator trên các endpoint công khai (`/register`, `/login`, `/refresh`) để vượt qua `JwtAuthGuard` mà vẫn đạt tiêu chuẩn kiểm thử Zero-Trust Security.
- **Generated Artifacts:**
  - `dto/register.dto.ts`: `RegisterSchema` (Zod) & `RegisterDto`.
  - `dto/login.dto.ts`: `LoginSchema` (Zod) & `LoginDto`.
  - `dto/refresh-token.dto.ts`: `RefreshTokenSchema` (Zod) & `RefreshTokenDto`.
  - `dto/password-reset.dto.ts`: `ForgotPasswordSchema`, `ResetPasswordSchema` (Zod).
  - `strategies/jwt.strategy.ts`: Passport JWT Strategy liên kết `shared/decorators`.
  - `auth.service.ts`: Xử lý logic xác thực, gọi `shared/crypto/crypto.util.ts`.
  - `auth.controller.ts`: 6 Endpoints chuẩn RESTful với `ZodValidationPipe`.
  - `auth.module.ts`: Tích hợp PassportModule, JwtModule và SharedModule.

## 4. Đặc tả Giao tiếp Kỹ thuật (Technical Contracts & API Specifications)

| Method | Endpoint | Quyền hạn | Input DTO | Response | Mô tả |
| :---: | :--- | :---: | :--- | :--- | :--- |
| `POST` | `/api/v1/auth/register` | Public (`@Public()`) | `RegisterDto` (Zod) | `{ id, email, first_name, last_name, role }` | Đăng ký tài khoản (F1.1) |
| `POST` | `/api/v1/auth/login` | Public (`@Public()`) | `LoginDto` (Zod) | `{ access_token, refresh_token, expires_in, user }` | Đăng nhập hệ thống (F1.2) |
| `POST` | `/api/v1/auth/refresh` | Public (`@Public()`) | `RefreshTokenDto` (Zod) | `{ access_token, expires_in }` | Cấp mới Access Token (F1.3) |
| `POST` | `/api/v1/auth/logout` | Bearer JWT | N/A | `{ message }` | Đăng xuất, thu hồi session (F1.4) |
| `GET` | `/api/v1/auth/sessions` | Bearer JWT | N/A | `IUserSession[]` | Lấy danh sách session active (F1.8) |
| `DELETE` | `/api/v1/auth/sessions/:id` | Bearer JWT | Param `id` | `{ message }` | Thu hồi session từ xa (F1.10) |

## 5. Ràng buộc & Tiêu chuẩn Bất biến (Invariants & Security Rules)
- Mật khẩu: Băm bằng `bcrypt` với `SALT_ROUNDS = 12`.
- Refresh Token: Băm một chiều bằng `SHA-256`.
- Access Token chứa: `{ sub: userId, email, role, sessionId }`.
- Luôn kiểm tra tài khoản chưa bị xóa mềm (`deleted_at === null`) và không bị khóa (`status !== 'blocked'`) trong `JwtStrategy`.

## 6. Lịch sử Thay đổi (Change Log & Version History)
- `v1.1.0` / `2026-10-20`:
  - *Thay đổi gì:* Refactor 100% DTO từ `class-validator` sang `Zod` (`RegisterSchema`, `LoginSchema`, `RefreshTokenSchema`), cập nhật controller sử dụng `ZodValidationPipe`, đổi import từ `core/` sang `shared/`.
  - *Lý do:* Thực hiện tinh chỉnh kiến trúc validation theo chỉ thị của người dùng.
  - *Ảnh hưởng đến đâu:* Module Auth hoạt động độc lập không còn phụ thuộc vào decorator-based validation.
- `v1.0.0` / `2026-10-20`:
  - *Thay đổi gì:* Khởi tạo toàn bộ module Auth với 6 endpoints chuẩn, kết nối `UsersService` và `crypto.util.ts`.
  - *Lý do:* Hiện thực hóa Sprint B1 theo kế hoạch `backend_implementation_plan_v3.md`.
  - *Ảnh hưởng đến đâu:* Cung cấp cơ chế bảo vệ token cho toàn bộ các module tiếp theo.
