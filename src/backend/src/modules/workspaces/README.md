# `workspaces` — Template: Hexagonal
- Vì sao Hexagonal: quota 20 + tx strict + RBAC 3 tang + 2 adapter fail-safe
- Bất biến chính: 2 adapter access/context rieng (context fail-safe try/catch), MAX_WORKSPACES_PER_USER=20, event WORKSPACE_DELETED trong transaction (§12)
- Cấm: gộp entity/port/handler; đổi thứ tự guard/route; đổi hằng số quota/limit.

---
# MÔ-ĐUN `workspaces` — Không gian làm việc

> **Đặc tả mô-đun & Tài liệu kỹ thuật**

## 1. Thông tin phiên bản

- **Phiên bản hiện tại:** v1.1.0
- **Cập nhật lần cuối:** 2026-11-21
- **Đường dẫn mô-đun:** `src/backend/src/modules/workspaces` (38 tệp TypeScript)
- **Tầng kiến trúc:** Clean Architecture 4 tầng (`domain` → `application` → `infrastructure` → `presentation`)
- **Quy tắc tầng:** CA1–CA14 — xem [`../README.md`](../README.md)

## 2. Mục đích & Phạm vi nghiệp vụ

Workspace là **vùng chứa cấp cao nhất** trong mô hình phân quyền. Mọi project, dataset và phân tích đều nằm bên trong một workspace.

```text
User ---> Workspace ---> Project ---> Dataset ---> DataRecord
        (owner/member)  (owner/member/viewer)
```

### 2.1. Tính năng thuộc phạm vi

| Chức năng | Nội dung |
|---|---|
| CRUD workspace | Tạo, đọc, cập nhật, xoá mềm |
| Thành viên | Thêm, xoá, liệt kê, chuyển quyền sở hữu, tự rời |
| Hạn ngạch | Giới hạn số workspace/người dùng, dung lượng/workspace |
| Phân quyền ngữ cảnh | Giải quyết vai trò workspace của người dùng theo từng request |
| Sự kiện | `workspace.created`, `workspace.member_added`, `workspace.member_removed`, `workspace.owner_transferred`, `WORKSPACE_DELETED` |

### 2.2. Cấu trúc thư mục

```text
workspaces/
|-- domain/
|   |-- entities/workspace.entity.ts
|   |-- value-objects/
|   |   |-- workspace-role.vo.ts     # owner | member + resolveWorkspaceRole
|   |   `-- workspace-quota.vo.ts    # giới hạn 20 workspace/người dùng
|   |-- events/workspace-events.ts
|   `-- ports/
|       |-- workspace.repository.port.ts
|       `-- workspace.access.port.ts
|-- application/
|   |-- commands/                    # 8 command handler
|   |-- queries/                     # 6 query handler
|   |-- policy-loaders/workspace-policy.loader.ts
|   |-- workspaces.types.ts
|   `-- workspaces.utils.ts
|-- infrastructure/
|   |-- adapters/
|   |   |-- workspace-access.adapter.ts
|   |   `-- workspace-context.adapter.ts    # hiện thực WORKSPACE_CONTEXT_PORT
|   `-- persistence/                  # schema, repository, mapper
`-- presentation/
    |-- controllers/workspaces.controller.ts
    |-- dtos/                         # 6 DTO
    `-- responses/workspace.response.ts
```

## 3. Nhật ký Prompting & Quyết định kỹ thuật

- **Yêu cầu người dùng / Ý đồ nghiệp vụ:** Làm `workspaces` là **tầng trung gian** của mô hình phân quyền 3 tầng: giữa vai trò hệ thống (`admin`/`analyst`) và vai trò project (`owner`/`member`/`viewer`). Mô-đun này phải trả lời duy nhất một câu hỏi: "người dùng này có quyền gì trong workspace này?"

- **Lập luận kỹ thuật & Quyết định:**

1. **Vai trò workspace là nguồn sự thật duy nhất.** `resolveWorkspaceRole(ownerId, members, userId)` trong `workspace-role.vo.ts` là **hàm duy nhất** quyết định vai trò. Nó được dùng lại bởi `WorkspaceContextAdapter` để suy ra quyền ở tầng policy. Không viết lại điều kiện ở guard, ở handler, ở query — tránh mâu thuẫn.

2. **Vai trò `editor` / `viewer` trong `members[]` được chuẩn hoá thành `member`.** Chỉ còn 2 vai trò `owner` | `member` ở tầng workspace. Logic chi tiết hơn nằm ở tầng project. Cách này giữ mô hình 3 tầng dễ đọc và dễ kiểm chứng.

