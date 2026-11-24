/**
 * BE-07 — Schema Swagger của `GET /datasets/{datasetId}/charts`.
 *
 * ## Mục đích
 *
 * Frontend sinh type từ `/api/v1/docs-json`. Trước khi có file này, endpoint
 * `/charts` **không có** schema phản hồi trong OpenAPI ⇒ frontend phải tự
 * đoán shape (`histogram`? `box_plot`? `category`? có `masked` không?) — đó
 * chính là nguồn gốc của BE-07 trong báo cáo QA 24/11.
 *
 * ## Hai điều test này khoá
 *
 * 1. **Không lệch schema ↔ type.** Schema Zod trong `data-view.chart.schema.ts`
 *    phải suy ra **đúng** kiểu `ChartDataResult`. Nếu ai đó thêm/sửa một trường
 *    ở interface mà quên sửa schema (hoặc ngược lại), test fail ⇒ không thể
 *    lệch âm thầm. Đây là "hợp đồng" giữa mã nguồn và tài liệu.
 *
 * 2. **OpenAPI đầu ra đúng.** Schema phải chuyển được sang OpenAPI 3.0 hợp lệ
 *    (có `type`, `properties`, `required`) và giữ đủ các trường mà FE cần
 *    (`histogram.bins`, `box_plot`, `category`, `masked`, `sampled_records`,
 *    `truncated`).
 */
import { z } from 'zod';
import { zodToOpenApiSchema } from '../../../src/shared/interfaces/swagger/zod-openapi';
import {
  ChartBoxPlotSchema,
  ChartCategorySchema,
  ChartDataEnvelopeSchema,
  ChartDataPayloadSchema,
  ChartDataResultSchema,
  ChartHistogramSchema,
} from '../../../src/modules/data-view/data-view.chart.schema';
import type {
  ChartBoxPlot,
  ChartCategory,
  ChartDataResult,
  ChartHistogram,
} from '../../../src/modules/data-view/data-view.types';

