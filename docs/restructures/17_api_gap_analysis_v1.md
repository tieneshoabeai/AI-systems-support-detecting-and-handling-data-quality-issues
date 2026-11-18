# Báo cáo rà soát API — 2026-11-18 (v1.1)

**Phạm vi:** backend `src/backend` vs hợp đồng `docs/restructures/7_api_contracts_v8.md` (§3.13) và
`docs/restructures/2_feature_catalog_v11.md`.

**Công cụ:** `src/backend/scripts/check-api-coverage.cjs` — quét tự động decorator
`@Get/@Post/@Put/@Patch/@Delete` trong toàn bộ `*.controller.ts` rồi đối chiếu bảng route
của hợp đồng.

**Trạng thái:** P1–P5 **đều đã xử lý** (xem mục 2). Hợp đồng cập nhật lên **v8.1** (87 route).

---

## 1. Kết quả bao phủ route — 100%

| Chỉ số | Giá trị |
|---|---|
| Route trong hợp đồng §3.13 | **87** (v8: 86 + `GET /auth/sessions/me` thêm ở đợt P2) |
| Route trong mã nguồn | **87** |
| Thiếu | **0** |
| Thừa | **0** |

Toàn bộ 87 route khớp 1-1 về method + path (path param chuẩn hoá `{id}` ↔ `:id`).
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
| 5 | Thêm `check-api-coverage.cjs` vào `pnpm run test:arch` để chặn regression route | Thấp | S | ⬜ Chưa |

---

## 4. Trạng thái kiểm thử hiện tại

- Unit test: **558 test / 37 suite** (546 → 558: +12 test mới cho P2 + P3).
- E2E: **5 suite / 64 test** — `health.e2e-spec.ts`, `security/authorization.e2e-spec.ts`,
  `security/google-oauth.e2e-spec.ts`, `security/google-oauth-cookie.e2e-spec.ts`,
  `security/cookie-parser-regression.e2e-spec.ts`. **Chưa có E2E cho 83 route còn lại.**
- Chất lượng (đợt P2–P5, 2026-11-18): type-check 0 lỗi · lint 0 cảnh báo ·
  unit 558/558 · E2E 64/64 · arch 17/17 · `arch:verify-di` OK ·
  `check-api-coverage.cjs` → **87/87 khớp, thiếu 0, thừa 0**.

---

## 5. Cách chạy lại kiểm tra

```bash
cd src/backend
node scripts/check-api-coverage.cjs   # đối chiếu route code vs hợp đồng §3.13
node scripts/extract-routes.cjs       # liệt kê toàn bộ route kèm summary
```
