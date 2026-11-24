# API Contract (Base prefix `/api/v1`)

> Header mac dinh: `Authorization: Bearer <access_token>` (tru 3 endpoint Public ghi ro ben duoi).
> Body thanh cong nam trong `data` cua envelope `{ success: true, data }`.

## Auth — `@Controller('auth')`

### POST `/auth/register` (Public)
```json
{ "email": "user@mail.com", "password": "Matkhau@123", "first_name": "An", "last_name": "Nguyen", "role": "analyst" }
```
- `role`: `admin | analyst` (default `analyst`).

### POST `/auth/login` (Public)
```json
{ "email": "admin@school.local", "password": "Admin@123" }
```
Response `data`:
```json
{
  "access_token": "eyJ...",
  "refresh_token": "abc...",
  "expires_in": 900,
  "device_name": "Chrome on Windows",
  "user": { "id": "...", "email": "...", "role": "analyst" }
}
```

### POST `/auth/refresh` (Public)
```json
{ "refresh_token": "abc..." }
```
-> `{ "access_token": "eyJ...", "expires_in": 900 }`

### POST `/auth/logout`
Thu hoi session cua token hien tai. -> `{ "message": "Dang xuat thanh cong" }`

### GET `/auth/sessions`
Danh sach phien dang hoat dong (de hien "thiet bi dang nhap").

### GET `/auth/sessions/me`
Chi tiet phien dang nhap hien tai (cua chinh minh). -> `{ "id": "...", "device_name": "...", "ip_address": "...", "expires_at": "..." }`

### GET `/auth/google` (Public) — dang nhap Google (OAuth 2.0)
Mo trinh duyet tai `${API}/auth/google` (bat buoc mo bang trinh duyet, KHONG dung Postman/cURL —
can cookie `google_oauth_state` HttpOnly de doi chieu CSRF).
- Server dat cookie `google_oauth_state` roi **302** sang trang xac thuc Google.
- Query tuy chon `?format=redirect` → sau khi login xong, server **302** ve `${APP_URL}` voi
  fragment `#access_token=...&refresh_token=...&provider=google` (frontend doc bang
  `window.location.hash` va **phai xoa ngay** bang `history.replaceState`).
- Query tuy chon `?format=json` (mac dinh) → callback tra **JSON envelope** giong het
  `POST /auth/login`: `{ "success": true, "data": { "access_token": "...", ... } }`.
- Che do `json` (mac dinh): callback tra JSON envelope — dung khi frontend **tu goi** callback
  (vi du server-side render, dong bo token qua backend khac).
  **LUU Y:** frontend khong nen mo popup roi `fetch` lai callback — cookie `google_oauth_state`
  co `SameSite=Lax` nen **khong** duoc gui kem request `fetch` (chi gui o top-level navigation)
  => callback se tra 401 "Phien dang nhap Google khong hop le".
  => Voi SPA tren trinh duyet, dung **`?format=redirect`** (1 tab, khong can popup).

### GET `/auth/google/callback` (Public)
Google goi ve. Query: `code`, `state`, `error`, `format`.
- Thanh cong (che do `json`): **200** `{ "success": true, "data": { "access_token": "...", "refresh_token": "...", "expires_in": 900, "user": { ... } } }`
  — **shape giong het `POST /auth/login`**, doc token o `body.data.access_token`.
- Thanh cong (che do `redirect`): **302** ve `${APP_URL}` voi fragment
  `#access_token=...&refresh_token=...&provider=google` (hoac `#error=CODE&error_description=...` neu loi).
- Loi (che do `json`): **401** `VALIDATION_ERROR` · **409** `CONFLICT` (email da co tai khoan local,
  hay dung mat khau de lien ket) · **403** `FORBIDDEN` (tai khoan bi khoa).

> **Luu y:** `redirect_uri` trong Google Cloud Console phai khop **tuyet doi** voi
> `${API}/auth/google/callback` (khong them query). Che do trang ket qua duoc truyen qua
> cookie `google_oauth_format` (HttpOnly) nen frontend khong can sua `redirect_uri`.

### DELETE `/auth/sessions/:id`
Thu hoi 1 phien tu xa.

## Users — `@Controller('users')`

- `GET /users/me` -> ho so hien tai.
- `PATCH /users/me`:
  ```json
  { "first_name": "An", "last_name": "Nguyen", "avatar_url": "https://..." }
  ```
  Tat ca optional, `avatar_url` phai la URL.
