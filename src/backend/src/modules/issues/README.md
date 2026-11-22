# MODULE `issues` - Bao cao loi & Quan tri

> **Module Specification & Documentation**

## 1. Thong tin Phien ban (Version Information)

- **Current Version:** v1.1.0
- **Last Updated:** 2026-11-21
- **Module Path:** `src/backend/src/modules/issues` (23 file TypeScript)
- **Architecture Layer:** Clean Architecture 4 tang (`domain` -> `application` -> `infrastructure` -> `presentation`)
- **Layer Rules:** CA1-CA14 - xem [`../README.md`](../README.md)

## 2. Muc dich & Pham vi Nghiep vu (Scope & Responsibility)

Module cho phep nguoi dung bao loi he thong, kem tep dinh kem, va cho quan tri vien theo doi / xu ly.

### 2.1. Tinh nang thuoc pham vi

| Chuc nang | Noi dung |
|---|---|
| Bao cao | Nguoi dung tao bao cao loi kem tep dinh kem |
| Theo doi | Nguoi dung xem / sua bao cao cua chinh minh |
| Quan tri | Quan tri vien xem tat ca, chuyen trang thai, ghi chu |
| Tep dinh kem | Upload / tai tep, quan ly vong doi file |

### 2.2. Cau truc thu muc

