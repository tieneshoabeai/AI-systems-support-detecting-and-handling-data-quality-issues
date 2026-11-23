# MÔ-ĐUN `datasets` — Tiếp nhận & Lưu trữ dữ liệu

> **Đặc tả mô-đun & Tài liệu kỹ thuật**

## 1. Thông tin phiên bản

- **Phiên bản hiện tại:** v1.1.0
- **Cập nhật lần cuối:** 2026-11-21
- **Đường dẫn mô-đun:** `src/backend/src/modules/datasets` (33 tệp TypeScript)
- **Tầng kiến trúc:** Clean Architecture 4 tầng (`domain` → `application` → `infrastructure` → `presentation`)
- **Quy tắc tầng:** CA1–CA14 — xem [`../README.md`](../README.md)

## 2. Mục đích & Phạm vi nghiệp vụ

Mô-đun chịu trách nhiệm **nhập dữ liệu CSV** và lưu trữ bất biến. Đây là nơi quyết định chất lượng dữ liệu đầu vào cho toàn hệ thống.

> **Nguyên tắc bất di bất dịch:** dữ liệu dataset là **INSERT-ONLY**. Chỉ ghi một lần lúc nhập. Không có `deleted_at`, không có `version_number`, không cập nhật, không xoá từng dòng.

### 2.1. Tính năng thuộc phạm vi

| Chức năng | Nội dung |
|---|---|
| Nhập CSV | Streaming, phát hiện dấu phân cách, suy luận schema, ghi bản ghi theo lô |
| Schema & cột | Suy luận kiểu dữ liệu, đếm giá trị thiếu, đánh dấu cột PII |
| Phát hiện vấn đề | Phát hiện vấn đề ở mức dataset (cột) và mức dòng |
| Truy vấn | Đọc bản ghi, schema, tải tệp gốc |
| Xoá | Xoá mềm dataset + xoá tệp trên R2 |
| Cascade | Xoá dataset khi project bị xoá |

### 2.2. Cấu trúc thư mục

```text
datasets/
|-- domain/
|   |-- entities/dataset.entity.ts
|   |-- value-objects/
|   |   |-- column-type.vo.ts        # string | number | boolean | date
|   |   |-- dataset-limits.vo.ts     # giới hạn & quy tắc nhập
|   |   `-- value-coercion.vo.ts     # chuẩn hoá giá trị theo kiểu cột
|   |-- events/dataset-events.ts
|   |-- ports/
|   |   |-- dataset.repository.port.ts
|   |   `-- record-query.port.ts
|   `-- services/
|       |-- csv-delimiter.util.ts    # nhận diện dấu phân cách
|       |-- finding.util.ts          # chuẩn hoá finding
|       `-- pii-heuristic.util.ts    # suy luận cột PII
|-- application/
|   |-- commands/
|   |   |-- ingest-dataset-stream.handler.ts   # handler nhập CSV
|   |   |-- delete-dataset.handler.ts
|   |   |-- cascade-project-datasets.handler.ts
|   |   |-- cascade-dataset-event.subscriber.ts
|   |   `-- map-props-to-original-names.handler.ts
|   |-- queries/                     # 4 query handler
|   |-- services/
|   |   |-- schema-inference.service.ts
|   |   `-- dataset-finding.service.ts
|   `-- policy-loaders/dataset-policy.loader.ts
|-- infrastructure/persistence/
|   |-- dataset.schema.ts            # metadata + columns + findings
|   |-- dataset-record.schema.ts     # dòng dữ liệu (INSERT-ONLY)
|   |-- datasets.repository.ts
|   |-- record-query.repository.ts   # phân trang keyset + aggregation
|   `-- dataset.mapper.ts
`-- presentation/
    |-- controllers/datasets.controller.ts
    `-- responses/dataset.response.ts
```

## 3. Nhật ký Prompting & Quyết định kỹ thuật

- **Yêu cầu người dùng / Ý đồ nghiệp vụ:** Nhập dữ liệu CSV **một lần, không sửa, không xoá** và làm cho mọi thứ ở hạ nguồn đều có thể tin vào tuyến dữ liệu gốc. Đồng thời tự động phát hiện vấn đề chất lượng dữ liệu ngay khi nhập, thay vì để người dùng phải đối chiếu thủ công.

- **Lập luận kỹ thuật & Quyết định:**

1. **Streaming, không nạp toàn bộ tệp vào RAM.** Tệp 500 MB nạp vào RAM sẽ gây OOM. Streaming giữ mức tiêu thụ ổn định khoảng 20 MB bất kể tệp lớn bao nhiêu. Đây là cam kết hiệu năng có bằng chứng.

2. **Chèn hàng loạt theo lô (`IMPORT_BATCH_SIZE = 5000`).** Một lệnh chèn cho 5.000 dòng nhanh hơn 5.000 lệnh chèn đơn. Kích thước lô cân bằng giữa hiệu năng và áp lực bộ nhớ.

