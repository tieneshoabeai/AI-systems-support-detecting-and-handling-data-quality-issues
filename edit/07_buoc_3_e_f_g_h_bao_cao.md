# Báo cáo Bước 3 — Nhóm E + F + G + H

> **Ngày thực hiện:** 2026-11-15
> **Kế hoạch nguồn:** `edit/02_ke_hoach_thuc_thien.md` — Nhóm E (E1–E6), Nhóm F (F1–F5), Nhóm G (G1–G5), Nhóm H (H1–H3)
> **Bước trước:** Bước 2 — Nhóm A (keyset cursor pagination), commit `873355a`

---

## 1. Tóm tắt

Bước 3 triển khai 4 nhóm tính năng còn thiếu so với đặc tả 79 tính năng:

| Nhóm | Mã | Nội dung | Trạng thái |
|---|---|---|---|
| **E** | E1–E6 | Tìm kiếm/lọc thành viên + 2 endpoint tổng quan | ✅ |
| **F** | F1–F5 | Tạo project chỉ định Project Owner | ✅ |
| **G** | G1–G5 | Hồ sơ cá nhân: `phone` + `bio` | ✅ |
| **H** | H1–H3 | 3 API nhỏ (chi tiết phiên, mời thành viên, `workspaceName`) | ✅ |

**Kết quả kiểm thử:** 252 unit test + 52 E2E test + 16 test kiến trúc — **tất cả PASS**. ESLint: **0 error**. TypeScript: **compile sạch**.

---

## 2. Nhóm E — Tìm kiếm/lọc thành viên + endpoint tổng quan

### 2.1. E1/E2 — Tìm kiếm & lọc thành viên

Hai endpoint danh sách thành viên được chuyển từ trả về toàn bộ mảng (`{ members, total }`) sang **keyset cursor pagination** kèm tìm kiếm/lọc:

| Endpoint | Trước | Sau |
|---|---|---|
| `GET /workspaces/{id}/members` | `{ members: [...], total: n }` | `?search=&role=&sort=&cursor=&limit=` → `{ items, meta: { nextCursor, hasMore, limit } }` |
| `GET /projects/{id}/members` | `{ members: [...], total: n }` | `?search=&role=&sort=&cursor=&limit=` → `{ items, meta: { nextCursor, hasMore, limit } }` |

**Query parameter:**

| Tham số | Kiểu | Mặc định | Ràng buộc |
|---|---|---|---|
| `search` | chuỗi | — | trim, tìm theo tên/email, không phân biệt hoa/thường |
| `role` | `owner`\|`member` (workspace) · `owner`\|`member`\|`viewer` (project) | — | Giá trị khác → `VALIDATION_ERROR` |
| `sort` | `name_asc`\|`name_desc`\|`joined`\|`role` | `name_asc` | Cursor ràng buộc theo `sort` |
| `cursor` | chuỗi opaque | — | Hỏng / sai `sort` → `VALIDATION_ERROR` |
| `limit` | số nguyên | 15 | 1–100 |

**Item shape** (đã populate hồ sơ — E6):

```json
{
  "id": "507f1f77bcf86cd799439011",
  "userId": "507f1f77bcf86cd799439011",
  "role": "owner",
  "joinedAt": "2026-01-01T00:00:00.000Z",
  "email": "an@shool.local",
  "firstName": "An",
  "lastName": "Owner",
  "avatarUrl": null
}
```

### 2.2. E6 — Populate hồ sơ thành viên

Thêm 2 method mới vào `UserRepositoryPort`:
- `findByIds(ids: string[]): Promise<UserRecord[]>` — lấy nhiều user một lần (tránh N+1).
- `findByPhone(phone: string): Promise<UserRecord | null>` — dùng cho Nhóm G.

### 2.3. E3/E4 — Endpoint tổng quan

| Mã | Endpoint | Trả về |
|---|---|---|
| E3 | `GET /overview/workspaces` | `totalWorkspaces`, `totalProjects`, `ownedWorkspaces`, `sharedWorkspaces`, `myProjects` |
| E4 | `GET /workspaces/{id}/overview` | `projectCount`, `notStartedCount`, `inProgressCount`, `completedCount`, `memberCount`, `storageUsedBytes`, `lastAccessedAt` |

