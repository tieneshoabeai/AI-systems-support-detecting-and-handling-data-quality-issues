# 7. Thiết kế hợp đồng API

- **Version:** v8
- **Ngày tạo:** 2026-11-02
- **Cập nhật gần nhất:** 2026-11-16 (v8)
- **Trạng thái:** Đã chốt quy ước hợp đồng (response, error, **cursor pagination**, URL, upload, bất đồng bộ, download) và **bảng đầy đủ 86 tính năng → 86 route HTTP thực thi**. **v4 bổ sung: DQ-05 kích hoạt có điều kiện trong kết quả phân tích + ma trận tương quan/VIF và nhận xét AI (theo Phần 2 v7, Phần 12 v6).** **v5 bổ sung: breakdown thiếu pairwise, cảnh báo mất mẫu VIF, excludedColumns/date, worker AI (theo Phần 2 v8, Phần 12 v7).** **v6 chốt nhóm B (2026-11-07): không ETag, list project theo workspace mẫu, /health + /health/ready ngoài /api/v1, version mọi resource, lọc server-side, đính kèm 10MB×3 png/jpg/pdf.** **v7 (2026-11-15) — Nhóm A đã hiện thực hoá cursor pagination cho `GET /workspaces` và `GET /workspaces/{workspaceId}/projects`: bỏ `page`, thêm `cursor` opaque, response `{ items, meta: { nextCursor, hasMore, limit } }`, bỏ `total`/`page`/`totalPages` (mục 3.5).** **v8 (2026-11-16) — Đối chiếu với mã nguồn thực tế sau Bước 2–6: bảng endpoint cập nhật từ 85 → **86 route HTTP thực thi** (mục 3.13), bổ sung hợp đồng Google OAuth 2.0 (mục 3.5c), endpoint tổng quan workspace (mục 3.5d), tìm kiếm thành viên project, sửa báo cáo của chính mình `PATCH /issues/{id}`, quản lý cột dataset, `DELETE /users/me`.** Đã chốt toàn bộ mục 6.2 ở v6 (2026-11-07).
- **Giai đoạn:** Tech solution
- **Thứ tự thực hiện:** Phần 7; sử dụng kết quả đã xác nhận của các phần trước.
- **Quan hệ với các phần khác:** ánh xạ 1-1 với Phần 2 v11 (86 tính năng) và Phần 3 v6 (66 use case + DQ-05 có điều kiện). Quyền mỗi endpoint lấy từ ma trận quyền Phần 6 v7 mục 3.5.

## 1. Mục tiêu

Làm rõ và thống nhất thiết kế hợp đồng API cho đợt tái cấu trúc backend.

## 2. Nội dung cần bàn luận

- Danh sách endpoint gắn với feature/use case; method, path và quyền truy cập.
- Request/response, validation, error code, pagination, filtering và sorting.
- Upload/download, xử lý bất đồng bộ, idempotency và optimistic locking khi có yêu cầu.
- API giữ/thay đổi/bỏ, phiên bản hợp đồng và yêu cầu tương thích.

## 3. Quyết định và thiết kế chi tiết

### 3.1. Các quyết định nền tảng

| # | Quyết định | Ghi chú |
|---|---|---|
| 1 | Response thành công trả **thẳng dữ liệu** (không envelope) | REST thuần |
| 2 | JSON dùng **camelCase**; MongoDB dùng `snake_case` | Tách biệt, mapper chuyển đổi |
| 3 | Lỗi trả `{ error: { code, message, details? } }` | `code` là mã ổn định đã chốt ở Phần 3 |
| 4 | URL theo **REST tài nguyên**, lồng theo phân cấp | `/api/v1/...` |
| 5 | Phân trang: `{ items: [...], meta: { nextCursor, hasMore } }` | **v3: cursor (keyset)** — đã chốt ở Phần 5 v2 mục 3.8 |
| 6 | Upload **không** có idempotency | Mỗi lần upload là một dataset mới |
| 7 | Luồng bất đồng bộ trả **202 Accepted** + `{ jobId, status, pollUrl }` | Cơ chế job hàng đợi (v3: Kafka) |
| 8 | Download trả **file trực tiếp** qua response stream | Kiểm tra quyền trước khi stream |

### 3.2. Cấu trúc response

**Thành công — trả thẳng dữ liệu:**

```json
// GET /api/v1/workspaces/ws_01
{
  "id": "ws_01",
  "name": "Phòng Ban Kỹ Thuật",
  "description": "...",
  "ownerId": "usr_01",
  "memberCount": 12,
  "projectCount": 5,
  "createdAt": "2026-11-05T08:00:00.000Z",
  "updatedAt": "2026-11-05T09:30:00.000Z"
}
```

**Thành công — danh sách có phân trang:**

```json
// GET /api/v1/workspaces?limit=15
{
  "items": [
    { "id": "ws_01", "name": "Phòng Ban Kỹ Thuật", "...": "..." },
    { "id": "ws_02", "name": "Bộ phận Dữ liệu", "...": "..." }
  ],
  "meta": {
    "nextCursor": "eyJzb3J0SjoiQ3JlYXRlZEF0Iiwi...==",
    "hasMore": true,
    "limit": 15
  }
}
```

> **v3 — cursor thay offset.** Không còn `page`, `total`, `totalPages`. Client dùng `nextCursor` để lấy trang kế tiếp và `hasMore` để quyết định có tải tiếp không. Cursor là **opaque string** — không được parse hoặc tự chế.
>
> **v7 — `meta.limit` đã hiện thực hoá** (2026-11-15): `meta` luôn gồm đủ 3 trường `nextCursor` (`string | null`), `hasMore` (`boolean`), `limit` (`number`, echo lại giá trị `limit` của request). Việc này áp dụng cho **mọi** endpoint trả danh sách có phân trang — bao gồm cả `data-view`, `notifications`, `issues`, `feedback` (đã chuyển trong các đợt trước).

**Thành công — thao tác không trả nội dung:**

```
HTTP/1.1 204 No Content
```

**Thành công — hành động trả về kết quả thay đổi:**

```json
// DELETE /api/v1/workspaces/ws_01/members/usr_02
{
  "id": "usr_02",
  "removedAt": "2026-11-05T09:30:00.000Z"
}
```

**Quy tắc bắt buộc:**

| # | Quy tắc |
|---|---|
| 1 | **Không** có key `message` trong response thành công — thông báo lỗi mới cần message |
| 2 | **Không** có key bọc dữ liệu (`{ workspace: {...} }`) — trả thẳng object |
| 3 | Danh sách luôn trả `{ items, meta }` — kể cả khi `items` rỗng (không trả `null`) |
| 3b | `meta` của danh sách có phân trang luôn gồm `nextCursor` (`string \| null`), `hasMore` (`boolean`) và `limit` (`number`) — **không có** `page`/`total`/`totalPages` |
| 4 | Mọi response có `Content-Type: application/json` trừ khi tải file |
| 5 | Response **không** chứa trường nội bộ: `deletedAt` (trừ khi API trả trạng thái xoá), `_id`, `__v`, `passwordHash`, `refreshTokenHash`, `googleId` |

**Đối chiếu mã nguồn hiện tại:** controller đang trả `{ message: '...', workspace }` — phải đổi toàn bộ theo bảng trên. Không có frontend đang chạy (`src/frontend/` rỗng) nên không có ràng buộc tương thích.

### 3.3. Quy ước đặt tên trường

| Lớp | Quy ước | Ví dụ |
|---|---|---|
| JSON API | `camelCase` | `createdAt`, `firstName`, `workspaceId`, `inputFingerprint` |
| MongoDB | `snake_case` | `created_at`, `first_name`, `workspace_id`, `input_fingerprint` |
| Query param | `camelCase` | `?cursor=eyJ...&limit=15&sortBy=createdAt&sortOrder=desc` |
| Path param | `camelCase` | `/workspaces/{workspaceId}/projects/{projectId}` |
| Header | `kebab-case` chuẩn HTTP, hoặc `X-Camel-Case` | `X-Request-Id` |
| Tên sự kiện (domain/outbox) | `dot.camelCase` | `project.created`, `issue.statusChanged`, `workspace.ownerTransferred` |
| Mã lỗi | `SCREAMING_SNAKE_CASE` | `VALIDATION_ERROR`, `TOKEN_EXPIRED` |
| Tính năng / use case | `KÉO-DẤU-GẠCH-DƯỚI` | `PROJ-12`, `UC-25` |

**Quy tắc bắt buộc:**
1. Mapper (`infrastructure/persistence/*.mapper.ts`) chịu trách nhiệm chuyển đổi `snake_case` (DB) ↔ `camelCase` (domain/contract).
2. Tên field trong **schema Zod** (`modules/*/infrastructure/http/dtos/*.dto.ts`) là **chuẩn** — đó là hợp đồng với frontend.
3. Không dùng viết tắt không rõ ràng trong response (`u`, `n`, `ts`).

### 3.4. Cấu trúc lỗi

```json
// HTTP 409
{
  "error": {
    "code": "CONFLICT",
    "message": "Bản lưu hiện hành đã bị người khác cập nhật. Vui lòng tải lại dữ liệu trước khi tiếp tục.",
    "details": {
      "expectedVersion": 5,
      "actualVersion": 6
    }
  }
}
```

**Quy tắc bắt buộc:**
1. `code` là **mã ổn định** — frontend và test kiểm tra `code`, không kiểm tra `message`.
2. `message` là thông điệp tiếng Việt dùng để hiển thị, có thể thay đổi.
3. `details` là **tuỳ chọn**, chỉ có khi giúp frontend xử lý (VD: `field` + `reason` cho lỗi validation).
4. Lỗi validation trả `details.fields` là mảng:

```json
// HTTP 400
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Dữ liệu gửi lên không hợp lệ.",
    "details": {
      "fields": [
        { "field": "email", "code": "invalid_format", "message": "Email không đúng định dạng." },
        { "field": "password", "code": "too_short", "message": "Mật khẩu tối thiểu 8 ký tự." }
      ]
    }
  }
}
```

**Bảng mã lỗi → HTTP status** (đồng bộ Phần 5 mục 3.13):

| Mã lỗi | HTTP | Nguồn |
|---|---|---|
| `VALIDATION_ERROR` | 400 | Phần 3 mục 3.1 |
| `UNAUTHENTICATED` | 401 | Phần 3 mục 3.1 |
| `TOKEN_INVALID` | 401 | Phần 3 mục 3.1 |
| `TOKEN_EXPIRED` | 401 | Phần 3 mục 3.1 |
| `FORBIDDEN` | 403 | Phần 3 mục 3.1 |
| `NOT_FOUND` | 404 | Phần 3 mục 3.1 |
| `CONFLICT` | 409 | Phần 3 mục 3.1 |
| `PRECONDITION_FAILED` | 422 | Phần 3 mục 3.1 |
| `LIMIT_EXCEEDED` | 429 | Phần 3 mục 3.1 |
| `DEPENDENCY_UNAVAILABLE` | 503 | Phần 3 mục 3.1 |
| `INTERNAL_ERROR` | 500 | Mặc định |

