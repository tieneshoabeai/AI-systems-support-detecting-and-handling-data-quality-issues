# Bàn Giao Backend → Frontend

> Địa chỉ gốc khi chạy local: `http://localhost:3000/api/v1` — Swagger: `http://localhost:3000/api/v1/docs`
> Địa chỉ gốc khi qua tunnel: `https://<tunnel-host>/api/v1` — Swagger: `https://<tunnel-host>/api/v1/docs`
> Trong Swagger, ở mục **Servers** phải chọn **`Current origin`** (không để `Local Development Server`) khi mở qua tunnel, nếu không sẽ báo `Failed to fetch` vì Swagger gọi nhầm vào `localhost:3000` của máy người xem.

## 1. Cách gọi API (bắt buộc đọc)

- Mọi yêu cầu (trừ `POST /auth/register`, `POST /auth/login`, `POST /auth/refresh`) đều cần tiêu đề:
  `Authorization: Bearer <access_token>`
- `Content-Type: application/json`, trừ tải lên CSV là `multipart/form-data`.
- Không dùng cookie/session. Token lưu ở frontend (`localStorage` hoặc bộ nhớ + luồng làm mới).
- Luồng token:
  1. `POST /auth/login` → nhận `access_token` (ngắn hạn), `refresh_token` (dài hạn), `expires_in`, `user`.
  2. Gắn `access_token` vào mọi yêu cầu.
  3. Khi gặp `401`, gọi `POST /auth/refresh { refresh_token }` để lấy `access_token` mới, thử lại yêu cầu cũ một lần.
  4. `POST /auth/logout` để thu hồi phiên hiện tại.

## 2. Khung đáp ứng (áp dụng toàn bộ API JSON)

Thành công (`TransformInterceptor`):

```json
{ "success": true, "data": { "...dữ liệu thật..." } }
```

Nghĩa là với axios: `const inner = res.data.data;`

Tệp tải về (`GET report file` khi đã xong) trả về luồng trực tiếp, không bọc khung.

Lỗi (`AllExceptionsFilter`):

```json
{
  "success": false,
  "error": { "code": "HTTP_400", "message": "...", "timestamp": "...", "path": "/api/v1/..." }
}
```

- `400` + `code: ZOD_VALIDATION_ERROR`: `message` là mảng `{ field, message }` → làm nổi bật từng trường ở biểu mẫu.
- `409` + `code: DUPLICATE_RESOURCE`: trùng khoá (email...).
- Cập nhật trạng thái báo lỗi (issue) dùng khoá lạc quan: gửi sai `expectedVersion` sẽ lỗi → frontend phải đọc lại chi tiết rồi thử lại.

## 3. Quy ước chung

- ID MongoDB: chuỗi 24 ký tự hex (`/^[0-9a-fA-F]{24}$/`). Sai định dạng → `400`.
- Email luôn viết thường + cắt khoảng trắng ở server; mật khẩu tối thiểu 8 ký tự, tối đa 100 ký tự.
- Phân trang 2 kiểu:
  - Kiểu `page/limit` (workspaces, projects): `?page=1&limit=15`.
  - Kiểu `cursor/limit` (notifications, issues, feedback, data-view): đáp ứng có `meta: { nextCursor, hasMore }`, yêu cầu tiếp theo gửi `cursor=nextCursor`.
- Vai trò người dùng: `admin | analyst`. Workspace: `owner | member`. Project: `owner | member | viewer`.
- Một số điểm cuối quản trị: `GET /admin/issues*`, `PATCH /admin/issues/:id/status` yêu cầu `role=admin` (403 nếu không đủ quyền).

## 3b. Đăng nhập Google (OAuth 2.0) — frontend cần làm đúng

Backend đã hoàn thiện. Có **2 chế độ**, chọn theo kiến trúc frontend:

### Cách A — 1 thẻ (khuyến nghị cho SPA)

```js
// Nút "Đăng nhập với Google"
window.location.href = `${API}/auth/google?format=redirect`;
```

Chuỗi xử lý sau khi Google quay về `${APP_URL}`:

```js
const hash = new URLSearchParams(window.location.hash.slice(1));
if (hash.get('error')) {
  // Google từ chối / lỗi backend: VALIDATION_ERROR, CONFLICT, FORBIDDEN, ...
  showLoginError(hash.get('error'), hash.get('error_description'));
} else if (hash.get('access_token')) {
  localStorage.setItem('access_token', hash.get('access_token'));
  localStorage.setItem('refresh_token', hash.get('refresh_token'));
  // XOÁ NGAY đoạn fragment — token là bí mật, không nên nằm lại trong địa chỉ (lịch sử, ảnh chụp, ...)
  window.history.replaceState(null, '', window.location.pathname);
  window.location.href = '/';
}
```

