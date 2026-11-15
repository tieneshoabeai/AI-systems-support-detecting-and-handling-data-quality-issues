# Báo cáo Bước 2 — Nhóm A: Keyset Cursor Pagination

> **Ngày thực hiện:** 2026-11-15
> **Kế hoạch nguồn:** `edit/02_ke_hoach_thuc_thien.md` — Nhóm A (A1–A7), Bước 2
> **Quyết định:** Q0.1 — *Phân trang: cursor toàn hệ thống*

---

## 1. Tóm tắt

Bước 2 chuyển hai endpoint danh sách lớn của hệ thống từ **offset pagination** (`page`/`limit` + `total`) sang **keyset cursor pagination** (`cursor`/`limit` + `meta.nextCursor`/`meta.hasMore`):

| Endpoint | Trước | Sau |
|---|---|---|
| `GET /workspaces` | `?page=1&limit=15` → `{ items, total, page, limit }` | `?cursor=...&limit=15` → `{ items, meta: { nextCursor, hasMore, limit } }` |
| `GET /workspaces/{workspaceId}/projects` | `?page=1&limit=15` → `{ items, total, page, limit }` | `?cursor=...&limit=15` → `{ items, meta: { nextCursor, hasMore, limit } }` |

**Kết quả kiểm thử:** 218 unit test + 52 E2E test + 16 test kiến trúc — **tất cả PASS**. ESLint: **0 error**. TypeScript: **compile sạch**.

---

## 2. Vì sao chuyển sang keyset cursor?

Offset pagination (`skip`/`limit`) có 3 vấn đề nghiêm trọng với hệ thống dữ liệu lớn:

1. **Trôi dữ liệu (drift)** — nếu có bản ghi mới được chèn giữa 2 lần gọi, các bản ghi ở cuối danh sách bị đẩy sang trang sau → client **bỏ sót** bản ghi.
2. **Trùng dữ liệu** — nếu có bản ghi bị xoá, các bản ghi phía sau dịch lên trang trước → client **thấy trùng** bản ghi.
3. **Chi phí tuyến tính** — `skip(N)` phải quét N bản ghi đầu tiên; `countDocuments` phải đếm toàn bộ collection. Cả hai đều **O(collection)**.

Keyset cursor giải quyết cả 3: điều kiện lọc là so sánh giá trị (`> value` hoặc `< value`) trên trường sort + tiebreaker `_id`, không phải vị trí. Truy vấn luôn dùng index, không cần `countDocuments`.

---

## 3. Chi tiết kỹ thuật

### 3.1. Cấu trúc con trỏ (opaque)

Con trỏ là chuỗi **Base64 URL-safe** mã hoá 4 thành phần:

| Khóa | Ý nghĩa | Ví dụ |
|---|---|---|
| `s` | Mã loại sắp xếp | `last_accessed` |
| `k` | Giá trị trường sort của phần tử cuối (ISO-8601 nếu là ngày) | `2026-11-15T08:30:00.000Z` |
| `n` | `1` nếu giá trị sort là `null`, ngược lại `0` | `0` |
| `id` | `_id` hex của phần tử cuối (tiebreaker) | `507f1f77bcf86cd799439011` |

Con trỏ là **opaque** — client không được parse, không được tự chế, không được lưu lâu dài (đúng quy ước Phần 7 mục 3.5).

### 3.2. Xử lý trường ngày có thể `null`

`last_accessed_at` là trường nullable. Theo thứ tự so sánh BSON của MongoDB, `null` **luôn nhỏ hơn** mọi giá trị `Date`:

```
sort tăng dần :  [null] → [date nhỏ nhất] → … → [date lớn nhất]
sort giảm dần:  [date lớn nhất] → … → [date nhỏ nhất] → [null]
```

Vì vậy điều kiện keyset phải phân biệt 2 trường hợp:

- **Con trỏ trỏ vào nhóm `null`:**
  - sort tăng dần → `{ $or: [ { field: null, _id: {$gt} }, { field: {$ne: null} } ] }`
  - sort giảm dần → `{ field: null, _id: {$lt} }`
- **Con trỏ trỏ vào một giá trị ngày cụ thể:**
  - sort tăng dần → `{ $or: [ { field: {$gt: cmp} }, { field: cmp, _id: {$gt} } ] }`
  - sort giảm dần → `{ $or: [ { field: {$lt: cmp} }, { field: cmp, _id: {$lt} }, { field: null } ] }`

### 3.3. Tiebreaker `_id`

