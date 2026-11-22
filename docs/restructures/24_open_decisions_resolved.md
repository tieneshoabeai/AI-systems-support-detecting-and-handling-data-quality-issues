# 24. Các quyết định nghiệp vụ đã chốt (OPEN-01 … OPEN-10)

- **Ngày chốt:** 2026-11-19
- **Nguồn:** `src/backend/test/unit_test/20_open_decisions.md` (danh sách câu hỏi, không tự quyết)
- **Trạng thái:** ✅ **Đã chốt toàn bộ 10/10** + **5 điểm mâu thuẫn** + **3 câu hỏi bổ sung** → dùng làm nguồn `expected` cho unit test.
- **Phạm vi áp dụng:** unit test mới + cập nhật các test cũ đang khẳng định hành vi **khác** với quyết định này.

> **Nguyên tắc (giữ nguyên từ file nguồn).** Nếu code hiện tại **sai** so với quyết định → giữ `expected` theo quyết định, **không** chỉnh test để khớp lỗi. Nếu code **đúng** → viết test khoá hành vi đó lại (regression test).

> **Tóm tắt định hướng chung.** Hệ thống **chỉ nhận dataset và phân tích** — không cho người dùng thao tác lên dataset (đổi tên cột, đổi tên dataset, đánh dấu PII) và không có cấu hình phân tích thủ công. Mọi thứ hệ thống **tự suy**; người dùng chỉ đọc kết quả và các **phát hiện**.

---

## 1. Bảng tổng hợp

| ID | Chủ đề | Quyết định | Khớp code hiện tại? |
|---|---|---|---|
| OPEN-01 | Role khi đăng ký | API chỉ cấp `analyst`; admin được **bootstrap qua biến môi trường** (`ADMIN_EMAIL`/`ADMIN_PASSWORD`) lúc khởi động nếu chưa có | ✅ Đã triển khai (`admin-bootstrap.service.ts`) |
| OPEN-02 | Hạn refresh token | **Gia hạn trượt** — `expiresAt = now + TTL` mỗi lần refresh | ✅ Đã sửa comment + test |
| OPEN-03 | Đổi tên cột | **Không có tính năng đổi tên cột.** Chỉ phát hiện lỗi tên cột → đưa vào mục **Phát hiện** kèm vị trí lỗi cụ thể | ✅ Đã gỡ 4 route |
| OPEN-04 | Cột trùng tên trong output | Các phát hiện đưa vào **mục Phát hiện**; endpoint `GET /records` **giữ nguyên shape** hiện tại | ✅ Đã triển khai (`findings`) |
| OPEN-05 | Ngày/CSV | **Không tự chuẩn hoá** — giữ nguyên giá trị thô, ô nghi ngờ → mục Phát hiện kèm vị trí. **Chỉ CSV phẩy cách** (thu hẹp từ `,` `;` tab `|`) | ✅ Đã thu hẹp + BOM |
| OPEN-06 | Cấu hình cột | **Không có khái niệm chọn cột.** Hệ thống luôn phân tích toàn bộ cột; label/time/value **tự suy**; không có cấu hình thủ công | ✅ Đã gỡ 2 route + tự suy |
| OPEN-07 | Retry AI job | **Không giới hạn** số lần retry (giới hạn bằng quota) | ✅ Đã triển khai + chống job cũ ghi đè |
| OPEN-08 | Thu hồi realtime | **Event-driven** — ngắt socket **tức thì** khi có event user blocked/removed | ✅ Đã triển khai (server đóng hẳn socket) |
| OPEN-09 | Lỗi hạ tầng | **Strict** — ghi event/outbox thất bại ⇒ nghiệp vụ chính **cũngng thất bại**. Ghi event trong **cùng Mongo transaction** | ✅ Đã triển khai (`TRANSACTION_PORT`) |
| OPEN-10 | Quy ước số học | Chuẩn khoa học dữ liệu: variance/độ lệch chuẩn dùng **mẫu** (n−1), quartile nội suy (type 7), skewness mẫu. **Giữ nguyên** bộ ngưỡng cảnh báo hiện có | ✅ Đã sửa `stdev` + khoá bằng test |

