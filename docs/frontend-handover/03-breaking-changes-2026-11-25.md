# 03 — Thay đổi hợp đồng API (đợt merge `Vqd_BE`)

> **Đối tượng:** Frontend
> **Ngày:** 25/11/2026
> **Phạm vi:** `data-view`, `analysis`, `feedback` + 3 loại thông báo mới
> **Nguồn:** nhánh `Vqd_BE` (đồng nghiệp) đã merge vào `Hoa24102026` — commit `1da9303`
> **Backend đã deploy:** ✅ — code đã lên `origin/Hoa24102026` và đã merge

---

## 0. Tóm tắt trong 30 giây

Có **3 nhóm thay đổi** cần xử lý, xếp theo mức độ rủi ro phá FE:

| # | Nhóm | Rủi ro | Việc FE phải làm |
|---|------|--------|-------------------|
| **1** | **Cursor `data-view` bị ràng buộc bộ lọc + hạn 24 giờ** | 🔴 Cao | Bắt lỗi `400` → bỏ cursor → tải lại trang đầu |
| **2** | **`meta.limit` mới trong response** | 🔴 Cao | Nới schema validate response (nếu đang strict) |
| **3** | **`POST /analysis/jobs/:jobId/result` bị chặn** | 🔴 Cao | **Bỏ mọi lời gọi** tới route này |

Ngoài ra có 4 thay đổi mức trung bình/thấp (bộ lọc siết chặt, so sánh thứ tự trả lỗi, `409` ở feedback, `summary` đếm toàn phạm vi) — xem mục 4.

**Không có route nào bị xoá hoặc đổi đường dẫn.** Toàn bộ thay đổi là **siết chặt thêm** hoặc **bổ sung**, không phải đổi hợp đồng cơ bản.

---

## 1. Nhóm 1 — `data-view`: cursor gắn với bộ lọc, hạn 24 giờ

### 1.1 Vấn đề

Con trỏ phân trang (cursor) trước đây chỉ ghi nhớ vị trí dòng. Nếu người dùng đổi bộ lọc hoặc đổi thứ tự sắp xếp mà vẫn gửi cursor cũ, các trang sau sẽ **lệch dữ liệu** — hiển thị sai mà không báo lỗi.

Backend mới đã sửa bằng cách **gắn vào cursor một chữ ký** của bộ lọc + thứ tự sắp xếp, và **giới hạn thời gian sống 24 giờ**.

### 1.2 Hành vi mới

Áp dụng cho cả 2 route:
- `GET /datasets/:datasetId/records`
- `POST /datasets/:datasetId/records/query`

| Tình huống | Kết quả | Mã lỗi |
|---|---|---|
| Đổi `sort_field` / `sort_order`, vẫn gửi cursor cũ | `400` | `VALIDATION_ERROR` |
| Đổi `filters` / `search`, vẫn gửi cursor cũ | `400` | `error.details.reason = "cursor_query_mismatch"` |
| Cursor quá 24 giờ | `400` | `error.details.reason = "cursor_expired"` |
| Cursor hỏng / sai định dạng | `400` | `VALIDATION_ERROR` |
| Đổi `limit` giữa hai trang | ✅ hợp lệ | — |

### 1.3 Cách xử lý phía FE (bắt buộc)

**Bước 1 — Gửi cursor nguyên văn.** Lấy `data.meta.nextCursor` và gửi lại **đúng nguyên bản** vào query `cursor`. Không tự tạo, không sửa, không cắt, không giải mã rồi ghép lại.

**Bước 2 — Bắt lỗi 400 và tự tải lại.**

```js
async function fetchRecords(params) {
  try {
    return await api.get('/datasets/:id/records', { params });
  } catch (err) {
    const reason = err?.response?.data?.error?.details?.reason;

    // Cursor không còn hợp lệ với truy vấn hiện tại → bỏ cursor, tải lại trang đầu.
    if (err?.response?.status === 400 &&
        (reason === 'cursor_query_mismatch' || reason === 'cursor_expired')) {
      return api.get('/datasets/:id/records', { params: { ...params, cursor: undefined } });
    }
    throw err;
  }
}
```

**Không cần báo lỗi cho người dùng** — đây là hành vi bình thường (họ vừa đổi bộ lọc).