Mọi truy vấn dùng `sort({ <field>: <dir>, _id: <dir> })`. Điều này đảm bảo thứ tự **tổng thể** (deterministic) — không có 2 bản ghi nào có cùng giá trị sort mà thứ tự giữa chúng không xác định. Nếu không có tiebreaker, phân trang có thể bỏ sót hoặc trùng bản ghi khi nhiều bản ghi có cùng giá trị sort.

### 3.4. Không dùng `countDocuments`

`hasMore` được suy ra bằng cách lấy `limit + 1` bản ghi:
- Nếu nhận được `limit + 1` → còn dữ liệu → `hasMore = true`, cắt bỏ phần tử thừa.
- Nếu nhận được ≤ `limit` → hết dữ liệu → `hasMore = false`.

### 3.5. Ràng buộc cursor theo `sort`

Con trỏ mang theo mã sort (`s`). Khi client gửi lại cursor với tham số `sort` khác → backend trả **HTTP 400 `VALIDATION_ERROR`**:

```
GET /workspaces?sort=updated&cursor=<cursor sinh từ sort=name_asc>
→ 400 { "error": { "code": "VALIDATION_ERROR", "message": "Cursor không khớp với tham số sort hiện tại. Vui lòng bắt đầu lại từ trang đầu." } }
```

Client phải bắt đầu lại từ trang đầu (không truyền `cursor`).

---

## 4. Các file đã thay đổi

### 4.1. File mới — tiện ích dùng chung (`src/shared/pagination/`)

| File | Nội dung |
|---|---|
| `keyset-cursor.ts` | `encodeKeysetCursor` / `decodeKeysetCursor` / `parseListCursor` + `InvalidCursorError` |
| `keyset-filter.util.ts` | `buildKeysetCondition` (điều kiện MongoDB) + `buildKeysetSort` (sort kèm tiebreaker) |
| `keyset-value.util.ts` | `extractSortValue` — trích giá trị sort từ document thô (Date → ISO, null → cờ) |
| `keyset-sort.util.ts` | `COMMON_SORT_SPECS` (bảng ánh xạ mã sort → trường + chiều) + `resolveSortSpec` |
| `keyset-memory.util.ts` | `compareBySort` / `isAfterCursor` / `sortValueOf` — cho đường phân trang trong bộ nhớ (admin) |
| `src/shared/utils/list-cursor.ts` | Type `ListCursor` + `ListPage` (thuần data, dùng được ở tầng domain theo CA11) |

### 4.2. File đã sửa

| File | Thay đổi |
|---|---|
| `modules/workspaces/domain/ports/workspace.repository.port.ts` | Bỏ `page` khỏi `WorkspaceListQuery`; thêm `cursor?: ListCursor`; đổi kiểu trả về `findByUserPaged` → `{ items, nextCursor, hasMore }`; thêm `WORKSPACE_SORT_OPTIONS` / `WorkspaceSort`; thêm `WorkspaceListInput` (con trỏ dạng chuỗi opaque cho HTTP) |
| `modules/workspaces/infrastructure/persistence/workspaces.repository.ts` | `findByUserPaged` chuyển sang keyset: `$and` conditions + `buildKeysetCondition` + `buildKeysetSort` + `limit + 1`; bỏ `countDocuments` |
| `modules/workspaces/application/workspaces.service.ts` | `listWorkspaces` → trả `{ items, meta }`; parse cursor + bắt `InvalidCursorError` → `BadRequestException`; đường admin dùng keyset in-memory |
| `modules/workspaces/infrastructure/http/dtos/list-workspaces-query.dto.ts` | Bỏ `page`; thêm `cursor?: string` (max 512) |
| `modules/workspaces/infrastructure/http/workspaces.controller.ts` | Thêm `@ApiZodQuery` + mô tả Swagger về cursor pagination |
| `modules/projects/domain/ports/project.repository.port.ts` | Tương tự workspaces |
| `modules/projects/infrastructure/persistence/projects.repository.ts` | `findByWorkspacePaged` chuyển sang keyset |
| `modules/projects/application/projects.service.ts` | `listProjectsByWorkspace` → trả `{ items, meta }` |
| `modules/projects/infrastructure/http/dtos/list-projects-query.dto.ts` | Bỏ `page`; thêm `cursor?: string` |
| `modules/projects/infrastructure/http/projects.controller.ts` | Thêm `@ApiZodQuery` + mô tả Swagger |
| `shared/pagination/cursor-paginated.response.ts` | `CursorMeta` thêm `limit`; thêm `createCursorPage()` helper |

