import type { ApiClient } from '../../types/api/api.types'

export type AdminUser = {
  id: string
  email: string
  firstName: string
  lastName: string
  role: string
  status: string
  createdAt: string
  updatedAt: string
}

export type AdminIssue = {
  id: string
  userId: string
  issueType: string
  title: string
  description: string
  status: 'new' | 'needs_info' | 'in_progress' | 'resolved' | 'closed'
  version: number
  createdAt: string
  updatedAt: string
}

type CursorPage<T> = { items: T[]; meta: { hasMore: boolean; nextCursor: string | null } }
const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const mapAdminUser = (value: unknown): AdminUser => {
  if (!isRecord(value) || typeof value['id'] !== 'string' || typeof value['email'] !== 'string'
    || typeof value['firstName'] !== 'string' || typeof value['lastName'] !== 'string'
    || typeof value['role'] !== 'string' || typeof value['status'] !== 'string'
    || typeof value['createdAt'] !== 'string' || typeof value['updatedAt'] !== 'string') {
    throw new Error('Thông tin tài khoản quản trị từ máy chủ không hợp lệ.')
  }
  return {
    id: value['id'], email: value['email'], firstName: value['firstName'], lastName: value['lastName'],
    role: value['role'], status: value['status'], createdAt: value['createdAt'], updatedAt: value['updatedAt'],
  }
}

const mapAdminIssue = (value: unknown): AdminIssue => {
  if (!isRecord(value) || typeof value['id'] !== 'string' || typeof value['userId'] !== 'string'
    || typeof value['issueType'] !== 'string' || typeof value['title'] !== 'string'
    || typeof value['description'] !== 'string' || typeof value['version'] !== 'number'
    || !Number.isInteger(value['version']) || typeof value['createdAt'] !== 'string'
    || typeof value['updatedAt'] !== 'string'
    || !['new', 'needs_info', 'in_progress', 'resolved', 'closed'].includes(String(value['status']))) {
    throw new Error('Thông tin issue quản trị từ máy chủ không hợp lệ.')
  }
  return {
    id: value['id'], userId: value['userId'], issueType: value['issueType'], title: value['title'],
    description: value['description'], status: value['status'] as AdminIssue['status'], version: value['version'],
    createdAt: value['createdAt'], updatedAt: value['updatedAt'],
  }
}

const cursorPage = (value: unknown): CursorPage<unknown> => {
  if (!isRecord(value) || !Array.isArray(value['items']) || !isRecord(value['meta'])
    || typeof value['meta']['hasMore'] !== 'boolean'
    || (value['meta']['nextCursor'] !== null && typeof value['meta']['nextCursor'] !== 'string')) {
    throw new Error('Danh sách quản trị từ máy chủ không hợp lệ.')
  }
  return value as CursorPage<unknown>
}

export function createAdminService(api: ApiClient) {
  const request = <T>(path: string, method: 'GET' | 'PATCH' = 'GET', data?: unknown, params?: Record<string, string | number>) =>
    api.request<T>({ path, method, auth: 'session', ...(data === undefined ? {} : { data }), ...(params === undefined ? {} : { params }) })
  const listPages = async <T>(
    path: string,
    map: (item: unknown) => T,
    params: Record<string, string | number>,
  ): Promise<T[]> => {
    const items: T[] = []
    const seen = new Set<string>()
    let cursor: string | undefined
    for (;;) {
      const page = cursorPage(await request<unknown>(path, 'GET', undefined, {
        ...params,
        ...(cursor === undefined ? {} : { cursor }),
      }))
      items.push(...page.items.map(map))
      if (!page.meta.hasMore) return items
      const nextCursor = page.meta.nextCursor
      if (!nextCursor || seen.has(nextCursor)) throw new Error('Phân trang quản trị từ máy chủ không hợp lệ.')
      seen.add(nextCursor)
      cursor = nextCursor
    }
  }

  return {
    async listUsers(): Promise<AdminUser[]> {
      return listPages('/admin/users', mapAdminUser, { limit: 100 })
    },
    async getUser(id: string): Promise<AdminUser> {
      return mapAdminUser(await request<unknown>(`/admin/users/${encodeURIComponent(id)}`))
    },
    async listIssues(limit = 10): Promise<AdminIssue[]> {
      return listPages('/admin/issues', mapAdminIssue, { limit, sortBy: 'createdAt', sortOrder: 'desc' })
    },
    async getIssue(id: string): Promise<AdminIssue> {
      return mapAdminIssue(await request<unknown>(`/admin/issues/${encodeURIComponent(id)}`))
    },
    async updateIssueStatus(id: string, status: AdminIssue['status'], expectedVersion: number): Promise<AdminIssue> {
      const updated = await request<unknown>(`/admin/issues/${encodeURIComponent(id)}/status`, 'PATCH', { status, expectedVersion })
      return mapAdminIssue(updated)
    },
  }
}

export type AdminService = ReturnType<typeof createAdminService>