---

## 2. Chi tiết từng quyết định

### OPEN-01 — Role khi đăng ký

**Quyết định.**
- `POST /auth/register` **luôn** tạo tài khoản `role: 'analyst'`.
- Không có đường nào trong HTTP API để tạo `admin`.
- **Admin được bootstrap bằng biến môi trường**: `ADMIN_EMAIL` + `ADMIN_PASSWORD`. Lúc khởi động, nếu chưa có user nào đăng nhập bằng email đó → hệ thống tự tạo (role `admin`).

**Lý do.** Tránh việc DTO "chấp nhận `admin`" biến thành lỗ hổng đăng ký admin tự do. Bootstrap qua env giữ được tính kiểm soát (chỉ người có quyền deploy mới đặt được biến) mà vẫn tự động hoá việc dựng môi trường.

**Cần làm.**
- `env.validation.ts`: thêm `ADMIN_EMAIL` (email, optional) + `ADMIN_PASSWORD` (string ≥ 12 ký tự, optional).
- `.env.example`: ghi chú 2 biến này.
- Service khởi động (`OnModuleInit`): nếu `ADMIN_EMAIL` + `ADMIN_PASSWORD` được set → tạo/quan hệ admin (idempotent — không ghi đè nếu đã tồn tại).
- `register.handler.ts`: bỏ khả năng nhận `role` từ input; ép `analyst`.
- DTO `register`: bỏ `role` khỏi schema (hoặc giữ nhưng bỏ qua — **tốt hơn là bỏ hẳn** để không gây hiểu nhầm).

---

### OPEN-02 — Hạn refresh token

**Quyết định: gia hạn trượt.** `expiresAt = now + refreshTtlMs(rememberMe)` mỗi lần refresh.

**Hiện trạng.** `refresh-access-token.handler.ts` dòng 73 đã làm đúng. Comment trong handler nói "giữ hạn" → **sửa comment** cho khớp, không sửa code.

**Hệ quả cần ghi nhận.** Phiên đăng nhập có thể kéo dài vô hạn nếu client refresh liên tục → cần cơ chế thu hồi phiên (đã có: phát hiện tái sử dụng refresh token đã thu hồi ⇒ thu hồi toàn bộ phiên của user, `AUTH-12`).

**Test cần viết.**
- Refresh sau 1 giây ⇒ `expiresAt` mới = `now + TTL` (không phải `expiresAt` cũ).
- `remember_me = true` ⇒ TTL dài hơn `false`.
- Tái sử dụng token đã thu hồi ⇒ thu hồi **toàn bộ** phiên của user + ghi security alert.

---

### OPEN-03 + OPEN-04 — Không cho thao tác trên dataset

**Quyết định (gộp).** Hệ thống **chỉ nhận dataset và phân tích**, không cho thao tác trên dataset:

1. **Xoá hẳn 2 endpoint** khỏi hợp đồng + mã nguồn:
   - `PATCH /datasets/{datasetId}/columns` (đổi tên cột)
   - `POST /datasets/{datasetId}/columns/reset` (reset tên cột)
2. Giữ `PATCH /datasets/{datasetId}/columns/pii` (GĐ4) — đây là **metadata phân loại**, không phải thao tác nội dung dataset; cần xác nhận lại với người dùng (xem "Cần xác nhận" bên dưới).
3. **Phát hiện lỗi tên cột** (rỗng / trùng / chỉ khoảng trắng) → đưa vào **mục "Phát hiện"** kèm **vị trí lỗi cụ thể** (key cột, số dòng nếu có, thông điệp).
4. Người dùng muốn sửa ⇒ **xoá dataset và import dataset mới** đã chỉnh sửa.