### 4.3. File kiểm thử

| File | Nội dung |
|---|---|
| `test/keyset-pagination.spec.ts` (mới) | 18 ca: encode/decode, parse cursor, điều kiện MongoDB (null handling), trích giá trị sort, ánh xạ sort, in-memory |
| `test/workspaces.spec.ts` | Cập nhật mock `findByUserPaged`; thêm 2 ca (cursor sai `sort` → 400, cursor hỏng → 400) |
| `test/projects.spec.ts` | Cập nhật mock `findByWorkspacePaged`; thêm 2 ca (meta có `limit`, không có `total`; cursor sai `sort` → 400) |

### 4.4. Tài liệu

| File | Thay đổi |
|---|---|
| `docs/restructures/7_api_contracts_v7.md` (mới) | Mục 3.2 (rule 3b), mục 3.5 (thêm mục **3.5b** chi tiết cursor pagination đã hiện thực hoá), quy tắc C4, lịch sử thay đổi |
| `docs/restructures/13_testing_acceptance_plan_v8.md` (mới) | Quy tắc **C14**, **C15**; mục **3.11.2b** (bộ test keyset cursor); bảng tổng kết ma trận 120 → 122 |
| `docs/restructures/2_feature_catalog_v10.md` (mới) | Mục **3.36b** (keyset cursor); cập nhật `WS-02` + `PROJ-02` |
| `docs/restructures/README.md` | Cập nhật mục lục sang v7 / v8 / v10 |

---

## 5. Thay đổi API (Breaking change)

### 5.1. Tham số query

```diff
- GET /workspaces?page=1&limit=15&sort=name_asc
+ GET /workspaces?limit=15&sort=name_asc
```

```diff
- GET /workspaces/{workspaceId}/projects?page=1&limit=15
+ GET /workspaces/{workspaceId}/projects?limit=15
```

| Tham số | Mới | Ghi chú |
|---|---|---|
| `cursor` | `string` (opaque, tối đa 512 ký tự) | Lấy từ `meta.nextCursor` của trang trước |
| `limit` | `number` 1–100 | Mặc định 15 |
| `sort` | `last_accessed` \| `updated` \| `name_asc` \| `name_desc` \| `joined` | Mặc định `last_accessed` |
| `search` | `string` | Không đổi |
| `role` | `owner` \| `member` | Chỉ cho workspaces |
| `status` | `not_started` \| `in_progress` \| `completed` | Chỉ cho projects |

### 5.2. Response

```diff
  {
    "items": [ ... ],
-   "total": 42,
-   "page": 1,
-   "limit": 15
+   "meta": {
+     "nextCursor": "eyJzIjoibGFzdF9hY2Nlc3NlZCIs...",
+     "hasMore": true,
+     "limit": 15
    }
  }
```

### 5.3. Mã lỗi mới

| Mã | HTTP | Điều kiện |
|---|---|---|
| `VALIDATION_ERROR` | 400 | Cursor hỏng / không giải mã được |
| `VALIDATION_ERROR` | 400 | Cursor sinh từ tham số `sort` khác |

---

## 6. Kiểm thử

### 6.1. Kết quả tự động

```
Test Suites: 22 passed, 22 total
Tests:       218 passed, 218 total        ← unit test (Bước 1: 191, +27 ca mới)

Test Suites: 2 passed, 2 total
Tests:       52 passed, 52 total          ← E2E

Test Suites: 4 passed, 4 total
Tests:       16 passed, 16 total          ← kiến trúc (zero-any, guard-coverage, zod-openapi, clean-architecture)

npx tsc --noEmit     → 0 error
npx eslint           → 0 error, 153 warnings (cảnh báo có sẵn từ Bước 0, sẽ siết ở Bước 7)
```

### 6.2. Ma trận phủ quy tắc

| Quy tắc | Nội dung | Trạng thái |
|---|---|---|
| C4 | `meta` phân trang đúng cấu trúc | ☑ |
| C9 | `meta` có `nextCursor` + `hasMore`, **không** có `total`/`offset` | ☑ |
| C10 | Cursor là **opaque**; sai định dạng → `VALIDATION_ERROR` | ☑ |
| C11 | Duyệt trang bằng cursor → không trùng, không thiếu, không lệch thứ tự | ☑ (tầng 1) / ☐ (tầng 5 — cần Mongo thật) |
| C12 | Chèn/xoá giữa 2 lần đọc → không bỏ sót | ☑ (tầng 1) / ☐ (tầng 5 — cần Mongo thật) |
| C14 | Cursor ràng buộc theo `sort` | ☑ |
| C15 | Cấm `countDocuments`/`skip` cho list workspace/project | ☑ |