**Mã bổ sung cho validation chi tiết** (`details.fields[].code`) — dùng mã con của Zod, giữ nguyên để frontend biết loại lỗi: `invalid_type`, `invalid_format`, `too_small`, `too_big`, `too_long`, `too_short`, `invalid_enum_value`, `unrecognized_keys`, `not_multiple_of`.

**Quy tắc bảo mật:**
1. Lỗi `500` **không** bao giờ lộ stack trace, tên collection, hay giá trị nghiệp vụ ra ngoài.
2. Lỗi `DEPENDENCY_UNAVAILABLE` nêu **dịch vụ nào** lỗi (VD "Dịch vụ gửi email tạm thời không khả dụng") nhưng không nêu host/credential.
3. Lỗi xác thực trả message **trung tính** — không tiết lộ email có tồn tại hay không.

### 3.5. Phân trang, lọc, sắp xếp

**Quy tắc chung cho mọi endpoint trả danh sách:**

| Tham số | Kiểu | Mặc định | Ràng buộc |
|---|---|---|---|
| `cursor` | chuỗi (opaque, base64url) | — | Không tự chế; sai/ràng buộc lệch → `VALIDATION_ERROR` |
| `limit` | số nguyên | 15 (workspace/project) hoặc 10 (notification/issue) | 1–100, vượt → `VALIDATION_ERROR` |
| `sortBy` | chuỗi | Theo từng danh sách (bảng bên dưới) | Phải thuộc danh sách cho phép |
| `sortOrder` | `asc` \| `desc` | Theo từng danh sách | Giá trị khác → `VALIDATION_ERROR` |
| `search` | chuỗi | — | Chuẩn hoá trim, không phân biệt hoa/thường |
| `role` / `status` / `read` | chuỗi / bool | Theo từng danh sách | Giá trị ngoài danh sách → `VALIDATION_ERROR` |

**Sắp xếp mặc định theo từng danh sách** (đồng bộ Phần 2 v3):

| Endpoint | Mặc định | Các giá trị `sortBy` cho phép |
|---|---|---|
| `GET /workspaces` | `lastAccessedAt` desc | `lastAccessedAt`, `joinedAt`, `updatedAt`, `name` |
| `GET /projects` | `lastAccessedAt` desc | `lastAccessedAt`, `joinedAt`, `updatedAt`, `name` |
| `GET /workspaces/{id}/members` | `joinedAt` asc | `joinedAt`, `name`, `email` |
| `GET /notifications` | `createdAt` desc | `createdAt` |
| `GET /issues` (của tôi) | `createdAt` desc | `createdAt`, `updatedAt`, `status` |
| `GET /issues` (Admin) | `createdAt` desc | `createdAt`, `updatedAt`, `status`, `severity` |
| `GET /admin/users` | `createdAt` desc | `createdAt`, `updatedAt`, `name`, `email`, `role`, `status` |

**Quy tắc bắt buộc:**
1. `sortBy` không hợp lệ → `VALIDATION_ERROR` với `details.allowedValues` — **không** fallback sang mặc định im lặng.
2. Lọc `role`/`status` không hợp lệ → `VALIDATION_ERROR` tương tự.
3. `search` tìm theo **substring, không phân biệt hoa/thường** (đã chốt ở Phần 2 mục 3.27).
4. Lọc bộ lọc trong Data Views dùng cơ chế riêng (`filters` param) — xem mục 3.7.

#### 3.5b. Hiện thực hoá cursor pagination — `GET /workspaces` & `GET /workspaces/{workspaceId}/projects` (v7, 2026-11-15)

Hai endpoint này đã chuyển từ **offset pagination** (`page`/`limit` + `total`) sang **keyset cursor pagination** theo quyết định Q0.1 (Phần 2 v10, `edit/02_ke_hoach_thuc_thien.md` Nhóm A).

**Query parameter thực tế (đã hiện thực hoá):**

| Tham số | Kiểu | Mặc định | Ràng buộc |
|---|---|---|---|
| `cursor` | chuỗi (opaque, base64url) | — | Không tự chế; sai định dạng hoặc sinh từ `sort` khác → `VALIDATION_ERROR` |
| `limit` | số nguyên | `15` | 1–100, vượt → `VALIDATION_ERROR` |
| `sort` | chuỗi | `last_accessed` | `last_accessed`, `updated`, `name_asc`, `name_desc`, `joined` — giá trị khác → `VALIDATION_ERROR` |
| `search` | chuỗi | — | trim, không phân biệt hoa/thường |
| `role` (workspaces) | `owner` \| `member` | — | Giá trị khác → `VALIDATION_ERROR` |
| `status` (projects) | `not_started` \| `in_progress` \| `completed` | — | Giá trị khác → `VALIDATION_ERROR` |

> **Lưu ý tên tham số:** hai endpoint này dùng tham số **`sort`** (một giá trị từ danh sách kết hợp cả chiều) chứ không phải cặp `sortBy`/`sortOrder` như bảng quy ước chung ở trên. Đây là điểm lệch **đã biết** — sẽ được chuẩn hoá về `sortBy`/`sortOrder` ở đợt tinh chỉnh hợp đồng API tiếp theo (Bước 3–4), khi đã có frontend sử dụng.

**Response thực tế:**

```json
{
  "items": [ /* ... */ ],
  "meta": {
    "nextCursor": "eyJzIjoibGFzdF9hY2Nlc3NlZCIsImsiOiIyMDI2LTAxLTAxVDAwOjAwOjAwLjAwMFoiLCJuIjowLCJpZCI6IjUwN2YxZjc3YmNmODZjNzk5NDM5MDExIn0",
    "hasMore": true,
    "limit": 15
  }
}
```

**Không còn** `total`, `totalPages`, `page`, `offset` trong bất kỳ response nào của hai endpoint này.

**Ràng buộc cursor đã hiện thực hoá:**
1. Cursor **ràng buộc theo tham số `sort`**: sinh từ `sort=name_asc` không dùng được cho `sort=updated` → `VALIDATION_ERROR` (HTTP 400, `error.code = 'VALIDATION_ERROR'`). Client phải bắt đầu lại từ trang đầu (không truyền `cursor`).
2. Cursor hỏng (không giải mã được) → `VALIDATION_ERROR`.
3. Client **không được** parse cursor, không được tự chế, không được lưu lâu dài.

**Cơ chế kỹ thuật (keyset):**
- Con trỏ mã hoá 4 thành phần: mã sort (`s`), giá trị trường sort (`k`, ISO-8601 nếu là ngày), cờ `null` (`n`), và `_id` hex (`id`) làm tiebreaker.
- Truy vấn MongoDB dùng `sort({ <field>: <dir>, _id: <dir> })` kèm điều kiện `$or` so sánh theo trường sort rồi tới `_id`.
- Trường ngày có thể `null` (`last_accessed_at`): theo thứ tự so sánh BSON của MongoDB, `null` luôn nhỏ hơn mọi `Date` — nên với sort giảm dần, các bản ghi `null` nằm cuối cùng.
- Không dùng `countDocuments` — `hasMore` suy ra bằng cách lấy `limit + 1` bản ghi.
- Đường admin (`role === 'admin'`, xem toàn bộ workspace) phân trang keyset trong bộ nhớ, dùng cùng bộ mã hoá/giải mã nên con trỏ tương thích.

**Index phục vụ keyset (đã có sẵn trong schema):**
| Collection | Index |
|---|---|
| `workspaces` | `{ last_accessed_at: -1, deleted_at: 1 }`, `{ name: 1 }` |
| `projects` | `{ workspace_id: 1, deleted_at: 1, last_accessed_at: -1 }`, `{ workspace_id: 1, name: 1, deleted_at: 1 }` |

#### 3.5c. Hợp đồng Google OAuth 2.0 — `AUTH-03` (v8, mới)

Đây là **luồng Authorization Code** (không phải Implicit), dùng cookie HttpOnly chống CSRF.

**Bước 1 — `GET /auth/google` (bắt đầu):**

| Thuộc tính | Giá trị |
|---|---|
| Method/Path | `GET /api/v1/auth/google` |
| Auth | Công khai (`@Public()`) |
| Query | Không có |
| Side effect | Đặt cookie `google_oauth_state` (HttpOnly, SameSite=Lax, maxAge 10 phút, `secure` theo `req.secure`) |
| Response | **302 Found** → `Location: https://accounts.google.com/o/oauth2/v2auth?...&state=<uuid>&client_id=...&redirect_uri=...&response_type=code&scope=openid+email+profile` |
| Lỗi | **501** `DEPENDENCY_UNAVAILABLE` khi thiếu `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` / `GOOGLE_REDIRECT_URI` |

**Bước 2 — `GET /auth/google/callback` (Google gọi về):**

| Thuộc tính | Giá trị |
|---|---|
| Method/Path | `GET /api/v1/auth/google/callback` |
| Auth | Công khai (`@Public()`) |
| Query | `code`, `state`, `error` (Google trả `error` khi người dùng từ chối) |
| Response (thành công) | **200** — JSON giống hệt `POST /auth/login` (xem mục 3.12) |
| Response (lỗi) | **401** `VALIDATION_ERROR` (mã/code không hợp lệ, `state` lệch, email chưa xác minh) · **409** `CONFLICT` (email đã có tài khoản local) · **403** `FORBIDDEN` (tài khoản bị khoá) · **501** `DEPENDENCY_UNAVAILABLE` (thiếu credential) |

**Body thành công (200) — cùng shape với `POST /auth/login`:**

```json
{
  "access_token": "<jwt>",
  "refresh_token": "<jwt>",
  "expires_in": 900,
  "device_name": "Google Login",
  "remember_me": false,
  "expires_at": "2026-11-16T14:00:00.000Z",
  "user": { "id": "65f...", "email": "an.nguyen@gmail.com", "role": "analyst" }
}
```

**Ma trận lỗi chi tiết:**

| HTTP | `error.code` | `details.reason` | Nguyên nhân |
|---|---|---|---|
| 401 | `VALIDATION_ERROR` | `invalid_oauth_state` | `state` không khớp cookie → chống CSRF |
| 401 | `VALIDATION_ERROR` | `invalid_authorization_code` | Mã ủy quyền không hợp lệ / đã dùng / hết hạn |
| 401 | `VALIDATION_ERROR` | `email_not_verified` | `email_verified !== true` trong id_token |
| 401 | `VALIDATION_ERROR` | `oauth_error` | Google trả `error` (người dùng từ chối) |
| 409 | `CONFLICT` | `email_already_registered` | Email đã có tài khoản **local** → **không** tự động liên kết |
| 403 | `FORBIDDEN` | `account_blocked` | `user.status = 'blocked'` |
| 501 | `DEPENDENCY_UNAVAILABLE` | `google_oauth_not_configured` | Thiếu biến môi trường Google |