**Vì sao "Phát hiện" thay vì sửa trực tiếp.** Cho phép sửa tên cột sinh ra một vòng lặp phụ thuộc lẫn nhau: tên cột ảnh hưởng fingerprint → kết quả cũ stale → phải rerun; đồng thời tên trùng vẫn có thể xuất hiện lại khi người dùng sửa file. Giữ dataset **immutable** sau khi import giúp kết quả phân tích luôn tái lập được từ đúng file đó.

**Hệ quả bắt buộc.**
- `GET /datasets/{id}/records` **giữ nguyên shape** hiện tại (OPEN-04) — không đổi API vì lý do tên trùng.
- Phải đảm bảo **không mất ô** khi tên trùng: mọi cột vẫn được giữ riêng theo key ổn định `c{i}`.
- `PATCH /datasets/:id` (đổi tên dataset) và `DELETE /datasets/:id` — xem "Cần xác nhạn".

**Cần xác nhận.**
- `PATCH /datasets/{datasetId}/columns/pii` (GĐ4) có giữ không?
- `PATCH /datasets/{datasetId}` (đổi **tên dataset**) và `DELETE /datasets/{datasetId}` có giữ không? (Đổi tên dataset không phải "thao tác trên dataset" theo nghĩa nội dung dữ liệu, nhưng vẫn là mutation.)

---

### OPEN-05 — Ngày / CSV

**Quyết định.**
1. **Không tự chuẩn hoá dữ liệu theo suy đoán.** Giữ nguyên giá trị thô đọc được. Mọi ô nghi ngờ (ngày mơ hồ, số vô nghĩa, dòng lệch header, trailing blank row, ô xuống dòng) → **mục Phát hiện kèm vị trí lỗi cụ thể** để người dùng tự sửa file rồi import lại.
2. **Thu hẹp định dạng**: chỉ nhận **CSV phẩy cách** (`,`). Bỏ hỗ trợ `;`, tab, `|`.
3. Encoding: UTF-8.

**Lý do thu hẹp delimiter.** Yêu cầu gốc "chỉ nhận dataset và phân tích" + không tự chuẩn hoá ⇒ hỗ trợ 4 delimiter buộc phải có logic đoán (sniff) → mâu thuẫn với nguyên tắc "không suy đoán". Thu hẹp về 1 định dạng là nhất quán nhất.

**Hệ quả bắt buộc.**
- `DatasetDelimiter` type: thu hẹp còn `','`; schema `delimiter` enum → chỉ `','`; `SchemaInferenceService`/ingest: bỏ nhánh đoán delimiter.
- File không phải CSV phẩy cách → từ chối kèm lý do cụ thể ("file dùng dấu phân cách `;`, hệ thống chỉ nhận CSV phẩy cách").
- Kiểm tra trailing blank row → đưa vào Phát hiện (không tự xoá).
- Kiểm tra số dòng vật lý ≠ số dòng logic (ô xuống dòng) → đưa vào Phát hiện.

---

### OPEN-06 — Không có khái niệm chọn cột

**Quyết định.**
1. **Bỏ khái niệm chọn cột.** Hệ thống **luôn phân tích toàn bộ cột** của dataset. Không có tham số chọn cột trong bất kỳ đâu.
2. `label_column` / `time_column` / `value_column` → **hệ thống tự suy** (đã có sẵn phần suy trong `run-analysis.handler.ts`: cột ngày duy nhất → time; cột phân loại → label; cột số → value).
3. **Không có cấu hình thủ công nào.** `correlation_method`, `outlier_method`, `top_n` cũng do hệ thống tự quyết.

**Hệ quả bắt buộc — thu hẹp API.**
- `POST /projects/{projectId}/analysis/config` → **bỏ hẳn** (không còn cấu hình để lưu).
- `GET /projects/{projectId}/analysis/config` → **bỏ hẳn**.
- `POST /projects/{projectId}/analysis` → body rỗng (không còn `selected_columns`, `correlation_method`, `outlier_method`, `top_n`).
- Xoá `analysis_config` collection + schema + `AnalysisConfigInput` + `SaveConfigHandler` + `GetConfigHandler` + `AnalysisConfigDto`.