### 6.3. Quy trình kiểm thử thủ công (cần MongoDB thật)

Ma trận C11/C12 ở tầng 5 cần dữ liệu ≥ 3 trang để đối chiếu. Script kiểm tra:

```bash
# 1. Khởi động stack
cd src/backend && docker compose up -d
pnpm run db:bootstrap

# 2. Tạo >= 40 workspace cho 1 user để có 3 trang (limit=15)
# 3. Duyệt trang bằng cursor, so sánh với offset
```

Kiểm tra thủ công bằng Swagger:

| Bước | Thao tác | Kết quả mong đợi |
|---|---|---|
| 1 | `GET /workspaces?limit=5` | `meta.hasMore = true`, `meta.nextCursor` khác null, `meta.limit = 5` |
| 2 | `GET /workspaces?limit=5&cursor=<nextCursor>` | Trang tiếp theo, không trùng bản ghi trang trước |
| 3 | Lặp lại đến khi `hasMore = false` | `nextCursor = null` |
| 4 | `GET /workspaces?limit=5&sort=updated&cursor=<cursor của sort=name_asc>` | **400 VALIDATION_ERROR** |
| 5 | `GET /workspaces?limit=5&cursor=xxx-khong-hop-le` | **400 VALIDATION_ERROR** |
| 6 | `GET /workspaces?limit=5` và kiểm tra body | **Không** có key `total` / `page` |

---

## 7. Ảnh hưởng tới các bước sau

| Bước | Ghi chú |
|---|---|
| **Bước 3** (E+F+G+H) | Nhóm E (member search & workspace overview) sẽ dùng lại tiện ích keyset đã tạo ở Bước 2 — không viết lại. |
| **Bước 4** (L2+L3a+L4) | `workspaces.repository.ts` và `projects.repository.ts` đã được refactor ở Bước 2 → giảm rủi ro xung đột khi tách cross-module coupling. |
| **Bước 7** (J1) | 153 warning ESLint hiện có sẽ được siết; các file mới ở Bước 2 đã viết theo chuẩn strict (`explicit-function-return-type`, `consistent-type-imports`, không `any`). |
| **Bước 8** (I — vệ sinh tài liệu) | Đã cập nhật 3 file trong `docs/restructures/` sang phiên bản mới. Bước 8 sẽ hoàn tất các file còn lại (`8_database_schema_v7`, `10_runtime_operations_v7`, `6_security_authorization_v7`, `00_cong_nghe_ky_thuat...`). |

### Điểm lệch cần chuẩn hoá sau

1. **Tên tham số sort.** Hai endpoint này dùng `sort` (giá trị kết hợp) thay vì cặp `sortBy`/`sortOrder` như quy ước chung ở Phần 7 mục 3.5. Đã ghi nhận là điểm lệch **đã biết** trong `7_api_contracts_v7.md` mục 3.5b — sẽ chuẩn hoá khi có frontend sử dụng.
2. **`meta.limit` chưa đồng bộ toàn hệ thống.** Các endpoint list khác (`/notifications`, `/issues`, `/admin/users`) đã trả `meta.nextCursor` + `meta.hasMore` nhưng **chưa** có `meta.limit`. Sẽ chuẩn hoá ở đợt tinh chỉnh hợp đồng API tiếp theo.

---

## 8. Trạng thái sau Bước 2

| Hạng mục | Trạng thái |
|---|---|
| Bước 0 — J0+K0+M0 | ✅ Hoàn tất |
| Bước 1 — C (remember-me) + D (issue needs_info) | ✅ Hoàn tất |
| **Bước 2 — A (keyset cursor)** | ✅ **Hoàn tất** |
| Bước 3 — E+F+G+H | ⏳ Tiếp theo |
| Bước 4 — L2+L3a+L4 | ⏳ Chưa |
| Bước 5 — L1 (tách commands/queries) | ⏳ Chưa |
| Bước 6 — B (Google OAuth) | ⏳ Chưa |
| Bước 7 — J1 (siết ESLint) | ⏳ Chưa |
| Bước 8 — I (vệ sinh tài liệu) | ⏳ Chưa (đã làm 3/9 file) |
