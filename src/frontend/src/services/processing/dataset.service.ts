import type { ApiClient } from '../../types/api/api.types'
import type { postDatasetsByDatasetIdQueryRecordsRequestBody as RecordQuery } from '../../types/services-type/dataViewVirtualGrid'
import type { patchDatasetsByIdRenameColumnsRequestBody } from '../../types/services-type/datasets'
import { isRecord } from '../../lib/api-error'

export type DatasetColumn = { key: string; name: string; dataType: string; originalName?: string }
export type DatasetRow = { rowIndex: number; props: Record<string, unknown> }
export type RecordPage = { items: DatasetRow[]; meta: { hasMore: boolean; nextCursor: string | null } }
export type DatasetPreview = { columns: DatasetColumn[]; page: RecordPage }
export const firstRecordQuery: RecordQuery = { limit: 50 }
export type ColumnStats = { column_name: string; total_records: number; null_count: number; missing_ratio: number; min?: number; max?: number; average?: number }
export type { RecordQuery }

export function createDatasetService(api: ApiClient) {
  return {
    async schema(id: string, signal: AbortSignal): Promise<DatasetColumn[]> {
      const data = await api.request<{ columns: DatasetColumn[] }>({ path: `/datasets/${encodeURIComponent(id)}/schema`, auth: 'session', signal })
      if (!Array.isArray(data.columns) || data.columns.some(c => !c || typeof c.key !== 'string' || typeof c.name !== 'string')) throw new Error('Schema từ máy chủ không hợp lệ.')
      return data.columns
    },
    async records(id: string, query: RecordQuery, signal: AbortSignal): Promise<RecordPage> {
      const data = await api.request<RecordPage>({ path: `/datasets/${encodeURIComponent(id)}/records/query`, method: 'POST', data: query, auth: 'session', signal })
      if (!Array.isArray(data.items) || data.items.some(row => !row || !Number.isInteger(row.rowIndex) || !isRecord(row.props))
        || typeof data.meta?.hasMore !== 'boolean' || (data.meta.hasMore && !data.meta.nextCursor)) throw new Error('Trang dữ liệu từ máy chủ không hợp lệ.')
      return data
    },
    async stats(id: string, columnKey: string, signal: AbortSignal): Promise<ColumnStats> {
      const data = await api.request<{ stats: ColumnStats }>({ path: `/datasets/${encodeURIComponent(id)}/columns/${encodeURIComponent(columnKey)}/stats`, auth: 'session', signal })
      if (!data.stats || !Number.isFinite(data.stats.total_records) || !Number.isFinite(data.stats.missing_ratio)) throw new Error('Thống kê cột từ máy chủ không hợp lệ.')
      return data.stats
    },
    async renameColumns(id: string, input: patchDatasetsByIdRenameColumnsRequestBody) {
      await api.request({ path: `/datasets/${encodeURIComponent(id)}/columns`, method: 'PATCH', data: input, auth: 'session' })
    },
    async resetColumns(id: string) {
      await api.request({ path: `/datasets/${encodeURIComponent(id)}/columns/reset`, method: 'POST', auth: 'session' })
    },
    download(id: string) {
      return api.request<Blob>({ path: `/datasets/${encodeURIComponent(id)}/file`, auth: 'session', responseType: 'blob', timeoutMs: 120000 })
    },
  }
}
export type DatasetService = ReturnType<typeof createDatasetService>
