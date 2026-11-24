/**
 * DATA-VIEW — Schema Zod cho phản hồi biểu đồ (BE-07).
 *
 * ## Vì sao cần file này?
 *
 * `ChartDataResult` trong `data-view.types.ts` là **type** — chỉ mô tả cho
 * TypeScript, **không** xuất hiện trong Swagger/OpenAPI. Frontend đọc
 * `/api/v1/docs-json` để sinh type ⇒ không có schema thì phải tự đoán shape
 * (đây chính là nguồn gốc của BE-07 trong báo cáo QA 24/11).
 *
 * File này khai báo **schema Zod** song song với interface, và
 * `zodToOpenApiSchema()` chuyển nó thành OpenAPI 3.0 để gắn vào `@ApiResponse`.
 *
 * ## Ràng buộc bất biến (quan trọng)
 *
 * Schema Zod **phải** suy ra đúng kiểu `ChartDataResult`. Mối ràng buộc này
 * được khoá bằng test `test/unit/datasets/chart-swagger-schema.spec.ts`
 * (so sánh hai chiều `z.infer` ↔ interface) — nếu ai đó sửa interface mà
 * quên sửa schema, hoặc ngược lại, test sẽ **fail** ⇒ không thể lệch âm thầm.
 *
 * ## Quy tắc tính toán (nhắc lại để frontend dựng đúng biểu đồ)
 *
 * | Trường | Cách tính |
 * |---|---|
 * | `total_records` | Tổng số dòng **toàn bộ** dataset (không giới hạn). |
 * | `sampled_records` | Số dòng **thực sự đọc** (bị giới hạn bởi `max_rows`). |
 * | `truncated` | `true` khi `total_records > sampled_records` ⇒ số liệu tính trên **mẫu**. |
 * | `missing_count` | Số giá trị thiếu **trong mẫu** (`null`/`undefined`, hoặc không ép được sang kiểu cột). |
 * | `missing_ratio` | `missing_count / sampled_records` — **không** làm tròn. |
 * | `category.items[].rate` | `count / tổng số giá trị khác rỗng` — làm tròn **4 chữ số thập phân** (`r4`). |
 * | `category.other.rate` | Cùng công thức với `items[].rate`; `null` khi không còn giá trị nào ngoài Top N. |
 * | `category.distinct_count` | Số giá trị khác nhau (không tính rỗng). |
 *
 * Lưu ý `missing_ratio` (tỷ lệ thiếu) và `rate` (tỷ trọng giá trị) dùng **hai mẫu số khác nhau**:
 * `missing_ratio` chia cho *tổng số dòng đã đọc*, còn `rate` chia cho *số giá trị không thiếu*.
 */
import { z } from 'zod';

// ── Cột số: histogram ──────────────────────────────────────────────────────

export const ChartHistogramBinSchema = z.object({
  from: z.number().describe('Cận trái của bin (số thực).'),
  to: z.number().describe('Cận phải của bin (số thực).'),
  count: z.number().int().min(0).describe('Số giá trị rơi vào bin này.'),
});

export const ChartHistogramSchema = z.object({
  column_key: z.string().describe('Key ổn định của cột (vd "c3").'),
  column_name: z.string().describe('Tên hiển thị của cột.'),
  method: z
    .enum(['freedman_diaconis', 'sturges', 'single_value'])
    .describe(
      'Cách chọn số bin: `freedman_diaconis` (2·IQR·n^(-1/3)), ' +
        '`sturges` (ceil(log2 n)+1) khi IQR = 0, `single_value` khi cột chỉ có một giá trị.',
    ),
  bins: z
    .array(ChartHistogramBinSchema)
    .describe('Các bin đã sắp xếp tăng dần; tối đa 50 bin.'),
});

// ── Cột số: box plot ───────────────────────────────────────────────────────

