# MÔ-ĐUN `projects` — Dự án phân tích

> **Đặc tả mô-đun & Tài liệu kỹ thuật**

## 1. Thông tin phiên bản

- **Phiên bản hiện tại:** v1.1.0
- **Cập nhật lần cuối:** 2026-11-21
- **Đường dẫn mô-đun:** `src/backend/src/modules/projects` (43 tệp TypeScript)
- **Tầng kiến trúc:** Clean Architecture 4 tầng (`domain` → `application` → `infrastructure` → `presentation`)
- **Quy tắc tầng:** CA1–CA14 — xem [`../README.md`](../README.md)

## 2. Mục đích & Phạm vi nghiệp vụ

Project là **đơn vị công việc** trong một workspace: nơi chứa dataset, chạy phân tích chất lượng dữ liệu và sinh báo cáo.

```text
Workspace ---> Project ---> Dataset ---> DataRecord
                      |---> Analysis (kết quả DQ + AI)
                      `---> ProjectSave (bản lưu của người dùng)
```

### 2.1. Tính năng thuộc phạm vi

| Chức năng | Nội dung |
|---|---|
| CRUD project | Tạo, đọc, cập nhật, xoá mềm |
| Thành viên | Thêm, đổi vai trò, xoá, chuyển owner |
| Trạng thái | `not_started` → `in_progress` → `completed` |
| Snapshot | Lưu trạng thái với khoá lạc quan (`expectedVersion`) |
| Phân quyền ngữ cảnh | Giải quyết vai trò project của người dùng theo từng request |
| Cascade | Xoá project → xoá dataset + tệp trên R2 bên trong |

### 2.2. Cấu trúc thư mục

```text
projects/
|-- domain/
|   |-- entities/project.entity.ts
|   |-- value-objects/
|   |   |-- project-role.vo.ts       # owner | member | viewer + ma trận quyền
|   |   `-- project-status.vo.ts     # not_started | in_progress | completed
|   |-- events/project-events.ts
|   `-- ports/
|       |-- project.repository.port.ts
|       `-- project.access.port.ts
|-- application/
|   |-- commands/                    # 10 command handler
|   |-- queries/                     # 7 query handler
|   |-- policy-loaders/
|   |   |-- project-policy.loader.ts
|   |   |-- project-scope-policy.loader.ts
|   |   `-- workspace-scope-policy.loader.ts
|   |-- projects.types.ts
|   `-- projects.utils.ts
|-- infrastructure/
|   |-- adapters/
|   |   |-- project-access.adapter.ts
|   |   `-- project-context.adapter.ts     # hiện thực PROJECT_CONTEXT_PORT
|   `-- persistence/                  # schema, repository, mapper
`-- presentation/
    |-- controllers/projects.controller.ts
    |-- dtos/                          # 5 DTO
    `-- responses/project.response.ts
```

## 3. Nhật ký Prompting & Quyết định kỹ thuật

- **Yêu cầu người dùng / Ý đồ nghiệp vụ:** Làm `projects` là **tầng cuối cùng** của mô hình phân quyền (3 vai trò: `owner` | `member` | `viewer`) và là **đơn vị công việc** mà dataset, phân tích và báo cáo đều gắn vào.

- **Lập luận kỹ thuật & Quyết định:**

1. **Ma trận quyền tập trung trong VO, không rải rác.** `canModerateProject(projectRole, workspaceRole)` và `canAccessProject(projectRole, workspaceRole)` trong `project-role.vo.ts` là **nguồn sự thật duy nhất**. Entity gọi qua `assertCanModerate()` / `assertCanAccess()`, handler không tự viết lại điều kiện. Cách này loại bỏ lớp lỗi "kiểm tra ở controller một kiểu, ở service một kiểu, ở query một kiểu".

2. **Ba vai trò project.** `owner` (toàn quyền), `member` (được ghi: thêm dataset, chạy phân tích), `viewer` (chỉ đọc). Vai trò `owner` và `member` phân biệt nhau ở hạ tầng ghi; `viewer` được tách ở hạ tầng đọc để phân biệt quyền đọc với quyền ghi.

3. **Suy ra vai trò từ workspace.** `ProjectContextAdapter` áp dụng: WS-OWNER → PROJ-OWNER; có mặt trong `project.members` → lấy đúng vai trò ghi trong DB; WS-MEMBER mặc định → PROJ-VIEWER. Nhờ vậy **thêm** một người vào workspace không tự động cấp quyền ghi — phải thêm vào project.