> Token nằm trong **đoạn fragment (`#`)** chứ không phải truy vấn (`?`) → không bị ghi vào nhật ký truy cập của proxy, không nằm trong `Referer`.

### Cách B — JSON (mặc định)

```js
window.location.href = `${API}/auth/google`;   // mặc định → chế độ json
```

Hàm gọi lại (callback) trả về khung JSON — **hình dạng giống hệt `POST /auth/login`**:

```json
{ "success": true, "data": { "access_token": "...", "refresh_token": "...", "expires_in": 900, "user": { "id": "...", "email": "...", "role": "analyst" } } }
```

Đọc token ở `body.data.access_token` (lưu ý khung `data`, không phải `data.data`).

> **KHÔNG** mở cửa sổ bật lên rồi dùng `fetch` gọi lại `/auth/google/callback`: cookie `google_oauth_state` có `SameSite=Lax` → không được gửi kèm `fetch` → hàm gọi lại trả về 401.
> Với SPA hãy dùng **Cách A**.

### Đã kiểm chứng ở backend

- `GET /auth/google` → **302** + `Set-Cookie: google_oauth_state=...; HttpOnly; SameSite=Lax; Path=/` (+ `google_oauth_format=redirect` nếu có `?format=redirect`).
- `GET /auth/google/callback` → **200** `{ success: true, data: {...} }` (chế độ json) hoặc **302** về `${APP_URL}#access_token=...` (chế độ chuyển hướng).
- Lỗi → **401/409/403** với `{ success: false, error: { code, message } }` (chế độ json) hoặc **302** về `${APP_URL}#error=CODE&error_description=...` (chế độ chuyển hướng).

### Cần làm ở Google Cloud Console

`Authorized redirect URIs` phải có **chính xác** (không thêm truy vấn, không thêm `#`):

```
http://localhost:3000/api/v1/auth/google/callback
```

> Nếu dùng Cloudflare Tunnel (https), thêm một dòng dạng `https://<tunnel-host>/api/v1/auth/google/callback` và đặt `GOOGLE_REDIRECT_URI` trong `.env` trùng khớp với tên miền đó.

## 4. Sơ đồ tích hợp màn hình

1. Xác thực → `POST /auth/login` → `GET /users/me`.
2. Thanh bên workspaces → `GET /workspaces` → chọn → `GET /workspaces/:id` + `GET /workspaces/:workspaceId/projects`.
3. Vào project → `GET /projects/:id` → `GET /projects/:projectId/datasets` (chưa có thì hiện nút Tải lên).
4. Tải lên CSV → `POST /projects/:projectId/datasets/upload` (`multipart/form-data`, 1 tệp CSV duy nhất, ≤ 50MB) → `GET /datasets/:id/schema` để vẽ cột.
   > **Xoá dataset (2 bước):** `GET /projects/:projectId/datasets` → lấy `dataset.id` → `DELETE /datasets/:id`.
   > Không có `DELETE /projects/:projectId/datasets`; và **không có tuyến sửa dataset/cột** (dataset bất biến — muốn sửa dữ liệu thì xoá rồi nạp lại).
5. Lưới ảo → `GET /datasets/:datasetId/records?limit=50` lần đầu, cuộn thì dùng `cursor`; lọc/sắp xếp/tìm kiếm dùng `POST /datasets/:datasetId/records/query`.
6. Chạy phân tích → `POST /projects/:projectId/analysis` (cấu hình phân tích nằm trong thân) → thăm dò `GET /analysis/jobs/:jobId` hoặc nghe socket → đọc `GET /projects/:projectId/analysis/result`.
7. Tóm tắt → `POST /projects/:projectId/summary` (lần đầu) rồi `GET /projects/:projectId/summary`.
8. Báo cáo tệp → `POST /projects/:projectId/report` → nhận `reportId` + `pollUrl` → `GET .../report/:reportId/file` (202 = chưa xong, 200 + luồng = xong).
9. Phản hồi AI → các điểm cuối `/analyses/:analysisId/.../feedback`.
10. Chuông thông báo → `GET /notifications`, `GET /notifications/unread-count`, socket `notification.created`.
11. Báo lỗi hệ thống → `POST /issues`, `GET /issues` (người dùng) / `GET /admin/issues` (quản trị).
12. Socket realtime (xem `02-realtime-and-env.md`): kết nối `path=/api/v1/realtime?token=<access_token>`, tham gia phòng project/analysis để nhận tiến độ.

Chi tiết từng điểm cuối: xem `01-api-contract.md`. Realtime + biến môi trường + xử lý tunnel/CORS: xem `02-realtime-and-env.md`.