> **Về đường dẫn E3:** Kế hoạch ghi `GET /workspaces/overview`, nhưng đường này **xung đột** với route `GET /workspaces/:id` của `WorkspacesController` — NestJS phân giải route theo thứ tự đăng ký, nên chuỗi `overview` có thể bị nuốt vào `:id` và trả 404 sai ý nghĩa.
>
> **Quyết định:** dùng `GET /overview/workspaces` — không xung đột, đúng ngữ nghĩa REST (tài nguyên "overview" của người dùng). E4 giữ nguyên `GET /workspaces/{id}/overview` vì 3 phân đoạn không xung đột với route nào.

### 2.4. Module `overview` mới — tránh vòng phụ thuộc module

E3 cần đếm workspace **và** project; E4 cần đếm project **theo workspace**. Nếu đặt các method này vào `WorkspacesService` thì `workspaces` sẽ phải import `projects` — trong khi `ProjectsService` **đã** import `workspaces` → **chu trình module** (vi phạm CA9).

**Giải pháp:** tách module `overview` độc lập:

```
modules/overview/
├── application/overview.service.ts      # chỉ ĐỌC, gom chỉ số từ 2 port
├── infrastructure/http/overview.controller.ts
├── overview.module.ts                    # imports: WorkspacesModule, ProjectsModule
└── index.ts                              # public contract
```

Module này chỉ đọc nên có thể import cả hai mà không tạo chu trình.

---

## 3. Nhóm F — Tạo project chỉ định Project Owner

### 3.1. Thay đổi hợp đồng

```diff
  POST /workspaces/{workspaceId}/projects
  {
    "name": "Phân tích khách hàng Q4",
-   "description": "..."
+   "description": "...",
+   "owner_id": "507f1f77bcf86cd799439011"   // optional
  }
```

### 3.2. Quy tắc

| Mã | Quy tắc |
|---|---|
| F1 | `owner_id` là **tuỳ chọn**. Bỏ trống → người tạo (Workspace Owner) làm Project Owner. |
| F2 | `owner_id` phải là **thành viên của workspace** → nếu không → `400 VALIDATION_ERROR`. |
| F2b | `owner_id` không tồn tại trong hệ thống → `400 VALIDATION_ERROR`. |
| F3 | Người gọi vẫn phải là Workspace Owner (không đổi quy tắc hiện tại). |
| F4 | `memberIds` **không** gộp vào vòng này — thêm thành viên qua `POST /projects/{id}/members` (đã có). |
| F5 | Import dataset **không** gộp vào request tạo project. |

### 3.3. Triển khai

- `CreateProjectRecord` trong domain port có thêm `ownerId?: string`.
- `ProjectsRepository.create()` dùng `ownerId ?? createdBy` cho member role `owner`.
- `ProjectsService.createProject()` validate F2/F2b trước khi gọi repository.

---

## 4. Nhóm G — Hồ sơ cá nhân: `phone` + `bio`

### 4.1. Schema & validation

| Trường | Kiểu | Ràng buộc | Lưu trữ |
|---|---|---|---|
| `phone` | `string \| null` | Regex `^\+?[0-9]{8,15}$` — **duy nhất** (partial unique index) | `user.phone` |
| `bio` | `string \| null` | Tối đa **500 ký tự** | `user.bio` |

**Partial unique index** (chỉ áp dụng khi có giá trị, không ảnh hưởng tài khoản cũ):

```javascript
UserSchema.index(
  { phone: 1 },
  { unique: true, partialFilterExpression: { phone: { $type: 'string' } } }
);
```

### 4.2. Luồng cập nhật

`PATCH /users/me` với `{ phone, bio }`:

1. Nếu `phone` khác rỗng → `findByPhone()` kiểm tra đã thuộc tài khoản khác chưa → nếu có → `409 CONFLICT`.
2. `phone: ''` hoặc `bio: ''` → đặt `null` (xoá giá trị).
3. `phone`/`bio` không được truyền → không gọi `findByPhone`, không đụng tới field.

### 4.3. G3 — Không cho user tự sửa `role`

Giữ nguyên: `role` chỉ admin sửa qua `admin-users.controller.ts`. Zod mặc định **strip** field lạ nên `PATCH /users/me` với `{ "role": "admin" }` bị bỏ qua hoàn toàn.

---

## 5. Nhóm H — 3 API nhỏ

| Mã | Nội dung | Trạng thái |
|---|---|---|
| **H1** | `GET /auth/sessions/{id}` — chi tiết 1 phiên, chặn IDOR (kiểm `user_id` khớp, trả 404 chứ không 403) | ✅ Đã có từ Bước 1 |
| **H2** | `CreateWorkspaceSchema` thêm `member_emails?: string[]` | ✅ Mới |
| **H3** | `GET /projects/{id}` response thêm `workspaceName` | ✅ Mới |

