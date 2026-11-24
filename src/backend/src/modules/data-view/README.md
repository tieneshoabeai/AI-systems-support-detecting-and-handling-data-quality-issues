# Module `data-view` — Lưới Ảo (Virtual Grid)

Lớp đọc chuyên cho bảng dữ liệu lớn: phân trang keyset, truy vấn lọc/sắp xếp/tìm kiếm, thống kê cột, dữ liệu biểu đồ. Chỉ đọc, không sở hữu collection nào — mọi bản ghi đều đọc qua `RECORD_QUERY_PORT` của module `datasets`. Dạng phẳng 7 tệp + 1 schema, không CQRS.

## 1. Vị trí và vai trò

- Đường dẫn: `src/backend/src/modules/data-view/`
- Loại kiến trúc: phẳng/service-based (controller + service + utils + types + schema).
- Không sở hữu collection; đọc `dataset_records` qua `datasets`.
- Dùng bởi: frontend Virtual Grid, trang charts, `analysis` không dùng module này.

## 2. Từng tệp làm gì (7 tệp + index)

| Tệp | Vai trò chi tiết |
|---|---|
| `data-view.controller.ts` | `@Controller('datasets/:datasetId')`, 4 route. Kiểm tra `DatasetPolicyLoader` + `can(Read, Dataset)` trước khi gọi service. |
| `data-view.service.ts` | `getRecords` (keyset), `queryRecords` (lọc/sắp xếp/tìm kiếm), `getColumnStats`, `getChartData`. Giới hạn `MAX_CHART_SAMPLE_ROWS`, `MAX_CHART_COLUMNS`. Không ghi DB. |
| `data-view.utils.ts` | `resolveColumnKey` (chấp nhận cả tên hiển thị lẫn `c{i}` rồi đổi về `c{i}`), `decodeRowCursor`, `toSnakeStats`, `validationError`, `isObjectIdHex`. |
| `data-view.types.ts` | `GetRecordsInput`, `QueryRecordsBodyInput`, `RecordFilterOperator` (=, !=, >, <, contains...), `DEFAULT_RECORD_LIMIT`, `MAX_RECORD_LIMIT`, `propsPath` (`props.cN`), `RecordQuery`. |
| `data-view.chart.schema.ts` | Schema Zod cho phản hồi biểu đồ (`ChartDataResultSchema`...), dùng sinh OpenAPI Swagger (BE-07). |
| `data-view.module.ts` | Khai báo controller + service, import `DatasetsModule` để lấy `RECORD_QUERY_PORT`. |
| `index.ts` | Public contract: service, hằng, kiểu, schema biểu đồ, tiện ích biểu đồ dùng chung. |

## 3. Route đầy đủ (`@Controller('datasets/:datasetId')`)

| Phương thức | Đường dẫn đầy đủ | Bảo vệ | Mô tả |
|---|---|---|---|
| GET | `/api/v1/datasets/:datasetId/records` | JWT + DatasetPolicyLoader | Keyset pagination cho Virtual Grid, trả `{ items, meta: { nextCursor, hasMore } }`; `limit` 1–500, mặc định 50 (F5.1). |
| POST | `/api/v1/datasets/:datasetId/records/query` | JWT + DatasetPolicyLoader | Lọc/sắp xếp/tìm kiếm trên `props.cN` + keyset (F5.4). |
| GET | `/api/v1/datasets/:datasetId/columns/:columnKey/stats` | JWT + DatasetPolicyLoader | Thống kê cột theo khóa ổn định `c{i}` (chấp nhận cả tên hiển thị) (F5.3). |
| GET | `/api/v1/datasets/:datasetId/charts` | JWT + DatasetPolicyLoader | Histogram, box plot, Top N cho các cột (GĐ6/E1). |

## 4. Cách phân trang và lọc

- Keyset cursor base64url, không dùng `skip` để tránh quét O(n):
  - không sort: cursor `{ row_index }`;
  - có sort: cursor mang chữ ký sort, giá trị sort đã ép kiểu của dòng cuối và `row_index` để phá thế hoà (`shared/domain/pagination/record-keyset-cursor.ts`);
  - cursor hỏng hoặc sinh từ sort khác → `VALIDATION_ERROR` ở cả `GET records` lẫn `POST records/query`.
- Mọi lọc/sắp xếp đều đẩy xuống Mongo qua `props.cN`, dùng index `(dataset_id, row_index)`. Khi sort, giá trị null (hoặc không ép được kiểu) luôn xếp **cuối**, với mọi kiểu cột.
- `resolveColumnKeyPure`: tên hiển thị -> `c{i}` trước khi truy vấn, nên đổi tên cột không vỡ API. Nhiều bộ lọc trên cùng một cột (gửi bằng `c{i}` hoặc tên hiển thị) được gom OR theo `c{i}`.
- `value` của bộ lọc chỉ nhận chuỗi, số hữu hạn, boolean hoặc mảng các giá trị đó. Object như `{ "$regex": … }` bị chặn ở Zod và chặn lần nữa ở repository (chống NoSQL operator injection).
- `getColumnStats` tính `$min/$max/$avg` trong `$group` (không kéo giá trị về Node); chỉ tính thống kê số cho cột `number`; cột hằng số trả 1 bucket.
- Biểu đồ chỉ tổng hợp (đếm, bin, box), không trả dữ liệu thô chứa PII; giới hạn số dòng mẫu và số cột; `missing_count` dùng cùng quy tắc "trống" với bộ lọc (null, thiếu, chuỗi toàn khoảng trắng).

## 5. Bất biến

- Không ghi dữ liệu; service không import Mongoose model trực tiếp.
- Lỗi hạ tầng không lộ stack, trả lỗi domain chuẩn.
- Charts giới hạn `MAX_CHART_SAMPLE_ROWS` / `MAX_CHART_COLUMNS`.
- Mỗi trang không vượt quá `MAX_RECORD_LIMIT` (500) dòng.
- `in` với danh sách rỗng luôn khớp 0 dòng, kể cả khi gọi thẳng qua `RECORD_QUERY_PORT`.
- Hợp đồng chi tiết: Phần 7 v13 mục 3.23 (DV-1…DV-17) và v15 mục 3.25 (VA-3); kế hoạch: `docs/modules/data_view_plan.md`.

## 6. Test liên quan

`test/unit/datasets/data-view*.spec.ts`, `chart-data.spec.ts`, `chart-swagger-schema.spec.ts`, `test/unit/shared/record-keyset-cursor.spec.ts`, `test/e2e/dataset-dataview.e2e-spec.ts`, `test/integration/record-query.spec.ts`.