**Hệ quả với GĐ7 vừa làm.** GĐ7 thêm `column_roles` vào cấu hình — nhưng OPEN-06 bỏ cả cấu hình. → **`column_roles` cũng không có chỗ để lưu**. Cần chốt lại: hoặc (a) giữ `column_roles` ở tầng "ghi đè vai trò" riêng, hoặc (b) bỏ luôn GĐ7.1.

> **Ghi chú.** GĐ7.1 (`column_roles`) được implement ngay trước quyết định này. Vì `selected_columns` bị bỏ, toàn bộ cơ chế "người dùng chọn cột" cũng bị bỏ. **Cần hỏi lại người dùng** xem có giữ `column_roles` không — vì nó cũng là một dạng "thao tác lên dataset/cấu hình phân tích". Đây là điểm **mâu thuẫn** cần giải quyết trước khi implement.

---

### OPEN-07 — Retry AI job: không giới hạn

**Quyết định.** Không có giới hạn số lần retry. Giới hạn (nếu có) do **quota** đảm nhiệm, không phải logic retry.

**Hệ quả bắt buộc.**
- Bỏ giới hạn `attempt` trong `retry-ai-job.handler.ts`.
- `POST /analysis/jobs/{jobId}/retry` trả `202` mọi lần (kể cả attempt > 2).
- Hợp đồng §3.13 ghi "tối đa 2 retry" → **sửa** thành không giới hạn.
- Xác nhận: retry được khi job ở trạng thái nào (`failed`? `pending`? `succeeded`?) và job **đang chạy** có bị từ chối không.

---

### OPEN-08 — Thu hồi realtime: event-driven

**Quyết định.** Khi user bị **blocked** hoặc **removed** → phát event → realtime **ngắt socket tức thì**.

**Hệ quả bắt buộc.**
- Phát event `USER_BLOCKED` / `USER_REMOVED` (qua outbox, theo OPEN-09 → cùng transaction).
- Realtime adapter nhận event → tìm socket của user → `disconnect(true)` / emit `force_disconnect` rồi disconnect.
- Kiểm tra lúc kết nối (hiện tại, `realtime-auth.service.ts`) **giữ nguyên** là lớp phòng thủ thứ hai.

**Cần xác nhận.** Cơ chế ngắt socket: emit event cho client rồi client tự đóng, hay server đóng hẳn (`socket.disconnect(true)`)? Server đóng hẳn an toàn hơn nhưng cần cân nhắc reconnect tự động của client.

---

### OPEN-09 — Lỗi hạ tầng: strict + transaction

**Quyết định.**
1. **Strict** — ghi event/outbox/audit thất bại ⇒ **nghiệp vụ chính cũng thất bại**, báo lỗi cho người dùng. Không "xoá xong rồi nuốt lỗi".
2. Ghi event **trong cùng Mongo transaction** với thao tác chính → không bao giờ mất event.

**Lý do.** Ví dụ hiện tại (`delete-workspace.handler.ts`): xoá workspace thành công → ghi outbox lỗi → chỉ `logger.warn` → **trả về thành công**. Hệ quả: workspace đã xoá nhưng event cascade không được gửi ⇒ project/dataset con mồ côi. Với "strict + transaction", cả hai cùng thành công hoặc cùng rollback.

**Hạ tầng đã có sẵn (không cần viết mới).**
- `MongooseTransactionService.runInTransaction(fn)` — `src/shared/infrastructure/database/mongoose-transaction.service.ts`
- `MongoSessionContext` (AsyncLocalStorage) — repository tự gia nhập transaction qua `resolveMongoSession()`
- `base-mongo.repository.ts` đã truyền `session` vào `create` / `softDelete` / `updateOne` / `count` / `findOne`
- `.env.example` dùng `mongodb+srv://...` (Atlas) → **hỗ trợ transaction** ✔

