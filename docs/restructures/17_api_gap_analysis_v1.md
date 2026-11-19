# Báo cáo rà soát API — 2026-11-18 (v1.2)

**Phạm vi:** backend `src/backend` vs hợp đồng `docs/restructures/7_api_contracts_v8.md` (§3.13) và
`docs/restructures/2_feature_catalog_v11.md`.

**Công cụ:** `src/backend/scripts/check-api-coverage.cjs` — quét tự động decorator
`@Get/@Post/@Put/@Patch/@Delete` trong toàn bộ `*.controller.ts` rồi đối chiếu bảng route
của hợp đồng. **Đã tích hợp vào `pnpm run test:arch`** (test `test/api-contract-coverage.spec.ts`).

**Trạng thái:** P1–P5 **đều đã xử lý** (xem mục 2). P6 (GĐ12 — semaphore) và
P7 (hợp đồng v8.2 + cơ chế chặn hồi quy) **đã xử lý 2026-11-19**.
Hợp đồng cập nhật lên **v8.3** (90 route — GĐ7 chỉ **thêm field**, không đổi route).

---

## 1. Kết quả bao phủ route — 100%

| Chỉ số | Giá trị |
|---|---|
| Route trong hợp đồng §3.13 | **90** (v8.1: 87 + `GET /projects`, `GET /datasets/{datasetId}/charts`, `PATCH /datasets/{datasetId}/columns/pii`) |
| Route trong mã nguồn | **90** |
| Thiếu | **0** |
| Thừa | **0** |

Toàn bộ 90 route khớp 1-1 về method + path (path param chuẩn hoá `{id}` ↔ `:id`).
Không có endpoint chết (`NotImplementedException`), không có `TODO`/`FIXME` trong `src/`.

**Kết luận:** phần "thiếu API" theo nghĩa route không tồn tại. Các vấn đề còn lại là
*vấn đề chất lượng hợp đồng* và *lỗi runtime*, không phải thiếu endpoint.

---

## 2. Các vấn đề phát hiện được

### P1 — `GET /auth/google/callback` luôn trả 401 (Google Login chưa dùng được) — ✅ **ĐÃ SỬA 2026-11-18**

**Nguyên nhân:** `req.cookies` được đọc trong `auth.controller.ts` nhưng
`cookie-parser` **chưa được cài** và **chưa được đăng ký middleware**.

- `package.json` không có `cookie-parser` / `@types/cookie-parser`.
- `node_modules/` không có `cookie-parser`.
- `main.ts` không có `app.use(cookieParser())`.

Express 5 có `res.cookie()` native (nên cookie **được set** ở `GET /auth/google`), nhưng
`req.cookies` là `undefined` → `expectedState = ''` → callback hợp lệ cũng bị reject 401
`VALIDATION_ERROR`.

**Đã thực hiện:**
1. ✅ `pnpm add cookie-parser` + `pnpm add -D @types/cookie-parser`.
2. ✅ `main.ts`: thêm `app.use(cookieParser())` (bước 3, trước CORS và Global Prefix).
3. ✅ Cookie `google_oauth_state` set với `path: '/'` rõ ràng; `clearCookie` dùng **cùng**
   thuộc tính (`path`, `httpOnly`, `secure`, `sameSite`) qua helper `clearGoogleStateCookie()`.
4. ✅ Cookie được xoá ở **mọi** nhánh: happy path, `error=` từ Google, và exception từ handler
   (trước đây chỉ clear ở happy path → state cũ còn lại sau lỗi).
5. ✅ Test E2E mới — `test/e2e/security/google-oauth-cookie.e2e-spec.ts` (6 test) và
   `test/e2e/security/cookie-parser-regression.e2e-spec.ts` (3 test, gồm **guard** đọc
   source `main.ts` để chặn hồi quy việc thiếu middleware).

**Kết quả kiểm thử:** type-check 0 lỗi · lint 0 cảnh báo · unit 546/546 ·
E2E 64/64 · arch 17/17 · `arch:verify-di` OK.

### P2 — `GET /auth/sessions/me` chưa tồn tại — ✅ **ĐÃ SỬA 2026-11-18**