describe('BE-07 — Schema Swagger của API biểu đồ', () => {
  describe('không lệch giữa schema Zod và interface TypeScript', () => {
    it('ChartDataResultSchema suy ra đúng kiểu ChartDataResult', () => {
      // Nếu schema có thêm/bớt trường so với interface ⇒ `z.infer` lệch ⇒
      // TypeScript báo lỗi ngay khi khai báo hàm này.
      const schema: z.ZodType<ChartDataResult> = ChartDataResultSchema;
      expect(schema).toBe(ChartDataResultSchema);
    });

    it('ChartHistogramSchema suy ra đúng kiểu ChartHistogram', () => {
      const schema: z.ZodType<ChartHistogram> = ChartHistogramSchema;
      expect(schema).toBe(ChartHistogramSchema);
    });

    it('ChartBoxPlotSchema suy ra đúng kiểu ChartBoxPlot', () => {
      const schema: z.ZodType<ChartBoxPlot> = ChartBoxPlotSchema;
      expect(schema).toBe(ChartBoxPlotSchema);
    });

    it('ChartCategorySchema suy ra đúng kiểu ChartCategory', () => {
      const schema: z.ZodType<ChartCategory> = ChartCategorySchema;
      expect(schema).toBe(ChartCategorySchema);
    });

    it('mọi trường của ChartDataResult đều có mặt trong schema', () => {
      const props = (
        zodToOpenApiSchema(ChartDataResultSchema) as {
          properties?: Record<string, unknown>;
        }
      ).properties ?? {};

      for (const field of [
        'column_key',
        'column_name',
        'data_type',
        'total_records',
        'sampled_records',
        'truncated',
        'missing_count',
        'missing_ratio',
        'histogram',
        'box_plot',
        'category',
      ]) {
        expect(Object.keys(props)).toContain(field);
      }
    });
  });

  describe('OpenAPI đầu ra', () => {
    it('ChartDataResultSchema → object có type/properties/required', () => {
      const open = zodToOpenApiSchema(ChartDataResultSchema) as {
        type?: string;
        properties?: Record<string, unknown>;
        required?: string[];
      };

      expect(open.type).toBe('object');
      expect(open.properties).toBeDefined();
      expect(open.required).toBeDefined();
    });

    it('các trường bắt buộc đúng theo hợp đồng', () => {
      const open = zodToOpenApiSchema(ChartDataResultSchema) as { required?: string[] };
      const required = open.required ?? [];

      for (const field of [
        'column_key',
        'column_name',
        'data_type',
        'total_records',
        'sampled_records',
        'truncated',
        'missing_count',
        'missing_ratio',
      ]) {
        expect(required).toContain(field);
      }
      // `histogram` / `box_plot` / `category` là tuỳ chọn theo kiểu cột.
      expect(required).not.toContain('histogram');
      expect(required).not.toContain('box_plot');
      expect(required).not.toContain('category');
    });

    it('histogram.bins là mảng object có from/to/count', () => {
      const open = zodToOpenApiSchema(ChartHistogramSchema) as {
        properties?: {
          bins?: {
            type?: string;
            items?: { properties?: Record<string, unknown>; required?: string[] };
          };
        };
      };
      const bins = open.properties?.bins;

      expect(bins?.type).toBe('array');
      expect(bins?.items?.properties).toBeDefined();
      expect(Object.keys(bins?.items?.properties ?? {})).toEqual(
        expect.arrayContaining(['from', 'to', 'count']),
      );
      expect(bins?.items?.required).toEqual(expect.arrayContaining(['from', 'to', 'count']));
    });

    it('box_plot có đủ q1/median/q3/whisker_low/whisker_high/outside_count/n', () => {
      const open = zodToOpenApiSchema(ChartBoxPlotSchema) as {
        properties?: Record<string, unknown>;
        required?: string[];
      };

      expect(Object.keys(open.properties ?? {})).toEqual(
        expect.arrayContaining([
          'q1',
          'median',
          'q3',
          'whisker_low',
          'whisker_high',
          'outside_count',
          'n',
        ]),
      );
    });

    it('category.other là nullable (có thể null) và category.masked là boolean tuỳ chọn', () => {
      const open = zodToOpenApiSchema(ChartCategorySchema) as {
        properties?: {
          other?: { nullable?: boolean; type?: string };
          masked?: { type?: string };
        };
        required?: string[];
      };

      expect(open.properties?.other?.nullable).toBe(true);
      expect(open.properties?.masked?.type).toBe('boolean');
      // `masked` chỉ xuất hiện ở cột PII ⇒ không bắt buộc.
      expect(open.required).not.toContain('masked');
    });

    it('envelope có `success` + `data.charts`', () => {
      const open = zodToOpenApiSchema(ChartDataEnvelopeSchema) as {
        type?: string;
        properties?: {
          success?: { type?: string; enum?: boolean[] };
          data?: { properties?: Record<string, unknown>; required?: string[] };
        };
        required?: string[];
      };

      expect(open.type).toBe('object');
      expect(open.properties?.success?.enum).toEqual([true]);
      expect(open.required).toEqual(expect.arrayContaining(['success', 'data']));
      expect(open.properties?.data?.properties?.charts).toBeDefined();
      expect(open.properties?.data?.required).toEqual(expect.arrayContaining(['charts']));
    });

    it('payload chỉ có đúng một mảng `charts` (không phải 3 mảng tách biệt)', () => {
      const open = zodToOpenApiSchema(ChartDataPayloadSchema) as {
        properties?: Record<string, unknown>;
        required?: string[];
      };

      expect(Object.keys(open.properties ?? {})).toEqual(['charts']);
      expect(open.required).toEqual(['charts']);
    });
  });

  describe('schema phải khớp dữ liệu thật mà service trả về', () => {
    it('parse được payload của cột số (histogram + box_plot)', () => {
      const payload = {
        charts: [
          {
            column_key: 'c0',
            column_name: 'amount',
            data_type: 'number' as const,
            total_records: 78,
            sampled_records: 78,
            truncated: false,
            missing_count: 0,
            missing_ratio: 0,
            histogram: {
              column_key: 'c0',
              column_name: 'amount',
              method: 'freedman_diaconis' as const,
              bins: [{ from: 10, to: 15, count: 12 }],
            },
            box_plot: {
              column_key: 'c0',
              column_name: 'amount',
              q1: 13.25,
              median: 17,
              q3: 21,
              whisker_low: 10,
              whisker_high: 25,
              outside_count: 1,
              n: 78,
            },
          },
        ],
      };

      expect(ChartDataPayloadSchema.parse(payload)).toEqual(payload);
    });

    it('parse được payload của cột chuỗi (category) và cột PII (masked)', () => {
      const payload = {
        charts: [
          {
            column_key: 'c1',
            column_name: 'nhom',
            data_type: 'string' as const,
            total_records: 78,
            sampled_records: 78,
            truncated: false,
            missing_count: 0,
            missing_ratio: 0,
            category: {
              column_key: 'c1',
              column_name: 'nhom',
              top_n: 5,
              items: [{ value: 'A', count: 13, rate: 0.1667 }],
              other: { count: 13, rate: 0.1667 },
              distinct_count: 6,
            },
          },
          {
            column_key: 'c2',
            column_name: 'email',
            data_type: 'string' as const,
            total_records: 78,
            sampled_records: 78,
            truncated: false,
            missing_count: 0,
            missing_ratio: 0,
            category: {
              column_key: 'c2',
              column_name: 'email',
              top_n: 5,
              items: [],
              other: null,
              distinct_count: 40,
              masked: true,
            },
          },
        ],
      };

      expect(ChartDataPayloadSchema.parse(payload)).toEqual(payload);
    });

    it('parse được payload của cột date (chỉ có trường chung)', () => {
      const payload = {
        charts: [
          {
            column_key: 'c3',
            column_name: 'created_at',
            data_type: 'date' as const,
            total_records: 78,
            sampled_records: 50,
            truncated: true,
            missing_count: 2,
            missing_ratio: 0.04,
          },
        ],
      };

      expect(ChartDataPayloadSchema.parse(payload)).toEqual(payload);
    });

    it('từ chối payload thiếu trường bắt buộc', () => {
      const bad = {
        charts: [
          {
            column_key: 'c0',
            column_name: 'amount',
            data_type: 'number',
            total_records: 78,
            sampled_records: 78,
            truncated: false,
            missing_count: 0,
            // thiếu `missing_ratio`
          },
        ],
      };

      expect(() => ChartDataPayloadSchema.parse(bad)).toThrow();
    });
  });
});