- `DELETE /users/me` -> xoa mem tai khoan.

## Workspaces — `@Controller('workspaces')`

- `POST /workspaces`:
  ```json
  { "name": "Nhom DA1", "description": "..." }
  ```
  `name` 1-100 ky tu, `description` <= 500.
- `GET /workspaces?search=&role=owner|member&sort=last_accessed|updated|name_asc|name_desc|joined&page=1&limit=15`
- `GET /workspaces/:id` -> `{ workspace }`
- `PATCH /workspaces/:id` -> `{ name?, description? }`
- `DELETE /workspaces/:id` -> xoa mem.
- `GET /workspaces/:id/members` -> `{ members, total }`
- `POST /workspaces/:id/members`:
  ```json
  { "email": "a@mail.com", "role": "member" }
  ```
  `role`: `owner | member` (default `member`).
- `DELETE /workspaces/:id/members/:userId`
- `POST /workspaces/:id/transfer-owner`:
  ```json
  { "email": "owner-moi@mail.com" }
  ```
- `POST /workspaces/:id/leave` -> roi workspace.

## Projects — `@Controller()` (path day du)

- `POST /workspaces/:workspaceId/projects`:
  ```json
  { "name": "DQ Sprint 1", "description": "..." }
  ```
- `GET /workspaces/:workspaceId/projects?search=&status=not_started|in_progress|completed&sort=&page=&limit=`
- `GET /projects` — **PROJ-02b (moi 2026-11-19)**: danh sach project **toan he thong**
  (khong gan voi workspace cu the) — tra ve moi project nguoi dung co quyen doc, gom tu
  moi workspace. Dung cho man hinh "Danh sach du an" khi nguoi dung khong biet project
  nam o workspace nao. Phan trang keyset giong PROJ-02:
  `{ items, meta: { nextCursor, hasMore, limit } }`.
  Query: `search`, `status`, `sort`, `cursor`, `limit`.
- `GET /projects/:id` -> `{ project }`
- `PATCH /projects/:id` -> `{ name?, description? }`
- `DELETE /projects/:id` -> xoa mem.
- `GET /projects/:id/members` -> `{ members, total }`
- `POST /projects/:id/members`:
  ```json
  { "email": "a@mail.com", "role": "viewer" }
  ```
  `role`: `member | viewer` (default `viewer`).
- `PATCH /projects/:id/members/:userId`:
  ```json
  { "role": "member" }
  ```
- `DELETE /projects/:id/members/:userId`
- `POST /projects/:id/transfer-owner`:
  ```json
  { "email": "owner-moi@mail.com" }
  ```

## Datasets — `@Controller()` (upload streaming)

### POST `/projects/:projectId/datasets/upload`
- `multipart/form-data`, **1 file CSV duy nhat** (busboy doc file dau tien), field name bat ky, `fileSize <= 50MB`.
- Strict mode: sai dinh dang CSV -> `400`. 1 project = 1 bang.
- Response `data`: `{ message, dataset }` voi `dataset: { id, rowCount, columnCount, originalName, dataType, ... }`.

### Cac endpoint con lai
- `GET /projects/:projectId/datasets` -> `{ dataset }` (dataset duy nhat cua project).
- `GET /datasets/:id` -> `{ dataset }` (khong lo `storage_key`).
- `GET /datasets/:id/schema` -> `{ columns: [{ key: "c0", name, originalName, dataType, ... }] }`.

> **⚠️ Dataset la BAT BIEN (OPEN-03, 2026-11-19) — khong co route cap nhat.**
> Cac endpoint sau **da bi go** va **khong con ton tai**:
>
> | Endpoint da go | Ly do |
> |---|---|
> | `PATCH /datasets/:id` | dataset la snapshot bat bien sau khi nap |
> | `PATCH /datasets/:id/columns` | khong doi ten hien thi cot duoc nua |
> | `POST /datasets/:id/columns/reset` | khong khoi phuc ten cot duoc nua |
> | `PATCH /datasets/:id/columns/pii` | co PII **tu suy** tu ten cot boi `pii-heuristic.util.ts`, khong bat/tat tay |
>
> **Muon sua du lieu → xoa dataset roi nap lai.** He thong chi *phat hien* van de
> (ten cot rong/trung, o ngoai ngay/so…) va tra ve trong `findings`.

### Xoa dataset — route duy nhat: `DELETE /datasets/:id`
- `DELETE /datasets/:id` -> xoa mem dataset + giai phong dung luong workspace + go co
  `hasDataset` cua project (ca 3 trong cung mot transaction — OPEN-09).
