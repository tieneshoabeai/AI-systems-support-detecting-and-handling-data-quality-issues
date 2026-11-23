# MÔ-ĐUN `data-view` — Virtual Grid (Template: Simple)

> **P3.3 (2026-11-24):** Flatten từ Hexagonal → Simple Monolith theo ADR-0002.
> - Vì sao Simple: 4 query chỉ-đọc, không DB riêng (đọc qua `RECORD_QUERY_PORT` của `datasets`), không invariant/transaction/outbox.
> - Bất biến: 4 route `GET records`, `POST records/query` (tách riêng), `GET columns/:columnKey/stats` (key `c{i}` ổn định), `GET charts` (histogram/boxplot/TopN + PII masked); limit `DEFAULT 50/MAX 500 + normalizeRecordLimit`; DTO Zod giữ nguyên qua pipe; guard Jwt+Policies + `DatasetPolicyLoader` (2 resource `DataRecord`/`Dataset`).
> - Cấu trúc mới: `data-view.service.ts (4 method) + data-view.routes.ts (controller + 3 DTO gộp) + data-view.types.ts (types + entity RecordQuery + VO limit/filter) + data-view.utils.ts + index.ts + data-view.module.ts` (giữ `imports: [DatasetsModule]`).
> - Cấm: tự khai schema `DatasetRecord` (CA6/L2), đổi Symbol port (TC-03), đổi thứ tự/tham số method (BC), gộp route records/query.

---
# MÔ-ĐUN `data-view` — Lưới dữ liệu ảo

> **Đặc tả mô-đun & Tài liệu kỹ thuật**

## 1. Thông tin phiên bản (Version Information)

- **Phiên bản hiện tại:** v1.1.0
- **Cập nhật lần cuối:** 2026-11-21
- **Đường dẫn mô-đun:** `src/backend/src/modules/data-view` (15 tệp TypeScript)
- **Tầng kiến trúc:** Clean Architecture 4 tầng (`domain` → `application` → `infrastructure` → `presentation`)
- **Quy tắc tầng:** CA1–CA14 — xem [`../README.md`](../README.md)

## 2. Mục đích & Phạm vi nghiệp vụ (Scope & Responsibility)

Mô-đun cung cấp khả năng **xem và truy vấn dữ liệu lớn** mà không bao giờ nạp toàn bộ vào RAM. Đây là mô-đun hiện thực "Lưới dữ liệu ảo" — trải nghiệm mượt như bảng vài chục dòng dù dữ liệu có hàng triệu dòng, mỗi trang chỉ ≤ 500 dòng.

Mô-đun này **chỉ đọc**. Nó không có repository riêng — dùng `RecordQueryPort` do mô-đun `datasets` cung cấp. Lý do: truy vấn bản ghi thuộc về tầng lưu trữ dataset, còn `data-view` chỉ là lớp trình bày.

### 2.1. Tính năng thuộc phạm vi

| Chức năng | Nội dung |
|---|---|
| Đọc dòng | Phân trang keyset theo `(row_index, _id)` |
| Truy vấn | Lọc + sắp xếp + phân trang tổ hợp |
| Thống kê cột | Count, distinct, min/max, trung bình, histogram, box plot |
| Biểu đồ | Histogram, box plot, top-N theo nhóm |

### 2.2. Cấu trúc thư mục

```text
data-view/
|-- domain/
|   |-- entities/record-query.entity.ts
|   |-- value-objects/
|   |   |-- record-filter.vo.ts     # 14 toán tử lọc
|   |   `-- record-query.vo.ts      # giới hạn trang
|-- application/
|   |-- queries/
|   |   |-- get-records.handler.ts      # phân trang
|   |   |-- query-records.handler.ts    # lọc + sắp xếp
|   |   |-- get-column-stats.handler.ts # thống kê cột
|   |   `-- get-chart-data.handler.ts   # dữ liệu biểu đồ
|   |-- data-view.types.ts
|   `-- data-view.utils.ts
`-- presentation/
    |-- controllers/data-view.controller.ts
    `-- dtos/  (chart-data.dto, query-records.dto, query-records-body.dto)