Hợp đồng §3.5 (dòng 401) nêu quy tắc: *"Tài nguyên của chính mình dùng `/me`:
`GET /users/me`, `GET /auth/sessions/me`"*. Mã nguồn chỉ có `GET /auth/sessions` và
`GET /auth/sessions/:id`.

→ Đây là **sự lệch giữa hợp đồng và mã nguồn**, không phải thiếu endpoint so với bảng §3.13.
Cần chọn: bổ sung route `/auth/sessions/me` hoặc sửa §3.5 cho khớp.

**Quyết định người dùng (2026-11-18): bổ sung route** `GET /auth/sessions/me`.

**Đã thực hiện:**
1. ✅ `auth.controller.ts`: thêm `@Get('sessions/me')` — **khai báo TRƯỚC** `@Get('sessions/:id')`
   (NestJS phân giải route theo thứ tự đăng ký; nếu không, chuỗi `me` bị `:id` nuốt mất).
2. ✅ `sessionId` lấy từ **JWT** (`request.user.sessionId`) — **không** nhận từ query/path →
   không thể truy cập phiên của người khác. Thiếu `sessionId` → `404 NOT_FOUND`.
3. ✅ Tái sử dụng `GetSessionByIdHandler` (đã kiểm tra ownership → 404 nếu phiên của người khác).
4. ✅ Hợp đồng §3.13: thêm dòng `AUTH-09b` + ghi chú về thứ tự khai báo route; §3.5 giữ nguyên quy tắc.
5. ✅ Test mới trong `test/gap-analysis-p2-p3.spec.ts` (4 test) — gồm **guard đọc source**
   để chặn hồi quy khi thứ tự khai báo route bị đảo.

### P3 — `GET /admin/users` dùng offset pagination, không theo quy ước chung — ✅ **ĐÃ SỬA 2026-11-18**

- Bảng §3.4 (dòng 207) yêu cầu `GET /admin/users` hỗ trợ `sortBy` ∈
  `{createdAt, updatedAt, name, email, role, status}` và `sortOrder`.
- Mã nguồn (`admin-users.controller.ts:24`) dùng `page`/`limit`/`total`, **không có**
  `sortBy`/`sortOrder` → trả sai shape so với nguyên tắc chung của hợp đồng.

Các endpoint còn lại (`/notifications`, `/issues`, `/admin/issues`) đã dùng đúng
`sortBy`/`sortOrder` + `z.enum` (invalid → `VALIDATION_ERROR`).

**Quyết định người dùng (2026-11-18): chuyển hoàn toàn sang keyset cursor pagination**
(breaking change — client dùng `page`/`total` phải chuyển sang `cursor`).

**Đã thực hiện:**
1. ✅ `user.repository.port.ts`: `findPaged()` đổi signature → `{ items, nextCursor, hasMore }`
   (bỏ `total`), thêm `UserListQuery` / `UserListInput` / `UserSort` / `UserSortOrder`.
2. ✅ `users.repository.ts`: triển khai keyset pagination dùng helper dùng chung
   (`buildKeysetCondition`, `buildKeysetSort`, `extractSortValue`, `encodeKeysetCursor`).
   Lấy `limit + 1` bản ghi thay vì `countDocuments` → không còn query đếm tổng.
   Bảng `USER_SORT_FIELDS` ánh xạ `sortBy` → trường collection
   (`name` → `first_name` vì trường tính toán không sort được trực tiếp trong MongoDB).
3. ✅ `find-paged.handler.ts`: `sortBy` không hợp lệ → `VALIDATION_ERROR` (không fallback im lặng);
   con trỏ ràng buộc theo **cả** `sortBy` lẫn `sortOrder` (mã sort = `<field>_<asc|desc>`).
4. ✅ `admin-users.controller.ts`: query DTO → `cursor`/`limit`/`sortBy`/`sortOrder`;
   response → `{ items, meta: { nextCursor, hasMore, limit } }` (**không còn** `total`/`page`).
5. ✅ Hợp đồng §3.5b ghi rõ đây là breaking change + §3.4 bảng `sortBy` cho `GET /admin/users`.
6. ✅ Test mới trong `test/gap-analysis-p2-p3.spec.ts` (7 test) — dùng **handler thật** +
   repository giả để kiểm đúng logic validation.

### P4 — Lệch tham số `sort` vs `sortBy`/`sortOrder` (đã biết, đã ghi nhận trong hợp đồng) — ✅ **ĐÃ SỬA 2026-11-18**