### 5.1. H2 — Mời thành viên kèm lúc tạo workspace

```json
POST /workspaces
{
  "name": "Phòng Ban Kỹ Thuật",
  "description": "...",
  "member_emails": ["a@shool.local", "b@shool.local"]
}
```

- Validate email (Zod), tối đa **50** email.
- Email của chính người tạo → bỏ qua (đã là owner).
- Email **chưa có tài khoản** → `400 VALIDATION_ERROR` với `details.missingEmails` liệt kê các email không tồn tại.
  > **Quyết định:** báo lỗi rõ ràng thay vì tạo member "pending" ẩn — tránh trạng thái ma (workspace có member không tồn tại).

### 5.2. H3 — `workspaceName` trong chi tiết project

```json
GET /projects/{projectId}
{
  "project": {
    "id": "...",
    "name": "...",
    "workspaceId": "...",
    "workspaceName": "Phòng Ban Kỹ Thuật",
    "..."
  }
}
```

Frontend không cần gọi thêm 1 request để hiển thị tên workspace.

---

## 6. Các file đã thay đổi

### 6.1. File mới

| File | Nội dung |
|---|---|
| `src/shared/pagination/keyset-generic-memory.util.ts` | Keyset pagination in-memory **tổng quát** cho danh sách embedded (thành viên): `compareGeneric`, `isAfterGenericCursor`, `genericSortValue`, `GenericSortSpec` |
| `src/modules/overview/application/overview.service.ts` | `getUserOverview` (E3), `getWorkspaceOverview` (E4) |
| `src/modules/overview/infrastructure/http/overview.controller.ts` | `GET /overview/workspaces`, `GET /workspaces/:id/overview` |
| `src/modules/overview/overview.module.ts` | Composition root đọc-only |
| `src/modules/overview/index.ts` | Public contract |
| `src/modules/workspaces/index.ts` | Public contract (CA8) |
| `src/modules/projects/index.ts` | Public contract (CA8) |
| `src/modules/users/index.ts` | Public contract (CA8) |
| `src/modules/workspaces/infrastructure/http/dtos/list-workspace-members-query.dto.ts` | Zod schema query WS-06 |
| `src/modules/projects/infrastructure/http/dtos/list-project-members-query.dto.ts` | Zod schema query PROJ-09 |
| `test/step3-efgh.spec.ts` | **34 ca test** cho Nhóm E/F/G/H |

### 6.2. File đã sửa

| File | Thay đổi |
|---|---|
| `modules/users/infrastructure/persistence/user.schema.ts` | Thêm `phone`, `bio` + partial unique index cho `phone` |
| `modules/users/domain/ports/user.repository.port.ts` | `UserRecord` thêm `phone`/`bio`; `UpdateProfileInput` thêm `phone`/`bio`; port thêm `findByPhone`, `findByIds` |
| `modules/users/infrastructure/persistence/users.repository.ts` | Map `phone`/`bio`; implement `findByPhone`, `findByIds`; `updateProfile` ghi `phone`/`bio` |
| `modules/users/application/users.service.ts` | `updateProfile` kiểm tra duy nhất `phone` → `409 CONFLICT` |
| `modules/users/infrastructure/http/dtos/update-user.dto.ts` | Thêm `phone` (regex E.164-ish) + `bio` (max 500) |
| `modules/workspaces/domain/ports/workspace.repository.port.ts` | `WorkspaceMemberView`; `WORKSPACE_MEMBER_SORT_OPTIONS`; `WorkspaceMembersListInput`; port thêm `countActive`, `countOwnedByUser`, `countSharedByUser` |
| `modules/workspaces/infrastructure/persistence/workspaces.repository.ts` | Implement 3 method đếm |
| `modules/workspaces/application/workspaces.service.ts` | `listMembers()` (search/lọc/keyset); `createWorkspace()` hỗ trợ `member_emails` |
| `modules/workspaces/infrastructure/http/workspaces.controller.ts` | `WS-06` nhận query + `@ApiZodQuery` |
| `modules/workspaces/infrastructure/http/dtos/create-workspace.dto.ts` | Thêm `member_emails` |
| `modules/projects/domain/ports/project.repository.port.ts` | `ProjectMemberView`; `PROJECT_MEMBER_SORT_OPTIONS`; `ProjectMembersListInput`; `CreateProjectRecord.ownerId`; port thêm `countByWorkspace`, `countByUser` |
| `modules/projects/infrastructure/persistence/projects.repository.ts` | `create()` dùng `ownerId`; implement 2 method đếm |
| `modules/projects/application/projects.service.ts` | `createProject()` validate `owner_id` (F2/F2b); `listMembers()` (E2); `getWorkspaceName()` (H3) |
| `modules/projects/infrastructure/http/projects.controller.ts` | `PROJ-09` nhận query + `@ApiZodQuery`; `PROJ-03` thêm `workspaceName` |
| `modules/projects/infrastructure/http/dtos/create-project.dto.ts` | Thêm `owner_id` |
| `app.module.ts` | Đăng ký `OverviewModule` |