### 1.4 Điều kiện bắt buộc: đổi điều kiện → bỏ cursor

Ngay cả khi backend không trả lỗi, FE nên chủ động bỏ cursor khi người dùng thay đổi:

| Người dùng thay đổi | Hành động FE |
|---|---|
| `sort_field` / `sort_order` | bỏ `cursor`, tải lại trang đầu |
| `filters` | bỏ `cursor`, tải lại trang đầu |
| `search` | bỏ `cursor`, tải lại trang đầu |
| `limit` | **giữ nguyên** `cursor` (hợp lệ) |

### 1.5 `limit` nới 1-200 → **1-500**

Áp dụng cho cả 2 route. Mặc định vẫn là `50`.

- Nếu UI có chặn cứng `limit ≤ 200` hoặc validate bằng regex → cần nới.
- Nếu có slider "số dòng / trang" → cho phép chọn tới 500.

### 1.6 Bộ lọc: `value` chỉ nhận primitive hoặc mảng

```diff
- value: z.unknown().optional(),
+ value: RecordFilterValueSchema.optional(),
```

| Loại `value` | Kết quả |
|---|---|
| Chuỗi (≤ 500 ký tự) | ✅ |
| Số hữu hạn | ✅ |
| Boolean | ✅ |
| Mảng primitive (≤ 1000 phần tử) — dùng cho `in`, `between` | ✅ |
| **Object** (vd `{ "$ne": null }`, `{ "$regex": "(a+)+$" }`) | ❌ `400 VALIDATION_ERROR` |

> **Lý do:** chặn NoSQL operator injection. Nếu FE đang dựng filter value động kiểu object thì sẽ gặp lỗi — cần đổi sang chuỗi/số/boolean.

### 1.7 So sánh thứ tự: giờ trả lỗi thay vì bỏ qua im lặng

Các toán tử `greaterThan`, `greaterThanOrEqual`, `lessThan`, `lessThanOrEqual`, `between` áp dụng cho **cột số / cột ngày**:

| Tình huống | Trước | Giờ |
|---|---|---|
| Giá trị không phải số / ngày hợp lệ | bộ lọc **bị bỏ qua im lặng** | `400` kèm `message` rõ ràng |

→ **FE nên hiển thị `error.message`** cho người dùng, thay vì hiện thông báo chung chung.

Lưu ý: `equals` / `in` vẫn **nhận giá trị thô** để tìm ở nhập sai kiểu (vd cột số tìm bằng chuỗi `"19"`).

### 1.8 Quy tắc kết hợp bộ lọc

| Trường hợp | Toán tử |
|---|---|
| Nhiều điều kiện trên **cùng một cột** (gửi bằng `c{i}` hay tên hiển thị đều được) | **OR** |
| Điều kiện trên **khác cột nhau** | **AND** |

### 1.9 Cột ngày và ô trống

- **Ngày cũ lưu dạng chuỗi** (vd `"2024-01-01"`) nay được lọc / sắp xếp theo **giờ Việt Nam** → khớp với ngày nhập mới. Trước đây lệch 7 giờ.
- **Ô trống** (null, thiếu, hoặc không đọc được thành số/ngày) → **luôn xếp cuối**, cả `asc` lẫn `desc`, với mọi kiểu cột.
- `lessThan` / `lessThanOrEqual` trên cột số / ngày → **không còn trả ô trống**.

### 1.10 Quy tắc so khớp chuỗi trên cột số / boolean

`contains` / `startsWith` / `endsWith` / `search` dùng được trên cột số và boolean — số khớp theo **dạng chuỗi** (vd `"19"` khớp `1990`).

`isEmpty` / `isNotEmpty`: chuỗi chỉ có khoảng trắng cũng tính là ô trống.

---

## 2. Nhóm 2 — Response có thêm `meta.limit`

### 2.1 Thay đổi hình dạng

```diff
- meta: { nextCursor: string | null; hasMore: boolean; }
+ meta: { nextCursor: string | null; hasMore: boolean; limit: number; }
```

### 2.2 Route bị ảnh hưởng