3. **Khoá cột bất biến `c0`, `c1`, ... `cN`.** Khoá này **không bao giờ đổi**, kể cả khi người dùng đổi tên cột. Giá trị trong `dataset_record.props` lưu theo khoá này. `map-props-to-original-names.handler.ts` chuyển đổi props theo tên gốc khi xuất báo cáo, để người đọc thấy đúng tên cột trong tệp CSV gốc.

4. **Nhận diện dấu phân cách thay vì giả định `,`.** Tệp CSV thực tế hay dùng `;` (châu Âu) hoặc `\t` (TSV). `csv-delimiter.util.ts` đếm số lần xuất hiện của mỗi dấu ứng viên **ngoài** dấu nháy kép, chọn dấu nhất quán nhất giữa các dòng. Dấu phân cách lưu vào `dataset.delimiter` và dùng lại khi tải tệp gốc.

5. **Suy luận PII từ tên cột + mẫu giá trị.** Cột chứa PII được đánh dấu `is_pii: true` — frontend che giá trị mặc định, và `pii-mask.util.ts` của mô-đun `analysis` che PII trước khi gửi cho AI.

6. **Chỉ lấy `SAMPLE_ROWS_CAP = 500` dòng để suy luận schema.** Đọc cả tệp để suy luận kiểu dữ liệu là dư thừa; 500 dòng vừa đủ chính xác vừa nhanh.

7. **Finding chuẩn hoá qua `finding.util.ts`.** Cùng một loại finding luôn có cùng hình dạng — quan trọng cho giao diện và cho AI đọc.

8. **Ghi metadata dataset trong transaction trước, ghi bản ghi sau.** Nếu ghi bản ghi thất bại, metadata còn lại có thể dọn bằng xoá mềm dataset, chỉ tồn tại một bản ghi rác tạm thời.

- **Hiện vật đã tạo / đã sửa:**

- `domain/value-objects/dataset-limits.vo.ts` — `MAX_FILE_BYTES` (50 MB), `MAX_COLUMNS` (1000), `IMPORT_BATCH_SIZE` (5000), `SAMPLE_ROWS_CAP` (500), `assertCsvFile`, `assertFileSize`, `assertColumnLimit`, `storageKeyForDataset`.
- `domain/services/csv-delimiter.util.ts` — nhận diện dấu phân cách.
- `domain/services/pii-heuristic.util.ts` — suy luận cột PII từ tên + mẫu giá trị.
- `domain/value-objects/value-coercion.vo.ts` — chuẩn hoá giá trị theo kiểu cột.
- `application/services/schema-inference.service.ts` — suy luận kiểu cột, đếm thiếu, suy luận PII.
- `application/commands/ingest-dataset-stream.handler.ts` — luồng nhập chính.
- `infrastructure/persistence/record-query.repository.ts` — phân trang keyset + aggregation (2 giai đoạn, sắp xếp null).

## 4. Đặc tả giao tiếp kỹ thuật

### 4.1. Điểm cuối (Endpoints)

| Phương thức | Đường dẫn | Chính sách | Mô tả |
|---|---|---|---|
| `POST` | `/api/v1/projects/:projectId/datasets/upload` | `Action.Create` | Tải lên CSV (multipart) |
| `GET` | `/api/v1/projects/:projectId/datasets` | `Action.Read` | Danh sách dataset của project |
| `GET` | `/api/v1/datasets/:id` | `Action.Read` | Chi tiết dataset |
| `DELETE` | `/api/v1/datasets/:id` | `Action.Delete` | Xoá mềm dataset + tệp |
| `GET` | `/api/v1/datasets/:id/file` | `Action.Read` | Tải tệp CSV gốc |
| `GET` | `/api/v1/datasets/:id/schema` | `Action.Read` | Schema & thống kê cột |

> **Không có route cập nhật cột.** Dataset là **bất biến** sau khi nạp: không có `PATCH /datasets/:id`, `PATCH /datasets/:id/columns`, `POST /datasets/:id/columns/reset` hay `PATCH /datasets/:id/columns/pii`. Cờ PII được **tự suy** từ tên cột bởi `pii-heuristic.util.ts` (không bật/tắt tay).

> **Xoá dataset — route duy nhất là `DELETE /datasets/:id`.**
> Không tồn tại `DELETE /projects/:projectId/datasets`. Lý do: xoá dataset sẽ **gỡ cờ `hasDataset` của project** và **trừ dung lượng đã dùng của workspace** (cả hai trong cùng một transaction — OPEN-09), nên đặt route ở gốc hợp lý hơn.
>
> Luồng gọi phía frontend:
> 1. `GET /api/v1/projects/:projectId/datasets` → lấy `dataset.id`
> 2. `DELETE /api/v1/datasets/:id` → xoá mềm dataset + giải phóng dung lượng

### 4.2. Giao diện / Provider được xuất ra ngoài

`src/backend/src/modules/datasets/index.ts` xuất hợp đồng công khai:

| Tên xuất | Vai trò |
|---|---|
| `DatasetsModule` | Mô-đun Nest |
| Thực thể `Dataset`, `ColumnDefinition` | Hợp đồng domain |
| `DATASET_REPOSITORY_PORT` | Cổng truy vấn metadata dataset |
| `RECORD_QUERY_PORT` | Cổng truy vấn bản ghi (keyset + aggregation) |

