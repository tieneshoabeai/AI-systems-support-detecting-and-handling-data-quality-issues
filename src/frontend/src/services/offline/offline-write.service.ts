import { ApiError, isRecord, normalizeApiError } from '../../lib/api-error'
import type { ApiClient, ApiRequestOptions } from '../../types/api/api.types'
import type { DraftAccess, DraftAccessPort } from '../../types/datasets/upload-draft.types'
import type { OfflineWrite, OfflineWriteStatus } from '../../types/offline/offline-write.types'
import type { createOfflineWriteRepository } from '../../repositories/offline/offline-write.repository'
import { acceptsOfflineWrite, hashFile, offlineWriteCommand, writeLabel } from './offline-write-command'

type Lock = (name: string, work: () => Promise<void>) => Promise<void>
const browserLock: Lock = async (name, work) => {
  if (!navigator.locks) throw new Error('Trình duyệt cần hỗ trợ Web Locks để đồng bộ an toàn giữa các tab.')
  await navigator.locks.request(name, { ifAvailable: true }, async lock => { if (lock) await work() })
}
const unavailable = (error: unknown) => {
  const failure = normalizeApiError(error)
  return failure.kind === 'network' || failure.kind === 'timeout' || (failure.status ?? 0) >= 500
}
const conflict = (message: string) => new ApiError({ kind: 'http', status: 409, message })
const resourcePath = (row: OfflineWrite) => `/${row.command.resource}/${row.command.resourceId}`

