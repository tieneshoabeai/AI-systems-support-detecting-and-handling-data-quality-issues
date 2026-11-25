import type { ApiClient } from '../../types/api/api.types'
import type { CategoryFrequency, ColumnBoxPlot, ColumnCategoryChart, ColumnChart, ColumnStats, DatasetColumn, DatasetRow, HistogramBucket, RecordPage } from '../../types/processing/dataset-records.types'
import type { postDatasetsByDatasetIdQueryRecordsRequestBody as RecordQuery } from '../../types/services-type/dataViewVirtualGrid'
import { ApiError, isRecord } from '../../lib/api-error'
import type { DatasetDetail } from './type'

export const firstRecordQuery: RecordQuery = { limit: 50 }
export type { ColumnBoxPlot, ColumnCategoryChart, ColumnChart, ColumnStats, DatasetColumn, DatasetPreview, DatasetRow, HistogramBucket, RecordPage } from '../../types/processing/dataset-records.types'
export type { DatasetDetail, RecordQuery }
const invalid = (message: string) => new ApiError({ kind: 'invalid-response', message })

const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value)
const count = (value: unknown): value is number => finite(value) && Number.isSafeInteger(value) && value >= 0

function parseBoxPlot(value: unknown): ColumnBoxPlot | null {
  if (!isRecord(value)) return null
  const { q1, median, q3, whisker_low: whiskerLow, whisker_high: whiskerHigh, outside_count: outsideCount, n } = value
  if (!finite(whiskerLow) || !finite(q1) || !finite(median) || !finite(q3) || !finite(whiskerHigh)
    || whiskerLow > whiskerHigh || q1 > median || median > q3
    || !count(n) || n === 0 || !count(outsideCount) || outsideCount > n) return null
  return { q1, median, q3, whiskerLow, whiskerHigh, outsideCount, n }
}

function frequency(value: unknown): CategoryFrequency | null {
  return isRecord(value) && count(value['count']) && finite(value['rate']) && value['rate'] >= 0 && value['rate'] <= 1
    ? { count: value['count'], rate: value['rate'] } : null
}

function parseCategory(value: unknown): ColumnCategoryChart | null {
  if (!isRecord(value)) return null
  if (value['masked'] === true) return { masked: true }
  const { top_n: topN, distinct_count: distinctCount, items, other } = value
  if (!count(topN) || topN === 0 || !count(distinctCount) || !Array.isArray(items) || items.length > topN) return null
  const parsed: ({ value: string } & CategoryFrequency)[] = []
  for (const item of items as unknown[]) {
    const stats = frequency(item)
    if (!stats || !isRecord(item) || typeof item['value'] !== 'string') return null
    parsed.push({ value: item['value'], ...stats })
  }
  const rest = other == null ? null : frequency(other)
  if (other != null && rest === null) return null
  return { masked: false, topN, distinctCount, items: parsed, other: rest }
}