**Hệ quả bắt buộc.**
- `delete-workspace.handler.ts`: bọc `softDelete` + `outbox.recordEvent` trong `runInTransaction` → bỏ `try/catch` nuốt lỗi.
- `outbox.service.recordEvent()` phải nhận `session` và truyền xuống.
- Rà soát các handler đang `try/catch` nuốt lỗi outbox/audit/notification → chuyển sang transaction.
- `notification` / `audit` thuộc nhóm nào → xem "Cần xác nhận".

**Cần xác nhận.**
- `audit log` có bắt buộc phải ghi được không (hay best-effort)? Khác với outbox.
- `notification` (email/push) có rollback được không? Gửi email **không thể rollback** → về lý thuyết phải là best-effort, hoặc ghi notification vào DB trong transaction rồi worker gửi sau.

---

### OPEN-10 — Quy ước số học

**Quyết định.**
- Variance / độ lệch chuẩn: dùng **mẫu** (n−1).
- Quartile: nội suy (type 7) — chính là `simple-statistics` (`ss.quantile`) và `quantileSorted()` hiện tại.
- Skewness: **mẫu** (`ss.sampleSkewness`) — đúng như GĐ7 đã làm.
- **Giữ nguyên** bộ ngưỡng cảnh báo hiện có (`impact.util.ts`): DQ-01 <1% thấp / 1–10% trung bình / >10% cao; DQ-02 <0,5% / 0,5–5% / >5%; DQ-04 chỉ IQR thấp / IQR 3× hoặc Z trung bình / cả hai cao.

**Hiện trạng.** `stats.util.ts` dùng `ss.sampleStandardDeviation` ✔; `dq.util.ts` `quantileSorted()` dùng nội suy type 7 ✔; GĐ7 `skewnessOf()` dùng `ss.sampleSkewness` ✔.

**Cần xác nhận.**
- `min sample` cho mỗi phép tính (hiện DQ-04 yêu cầu ≥ 4 quan sát; tương quan/VIF thì sao?).
- `tolerance` khi so sánh số thực trong test (đề xuất `toBeCloseTo` với `precision` cụ thể cho từng phép tính).

---

## 3. Bảng ảnh hưởng tới mã nguồn

| Hạng mục | File liên quan | Hành động |
|---|---|---|
| OPEN-01 | `auth/.../register.handler.ts`, `register.dto.ts`, `env.validation.ts`, `.env.example`, service bootstrap | Ép `analyst`, bỏ `role` khỏi DTO, thêm bootstrap admin |
| OPEN-02 | `auth/.../refresh-access-token.handler.ts` | Sửa comment (code đã đúng) |
| OPEN-03/04 | `datasets.controller.ts`, `update-column-names.handler.ts`, `reset-column-names.handler.ts`, `dataset.entity.ts` (`renameColumns`, `resetColumnNames`), `datasets.repository.ts` | **Xoá 2 endpoint** + handler + entity method; chuyển phát hiện sang mục Phát hiện |
| OPEN-05 | `dataset.entity.ts` (`DatasetDelimiter`), `analysis-config.schema.ts` (delimiter), `ingest-dataset-stream.handler.ts`, `schema-inference.service.ts` | Thu hẹp còn `','`; thêm kiểm tra & báo cáo lỗi vị trí |
| OPEN-06 | `analysis.controller.ts`, `save-config.handler.ts`, `get-config.handler.ts`, `analysis-config.dto.ts`, `analysis.types.ts`, `analysis-config.schema.ts`, `run-analysis.handler.ts` | **Xoá 2 endpoint config** + thu hẹp body `POST /analysis`; xử lý mâu thuẫn với GĐ7.1 |
| OPEN-07 | `retry-ai-job.handler.ts`, `7_api_contracts_v8.md` §3.13 | Bỏ giới hạn attempt |
| OPEN-08 | `realtime/...`, `auth` (block/remove handler), outbox event types | Phát event + ngắt socket |
| OPEN-09 | `delete-workspace.handler.ts`, `outbox.service.ts`, các handler đang nuốt lỗi | Bọc transaction, bỏ `try/catch` nuốt lỗi |
| OPEN-10 | `stats.util.ts`, `dq.util.ts`, `impact.util.ts` | Không đổi code — chỉ viết test khoá hành vi |