**Quy tắc bắt buộc:**
1. **Bắt buộc** kiểm tra `email_verified === true`. Không xác minh → `401`, **không** tạo tài khoản.
2. Nếu `user.google_id` đã gắn với một tài khoản → **đăng nhập thẳng**, **không** hỏi mật khẩu.
3. Nếu `google_id` chưa gắn **nhưng** email đã tồn tại → `409 CONFLICT`. **Cấm tự động liên kết** — đây là ranh giới chống chiếm đoạt tài khoản (Phần 6 v7 mục 3.7).
4. Nếu cả hai đều mới → tạo tài khoản với `role = 'analyst'`, `status = 'active'`, `auth_provider = 'google'`, **không** có `password_hash`.
5. Cookie `google_oauth_state` phải được **xoá** sau khi dùng (kể cả khi lỗi).
6. Client **không** được tự dựng URL Google — luôn đi qua `GET /auth/google`.

#### 3.5d. Hợp đồng tổng quan workspace — `WS-08` / `WS-11` (v8, mới)

**`GET /api/v1/overview/workspaces` — tổng quan của người dùng:**

```json
{
  "totalWorkspaces": 3,
  "totalProjects": 12,
  "ownedWorkspaces": 1,
  "sharedWorkspaces": 2,
  "myProjects": 5
}
```

**`GET /api/v1/workspaces/{workspaceId}/overview` — tổng quan 1 workspace:**

```json
{
  "workspaceId": "65f...",
  "projectCount": 4,
  "notStartedCount": 1,
  "inProgressCount": 2,
  "completedCount": 1,
  "memberCount": 3,
  "storageUsedBytes": 52428800,
  "lastAccessedAt": "2026-11-16T10:00:00.000Z"
}
```

| Mã lỗi | Khi nào |
|---|---|
| `UNAUTHORIZED` | Chưa đăng nhập |
| `FORBIDDEN` | Không phải thành viên của workspace |
| `NOT_FOUND` | Không tìm thấy workspace |

> Hai endpoint này **trả thẳng dữ liệu** (không bọc `{ ... }`) — tuân thủ quy tắc "response thẳng dữ liệu" ở mục 3.2, khác với `GET /projects/{id}` vẫn bọc `{ project: {...} }` (sẽ chuẩn hoá ở đợt hợp đồng tiếp theo).

### 3.6. Quy ước URL

**Tiền tố:** `/api/v1` (global prefix, đã có sẵn trong `main.ts` hiện tại).

**Cấu trúc:**

```
/api/v1/<tài nguyên>                     # tài nguyên gốc
/api/v1/<tài nguyên>/{id}                # một thể hiện
/api/v1/<cha>/{id}/<tài nguyên con>      # tài nguyên con
/api/v1/<tài nguyên>/{id}/<hành động>    # hành động phi chuẩn
```

**Quy tắc bắt buộc:**
1. Tài nguyên dùng **số nhiều tiếng Anh**: `workspaces`, `projects`, `datasets`, `notifications`, `issues`, `users`, `sessions`.
2. Tài nguyên con **lồng** theo phân cấp thật: project thuộc workspace → `/workspaces/{workspaceId}/projects/{projectId}`.
3. Nhưng khi **đã biết id** thì dùng đường dẫn phẳng để ngắn hơn: `GET /projects/{projectId}`, `GET /datasets/{datasetId}`.
4. Hành động phi chuẩn dùng **động từ** ở dạng kebab-case: `/transfer-owner`, `/reset`, `/retry`, `/columns/rename`.
   - ~~`/rollback`~~ — **gỡ 2026-11-05**, không còn thao tác khôi phục dữ liệu.
5. Tài nguyên **của chính mình** dùng `/me`: `GET /users/me`, `GET /auth/sessions/me`.
6. Không dùng động từ GET để lấy dữ liệu — dùng sub-resource: `GET /projects/{id}/members` thay vì `GET /members?projectId=`.
7. Body của `POST`/`PATCH` là **JSON**; **không** dùng query string cho dữ liệu nghiệp vụ.
8. `DELETE` trả `204 No Content` nếu không có nội dung cần trả; `200` với body nếu cần trả thông tin thay đổi.

**Quy tắc phân quyền theo URL:** endpoint xoá dùng `DELETE`, không dùng `POST /delete`. Endpoint đổi trạng thái dùng `PATCH` với body, trừ hành động có tính chất "chạy thử" thì dùng `POST`.

### 3.6b. Trạng thái triển khai (v6, cập nhật 2026-11-07)

Đã hiện thực hoá:

| Quyết định | Endpoint hiện thực | File |
|---|---|---|
| `GET /health` (liveness, ngoài `/api/v1`) | `GET /health` | `app.controller.ts` + `main.ts` (exclude prefix) |
| `GET /health/ready` (readiness, 503 khi chưa sẵn sàng) | `GET /health/ready` | `app.controller.ts` |
| Lọc server-side + cursor pagination (không tải 200k dòng vào RAM) | `POST /api/v1/datasets/:datasetId/records/query` | `data-view.controller.ts` + `data-view.service.ts` + `dto/query-records-body.dto.ts` |
| Bộ lọc đầy đủ 14 toán tử, OR trong cùng cột / AND giữa các cột | `POST /records/query` | `data-view.service.ts` (`buildFilterConditions`) |
| Cột không tồn tại → `VALIDATION_ERROR` (400) | `POST /records/query` | `data-view.service.ts` |
| Không có `ETag`; `version` trả về mọi resource | — | Theo đặc tả v6 |

### 3.7. Bộ lọc Data Views — tham số riêng

Bộ lọc dữ liệu trong Data Views (Phần 2 mục 3.13) **không** dùng query string thông thường vì cấu trúc phẳng nhưng có OR trong cùng cột.

**Quyết định:** dùng **POST** cho truy vấn bảng dữ liệu có bộ lọc phức tạp.

```
POST /api/v1/datasets/{datasetId}/records/query
```

**Lý do:** GET với query string sẽ vượt giới hạn độ dài URL khi có nhiều điều kiện OR trong một cột. POST cho phép body JSON không giới hạn thực tế.

**Body:**

```json
{
  "filters": [
    { "column": "tuoi", "operator": "between", "value": [18, 30] },
    { "column": "ten",  "operator": "contains", "value": "nguy" }
  ],
  "sort": [{ "column": "tuoi", "order": "desc" }],
  "search": { "columns": ["ten", "ho"], "value": "an" },
  "cursor": "eyJzb3J0Sjoi...==",
  "limit": 50
}
```

> **v3:** không còn `sheetId` — CSV chỉ có một bảng.

**Quy tắc so khớp** (giữ nguyên Phần 2 mục 3.13):
- Toán tử: `equals`, `notEquals`, `contains`, `notContains`, `startsWith`, `endsWith`, `greaterThan`, `greaterThanOrEqual`, `lessThan`, `lessThanOrEqual`, `between`, `in`, `isEmpty`, `isNotEmpty`.
- OR trong cùng một cột; AND giữa các cột.
- `contains`/`startsWith`/`endsWith`: **không** phân biệt hoa/thường, **có** phân biệt khoảng trắng.
- Trống = `null` / `undefined` / chuỗi toàn khoảng trắng. **Không** coi `"N/A"`, `"NULL"`, `"NA"`, `"-"` là trống.
- `between` bao gồm cả hai đầu.

**Endpoint đơn giản vẫn dùng GET:** `GET /datasets/{datasetId}/records?cursor=...&limit=50` khi không có bộ lọc.

**Ràng buộc cursor bắt buộc (v3):**
1. Cursor **ràng buộc theo truy vấn**: sinh từ truy vấn `sortBy = createdAt` không dùng được cho `sortBy = name` → `VALIDATION_ERROR`.
2. Cursor **ràng buộc theo điều kiện lọc**: đổi bộ lọc giữa hai lần phân trang → `VALIDATION_ERROR`; client phải bắt đầu lại từ đầu.
3. Cursor hết hiệu lực (quá 24 giờ) → `VALIDATION_ERROR` với `details.reason = 'cursor_expired'`.
4. Client **không được** parse cursor, không được tự chế, không được lưu lâu dài.

### 3.8. Upload

**Endpoint:**

```
POST /api/v1/workspaces/{workspaceId}/projects/{projectId}/datasets
Content-Type: multipart/form-data
```

**Quy tắc bắt buộc:**

| # | Quy tắc |
|---|---|
| 1 | **Chỉ `.csv`** (v3). Mọi định dạng khác bị từ chối kèm thông báo yêu cầu xuất sang CSV |
| 2 | Tối đa 50 MB / file, 500 MB / workspace → vượt → `LIMIT_EXCEEDED` |
| 3 | Kiểm tra mime type **thực** bằng magic bytes, không tin `Content-Type` header |
| 4 | File Excel có mật khẩu → trả `VALIDATION_ERROR` với `details.reason = 'password_protected'` |
| 5 | Server **không** tin tên file do client gửi — dùng tên do server sinh |
| 6 | **Không** idempotency: mỗi lần upload tạo một dataset mới. Đã chốt 2026-11-05 |
| 7 | Lỗi giữa chừng phải **dọn file tạm** trong bucket (sửa lỗi hiện có — Phần 4 mục 3.6) |
| 8 | Lưu file gốc với extension `.csv` |

**Quy trình kiểm tra dung lượng:** kiểm tra **trước** khi ghi file — nếu vượt quota, từ chối ngay, không ghi file rồi mới xoá.

**Response (201):**

```json
{
  "id": "ds_01",
  "projectId": "prj_01",
  "originalFilename": "du-lieu-khach-hang.csv",
  "storageKey": "raw_files/prj_01/ds_01.csv",
  "sizeBytes": 10485760,
  "contentFingerprint": "sha256:9f2a...",
  "rowCount": 15234,
  "columnCount": 18,
  "hasHeader": true,
  "delimiter": ",",
  "columns": [
    { "index": 0, "name": "ho_ten", "detectedType": "string" },
    { "index": 1, "name": "tuoi", "detectedType": "integer" }
  ],
  "columnIssues": [
    { "columnIndex": 3, "columnName": "", "issue": "empty_name", "message": "Cột 4 không có tên." },
    { "columnIndex": 5, "columnName": "email", "issue": "duplicate_name", "message": "Trùng tên cột." }
  ],
  "createdAt": "2026-11-05T08:00:00.000Z"
}
```

**Quy tắc quan trọng:** lỗi tên cột **không** làm fail upload — file vẫn được nhận và gắn vào project (đã chốt ở Phần 2 mục 3.26). Lỗi được trả về trong response để người dùng sửa trên hệ thống. **Chặn phân tích** cho tới khi hết lỗi tên cột.

**Riêng trường hợp "file có dữ liệu nhưng không xác định được header"** → **lỗi Import** (`VALIDATION_ERROR`), file **không** được gắn vào project, yêu cầu nhập lại (đã chốt ở Phần 12 mục 3.12).

> **v3:** không còn mảng `sheets`; không còn `sheetId` trong `columnIssues`. Một file CSV = một bảng.

### 3.9. Download

**Quyết định.** Trả file **trực tiếp** qua response stream, không dùng presigned URL.

**Quy tắc bắt buộc:**