export function createDatasetService(api: ApiClient) {
  return {
    async detail(id: string, signal: AbortSignal): Promise<DatasetDetail> {
      const response = await api.request<unknown>({ path: `/datasets/${encodeURIComponent(id)}`, auth: 'session', signal })
      const dataset = isRecord(response) ? response['dataset'] : null
      if (!isRecord(dataset) || dataset['id'] !== id || typeof dataset['name'] !== 'string'
        || !['rowCount', 'columnCount'].every(key => typeof dataset[key] === 'number' && Number.isInteger(dataset[key]) && dataset[key] >= 0)) {
        throw invalid('Chi tiết tập dữ liệu từ máy chủ không hợp lệ.')
      }
      return { id, name: dataset['name'], rowCount: dataset['rowCount'] as number, columnCount: dataset['columnCount'] as number }
    },
    async schema(id: string, signal: AbortSignal): Promise<DatasetColumn[]> {
      const data = await api.request<unknown>({ path: `/datasets/${encodeURIComponent(id)}/schema`, auth: 'session', signal })
      if (!isRecord(data) || !Array.isArray(data['columns'])) throw invalid('Schema từ máy chủ không hợp lệ.')
      const keys = new Set<string>()
      return data['columns'].map((column: unknown): DatasetColumn => {
        if (!isRecord(column) || typeof column['key'] !== 'string' || !/^c\d+$/.test(column['key'])
          || keys.has(column['key']) || typeof column['name'] !== 'string'
          || !['string', 'number', 'boolean', 'date'].includes(String(column['dataType']))
          || (column['originalName'] !== undefined && typeof column['originalName'] !== 'string')
          || (column['isPii'] !== undefined && typeof column['isPii'] !== 'boolean')) throw invalid('Schema từ máy chủ không hợp lệ.')
        keys.add(column['key'])
        return { key: column['key'], name: column['name'], dataType: column['dataType'] as string,
          ...(typeof column['originalName'] === 'string' ? { originalName: column['originalName'] } : {}),
          ...(typeof column['isPii'] === 'boolean' ? { isPii: column['isPii'] } : {}) }
      })
    },
    async records(id: string, query: RecordQuery, signal: AbortSignal): Promise<RecordPage> {
      const path = `/datasets/${encodeURIComponent(id)}/records`
      const usesQuery = Boolean(query.search || query.filters?.length || query.sort?.length)
      const data = await api.request<unknown>(usesQuery
        ? { path: `${path}/query`, method: 'POST', data: query, auth: 'session', signal }
        : { path, params: { limit: query.limit, cursor: query.cursor }, auth: 'session', signal })
      if (!isRecord(data) || !Array.isArray(data['items']) || !isRecord(data['meta'])) throw invalid('Trang dữ liệu từ máy chủ không hợp lệ.')
      const meta = data['meta']
      if (typeof meta['hasMore'] !== 'boolean' || (meta['nextCursor'] !== null && typeof meta['nextCursor'] !== 'string')
        || (meta['hasMore'] && (!meta['nextCursor'] || meta['nextCursor'] === query.cursor))) throw invalid('Trang dữ liệu từ máy chủ không hợp lệ.')
      const items = data['items'].map((row: unknown): DatasetRow => {
        if (!isRecord(row) || typeof row['rowIndex'] !== 'number' || !Number.isInteger(row['rowIndex']) || row['rowIndex'] < 0
          || !isRecord(row['props'])) throw invalid('Trang dữ liệu từ máy chủ không hợp lệ.')
        return { rowIndex: row['rowIndex'], props: row['props'] }
      })
      return { items, meta: { hasMore: meta['hasMore'], nextCursor: meta['nextCursor'] } }
    },
    async stats(id: string, columnKey: string, signal: AbortSignal): Promise<ColumnStats> {
      const data = await api.request<unknown>({ path: `/datasets/${encodeURIComponent(id)}/columns/${encodeURIComponent(columnKey)}/stats`, auth: 'session', signal })
      if (!isRecord(data) || !isRecord(data['stats'])) throw invalid('Thống kê cột từ máy chủ không hợp lệ.')
      const stats = data['stats']
      if (typeof stats['column_name'] !== 'string'
        || !['total_records', 'null_count'].every(key => typeof stats[key] === 'number' && Number.isInteger(stats[key]) && stats[key] >= 0)
        || typeof stats['missing_ratio'] !== 'number' || !Number.isFinite(stats['missing_ratio'])
        || ['min', 'max', 'average'].some(key => stats[key] !== undefined && !finite(stats[key]))
        || (stats['histogram'] !== undefined && (!Array.isArray(stats['histogram']) || !stats['histogram'].every(bucket =>
          isRecord(bucket) && finite(bucket['bucket_start']) && finite(bucket['bucket_end'])
          && bucket['bucket_start'] <= bucket['bucket_end'] && count(bucket['count']))))) {
        throw invalid('Thống kê cột từ máy chủ không hợp lệ.')
      }
      return stats as ColumnStats
    },
    async charts(id: string, columnKey: string, signal: AbortSignal): Promise<ColumnChart> {
      const data = await api.request<unknown>({ path: `/datasets/${encodeURIComponent(id)}/charts`,
        params: { columns: columnKey }, auth: 'session', signal })
      const chart = isRecord(data) && Array.isArray(data['charts'])
        ? data['charts'].find((item: unknown) => isRecord(item) && item['column_key'] === columnKey) as Record<string, unknown> | undefined
        : undefined
      if (!chart || !count(chart['sampled_records']) || typeof chart['truncated'] !== 'boolean') throw invalid('Dữ liệu biểu đồ không hợp lệ.')
      const source = chart['histogram']
      const histogram: HistogramBucket[] = []
      if (source != null) {
        if (!isRecord(source) || !Array.isArray(source['bins'])) throw invalid('Khoảng giá trị của biểu đồ không hợp lệ.')
        for (const bin of source['bins'] as unknown[]) {
          if (!isRecord(bin) || !finite(bin['from']) || !finite(bin['to']) || bin['from'] > bin['to'] || !count(bin['count'])) {
            throw invalid('Khoảng giá trị của biểu đồ không hợp lệ.')
          }
          histogram.push({ bucket_start: bin['from'], bucket_end: bin['to'], count: bin['count'] })
        }
      }
      return { histogram, boxPlot: parseBoxPlot(chart['box_plot']), sampledRecords: chart['sampled_records'],
        truncated: chart['truncated'], category: parseCategory(chart['category']) }
    },
    async delete(id: string) {
      await api.request<void>({ path: `/datasets/${encodeURIComponent(id)}`, method: 'DELETE', auth: 'session' })
    },
    download(id: string) {
      return api.request<Blob>({ path: `/datasets/${encodeURIComponent(id)}/file`, auth: 'session', responseType: 'blob', timeoutMs: 120000 })
    },
  }
}
export type DatasetService = ReturnType<typeof createDatasetService>