| Route | Được thêm `meta.limit` |
|---|---|
| `GET /datasets/:datasetId/records` | ✅ |
| `GET /analyses/:analysisId/findings/:findingId/feedback` | ✅ |
| `GET /analyses/:analysisId/feedback` | ✅ |

### 2.3 ⚠️ Cảnh báo quan trọng

Nếu FE dùng **Zod** hoặc **JSON Schema strict** để validate response → **field mới sẽ bị reject**.

```diff
- const MetaSchema = z.object({ nextCursor: z.string().nullable(), hasMore: z.boolean() });
+ const MetaSchema = z.object({
+    nextCursor: z.string().nullable(),
+    hasMore: z.boolean(),
+    limit: z.number(),        // ← thêm
+  });
```

Nếu dùng TypeScript interface → thêm `limit: number` vào type, nếu không sẽ có lỗi kiểu dữ liệu.

---

## 3. Nhóm 3 — `POST /analysis/jobs/:jobId/result` bị chặn

### 3.1 Hành vi mới

```diff
- @CheckPolicies((ability) => ability.can(Action.Execute, 'Analysis'))
+ @CheckPolicies((ability) => ability.can(Action.Manage, 'all'))
```

Thêm: nếu `NODE_ENV=production` → route trả `404` (ẩn hoàn toàn).

| Điều kiện | Kết quả |
|---|---|
| Chỉ SYS-ADMIN (`role=admin`) | ✅ `200` |
| User thường, có quyền `Execute Analysis` | ❌ `403` |
| Bất kỳ ai, khi `NODE_ENV=production` | ❌ `404` |

### 3.2 ⚠️ FE phải BỎ mọi lời gọi tới route này

Route này dùng để **ghi trực tiếp kết quả AI** vào hệ thống. Worker AI gọi thẳng handler nội bộ, **không đi qua HTTP**.

→ **Xoá hẳn** mọi code path gọi `POST /analysis/jobs/:jobId/result` khỏi FE. Nếu FE dùng nó để "đẩy kết quả AI giả lên để test" thì phải bỏ và chờ AI thật trả kết quả.

### 3.3 Route `/analysis/jobs/:jobId/retry` — không đổi hợp đồng

- Vẫn trả `202`, response không đổi.
- Chỉ bổ sung: backend ghi **audit log** `AI_JOB_RETRIED` (actor, jobId, projectId).

→ **FE không cần sửa gì**, chỉ nên biết là thao tác này giờ có vết audit.

---

## 4. Nhóm 4 — Các thay đổi mức trung bình / thấp

### 4.1 `feedback`: `409 CONFLICT` khi lần phân tích chưa xong

| Loại nhận xét | Trạng thái run được phép | Run chưa xong (`pending` / `running`) |
|---|---|---|
| Nhận xét **một phát hiện** (`POST /analyses/:analysisId/findings/:findingId/feedback`) | `succeeded` | `409 CONFLICT` |
| Nhận xét **cả lần chạy** (`POST /analyses/:analysisId/feedback`) | `succeeded` hoặc `failed` | `409 CONFLICT` |

**FE nên ẩn hoặc khoá nút nhận xét** khi lần phân tích chưa xong, thay vì để user bấm rồi mới nhận `409`.

### 4.2 `feedback`: SYS-ADMIN bị chặn `403` ở mọi route

SYS-ADMIN (`role=admin`) → `403` ở mọi route feedback, **trừ `DELETE`** (xoá kiểm duyệt).

```json
{ "success": false, "error": { "code": "HTTP_403", "message": "Quản trị viên hệ thống không có quyền với nhóm nhận xét (FB-*)" } }
```

**Lý do thiết kế:** tránh việc quản trị viên "tự chấm" làm ảnh hưởng điểm trust của mẫu RAG.

→ Nếu FE hiển thị màn hình nhận xét cho tài khoản admin, cần **ẩn màn hình đó** với role `admin`.

### 4.3 `feedback`: quy tắc `403` khi sửa / xoá

| Tình huống | Kết quả |
|---|---|
| Không còn quyền xem project (không còn ở project **và** không còn ở workspace) | `403` |
| Thành viên workspace bị gỡ khỏi project | ✅ vẫn sửa / xoá được (còn quyền xem qua workspace) |
| Project đã bị xoá | `404` |