export const ChartBoxPlotSchema = z.object({
  column_key: z.string().describe('Key ổn định của cột (vd "c3").'),
  column_name: z.string().describe('Tên hiển thị của cột.'),
  q1: z.number().describe('Tứ phân vị 1 (nội suy type 7).'),
  median: z.number().describe('Trung vị (nội suy type 7).'),
  q3: z.number().describe('Tứ phân vị 3 (nội suy type 7).'),
  whisker_low: z.number().describe('Râu dưới: giá trị nhỏ nhất còn nằm trong rào IQR 1,5×.'),
  whisker_high: z.number().describe('Râu trên: giá trị lớn nhất còn nằm trong rào IQR 1,5×.'),
  outside_count: z
    .number()
    .int()
    .min(0)
    .describe('Số giá trị nằm ngoài rào — **không** mặc định là lỗi dữ liệu.'),
  n: z.number().int().min(0).describe('Số quan sát số hữu ích đã dùng để tính.'),
});

// ── Cột chuỗi / boolean: Top N ─────────────────────────────────────────────

export const ChartCategoryItemSchema = z.object({
  value: z.string().describe('Giá trị của nhóm (đã chuẩn hoá sang chuỗi).'),
  count: z.number().int().min(0).describe('Số bản ghi thuộc nhóm này.'),
  rate: z
    .number()
    .min(0)
    .max(1)
    .describe('Tỷ trọng = count / (số giá trị không thiếu), làm tròn 4 chữ số thập phân.'),
});

export const ChartCategorySchema = z.object({
  column_key: z.string().describe('Key ổn định của cột (vd "c3").'),
  column_name: z.string().describe('Tên hiển thị của cột.'),
  top_n: z.number().int().min(1).max(20).describe('Số nhóm tối đa được trả về (theo `top_n` của request).'),
  items: z.array(ChartCategoryItemSchema).describe('Các nhóm phổ biến nhất, đã sắp xếp giảm dần theo count.'),
  other: z
    .object({
      count: z.number().int().min(0).describe('Số bản ghi còn lại ngoài Top N.'),
      rate: z.number().min(0).max(1).describe('Tỷ trọng của nhóm "còn lại".'),
    })
    .nullable()
    .describe('Nhóm "các giá trị còn lại" — `null` khi không có giá trị nào ngoài Top N.'),
  distinct_count: z.number().int().min(0).describe('Tổng số giá trị khác nhau (không tính rỗng).'),
  masked: z
    .boolean()
    .optional()
    .describe(
      '`true` khi cột bị đánh dấu PII ⇒ **không** trả giá trị thô; ' +
        'chỉ có `distinct_count` và thống kê thiếu. `items` sẽ là mảng rỗng.',
    ),
});

// ── Phần tử biểu đồ của một cột ───────────────────────────────────────────

export const ChartDataResultSchema = z.object({
  column_key: z.string().describe('Key ổn định của cột (vd "c3").'),
  column_name: z.string().describe('Tên hiển thị của cột.'),
  data_type: z
    .enum(['string', 'number', 'boolean', 'date'])
    .describe('Kiểu dữ liệu đã suy luận của cột.'),
  total_records: z.number().int().min(0).describe('Tổng số dòng toàn bộ dataset.'),
  sampled_records: z.number().int().min(0).describe('Số dòng thực sự đọc để tính (bị giới hạn bởi `max_rows`).'),
  truncated: z
    .boolean()
    .describe('`true` khi số liệu được tính trên **mẫu** chứ không phải toàn bộ dataset.'),
  missing_count: z.number().int().min(0).describe('Số giá trị thiếu trong mẫu đã đọc.'),
  missing_ratio: z.number().min(0).max(1).describe('`missing_count / sampled_records` (không làm tròn).'),
  histogram: ChartHistogramSchema.optional().describe('Chỉ có với cột `number`.'),
  box_plot: ChartBoxPlotSchema.optional().describe('Chỉ có với cột `number`.'),
  category: ChartCategorySchema.optional().describe('Chỉ có với cột `string` / `boolean`.'),
});

/** `data` của envelope — một phần tử cho mỗi cột được chọn. */
export const ChartDataPayloadSchema = z.object({
  charts: z.array(ChartDataResultSchema).describe('Một phần tử cho mỗi cột (không phải 3 mảng tách biệt).'),
});

/**
 * Envelope đầy đủ của phản hồi `GET /datasets/{datasetId}/charts`.
 *
 * Khớp với `TransformInterceptor` (`{ success: true, data }`).
 */
export const ChartDataEnvelopeSchema = z.object({
  success: z.literal(true).describe('Cờ thành công của envelope.'),
  data: ChartDataPayloadSchema,
});