| # | Quy tắc |
|---|---|
| 1 | Kiểm tra quyền **trước** khi mở stream — trả `FORBIDDEN`/`NOT_FOUND` chứ không stream rồi mới lỗi |
| 2 | Header: `Content-Type` đúng theo loại file, `Content-Length`, `Content-Disposition: attachment; filename="..."` |
| 3 | Tên file trong `Content-Disposition` phải **encode** (tiếng Việt có dấu) — dùng `filename*=UTF-8''...` |
| 4 | Stream từ R2 qua `StoragePort`, **không** trả URL bucket |
| 5 | Bucket R2 **không** public — mọi lần tải đi qua endpoint có kiểm tra quyền |
| 6 | Tải file gốc dataset, PDF Tổng kết, tệp đính kèm báo cáo → **ghi audit log** (Phần 6 mục 3.8) |

**Các endpoint download:**

```
GET /api/v1/datasets/{datasetId}/file                    → file gốc .csv
GET /api/v1/projects/{projectId}/report                  → PDF Tổng kết
GET /api/v1/issues/{issueId}/attachments/{attachmentId}  → tệp đính kèm
```

**Cách tải tệp đính kèm báo cáo:** `GET /api/v1/issues/{issueId}` trả về metadata kèm `attachments[]` với `id`, `filename`, `sizeBytes`, `contentType` và `downloadUrl` — nhưng `downloadUrl` vẫn là endpoint có kiểm tra quyền, không phải URL trực tiếp R2.

### 3.10. Bất đồng bộ — 202 Accepted

**Quyết định.** Các thao tác dài trả `202 Accepted` kèm thông tin job.

**Response:**

```json
// HTTP 202
{
  "jobId": "job_01",
  "status": "pending",
  "pollUrl": "/api/v1/analysis/jobs/job_01"
}
```

**Quy tắc bắt buộc:**
1. `status` là một trong: `pending` | `running` | `succeeded` | `failed`.
2. Client poll `pollUrl` theo chu kỳ khuyến nghị (đề xuất 2 giây, backoff nhẹ).
3. `pollUrl` **luôn trả 200** với trạng thái hiện tại — kể cả khi job `failed` (lỗi nằm trong body, không phải HTTP error). Job không tồn tại → `404`.
4. Khi `succeeded`, `pollUrl` trả kèm `result` (kết quả phân tích, URL PDF).
5. Khi `failed`, trả `error` với `{ code, message }` cùng cấu trúc lỗi chuẩn.
6. Thao tác tạo job phải **idempotent theo `input_fingerprint`**: cùng fingerprint + cùng cấu hình → trả về job đang chạy thay vì tạo mới (đã chốt ở Phần 12 mục 3.13).

**Endpoint bất đồng bộ:**

```
POST /api/v1/projects/{projectId}/analysis              → 202 (chạy phân tích hệ thống + AI)
GET  /api/v1/analysis/jobs/{jobId}                      → 200 (trạng thái job)
POST /api/v1/analysis/jobs/{jobId}/retry                → 202 (thử lại AI, UC-22)
POST /api/v1/projects/{projectId}/report                 → 202 (sinh PDF)
GET  /api/v1/projects/{projectId}/report/{reportId}/file → 200 (tải PDF)
```

**Lưu ý:** Phân tích hệ thống (thống kê, DQ) là thuần JS và **nhanh**. Quyết định ở Phần 12 là phân tích hệ thống hoàn tất ngay, AI chạy nền. Vì vậy **có hai tầng**:

| Tầng | Cách trả |
|---|---|
| Kết quả phân tích hệ thống (DQ, thống kê, tương quan) | Trả **đồng bộ** 200 trong `POST /analysis` — nhanh, UX tốt |
| Phần AI giải thích | Job nền — thông báo qua `notifications` khi xong, `GET /analysis/jobs/{id}` để poll |

**Điều chỉnh so với quyết định "202 cho mọi luồng bất đồng bộ":** giữ nguyên nguyên tắc 202 cho thao tác thực sự dài (sinh PDF), nhưng phân tích hệ thống trả đồng bộ vì tính toán cục bộ nhanh và làm UI phản hồi tốt hơn nhiều. Phần AI vẫn bất đồng bộ — người dùng vẫn nhận Tổng kết ngay, thiếu phần giải thích AI (không chặn Tổng kết — đã chốt ở Phần 12 mục 3.9).

### 3.11. Optimistic locking — trường `expectedVersion`

**Quyết định.** Đã chốt ở Phần 5 mục 3.9 — dùng trường `version`, truyền trong body.

**Ví dụ:**

```json
// PATCH /api/v1/projects/prj_01
{
  "name": "Phân tích khách hàng Q4",
  "expectedVersion": 5
}
```

**Quy tắc bắt buộc:**

| # | Quy tắc |
|---|---|
| 1 | `expectedVersion` là **bắt buộc** ở 5 endpoint nhạy cảm: lưu trạng thái project (`PROJ-12`), nhượng quyền workspace owner (`WS-09`), thay đổi vai trò project (`PROJ-10`), nhượng quyền project owner (`PROJ-11`), đổi trạng thái báo cáo (`ISSUE-04`) |
| 2 | Thiếu `expectedVersion` ở endpoint bắt buộc → `VALIDATION_ERROR` |
| 3 | `version` lệch → `CONFLICT` với `details: { expectedVersion, actualVersion }` |
| 4 | Client **không** tự tăng `version` — chỉ gửi lại giá trị đọc được |
| 5 | Endpoint khác (VD `PATCH /workspaces/{id}`) cũng nhận `expectedVersion` **tuỳ chọn** — nếu có thì kiểm tra, không có thì bỏ qua |
| 6 | Response thành công **luôn** trả `version` mới để client đồng bộ |

### 3.12. Xác thực và token

| Endpoint | Yêu cầu |
|---|---|
| `POST /auth/register` | Công khai |
| `POST /auth/login` | Công khai |
| `POST /auth/refresh` | Công khai (dùng refresh token) |
| `POST /auth/forgot-password` | Công khai |
| `POST /auth/reset-password` | Công khai (dùng OTP) |
| `GET /auth/google` | Công khai (redirect OAuth) |
| `GET /auth/google/callback` | Công khai (OAuth callback) |
| Tất cả endpoint khác | `Authorization: Bearer <access_token>` |

**Quy tắc token:**
1. Access token trả trong body response (`accessToken`), không đặt cookie — frontend lưu và gửi qua header.
2. Refresh token trả trong body (`refreshToken`), **không** đặt cookie `httpOnly` — cần đồng bộ với frontend chưa có.
3. `GET /auth/sessions` trả `refreshTokenHash` **không bao giờ** — `select: false` ở tầng persistence.

**Định dạng lỗi xác thực:**
- Access token thiếu/hết hạn → `401` `{ code: 'UNAUTHENTICATED' }`.
- Access token sai chữ ký → `401` `{ code: 'TOKEN_INVALID' }`.
- Refresh token hết hạn → `401` `{ code: 'TOKEN_EXPIRED' }`.
- Refresh token đã bị thu hồi (phát hiện tái sử dụng) → `401` `{ code: 'TOKEN_INVALID' }` **và** thu hồi toàn bộ phiên.

### 3.13. Danh sách endpoint đầy đủ — 86 route HTTP thực thi (v8)

Cột "Quyền" dùng ký hiệu từ ma trận Phần 6 v7 mục 3.5. `SELF` = thao tác trên chính mình. `SYS-ADMIN` = quản trị hệ thống.

> **v8 — nguồn sự thật:** bảng này được **đối chiếu 1-1 với mã nguồn thực thi** (`src/backend/src/modules/**/infrastructure/http/*.controller.ts`) bằng cách quét tự động toàn bộ decorator `@Get/@Post/@Patch/@Put/@Delete` → **86 route HTTP**. v7 ghi "85 endpoint" theo thiết kế; số thực tế là **86** vì có thêm các route ở Nhóm D/E/H (Bước 3) và `POST /analysis/jobs/{jobId}/result` (kênh AI nội bộ).

#### Nhóm AUTH — xác thực và phiên (12 route / 14 tính năng)

| # | Tính năng | Method | Path | Quyền |
|---|---|---|---|---|
| 1 | `AUTH-01` Đăng ký | POST | `/auth/register` | công khai |
| 2 | `AUTH-02` Đăng nhập (có `remember_me`) | POST | `/auth/login` | công khai |
| 3 | `AUTH-03` Google (bắt đầu) | GET | `/auth/google` | công khai |
| 4 | `AUTH-03` Google (callback) | GET | `/auth/google/callback` | công khai |
| 5 | `AUTH-04` Ghi nhớ email | — | *(client-side, không có endpoint)* | — |
| 6 | `AUTH-05` Quên mật khẩu | POST | `/auth/forgot-password` | công khai |
| 7 | `AUTH-06` Đặt lại mật khẩu | POST | `/auth/reset-password` | công khai |
| 8 | `AUTH-07` Thay đổi mật khẩu | POST | `/auth/change-password` | SELF |
| 9 | `AUTH-08` Danh sách phiên | GET | `/auth/sessions` | SELF |
| 10 | `AUTH-09` Chi tiết phiên | GET | `/auth/sessions/{sessionId}` | SELF |
| 11 | `AUTH-10` Đăng xuất thiết bị khác | DELETE | `/auth/sessions/{sessionId}` | SELF |
| 12 | `AUTH-11` Đăng xuất hiện tại | POST | `/auth/logout` | SELF |
| 13 | `AUTH-12` Làm mới token | POST | `/auth/refresh` | công khai (dùng refresh token) |
| 14 | `AUTH-13` Rate-limit | — | *(hạ tầng, không có endpoint)* | — |

#### Nhóm USER / ADMIN — hồ sơ (5 route / 6 tính năng)

| # | Tính năng | Method | Path | Quyền |
|---|---|---|---|---|
| 15 | `USER-01` Xem hồ sơ | GET | `/users/me` | SELF |
| 16 | `USER-02` Cập nhật hồ sơ (`phone`, `bio`) | PATCH | `/users/me` | SELF |
| 17 | `USER-03` Xoá tài khoản của tôi (soft-delete) | DELETE | `/users/me` | SELF |
| 18 | `ADMIN-01` Danh sách hồ sơ | GET | `/admin/users` | SYS-ADMIN |
| 19 | `ADMIN-01` Chi tiết hồ sơ | GET | `/admin/users/{userId}` | SYS-ADMIN |

#### Nhóm WS — workspace & tổng quan (12 route / 12 tính năng)