```text
issues/
|-- domain/
|   |-- entities/issue-report.entity.ts
|   |-- value-objects/
|   |   |-- issue-status.vo.ts      # vong doi & chuyen trang thai
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

## 3. Nhat ky Prompting & Quyet dinh Ky thuat (Prompting Log & Rationale)

- **User Prompt / Business Intent:** Cho nguoi dung bao loi he thong va theo doi viec sua chua, dong thoi cho quan tri vien co cong quan tri rieng de xu ly kip thoi.

- **Technical Reasoning & Decisions:**

1. **Ma tran chuyen trang thai tai domain.** `ALLOWED_ISSUE_TRANSITIONS` la **nguon su truth duy nhat** cho viec chuyen trang thai. Chuyen sai -> loi domain, khong phai loi HTTP. `closed` la trang thai **cuoi** - khong mo lai duoc; `resolved` co the quay lai `in_progress` neu phat hien lai loi.

2. **Chi cho sua khi `needs_info`.** `USER_EDITABLE_ISSUE_STATUSES = ['needs_info']`. Chi khi quan tri vien yeu cau bo sung thong tin, nguoi dung moi duoc sua bao cao cua chinh minh. `title`, `description`, `attachments` sua duoc; **`issueType` khong** - loai bao cao la ban chat, khong doi duoc.

3. **Sau khi sua, bao cao tu quay ve `in_progress`.** Nguoi dung tra loi xong -> viec xu ly chay lai tu dau, khong phai tiep tuc tu `resolved`.

4. **Tep dinh kem luu tren R2, metadata trong MongoDB.** Khong luu binary trong document - tai qua `StoragePort` voi kiem tra quyen so huu truoc khi doc file.

5. **Tach route user va route admin.** `/issues*` cho nguoi dung (chi bao cao cua toi), `/admin/issues*` cho quan tri vien. Khac biet ro rang giup audit trail de doc.

- **Generated / Modified Artifacts:**

- `domain/value-objects/issue-status.vo.ts` - `ISSUE_STATUSES` (5 trang thai), `ALLOWED_ISSUE_TRANSITIONS`, `isAllowedIssueTransition`, `assertAllowedIssueTransition`, `isUserEditableIssueStatus`.
- `domain/value-objects/issue-type.vo.ts` - `ISSUE_TYPES` (5 loai).
- `domain/entities/issue-report.entity.ts` - aggregate root.
- `application/commands/update-my-report.handler.ts` - kiem tra `isUserEditableIssueStatus` truoc khi sua.
- `application/commands/update-status.handler.ts` - kiem tra `assertAllowedIssueTransition`.

## 4. Dac ta Giao tiep Ky thuat (Technical Contracts & API Specifications)

### 4.1. Endpoints

| Method | Path | Chinh sach | Mo ta |
|---|---|---|---|
| `POST` | `/api/v1/issues` | Dang nhap | Tao bao cao |
| `GET` | `/api/v1/issues` | Dang nhap | Bao cao cua toi |
| `GET` | `/api/v1/issues/:id` | Chu bao cao hoac admin | Chi tiet |
| `PATCH` | `/api/v1/issues/:id` | Chu bao cao (chi khi `needs_info`) hoac admin | Sua bao cao |
| `POST` | `/api/v1/issues/:id/attachments` | Chu bao cao hoac admin | Them tep dinh kem |
| `GET` | `/api/v1/issues/:id/attachments/:attachmentId` | Chu bao cao hoac admin | Tai tep dinh kem |
| `GET` | `/api/v1/admin/issues` | `@Roles('admin')` | Tat ca bao cao |
| `GET` | `/api/v1/admin/issues/:id` | `@Roles('admin')` | Chi tiet (admin) |
| `PATCH` | `/api/v1/admin/issues/:id/status` | `@Roles('admin')` | Chuyen trang thai |

### 4.2. Interfaces / Providers duoc export ra ngoai

`src/backend/src/modules/issues/index.ts` export public contract:

| Export | Vai tro |
|---|---|
| `IssuesModule` | Nest module |
| `IssueReport` entity, `IssueStatus`, `IssueType` | Domain contract |
| `ISSUE_REPORT_REPOSITORY_PORT` | Port truy van bao cao |

### 4.3. Su kien domain phat ra

| Event | Khi nao | Muc dich |
|---|---|---|
| `issue.created` | Tao bao cao | Audit log + thong bao admin |
| `issue.status_changed` | Chuyen trang thai | Thong bao nguoi dung |
| `issue.attachment_added` | Them tep | Audit log |

## 5. Rang buoc & Tieu chuan Bat bien (Invariants & Security Rules)

### 5.1. Bat bien nghiep vu

| Tu | Sang duoc |
|---|---|
| `new` | `in_progress`, `needs_info` |
| `needs_info` | `in_progress` |
| `in_progress` | `resolved`, `new`, `needs_info` |
| `resolved` | `closed` |
| `closed` | *(khong)* |

- Chi `needs_info` cho phep nguoi dung tu sua bao cao.
- `issueType` **khong** doi duoc khi nguoi dung sua.
- Sau khi nguoi dung sua, trang thai tu quay ve `in_progress`.
- Chi **chu bao cao** hoac **admin** duoc doc / sua bao cao.
- Tep dinh kem phai thuoc dung `issueId` ma nguoi dang truy cap.

### 5.2. Xoa mem (Soft Delete)

- **Chuan:** `deleted_at: Date | null` - truong nay **null** nghia la ban ghi dang hoat dong.
- **Quy tac truy van:** moi truy van mac dinh luon loc `deleted_at: null`. Repository base (`shared/infrastructure/database/base-mongo.repository.ts`) ap dung dieu nay tu dong.
- **Choi index Partial Unique:** `partialFilterExpression: { deleted_at: null }` - cho phep tai khoan / ten / email da xoa mem duoc tao lai.

### 5.3. Bao mat

| Van de | Cach xu ly |
|---|---|
| Doc bao cao cua nguoi khac | Policy loader kiem tra `userId` khu vuc |
| Sua bao cao ngoai trang thai cho phep | `isUserEditableIssueStatus` chan o domain |
| Chuyen trang thai trai phép | `assertAllowedIssueTransition` chan o domain |
| Tai tep dinh kem cua nguoi khac | Kiem tra quyen so huu truoc khi doc file |
| Doi `issueType` de doi bac bao cao | `issueType` khong cho sua khi user tu sua |
| File dinh kem nguy hiem | Giu file tren R2, khong lo truc tiep ra public |

### 5.4. Phan quyen

| Route | Chinh sach |
|---|---|
| `POST /issues` | Dang nhap - bao cao cua toi |
| `GET /issues` | Dang nhap - chi bao cao cua toi |
| `GET /issues/:id` | Chu bao cao hoac admin |
| `PATCH /issues/:id` | Chu bao cao (chi `needs_info`) hoac admin |
| `POST /issues/:id/attachments` | Chu bao cao hoac admin |
| `GET /issues/:id/attachments/:attachmentId` | Chu bao cao hoac admin |
| `GET /admin/issues*`, `PATCH /admin/issues/:id/status` | `@Roles('admin')` |

## 6. Lich su Thay doi (Change Log & Version History)

### 2026-11-21
- **v1.1.0** / 2026-11-21 / Viet lai README module day du theo chuan 6 phan / Yeu cau tai doc / Tai lieu mau chuan

### 2026-11-XX
- **v1.0.0** / 2026-11-XX / Bo sung trang thai `needs_info` va quyen sua bao cao chi khi `needs_info` (quyet dinh 3.21) / Cho phep hoi thong tin nguoi dung ma khong mo quyen sua chung / `modules/issues`
- **v0.6.0** / 2026-11-XX / Bo sung `upload-attachment.handler.ts` va `download-attachment.handler.ts` / Luu bang chung kem loi / `modules/issues`
- **v0.4.0** / 2026-11-XX / Bo sung `ALLOWED_ISSUE_TRANSITIONS` va `assertAllowedIssueTransition` / Chan chuyen trang thai trai phép / `modules/issues`
- **v0.2.0** / 2026-11-XX / Tach route `/admin/issues` / Phan biet quyen nguoi dung va quan tri / `modules/issues`
- **v0.1.0** / 2026-11-XX / Tao module / Chien tiep nhan bao loi / `modules/issues`

- **Dinh dang:** `[Version] / [Ngay] / [Thay doi gi] / [Ly do] / [Anh huong den dau]`