### 4.3. Sự kiện domain phát ra

| Sự kiện | Khi nào | Mục đích |
|---|---|---|
| `dataset.created` | Nhập thành công | Thông báo + audit log |
| `dataset.imported` | Hoàn tất ghi bản ghi | Thông báo + audit log |
| `DATASET_DELETED` | Xoá dataset | Kích hoạt xoá tệp và cascade |

## 5. Ràng buộc & Tiêu chuẩn bất biến

### 5.1. Bất biến nghiệp vụ

- Chỉ chấp nhận đuôi `.csv` (`assertCsvFile`).
- Tệp vượt `MAX_FILE_BYTES` (50 MB) bị từ chối **trước** khi đọc bất kỳ byte nào.
- Số cột vượt `MAX_COLUMNS` (1000) bị từ chối.
- **Không bao giờ** `update` hoặc `delete` một `dataset_record` — collection này là INSERT-ONLY.
- Mỗi dòng gốc có **đúng một** bản ghi: unique index `{ dataset_id: 1, row_index: 1 }`.
- Khoá cột bất biến `c{i}` không đổi theo thời gian, kể cả khi đổi tên cột.
- `row_count` và `column_count` phải khớp với số dòng / số cột thực tế sau khi nhập.
- Khoá lưu trữ luôn theo mẫu `raw_files/{datasetId}.csv`.

### 5.2. Xoá mềm (Soft Delete)

- **Chuẩn:** `deleted_at: Date | null` — trường này **null** nghĩa là bản ghi đang hoạt động.
- **Quy tắc truy vấn:** mọi truy vấn mặc định luôn lọc `deleted_at: null`. Repository nền (`shared/infrastructure/database/base-mongo.repository.ts`) áp dụng điều này tự động.
- **Chơi index Partial Unique:** `partialFilterExpression: { deleted_at: null }` — cho phép tài khoản / tên / email đã xoá mềm được tạo lại.

### 5.3. Bảo mật

| Vấn đề | Cách xử lý |
|---|---|
| Tệp không phải CSV | `assertCsvFile` — chỉ chấp nhận `.csv` |
| Tệp quá lớn gây OOM | `assertFileSize` + streaming + `ANALYSIS_MAX_ROWS` |
| Đọc tệp của dataset người khác | Policy loader nạp instance + kiểm tra `projectId` |
| Lộ PII | Đánh dấu `is_pii`, che giá trị mặc định, che trước khi gửi AI |
| Truy cập trực tiếp tệp gốc | Chỉ qua route có policy, không lộ tệp trực tiếp ra bucket công khai |
| Xoá tệp gốc còn sót | Cascade xoá tệp trong transaction |

### 5.4. Phân quyền

| Tuyến đường | Chính sách |
|---|---|
| `POST /projects/:projectId/datasets/upload` | `Action.Create` trên `Dataset` |
| `GET /projects/:projectId/datasets` | `Action.Read` |
| `GET /datasets/:id`, `/file`, `/schema` | `Action.Read` + policy loader kiểm tra instance |
| `DELETE /datasets/:id` | `Action.Delete` |

> Dataset **không** có vai trò riêng. Quyền trên dataset suy ra từ quyền trên project chứa nó (qua `projectId`).
> Dataset bất biến sau khi nạp → không có route cập nhật metadata cột (chỉ đọc + xoá mềm + tải tệp).

## 6. Lịch sử thay đổi

### 2026-11-21
- **v1.1.0** / 2026-11-21 / Viết lại README mô-đun đầy đủ theo chuẩn 6 phần / Yêu cầu tái đọc / Tài liệu mẫu chuẩn

### 2026-11-XX
- **v1.0.0** / 2026-11-XX / Bổ sung `csv-delimiter.util.ts` nhận diện `;` và `\t` / CSV thực tế không phải luôn dùng dấu phẩy / `modules/datasets`
- **v0.9.5** / 2026-11-XX / Bổ sung `pii-heuristic.util.ts` tự suy cột PII từ tên cột / Route `PATCH /datasets/:id/columns/pii` bị gỡ (OPEN-03/04) / `modules/datasets`
- **v0.9.0** / 2026-11-XX / Bổ sung `dataset-finding.service.ts` sinh finding mức cột và mức dòng / Tự động phát hiện vấn đề ngay khi nhập / `modules/datasets`
- **v0.8.0** / 2026-11-XX / Chuyển sang nhập streaming + chèn hàng loạt theo lô 5000 dòng / Giữ mức tiêu thụ RAM khoảng 20 MB / `modules/datasets`
- **v0.7.0** / 2026-11-XX / Bổ sung cascade xoá dataset khi project bị xoá, bọc transaction / Bảo đảm nhất quán / `modules/datasets`, `modules/projects`
- **v0.1.0** / 2026-11-XX / Tạo mô-đun, bỏ các lệnh đổi tên cột / Làm dataset hoàn toàn chỉ đọc / `modules/datasets`

- **Định dạng:** `[Phiên bản] / [Ngày] / [Thay đổi gì] / [Lý do] / [Ảnh hưởng đến đâu]`