4. **Khoá lạc quan (optimistic locking).** `PUT /projects/:id/snapshot` nhận `expectedVersion`; lệch → `ConflictError` (HTTP 409). Nếu không có khoá, hai người cùng sửa một project sẽ ghi đè lẫn nhau.

5. **Ba policy loader.** `ProjectPolicyLoader` (theo `:id`), `ProjectScopePolicyLoader` (theo danh sách id), `WorkspaceScopePolicyLoader` (theo workspace id). Tách riêng để mỗi loader chỉ lo một phạm vi và tránh tải nhầm phạm vi.

6. **Cascade qua outbox event + transaction.** Xoá project phải xoá dataset và tệp trên R2. Làm trực tiếp trong handler tạo trạng thái nửa vời; transaction bảo đảm nhất quán.

- **Hiện vật đã tạo / đã sửa:**

- `domain/value-objects/project-role.vo.ts` — `ProjectMemberRole`, `canModerateProject`, `canAccessProject`.
- `domain/value-objects/project-status.vo.ts` — `PROJECT_STATUSES`, `isProjectCompleted`.
- `infrastructure/adapters/project-context.adapter.ts` — hiện thực `PROJECT_CONTEXT_PORT`, fail-safe.
- `application/policy-loaders/` — 3 loader.
- `application/commands/delete-project.handler.ts` + `cascade-project-datasets.handler.ts` — cascade.

## 4. Đặc tả giao tiếp kỹ thuật

### 4.1. Điểm cuối (Endpoints)

| Phương thức | Đường dẫn | Chính sách | Mô tả |
|---|---|---|---|
| `POST` | `/api/v1/workspaces/:workspaceId/projects` | Thành viên workspace | Tạo project |
| `GET` | `/api/v1/workspaces/:workspaceId/projects` | Thành viên workspace | Liệt kê project của workspace |
| `GET` | `/api/v1/projects` | Đăng nhập | Liệt kê project theo vai trò của tôi |
| `GET` | `/api/v1/projects/:id` | `canAccessProject` | Chi tiết project |
| `PATCH` | `/api/v1/projects/:id` | `canModerateProject` | Cập nhật |
| `DELETE` | `/api/v1/projects/:id` | `canModerateProject` | Xoá mềm (cascade) |
| `PUT` | `/api/v1/projects/:id/snapshot` | `Action.Execute` | Lưu trạng thái (khoá lạc quan) |
| `GET` | `/api/v1/projects/:id/members` | `canAccessProject` | Danh sách thành viên |
| `POST` | `/api/v1/projects/:id/members` | `canModerateProject` | Thêm thành viên |
| `PATCH` | `/api/v1/projects/:id/members/:userId` | `canModerateProject` | Đổi vai trò |
| `DELETE` | `/api/v1/projects/:id/members/:userId` | `canModerateProject` | Xoá thành viên |
| `POST` | `/api/v1/projects/:id/transfer-owner` | Owner hiện tại | Chuyển quyền sở hữu |

### 4.2. Giao diện / Provider được xuất ra ngoài

`src/backend/src/modules/projects/index.ts` xuất hợp đồng công khai:

| Tên xuất | Vai trò |
|---|---|
| `ProjectsModule` | Mô-đun Nest |
| Thực thể `Project`, `ProjectRole`, `ProjectStatus` | Hợp đồng domain |
| `PROJECT_REPOSITORY_PORT` | Cổng truy vấn project |

> `PROJECT_CONTEXT_PORT` **không** thuộc hợp đồng công khai của mô-đun `projects` — nó là cổng tầng `shared` (`shared/application/ports/project-context.port.ts`), được `projects` **hiện thực** qua `infrastructure/adapters/project-context.adapter.ts`.

### 4.3. Sự kiện domain phát ra

| Sự kiện | Khi nào | Mục đích |
|---|---|---|
| `project.created` | Tạo project | Audit log + thông báo |
| `project.updated` | Cập nhật project | Audit log |
| `project.member_added` | Thêm thành viên | Thông báo |
| `project.member_removed` | Xoá thành viên | Thông báo |
| `project.owner_transferred` | Chuyển owner | Thông báo cho cả hai bên |
| `PROJECT_DELETED` | Xoá project | Kích hoạt cascade xoá dataset |