| # | Tính năng | Method | Path | Quyền |
|---|---|---|---|---|
| 20 | `WS-01` Tạo workspace | POST | `/workspaces` | WS-OWNER (trở thành Owner) |
| 21 | `WS-02` Danh sách workspace | GET | `/workspaces` | tất cả thành viên |
| 22 | `WS-03` Chi tiết workspace | GET | `/workspaces/{workspaceId}` | thành viên |
| 23 | `WS-04` Cập nhật workspace | PATCH | `/workspaces/{workspaceId}` | WS-OWNER |
| 24 | `WS-05` Xoá workspace | DELETE | `/workspaces/{workspaceId}` | WS-OWNER |
| 25 | `WS-06` Danh sách thành viên | GET | `/workspaces/{workspaceId}/members` | thành viên (đọc) |
| 26 | `WS-07` Thêm thành viên (kèm `memberEmails` mời) | POST | `/workspaces/{workspaceId}/members` | WS-OWNER |
| 27 | `WS-07` Xoá thành viên | DELETE | `/workspaces/{workspaceId}/members/{userId}` | WS-OWNER |
| 28 | `WS-08` Tổng quan workspace | GET | `/workspaces/{workspaceId}/overview` | thành viên (đọc) |
| 29 | `WS-09` Nhượng quyền Owner | POST | `/workspaces/{workspaceId}/transfer-owner` | WS-OWNER |
| 30 | `WS-10` Rời workspace | POST | `/workspaces/{workspaceId}/leave` | thành viên |
| 31 | **`WS-11` Tổng quan workspace của người dùng** *(v8, mới)* | GET | `/overview/workspaces` | đã đăng nhập |

> **Vì sao `WS-11` dùng `/overview/workspaces` chứ không phải `/workspaces/overview`?** Vì `WorkspacesController` đã khai báo `@Get(':id')`. Nếu thêm `/workspaces/overview`, NestJS có thể phân giải chuỗi `overview` thành `:id` tuỳ thứ tự đăng ký route → trả sai 404/500. Tiền tố `/overview` tách khỏi namespace `workspaces` nên không xung đột.

#### Nhóm PROJ — project (11 route / 12 tính năng)

| # | Tính năng | Method | Path | Quyền |
|---|---|---|---|---|
| 32 | `PROJ-01` Tạo project (có `ownerId` tuỳ chọn) | POST | `/workspaces/{workspaceId}/projects` | WS-OWNER |
| 33 | `PROJ-02` Danh sách project của workspace | GET | `/workspaces/{workspaceId}/projects` | thành viên |
| 34 | `PROJ-03` Thông tin project (kèm `workspaceName`) | GET | `/projects/{projectId}` | có quyền xem |
| 35 | `PROJ-04` Cập nhật project | PATCH | `/projects/{projectId}` | PROJ-OWNER / WS-OWNER |
| 36 | `PROJ-05` Xoá project | DELETE | `/projects/{projectId}` | WS-OWNER |
| 37 | `PROJ-09` Tìm kiếm / danh sách thành viên project | GET | `/projects/{projectId}/members` | PROJ-OWNER / WS-OWNER |
| 38 | `PROJ-09` Thêm thành viên project | POST | `/projects/{projectId}/members` | PROJ-OWNER / WS-OWNER |
| 39 | `PROJ-10` Đổi vai trò thành viên project | PATCH | `/projects/{projectId}/members/{userId}` | PROJ-OWNER / WS-OWNER |
| 40 | `PROJ-10` Xoá thành viên project | DELETE | `/projects/{projectId}/members/{userId}` | PROJ-OWNER / WS-OWNER |
| 41 | `PROJ-11` Nhượng quyền project owner | POST | `/projects/{projectId}/transfer-owner` | PROJ-OWNER / WS-OWNER |
| 42 | `PROJ-12` Lưu trạng thái project | PUT | `/projects/{projectId}/snapshot` | PROJ-OWNER / PROJ-MEMBER / WS-OWNER |

> **v8 — sửa lệch so với v7:** v7 ghi `PROJ-09` là `GET /workspaces/{workspaceId}/members/search`. Mã nguồn thực tế dùng **một** endpoint `GET /projects/{projectId}/members` với query `search` / `role` / `cursor` / `limit` / `sort` — vừa tìm kiếm vừa phân trang keyset. Không có endpoint `/members/search` riêng.

#### Nhóm FILE / DATA / VIEW — dữ liệu (12 route / 12 tính năng)

| # | Tính năng | Method | Path | Quyền |
|---|---|---|---|---|
| 43 | `PROJ-13` Import dataset (upload streaming) | POST | `/projects/{projectId}/datasets/upload` | WS-OWNER / PROJ-OWNER |
| 44 | `PROJ-13` Danh sách dataset của project | GET | `/projects/{projectId}/datasets` | có quyền xem |
| 45 | `FILE-02` Thông tin dataset | GET | `/datasets/{datasetId}` | có quyền xem |
| 46 | `VIEW-08` Cập nhật thông tin dataset (tên, mô tả) | PATCH | `/datasets/{datasetId}` | PROJ-MEMBER+ |
| 47 | `VIEW-08` Đổi tên cột (nhiều cột 1 lần) | PATCH | `/datasets/{datasetId}/columns` | PROJ-MEMBER+ |
| 48 | `VIEW-07` Reset tên cột về file gốc | POST | `/datasets/{datasetId}/columns/reset` | PROJ-MEMBER+ |
| 49 | `FILE-03` Xoá dataset | DELETE | `/datasets/{datasetId}` | WS-OWNER / PROJ-OWNER |
| 50 | `FILE-01` Tải file gốc | GET | `/datasets/{datasetId}/file` | có quyền xem (kể cả VIEWER) |
| 51 | `DATA-01` Schema dataset | GET | `/datasets/{datasetId}/schema` | có quyền xem |
| 52 | `VIEW-01` Xem bảng dữ liệu | GET | `/datasets/{datasetId}/records` | có quyền xem |
| 53 | `VIEW-01` Truy vấn có bộ lọc/sắp xếp/tìm kiếm | POST | `/datasets/{datasetId}/records/query` | có quyền xem |
| 54 | `DATA-01` Thống kê cột | GET | `/datasets/{datasetId}/columns/{columnKey}/stats` | có quyền xem |

> **v8 — sửa lệch so với v7:** v7 ghi `PATCH /datasets/:id` và `DELETE /datasets/:id` là **"Bỏ"**. Mã nguồn thực tế **vẫn có** cả hai route (đã hiện thực hoá ở Bước 1–3). Ngoài ra `PATCH /datasets/{id}/columns` nhận **mảng cột** trong body (đổi tên nhiều cột 1 lần) thay vì path param `{columnIndex}`; route `POST /datasets/{id}/columns/reset` là mới.

#### Nhóm DQ / ANALYSIS / AI — phân tích (7 route / 15 tính năng)

| # | Tính năng | Method | Path | Quyền |
|---|---|---|---|---|
| 55 | `ANALYSIS-01` Lưu cấu hình cột phân tích | POST | `/projects/{projectId}/analysis/config` | PROJ-MEMBER+ |
| 56 | `ANALYSIS-01` Xem cấu hình cột phân tích | GET | `/projects/{projectId}/analysis/config` | PROJ-MEMBER+ |
| 57 | `ANALYSIS-02` Chạy phân tích | POST | `/projects/{projectId}/analysis` | PROJ-MEMBER+ |
| 58 | `ANALYSIS-03` Kết quả phân tích (DQ-05 + tương quan + VIF + nhận xét AI) | GET | `/projects/{projectId}/analysis/result` | có quyền xem |
| 59 | `AI-01` Trạng thái job AI | GET | `/analysis/jobs/{jobId}` | có quyền xem |
| 60 | `AI-01` Thử lại AI job (tối đa 2 retry) | POST | `/analysis/jobs/{jobId}/retry` | PROJ-MEMBER+ |
| 61 | `AI-01` Gắn kết quả AI đã grounding *(v8, mới)* | POST | `/analysis/jobs/{jobId}/result` | PROJ-MEMBER+ (AI nội bộ) |

> **v8 — sửa lệch so với v7:** v7 ghi `PUT /projects/{projectId}/analysis/config`, mã nguồn dùng **`POST`** (`@HttpCode(200)`) và có thêm route `GET` xem cấu hình. Route `POST /analysis/jobs/{jobId}/result` là **kênh nội bộ** để worker AI đẩy kết quả đã grounding — không phải endpoint người dùng gọi tay.

#### Nhóm SUMMARY / REPORT — tổng kết và xuất (4 route / 4 tính năng)

| # | Tính năng | Method | Path | Quyền |
|---|---|---|---|---|
| 62 | `SUMMARY-01` Tạo Tổng kết | POST | `/projects/{projectId}/summary` | PROJ-MEMBER+ |
| 63 | `SUMMARY-01` Xem Tổng kết | GET | `/projects/{projectId}/summary` | có quyền xem |
| 64 | `REPORT-01` Sinh PDF | POST | `/projects/{projectId}/report` | PROJ-MEMBER+ (202) |
| 65 | `REPORT-01` Tải PDF | GET | `/projects/{projectId}/report/{reportId}/file` | có quyền xem |

#### Nhóm NOTIF — thông báo (5 route / 5 tính năng)

| # | Tính năng | Method | Path | Quyền |
|---|---|---|---|---|
| 66 | `NOTIF-01` Trung tâm thông báo | GET | `/notifications` | SELF |
| 67 | `NOTIF-01` Số chưa đọc | GET | `/notifications/unread-count` | SELF |
| 68 | `NOTIF-02` Chi tiết thông báo | GET | `/notifications/{notificationId}` | SELF |
| 69 | `NOTIF-02` Đánh dấu đã đọc | PATCH | `/notifications/{notificationId}/read` | SELF |
| 70 | `NOTIF-03` Bật/tắt thông báo | PATCH | `/users/me/notification-preferences` | SELF |

#### Nhóm ISSUE — báo cáo sự cố (9 route / 8 tính năng)

| # | Tính năng | Method | Path | Quyền |
|---|---|---|---|---|
| 71 | `ISSUE-01` Tạo báo cáo | POST | `/issues` | SELF |
| 72 | `ISSUE-02` Danh sách của tôi | GET | `/issues` | SELF |
| 73 | `ISSUE-02` Đính kèm tệp lên báo cáo | POST | `/issues/{issueId}/attachments` | SELF (chủ báo cáo) |
| 74 | `ISSUE-02` Tải tệp đính kèm | GET | `/issues/{issueId}/attachments/{attachmentId}` | SELF (chủ báo cáo) hoặc SYS-ADMIN |
| 75 | `ISSUE-03` Chi tiết báo cáo | GET | `/issues/{issueId}` | SELF (chủ) hoặc SYS-ADMIN |
| 76 | **`ISSUE-05` Sửa báo cáo của chính mình** *(v8, mới)* | PATCH | `/issues/{issueId}` | SELF (chủ) — chỉ khi `status = needs_info` |
| 77 | `ISSUE-04` Danh sách (quản trị) | GET | `/admin/issues` | SYS-ADMIN |
| 78 | `ISSUE-04` Chi tiết (quản trị) | GET | `/admin/issues/{issueId}` | SYS-ADMIN |
| 79 | `ISSUE-04` Đổi trạng thái | PATCH | `/admin/issues/{issueId}/status` | SYS-ADMIN |

> **v8 — mới `ISSUE-05`:** người dùng sửa được báo cáo **của chính mình** khi quản trị viên đã chuyển trạng thái sang `needs_info`. Body cho phép `title`, `description`, `removeAttachmentIds` và `expectedVersion` (optimistic locking). Mọi lần sửa đều ghi **audit log** (`action = ISSUE_REPORT_UPDATED`).

