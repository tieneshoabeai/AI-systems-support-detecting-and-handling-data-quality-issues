import { isRecord } from '../../lib/api-error'
import type { ApiClient } from '../../types/api/api.types'
import type { ProjectStatus } from '../../types/management/management.types'
import type { getProjectsAllParamsQuery } from '../../types/services-type/projects'

export const recentProjectsPageSize = 10

export type RecentProject = {
  id: string
  name: string
  description?: string
  workspaceId?: string
  workspaceName?: string
  ownerName?: string
  fileName?: string
  hasDataset?: boolean
  updatedAt?: string
  status: ProjectStatus
}

const text = (value: unknown): string | undefined => typeof value === 'string' && value.trim() ? value : undefined
const nestedText = (value: unknown, key: string) => isRecord(value) ? text(value[key]) : undefined

export async function listRecentProjects(api: ApiClient, cursor: string | null, signal: AbortSignal) {
  const params = { sort: 'updated', limit: recentProjectsPageSize, ...(cursor ? { cursor } : {}) } satisfies getProjectsAllParamsQuery
  const response = await api.request<unknown>({ path: '/projects', auth: 'session', params, signal })
  if (!isRecord(response) || !Array.isArray(response['items']) || !isRecord(response['meta'])) {
    throw new Error('Danh sách project từ máy chủ không hợp lệ.')
  }
  const { hasMore, nextCursor } = response['meta']
  if (typeof hasMore !== 'boolean' || (hasMore && (!text(nextCursor) || cursor === nextCursor))) {
    throw new Error('Thông tin phân trang project không hợp lệ.')
  }
  const items = response['items'].map((item: unknown): RecentProject => {
    if (!isRecord(item)) throw new Error('Dữ liệu project không hợp lệ.')
    const id = text(item['id'])
    const name = text(item['name'])
    const status = item['status']
    if (!id || !name || (status !== 'not_started' && status !== 'in_progress' && status !== 'completed')) {
      throw new Error('Dữ liệu project không hợp lệ.')
    }
    const description = text(item['description'])
    const workspaceId = text(item['workspaceId'])
    const workspaceName = text(item['workspaceName']) ?? nestedText(item['workspace'], 'name')
    const ownerName = text(item['ownerName']) ?? nestedText(item['owner'], 'name')
    const fileName = text(item['fileName']) ?? nestedText(item['dataset'], 'originalFileName') ?? nestedText(item['dataset'], 'fileName')
    const updated = text(item['updatedAt'])
    const date = updated ? new Date(updated) : null
    return { id, name, status: status === 'in_progress' ? 'processing' : status === 'completed' ? 'completed' : 'active',
      ...(description ? { description } : {}), ...(workspaceName ? { workspaceName } : {}),
      ...(workspaceId ? { workspaceId } : {}),
      ...(ownerName ? { ownerName } : {}), ...(fileName ? { fileName } : {}),
      ...(typeof item['hasDataset'] === 'boolean' ? { hasDataset: item['hasDataset'] } : {}),
      ...(date && !Number.isNaN(date.valueOf()) ? { updatedAt: date.toLocaleDateString('vi-VN') } : {}) }
  })
  return { items, nextCursor: hasMore ? text(nextCursor) ?? null : null }
}

export type RecentProjectsPage = Awaited<ReturnType<typeof listRecentProjects>>