### 4.4 `feedback`: `summary` đếm trên toàn phạm vi

`summary` (số nhận xét theo từng nhãn) giờ đếm trên **toàn bộ** nhận xét của phát hiện / lần chạy, **không** bị lọc bởi `?label=`.

→ Muốn biết số dòng **sau khi lọc** thì đếm `items.length`, đừng dùng `summary`.

### 4.5 `data-view`: sửa lỗi lịch sử cột ngày

Cột ngày trong `GET /datasets/:datasetId/columns/:columnKey/stats`:
- Ngày cũ lưu dạng chuỗi nay được xử lý theo giờ Việt Nam (khớp dữ liệu mới).
- Cột có mọi giá trị giống nhau → `histogram` chỉ 1 khoảng (trước đây lỗi `500` với cột số ~120k dòng trở lên).

→ Đây là **fix bug**, FE hưởng lợi, không cần sửa gì.

---

## 5. Thông báo mới (K6) — không breaking, nhưng cần render

`GET /notifications` và realtime `notification.created` (phòng `user:{userId}`) giờ có 3 loại thông báo mới:

| Loại | Khi nào | Tiêu đề |
|---|---|---|
| `analysis_completed` | Lần phân tích xong | — |
| `analysis_failed` | Lần phân tích lỗi (summary chỉ nêu mã lỗi) | — |
| `ai_analysis_ready` | Phần nhận xét AI kết thúc | "Nhận xét AI đã sẵn sàng" (thành công) / "Phân nhận xét AI thất bại" (lỗi) |

**`payload`:**
```json
{
  "targetType": "analysis_run",
  "targetId": "<analysisRunId>",
  "actionUrl": null
}
```

> `actionUrl` là `null` → **FE tự dựng đường dẫn** tới màn kết quả phân tích của project (ví dụ `/projects/{projectId}/analysis`).

**Mã lỗi** trong summary của `ai_analysis_ready` khi thất bại: `AI_GROUNDING_FAILED` hoặc `AI_FAILED`.

**Lưu ý:**
- Cả 3 loại **không bắt buộc** — user tắt `notificationsEnabled` thì không nhận.
- **Không gửi email** cho 3 loại này.

---

## 6. Checklist đối chiếu cho FE

### 🔴 Bắt buộc — làm trước khi release

- [ ] **Bỏ mọi lời gọi** `POST /analysis/jobs/:jobId/result` (mục 3.2)
- [ ] **Bắt lỗi `400`** với `details.reason ∈ {cursor_query_mismatch, cursor_expired}` → bỏ `cursor` → tải lại trang đầu (mục 1.3)
- [ ] **Bỏ `cursor`** khi người dùng đổi `sort` / `filters` / `search` (mục 1.4)
- [ ] **Thêm `limit: number`** vào type/schema của `meta` ở 3 route (mục 2.2)
- [ ] **Gửi cursor nguyên văn** — không tự tạo/sửa (mục 1.3)

### 🟠 Nên làm

- [ ] Nới validate `limit` lên **500** (mục 1.5)
- [ ] Đảm bảo `filter.value` chỉ gửi **primitive hoặc mảng primitive** (mục 1.6)
- [ ] Hiển thị `error.message` khi bộ lọc so sánh thứ tự bị `400` (mục 1.7)
- [ ] **Ẩn / khoá nút nhận xét** khi lần phân tích chưa xong → tránh `409` (mục 4.1)
- [ ] **Ẩn màn hình nhận xét** với tài khoản `role=admin` → tránh `403` (mục 4.2)
- [ ] Render 3 loại thông báo mới + dựng link từ `targetId` (mục 5)

### 🟢 Kiểm tra lại hành vi cũ

- [ ] Đếm số dòng sau khi lọc bằng `items.length`, **không** dùng `summary` (mục 4.4)
- [ ] Xác nhận quy tắc **OR cùng cột / AND khác cột** hiển thị đúng (mục 1.8)
- [ ] Xác nhận ô trống **xếp cuối** ở cả `asc` lẫn `desc` (mục 1.9)

---

## 7. Cách kiểm chứng nhanh (không cần chờ FE sửa hết)