## 5. Ràng buộc & Tiêu chuẩn bất biến

### 5.1. Bất biến nghiệp vụ

- Project **phải** thuộc một `workspaceId` và có `ownerId`.
- Chỉ `canModerateProject` được thêm / xoá / đổi vai trò thành viên, cập nhật, xoá project.
- Không xoá chính owner qua `DELETE /members/:userId` — phải `transfer-owner` trước.
- `status` chỉ nhận một trong `{ not_started, in_progress, completed }`.
- `completed` là trạng thái cuối — không quay lại.
- `version` tăng **đơn điệu**; `expectedVersion` lệch → `ConflictError` (409).
- Không thể đặt vai trò `viewer` cho chính owner hiện tại.
- Chỉ workspace owner / project owner được chuyển quyền sở hữu.

### 5.2. Xoá mềm (Soft Delete)

- **Chuẩn:** `deleted_at: Date | null` — trường này **null** nghĩa là bản ghi đang hoạt động.
- **Quy tắc truy vấn:** mọi truy vấn mặc định luôn lọc `deleted_at: null`. Repository nền (`shared/infrastructure/database/base-mongo.repository.ts`) áp dụng điều này tự động.
- **Chơi index Partial Unique:** `partialFilterExpression: { deleted_at: null }` — cho phép tài khoản / tên / email đã xoá mềm được tạo lại.

### 5.3. Bảo mật

| Vấn đề | Cách xử lý |
|---|---|
| IDOR qua `projectId` | Kiểm tra động nạp instance + kiểm tra `workspaceId` / `members` |
| Thành viên project xem project khác | `canAccessProject` kiểm tra cả vai trò project và workspace |
| Ghi đè thay đổi của người khác | Khoá lạc quan qua `expectedVersion` → 409 |
| Chuyển quyền sở hữu không đúng người | Policy loader + kiểm tra owner hiện tại |
| Xoá nhầm project người khác | Chỉ owner được xoá |
| Truy vấn ngữ cảnh lỗi | Adapter fail-safe trả tập rỗng |

### 5.4. Phân quyền

**Ma trận quyền:**

| Quyền | PROJ-OWNER | PROJ-MEMBER | PROJ-VIEWER | WS-OWNER |
|---|---|---|---|---|
| Đọc project | Có | Có | Có | Có |
| Chạy phân tích | Có | Có | Không | Có |
| Xem dataset | Có | Có | Có | Có |
| Quản lý thành viên | Có | Không | Không | Có |
| Cập nhật project | Có | Không | Không | Có |
| Xoá project | Có | Không | Không | Có |

**Suy ra vai trò:** WS-OWNER → PROJ-OWNER; có trong `project.members` → vai trò ghi trong DB; WS-MEMBER mặc định → PROJ-VIEWER.

## 6. Lịch sử thay đổi

### 2026-11-21
- **v1.1.0** / 2026-11-21 / Viết lại README mô-đun đầy đủ theo chuẩn 6 phần / Yêu cầu tái đọc / Tài liệu mẫu chuẩn

### 2026-11-XX
- **v1.0.0** / 2026-11-XX / Bổ sung `project-context.adapter.ts` hiện thực `PROJECT_CONTEXT_PORT` và 3 policy loader / Hoàn thiện tầng ngữ cảnh của mô hình phân quyền 3 tầng / `modules/projects`
- **v0.9.0** / 2026-11-XX / Bổ sung khoá lạc quan qua `expectedVersion` trên `PUT /snapshot` / Chặn ghi đè thay đổi / `modules/projects`
- **v0.8.0** / 2026-11-XX / Cascade xoá project → dataset → tệp R2, bọc transaction MongoDB / Bảo đảm nhất quán / `modules/projects`, `modules/datasets`
- **v0.4.0** / 2026-11-XX / Bổ sung `transfer-owner` và đổi vai trò thành viên / Vòng đời sở hữu an toàn / `modules/projects`
- **v0.1.0** / 2026-11-XX / Tạo mô-đun, tách thành viên vào mảng `members[]` / Kiến trúc Clean Architecture / `modules/projects`

- **Định dạng:** `[Phiên bản] / [Ngày] / [Thay đổi gì] / [Lý do] / [Ảnh hưởng đến đâu]`