#### Nhóm FEEDBACK — nhận xét kết quả và học lại AI (7 route / 6 tính năng)

| # | Tính năng | Method | Path | Quyền |
|---|---|---|---|---|
| 80 | `FB-01` Nhận xét một phát hiện | POST | `/analyses/{analysisId}/findings/{findingId}/feedback` | có quyền xem project |
| 81 | `FB-02` Nhận xét cả lần phân tích | POST | `/analyses/{analysisId}/feedback` | có quyền xem project |
| 82 | `FB-03` Xem nhận xét của phát hiện | GET | `/analyses/{analysisId}/findings/{findingId}/feedback` | có quyền xem project |
| 83 | `FB-04` Xem nhận xét của lần phân tích | GET | `/analyses/{analysisId}/feedback` | có quyền xem project |
| 84 | `FB-05` Sửa nhận xét của chính mình | PATCH | `/feedback/{feedbackId}` | SELF (chủ nhận xét) |
| 85 | **`FB-07` Xoá nhận xét của chính mình** *(v8, mới)* | DELETE | `/feedback/{feedbackId}` | SELF (chủ nhận xét) |
| 86 | `FB-06` Thống kê chất lượng AI | GET | `/projects/{projectId}/ai-quality-metrics` | PROJ-OWNER / PROJ-MEMBER |

#### Nhóm HEALTH — vận hành (2 route, ngoài `/api/v1`)

| # | Tính năng | Method | Path | Quyền |
|---|---|---|---|---|
| — | `OPS-01` Liveness | GET | `/health` | công khai |
| — | `OPS-02` Readiness | GET | `/health/ready` | công khai |

#### Nhóm REALTIME — thông báo trạng thái tức thì (1 kênh WS)

| # | Tính năng | Method | Path | Quyền |
|---|---|---|---|---|
| — | `REALTIME-01` Kết nối realtime (Socket.IO) | WS | `/api/v1/realtime?token=<accessToken>` | đã đăng nhập |

> `REALTIME-01` **không phải endpoint HTTP** — nó là kênh WebSocket, không có request/response REST, không sinh test case HTTP. Vẫn phải có test ở tầng E2E (mục 3.17.2, Phần 13).

**Kiểm tra bao phủ (v8):**

| Chỉ số | v7 (thiết kế) | v8 (thực thi) |
|---|---|---|
| Route HTTP | 85 | **86** |
| Kênh WebSocket | 1 | 1 |
| Tính năng có endpoint riêng | 79 | **86** |
| Tính năng không có endpoint riêng | 5 | 5 (`AUTH-04` client-side, `AUTH-13` hạ tầng, `DQ-01`→`DQ-05` và `ANALYSIS-04`→`ANALYSIS-07` nằm trong `ANALYSIS-03`) |

Bảng trên **không** còn đếm dòng "không có endpoint" vào tổng như v7 — v8 **tách bạch**: mỗi dòng là **một route thật đã hiện thực hoá** trong mã nguồn.

### 3.17. Nhận xét người dùng và kênh realtime (v3)

#### 3.17.1. Hợp đồng nhận xét

**Body — `POST /analyses/{analysisId}/findings/{findingId}/feedback`:**

```json
{
  "label": "false_positive",
  "reason": "Cột trạng thái dùng 5 mã viết tắt khác nhau — đây là quy ước nội bộ, không phải lỗi.",
  "suggestedSeverity": "low"
}
```

| Trường | Bắt buộc | Ràng buộc |
|---|---|---|
| `label` | ✔ | `correct` · `partially_correct` · `false_positive` · `missed_issue` · `other` |
| `reason` | ✔ với `false_positive`/`missed_issue`/`other` | tối đa 2.000 ký tự |
| `suggestedSeverity` | — | `low` · `medium` · `high` · `critical` |

**Response (201):**

```json
{
  "id": "fb_01",
  "analysisId": "an_01",
  "findingId": "fnd_01",
  "label": "false_positive",
  "reason": "Cột trạng thái dùng 5 mã viết tắt khác nhau — đây là quy ước nội bộ, không phải lỗi.",
  "suggestedSeverity": "low",
  "aiConfidence": 0.82,
  "aiRationale": "Cột trạng thái có 5 giá trị phân bố không đều, mức ảnh hưởng ước tính cao.",
  "author": { "id": "usr_01", "displayName": "Nguyễn Văn A" },
  "createdAt": "2026-11-05T10:15:00.000Z",
  "updatedAt": "2026-11-05T10:15:00.000Z"
}
```

> `aiConfidence` và `aiRationale` là **ảnh chụp tại thời điểm nhận xét** — dùng sau này để đánh giá model nào đúng hơn (Phần 12 mục 3.16.2).

**Mã lỗi:**

| Mã | `details.reason` | Khi nào |
|---|---|---|
| `VALIDATION_ERROR` | `invalid_label` | Nhãn không thuộc danh sách |
| `VALIDATION_ERROR` | `reason_required` | Thiếu `reason` khi nhãn bắt buộc |
| `VALIDATION_ERROR` | `reason_too_long` | `reason` > 2.000 ký tự |
| `VALIDATION_ERROR` | `suggested_severity_invalid` | Giá trị mức ảnh hưởng không hợp lệ |
| `NOT_FOUND` | — | Không có phát hiện / lần phân tích |
| `FORBIDDEN` | — | Không có quyền xem project chứa phát hiện |

**Quy tắc bắt buộc:**
1. Nhận xét **không sửa** `analysis_result` hay `dataset_record` — dữ liệu bất biến.
2. Nhận xét **không** làm thay đổi `input_fingerprint` → không làm kết quả cũ mất hiệu lực.
3. `PATCH /feedback/{feedbackId}` chỉ chủ nhận xét được sửa → người khác nhận `FORBIDDEN`.
4. Nhận xét gắn `authorId`; hiển thị tên hiển thị, không hiển thị email.

#### 3.17.2. Kênh realtime — Socket.IO

> **Quyết định 2026-11-05 (v3):** Thêm **Socket.IO** để đẩy trạng thái realtime tới giao diện. Kafka dùng cho **event bus nội bộ** (Phần 9 v3), không dùng để đẩy tới trình duyệt.

**Endpoint kết nối:**

```
GET /api/v1/realtime?token=<accessToken>
```

- Xác thực bằng **access token** trong query param (WebSocket không gửi header custom trong trình duyệt). Token hết hạn 15 phút → client phải kết nối lại bằng token mới.
- Server xác thực **trước khi** accept phiên; thất bại → đóng kết nối với mã `4401`.

**Phòng (room) và sự kiện:**

| Phòng | Người nhận | Sự kiện |
|---|---|---|
| `user:{userId}` | Người dùng | `notification.created`, `ai.quality.updated` |
| `project:{projectId}` | Thành viên có quyền xem project | `analysis.progress`, `analysis.completed`, `analysis.failed` |
| `analysis:{analysisId}` | Thành viên đang xem | `ai.job.status`, `finding.created` |

**Payload mẫu:**

```json
// analysis.progress
{
  "event": "analysis.progress",
  "analysisId": "an_01",
  "projectId": "prj_01",
  "progress": 45,
  "stage": "detection",
  "occurredAt": "2026-11-05T10:20:00.000Z"
}
```

**Quy tắc bắt buộc:**
1. **Server là nguồn sự thật.** Client nhận sự kiện realtime chỉ để **cập nhật giao diện**; khi cần dữ liệu chính xác thì gọi lại API. Không tin dữ liệu realtime làm dữ liệu nghiệp vụ.
2. **Không gửi dữ liệu nhạy cảm** qua socket: không gửi giá trị ô lỗi, không gửi nội dung nhận xét, chỉ gửi id + trạng thái + số liệu tổng hợp.
3. Client phải xử lý **reconnect** (Socket.IO tự reconnect với backoff); khi reconnect, client **gọi lại API** để đồng bộ trạng thái vì có thể đã bỏ sót sự kiện.
4. **Server không giữ trạng thái** — Socket.IO không phải nguồn dữ liệu; mọi trạng thái đọc từ MongoDB.
5. Khi hệ thống có **nhiều instance API**, dùng **Socket.IO Redis adapter** để các instance gửi sự kiện lẫn nhau. Với 1 instance (hiện tại) chưa cần.
6. **Heartbeat** mỗi 25 giây; client ngắng kết nối quá 60 giây → coi như mất kết nối, tự reconnect.

**Đánh đổi:** thêm 1 dependency (Socket.IO + Redis adapter) và phải quản lý vòng đời kết nối. Đổi lại người dùng thấy tiến trình phân tích và trạng thái AI **không cần polling**.

### 3.13b. Schema kết quả phân tích — DQ-05 có điều kiện + ma trận tương quan/VIF + nhận xét AI (v4 mới)

`GET /projects/{projectId}/analysis/result` và `pollUrl` khi job AI xong trả cùng cấu trúc (phần AI có thể vắng khi job chưa xong):

```json
{
  "analysisId": "an_01",
  "inputFingerprint": "sha512:...",
  "dq05": {
    "status": "unassessed",
    "reason": "no_rule_confirmed",
    "rules": [],
    "violations": []
  },
  "correlationMatrix": {
    "method": "pearson",
    "columns": ["tuoi", "luong"],
    "cells": [{ "colA": "tuoi", "colB": "luong", "coef": 0.82, "kind": "pearson", "n": 1180, "totalScanned": 1200, "missingAOnly": 5, "missingBOnly": 15, "missingBoth": 0 }],
    "notes": ["mỗi cặp dùng tập dòng hợp lệ riêng", "cột date bị loại khỏi tương quan/VIF: ngay_cap_nhat (date_column_excluded_from_correlation_vif)"],
    "excludedColumns": [{ "column": "ngay_cap_nhat", "reason": "date_column_excluded_from_correlation_vif" }],
    "totalScanned": 1200
  },
  "vif": {
    "columns": ["tuoi", "luong"],
    "rows": [{ "column": "luong", "vif": 6.4, "flag": "review" }],
    "commonN": 1180,
    "totalScanned": 1200,
    "commonNRate": 0.9833,
    "lossWarning": null,
    "excluded": []
  },
  "aiCorrelationAssessment": {
    "status": "succeeded",
    "notablePairs": [{ "colA": "tuoi", "colB": "luong", "coef": 0.82, "n": 1200 }],
    "highVif": ["luong"],
    "limits": ["tập dòng khác nhau giữa các cặp"],
    "nextSteps": ["kiểm tra định nghĩa cột trước khi mô hình hóa"],
    "modelId": "qwen3-14b-q4_k_m",
    "promptVersion": "corr-v1"
  }
}
```