```

## 3. Nhật ký Prompting & Quyết định kỹ thuật (Prompting Log & Rationale)

- **Yêu cầu người dùng / Ý đồ nghiệp vụ:** Cho phép người dùng xem và lọc dữ liệu hàng triệu dòng như một bảng bình thường, với độ trễ ≤ 50 ms cho mỗi lần cuộn, mà không bao giờ phải nạp dữ liệu về Node.

- **Lập luận kỹ thuật & Quyết định:**

1. **Phân trang keyset, không offset.** `offset=1000000` của MongoDB phải quét và bỏ qua 1.000.000 document. Với người dùng nhảy tới trang 500.000, offset mất nhiều giây; keyset nhảy thẳng tới vị trí cần đọc, dưới 50 ms. Cursor chứa giá trị sắp xếp cuối cùng + `_id` để phá thế hoà hoàn hảo khi nhiều giá trị bằng nhau.

2. **Giới hạn trang 50 / 500.** `DEFAULT_RECORD_LIMIT = 50`, `MAX_RECORD_LIMIT = 500`. `normalizeRecordLimit` chuẩn hoá: giá trị không hữu hạn / ≤ 0 → 50; > 500 → 500. Client không thể ép server trả về một lúc toàn bộ dữ liệu.

3. **Sắp xếp số & ngày: null ở cuối.** MongoDB sắp xếp `null` **trước** mọi giá trị khác khi tăng dần. Người dùng muốn xem "những người không cung cấp tuổi" ở **cuối** danh sách. Với hàng trăm nghìn dòng thiếu giá trị, đầu danh sách sẽ toàn dòng rỗng — vô dụng. `record-query.repository.ts` dùng aggregation **hai giai đoạn** với cờ `__sortnull_num` / `__sortnull_date` (0 = hợp lệ, 1 = null).

4. **Chuyển đổi kiểu an toàn.** Chỉ những giá trị thực sự là số mới được chuyển. Không có kiểm tra `$type`, MongoDB biến `false` → `0` và `true` → `1`, tạo ra **histogram giả** cho cột boolean. Điều kiện: `$type` thuộc `double | int | long | decimal | string`.

5. **14 toán tử lọc, giải key cột linh hoạt.** `resolveColumnKeyPure` ưu tiên key `c{i}`, sau đó tên hiển thị, cuối cùng tên gốc — frontend có thể gửi key hoặc tên cột.

6. **Mọi thống kê chạy bằng aggregation MongoDB**, không kéo dữ liệu về Node để tính. Với hàng triệu dòng, cách này khác biệt giữa chạy được và không chạy được.

7. **Che PII ở biểu đồ phân loại.** Cột bị đánh dấu `is_pii` không trả về chuỗi thô trong Top-N phân loại mà trả về `{ items: [], masked: true }` — tránh rò rỉ dữ liệu nhạy cảm qua biểu đồ.

- **Hiện vật đã tạo / đã sửa:**

- `domain/value-objects/record-filter.vo.ts` — `RECORD_FILTER_OPERATORS` (14 toán tử), `isValidOperator`, `propsPath`, `resolveColumnKeyPure`.
- `domain/value-objects/record-query.vo.ts` — `DEFAULT_RECORD_LIMIT` (50), `MAX_RECORD_LIMIT` (500), `normalizeRecordLimit`.
- `application/queries/get-records.handler.ts` — phân trang keyset, trả `nextCursor`; khi có `sort_field`/`sort_order` sẽ uỷ thác cho `queryRecords` để sắp xếp phía server.
- `application/queries/query-records.handler.ts` — lọc + sắp xếp + phân trang tổ hợp.
- `application/queries/get-column-stats.handler.ts` — thống kê theo kiểu cột.
- `application/queries/get-chart-data.handler.ts` — histogram / boxPlot / categoryTopN (có che PII).

## 4. Đặc tả giao tiếp kỹ thuật (Technical Contracts & API Specifications)

### 4.1. Điểm cuối (Endpoints)

| Phương thức | Đường dẫn | Chính sách | Mô tả |
|---|---|---|---|
| `GET` | `/api/v1/datasets/:datasetId/records` | `Action.Read` | Trang dữ liệu (keyset) |
| `POST` | `/api/v1/datasets/:datasetId/records/query` | `Action.Read` | Truy vấn lọc + sắp xếp |
| `GET` | `/api/v1/datasets/:datasetId/columns/:columnKey/stats` | `Action.Read` | Thống kê cột |
| `GET` | `/api/v1/datasets/:datasetId/charts` | `Action.Read` | Dữ liệu biểu đồ (histogram/boxPlot/categoryTopN) |

**Tham số truy vấn `GET /records`:** `limit` (mặc định 50, tối đa 500), `cursor`, `sort`, `order` (`asc` | `desc`), `sort_field`, `sort_order`.

**Thân `POST /records/query`:**

```json
{
  "filters": [
    { "columnKey": "c2", "operator": "greaterThan", "value": 18 }
  ],
  "sort": { "columnKey": "c2", "order": "asc" },
  "limit": 50,
  "cursor": "..."
}
```

### 4.2. Giao diện / Provider được xuất ra ngoài

`src/backend/src/modules/data-view/index.ts` xuất hợp đồng công khai:

| Tên xuất | Vai trò |
|---|---|
| `DataViewModule` | Mô-đun Nest |
| Thực thể `RecordQuery` | Hợp đồng domain |
| `RecordFilterOperator`, `RECORD_FILTER_OPERATORS` | Danh mục toán tử lọc |

### 4.3. Sự kiện domain phát ra

> Mô-đun này **không phát sự kiện** — nó thuần là lớp đọc dữ liệu.

## 5. Ràng buộc & Tiêu chuẩn bất biến (Invariants & Security Rules)

### 5.1. Bất biến nghiệp vụ

- `limit` luôn nằm trong `[1, 500]`; giá trị không hợp lệ → 50.
- Cursor **phải** được sinh ra từ chính API này — client không được tự chế.
- Toán tử lọc phải thuộc `RECORD_FILTER_OPERATORS` — toán tử lạ được `isValidOperator` chặn.
- Đường dẫn thuộc tính **luôn** nằm trong `props.c{i}` — không được truy cập trực tiếp field khác của `dataset_record`.
- Giá trị **null** (hoặc không parse được) phải sắp xếp **cuối** danh sách khi sắp xếp theo số / ngày.
- Cột boolean **không** được tính histogram số.
- Cột `is_pii` **không** được lộ chuỗi thô trong biểu đồ phân loại.
- Mỗi trang **không vượt quá** `MAX_RECORD_LIMIT` dòng.

### 5.2. Xoá mềm (Soft Delete)

- **Chuẩn:** `deleted_at: Date | null` — trường này **null** nghĩa là bản ghi đang hoạt động.
- **Quy tắc truy vấn:** mọi truy vấn mặc định luôn lọc `deleted_at: null`. Repository nền (`shared/infrastructure/database/base-mongo.repository.ts`) áp dụng điều này tự động.
- **Chơi index Partial Unique:** `partialFilterExpression: { deleted_at: null }` — cho phép tài khoản / tên / email đã xoá mềm được tạo lại.

### 5.3. Bảo mật

| Vấn đề | Cách xử lý |
|---|---|
| Đọc dataset người khác | Policy loader của mô-đun `datasets` kiểm tra instance |
| Ép server trả về dữ liệu lớn | `normalizeRecordLimit` chặn trên 500 dòng |
| Injection qua tên cột | `resolveColumnKeyPure` chỉ nhận key có trong danh sách; đường dẫn dùng `propsPath` |
| Toán tử lọc lạ | `isValidOperator` chặn trước khi build truy vấn |
| Lộ dữ liệu qua phân trang | Chỉ trả dữ liệu thuộc dataset đã được cấp quyền |

### 5.4. Phân quyền

| Tuyến đường | Chính sách |
|---|---|
| `GET /datasets/:datasetId/records` | `Action.Read` trên `Dataset` + policy loader |
| `POST /datasets/:datasetId/records/query` | `Action.Read` |
| `GET /datasets/:datasetId/columns/:columnKey/stats` | `Action.Read` |
| `GET /datasets/:datasetId/charts` | `Action.Read` |

> Mô-đun này **không** định nghĩa policy loader riêng — nó tái sử dụng loader của mô-đun `datasets` để không nhân hai nơi suy xét về quyền.

## 6. Lịch sử thay đổi (Change Log & Version History)

### 2026-11-21
- **v1.1.0** / 2026-11-21 / Viết lại README mô-đun đầy đủ theo chuẩn 6 phần / Yêu cầu tái đọc / Tài liệu mẫu chuẩn

### 2026-11-XX
- **v1.0.0** / 2026-11-XX / Bổ sung `GET /charts` phục vụ histogram, boxPlot, categoryTopN / Cho phép vẽ trực tiếp biểu đồ mà không cần tính ở client / `modules/data-view`
- **v0.9.0** / 2026-11-XX / Bổ sung `get-column-stats.handler.ts` và tiện ích `chart-data.util.ts` / Tiến hoá thống kê cột theo kiểu dữ liệu / `modules/data-view`
- **v0.8.0** / 2026-11-XX / Chuyển từ offset sang phân trang keyset và thêm giới hạn `MAX_RECORD_LIMIT = 500` / Giảm độ trễ trên dữ liệu lớn / `modules/data-view`, `shared/domain/pagination`
- **v0.7.0** / 2026-11-XX / Bổ sung `__sortnull_num` / `__sortnull_date` trong aggregation hai giai đoạn / Giá trị null ở cuối danh sách / `modules/datasets`
- **v0.6.0** / 2026-11-XX / Chặn chuyển đổi kiểu không an toàn: bổ sung kiểm tra `$type` / Xoá histogram giả cho cột boolean / `modules/datasets`
- **v0.1.0** / 2026-11-XX / Tạo mô-đun, tách từ `datasets` / Lưới dữ liệu ảo là tầng riêng / `modules/data-view`

- **Định dạng:** `[Phiên bản] / [Ngày] / [Thay đổi gì] / [Lý do] / [Ảnh hưởng đến đâu]`