- **Khong ton tai** `DELETE /projects/:projectId/datasets`. Ly do: xoa dataset tac dong
  toi resource cua module khac (project, workspace) nen route dat o root hop hon.
- **Luong goi 2 buoc:**
  1. `GET /projects/:projectId/datasets` -> lay `dataset.id`
  2. `DELETE /datasets/:id` -> xoa

## Data View (Virtual Grid) — `@Controller('datasets/:datasetId')`

### GET `/datasets/:datasetId/records?cursor=&limit=50&sort_field=&sort_order=asc|desc`
- `limit` 1-500 (default 50) — *cap nhat 2026-11-25, truoc la 1-200*. Response `data`: `{ items: [{ rowIndex, props: { c0, c1... } }], meta: { nextCursor, hasMore } }`.
- **Cursor (cap nhat 2026-11-25):**
  - Gui lai **nguyen van** `meta.nextCursor` vao `cursor`; khong tu tao hay sua cursor.
  - Khi co sort, cursor nho ca gia tri dang sort cua dong cuoi trang (truoc day chi nho `rowIndex` nen trang sau bi sot dong).
  - Cursor hong, hoac sinh tu mot kieu sort khac (doi `sort_field` / `sort_order` ma van gui cursor cu) -> `400 VALIDATION_ERROR`. Frontend: khi doi sort thi **bo cursor, tai lai tu trang dau**.
  - **Cursor gan voi bo loc + het han 24 gio (cap nhat 2026-11-25, Phan 7 v16 muc 3.26):** cursor chi dung duoc voi dung truy van da sinh ra no. Gui cursor voi `filters` / `search` khac -> `400`, `error.details.reason = "cursor_query_mismatch"`. Cursor qua 24 gio (hoac cursor cap truoc ban nay) -> `400`, `error.details.reason = "cursor_expired"`. Frontend: gap 2 `reason` nay thi **bo cursor, tai lai trang dau** (co the lam tu dong, khong can bao loi cho nguoi dung). Doi `limit` giua hai trang van hop le.
- O trong (null, thieu, hoac khong doc duoc thanh so/ngay) luon xep **cuoi**, ca `asc` lan `desc`, voi moi kieu cot.

### POST `/datasets/:datasetId/records/query`
```json
{
  "filters": [{ "column": "c0", "operator": "contains", "value": "abc" }],
  "sort": [{ "column": "c0", "order": "asc" }],
  "search": { "columns": ["c0", "c1"], "value": "kw" },
  "cursor": "opaque",
  "limit": 50
}
```
- `operator`: `equals | notEquals | contains | notContains | startsWith | endsWith | greaterThan | greaterThanOrEqual | lessThan | lessThanOrEqual | between | in | isEmpty | isNotEmpty`.
- `between` can `value: [min, max]`; `in` can mang khac rong; `isEmpty/isNotEmpty` khong can `value`.
- Toi da 30 filters, 5 sort, search toi da 20 cot. `limit` 1-500 (default 50).
- **`value` (cap nhat 2026-11-25):** chi nhan chuoi (<= 500 ky tu), so, boolean, hoac **mang** cac gia tri do (<= 1000 phan tu, dung cho `in` / `between`). Gui object (vd `{ "$ne": null }`, `{ "$regex": "..." }`) -> `400 VALIDATION_ERROR` (chan NoSQL injection).
- **So sanh thu tu** (`greaterThan`, `greaterThanOrEqual`, `lessThan`, `lessThanOrEqual`, `between`) tren cot so / cot ngay voi gia tri khong phai so / ngay hop le -> `400` kem `message` ro rang (truoc day bo loc bi bo qua im lang). Nen hien `error.message` cho nguoi dung. `equals` / `in` van nhan gia tri tho de tim o nhap sai kieu.
- Nhieu dieu kien tren **cung mot cot** (gui bang `c{i}` hay ten hien thi deu duoc) ket hop **OR**; cac cot khac nhau ket hop **AND**.
- `isEmpty` / `isNotEmpty`: chuoi chi co khoang trang cung tinh la o trong. `contains` / `startsWith` / `endsWith` / `search` dung duoc tren cot so va boolean (so khop theo dang chu, vd `"19"` khop `1990`).
- `cursor`: quy tac nhu `GET records`. *(cap nhat 2026-11-25)* Cursor **da gan voi bo loc va tim kiem**: doi `filters` / `search` / `sort` ma van gui cursor cu -> `400` (xem `details.reason` o tren). Frontend van bo cursor va tai lai tu trang dau khi doi bat ky dieu kien nao.
- **Cot ngay (cap nhat 2026-11-25):** du lieu ngay cu luu dang chuoi (vd `"2024-01-01"`) nay duoc loc / sap xep theo gio Viet Nam, khop voi du lieu ngay nap moi (truoc lech 7 gio). `lessThan` / `lessThanOrEqual` tren cot so / ngay khong con tra o trong.