| Kiểm tra | Gọi API | Kết quả mong đợi |
|---|---|---|
| Cursor hạn 24h | Lấy cursor, chờ > 24h, gửi lại | `400`, `details.reason = "cursor_expired"` |
| Cursor đổi bộ lọc | Trang 1 → đổi `filters` → gửi cursor cũ | `400`, `details.reason = "cursor_query_mismatch"` |
| Cursor đổi sort | Trang 1 → đổi `sort_field` → gửi cursor cũ | `400` `VALIDATION_ERROR` |
| Filter value dạng object | `value = { "$ne": null }` | `400` `VALIDATION_ERROR` |
| So sánh thứ tự sai kiểu | Cột số, `greaterThan` với `"abc"` | `400` kèm `message` |
| `limit` tối đa | `limit=500` | `200` |
| `limit` vượt trần | `limit=501` | `400` `VALIDATION_ERROR`, `message` là mảng `{ field, message }[]` |
| Gọi route AI result | `POST /analysis/jobs/:jobId/result` bằng token user thường | `403` |
| Gọi route AI result (prod) | `NODE_ENV=production` | `404` |
| Nhận xét khi run đang chạy | `POST .../feedback` khi run `running` | `409` |
| Nhận xét bằng admin | `POST .../feedback` với `role=admin` | `403` |

> Lưu ý: `limit=501` → mã lỗi là `ZOD_VALIDATION_ERROR` (quy ước chung của dự án), khác với `VALIDATION_ERROR` của lớp domain.

---

## 8. Tài liệu liên quan

| Tài liệu | Nội dung |
|---|---|
| [`01-api-contract.md`](./01-api-contract.md) | Hợp đồng API đầy đủ (đã cập nhật "cập nhật 2026-11-25") |
| [`02-realtime-and-env.md`](./02-realtime-and-env.md) | Biến môi trường, realtime/socket, tunnel & CORS |
| [`API_ANSWER_24-11.md`](./API_ANSWER_24-11.md) | Trả lời chính thức cho báo cáo QA ngày 24/11 |
| [`README.md`](./README.md) | Mục lục + cách gọi API + khung đáp ứng + quy ước chung |

**Lưu ý về mã lỗi** — trong đợt thay đổi này, **mọi lỗi `400` đều dùng cùng một mã `VALIDATION_ERROR`**, nhưng khác nhau ở `message` và `details`:

| Nguồn lỗi | `code` | `message` | `details` |
|---|---|---|---|
| Sai shape query/body (vd `limit=501`, `value` là object) | `VALIDATION_ERROR` | **mảng** `{ field, message }[]` | `{ fields: [...] }` |
| Sai nghiệp vụ ở tầng domain (vd cursor hỏng, so sánh thứ tự sai kiểu) | `VALIDATION_ERROR` | **chuỗi** | `{ reason: "..." }` (nếu có) |

**FE cần phân biệt 2 dạng `message`:**

```js
// Dạng 1 — lỗi shape (mảng): hiển thị theo từng trường
if (Array.isArray(error.message)) {
  error.message.forEach((f) => showFieldError(f.field, f.message));
}

// Dạng 2 — lỗi nghiệp vụ (chuỗi): hiển thị thông báo chung
else {
  showToast(error.message);
}
```

> Lưu ý: `README.md` mục 2 của thư mục này có ghi `ZOD_VALIDATION_ERROR` — đó là tên cũ. **Code hiện tại đã hợp nhất về `VALIDATION_ERROR`**, và `message` mang thông tin chi tiết. Nếu FE đang bắt theo `ZOD_VALIDATION_ERROR` thì cần sửa sang `VALIDATION_ERROR`.

---

## 9. Liên hệ

| Nội dung | Người nhận |
|---|---|
| Hợp đồng API, câu hỏi về endpoint | Nhóm backend (`Vqd_BE` / `Hoa24102026`) |
| Lỗi RAG, mẫu học, trust score | Nhóm backend — module `feedback` + `analysis` |
| Lỗi UI sau khi áp dụng thay đổi này | Gửi kèm network log + endpoint + payload để backend đối chiếu |

**Khi báo lỗi, xin kèm:** endpoint đầy đủ, query/body đã gửi, response nhận được (đã che token), và bước tái hiện.
