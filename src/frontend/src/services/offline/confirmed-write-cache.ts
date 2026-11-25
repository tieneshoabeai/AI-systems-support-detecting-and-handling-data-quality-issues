import { isRecord } from '../../lib/api-error'
import type { OfflineWrite } from '../../types/offline/offline-write.types'
import type { createOfflineReadRepository } from '../../repositories/offline/offline-read.repository'

// Pending writes never masquerade as server-confirmed saved data.
export async function updateConfirmedCache(cache: ReturnType<typeof createOfflineReadRepository>, row: OfflineWrite) {
  const { command, response } = row
  const path = `/${command.resource}/${command.resourceId}`
  if (command.kind === 'delete') { await cache.removeResource(path); return }
  const singular = command.resource === 'projects' ? 'project' : 'workspace'
  const dto = isRecord(response) ? response[command.kind === 'upload' ? 'dataset' : singular] : null
  if (!isRecord(dto) || typeof dto['id'] !== 'string') return
  const id = decodeURIComponent(command.resourceId)
  for (const saved of await cache.list()) {
    const key: unknown = JSON.parse(saved.key)
    if (!isRecord(key) || typeof key['path'] !== 'string' || !isRecord(saved.payload)) continue
    const target = key['path']
    let payload = saved.payload
    const update = (value: unknown) => isRecord(value) && value['id'] === id
      ? { ...value, ...(command.kind === 'upload' ? { hasDataset: true } : dto) } : value
    if (target === path) payload = { ...payload, [singular]: update(payload[singular]) }
    if (command.kind === 'upload' && target === `${path}/datasets`) payload = { dataset: dto }
    if (Array.isArray(payload['items']) && (target === `/${command.resource}` || (command.resource === 'projects' && /^\/workspaces\/[^/]+\/projects$/.test(target)))) {
      payload = { ...payload, items: (payload['items'] as unknown[]).map(update) }
    }
    if (payload !== saved.payload) await cache.save(saved.key, payload, new TextEncoder().encode(JSON.stringify(payload)).byteLength)
  }
}
