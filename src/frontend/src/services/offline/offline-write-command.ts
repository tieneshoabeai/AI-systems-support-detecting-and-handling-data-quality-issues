import { isRecord } from '../../lib/api-error'
import type { ApiRequestOptions } from '../../types/api/api.types'
import type { OfflineWriteCommand } from '../../types/offline/offline-write.types'

// An explicit allowlist: credentials, members, analysis and job creation never enter the queue.
export function acceptsOfflineWrite(request: ApiRequestOptions): boolean {
  if (!request.deferIfOffline || request.auth !== 'session' || request.params || request.includeStatus) return false
  if (request.method === 'DELETE') return /^\/(workspaces|projects|datasets)\/[^/]+$/.test(request.path) && request.data === undefined
  if (request.method === 'PATCH' && /^\/(workspaces|projects)\/[^/]+$/.test(request.path) && isRecord(request.data)) {
    const data = request.data
    return Number.isSafeInteger(data['expectedVersion']) && Number(data['expectedVersion']) >= 1
      && Object.keys(data).some(key => key === 'name' || key === 'description')
      && Object.entries(data).every(([key, value]) => key === 'expectedVersion' || (['name', 'description'].includes(key) && typeof value === 'string'))
  }
  return request.method === 'POST' && /^\/projects\/[^/]+\/datasets\/upload$/.test(request.path)
    && request.data instanceof FormData && [...request.data.keys()].length === 1 && request.data.get('file') instanceof Blob
}

export async function hashFile(file: Blob): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', await file.arrayBuffer())
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('')
}

export async function offlineWriteCommand(request: ApiRequestOptions): Promise<OfflineWriteCommand> {
  if (!acceptsOfflineWrite(request)) throw new Error('Thao tác này cần kết nối máy chủ.')
  const [, resource, resourceId] = request.path.split('/') as [string, 'workspaces' | 'projects' | 'datasets', string]
  if (request.method === 'DELETE') return { kind: 'delete', resource, resourceId }
  if (request.method === 'PATCH') {
    const data = request.data as { name?: string; description?: string; expectedVersion: number }
    const fields = { ...(data.name === undefined ? {} : { name: data.name }), ...(data.description === undefined ? {} : { description: data.description }) }
    return { kind: 'patch', resource: resource as 'workspaces' | 'projects', resourceId, fields, expectedVersion: data.expectedVersion }
  }
  const file = (request.data as FormData).get('file') as File
  if (!file.size || file.size > 50 * 1024 * 1024 || !file.name.toLowerCase().endsWith('.csv')) throw new Error('Chỉ hỗ trợ file CSV, tối đa 50 MiB.')
  return { kind: 'upload', resource: 'projects', resourceId, file, fileName: file.name, mimeType: file.type, hash: await hashFile(file) }
}

export function writeLabel(command: OfflineWriteCommand) {
  if (command.kind === 'upload') return `Upload ${command.fileName}`
  return `${command.kind === 'patch' ? 'Sửa' : 'Xóa'} ${command.resource === 'projects' ? 'Project' : command.resource === 'workspaces' ? 'Workspace' : 'dataset'} · ${command.resourceId}`
}