### GET `/datasets/:datasetId/columns/:columnKey/stats`
- `:columnKey` chap nhan ca key `c{i}` lan ten hien thi. -> `{ stats }`.
- `stats`: `column_key`, `column_name`, `total_records`, `null_count`, `missing_ratio`, `min`, `max`, `average`, `histogram: [{ bucket_start, bucket_end, count }]`.
  - Cot khong phai so: khong co `min` / `max` / `average`, `histogram: []`.
  - Cot co moi gia tri giong nhau: `histogram` chi 1 khoang. *(cap nhat 2026-11-25: truoc day loi 500 voi cot so ~120k dong tro len — da sua.)*

### GET `/datasets/:datasetId/charts` — **GĐ6 (moi 2026-11-19)**
So lieu bieu do cho cac cot cua dataset (dung ve nhanh de render chart, khong can
tinh lai o frontend).
- Query: `columns` (CSV, **tuy chon** — mac dinh tat ca cot), `top_n` (1-20,
  default 5), `max_rows` (1-50000, default 50000).
- Tra `data`: `{ charts: [...] }` — **mot phan tu cho moi cot**, khong phai 3 mang
  tach biet. Moi phan tu co cac truong chung:
  `column_key`, `column_name`, `data_type`, `total_records`, `sampled_records`,
  `truncated`, `missing_count`, `missing_ratio`.
  - Cot **so** → them `histogram: { method, bins: [{ from, to, count }] }` va
    `box_plot: { q1, median, q3, whisker_low, whisker_high, outside_count, n }`.
  - Cot **chuoi / boolean** → them `category: { top_n, items: [{ value, count, rate }], other: { count, rate } | null, distinct_count }`.
  - Cot **date** → chi co truong chung (ty le thieu); bieu do thoi gian can cot thoi
    gian duoc chon trong cau hinh phan tich, chua thuoc endpoint nay.
- Cot khong phu hop voi loai bieu do se khong co truong tuong ung (khong phai loi).
- `truncated: true` → dataset lon hon `max_rows`, so lieu duoc tinh tren mau.
- Toi da 50 cot moi trong mot lan goi; `columns` chap nhan ca key `c{i}` lan ten hien thi.

## Analysis — `@Controller()`

### POST `/projects/:projectId/analysis`
```json
{ "correlation_method": "pearson", "outlier_method": "iqr", "top_n": 10, "chart_top_n": 5 }
```
Chay dong bo phan thong ke + tao AI job `corr-v1` bat dong bo. Body co the `{}` (OPEN-06: cot tu suy luan, chi tham so phuong phap; `chart_top_n` 1-20, default 5). Frontend: goi xong thi poll job ben duoi hoac nghe socket.

> **GĐ12 — rate limit phan tich dong bo (2026-11-19).** Server chi cho phep **1 lan phan tich dong bo** chay cung luc tren moi instance (`ANALYSIS_MAX_CONCURRENCY`, mac dinh 1). Neu dang co mot lan chay, request nay tra:
>
> ```http
> HTTP/1.1 429 Too Many Requests
> Retry-After: 5
> ```
> ```json
> { "success": false, "error": { "code": "LIMIT_EXCEEDED", "message": "...", "details": { "maxConcurrency": 1, "activeCount": 1, "retryAfterSeconds": 5 } } }
> ```
> **Frontend phai doc `Retry-After` va backoff** — khong retry ngay lap tuc. Ly do: phan tich dataset 100.000 dong mat ~6,4 s va chay inline trong request (Node don luong) → xep hang se lam cham **tat ca** endpoint khac cua cung instance.

### GET `/projects/:projectId/analysis/result`
Ket qua DQ + ma tran tuong quan + VIF + nhan xet AI (neu AI job da xong).