### 6.3. Public contract (CA8)

Ba file `index.ts` mới cho workspaces / projects / users được tạo để tuân thủ quy tắc CA8 (cross-module import phải đi qua public contract). `OverviewService` import qua `../../workspaces` và `../../projects` thay vì đường dẫn sâu.

---

## 7. Kiểm thử

### 7.1. Kết quả tự động

```
Test Suites: 23 passed, 23 total
Tests:       252 passed, 252 total        ← unit test (Bước 2: 218, +34 ca mới)

Test Suites: 2 passed, 2 total
Tests:       52 passed, 52 total          ← E2E

Test Suites: 4 passed, 4 total
Tests:       16 passed, 16 total          ← kiến trúc

npx tsc --noEmit     → 0 error
npx eslint           → 0 error, 155 warnings (nợ kỹ thuật có sẵn, siết ở Bước 7)
```

### 7.2. Nội dung `test/step3-efgh.spec.ts` (34 ca)

| Nhóm | Số ca | Nội dung |
|---|---|---|
| E1/E2 | 10 | Populate hồ sơ, search tên/email (không phân biệt hoa/thường), lọc role, phân trang keyset không trùng, cursor sai `sort` → 400, cursor hỏng → 400, không có `total`/`page` |
| E3/E4 | 3 | Đủ 5 chỉ số tổng quan, đủ chỉ số 1 workspace, workspace không tồn tại → 404 |
| F | 5 | Mặc định owner = người tạo, owner thành viên → OK, owner không phải thành viên → 400, owner không tồn tại → 400, DTO validate `owner_id` |
| G | 8 | DTO phone hợp lệ/không hợp lệ, bio max 500, `role` bị strip, cập nhật phone/bio, phone trùng → 409, phone của chính mình → OK, bio rỗng → null, không truyền phone → không gọi `findByPhone` |
| H | 3 | `member_emails` hợp lệ, email sai format → validation error, vượt 50 email → validation error |
| Util | 4 | `compareGeneric` tăng dần, tiebreaker `_id`, `isAfterGenericCursor`, `genericSortValue` null |

### 7.3. Quy trình kiểm thử thủ công (cần MongoDB thật)

| Bước | Thao tác | Kết quả mong đợi |
|---|---|---|
| 1 | `GET /workspaces/{id}/members?search=an` | Chỉ trả thành viên có tên/email chứa "an" |
| 2 | `GET /workspaces/{id}/members?role=owner` | Chỉ 1 thành viên role `owner` |
| 3 | `GET /workspaces/{id}/members?limit=1` | `meta.hasMore=true`, `meta.nextCursor` khác null |
| 4 | `GET /workspaces/{id}/members?limit=1&cursor=<nextCursor>` | Thành viên khác, không trùng |
| 5 | `GET /overview/workspaces` | Đủ 5 chỉ số |
| 6 | `GET /workspaces/{id}/overview` | Đủ 7 chỉ số |
| 7 | `POST /workspaces` kèm `member_emails` có email chưa có tài khoản | **400 VALIDATION_ERROR** + `details.missingEmails` |
| 8 | `POST /workspaces/{workspaceId}/projects` kèm `owner_id` không phải thành viên | **400 VALIDATION_ERROR** |
| 9 | `POST /workspaces/{workspaceId}/projects` kèm `owner_id` là thành viên | 201, member role `owner` = user đó |
| 10 | `PATCH /users/me` `{ "phone": "+84901234567" }` | 200, `profile.phone` có giá trị |
| 11 | `PATCH /users/me` lại với cùng số điện thoại từ tài khoản khác | **409 CONFLICT** |
| 12 | `PATCH /users/me` `{ "bio": "..." }` | 200, `profile.bio` có giá trị |
| 13 | `GET /projects/{id}` | Có trường `workspaceName` |