Quy tắc: `dq05.status = "assessed"` chỉ khi có ít nhất 01 quy tắc được xác nhận — khi đó `rules[]` chứa `ruleId/version` và `violations[]` chứa bằng chứng theo số dòng gốc (Phần 2 v7 mục 3.5.5). `vif.rows[].flag` chỉ nhận `ok / review (VIF>5) / high (VIF>10)` — không tự thành lỗi dữ liệu. `aiCorrelationAssessment` vắng hoặc `status=failed` khi job AI chưa xong/lỗi — kết quả hệ thống vẫn hiển thị (Thử lại AI theo UC-22). Mọi số trong nhận xét AI phải tồn tại trong `correlationMatrix.cells`/`vif.rows` — backend loại câu trích số không tồn tại, dung sai |coef AI − coef hệ thống| ≤ 0.01 (Phần 12 v7 mục 3.6). Prompt corr-v1 nhận thêm breakdown thiếu từng ô, `commonNRate`/`lossWarning` (mất ≥ 20% thận trọng, ≥ 50% kém tin) và `excludedColumns[]` kèm lý do date riêng. Worker `AiWorkerService` poll `pending → running` (claim nguyên tử, concurrency 1, tắt mặc định `AI_WORKER_ENABLED=false`), gọi engine qua `AiInferencePort` (vLLM `/v1/chat/completions` / Ollama `/api/generate`, `temperature 0`, timeout 180s), tách JSON bằng `extractJsonObject`, rồi grounding qua `POST /analysis/jobs/:jobId/result`.

### 3.13c. Health và vận hành (v6 mới)

- `GET /health` (liveness, không auth) và `GET /health/ready` (readiness: Mongo + Redis + ai-engine + Kafka) đặt **ngoài** `/api/v1` để load-balancer/monitoring gọi trực tiếp.
- Data View chuyển sang **lọc server-side**: `POST /records/query` + cursor `{ nextCursor, hasMore }`, không nạp 200k dòng vào JS.
- Đính kèm sự cố: `10MB/tệp × 3`, MIME cho phép `png/jpg/pdf`, từ chối sớm 413 + mã `ATTACHMENT_TOO_LARGE`/`UNSUPPORTED_MEDIA_TYPE`.

### 3.14. Đối chiếu với API hiện tại

