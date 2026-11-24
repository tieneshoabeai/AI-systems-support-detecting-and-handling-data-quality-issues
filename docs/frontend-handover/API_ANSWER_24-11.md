# Tra loi chinh thuc cho bao ca QA API — 24/11/2026

> **Tu:** Backend team · **Den:** Frontend team
> **Tai lieu:** `docs/API_INTEGRATION_STATUS.md` (bao ca QA ngay 24/11/2026)
> **Ngay:** 24/11/2026

## 1. Tong hop

Tra loi chinh thuc cho bao ca QA cua team Frontend (`docs/API_INTEGRATION_STATUS.md`, ngay 24/11/2026).

**Ket luan chinh:** 3 route bi bao "thieu" (BE-01, BE-02) **khong phai loi backend** — chung da bi **co chu dich rut bo** khoi hop dong truoc do. Backend **khong se trien khai lai** 3 route do. Thay vao do, **7 muc sua cua Frontend** duoc liet ke o §5.

| Bao ca | Trang thai | Xu ly |
|---|---|---|
| BE-01 — `GET`/`POST /projects/{projectId}/analysis/config` | **Da rut bo co chu dich** (OPEN-06) | Frontend bo 2 route nay, gop tham so vao body `POST /analysis` |
| BE-02 — `PATCH /datasets/{id}/columns/pii` | **Da rut bo co chu dich** (OPEN-03 + mau thuan #2) | Frontend bo route, bo nut danh dau PII |
| BE-03 — `redirect_uri` Google tro ve `localhost` | **Loi cau hinh QA** | Vận hành sửa env + Google Cloud Console |
| BE-04 — PDF `202` khong phan biet trang thai | **Hop dong da chot** (§4.3) | Frontend xu ly theo `meta.status` |
| BE-05 — AI job sau retry | **Can xac nhan** (§4.4) | Frontend theo doi bang `GET /analysis/jobs/{jobId}` |
| BE-06 — Hop thu OTP | **Can ha tang email** (§4.5) | Backend + vat hanh xu ly |
| BE-07 — Swagger cho bieu do | **Da sua xong** (§4.6) | Frontend sinh lai type tu OpenAPI |

### Nguyen doan goc — lech phien ban

Ba route bi bao "thieu" **co trong checkout cua Frontend** (commit `ea2f1b7`, 18/11) va **khong co trong ban deploy** (commit `cc3090a`, 24/11). Ly do la **Frontend dang doc source tai commit cu hon backend 6 ngay**, trong khi bai QA chay ban deploy moi.

| | Commit | Ngay | Trang thai |
|---|---|---|---|
| Checkout Frontend doc | `ea2f1b7` | 18/11/2026 | **Co** 3 route (chua rut) |
| Backend rut route | `05ba93a` (analysis-config) | 23/11/2026 | Rut `GET`/`POST .../analysis/config` |
| Backend rut route | `5bcb224` (dataset bat bien) | 23/11/2026 | Rut `PATCH .../columns/pii` |
| Ban deploy QA | `cc3090a` | 24/11/2026 | **Khong** co 3 route — dung nhu Swagger QA |

> **Dau hieu dang chung:** trong bao ca QA, ba doi tuong **co duong dan file + so dong** trong source cua Frontend — `AnalysisController#L50`, `DatasetsController#L161`, `ReportController#L74` — va **khop chinh xac** voi commit `ea2f1b7`. Neu cac so dong do lay tu ban deploy moi thi chung da dung con tro nen doi luong co the verify. Frontend da doc **source checkout cua chinh minh**, khong phai source dang chay tren QA.

**Hang dong duoc kiem chung:**
- `pnpm arch:api-coverage` → hop dong §3.13 co **84** route, ma nguon co **84** route → **0 thieu, 0 thua**.
- Swagger tai QA (`/api/v1/docs-json`) tra HTTP `200`, co **84** route duy nhat → **khop 1-1** voi hop dong.

## 2. BE-01 — `analysis/config` (2 route): DA RUT BO CO CHU DICH

### 2.1. Quyet dinh

`docs/restructures/24_open_decisions_resolved.md` §2 **OPEN-06 — "Khong co khai niem chon cot"**:

> 1. **Bo khai niem chon cot.** He thong **luon phan tich toan bo cot** cua dataset. Khong co tham so chon cot o bat ky dau.
> 2. `label_column` / `time_column` / `value_column` → **he thong tu suy**.
> 3. **Khong co cau hinh thu cong nao.** `correlation_method`, `outlier_method`, `top_n` cung do he thong tu quyet.

Va §5.1 — bang endpoint bi xoa khoi hop dong:

| Endpoint | Ly do | Quyet dinh |
|---|---|---|
| `POST /projects/{projectId}/analysis/config` | Khong con cau hinh phan tich | OPEN-06 |
| `GET /projects/{projectId}/analysis/config` | Khong con cau hinh phan tich | OPEN-06 |

### 2.2. Ly do nen rut

1. **Vong lap phu thuoc.** Cau hinh cot → fingerprint ket qua → ket qua cu stale → phai rerun. Tu phan tich "nhat quyet dinh" (`24_open_decisions_resolved.md` §2 OPEN-03) da tach nhieu chung kieu: *"Cho phep sua ten cot sinh ra mot vong lap phu thuoc lan nhau: ten cot anh huong fingerprint → ket qua cu stale → phai rerun"*. Cau hinh cot bi gop cung loai.
2. **Hien thuc hoa duoc.** Vai tro cot (do/phan loai/thoi gian/nhan) **da co san** trong `run-analysis.handler.ts` (cot ngay duy nhat → time; cot phan loai → label; cot so → value). Khong can nguoi dung chi ra.
3. **He thong "chi nhan dataset va phan tich".** Nguyen tac tong cua du an: nguoi dung **chi doc ket qua va cac phat hien**, khong can thiep vao du lieu hay cau hinh.

### 2.3. Hop dong thay the — truyen tham so qua body `POST /analysis`

`src/backend/src/modules/analysis/presentation/dtos/run-analysis.dto.ts`:

```ts
export const RunAnalysisSchema = z.object({
  correlation_method: z.enum(['pearson', 'spearman']).default('pearson'),
  outlier_method: z.enum(['iqr', 'modified_zscore', 'both']).default('iqr'),
  top_n: z.coerce.number().int().min(1).max(100).default(10),
  chart_top_n: z.coerce.number().int().min(1).max(20).default(5),
});
```

**Body co the rong (`{}`)** — moi truong duoc gan san gia tri mac dinh. Body **khong con** `selected_columns`, `label_column`, `time_column`, `value_column`, `column_roles` (GĐ7.1 da bi thu hoi theo mau thuan #1).

> **Luu y:** bang o tren la **phan tham so phuong phap**, khong phai cau hinh cot. `correlation_method` / `outlier_method` / `top_n` van **cho chinh** — nen UI van co the cho nguoi dung chon cac muc do nay. Khac biet: **chon tham so phuong phap** (an toan, khong thuoc du lieu) **≠ luu cau hinh cot**.

### 2.4. Cac buoc Frontend can sua

1. **Go** 2 route `GET`/`POST /projects/{projectId}/analysis/config` khoi `analysis.service.ts`.
2. **Bo nut "Luu cau hinh"** va **nut "Tai cau hinh"** tren man hinh Data Analysis (UI dang khoa nut Luu cau hinh nen chi can goi duong dan).
3. **Gui tham so truc tiep** vao body cua `POST /projects/{projectId}/analysis`:
   ```json
   { "correlation_method": "pearson", "outlier_method": "iqr", "top_n": 10, "chart_top_n": 5 }
   ```
4. **Doc response cua `POST /analysis`** de hien thi cac tham so da ap dung (backend luu snapshot config vao `analysis_run.config`).
5. **Cap nhat OpenAPI snapshot** cua Frontend: xoa 2 route, them `requestBody` cho `POST /analysis`.

> **Khong dung bo "Luu cau hinh"** theo nghia "khong luu duoc gi". Thay bang: **cho nguoi dung chon tham so phuong phap ngay tren man hinh chay phan tich**, roi gui kem trong body. Ket qua phan tich luu lai snapshot nen viec xem lai ket qua cu khong bi thay doi.

## 3. BE-02 — `PATCH /datasets/{id}/columns/pii`: DA RUT BO CO CHU DICH

### 3.1. Quyet dinh

`24_open_decisions_resolved.md` §4 — **mau thuan #2**:

> **OPEN-03 vs GĐ4 (`PATCH /datasets/:id/columns/pii`)** — **BO.** Tuan thu triet de "chi nhan dataset va phan tich". → GĐ4 bi thu hoi. **He qua**: co PII phai duoc suy ra **tu dong** (tu ten cot / heuristic), khong cho nguoi dung danh dau thu cong.

Va §5.1:

| Endpoint | Ly do | Quyet dinh |
|---|---|---|
| `PATCH /datasets/{datasetId}/columns/pii` | Bat/tat co PII | Mau thuan #2 |

### 3.2. Ly do nen rut

1. **Dataset la bat bien (insert-only)** sau khi nap. Khong co `PATCH /datasets/:id`, `PATCH /datasets/:id/columns`, `POST /datasets/:id/columns/reset` — chi con `DELETE /datasets/:id`. Neu `columns/pii` con la, thi co **mot route ghi duy nhat** tren dataset va **tinh bat bien bi lo**.
2. **PII duoc suy ra tu du lieu.** `src/backend/src/modules/datasets/domain/services/pii-heuristic.util.ts` (205 dong) suy co PII tu **ten cot + mau gia tri**. He thong co du kien suy ra chinh xac hon viec nguoi dung danh dau tay (nguoi dung thuong khong biet cot nao la PII).
3. **Khong sua duoc gia tri ban ghi.** Co PII chi la **metadata phan loai** — khong bao gio thay doi gia tri o ban ghi goc. Cai nay giu nguyen tinh tai lap duoc cua ket qua phan tich.

### 3.3. Hop dong thay the

**Khong co route thay the.** Co PII duoc backend **tu suy** va **doc duoc** qua:

- `GET /datasets/{id}/schema` → moi cot co `isPii: boolean`.
- `GET /datasets/{id}/charts` → cot PII co `category.masked: true`, `items: []`, chi con `distinct_count` + thong ke thieu (xem §4.6).

> **He qua bao mat (quan trong):** cot bi danh dau PII **khong bao gio** lo ra gia tri tho qua API charts — kiem chung bang test `test/unit/datasets/dataset-column-pii.spec.ts` va `data-view.spec.ts`. Neu Frontend can hien thi cot PII, hien thi **chi so** (distinct count, ty le thieu), khong hien thi gia tri.

### 3.4. Cac buoc Frontend can sua

1. **Go** `PATCH /datasets/{id}/columns/pii` khoi `dataset.service.ts`.
2. **Bo nut "Danh dau la PII"** (va nut tat) tren man hinh Data View.
3. **Doc `isPii` tu schema** de hien thi nhan canh bao (read-only) thay vi cho sua.
4. **Cap nhat OpenAPI snapshot**: xoa route `columns/pii`.

> **Neu nguoi dung that su can sua du lieu** (VD ten cot sai, can danh dau PII mot cot heuristic khong nhan ra): **xoa dataset roi nap lai file da chinh sua**. Day la duong duy nhat theo OPEN-03. He thong **phat hien** loi (ten cot rong/trung) va tra ve trong `findings` — nguoi dung biet can sua gi.

## 4. Cac muc con lai

### 4.1. Danh sach route bi rut (tong hop)

| Route | Da rut o commit | Ngay | Quyet dinh |
|---|---|---|---|
| `GET /projects/{projectId}/analysis/config` | `05ba93a` | 23/11/2026 | OPEN-06 |
| `POST /projects/{projectId}/analysis/config` | `05ba93a` | 23/11/2026 | OPEN-06 |
| `PATCH /datasets/{datasetId}/columns/pii` | `5bcb224` | 23/11/2026 | OPEN-03 + mau thuan #2 |

Ba route khac cung bi rut cung dot (khong bao loi) va **khong con trong hop dong**:
`PATCH /datasets/{datasetId}` (doi ten dataset), `PATCH /datasets/{datasetId}/columns` (doi ten cot), `POST /datasets/{datasetId}/columns/reset` (reset ten cot).

> **Hop dong van la `/api/v1`.** Theo `7_api_contracts_v8.md` §3.15 quy tac 4: *"Dự án mới, chưa có frontend chạy → không cần phiên bản song song"*. Vay khong co `/api/v2` va **khong** co route `/api/legacy` de chuyen tiep.

### 4.2. BE-03 — Google OAuth: LOI CAU HINH QA (khong phai code)

Backend **khong can sua code**. Adapter doc env `GOOGLE_REDIRECT_URI`:
`src/backend/src/modules/auth/infrastructure/security/google-oauth.adapter.ts:52`.

**Nguyen doan:** env QA dang tro `http://localhost:3000/api/v1/auth/google/callback` ⇒ Google redirect ve may chu local, khong ve may chu QA. Do do callback tra `401` — chi xac nhan nhanh tu choi, **khong** phai nhanh that bai.

**Vai tro trach nhiem:**
- **Backend / vat hanh:** dat `GOOGLE_REDIRECT_URI` tren QA bang URL **HTTPS cong khai** cua backend QA, ví du `https://<backend-qa-domain>/api/v1/auth/google/callback`.
- **Google Cloud Console:** them dung URL do vao **Authorized redirect URIs** — phai **khop tuyet doi**, khong them query.
- **Frontend:** dung `?format=redirect` (xem `docs/frontend-handover/01-api-contract.md`, muc `GET /auth/google`). SPA nen dung **1 tab top-level navigation**, **khong** dung popup + `fetch` lai callback (cookie `google_oauth_state` co `SameSite=Lax` ⇒ `fetch` khong kem cookie ⇒ callback tra `401`).

**Tieu chi nghiem thu:** bam nut Google tu DataVerse → callback toi dung backend QA → tra nguoi dung ve DataVerse voi phien hop le va dung role. Khong con redirect ve `localhost` o buoc callback.

### 4.3. BE-04 — Phan biet trang thai PDF: HOP DONG DA CHOT

**Hop dong chinh thuc** (khong doi, khong can sua backend):

| HTTP | Dieu kien | Body | Cach xu ly cua Frontend |
|---|---|---|---|
| `200` | Report **da sinh xong** | Stream `application/pdf` | Tai file (blob) |
| `202` | Report **chua xong** | `{ reportId, status, error }` | Tiep tuc poll theo `status` |
| `202` | Report **that bai** | `{ reportId, status: "failed", error }` | **Dung choi** — hien thi loi |

**`status` co 4 gia tri:** `pending` | `running` | `succeeded` | `failed` (`ReportJobStatus` trong `report-job.schema.ts`).

**Yeu cau cua Frontend** (fix o `analysis.service.ts` — doan "moi `202` deu coi la dang cho"):

```ts
// Sai (hien tai): moi 202 deu coi la dang cho -> job that bai se cho vo han
// Dung: doc status de phan biet
const meta = await res.json();
if (meta.status === 'succeeded') { /* tai file */ }
else if (meta.status === 'failed') { /* dung choi, hien thi loi */ }
else { /* pending | running -> poll lai */ }
```

**Ghi chu quan trong:** `GET /projects/{projectId}/report/{reportId}/file` tra `202` cho **moi** trang thai khac `succeeded` — ke ca `failed`. Do do **bat buoc** doc `meta.status`, khong duoc suy tu HTTP status. Neu job khong doi trang thai, backend tra log theo `projectId` + `reportId` moi.

### 4.4. BE-05 — AI job sau retry: CAN XAC NHAN

`POST /analysis/jobs/{jobId}/result` **co that su trong hop dong** (ke la route ngoai HTTP cho worker), nhung **consumer that su khong phai HTTP** — `AiWorkerService` goi `IngestAiResultHandler` **trong cung process** (in-process), khong qua HTTP. Do do:

- **Frontend KHONG duoc goi route nay.** Hay theo doi job bang `GET /analysis/jobs/{jobId}` (co trong hop dong, co trong Swagger).
- **Swagger van ghi route nay** vi no la route that trong `AnalysisController` — dung la hop dong co 84 route khop 1-1.

**Trang thai AI job:** `pending` | `running` | `succeeded` | `failed` | `skipped`.

**Luu y retry (OPEN-07):** retry **khong gioi han** so lan. `POST /analysis/jobs/{jobId}/retry` tra `202` va tao **job moi** (job cu bi `skipped`). Nen theo doi **jobId moi** tra ve tu lenh retry, khong theo doi job cu.

**Dinh nghia lai bai nghiem thu de bi ro rang:**
> Luot QA dung **mot job QA moi**, lay `jobId` tra ve tu `retry`, theo doi `GET /analysis/jobs/{jobId}` den khi `succeeded` hoac `failed`. Khi `succeeded` → `GET /projects/{projectId}/analysis/result` **phai tra ket qua da luu**. Neu `POST /analysis/jobs/{jobId}/result` tra `404` voi ID khong ton tai, day **khong phai loi** — route do chi dung cho worker, khong dung nguoi dung.

### 4.5. BE-06 — Hop thu OTP: CAN HA TANG EMAIL

`POST /auth/forgot-password` tra `200` va **khong** bao loi khi email khong ton tai (thong bao trung tinh — chong lo email). Nhap ma sai tra `400` theo dung hop dong.

**Van de:** OTP chi duoc gui qua email. Backend can **SMTP** (`SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASS`) va mot **hop thu QA** de nhan ma that. Neu chua cau hinh SMTP, backend **chi log canh bao** (`[AUTH-05] Chua cau hinh SMTP`) va **khong** fail request — nen QA thay "co loi" nhung that ra la **chua co duong gui**.

**Quy tac OTP (da chot, dung de test):**
- Ma 6 chu so, **hieu luc 10 phut**.
- **Toi da 3 lan nhap sai** → OTP bi vo hieu hoa, phai gui lai.
- **Toi da 5 lan gui/1 gio/tai khoan** → `429 LIMIT_EXCEEDED` (co header `Retry-After`).
- Ma da dung → bi vo hieu hoa (khong dung lai duoc).

**Trach nhiem:**
- **Backend / vat hanh:** chot mot hop thu QA (hoac SMTP relay) va **gui OTP thu** cho 1 dia chi QA.
- **Frontend:** kiem tra `Retry-After` khi gap `429` va **backoff**, khong retry ngay lap tuc.

### 4.6. BE-07 — Schema Swagger cho bieu do: DA SUA XONG

**Trang thai: da trien khai trong backend.** Endpoint `GET /api/v1/datasets/{datasetId}/charts` **da co** schema phan hoi day du trong OpenAPI.

**File backend lien quan (de doi chieu):**

| File | Vai tro |
|---|---|
| `src/backend/src/modules/data-view/data-view.chart.schema.ts` | Schema Zod (nguon su that) cho phan hoi `/charts` |
| `src/backend/src/shared/interfaces/swagger/api-zod.decorator.ts` | Helper `ApiZodResponse()` — sinh OpenAPI tu Zod |
| `src/backend/src/modules/data-view/data-view.controller.ts` | `@Get('charts')` gan `@ApiZodResponse(...)` |
| `src/backend/test/unit/datasets/chart-swagger-schema.spec.ts` | 16 test khoa schema ↔ interface + kiem tra OpenAPI dau ra |

> **Khong the lech kieu du lieu:** schema Zod duoc **khoa** bang test so sanh hai chieu voi interface `ChartDataResult` (`data-view.types.ts`). Sua interface ma quen sua schema (hoac nguoc lai) ⇒ **test fail** ⇒ khong the lech am thanh.

**Vi sao Frontend thay "route co tren deploy nhung vang trong checkout backend":** dung la **do lech phien ban** nhu §1 — checkout `ea2f1b7` (18/11) chua co route `/charts` (route duoc them sau do), con ban deploy co. Backend da **dong bo** source.

**Schema moi cong bo** (sinh tu Zod schema, nen **khong the lech** kieu du lieu — test khoa):

```
GET /api/v1/datasets/{datasetId}/charts
200 → { success: true, data: { charts: [ ... ] } }
```

Moi phan tu cua `charts` — **mot phan tu cho moi cot** (khong phai 3 mang tach biet):

| Truong | Kieu | Y nghia |
|---|---|---|
| `column_key` | `string` | Key on dinh (vd `c3`) |
| `column_name` | `string` | Ten hien thi |
| `data_type` | `string` | `string` \| `number` \| `boolean` \| `date` |
| `total_records` | `number` | Tong so dong **toan bo** dataset |
| `sampled_records` | `number` | So dong **thuc su doc** (gioi han boi `max_rows`) |
| `truncated` | `boolean` | `true` khi so lieu tinh tren **mau** |
| `missing_count` | `number` | So gia tri thieu trong mau |
| `missing_ratio` | `number` | `missing_count / sampled_records` |
| `histogram` | `object?` | Chi co voi cot `number` |
| `box_plot` | `object?` | Chi co voi cot `number` |
| `category` | `object?` | Chi co voi cot `string` / `boolean` |

**Quy tac tinh toan — Frontend dung de dung bieu do dung:**

| Truong | Cach tinh |
|---|---|
| `total_records` | Tong so dong toan bo dataset (khong gioi han) |
| `sampled_records` | So dong thuc su doc — gioi han boi `max_rows` (mac dinh 50 000) |
| `truncated` | `true` khi `total_records > sampled_records` ⇒ so lieu tinh tren **mau** |
| `missing_count` | So gia tri thieu trong mau (`null`/`undefined`, hoac khong ep duoc sang kieu cot) |
| `missing_ratio` | `missing_count / sampled_records` — **khong** lam tron |
| `category.items[].rate` | `count / (so gia tri khong thieu)` — lam tron **4 chu so thap phan** |
| `category.other.rate` | Cung cong thuc voi `items[].rate`; `null` khi khong con gia tri nao ngoai Top N |
| `category.distinct_count` | So gia tri khac nhau (khong tinh rong) |

> **Luu y quan trong:** `missing_ratio` va `rate` dung **hai mau so khac nhau**. `missing_ratio` chia cho *tong so dong da doc*, con `rate` chia cho *so gia tri khong thieu*. Frontend khong duoc dung chung mot mau so.

**Truong con theo loai cot:**
- Cot **so** → `histogram: { method, bins: [{ from, to, count }] }` va `box_plot: { q1, median, q3, whisker_low, whisker_high, outside_count, n }`.
  - `method`: `freedman_diaconis` \| `sturges` \| `single_value`. Toi da **50** bin.
  - `outside_count` la so gia tri ngoai rao — **khong** mac dinh la loi du lieu.
- Cot **chuoi / boolean** → `category: { top_n, items: [{ value, count, rate }], other: { count, rate } \| null, distinct_count, masked? }`.
- Cot **date** → chi co truong chung (ty le thieu). Bieu do thoi gian can cot thoi gian duoc chon trong cau hinh phan tich — **khong thuoc endpoint nay**.

**Truong `masked`:** co `true` khi cot bi danh dau PII ⇒ **khong** tra gia tri tho; chi con `distinct_count` + thong ke thieu, `items` la mang rong. Frontend hien thi thong bao "an gia tri" va **khong** hien thi danh sach.

**Truong `data_type` khong phu hop** ⇒ truong tuong ung **khong co** trong JSON (khong phai loi).

**Query:** `columns` (CSV, tuy chon — mac dinh tat ca cot), `top_n` (1–20, mac dinh 5), `max_rows` (1–50000, mac dinh 50000). Toi da **50** cot moi trong mot lan goi. `columns` chap nhan ca key `c{i}` lan ten hien thi.

**Bien doi phia Frontend:**
1. **Sinh lai type** tu `/api/v1/docs-json` (co the dung `openapi-typescript`) — **khong can tu viet lai**.
2. **Cap nhat OpenAPI snapshot** cua Frontend (`src/frontend/src/lib/openapi.json`) — hien dang vang thi thieu route `/charts` va schema phan hoi.
3. **Dung `category.masked`** de an gia tri PII (da co san trong UI theo bao ca QA).

## 5. Checklist hanh dong cho Frontend

| # | Muc | Muc do | Tai lieu |
|---|---|---|---|
| 1 | Go `GET`/`POST /projects/{projectId}/analysis/config` | **Bat buoc** | §2.4 |
| 2 | Bo nut "Luu cau hinh" / "Tai cau hinh" | **Bat buoc** | §2.4 |
| 3 | Gui `correlation_method` / `outlier_method` / `top_n` / `chart_top_n` vao body `POST /analysis` | **Bat buoc** | §2.3 |
| 4 | Go `PATCH /datasets/{id}/columns/pii` | **Bat buoc** | §3.4 |
| 5 | Bo nut "Danh dau la PII" | **Bat buoc** | §3.4 |
| 6 | Phan biet `meta.status` khi poll PDF (dung choi khi `failed`) | **Bat buoc** | §4.3 |
| 7 | Cap nhat OpenAPI snapshot (xoa 2 route config + 1 route pii, them `/charts` + schema) | **Bat buoc** | §2.4, §3.4, §4.6 |
| 8 | Sinh lai type tu `/api/v1/docs-json` | Khuyen nghi | §4.6 |
| 9 | Lay `jobId` moi tu lenh retry, khong theo doi job cu | Khuyen nghi | §4.4 |
| 10 | Doc `Retry-After` khi gap `429` va backoff | Khuyen nghi | §4.5 |

**Khong can lam (Backend da xu ly):**
- Khong can sua backend de them lai 3 route da rut.
- Khong can doi hop dong sang `/api/v2`.
- Khong can doi API nghiep vu khac — **84 route** khop 1-1 voi hop dong §3.13.

## 6. Phu luc

### 6.1. Cac route bi rut — vi tri trong source (de doi chieu)

| Route | Controller (ban deploy) | Handler da xoa |
|---|---|---|
| `GET/POST /projects/:projectId/analysis/config` | `modules/analysis/presentation/controllers/analysis.controller.ts` | `GetConfigHandler`, `SaveConfigHandler` |
| `PATCH /datasets/:datasetId/columns/pii` | `modules/datasets/presentation/controllers/datasets.controller.ts` | `UpdateColumnPiiHandler` |

> **Luu y:** duong dan file o bao ca QA (`.../presentation/controllers/data-view.controller.ts`) **khong con dung** o ban deploy — module `data-view` da duoc **flatten** ve `modules/data-view/data-view.controller.ts` (commit `9c68524`, P3.3). File `src/frontend/src/lib/openapi.json` cung **khong ton tai** trong repo backend (frontend la repo rieng) — Frontend phai tu cap nhat file do.

### 6.2. Cac tai lieu lien quan

| Tai lieu | Noi dung |
|---|---|
| `docs/API_INTEGRATION_STATUS.md` | Bao ca QA goc cua Frontend (24/11) |
| `docs/restructures/24_open_decisions_resolved.md` | OPEN-03 / OPEN-06 va cac mau thuan da giai quyet |
| `docs/restructures/7_api_contracts_v8.md` §3.13 | Bang route chuan (84 route) — nguon su that |
| `docs/frontend-handover/01-api-contract.md` | Hop dong API day du cho Frontend |
| `docs/frontend-handover/02-realtime-and-env.md` | Bien moi truong va realtime |

### 6.3. Cach kiem chung nhanh

```bash
# 1. Swagger tai QA — 84 route, kem schema phan hoi cua /charts
curl -s https://<backend-qa>/api/v1/docs-json | jq '.paths | length'
curl -s https://<backend-qa>/api/v1/docs-json \
  | jq '.paths["/api/v1/datasets/{datasetId}/charts"].get.responses["200"]'

# 2. Trong repo backend — doi chieu hop dong vs ma nguon (0 thieu, 0 thua)
pnpm arch:api-coverage

# 3. Kiem tra 3 route da rut that su khong con
curl -s -o /dev/null -w '%{http_code}\n' -X GET  https://<backend-qa>/api/v1/projects/<id>/analysis/config
curl -s -o /dev/null -w '%{http_code}\n' -X PATCH https://<backend-qa>/api/v1/datasets/<id>/columns/pii
# Ket qua mong doi: 404 (route khong ton tai) — KHONG phai 500
```

### 6.4. Doi chieu mau thuan da giai quyet

Muc 4 cua `24_open_decisions_resolved.md` ghi nhan 5 mau thuan giua cac quyet dinh. Cac mau thuan lien quan den bao ca QA:

| # | Mau thuan | Quyet dinh |
|---|---|---|
| 1 | GĐ7.1 (`column_roles`) vs OPEN-06 | **Bo `column_roles`** — he thong tu suy vai tro cot |
| 2 | OPEN-03 vs GĐ4 (`columns/pii`) | **Bo route** — PII tu suy dong |
| 3 | OPEN-03 vs `PATCH /datasets/:id` + `DELETE /datasets/:id` | **Giu `DELETE`**, **bo `PATCH`** (xoa dataset roi nap lai la duong sua du lieu) |

---

**Phan hoi:** tra loi trong file `docs/API_INTEGRATION_STATUS.md` hoac khoang tin hoi thuot — Backend se phan hoi them neu con muc nao chua ro.
