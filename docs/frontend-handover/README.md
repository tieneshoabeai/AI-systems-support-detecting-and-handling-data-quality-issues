# Ban giao Backend -> Frontend

> Base URL local: `http://localhost:3000/api/v1` — Swagger: `http://localhost:3000/api/v1/docs`
> Base URL tunnel: `https://<tunnel-host>/api/v1` — Swagger: `https://<tunnel-host>/api/v1/docs`
> Trong Swagger, o **Servers** phai chon **`Current origin`** (khong de `Local Development Server`) khi mo qua tunnel, neu khong se `Failed to fetch` vi Swagger goi nham `localhost:3000` cua may nguoi xem.

## 1. Cach goi API (bat buoc doc)

- Moi request (tru `POST /auth/register`, `POST /auth/login`, `POST /auth/refresh`) deu can header:
  `Authorization: Bearer <access_token>`
- `Content-Type: application/json`, tru upload CSV la `multipart/form-data`.
- Khong dung cookie/session. Token luu o frontend (`localStorage` hoac memory + refresh flow).
- Luong token:
  1. `POST /auth/login` -> nhan `access_token` (ngan han), `refresh_token` (dai han), `expires_in`, `user`.
  2. Gan `access_token` vao moi request.
  3. Khi `401`, goi `POST /auth/refresh { refresh_token }` de lay `access_token` moi, retry request cu 1 lan.
  4. `POST /auth/logout` de thu hoi session hien tai.

## 2. Envelope tra ve (ap dung toan bo API JSON)

Thanh cong (`TransformInterceptor`):

```json
{ "success": true, "data": { "...du lieu that..." } }
```

Nghia la voi axios: `const inner = res.data.data;`

File tai ve (`GET report file` khi da xong) tra ve stream truc tiep, khong boc envelope.

Loi (`AllExceptionsFilter`):

```json
{
  "success": false,
  "error": { "code": "HTTP_400", "message": "...", "timestamp": "...", "path": "/api/v1/..." }
}
```

- `400` + `code: ZOD_VALIDATION_ERROR`: `message` la mang `{ field, message }` -> highlight tung field o form.
- `409` + `code: DUPLICATE_RESOURCE`: trung key (email...).
- Cap nhat trang thai issue dung optimistic locking: gui sai `expectedVersion` se loi -> frontend phai doc lai detail roi thu lai.

## 3. Quy uoc chung

- ID MongoDB: chuoi 24 ky tu hex (`/^[0-9a-fA-F]{24}$/`). Sai dinh dang -> `400`.
- Email luon lowercase + trim o server; password toi thieu 8 ky tu, toi da 100.
- Phan trang 2 kieu:
  - Kieu `page/limit` (workspaces, projects): `?page=1&limit=15`.
  - Kieu `cursor/limit` (notifications, issues, feedback, data-view): response co `meta: { nextCursor, hasMore }`, request tiep theo gui `cursor=nextCursor`.
- Vai tro user: `admin | analyst`. Workspace: `owner | member`. Project: `owner | member | viewer`.
- Mot so endpoint admin: `GET /admin/issues*`, `PATCH /admin/issues/:id/status` yeu cau `role=admin` (403 neu khong du quyen).

## 3b. Dang nhap Google (OAuth 2.0) — frontend can lam dung

Backend da hoan thien. Co **2 che do**, chon theo kien truc frontend:

### Cach A — 1 tab (khuyen nghi cho SPA)

```js
// Nut "Dang nhap voi Google"
window.location.href = `${API}/auth/google?format=redirect`;
```

Chuoi bien xu ly sau khi Google quay ve `${APP_URL}`:

```js
const hash = new URLSearchParams(window.location.hash.slice(1));

if (hash.get('error')) {
  // Google tu choi / loi backend: VALIDATION_ERROR, CONFLICT, FORBIDDEN, ...
  showLoginError(hash.get('error'), hash.get('error_description'));
} else if (hash.get('access_token')) {
  localStorage.setItem('access_token', hash.get('access_token'));
  localStorage.setItem('refresh_token', hash.get('refresh_token'));
  // XOA NGAY fragment — token la bi mat, khong nen nam lai trong URL (history, screenshot, ...)
  window.history.replaceState(null, '', window.location.pathname);
  window.location.href = '/';
}
```