---

## 4. Những điểm **mâu thuẫn** — ✅ **ĐÃ GIẢI QUYẾT 2026-11-19**

| # | Mâu thuẫn | Quyết định |
|---|---|---|
| 1 | **GĐ7.1 (`column_roles`) vs OPEN-06** | **BỎ `column_roles`.** Hệ thống tự suy vai trò cột hoàn toàn, người dùng không can thiệp. → Thu hồi GĐ7.1 (schema, mapper, `SaveConfigHandler`, `GetConfigHandler`, DTO, `column_roles` trong fingerprint & `analysis_run.config`). **Giữ lại** GĐ7.2–7.5 (`outlierBreakdown`, `symbolMissingCount`, `skewness`, `outlierSkippedReason`) vì chúng là **số liệu đầu ra**, không phải cấu hình. |
| 2 | **OPEN-03 vs GĐ4 (`PATCH /datasets/:id/columns/pii`)** | **BỎ.** Tuân thủ triệt để "chỉ nhận dataset và phân tích". → GĐ4 bị thu hồi. **Hệ quả**: cờ PII phải được suy ra **tự động** (từ tên cột / heuristic), không cho người dùng đánh dấu thủ công. Cần rà lại chỗ nào đọc `isPii` để đảm bảo không còn đường bật/tắt thủ công. |
| 3 | **OPEN-03 vs `PATCH /datasets/:id` + `DELETE /datasets/:id`** | **Giữ `DELETE /datasets/:id`; bỏ `PATCH /datasets/:id`** (đổi tên dataset). → Xoá endpoint đổi tên dataset; giữ xoá dataset (cần cho luồng "xoá rồi import lại đã chỉnh sửa" theo OPEN-03). |
| 4 | **OPEN-09 vs notification** | **Ghi notification vào DB trong cùng transaction**; worker gửi email/push **sau** commit. → Không mất notification, không cần rollback email (email đã gửi thì không thu hồi được). |
| 5 | **OPEN-07: job đang chạy có retry được không** | **CÓ — retry được cả khi job đang chạy.** Tạo job mới; job cũ bị bỏ qua khi trả kết quả (kết quả trễ không ghi đè job mới). |

---

## 5. Tổng hợp phạm vi thay đổi sau khi chốt

### 5.1. Endpoint bị **xoá khỏi hợp đồng** (6 route)

| Endpoint | Lý do | Quyết định |
|---|---|---|
| `PATCH /datasets/{datasetId}/columns` | Đổi tên cột | OPEN-03 |
| `POST /datasets/{datasetId}/columns/reset` | Reset tên cột | OPEN-03 |
| `PATCH /datasets/{datasetId}/columns/pii` | Bật/tắt cờ PII | Mâu thuẫn #2 |
| `PATCH /datasets/{datasetId}` | Đổi tên dataset | Mâu thuẫn #3 |
| `POST /projects/{projectId}/analysis/config` | Không còn cấu hình phân tích | OPEN-06 |
| `GET /projects/{projectId}/analysis/config` | Không còn cấu hình phân tích | OPEN-06 |

> **90 route → 84 route.** Đây là **thay đổi phá vở hợp đồng** → hợp đồng phải lên **v2** (mục 3.15 quy tắc 2: "thay đổi phá vở hợp đồng → tạo `/api/v2`, giữ `/api/v1` trong thời gian chuyển tiếp"). Cần chốt: chấp nhận **v2** hay coi đây là giai đoạn tiền-production nên phá vở `/api/v1` luôn?

