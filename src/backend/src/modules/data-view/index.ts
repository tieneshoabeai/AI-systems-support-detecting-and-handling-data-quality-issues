/** Public contract cua module DATA-VIEW (Template Simple). */
export { DataViewService, MAX_CHART_SAMPLE_ROWS, MAX_CHART_COLUMNS } from './data-view.service';
export type {
  GetRecordsInput,
  QueryRecordsBodyInput,
  ColumnStatsResult,
  ChartDataResult,
  ChartHistogram,
  ChartHistogramBin,
  ChartBoxPlot,
  ChartCategory,
  ChartCategoryItem,
  RecordQueryProps,
  RecordFilterOperator,
} from './data-view.types';
export {
  DEFAULT_RECORD_LIMIT,
  MAX_RECORD_LIMIT,
  normalizeRecordLimit,
  RECORD_FILTER_OPERATORS,
  isValidOperator,
  propsPath,
  resolveColumnKeyPure,
  RecordQuery,
} from './data-view.types';
export {
  validationError,
  isObjectIdHex,
  decodeRowCursor,
  toSnakeStats,
  resolveColumnKey,
} from './data-view.utils';
// BE-07 — Schema Zod của phản hồi biểu đồ (sinh OpenAPI cho Swagger).
export {
  ChartBoxPlotSchema,
  ChartCategoryItemSchema,
  ChartCategorySchema,
  ChartDataEnvelopeSchema,
  ChartDataPayloadSchema,
  ChartDataResultSchema,
  ChartHistogramBinSchema,
  ChartHistogramSchema,
} from './data-view.chart.schema';
export {
  DEFAULT_CHART_TOP_N,
  MAX_HISTOGRAM_BINS,
  boxPlot,
  categoryTopN,
  clampChartTopN,
  histogram,
  type CategoryChart,
  type ChartData,
  type Histogram,
  type HistogramBin,
  type BoxPlot,
} from '../../shared/domain/utils/chart-data.util';