> Token nam trong **fragment (`#`)** chu khong phai query (`?`) → khong bi ghi vao access log
> cua proxy, khong nam trong `Referer`.

### Cach B — JSON (mac dinh)

```js
window.location.href = `${API}/auth/google`;   // mac dinh -> che do json
```

Callback tra JSON envelope — **shape giong het `POST /auth/login`**:

```json
{ "success": true, "data": { "access_token": "...", "refresh_token": "...", "expires_in": 900, "user": { "id": "...", "email": "...", "role": "analyst" } } }
```

Doc token o `body.data.access_token` (luu y envelope `data`, khong phai `data.data`).

> **KHONG** mo popup roi `fetch` lai `/auth/google/callback`: cookie `google_oauth_state`
> co `SameSite=Lax` → khong duoc gui kem `fetch` → callback tra 401.
> Voi SPA dung **Cach A**.

### Da kiem chung o backend

- `GET /auth/google` → **302** + `Set-Cookie: google_oauth_state=...; HttpOnly; SameSite=Lax; Path=/`
  (+ `google_oauth_format=redirect` neu co `?format=redirect`).
- `GET /auth/google/callback` → **200** `{ success: true, data: {...} }` (che do json)
  hoac **302** ve `${APP_URL}#access_token=...` (che do redirect).
- Loi → **401/409/403** voi `{ success: false, error: { code, message } }` (che do json)
  hoac **302** ve `${APP_URL}#error=CODE&error_description=...` (che do redirect).

### Can lam o Google Cloud Console

`Authorized redirect URIs` phai co **chinh xac** (khong them query, khong them `#`):

```
http://localhost:3000/api/v1/auth/google/callback
```

> Neu dung Cloudflare Tunnel (https), them them mot dong dang `https://<tunnel-host>/api/v1/auth/google/callback`
> va dat `GOOGLE_REDIRECT_URI` trong `.env` trung gia voi domain do.

## 4. So do tich hop man hinh

1. Auth -> `POST /auth/login` -> `GET /users/me`.
2. Sidebar workspaces -> `GET /workspaces` -> chon -> `GET /workspaces/:id` + `GET /workspaces/:workspaceId/projects`.
3. Vao project -> `GET /projects/:id` -> `GET /projects/:projectId/datasets` (chua co thi hien nut Upload).
4. Upload CSV -> `POST /projects/:projectId/datasets/upload` (`multipart/form-data`, 1 file CSV duy nhat, <= 50MB) -> `GET /datasets/:id/schema` de ve cot.
   > **Xoa dataset (2 buoc):** `GET /projects/:projectId/datasets` -> lay `dataset.id` -> `DELETE /datasets/:id`.
   > Khong co `DELETE /projects/:projectId/datasets`; va **khong co route sua dataset/cot**
   > (dataset bat bien — muon sua du lieu thi xoa roi nap lai).
5. Virtual Grid -> `GET /datasets/:datasetId/records?limit=50` lan dau, scroll thi dung `cursor`; filter/sort/search dung `POST /datasets/:datasetId/records/query`.
6. Chay phan tich -> `POST /projects/:projectId/analysis` (cau hinh phan tich nam trong body) -> poll `GET /analysis/jobs/:jobId` hoac nghe socket -> doc `GET /projects/:projectId/analysis/result`.
7. Tong ket -> `POST /projects/:projectId/summary` (lan dau) roi `GET /projects/:projectId/summary`.
8. Bao cao file -> `POST /projects/:projectId/report` -> nhan `reportId` + `pollUrl` -> `GET .../report/:reportId/file` (202 = chua xong, 200 + stream = xong).
9. Feedback AI -> cac endpoint `/analyses/:analysisId/.../feedback`.
10. Chuong thong bao -> `GET /notifications`, `GET /notifications/unread-count`, socket `notification.created`.
11. Bao loi he thong -> `POST /issues`, `GET /issues` (user) / `GET /admin/issues` (admin).
12. Realtime socket (xem `02-realtime-and-env.md`): connect `path=/api/v1/realtime?token=<access_token>`, join room project/analysis de nhan tien do.

Chi tiet tung endpoint: xem `01-api-contract.md`. Realtime + bien moi truong + xu ly tunnel/CORS: xem `02-realtime-and-env.md`.
