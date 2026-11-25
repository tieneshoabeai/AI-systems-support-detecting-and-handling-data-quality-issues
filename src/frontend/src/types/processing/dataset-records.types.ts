export type DatasetRow = {
  rowIndex: number
  props: Record<string, unknown>
}

export type RecordPage = {
  items: DatasetRow[]
  meta: { hasMore: boolean; nextCursor: string | null }
}

export type DatasetColumn = { key: string; name: string; dataType: string; originalName?: string; isPii?: boolean }
export type DatasetPreview = { columns: DatasetColumn[]; page: RecordPage }
export type HistogramBucket = { bucket_start: number; bucket_end: number; count: number }
export type ColumnBoxPlot = {
  q1: number; median: number; q3: number; whiskerLow: number; whiskerHigh: number; outsideCount: number; n: number
}
export type CategoryFrequency = { count: number; rate: number }
export type ColumnCategoryChart = { masked: true } | {
  masked: false; topN: number; distinctCount: number
  items: ({ value: string } & CategoryFrequency)[]
  other: CategoryFrequency | null
}
export type ColumnChart = {
  histogram: HistogramBucket[]
  boxPlot: ColumnBoxPlot | null
  sampledRecords: number
  truncated: boolean
  category: ColumnCategoryChart | null
}
export type ColumnStats = { column_name: string; total_records: number; null_count: number; missing_ratio: number; min?: number; max?: number; average?: number; histogram?: HistogramBucket[] }