§3.5b (dòng 231) đã tự ghi nhận: `/workspaces` và `/workspaces/{id}/projects` dùng tham số
`sort` (`last_accessed` | `updated` | `name_asc` | `name_desc` | `joined`) thay vì cặp
`sortBy`/`sortOrder`. Đây là **lệch đã biết**, chưa chuẩn hoá.

**Quyết định người dùng (2026-11-18): giữ nguyên `sort`**, cập nhật §3.4 ghi rõ ngoại lệ.

**Đã thực hiện:**
1. ✅ §3.4: bảng sắp xếp mặc định được chỉnh lại theo **giá trị `sort` thực tế** của 4 endpoint
   dùng `sort` (`GET /workspaces`, `GET /workspaces/{workspaceId}/projects`,
   `GET /workspaces/{id}/members`, `GET /projects/{id}/members`), đánh dấu `†`.
2. ✅ Thêm ghi chú ngoại lệ `†` giải thích rõ: dùng `sort` (gộp cả chiều), không có
   `sortBy`/`sortOrder`; đây là ngoại lệ **đã chốt**, không phải lệch tạm thời.
3. ✅ §3.5b: đổi câu "sẽ được chuẩn hoá ở đợt tinh chỉnh tiếp theo" → "**ĐÃ CHỐT** giữ nguyên `sort`".
4. ✅ Không đổi code ứng dụng → **không breaking** với client hiện có.

### P5 — `/admin/issues` dùng `sortBy`/`sortOrder` nhưng bảng §3.4 chưa tách Admin — ✅ **ĐÃ SỬA 2026-11-18**

Bảng §3.4 có cả `GET /issues` (của tôi) và `GET /issues` (Admin) — nhưng route Admin thực tế
là `GET /admin/issues`. Tên bảng lệch nhẹ so với route; không ảnh hưởng hành vi.

**Đã thực hiện:** §3.4 → đổi `GET /issues` (Admin) thành **`GET /admin/issues`**; thêm ghi chú
P5 nêu rõ đây là sửa **nhãn bảng**, không phải đổi route.

---

## 3. Đề xuất thứ tự ưu tiên

| # | Hạng mục | Rủi ro | Ước lượng | Trạng thái |
|---|---|---|---|---|
| 1 | Cài `cookie-parser` + đăng ký middleware + xoá cookie sau dùng + test E2E | **Cao** — Google Login không dùng được | S | ✅ **Xong 2026-11-18** |
| 2 | Chuẩn hoá `GET /admin/users` sang keyset cursor + `sortBy`/`sortOrder` | Trung bình — client mới sẽ gọi sai | M | ✅ **Xong 2026-11-18** (breaking: bỏ `page`/`total`) |
| 3 | Quyết định `GET /auth/sessions/me`: thêm route hay sửa hợp đồng | Thấp | S | ✅ **Xong 2026-11-18** (chọn: thêm route) |
| 4 | Cập nhật `7_api_contracts_v8.md` §3.4/§3.5 cho khớp mã nguồn | Thấp | S | ✅ **Xong 2026-11-18** (§3.4, §3.5b, §3.13) |
| 5 | Thêm `check-api-coverage.cjs` vào `pnpm run test:arch` để chặn regression route | Thấp | S | ✅ **Xong 2026-11-19** |
| 6 | Giới hạn số phân tích đồng bộ (semaphore) để không chặn event loop | Trung bình — p95 mọi endpoint khác bị ảnh hưởng | M | ✅ **Xong 2026-11-19** (GĐ12) |
| 7 | Khai báo 3 route còn thiếu trong hợp đồng (`GET /projects`, `/charts`, `/columns/pii`) | Trung bình — frontend không biết endpoint tồn tại | S | ✅ **Xong 2026-11-19** (hợp đồng v8.2) |

### P6 — GĐ12: `POST /analysis` xếp hàng, chặn event loop — ✅ **ĐÃ SỬA 2026-11-19**

- **Nguồn:** đo bằng k6 (`docs/test-reports/perf-2026-11-19.md` mục 4).
- `POST /projects/:id/analysis` xử lý **đồng bộ** toàn bộ dataset trong request
  handler → **6,4 s chặn event loop** với dataset 100.000 dòng (Node đơn luồng).
  10 request đồng thời → **xếp hàng** → `read_records` p95 nhảy **21 ms → 16,53 s**.