3. **Hạn ngạch số workspace/người dùng = 20.** Nếu không giới hạn, một tài khoản có thể tạo hàng loạt workspace và gửi lời mời tới hàng loạt địa chỉ — biến hệ thống thành công cụ spam. Admin hệ thống **không** bị giới hạn. Chỉ tính workspace mà người dùng làm **owner** (không tính workspace chỉ là thành viên).

4. **Quota dung lượng theo `storage_used_bytes`** được đồng bộ bằng lệnh tăng của các mô-đun, tránh truy vấn đếm lại.

5. **Cascade xoá qua domain event, bọc transaction MongoDB.** Xoá workspace phải xoá project → dataset → record. Làm trực tiếp trong handler sẽ tạo trạng thái nửa vời. Dùng outbox event + transaction để bảo đảm nhất quán.

- **Hiện vật đã tạo / đã sửa:**

- `domain/value-objects/workspace-role.vo.ts` — `WorkspaceRole`, `resolveWorkspaceRole`.
- `domain/value-objects/workspace-quota.vo.ts` — `MAX_WORKSPACES_PER_USER = 20`, `WorkspaceQuotaExceededError`.
- `infrastructure/adapters/workspace-context.adapter.ts` — hiện thực `WORKSPACE_CONTEXT_PORT`, **fail-safe** (lỗi trả về tập rỗng).
- `application/policy-loaders/workspace-policy.loader.ts` — nạp tài nguyên cho kiểm tra instance.
- `application/commands/delete-workspace.handler.ts` — phát `WORKSPACE_DELETED`.

## 4. Đặc tả giao tiếp kỹ thuật

### 4.1. Điểm cuối (Endpoints)

| Phương thức | Đường dẫn | Chính sách | Mô tả |
|---|---|---|---|
| `POST` | `/api/v1/workspaces` | Đăng nhập | Tạo workspace (tự động là owner) |
| `GET` | `/api/v1/workspaces` | Đăng nhập | Danh sách workspace tôi tham gia |
| `GET` | `/api/v1/workspaces/:id` | Thành viên | Chi tiết |
| `PATCH` | `/api/v1/workspaces/:id` | Owner | Cập nhật |
| `DELETE` | `/api/v1/workspaces/:id` | Owner | Xoá mềm (cascade project) |
| `GET` | `/api/v1/workspaces/:id/members` | Thành viên | Danh sách thành viên |
| `POST` | `/api/v1/workspaces/:id/members` | Owner | Thêm thành viên |
| `DELETE` | `/api/v1/workspaces/:id/members/:userId` | Owner | Xoá thành viên (không xoá owner) |
| `POST` | `/api/v1/workspaces/:id/transfer-owner` | Owner hiện tại | Chuyển quyền sở hữu |
| `POST` | `/api/v1/workspaces/:id/leave` | Thành viên (trừ owner) | Tự rời workspace |

### 4.2. Giao diện / Provider được xuất ra ngoài

`src/backend/src/modules/workspaces/index.ts` xuất hợp đồng công khai:

| Tên xuất | Vai trò |
|---|---|
| `WorkspacesModule` | Mô-đun Nest |
| Thực thể `Workspace`, `WorkspaceRole` | Hợp đồng domain |
| `WORKSPACE_REPOSITORY_PORT` | Cổng truy vấn workspace |
| `WorkspaceQuotaExceededError` | Lỗi nghiệp vụ |

> `WORKSPACE_CONTEXT_PORT` **không** thuộc hợp đồng công khai của mô-đun `workspaces` — nó là cổng tầng `shared` (`shared/application/ports/workspace-context.port.ts`), được `workspaces` **hiện thực** qua `infrastructure/adapters/workspace-context.adapter.ts` (fail-safe: lỗi trả về tập rỗng).

### 4.3. Sự kiện domain phát ra

| Sự kiện | Khi nào | Mục đích |
|---|---|---|
| `workspace.created` | Tạo workspace | Audit log |
| `workspace.member_added` | Thêm thành viên | Thông báo + audit log |
| `workspace.member_removed` | Xoá thành viên | Thông báo + audit log |
| `workspace.owner_transferred` | Chuyển owner | Thông báo cho cả hai bên |
| `WORKSPACE_DELETED` | Xoá workspace | Kích hoạt cascade xoá project |

## 5. Ràng buộc & Tiêu chuẩn bất biến

### 5.1. Bất biến nghiệp vụ