| Endpoint hiện tại | Trạng thái | Endpoint mới |
|---|---|---|
| `POST /auth/register` | Giữ hình dạng, bỏ `role` | `POST /auth/register` |
| `POST /auth/login` | Giữ | `POST /auth/login` |
| `POST /auth/refresh` | Giữ | `POST /auth/refresh` |
| `POST /auth/logout` | Giữ | `POST /auth/logout` |
| `GET /auth/sessions` | Bổ sung phân trang | `GET /auth/sessions` |
| `DELETE /auth/sessions/:id` | Giữ | `DELETE /auth/sessions/{sessionId}` |
| `GET /users/me` | Giữ | `GET /users/me` |
| `PATCH /users/me` | Giữ | `PATCH /users/me` |
| `DELETE /users/me` | **Đã hiện thực hoá** *(v8 — v7 ghi "Bỏ")* | `DELETE /users/me` |
| `POST /workspaces` | Bổ sung lời mời email | `POST /workspaces` |
| `GET /workspaces` | Bổ sung phân trang/lọc/sắp xếp | `GET /workspaces` |
| `GET /workspaces/:id` | Giữ | `GET /workspaces/{workspaceId}` |
| `PATCH /workspaces/:id` | Giữ | `PATCH /workspaces/{workspaceId}` |
| `DELETE /workspaces/:id` | Giữ | `DELETE /workspaces/{workspaceId}` |
| `POST /workspaces/:id/members` | Giữ | `POST /workspaces/{workspaceId}/members` |
| `DELETE /workspaces/:id/members/:userId` | Giữ | `DELETE /workspaces/{workspaceId}/members/{userId}` |
| `POST /workspaces/:workspaceId/projects` | Giữ | `POST /workspaces/{workspaceId}/projects` |
| `GET /workspaces/:workspaceId/projects` | Bổ sung phân trang/lọc | `GET /workspaces/{workspaceId}/projects` |
| `GET /projects/:id` | Giữ | `GET /projects/{projectId}` |
| `PATCH /projects/:id` | Giữ | `PATCH /projects/{projectId}` |
| `DELETE /projects/:id` | Giữ | `DELETE /projects/{projectId}` |
| `POST /projects/:projectId/datasets/upload` | Đổi tên + sửa lỗi extension | `POST /workspaces/{workspaceId}/projects/{projectId}/datasets` |
| `GET /projects/:projectId/datasets` | — | Gộp vào `GET /datasets/{datasetId}` + `GET /projects/{projectId}` |
| `GET /datasets/:id` | Giữ | `GET /datasets/{datasetId}` |
| `PATCH /datasets/:id` | **Đã hiện thực hoá** *(v8 — v7 ghi "Bỏ")* | `PATCH /datasets/{datasetId}` |
| `DELETE /datasets/:id` | **Đã hiện thực hoá** *(v8 — v7 ghi "Bỏ")* | `DELETE /datasets/{datasetId}` |
| `GET /datasets/:id/schema` | Gộp (CSV 1 bảng) | `GET /datasets/{datasetId}/schema` |
| `GET /datasets/:datasetId/records` | Bổ sung bộ lọc | `GET /datasets/{datasetId}/records` + `POST .../records/query` |
| `PATCH /datasets/:datasetId/records/:rowIndex` | **Bỏ** — module `cell-edit` bị gỡ (2026-11-05) | — |
| `GET /datasets/:datasetId/columns/:columnName/stats` | Đổi định danh cột | `GET /datasets/{datasetId}/columns/{columnIndex}/stats` |
| `GET /datasets/:id/versions/diff` | **Bỏ** — module `versions` bị gỡ (2026-11-05) | — |
| `GET /datasets/:id/versions/:versionNumber` | **Bỏ** — module `versions` bị gỡ (2026-11-05) | — |
| `POST /datasets/:id/versions/:versionNumber/rollback` | **Bỏ** — module `versions` bị gỡ (2026-11-05) | — |
| `GET /datasets/:id/export/csv` | **Bỏ** — đã chốt không có tính năng xuất dữ liệu (Phần 6 mục 6.1 #5) | — |
| `POST /datasets/:id/export/secure` | **Bỏ** — như trên | — |
| `GET /datasets/:id/exports` | **Bỏ** — như trên | — |
| `POST /datasets/:id/rules/preview` | **Bỏ** — module `clean-rules` bị xoá (Phần 4 mục 3.9) | — |
| `POST /datasets/:id/rules/apply` | **Bỏ** — như trên | — |
| `GET /lineage/*` | **Bỏ** — module `lineage` bị xoá | — |
| `POST /datasets/:id/versions` (commit) | **Bỏ** — module `versions` bị gỡ (2026-11-05) | — |

**Tổng kết (v8 — cập nhật theo mã nguồn thực thi):** giữ 24, đổi hình dạng 8, **xoá 12** (thuộc module LEGACY bị xoá + 2 endpoint không có trong danh mục tính năng), **thêm mới 65**.

**Các endpoint mới hiện thực hoá sau v7 (2026-11-15 → 2026-11-16):**

| Endpoint | Nhóm | Ghi chú |
|---|---|---|
| `GET /overview/workspaces` | Nhóm E | Tổng quan workspace của người dùng |
| `GET /workspaces/{id}/overview` | Nhóm E | Tổng quan 1 workspace |
| `GET /projects/{id}/members` | Nhóm E | Tìm kiếm + phân trang keyset (thay `/members/search` trong thiết kế) |
| `PATCH /issues/{id}` | Nhóm D | Sửa báo cáo của chính mình khi `status = needs_info` |
| `DELETE /feedback/{id}` | Nhóm C | Xoá nhận xét của chính mình |
| `POST /analysis/jobs/{jobId}/result` | Nhóm AI | Kênh nội bộ để worker AI đẩy kết quả đã grounding |
| `GET /projects/{id}/analysis/config` | Nhóm A | Xem cấu hình cột phân tích |
| `POST /datasets/{id}/columns/reset` | Nhóm A | Reset tên cột về file gốc |
| `PATCH /datasets/{id}/columns` | Nhóm A | Đổi tên nhiều cột 1 lần |
| `DELETE /users/me` | Nhóm A | Xoá tài khoản của tôi (soft-delete) |

### 3.15. Phiên bản hợp đồng và tương thích

**Quyết định.** API version qua **path prefix** `/api/v1`.

**Quy tắc bắt buộc:**
1. `/api/v1` là phiên bản hiện tại. Backend mới **chỉ** phục vụ `/api/v1` — không phục vụ đường dẫn không có version.
2. Khi phát sinh thay đổi **phá vỡ** hợp đồng (xoá field, đổi kiểu, đổi semantics) → tạo `/api/v2`, giữ `/api/v1` trong thời gian chuyển tiếp.
3. Thay đổi **không** phá vỡ (thêm field tuỳ chọn, thêm endpoint) → giữ `/api/v1`, không cần version mới.
4. Dự án mới, chưa có frontend chạy → **không cần** phiên bản song song `/api/v1` + `/api/legacy` trong lúc chuyển tiếp. Backend cũ và mới chạy ở **cổng khác nhau** (Phần 4 mục 3.10).
5. OpenAPI docs tại `/api/v1/docs` — sinh tự động từ schema Zod khai báo cạnh DTO (`modules/*/infrastructure/http/dtos/`).

**Danh sách thay đổi phá vỡ hợp đồng** (để frontend biết trước):

| Thay đổi | Lý do |
|---|---|
| Bỏ key `message` khỏi response thành công | Chuẩn hoá |
| Bỏ key bọc (`{ workspace: {...} }` → `{...}`) | Chuẩn hoá |
| `snake_case` → `camelCase` cho toàn bộ field | Chuẩn hoá |
| Lỗi: `{ message }` → `{ error: { code, message, details? } }` | Chuẩn hoá |
| Danh sách: `{ workspaces: [...] }` → `{ items: [...], meta: {...} }` | Chuẩn hoá |
| `DELETE /users/me` bị bỏ | ~~Không có trong danh mục tính năng~~ **(v8: đã hiện thực hoá lại — xem bảng endpoint mới)** |
| `DELETE /datasets/:id` bị bỏ | ~~Mỗi project chỉ có 1 dataset~~ **(v8: đã hiện thực hoá lại — xem bảng endpoint mới)** |
| 12 endpoint thuộc module LEGACY bị bỏ | Module bị xoá (Phần 4 mục 3.9) |

### 3.16. Kiểm thử hợp đồng

**Quy tắc bắt buộc — kiểm tra được bằng script hoặc test tự động:**

| # | Kiểm tra |
|---|---|
| C1 | Mọi route khai báo trong controller đều có `@ApiOperation` với `summary` và `operationId` |
| C2 | Mọi endpoint có request body đều dùng schema Zod khai báo cạnh DTO — không viết DTO thủ công |
| C3 | Mọi endpoint có path param đều validate định dạng id |
| C4 | Mọi endpoint trả danh sách đều có `cursor`/`limit` và trả `{ items, meta: { nextCursor, hasMore, limit } }` |
| C5 | Mọi lỗi đều theo cấu trúc `{ error: { code, message } }` — không có response lỗi tự do |
| C6 | Không response nào chứa `passwordHash`, `refreshTokenHash`, `googleId`, `__v` |
| C7 | Endpoint nào có `expectedVersion` bắt buộc thì DTO **không** cho phép thiếu |
| C8 | OpenAPI sinh từ schema Zod khớp 100% với route thực tế |

**Kết quả C8 là tiêu chí nghiệm thu của Phần 7** — hợp đồng API được mô tả đúng như thực thi.

## 4. Đầu vào và đầu ra

**Đầu vào**
- Phần 2 v11 — 86 tính năng, quy tắc nghiệp vụ, mã lỗi.
- Phần 3 v6 — 66 use case, quy ước lỗi (mục 3.1), vòng đời trạng thái.
- Phần 4 v4 — thiết kế URL mới, danh sách module LEGACY bị xoá.
- Phần 5 v3 — keyset cursor pagination, trường `version`, cấu trúc handler/controller.
- Phần 6 v7 — ma trận quyền 66 use case, chính sách token, chính sách liên kết Google OAuth, quy tắc tải file.
- Phần 12 v8 — cơ chế AI bất đồng bộ, input fingerprint, quy tắc import file.
- Mã nguồn hiện tại — 18 controller, **86 route HTTP thực thi**, `all-exceptions.filter.ts`, `zod-validation.pipe.ts`.

**Đầu ra**
- 8 quyết định nền tảng về hợp đồng.
- Cấu trúc response thành công / lỗi / phân trang với ví dụ JSON.
- Bảng quy ước đặt tên field theo 8 lớp.
- Quy tắc URL, phân trang, lọc, sắp xếp.
- Đặc tả upload, download, bất đồng bộ, optimistic locking.
- Bảng **86 endpoint** phủ đủ 86 tính năng, có cột quyền.
- Bảng đối chiếu với API hiện tại (giữ 24 / đổi 8 / xoá 12 / thêm 65) + bảng 10 endpoint mới hiện thực hoá sau v7.
- **Hợp đồng Google OAuth 2.0** (mục 3.5c) — 2 endpoint, ma trận 7 lỗi.
- **Hợp đồng tổng quan workspace** (mục 3.5d) — 2 endpoint.
- Chính sách phiên bản hợp đồng và danh sách thay đổi phá vỡ hợp đồng.
- 8 quy tắc kiểm thử hợp đồng C1–C8.

## 5. Điều kiện hoàn tất phần này

Có API contract cùng ví dụ thành công/lỗi và liên kết tới tiêu chí kiểm thử.

**Trạng thái v1:** quy ước hợp đồng, bảng endpoint đầy đủ, đối chiếu API hiện tại và quy tắc kiểm thử đã chốt. Còn 4 câu hỏi mở tại mục 6.2.

## 6. Câu hỏi và phụ thuộc còn mở

### 6.1. Đã chốt ở v1

| # | Câu hỏi | Kết quả |
|---|---|---|
| 1 | Cấu trúc response thành công | **Thẳng dữ liệu**, không envelope (mục 3.2) |
| 2 | Quy ước đặt tên field | JSON **camelCase**, MongoDB `snake_case` (mục 3.3) |
| 3 | Cấu trúc lỗi | `{ error: { code, message, details? } }` (mục 3.4) |
| 4 | Kiểu URL | **REST tài nguyên**, lồng theo phân cấp (mục 3.6) |
| 5 | Thông tin phân trang | Object `meta` trong body (mục 3.5) |
| 6 | Idempotency khi upload | **Không** có (mục 3.8) |
| 7 | Luồng bất đồng bộ | **202 Accepted** + `{ jobId, status, pollUrl }` (mục 3.10) |
| 8 | Cơ chế download | **Stream trực tiếp**, kiểm tra quyền trước (mục 3.9) |
| 9 | Bộ lọc Data Views | `POST /records/query` với body JSON (mục 3.7) |
| 10 | Phiên bản hợp đồng | Path prefix `/api/v1`, không cần chạy song song (mục 3.15) |

### 6.2. Đã chốt ở v6 (2026-11-07)

| # | Câu hỏi | Ảnh hưởng | Nơi xử lý |
|---|---|---|---|
| 1 | ~~Có nên trả `ETag` cho các endpoint GET tài nguyên để frontend cache?~~ **Đã chốt v6: KHÔNG ETag** — chỉ cache client đơn giản (theo quyết định người dùng) | Đã chốt | Phần 14 |
| 2 | ~~Endpoint `GET /projects` — phân biệt bằng query param hay tách 2 endpoint?~~ **Đã chốt v6: theo dự án mẫu — list project theo workspace `GET /workspaces/:workspaceId/projects` (code hiện tại), không thêm endpoint global; lọc mine/shared thực hiện ở client theo `ownerId`/membership** | Đã chốt | Phần 8 |
| 3 | ~~Có cần `GET /health` và `GET /health/ready` riêng?~~ **Đã chốt v6: CÓ** — hai endpoint ngoài `/api/v1` cho monitoring (liveness/readiness), xem Phần 10 v6 | Đã chốt | Phần 10 |
| 4 | ~~Trường `version` trả mọi resource hay chỉ resource có locking?~~ **Đã chốt v6: TRẢ MỌI RESOURCE** — đồng nhất mapper, payload tăng không đáng kể | Đã chốt | Phần 8 |

| 5 | ~~Ngưỡng 200.000 dòng lọc trong JS~~ **Đã chốt v6: chuyển sang lọc server-side có phân trang** (không lọc 200k trong JS; Data View gọi `POST /records/query` + cursor) | Đã chốt | Phần 8/Phần 10 |
| 6 | ~~Giới hạn đính kèm sự cố~~ **Đã chốt v6: 10MB/tệp, tối đa 3 tệp, MIME `image/png,image/jpeg,application/pdf`** (validation ISSUE-01, Phần 8/Phần 11) | Đã chốt | Phần 8 |

**Phụ thuộc cứng:** câu hỏi 4 phải chốt trước khi thiết kế schema ở Phần 8. Câu hỏi 3 phải chốt trước khi cấu hình monitoring ở Phần 10.

### 6.3. Phụ thuộc bên ngoài

- Schema Zod khai báo cạnh DTO (`modules/*/infrastructure/http/dtos/`) dùng chung cho validate và sinh OpenAPI (Phần 5 v3 mục 3.14).
- `zod-to-json-schema` — sinh OpenAPI từ schema Zod.
- `MONGODB_URI` cho replica set (transaction bắt buộc cho outbox).
- `REDIS_URL` cho cache, rate-limit và adapter Socket.IO (multi-instance).
- `AI_INFERENCE_BASE_URL` + `AI_MODEL_ID` cho **AI cục bộ** (thay cho `GEMINI_API_KEY`); `KAFKA_BROKERS` cho bus sự kiện.
- Cấu hình R2/S3 cho file gốc và tệp đính kèm.

## 7. Prompting log và lịch sử thay đổi

- **Xác nhận v8 / 2026-11-16 (Nhóm B/D/E/H — đối chiếu mã nguồn thực thi):** bảng endpoint cập nhật từ 85 → **86 route HTTP thực thi**; thêm mục **3.5c** (hợp đồng Google OAuth 2.0 + ma trận 7 lỗi) và mục **3.5d** (hợp đồng tổng quan workspace); sửa 4 lệch so với v7: `PROJ-09` dùng `GET /projects/{id}/members` (không có `/members/search`), `PATCH /datasets/{id}` + `DELETE /datasets/{id}` **đã hiện thực hoá** (v7 ghi "Bỏ"), `ANALYSIS-01` dùng `POST` + thêm route `GET` xem cấu hình, `DELETE /users/me` **đã hiện thực hoá**; thêm bảng 10 endpoint mới / Theo yêu cầu vệ sinh tài liệu Bước 8 (`edit/02_ke_hoach_thuc_thien.md` Nhóm I3) / Đối chiếu bằng quét tự động decorator `@Get/@Post/@Patch/@Put/@Delete` trên toàn bộ controller.
- **Xác nhận v7 / 2026-11-15 (Nhóm A — keyset cursor):** `GET /workspaces` và `GET /workspaces/{workspaceId}/projects` chuyển từ offset (`page`/`total`) sang **keyset cursor** (`cursor`/`limit`); response `{ items, meta: { nextCursor, hasMore, limit } }`, bỏ `total`/`page`/`totalPages`; cursor ràng buộc theo `sort` → `VALIDATION_ERROR` / Theo quyết định Q0.1 (`edit/02_ke_hoach_thuc_thien.md` Nhóm A) / Cập nhật mục 3.1 (quyết định 5), 3.2 (rule 3b), 3.5 + thêm mục 3.5b, quy tắc C4.
- **Xác nhận v3 / 2026-11-05:** Phân trang chuyển từ offset sang **cursor** — response `{ items, meta: { nextCursor, hasMore } }`, bỏ `page`/`total`/`totalPages`; thêm ràng buộc cursor theo truy vấn và theo điều kiện lọc / Theo lựa chọn người dùng / Cập nhật mục 3.1 (quyết định 5), 3.2, 3.5, quy tắc C4.
- **Xác nhận v3 / 2026-11-05:** Thêm 6 endpoint nhóm FEEDBACK (`FB-01`→`FB-06`) cho nhận xét người dùng và thống kê chất lượng AI / Theo yêu cầu người dùng / Bổ sung mục 3.17.1, bảng endpoint lên 86.
- **Xác nhận v3 / 2026-11-05:** Thêm kênh **Socket.IO** để đẩy trạng thái realtime tới giao diện / Theo yêu cầu người dùng / Bổ sung mục 3.17.2.
- **Xác nhận v3 / 2026-11-05:** Chỉ hỗ trợ file `.csv` — bỏ mảng `sheets` trong response upload, bỏ `sheetId` khỏi `records/query` và `columnIssues`, gộp endpoint schema về `/datasets/{datasetId}/schema` / Theo yêu cầu người dùng / Cập nhật mục 3.8 và bảng đối chiếu 3.14.

- **Yêu cầu:** Người dùng yêu cầu liệt kê toàn bộ các phần theo thứ tự thực hiện, tạo sẵn file v1, lần lượt hoàn thiện vòng đầu rồi tạo v2 khi có thay đổi tiếp theo.
- **v1 / 2026-11-02:** Tạo khung phần 7 / Chuẩn bị thảo luận tuần tự / Chỉ tạo tài liệu, chưa thực thi thay đổi backend hoặc dữ liệu.
- **v1 / 2026-11-05:** Hoàn thiện vòng đầu. Chốt 10 quyết định về hợp đồng API; bảng **85 endpoint** phủ đủ 84 tính năng kèm cột quyền lấy từ ma trận Phần 6 v3; đối chiếu với API hiện tại (giữ 24 / đổi 8 / xoá 12 / thêm 65); đặc tả upload, download, bất đồng bộ, optimistic locking; chính sách phiên bản hợp đồng; 8 quy tắc kiểm thử C1–C8.
- **Xác nhận v4 / 2026-11-06:** Schema kết quả phân tích bổ sung `dq05.status/rules/violations` + `correlationMatrix/vif/aiCorrelationAssessment` (mục 3.13b) / Theo yêu cầu người dùng + Phần 2 v7 / Chưa sửa backend.