- **Đã thực hiện:** `AnalysisConcurrencyGuard` (semaphore, mặc định 1 slot/tiến trình,
  cấu hình `ANALYSIS_MAX_CONCURRENCY`) → khi đủ slot trả **429** kèm header
  `Retry-After` thay vì xếp hàng. **Hợp đồng API không đổi** (vẫn `201` khi thành công).
- **Kết quả:** `read_records` p95 **16,53 s → 3,95 s (−76 %)**, `dq01_50k` p95
  **60 s → 5,18 s (−91 %)**, checks 97,58 % → **99,88 %**. Độ trễ đơn lẻ không đổi
  (p95 6,38 s). 0 lỗi 5xx.
- **Còn lại:** để đạt `read_records` p95 < 2 s → phải tách worker (hướng A, đổi hợp
  đồng) hoặc đưa phần tính nặng sang `worker_threads` (hướng C).
- Chi tiết: [`22_analysis_concurrency_guard.md`](./22_analysis_concurrency_guard.md).

### P7 — Hợp đồng API lệch 3 route + thiếu cơ chế chặn hồi quy — ✅ **ĐÃ SỬA 2026-11-19**

**Nguyên nhân.** Ba route đã có trong mã nguồn nhưng không được khai báo trong
`7_api_contracts_v8.md` §3.13:

| Route | Nguồn | Mô tả |
|---|---|---|
| `GET /projects` | Đã có từ trước | PROJ-02b — danh sách project toàn hệ thống (không theo workspace) |
| `GET /datasets/:datasetId/charts` | GĐ6 (2026-11-18) | Số liệu biểu đồ (histogram, boxPlot, categoryTopN) |
| `PATCH /datasets/:id/columns/pii` | GĐ4 (2026-11-18) | Bật/tắt cờ PII cho cột |

Đồng thời, `scripts/check-api-coverage.cjs` **luôn exit 0** → không thể dùng
làm gate trong CI. Lỗi này chỉ lộ ra ở production khi frontend gọi vào route
không tồn tại.

**Đã thực hiện:**
1. ✅ Hợp đồng §3.13 → **v8.2**: thêm 3 route (33b `PROJ-02b`, 54b `DATA-01`,
   54c `VIEW-08`) kèm mô tả quyền + body/query + mã lỗi; cập nhật bảng "Kiểm
   tra bao phủ" (87 → **90 route**) và header phiên bản.
2. ✅ `check-api-coverage.cjs`: thêm **exit code 1** khi lệch + thông điệp
   chỉ rõ cần sửa hợp đồng hay mã nguồn. Thêm script `pnpm run arch:api-coverage`.
3. ✅ Test mới `test/api-contract-coverage.spec.ts` (6 test) — chạy trong
   `pnpm run test:arch`:
   - Không có route **thiếu** (hợp đồng có, mã nguồn chưa implement).
   - Không có route **thừa** (mã nguồn có, hợp đồng chưa khai báo).
   - Không có endpoint chết (`NotImplementedException` trong controller).
   - Không có `TODO`/`FIXME` trong controller.
   - Số route hai bên bằng nhau.
4. ✅ `package.json`: `test:arch` và `test:unit` cập nhật pattern để test mới
   chạy đúng chỗ (arch test không được tính vào unit test).

**Kết quả kiểm thử:** `check-api-coverage.cjs` → **90/90 khớp, thiếu 0, thừa 0** ·
`test:arch` → **5 suite / 23 test** pass.

**Đã kiểm chứng cơ chế chặn hồi quy** (regression test thủ công): thêm một route
giả `@Get('__temp-route')` vào controller → script báo "THỪA: GET /__temp-route" và
**exit 1**; gỡ bỏ → exit 0.

---

## 4. Trạng thái kiểm thử hiện tại

- Unit test: **842 test / 56 suite** (558 → 842 qua các đợt GĐ0–GĐ12, CQRS rewrite, GĐ7 và GAP-003).
- Arch test: **5 suite / 23 test** — `zero-any`, `guard-coverage`, `zod-openapi`,
  `clean-architecture`, **`api-contract-coverage`** (mới 2026-11-19).