- Workspace **phải** có `ownerId`. Không tồn tại workspace không có chủ sở hữu.
- Chỉ `owner` được thêm / xoá thành viên, chuyển quyền sở hữu.
- **Không** xoá chính owner qua `DELETE /members/:userId` — phải dùng `transfer-owner` trước.
- Owner phải `transfer-owner` trước khi `leave`.
- Số workspace mà người dùng làm **owner** không vượt quá `MAX_WORKSPACES_PER_USER = 20` (trừ admin).
- `storage_used_bytes` không được vượt `WORKSPACE_STORAGE_QUOTA_BYTES`; tổng không vượt `STORAGE_MAX_QUOTA_BYTES`.
- Tên workspace **duy nhất** trong các workspace chưa xoá mềm (partial unique index).

### 5.2. Xoá mềm (Soft Delete)

- **Chuẩn:** `deleted_at: Date | null` — trường này **null** nghĩa là bản ghi đang hoạt động.
- **Quy tắc truy vấn:** mọi truy vấn mặc định luôn lọc `deleted_at: null`. Repository nền (`shared/infrastructure/database/base-mongo.repository.ts`) áp dụng điều này tự động.
- **Chơi index Partial Unique:** `partialFilterExpression: { deleted_at: null }` — cho phép tài khoản / tên / email đã xoá mềm được tạo lại.

### 5.3. Bảo mật

| Vấn đề | Cách xử lý |
|---|---|
| Truy cập workspace người khác | Policy loader nạp instance + kiểm tra `ownerId` / `members` |
| IDOR qua `workspaceId` trong URL | Kiểm tra động của `PoliciesGuard` kiểm tra thuộc tính instance |
| Spam workspace + mời người | Hạn ngạch 20 workspace/người dùng, chỉ owner mới gửi mời |
| Xoá nhầm workspace người khác | Chỉ owner được xoá; policy loader kiểm tra instance |
| Vượt hạn ngạch dung lượng | Kiểm tra quota trước khi ghi, trả lỗi domain |
| Truy vấn ngữ cảnh lỗi | Adapter fail-safe trả tập rỗng thay vì ném lỗi |

### 5.4. Phân quyền

| Tuyến đường | Chính sách |
|---|---|
| `POST /workspaces` | Đăng nhập — tự động là owner |
| `GET /workspaces` | Lọc theo vai trò của tôi |
| `GET /workspaces/:id` | Thành viên |
| `PATCH /workspaces/:id`, `DELETE /workspaces/:id` | Owner |
| `GET /workspaces/:id/members` | Thành viên |
| `POST /workspaces/:id/members`, `DELETE .../members/:userId` | Owner |
| `POST /workspaces/:id/transfer-owner` | Owner hiện tại |
| `POST /workspaces/:id/leave` | Thành viên (trừ owner) |

**Suy ra quyền project từ vai trò workspace:** WS-OWNER → PROJ-OWNER (toàn quyền trên mọi project của workspace); WS-MEMBER → lấy đúng vai trò ghi trong `project.members`, nếu không có → PROJ-VIEWER.

## 6. Lịch sử thay đổi

### 2026-11-21
- **v1.1.0** / 2026-11-21 / Viết lại README mô-đun đầy đủ theo chuẩn 6 phần / Yêu cầu tái đọc / Tài liệu mẫu chuẩn

### 2026-11-XX
- **v1.0.0** / 2026-11-XX / Bổ sung `workspace-context.adapter.ts` hiện thực `WORKSPACE_CONTEXT_PORT` / Bổ sung tầng ngữ cảnh cho mô hình phân quyền 3 tầng / `modules/workspaces`, `shared/application/ports`
- **v0.9.0** / 2026-11-XX / Bổ sung hạn ngạch `MAX_WORKSPACES_PER_USER` và quota dung lượng / Chống spam + bảo vệ hạ tầng / `modules/workspaces`
- **v0.7.0** / 2026-11-XX / Cascade xoá workspace → project → dataset, bọc transaction MongoDB / Tránh trạng thái nửa vời / `modules/workspaces`, `modules/projects`, `modules/datasets`
- **v0.3.0** / 2026-11-XX / Bổ sung `transfer-owner` và `leave` / Vòng đời sở hữu an toàn / `modules/workspaces`
- **v0.1.0** / 2026-11-XX / Tạo mô-đun, tách thành viên vào mảng `members[]` / Kiến trúc Clean Architecture / `modules/workspaces`

- **Định dạng:** `[Phiên bản] / [Ngày] / [Thay đổi gì] / [Lý do] / [Ảnh hưởng đến đâu]`
