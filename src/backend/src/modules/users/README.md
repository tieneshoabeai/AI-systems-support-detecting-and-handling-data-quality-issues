# USERS MODULE SPECIFICATION & DOCUMENTATION

## 1. Thông tin Phiên bản (Version Information)
- **Current Version:** v1.1.0
- **Last Updated:** 2026-10-20
- **Module Path:** `src/backend/src/modules/users/`
- **Tình trạng:** Sẵn sàng kiểm thử, tuân thủ 100% NestJS Modular Monolith & Zod Validation

## 2. Mục đích & Phạm vi Nghiệp vụ (Scope & Responsibility)
- Quản lý thông tin hồ sơ tài khoản người dùng và các phiên hoạt động trong hệ thống.
- Thực thi chuẩn hóa cơ chế xóa mềm (Soft Delete) theo đúng quy tắc kỹ thuật dự án: bắt buộc sử dụng `deleted_at: Date | null`, nghiêm cấm sử dụng cờ boolean `is_deleted`.
- Duy trì chỉ mục duy nhất một phần (Partial Unique Index) cho trường `email` để cho phép đăng ký lại nếu tài khoản cũ đã bị xóa mềm.

## 3. Nhật ký Prompting & Quyết định Kỹ thuật (Prompting Log & Rationale)
- **User Prompt / Business Intent:**
  - *"tinh chỉnh lại là dùng zod chứ không dùng class-validator + class-transformer"*
  - *"thay vì dùng từ core, tôi đề xuất tinh chỉnh lại là shared/"*
  - *"hoặc là at_deleted... được đồng bộ lại là deleted_at"*
- **Technical Reasoning & Decisions:**
  - Áp dụng nguyên tắc nhất quán: `deleted_at: { type: Date, default: null, index: true }`.
  - Khi user bị xóa mềm (`deleted_at = new Date()`), tự động thu hồi toàn bộ session đang mở của user đó (`is_revoked = true`) để ngắt truy cập ngay lập tức.
  - Sử dụng Partial Unique Index trên MongoDB Atlas:
    `{ email: 1 }, { unique: true, partialFilterExpression: { deleted_at: null } }`.
  - Thay thế `class-validator` bằng `UpdateUserSchema` (Zod) kèm pipe `ZodValidationPipe` bảo đảm type-safety tuyệt đối cho endpoint `PATCH /users/me`.
- **Generated Artifacts:**
  - `schemas/user.schema.ts`: Mongoose schema cho collection `users`.
  - `schemas/user-session.schema.ts`: Mongoose schema cho collection `user_sessions`.
  - `dto/update-user.dto.ts`: `UpdateUserSchema` (Zod) & `UpdateUserDto`.
  - `users.service.ts`: Nghiệp vụ truy vấn user, tạo tài khoản, xóa mềm và quản lý session.
  - `users.controller.ts`: Endpoints hồ sơ cá nhân với `ZodValidationPipe`.
  - `users.module.ts`: NestJS Module binding.

## 4. Đặc tả Giao tiếp Kỹ thuật (Technical Contracts & API Specifications)

| Method | Endpoint | Quyền hạn | Input DTO | Response | Mô tả |
| :---: | :--- | :---: | :--- | :--- | :--- |
| `GET` | `/api/v1/users/me` | Bearer JWT | N/A | `IUser` | Xem thông tin hồ sơ của tài khoản hiện tại |
| `PATCH` | `/api/v1/users/me` | Bearer JWT | `UpdateUserDto` (Zod) | `IUser` | Cập nhật họ tên, avatar của tài khoản |
| `DELETE` | `/api/v1/users/me` | Bearer JWT | N/A | `{ message }` | Xóa mềm tài khoản và thu hồi toàn bộ session |

## 5. Ràng buộc & Tiêu chuẩn Bất biến (Invariants & Security Rules)
- Tất cả các câu truy vấn tìm kiếm user mặc định phải có điều kiện: `{ deleted_at: null }`.
- Mật khẩu (`password_hash`) được bảo vệ bằng `{ select: false }`, chỉ trích xuất khi được yêu cầu tường minh trong hàm xác thực login.

## 6. Lịch sử Thay đổi (Change Log & Version History)
- `v1.1.0` / `2026-10-20`:
  - *Thay đổi gì:* Chuyển đổi `UpdateUserDto` sang Zod schema (`UpdateUserSchema`), cập nhật `UsersController` với `ZodValidationPipe`, đổi import liên kết từ `core/` sang `shared/`.
  - *Lý do:* Hoàn tất chuyển đổi Zod và hạ tầng `shared/` toàn diện.
  - *Ảnh hưởng đến đâu:* Đảm bảo tính nhất quán trên toàn bộ backend.
- `v1.0.0` / `2026-10-20`:
  - *Thay đổi gì:* Thiết lập UserSchema, UserSessionSchema với chuẩn `deleted_at`, Partial Unique Index và hoàn thành UsersService, UsersController.
  - *Lý do:* Khởi tạo Module người dùng cho Sprint B1.
  - *Ảnh hưởng đến đâu:* Cung cấp dữ liệu người dùng cho AuthModule và các module sở hữu tài nguyên (Workspaces, Projects).
