import type { ApiClient } from '../../types/api/api.types'
import type { patchDatasetsByIdColumnPiiRequestBody } from '../../types/services-type/datasets'
import type { postDatasetsByDatasetIdQueryRecordsRequestBody as RecordQuery } from '../../types/services-type/dataViewVirtualGrid'
import { ApiError, isRecord } from '../../lib/api-error'

export type DatasetColumn = { key: string; name: string; dataType: string; originalName?: string; isPii?: boolean }
export type DatasetDetail = { id: string; name: string; rowCount: number; columnCount: number }
export type DatasetRow = { rowIndex: number; props: Record<string, unknown> }
export type RecordPage = { items: DatasetRow[]; meta: { hasMore: boolean; nextCursor: string | null } }
export type DatasetPreview = { columns: DatasetColumn[]; page: RecordPage }
export const firstRecordQuery: RecordQuery = { limit: 50 }
export type ColumnStats = { column_name: string; total_records: number; null_count: number; missing_ratio: number; min?: number; max?: number; average?: number }
export type { RecordQuery }
const invalid = (message: string) => new ApiError({ kind: 'invalid-response', message })

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
        || ['min', 'max', 'average'].some(key => stats[key] !== undefined && (typeof stats[key] !== 'number' || !Number.isFinite(stats[key])))) {
        throw invalid('Thống kê cột từ máy chủ không hợp lệ.')
      }
      return stats as ColumnStats
    },
    async updateColumnPii(id: string, columnKey: string, isPii: boolean) {
      await api.request({ path: `/datasets/${encodeURIComponent(id)}/columns/pii`, method: 'PATCH',
        data: { columns: [{ columnKey, isPii }] } satisfies patchDatasetsByIdColumnPiiRequestBody, auth: 'session' })
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
