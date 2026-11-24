# Module `issues` — Báo Cáo Sự Cố

Kênh báo cáo sự cố của người dùng và xử lý của quản trị: tạo/sửa/xem báo cáo, tải tệp đính kèm, quản trị duyệt trạng thái bằng khóa lạc quan. CQRS đầy đủ, 23 tệp.

## 1. Vị trí và vai trò

- Đường dẫn: `src/backend/src/modules/issues/`
- Loại kiến trúc: CQRS đầy đủ (entity + VO + port + event + 4 lệnh + 5 truy vấn + schema + controller + DTO).
- Sở hữu: collection `issue_reports` + tệp đính kèm trên Storage.
- Cung cấp: `ISSUE_REPORT_REPOSITORY_PORT`, entity, VO trạng thái/loại, 9 handler.

## 2. Cây thư mục đầy đủ

```text
issues/
├── domain/
│   ├── entities/issue-report.entity.ts            # IssueReport (title, description, type, status, expectedVersion, attachments)
│   ├── value-objects/issue-status.vo.ts           # open/in_review/needs_info/resolved/rejected + ALLOWED_TRANSITIONS + USER_EDITABLE
│   ├── value-objects/issue-type.vo.ts            # bug/data_quality/feature/other (ISSUE_TYPES)
│   ├── ports/issue-report.repository.port.ts      # CRUD + list keyset + attachment
│   └── events/issue-events.ts                     # ISSUE_CREATED/STATUS_CHANGED
├── application/
│   ├── commands/ (4)
│   │   ├── create-report.handler.ts               # Tạo báo cáo, trạng thái đầu open
│   │   ├── update-my-report.handler.ts            # User sửa khi status=needs_info
│   │   ├── update-status.handler.ts               # Admin đổi trạng thái, cần expectedVersion
│   │   └── upload-attachment.handler.ts           # Upload png/jpg/pdf <=10MB, tối đa 3 tệp
│   ├── queries/ (5)
│   │   ├── list-mine / get-mine (user)            # Chỉ báo cáo của chính mình
│   │   ├── list-for-admin / get-for-admin (admin) # Toàn hệ thống, lọc status/type
│   │   └── download-attachment.handler.ts         # Trả stream tệp, kiểm tra quyền
│   └── issues.types.ts | issues.utils.ts          # Kiểu + kiểm tra chuyển trạng thái
├── infrastructure/persistence/
│   ├── issue-report.schema.ts                     # Schema (attachments [{id, key, name, size}], version)
│   ├── issue.mapper.ts | issues.repository.ts
├── presentation/
│   ├── controllers/issues.controller.ts           # @Controller() bare, 9 route
│   └── dtos/create-issue.dto.ts                   # CreateIssueSchema, UpdateIssueStatusSchema, ListIssuesQuerySchema
├── issues.module.ts
└── index.ts
```

## 3. Tầng domain chi tiết

- `issue-report.entity.ts`: `MAX_ISSUE_TITLE_LENGTH`, `MAX_ISSUE_DESCRIPTION_LENGTH`, `MAX_ATTACHMENT_SIZE_BYTES` (10MB), `MAX_ATTACHMENT_FILENAME_LENGTH`. `create(title, desc, type)` đặt `status=open`, `updateMine()` chỉ cho khi `isUserEditableIssueStatus(status)` (tức `needs_info`), `changeStatus(next, expectedVersion)` kiểm tra `assertAllowedIssueTransition` + khớp version.
- `issue-status.vo.ts`: `ISSUE_STATUSES`, `ALLOWED_ISSUE_TRANSITIONS` (open->in_review/needs_info, in_review->needs_info/resolved/rejected...), `USER_EDITABLE_ISSUE_STATUSES = [needs_info]`.
- `issue-type.vo.ts`: phân loại để admin lọc và thống kê.

## 4. Tầng application chi tiết

- `CreateReportHandler`: tạo báo cáo + phát `ISSUE_CREATED` (notifications gửi cho admin, audit ghi log).
- `UpdateMyReportHandler`: chỉ khi `needs_info` mới được sửa tiêu đề/mô tả; trạng thái khác trả 403/409.
- `UploadAttachmentHandler`: kiểm tra MIME (png/jpg/pdf), dung lượng, số lượng; upload qua `STORAGE_PORT`; lưu metadata vào `attachments`.
- `UpdateStatusHandler`: admin + `Roles('admin')`, body gồm `status + expectedVersion`; sai version trả 409 chống ghi đè đồng thời.
- `ListMine/GetMine`: ép `author_id = currentUser.id`; `ListForAdmin/GetForAdmin`: không ép, có lọc và keyset.

## 5. Route đầy đủ (9 route)

| Phương thức | Đường dẫn đầy đủ | Bảo vệ | Mô tả |
|---|---|---|---|
| POST | `/api/v1/issues` | JWT | Tạo báo cáo (ISSUE-01, 201). |
| GET | `/api/v1/issues` | JWT | Danh sách báo cáo của tôi, keyset (ISSUE-02). |
| GET | `/api/v1/issues/:id` | JWT | Chi tiết báo cáo của tôi (ISSUE-03). |
| PATCH | `/api/v1/issues/:id` | JWT | Sửa khi `needs_info` (ISSUE-EDIT). |
| POST | `/api/v1/issues/:id/attachments` | JWT | Upload đính kèm (png/jpg/pdf, <=10MB, tối đa 3). |
| GET | `/api/v1/issues/:id/attachments/:attachmentId` | JWT | Tải tệp (kiểm tra quyền, audit log). |
| GET | `/api/v1/admin/issues` | JWT + `Roles('admin')` | Danh sách toàn hệ thống (ISSUE-04, analyst 403). |
| GET | `/api/v1/admin/issues/:id` | JWT + `Roles('admin')` | Chi tiết (quản trị). |
| PATCH | `/api/v1/admin/issues/:id/status` | JWT + `Roles('admin')` | Đổi trạng thái, cần `expectedVersion`. |

## 6. Bất biến

- Vòng đời trạng thái có kiểm soát; user thường không tự đóng/mở tùy ý.
- Tệp qua Storage port (S3/R2 hoặc local), không lưu base64 trong Mongo.
- Mọi đổi trạng thái ghi audit; tải tệp cũng ghi audit.

## 7. Test liên quan

`test/unit/issues/` (entity, transition), `test/unit/workflows/step1-remember-me-and-issue-needs-info.spec.ts`, `test/e2e/issues-admin.e2e-spec.ts`.