> **GĐ7 — 4 truong giai thich moi trong `dqSummary.columns`** (them field, khong pha vo hop dong):
>
> | Truong | Kieu | Y nghia |
> |---|---|---|
> | `symbolMissingCount` | `number` | So o chua **ky hieu tru** (vd `"N/A"`, `"-"`, `"?"`) bi loai khoi DQ-01. O nay KHONG phai thieu theo DQ-01 (chuoi khac rong) nhung cung khong phai gia tri hop le → khong duoc tinh vao mau so. |
> | `skewness` | `number \| null` | Do lech mau cua cot `measure` (null neu `< 4` gia tri hoac do lech chuan = 0). Giup phan biet "ngoai le do loi nhap" voi "ngoai le do phan bo lech". |
> | `outlierBreakdown` | `{ iqr, iqrExtreme, zscore, both } \| null` | Phan ra ngoai le theo phuong phap: `iqr` (nguong 1.5×IQR), `iqrExtreme` (nguong 3×IQR — ngoai le cuc dan), `zscore` (Modified-Z 3.5), `both` (giao IQR∩Z). `null` = cot khong co ngoai le nao. |
> | `outlierSkippedReason` | `string \| null` | Vi sao cot so khong co ngoai le. Hien chi co `not_measure_column` — cot so nhung vai tro khong phai `measure` (VD ma dinh danh toan so) → co y bo qua DQ-04. `null` = cot da duoc phan tich binh thuong. |
>
> Vi du:
> ```json
> {
>   "column": "doanh_thu",
>   "invalidCount": 12,
>   "invalidRate": 0.00012,
>   "symbolMissingCount": 34,
>   "skewness": 2.8471,
>   "outlierCount": 87,
>   "outlierRate": 0.00087,
>   "outlierBreakdown": { "iqr": 87, "iqrExtreme": 4, "zscore": 63, "both": 51 },
>   "outlierSkippedReason": null
> }
> ```

### GET `/analysis/jobs/:jobId`
Trang thai AI job.

### POST `/analysis/jobs/:jobId/retry`
Thu lai AI job (toi da 2 lan). Tra `202`.

### POST `/analysis/jobs/:jobId/result` (noi bo)
```json
{ "result": {}, "modelId": "corr-v1" }
```
- **Frontend KHONG goi route nay** (xem `API_ANSWER_24-11.md` muc 4.4) — worker AI goi thang handler, khong qua HTTP.
- *Cap nhat 2026-11-25:* chi **SYS-ADMIN** duoc goi (nguoi khac -> `403`); server chay `NODE_ENV=production` -> `404` voi moi nguoi. Truoc day moi thanh vien project goi duoc va co the ghi de nhan xet AI.

## Summary — `@Controller()`

- `POST /projects/:projectId/summary` -> `201`, tao Tong ket tu ket qua phan tich moi nhat.
- `GET /projects/:projectId/summary` -> xem Tong ket moi nhat (phai tao summary truoc khi sinh PDF bao cao).

## Report — `@Controller()`

- `POST /projects/:projectId/report` -> `202 Accepted`, response `data`: `{ reportId, status: "pending", pollUrl: "/api/v1/projects/:projectId/report/:reportId/file" }`.
- `GET /projects/:projectId/report/:reportId/file`:
  - Chua xong -> `202` + JSON meta `{ reportId, status, error }`.
  - Da xong -> stream `text/plain; charset=utf-8`, header `Content-Disposition: attachment; filename*=UTF-8''report-<id>.txt` (+ `Content-Length` neu co). Frontend tai blob: `responseType: 'blob'`.

## Feedback (danh gia AI) — `@Controller()`

`label`: `correct | partially_correct | false_positive | missed_issue | other`.
`suggestedSeverity`: `low | medium | high | critical`.
Bat buoc `reason` khi `label` la `false_positive | missed_issue | other` (ca khi tao lan khi `PATCH` doi sang cac nhan nay; thieu -> `400`).

**Quy tac (cap nhat 2026-11-25):**
- Nhan xet **mot phat hien**: lan phan tich phai o trang thai `succeeded`. Nhan xet **ca lan chay**: `succeeded` hoac `failed`. Trang thai khac (`pending`, `running`) -> `409 CONFLICT`. Frontend: an / khoa nut nhan xet khi lan phan tich chua xong.
- SYS-ADMIN (`role=admin`) bi chan `403` o moi route feedback, tru `DELETE` (xoa kiem duyet).
- `:id`, `:analysisId` sai dinh dang -> `400`; `findingId` rong hoac dai hon 200 ky tu -> `400`.