---

## 8. Thay đổi API (Breaking change)

### 8.1. Danh sách thành viên

```diff
  GET /workspaces/{workspaceId}/members
- {
-   "members": [ { "userId": "...", "role": "owner", "joinedAt": "..." } ],
-   "total": 12
- }
+ {
+   "items": [
+     {
+       "id": "507f1f77bcf86cd799439011",
+       "userId": "507f1f77bcf86cd799439011",
+       "role": "owner",
+       "joinedAt": "2026-01-01T00:00:00.000Z",
+       "email": "an@shool.local",
+       "firstName": "An",
+       "lastName": "Owner",
+       "avatarUrl": null
+     }
+   ],
+   "meta": { "nextCursor": null, "hasMore": false, "limit": 15 }
+ }
```

### 8.2. Endpoint mới

| Method | Path | Mã |
|---|---|---|
| GET | `/overview/workspaces` | E3 |
| GET | `/workspaces/{workspaceId}/overview` | E4 |

### 8.3. Mã lỗi mới

| Mã | HTTP | Điều kiện |
|---|---|---|
| `VALIDATION_ERROR` | 400 | `owner_id` không phải thành viên workspace / không tồn tại |
| `VALIDATION_ERROR` | 400 | `member_emails` chứa email chưa có tài khoản |
| `CONFLICT` | 409 | `phone` đã thuộc tài khoản khác |

---

## 9. Ảnh hưởng tới các bước sau

| Bước | Ghi chú |
|---|---|
| **Bước 4** (L2+L3a+L4) | Đã tạo `index.ts` cho workspaces/projects/users — nền tảng cho việc chuẩn hoá cross-module import (L3a). Module `overview` là ví dụ tham chiếu cho composition root đọc-only. |
| **Bước 5** (L1) | `WorkspacesService` đã có 2 nhóm use-case rõ ràng (list/read vs write) → dễ tách `commands/`/`queries/`. |
| **Bước 7** (J1) | 155 warning ESLint hiện có sẽ được siết. File mới ở Bước 3 đã viết theo chuẩn strict (`explicit-function-return-type`, `consistent-type-imports`, không `any`). |
| **Bước 8** (I) | Cần cập nhật: `7_api_contracts_v8` (bảng endpoint + mục 3.5c cho member pagination + `member_emails`/`owner_id`/`phone`/`bio`), `8_database_schema_v7` (`user.phone`, `user.bio`), `2_feature_catalog_v11`, `13_testing_acceptance_plan_v9`. |

### Điểm lệch cần chuẩn hoá sau

1. **Tên tham số `sort`.** Ba nhóm endpoint list (`/workspaces`, `/workspaces/{id}/projects`, `/workspaces/{id}/members`, `/projects/{id}/members`) dùng `sort` (giá trị kết hợp) thay vì cặp `sortBy`/`sortOrder`. Đã ghi nhận ở `7_api_contracts_v7.md` mục 3.5b.
2. **`meta.limit` chưa đồng bộ toàn hệ thống.** `/notifications`, `/issues`, `/admin/users` đã trả `nextCursor` + `hasMore` nhưng chưa có `limit`.
3. **Đường dẫn E3 khác kế hoạch** (`/overview/workspaces` thay vì `/workspaces/overview`) — lý do: tránh xung đột route với `GET /workspaces/:id`.

---

## 10. Trạng thái sau Bước 3

| Hạng mục | Trạng thái |
|---|---|
| Bước 0 — J0+K0+M0 | ✅ Hoàn tất |
| Bước 1 — C (remember-me) + D (issue needs_info) | ✅ Hoàn tất |
| Bước 2 — A (keyset cursor) | ✅ Hoàn tất |
| **Bước 3 — E + F + G + H** | ✅ **Hoàn tất** |
| Bước 4 — L2+L3a+L4 | ⏳ Tiếp theo |
| Bước 5 — L1 (tách commands/queries) | ⏳ Chưa |
| Bước 6 — B (Google OAuth) | ⏳ Chưa |
| Bước 7 — J1 (siết ESLint) | ⏳ Chưa |
| Bước 8 — I (vệ sinh tài liệu) | ⏳ Chưa (đã làm 3/9 file ở Bước 2) |