export function createOfflineWriteService(options: {
  repository: ReturnType<typeof createOfflineWriteRepository>; access: DraftAccessPort; api: ApiClient; namespace: string
  prepare: () => Promise<boolean>; connected: () => void
  confirmed: (row: OfflineWrite) => Promise<void>
  lock?: Lock; intervalMs?: number
}) {
  const { repository, access, api } = options
  let snapshot: OfflineWriteStatus = { entries: [], syncing: false, revision: 0, error: null }
  const listeners = new Set<() => void>()
  let disposed = false
  let task: Promise<void> | undefined
  let controller: AbortController | undefined
  const publish = (change: Partial<OfflineWriteStatus>) => {
    if (disposed) return
    snapshot = { ...snapshot, ...change }; listeners.forEach(listener => listener())
  }
  const valid = (scope: DraftAccess) => {
    const current = repository.scope()
    if (disposed || current.accountId !== scope.accountId || current.generation !== scope.generation || controller?.signal.aborted) {
      throw new ApiError({ kind: 'session', message: 'Phiên đồng bộ đã thay đổi.' })
    }
  }
  const refresh = async () => {
    const scope = access.read()
    if (!scope) { publish({ entries: [], error: null }); return }
    const rows = await repository.list()
    if (access.read()?.accountId !== scope.accountId || access.read()?.generation !== scope.generation) return
    publish({ entries: rows.map(({ id, label, state, error }) => ({ id, label, state, ...(error ? { error } : {}) })) })
  }
  const request = async <T>(scope: DraftAccess, input: ApiRequestOptions): Promise<T> => {
    valid(scope)
    try {
      const value = await api.request<T>({ ...input, ...(controller ? { signal: controller.signal } : {}) })
      valid(scope)
      // A response from the actual session/resource endpoint proves the API is
      // reachable. Do not depend on a separate health route before replay.
      options.connected()
      return value
    } catch (error) {
      valid(scope)
      // HTTP errors (including 401/403/404) still prove the server responded.
      if (normalizeApiError(error).kind === 'http') options.connected()
      throw error
    }
  }
  const finish = async (row: OfflineWrite) => {
    await options.confirmed(row)
    await repository.remove(row.id)
    publish({ revision: snapshot.revision + 1 })
  }
  const process = async (row: OfflineWrite, scope: DraftAccess) => {
    if (row.state === 'confirmed') { await finish(row); return }
    const command = row.command
    const path = resourcePath(row)
    const get = (path: string, responseType?: 'blob') => request<unknown>(scope, { path, auth: 'session', timeoutMs: 15000, ...(responseType ? { responseType } : {}) })
    let method: 'PATCH' | 'DELETE' | 'POST'
    let data: unknown
    let target = path
    if (command.kind === 'patch') {
      const response = await get(path)
      const dto = isRecord(response) ? response[command.resource === 'projects' ? 'project' : 'workspace'] : null
      if (!isRecord(dto) || dto['id'] !== decodeURIComponent(command.resourceId) || !Number.isSafeInteger(dto['version'])) throw conflict('Không xác định được phiên bản dữ liệu. Mở lại đối tượng để kiểm tra.')
      if (Object.entries(command.fields).every(([key, value]) => dto[key] === value)) {
        // Only a known acknowledgement, or exactly the expected next version, may rebase dependent edits.
        const version = dto['version'] === command.expectedVersion + 1 ? Number(dto['version']) : undefined
        await repository.confirm(row.id, response, version)
        await finish({ ...row, state: 'confirmed', response }); return
      }
      if (dto['version'] !== command.expectedVersion) throw conflict('Dữ liệu trên server đã thay đổi. Hãy bỏ yêu cầu cũ, tải lại và sửa trên phiên bản mới.')
      method = 'PATCH'; data = { ...command.fields, expectedVersion: command.expectedVersion }
    } else if (command.kind === 'delete') {
      try { await get(path) } catch (error) {
        if (normalizeApiError(error).status !== 404) throw error
        await repository.confirm(row.id, null)
        await finish({ ...row, state: 'confirmed', response: null }); return
      }
      method = 'DELETE'
    } else {
      const response = await get(`${path}/datasets`)
      if (!isRecord(response) || !Object.hasOwn(response, 'dataset')) throw conflict('Không xác định được dataset của Project.')
      const dataset = response['dataset']
      if (dataset !== null) {
        if (row.state === 'uncertain' && isRecord(dataset) && typeof dataset['id'] === 'string') {
          const file = await get(`/datasets/${encodeURIComponent(dataset['id'])}/file`, 'blob')
          if (file instanceof Blob && file.size === command.file.size && await hashFile(file) === command.hash) {
            await repository.confirm(row.id, response)
            await finish({ ...row, state: 'confirmed', response }); return
          }
        }
        throw conflict('Project đã có dataset. Không tự upload lại để tránh tạo trùng hoặc ghi đè.')
      }
      if (row.state === 'uncertain' || row.attempts > 0) throw conflict('Lần upload trước mất phản hồi. Chưa xác nhận được kết quả; không tự gửi lại file. Hãy kiểm tra Project trước.')
      method = 'POST'; target = `${path}/datasets/upload`
      const form = new FormData(); form.append('file', command.file, command.fileName); data = form
    }
    await repository.update(row.id, { state: 'sending', attempts: row.attempts + 1 })
    let response: unknown
    try {
      response = await request(scope, { path: target, method, auth: 'session', ...(data === undefined ? {} : { data }), timeoutMs: command.kind === 'upload' ? 120000 : 15000 })
    } catch (error) {
      // Cancellation/session loss also leaves a durable ambiguous state. The next session reconciles it.
      try { await repository.update(row.id, { state: 'uncertain' }) } catch { /* sending is recovered under the next lock */ }
      throw error
    }
    const dto = isRecord(response) ? response[command.kind === 'upload' ? 'dataset' : command.resource === 'projects' ? 'project' : 'workspace'] : null
    if (command.kind !== 'delete' && (!isRecord(dto) || typeof dto['id'] !== 'string'
      || (command.kind === 'patch' && (dto['id'] !== decodeURIComponent(command.resourceId) || !Number.isSafeInteger(dto['version']))))) {
      await repository.update(row.id, { state: 'uncertain' })
      throw new ApiError({ kind: 'network', message: 'Server đã phản hồi nhưng thiếu dữ liệu xác nhận. Sẽ đối chiếu trước khi gửi tiếp.' })
    }
    const version = isRecord(dto) && Number.isSafeInteger(dto['version']) ? Number(dto['version']) : undefined
    await repository.confirm(row.id, response, version)
    await finish({ ...row, state: 'confirmed', response })
  }
  const sync = (): Promise<void> => {
    if (task) return task
    if (disposed || !access.read() || !navigator.onLine) return Promise.resolve()
    task = (async () => {
      await refresh()
      if (!snapshot.entries.length || snapshot.entries[0]?.state === 'blocked') return
      const scope = repository.scope()
      await (options.lock ?? browserLock)(`offline-writes:${options.namespace}:${scope.accountId}`, async () => {
        controller = new AbortController()
        valid(scope)
        publish({ syncing: true, error: null })
        if (!await options.prepare()) return
        valid(scope)
        await repository.recoverSending()
        for (;;) {
          valid(scope)
          const rows = await repository.list()
          // Preserve causal order; a conflict must not allow a later delete/edit to overtake it.
          const row = rows[0]
          if (!row || row.state === 'blocked') break
          try { await process(row, scope) } catch (error) {
            valid(scope)
            // An ACK persisted before local cache cleanup must never become retryable.
            if ((await repository.list()).find(item => item.id === row.id)?.state === 'confirmed') throw error
            if (unavailable(error)) throw error
            const failure = normalizeApiError(error)
            if (failure.kind === 'session' || failure.kind === 'cancelled') throw error
            await repository.update(row.id, { state: 'blocked', error: failure.message })
            break
          }
          await refresh()
        }
      })
    })().catch((error: unknown) => {
      if (!disposed && access.read()) publish({ error: unavailable(error) ? 'Chưa kết nối được backend. Yêu cầu vẫn lưu trên thiết bị và sẽ tự thử lại.' : normalizeApiError(error).message })
    }).finally(async () => {
      controller = undefined
      publish({ syncing: false })
      try { await refresh() } catch { /* no valid session, or storage failure already reported */ }
      task = undefined
    })
    return task
  }
  const kick = () => { void sync() }
  const unsubscribe = access.subscribe(() => {
    // Profile revalidation may publish without changing the captured access generation.
    const current = access.read()
    if (!current || current.accountId !== active?.accountId || current.generation !== active?.generation) {
      controller?.abort(); publish({ entries: [], error: null })
    }
    active = current
    void refresh().then(kick).catch(() => {})
  })
  let active = access.read()
  const timer = setInterval(kick, options.intervalMs ?? 10000)
  window.addEventListener('online', kick)
  void refresh().then(kick).catch(() => {})
  return {
    getSnapshot: () => snapshot,
    subscribe: (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener) } },
    accepts: acceptsOfflineWrite,
    enqueue: async (input: ApiRequestOptions, uncertain = false) => {
      const scope = repository.scope()
      const command = await offlineWriteCommand(input)
      const current = repository.scope()
      if (scope.accountId !== current.accountId || scope.generation !== current.generation) throw new ApiError({ kind: 'session', message: 'Phiên đã thay đổi; chưa lưu yêu cầu.' })
      const id = await repository.add(command, writeLabel(command), uncertain)
      await refresh()
      // Finish the caller's pending receipt before starting a replay.
      setTimeout(kick, 0)
      return id
    },
    sync,
    cancel: async (id: string) => {
      const scope = repository.scope()
      await (options.lock ?? browserLock)(`offline-writes:${options.namespace}:${scope.accountId}`, async () => {
        const row = (await repository.list()).find(row => row.id === id)
        if (row?.state === 'sending' || row?.state === 'confirmed') throw new Error('Yêu cầu đang được xử lý; chưa thể bỏ khỏi hàng đợi.')
        if (row) await repository.remove(id)
      })
      await refresh(); kick()
    },
    recheck: async (id: string) => {
      const row = (await repository.list()).find(row => row.id === id)
      if (row?.state === 'blocked') await repository.update(id, { state: row.attempts ? 'uncertain' : 'queued' })
      await sync()
    },
    dispose: () => { disposed = true; controller?.abort(); clearInterval(timer); window.removeEventListener('online', kick); unsubscribe(); listeners.clear() },
  }
}