- `POST /analyses/:analysisId/findings/:findingId/feedback`:
  ```json
  { "label": "false_positive", "reason": "Gia tri nay dung vi...", "suggestedSeverity": "low" }
  ```
- `POST /analyses/:analysisId/feedback` (nhan xet ca lan chay, body giong tren).
- `GET /analyses/:analysisId/findings/:findingId/feedback?limit=20&cursor=&label=&sortOrder=desc`
- `GET /analyses/:analysisId/feedback?...` (tuong tu).
  - Response `data`: `{ items, meta: { nextCursor, hasMore, limit }, summary }` — `meta.limit` *moi 2026-11-25*.
  - `summary` (so nhan xet theo tung nhan) dem tren **toan bo** nhan xet cua phat hien / lan chay, **khong** bi loc boi `?label=` *(cap nhat 2026-11-25)*. Muon biet so dong sau khi loc thi dem `items`.
- `PATCH /feedback/:id`:
  ```json
  { "label": "correct", "reason": "...", "suggestedSeverity": null }
  ```
  It nhat 1 truong. Chi nguoi viet nhan xet duoc sua.
- `DELETE /feedback/:id` — nguoi viet, hoac Project/Workspace Owner va SYS-ADMIN (xoa kiem duyet).
- Loi khi sua / xoa *(cap nhat 2026-11-25)*:
  - nguoi viet **khong con quyen xem project** (khong con la thanh vien project **va** khong con la thanh vien workspace) -> `403`. Thanh vien workspace bi go khoi project van co quyen xem nen van sua / xoa duoc nhan xet cua minh;
  - project da bi xoa -> `404`.
- `GET /projects/:projectId/ai-quality-metrics` -> thong ke chat luong AI theo project.

## Notifications — `@Controller()`

- `GET /notifications?cursor=&limit=10&sortBy=createdAt&sortOrder=desc&read=all|true|false`
  `limit` 1-100 (default 10).
- `GET /notifications/unread-count` -> `{ unreadCount }` (boc trong `data`).
- `GET /notifications/:id` -> chi tiet + tu danh dau da doc.
- `PATCH /notifications/:id/read` -> danh dau da doc.
- `PATCH /users/me/notification-preferences`:
  ```json
  { "notificationsEnabled": true }
  ```
- **Thong bao phan tich (cap nhat 2026-11-25, Phan 7 v16 muc 3.26 NT-*):** nguoi chay phan tich nay nhan 3 loai thong bao trong `GET /notifications` (va realtime `notification.created` o phong `user:{userId}`):
  - `analysis_completed` — lan phan tich xong; `analysis_failed` — lan phan tich loi (summary chi neu ma loi);
  - `ai_analysis_ready` — phan nhan xet AI ket thuc: tieu de "Nhan xet AI da san sang" khi thanh cong, "Phan nhan xet AI that bai" khi loi (summary co ma loi `AI_GROUNDING_FAILED` / `AI_FAILED`).
  - `payload`: `{ targetType: "analysis_run", targetId: <analysisRunId>, actionUrl: null }` — frontend tu dung duong dan toi man ket qua phan tich cua project.
  - Ca 3 loai deu **khong bat buoc**: nguoi dung tat thong bao (`notificationsEnabled: false`) thi khong nhan. Chua gui email cho 3 loai nay.

## Issues (bao su co) — `@Controller()`

- `POST /issues`:
  ```json
  {
    "issueType": "data_error",
    "title": "Grid khong tai trang 2",
    "description": "Cac buoc tai hien...",
    "workspaceId": "...",
    "apiPath": "/api/v1/datasets/xxx/records",
    "errorMessage": "Failed to fetch",
    "occurredAt": "2026-11-10T09:00:00+07:00"
  }
  ```
  `issueType`: `function_error | display_error | data_error | feature_feedback | other`.
- `GET /issues?cursor=&limit=10&sortBy=createdAt|updatedAt|status&sortOrder=desc&status=new|in_progress|resolved|closed`
- `GET /issues/:id`
- `GET /admin/issues?...` (can `role=admin`, `sortBy` them `severity`).
- `GET /admin/issues/:id` (can `admin`).
- `PATCH /admin/issues/:id/status` (can `admin`):
  ```json
  { "status": "in_progress", "expectedVersion": 3 }
  ```
  `expectedVersion` lay tu detail hien tai; sai version -> loi, phai load lai.
