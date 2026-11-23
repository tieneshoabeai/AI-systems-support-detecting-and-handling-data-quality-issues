/**
 * GetChartDataHandler — Use case: `getChartData()` (chỉ đọc) — GĐ6 / E1.
 *
 * Cung cấp **số liệu** cho biểu đồ (mục 3.21 của feature catalog):
 *  - Cột **số** → histogram (Freedman–Diaconis / Sturges) + box plot (IQR 1.5).
 *  - Cột **phân loại / văn bản** → biểu đồ cột Top N (mặc định 5, 1–20).
 *  - Tỷ lệ thiếu của mọi cột.
 *
 * Vì sao không dùng `listAllRecords()`: hàm đó tải toàn bộ bản ghi kèm mọi cột
 * → peak-RAM rất lớn với dataset lớn (xem GĐ0). Ở đây dùng
 * `RECORD_QUERY_PORT.getColumnValues()` — chỉ đọc **một** cột, có `limit`.
 *
 * Quy tắc nghiệp vụ đã chốt (mục 3.21):
 *  - N mặc định 5, người dùng nhập số nguyên dương 1–20.
 *  - Phần còn lại ngoài Top N gộp vào nhóm "Khác" — **không** thay đổi dữ liệu gốc.
 *  - Điểm ngoài rào box plot chỉ là "có thể bất thường", **không** mặc định là lỗi.
 *  - Dữ liệu thiếu không được tự điền 0 — báo riêng số thiếu và tỷ lệ thiếu.
 */
import { Inject, Injectable } from '@nestjs/common';
import {
  DATASET_REPOSITORY_PORT,
  type DatasetRepositoryPort,
} from '../../../datasets';
import {
  RECORD_QUERY_PORT,
  type RecordQueryPort,
} from '../../../datasets';
import {
  boxPlot,
  categoryTopN,
  clampChartTopN,
  histogram,
} from '../../../../shared/domain/utils/chart-data.util';
import type { ChartDataResult } from '../data-view.types';
import { isObjectIdHex } from '../data-view.utils';
import { NotFoundError, ValidationError } from '../../../../shared/domain/errors';

/** Số bản ghi tối đa đọc cho mỗi cột khi dựng biểu đồ. */
export const MAX_CHART_SAMPLE_ROWS = 50_000;

/** Số cột tối đa trả về trong một lần gọi (bảo vệ response khổng lồ). */
export const MAX_CHART_COLUMNS = 50;

@Injectable()
export class GetChartDataHandler {
  constructor(
    @Inject(DATASET_REPOSITORY_PORT)
    private readonly datasets: DatasetRepositoryPort,
    @Inject(RECORD_QUERY_PORT)
    private readonly records: RecordQueryPort,
  ) {}

  async execute(
    datasetId: string,
    input: { columns?: string[]; topN?: number; maxRows?: number } = {},
  ): Promise<ChartDataResult[]> {
    if (!isObjectIdHex(datasetId)) {
      throw new ValidationError('ID Tap du lieu khong hop le');
    }
    const dataset = await this.datasets.findById(datasetId);
    if (!dataset) {
      throw new NotFoundError(`Khong tim thay tap du lieu ${datasetId}`);
    }

    const topN = clampChartTopN(input.topN);
    const maxRows =
      Number.isFinite(input.maxRows) && (input.maxRows as number) > 0
        ? Math.min(Math.floor(input.maxRows as number), MAX_CHART_SAMPLE_ROWS)
        : MAX_CHART_SAMPLE_ROWS;

    // ── Chọn cột cần vẽ ─────────────────────────────────────────────────
    const requested = input.columns;
    let selected = dataset.columns;
    if (requested && requested.length > 0) {
      const wanted = new Set(requested.map((c) => c.trim()).filter((c) => c.length > 0));
      selected = dataset.columns.filter(
        (c) => wanted.has(c.key) || wanted.has(c.name) || wanted.has(c.originalName),
      );
      if (selected.length === 0) {
        throw new NotFoundError(
          `Khong tim thay cot nao trong dataset ${datasetId}: ${[...wanted].join(', ')}`,
        );
      }
    }
    if (selected.length > MAX_CHART_COLUMNS) {
      selected = selected.slice(0, MAX_CHART_COLUMNS);
    }

    // ── Dựng số liệu từng cột ──────────────────────────────────────────
    const results: ChartDataResult[] = [];
    for (const col of selected) {
      const { values, totalRecords, sampledRecords, truncated } = await this.records.getColumnValues(
        datasetId,
        col.key,
        col.dataType,
        maxRows,
      );

      const missingCount = values.filter((v) => v === null || v === undefined).length;
      const missingRatio = sampledRecords > 0 ? missingCount / sampledRecords : 0;

      const base: ChartDataResult = {
        column_key: col.key,
        column_name: col.name,
        data_type: col.dataType,
        total_records: totalRecords,
        sampled_records: sampledRecords,
        truncated,
        missing_count: missingCount,
        missing_ratio: missingRatio,
      };

      if (col.dataType === 'number') {
        const numeric = values.filter(
          (v): v is number => typeof v === 'number' && Number.isFinite(v),
        );
        const h = histogram(col.key, numeric);
        const bp = boxPlot(col.key, numeric);
        results.push({
          ...base,
          ...(h
            ? {
                histogram: {
                  column_key: col.key,
                  column_name: col.name,
                  method: h.method,
                  bins: h.bins,
                },
              }
            : {}),
          ...(bp
            ? {
                box_plot: {
                  column_key: col.key,
                  column_name: col.name,
                  q1: bp.q1,
                  median: bp.median,
                  q3: bp.q3,
                  whisker_low: bp.whiskerLow,
                  whisker_high: bp.whiskerHigh,
                  outside_count: bp.outsideCount,
                  n: bp.n,
                },
              }
            : {}),
        });
        continue;
      }

      if (col.dataType === 'string' || col.dataType === 'boolean') {
        // PII: cột đánh dấu PII không trả giá trị thô — chỉ trả distinct_count
        // + missing để không rò rỉ qua GET /charts (đồng bộ với run-analysis
        // vốn loại cột PII khỏi charts.categories).
        if (col.isPii) {
          results.push({
            ...base,
            category: {
              column_key: col.key,
              column_name: col.name,
              top_n: topN,
              items: [],
              other: null,
              distinct_count: new Set(
                values
                  .filter((v) => v !== null && v !== undefined)
                  .map((v) => (typeof v === 'string' ? v : String(v)).trim())
                  .filter((v) => v.length > 0),
              ).size,
              masked: true,
            },
          });
          continue;
        }
        // Chuỗi rỗng / null = thiếu → không tính vào tần suất.
        const strings = values
          .filter((v) => v !== null && v !== undefined)
          .map((v) => (typeof v === 'string' ? v : String(v)))
          .filter((v) => v.trim().length > 0);
        const cat = categoryTopN(col.key, strings, topN);
        results.push({
          ...base,
          ...(cat
            ? {
                category: {
                  column_key: col.key,
                  column_name: col.name,
                  top_n: cat.topN,
                  items: cat.items.map((i) => ({
                    value: i.value,
                    count: i.count,
                    rate: i.rate,
                  })),
                  other: cat.other ? { count: cat.other.count, rate: cat.other.rate } : null,
                  distinct_count: cat.distinctCount,
                },
              }
            : {}),
        });
        continue;
      }

      // Cột `date`: chỉ báo tỷ lệ thiếu — biểu đồ thời gian cần cột thời gian
      // được chọn trong cấu hình phân tích (mục 3.15), chưa thuộc endpoint này.
      results.push(base);
    }

    return results;
  }
}