### 5.2. Thay đổi hành vi (không xoá route)

| Hạng mục | Thay đổi |
|---|---|
| `POST /projects/{projectId}/analysis` | Body rỗng — bỏ `selected_columns`, `correlation_method`, `outlier_method`, `top_n`. Hệ thống tự suy toàn bộ. |
| `POST /analysis/jobs/{jobId}/retry` | Bỏ giới hạn attempt; cho retry cả job đang chạy. |
| `POST /auth/register` | Ép `role: 'analyst'`; bỏ `role` khỏi DTO. Admin bootstrap qua env. |
| `GET /datasets/{datasetId}/records` | Giữ nguyên shape. Phát hiện lỗi tên cột đưa sang mục **Phát hiện**. |
| Import CSV | Chỉ nhận **CSV phẩy cách, UTF-8**. File khác → từ chối kèm lý do. |
| Phiên bản API | **Phá vở `/api/v1` luôn** — dự án chưa có frontend chạy (mục 3.15 quy tắc 4). Không tạo `/api/v2`. |

### 5.3. Thay đổi hạ tầng

| Hạng mục | Thay đổi |
|---|---|
| Outbox / audit | **Bọc transaction** cùng nghiệp vụ chính; bỏ `try/catch` nuốt lỗi. Dùng `MongooseTransactionService.runInTransaction()` (đã có sẵn). |
| Notification | Ghi vào DB trong transaction; worker gửi sau commit. |
| Realtime | Phát event `USER_BLOCKED` / `USER_REMOVED` → ngắt socket tức thì. |
| Cờ PII | **Suy tự động từ tên cột** (`email`, `phone`, `sđt`, `cmnd`, `cccd`, `email_khach_hang`…) — không học từ mẫu giá trị, không cho đánh dấu thủ công. |

### 5.4. GĐ7 — thu hồi một phần

| Hạng mục | Xử lý |
|---|---|
| GĐ7.1 `column_roles` | ❌ **Thu hồi** (mâu thuẫn #1) |
| GĐ7.2 `outlierBreakdown` | ✅ Giữ |
| GĐ7.3 `symbolMissingCount` + `outlierSkippedReason` | ✅ Giữ |
| GĐ7.4 `skewness` | ✅ Giữ |
| GĐ7.5 Tối ưu `numericValues` | ✅ Giữ |

### 5.5. Mục "Phát hiện" — đặt ở **cả hai** nơi

| Nơi | Nội dung | Mục đích |
|---|---|---|
| **Metadata dataset** (`GET /datasets/{id}`) | `findings[]` — lỗi tên cột, ô nghi ngờ ngày/số, dòng lệch header, trailing blank row, ô xuống dòng | Thấy **ngay sau khi import**, không cần chạy phân tích |
| **Kết quả phân tích** (`analysis_result.findings`) | Cùng nội dung + phát hiện mới phát sinh lúc chạy | Bản đầy đủ gắn với kết quả cụ thể |

> **Lưu ý GAP-003.** Gate "dataset có lỗi tên cột → chặn phân tích" (đã implement ở GĐ7) **vẫn giữ** — nhất quán với OPEN-03 (người dùng phải sửa file rồi import lại). Phát hiện vẫn hiển thị trong metadata để người dùng biết cần sửa gì.

---

## 6. Liên kết

- [`7_api_contracts_v8.md`](./7_api_contracts_v8.md) — hợp đồng API (sẽ cần v8.4 khi bỏ endpoint OPEN-03/06)
- [`17_api_gap_analysis_v1.md`](./17_api_gap_analysis_v1.md) — phân tích gap
- [`23_gd7_column_roles_dq_explain.md`](./23_gd7_column_roles_dq_explain.md) — GĐ7
- `src/backend/test/unit_test/20_open_decisions.md` — danh sách câu hỏi gốc