- E2E: **5 suite / 70 test** — `health.e2e-spec.ts`, `security/authorization.e2e-spec.ts`,
  `security/google-oauth.e2e-spec.ts`, `security/google-oauth-cookie.e2e-spec.ts`,
  `security/cookie-parser-regression.e2e-spec.ts`. **Chưa có E2E cho 85 route còn lại.**
- Chất lượng (2026-11-19, sau GĐ7 + GAP-003): type-check 0 lỗi · lint 0 cảnh báo ·
  unit 842/842 · E2E 70/70 · arch 23/23 · `arch:verify-di` OK ·
  `check-api-coverage.cjs` → **90/90 khớp, thiếu 0, thừa 0**.

### GĐ7 — Port tính năng còn thiếu từ `Vqd_BE` — ✅ **ĐÃ SỬA 2026-11-19**

Chi tiết: [`23_gd7_column_roles_dq_explain.md`](./23_gd7_column_roles_dq_explain.md).

| Hạng mục | Nội dung | Trạng thái |
|---|---|---|
| GĐ7.1 | `column_roles` — ghi đè vai trò cột (schema + mapper + `SaveConfigHandler` + `GetConfigHandler` + fingerprint + `inferColumnRoles`) | ✅ |
| GĐ7.2 | `outlierBreakdown` — phân rã ngoại lệ (iqr / iqrExtreme / zscore / both) | ✅ |
| GĐ7.3 | `symbolMissingCount` + `outlierSkippedReason` | ✅ |
| GĐ7.4 | `skewness` (chỉ cột `measure`) | ✅ |
| GĐ7.5 | Gộp 2 vòng quét `numericValues` → 1 (tối ưu) | ✅ |

**Hợp đồng API v8.3** — chỉ **thêm field** (`columnRoles`, `column_roles`, 4 field trong
`dqSummary.columns`) → không phá vỏ hợp đồng (mục 3.15 quy tắc 3). Route giữ nguyên 90.

### GAP-003 — Gate lỗi tên cột chặn phân tích — ✅ **ĐÃ SỬA 2026-11-19**

Nguồn: [`test/unit_test/18_requirement_gaps.md`](../test/unit_test/18_requirement_gaps.md) GAP-003.

**Nguyên nhân.** `detectColumnIssues()` (domain entity `Dataset`) phát hiện 3 loại lỗi
tên cột (`empty_name`, `whitespace_only`, `duplicate_name`) nhưng **không tầng nào thực
thi** invariant đó → người dùng chạy phân tích được trên dataset có cột trùng tên →
bản đồ `key → tên` (label/time/value, role theo tên) đè lên nhau → **tương quan tính
nhầm cột, kết quả sai mà không báo lỗi**.

**Đã thực hiện:**
1. ✅ `RunAnalysisHandler.execute()` — gate **trước** khi đọc bất kỳ bản ghi nào:
   `dataset.columnIssues.length > 0` → `ValidationError` (HTTP 400) kèm
   `details.columnIssues[]` (key + loại lỗi + thông điệp) để frontend hiển thị chính xác cột lỗi.
2. ✅ Reset tên cột (`reset-column-names.handler.ts`) — **đã đúng** sẵn: entity
   `resetColumnNames()` gọi lại `detectColumnIssues()` sau khi khôi phục `originalName`
   → issues được **tái tính từ tên gốc**, không xoá sạch.
3. ✅ Test: `test/analysis-gap003-column-issues.spec.ts` (6 test) — dataset sạch chạy
   được; trùng tên / rỗng / chỉ khoảng trắng đều **chặn**, không tạo run, không đọc bản ghi.

**Hợp đồng API không đổi** — `POST /projects/{projectId}/analysis` nay có thêm trường hợp
lỗi `400` với `details.columnIssues` (hợp đồng §3.4 đã cho phép `details?`).

---

## 5. Cách chạy lại kiểm tra

```bash
cd src/backend
pnpm run arch:api-coverage   # đối chiếu route code vs hợp đồng §3.13 (exit 1 nếu lệch)
node scripts/check-api-coverage.cjs   # tương tự, chạy trực tiếp
node scripts/extract-routes.cjs       # liệt kê toàn bộ route kèm summary
pnpm run test:arch          # gồm test api-contract-coverage → chặn hồi quy route
```
