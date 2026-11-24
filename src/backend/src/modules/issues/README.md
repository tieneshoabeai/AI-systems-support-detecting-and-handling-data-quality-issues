# `issues` — Template: Hexagonal
- Vì sao Hexagonal: optimistic locking expectedVersion + invariant title/desc trong entity + 1 controller chua ca 2 nhom route user + admin/* + cascade attachment
- Bất biến chính: locking + 1 controller (2 nhom route user + admin/* + Roles('admin')) (§12, D14)
- Cấm: gộp entity/port/handler; đổi thứ tự guard/route; đổi hằng số quota/limit.

---
# MÔ-ĐUN `issues` — Báo cáo lỗi & Quản trị

> **Đặc tả mô-đun & Tài liệu kỹ thuật**

## 1. Thông tin phiên bản

- **Phiên bản hiện tại:** v1.1.0
- **Cập nhật lần cuối:** 2026-11-21
- **Đường dẫn mô-đun:** `src/backend/src/modules/issues` (23 tệp TypeScript)
- **Tầng kiến trúc:** Clean Architecture 4 tầng (`domain` → `application` → `infrastructure` → `presentation`)
- **Quy tắc tầng:** CA1–CA14 — xem [`../README.md`](../README.md)

## 2. Mục đích & Phạm vi nghiệp vụ

Mô-đun cho phép người dùng báo lỗi hệ thống, kèm tệp đính kèm, và cho quản trị viên theo dõi / xử lý.

### 2.1. Tính năng thuộc phạm vi

| Chức năng | Nội dung |
|---|---|
| Báo cáo | Người dùng tạo báo cáo lỗi kèm tệp đính kèm |
| Theo dõi | Người dùng xem / sửa báo cáo của chính mình |
| Quản trị | Quản trị viên xem tất cả, chuyển trạng thái, ghi chú |
| Tệp đính kèm | Tải lên / tải về tệp, quản lý vòng đời tệp |

### 2.2. Cấu trúc thư mục

```text
issues/
|-- domain/
|   |-- entities/issue-report.entity.ts
|   |-- value-objects/
|   |   |-- issue-status.vo.ts      # vòng đời & chuyển trạng thái
|   |   |-- issue-type.vo.ts
|   |   `-- attachment.vo.ts
|   |-- events/issue-events.ts
|   `-- ports/issue.repository.port.ts
|-- application/
|   |-- commands/                    # 4 command handler
|   |-- queries/                     # 5 query handler
|   |-- issues.types.ts
|   `-- issues.utils.ts
|-- infrastructure/persistence/
|   |-- issue-report.schema.ts
|   |-- issue-attachment.schema.ts
|   |-- issues.repository.ts
|   `-- issue.mapper.ts
`-- presentation/
    |-- controllers/issues.controller.ts
    |-- controllers/admin-issues.controller.ts
    |-- dtos/                         # 1 DTO
    `-- responses/issue.response.ts
```

## 3. Nhật ký Prompting & Quyết định kỹ thuật

- **Yêu cầu người dùng / Ý đồ nghiệp vụ:** Cho người dùng báo lỗi hệ thống và theo dõi việc sửa chữa, đồng thời cho quản trị viên có công cụ quản trị riêng để xử lý kịp thời.

- **Lập luận kỹ thuật & Quyết định:**

1. **Ma trận chuyển trạng thái tại domain.** `ALLOWED_ISSUE_TRANSITIONS` là **nguồn sự thật duy nhất** cho việc chuyển trạng thái. Chuyển sai → lỗi domain, không phải lỗi HTTP. `closed` là trạng thái **cuối** — không mở lại được; `resolved` có thể quay lại `in_progress` nếu phát hiện lại lỗi.

2. **Chỉ cho sửa khi `needs_info`.** `USER_EDITABLE_ISSUE_STATUSES = ['needs_info']`. Chỉ khi quản trị viên yêu cầu bổ sung thông tin, người dùng mới được sửa báo cáo của chính mình. `title`, `description`, `attachments` sửa được; **`issueType` không** — loại báo cáo là bản chất, không đổi được.

3. **Sau khi sửa, báo cáo tự quay về `in_progress`.** Người dùng trả lời xong → việc xử lý chạy lại từ đầu, không phải tiếp tục từ `resolved`.

4. **Tệp đính kèm lưu trên R2, metadata trong MongoDB.** Không lưu binary trong document — tải qua `StoragePort` với kiểm tra quyền sở hữu trước khi đọc tệp.

5. **Tách route người dùng và route admin.** `/issues*` cho người dùng (chỉ báo cáo của tôi), `/admin/issues*` cho quản trị viên. Khác biệt rõ ràng giúp audit trail dễ đọc.

- **Hiện vật đã tạo / đã sửa:**

- `domain/value-objects/issue-status.vo.ts` — `ISSUE_STATUSES` (5 trạng thái), `ALLOWED_ISSUE_TRANSITIONS`, `isAllowedIssueTransition`, `assertAllowedIssueTransition`, `isUserEditableIssueStatus`.
- `domain/value-objects/issue-type.vo.ts` — `ISSUE_TYPES` (5 loại).
- `domain/entities/issue-report.entity.ts` — aggregate root.
- `application/commands/update-my-report.handler.ts` — kiểm tra `isUserEditableIssueStatus` trước khi sửa.
- `application/commands/update-status.handler.ts` — kiểm tra `assertAllowedIssueTransition`.

## 4. Đặc tả giao tiếp kỹ thuật

### 4.1. Điểm cuối (Endpoints)

| Phương thức | Đường dẫn | Chính sách | Mô tả |
|---|---|---|---|
| `POST` | `/api/v1/issues` | Đăng nhập | Tạo báo cáo |
| `GET` | `/api/v1/issues` | Đăng nhập | Báo cáo của tôi |
| `GET` | `/api/v1/issues/:id` | Chủ báo cáo hoặc admin | Chi tiết |
| `PATCH` | `/api/v1/issues/:id` | Chủ báo cáo (chỉ khi `needs_info`) hoặc admin | Sửa báo cáo |
| `POST` | `/api/v1/issues/:id/attachments` | Chủ báo cáo hoặc admin | Thêm tệp đính kèm |
| `GET` | `/api/v1/issues/:id/attachments/:attachmentId` | Chủ báo cáo hoặc admin | Tải tệp đính kèm |
| `GET` | `/api/v1/admin/issues` | `@Roles('admin')` | Tất cả báo cáo |
| `GET` | `/api/v1/admin/issues/:id` | `@Roles('admin')` | Chi tiết (admin) |
| `PATCH` | `/api/v1/admin/issues/:id/status` | `@Roles('admin')` | Chuyển trạng thái |

### 4.2. Giao diện / Provider được xuất ra ngoài

`src/backend/src/modules/issues/index.ts` xuất hợp đồng công khai:

| Tên xuất | Vai trò |
|---|---|
| `IssuesModule` | Mô-đun Nest |
| Thực thể `IssueReport`, `IssueStatus`, `IssueType` | Hợp đồng domain |
| `ISSUE_REPORT_REPOSITORY_PORT` | Cổng truy vấn báo cáo |

### 4.3. Sự kiện domain phát ra

| Sự kiện | Khi nào | Mục đích |
|---|---|---|
| `issue.created` | Tạo báo cáo | Audit log + thông báo admin |
| `issue.status_changed` | Chuyển trạng thái | Thông báo người dùng |
| `issue.attachment_added` | Thêm tệp | Audit log |

## 5. Ràng buộc & Tiêu chuẩn bất biến

### 5.1. Bất biến nghiệp vụ

| Từ | Sang được |
|---|---|
| `new` | `in_progress`, `needs_info` |
| `needs_info` | `in_progress` |
| `in_progress` | `resolved`, `new`, `needs_info` |
| `resolved` | `closed` |
| `closed` | *(không)* |

- Chỉ `needs_info` cho phép người dùng tự sửa báo cáo.
- `issueType` **không** đổi được khi người dùng tự sửa.
- Sau khi người dùng sửa, trạng thái tự quay về `in_progress`.
- Chỉ **chủ báo cáo** hoặc **admin** được đọc / sửa báo cáo.
- Tệp đính kèm phải thuộc đúng `issueId` mà người đang truy cập.

### 5.2. Xoá mềm (Soft Delete)

- **Chuẩn:** `deleted_at: Date | null` — trường này **null** nghĩa là bản ghi đang hoạt động.
- **Quy tắc truy vấn:** mọi truy vấn mặc định luôn lọc `deleted_at: null`. Repository nền (`shared/infrastructure/database/base-mongo.repository.ts`) áp dụng điều này tự động.
- **Chơi index Partial Unique:** `partialFilterExpression: { deleted_at: null }` — cho phép tài khoản / tên / email đã xoá mềm được tạo lại.

### 5.3. Bảo mật

| Vấn đề | Cách xử lý |
|---|---|
| Đọc báo cáo của người khác | Policy loader kiểm tra `userId` khu vực |
| Sửa báo cáo ngoài trạng thái cho phép | `isUserEditableIssueStatus` chặn ở domain |
| Chuyển trạng thái trái phép | `assertAllowedIssueTransition` chặn ở domain |
| Tải tệp đính kèm của người khác | Kiểm tra quyền sở hữu trước khi đọc tệp |
| Đổi `issueType` để nâng hạng báo cáo | `issueType` không cho sửa khi người dùng tự sửa |
| Tệp đính kèm nguy hiểm | Giữ tệp trên R2, không lộ trực tiếp ra public |

### 5.4. Phân quyền

| Tuyến đường | Chính sách |
|---|---|
| `POST /issues` | Đăng nhập — báo cáo của tôi |
| `GET /issues` | Đăng nhập — chỉ báo cáo của tôi |
| `GET /issues/:id` | Chủ báo cáo hoặc admin |
| `PATCH /issues/:id` | Chủ báo cáo (chỉ `needs_info`) hoặc admin |
| `POST /issues/:id/attachments` | Chủ báo cáo hoặc admin |
| `GET /issues/:id/attachments/:attachmentId` | Chủ báo cáo hoặc admin |
| `GET /admin/issues*`, `PATCH /admin/issues/:id/status` | `@Roles('admin')` |

## 6. Lịch sử thay đổi

### 2026-11-21
- **v1.1.0** / 2026-11-21 / Viết lại README mô-đun đầy đủ theo chuẩn 6 phần / Yêu cầu tái đọc / Tài liệu mẫu chuẩn

### 2026-11-XX
- **v1.0.0** / 2026-11-XX / Bổ sung trạng thái `needs_info` và quyền sửa báo cáo chỉ khi `needs_info` (quyết định 3.21) / Cho phép hỏi thêm thông tin người dùng mà không mở quyền sửa chung / `modules/issues`
- **v0.6.0** / 2026-11-XX / Bổ sung `upload-attachment.handler.ts` và `download-attachment.handler.ts` / Lưu bằng chứng kèm lỗi / `modules/issues`
- **v0.4.0** / 2026-11-XX / Bổ sung `ALLOWED_ISSUE_TRANSITIONS` và `assertAllowedIssueTransition` / Chặn chuyển trạng thái trái phép / `modules/issues`
- **v0.2.0** / 2026-11-XX / Tách route `/admin/issues` / Phân biệt quyền người dùng và quản trị / `modules/issues`
- **v0.1.0** / 2026-11-XX / Tạo mô-đun / Kênh tiếp nhận báo lỗi / `modules/issues`

- **Định dạng:** `[Phiên bản] / [Ngày] / [Thay đổi gì] / [Lý do] / [Ảnh hưởng đến đâu]`
