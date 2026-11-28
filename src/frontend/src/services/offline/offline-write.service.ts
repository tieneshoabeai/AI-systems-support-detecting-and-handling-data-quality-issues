import { ApiTargetManager } from '../../lib/api-target-manager'
import { ApiError, isRecord, normalizeApiError } from '../../lib/api-error'
import type { ApiClient, ApiRequestOptions } from '../../types/api/api.types'
import type { UploadDraftPort } from '../../types/datasets/upload-draft.types'
import type { OfflineWrite, OfflineWriteCommand, OfflineWritePort, OfflineWriteReceipt, OfflineWriteStatus } from '../../types/offline/offline-write.types'
import { sha256Blob } from '../../utils/sha256'
import { createOfflineWriteRepository } from '../../repositories/offline/offline-write.repository'

type Repository = ReturnType<typeof createOfflineWriteRepository>
type ParsedCommand = { command: OfflineWriteCommand; label: string }
type DatasetRecord = { id: string; originalFileName: string; fileSizeBytes: number; projectId?: string; accountId?: string; userId?: string; sha256?: string; fileHash?: string; checksum?: string; hash?: string }
type WebLocksPort = {
  request<T>(name: string, options: { mode: 'exclusive'; ifAvailable?: boolean }, callback: (lock: object | null) => Promise<T>): Promise<T>
}

const webLocks = (): WebLocksPort | undefined => typeof navigator === 'undefined'
  ? undefined : (navigator as Navigator & { locks?: WebLocksPort }).locks

const idFromPath = (path: string, expression: RegExp): string | null => {
  const match = expression.exec(path)
  if (!match?.[1]) return null
  try {
    const id = decodeURIComponent(match[1])
    return id && !id.includes('/') && id !== '.' && id !== '..' ? id : null
  } catch { return null }
}

const parseAllowlistedRequest = (request: ApiRequestOptions): ParsedCommand | null => {
  if (request.auth !== 'session' || request.deferIfOffline !== true || request.params !== undefined) return null
  if (request.responseType === 'blob' || request.requireBody === true) return null
  const method = request.method ?? 'GET'
  if (method === 'PATCH') {
    const workspaceId = idFromPath(request.path, /^\/workspaces\/([^/]+)$/)
    const projectId = idFromPath(request.path, /^\/projects\/([^/]+)$/)
    const resource = workspaceId ? 'workspaces' : projectId ? 'projects' : null
    const resourceId = workspaceId ?? projectId
    const data = request.data
    if (!resource || !resourceId || !isRecord(data) || !Number.isInteger(data['expectedVersion'])
      || (data['expectedVersion'] as number) < 0
      || Object.keys(data).some(key => !['expectedVersion', 'name', 'description'].includes(key))) return null
    const fields: { name?: string; description?: string } = {}
    if ('name' in data) {
      if (typeof data['name'] !== 'string' || !data['name'].trim() || data['name'].length > 100) return null
      fields.name = data['name']
    }
    if ('description' in data) {
      if (typeof data['description'] !== 'string' || data['description'].length > 500) return null
      fields.description = data['description']
    }
    if (!Object.keys(fields).length) return null
    return { command: { kind: 'patch', resource, resourceId, fields, expectedVersion: data['expectedVersion'] as number }, label: `Cập nhật ${resource === 'workspaces' ? 'workspace' : 'project'}` }
  }
  if (method === 'DELETE') {
    if (request.data !== undefined) return null
    for (const resource of ['workspaces', 'projects', 'datasets'] as const) {
      const resourceId = idFromPath(request.path, new RegExp(`^/${resource}/([^/]+)$`))
      if (resourceId) return { command: { kind: 'delete', resource, resourceId }, label: `Xóa ${resource === 'workspaces' ? 'workspace' : resource === 'projects' ? 'project' : 'dataset'}` }
    }
    return null
  }
  if (method === 'POST') {
    const projectId = idFromPath(request.path, /^\/projects\/([^/]+)\/datasets\/upload$/)
    if (!projectId || !(request.data instanceof FormData) || !request.deferredDraftId) return null
    const entries = [...request.data.entries()]
    if (entries.length !== 1 || entries[0]?.[0] !== 'file' || !(entries[0][1] instanceof File)) return null
    const file = entries[0][1]
    if (!file.name || file.size <= 0 || file.size > 50 * 1024 * 1024) return null
    const command: OfflineWriteCommand = {
      kind: 'upload', resource: 'projects', resourceId: projectId, file,
      fileName: file.name, mimeType: file.type, hash: '', draftId: request.deferredDraftId,
    }
    return { command, label: `Upload ${file.name} vào project` }
  }
  return null
}

const receipt = (row: OfflineWrite): OfflineWriteReceipt => ({
  kind: 'offline-write-receipt', queueId: row.id, state: row.state, createdAt: row.createdAt,
})

const readDataset = (value: unknown): DatasetRecord | null => {
  if (!isRecord(value)) throw new ApiError({ kind: 'invalid-response', message: 'Response dataset từ backend không hợp lệ.' })
  if (value['dataset'] === null) return null
  const dataset = value['dataset']
  if (!isRecord(dataset) || typeof dataset['id'] !== 'string' || typeof dataset['originalFileName'] !== 'string'
    || typeof dataset['fileSizeBytes'] !== 'number' || !Number.isFinite(dataset['fileSizeBytes'])
    || (dataset['projectId'] !== undefined && typeof dataset['projectId'] !== 'string')
    || (dataset['accountId'] !== undefined && typeof dataset['accountId'] !== 'string')
    || (dataset['userId'] !== undefined && typeof dataset['userId'] !== 'string')) {
    throw new ApiError({ kind: 'invalid-response', message: 'Metadata dataset từ backend không đủ để đối chiếu.' })
  }
  return dataset as DatasetRecord
}

const hashOf = (dataset: DatasetRecord): string | undefined => {
  const hash = dataset.sha256 ?? dataset.fileHash ?? dataset.checksum ?? dataset.hash
  return typeof hash === 'string' && /^[a-f\d]{64}$/i.test(hash) ? hash.toLowerCase() : undefined
}

const recordOf = (value: unknown, key: 'workspace' | 'project' | 'dataset') => {
  if (!isRecord(value) || !isRecord(value[key])) throw new ApiError({ kind: 'invalid-response', message: 'Không đọc được trạng thái hiện tại trên backend.' })
  return value[key]
}

const receiptShape = (value: unknown): value is OfflineWriteReceipt => isRecord(value)
  && value['kind'] === 'offline-write-receipt' && typeof value['queueId'] === 'string'
  && typeof value['state'] === 'string' && typeof value['createdAt'] === 'number'

export function createOfflineWriteService(options: {
  repository: Repository
  api: ApiClient
  drafts: UploadDraftPort
  targetManager: ApiTargetManager
  namespace: string
  isSessionReady(): boolean
  recoverSession(): Promise<void>
  now?: () => number
  intervalMs?: number
  confirmedRetentionMs?: number
}) {
  const now = options.now ?? Date.now
  const intervalMs = options.intervalMs ?? 30_000
  const confirmedRetentionMs = options.confirmedRetentionMs ?? 1500
  const listeners = new Set<() => void>()
  let snapshot: OfflineWriteStatus = Object.freeze({ entries: [], syncing: false, revision: 0, error: null })
  let paused = true
  let disposed = false
  let activeController: AbortController | undefined
  let activeTask: Promise<void> | undefined
  let retryAt = 0
  const confirmedRemovalTimers = new Map<string, ReturnType<typeof setTimeout>>()
  const lockName = `data-quality-offline-writes:${encodeURIComponent(options.namespace)}`
  const stagingLockName = `${lockName}:staging`
  const channel = typeof BroadcastChannel === 'undefined' ? null : new BroadcastChannel('data-quality-offline-writes')

  const publish = (patch: Partial<OfflineWriteStatus> = {}) => {
    snapshot = Object.freeze({ ...snapshot, ...patch, revision: snapshot.revision + 1 })
    for (const listener of listeners) { try { listener() } catch { /* UI observers cannot stop queue work. */ } }
  }

  const notifyConfirmed = (id: string) => {
    if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('offline-write-confirmed', { detail: { id } }))
    channel?.postMessage({ type: 'changed' })
  }

  const refreshSnapshot = async (broadcast = false) => {
    try {
      const rows = await options.repository.list()
      publish({
        entries: rows.map(row => ({
          id: row.id, state: row.state, label: row.label,
          ...(row.error ? { error: row.error } : {}), attempts: row.attempts, createdAt: row.createdAt,
          ...(row.command.kind === 'upload' ? { fileName: row.command.fileName } : {}),
        })),
      })
      if (broadcast) channel?.postMessage({ type: 'changed' })
    } catch (error) {
      const failure = normalizeApiError(error)
      if (failure.kind === 'session') {
        publish({ entries: [], error: null })
      } else publish({ error: failure.message })
    }
  }

  const scheduleConfirmedRemoval = (id: string) => {
    if (confirmedRemovalTimers.has(id)) return
    const timer = setTimeout(() => {
      confirmedRemovalTimers.delete(id)
      void (async () => {
        try {
          const row = (await options.repository.list()).find(item => item.id === id)
          if (row?.state === 'confirmed' && row.command.kind === 'upload') await options.repository.remove(id)
          await refreshSnapshot(true)
        } catch { /* A retained ACK is retried after the runtime/session becomes available. */ }
      })()
    }, confirmedRetentionMs)
    confirmedRemovalTimers.set(id, timer)
  }

  const setRowState = async (row: OfflineWrite, state: OfflineWrite['state'], error?: string) => {
    await options.repository.update(row.id, { state, ...(error ? { error } : { error: undefined }) })
    await refreshSnapshot(true)
  }

  const apiRequest = (path: string, method: NonNullable<ApiRequestOptions['method']> = 'GET', data?: unknown, signal?: AbortSignal) =>
    options.api.request<unknown>({ path, method, auth: 'session', ...(data === undefined ? {} : { data }), ...(signal ? { signal } : {}) })

  const currentDataset = async (projectId: string, signal?: AbortSignal): Promise<DatasetRecord | null> => {
    try { return readDataset(await apiRequest(`/projects/${encodeURIComponent(projectId)}/datasets`, 'GET', undefined, signal)) }
    catch (error) { if (normalizeApiError(error).status === 404) return null; throw error }
  }

  const assertDatasetMatches = (row: OfflineWrite, dataset: DatasetRecord, requireHash: boolean) => {
    const command = row.command
    if (command.kind !== 'upload' || (dataset.projectId !== undefined && dataset.projectId !== command.resourceId)
      || ((dataset.accountId ?? dataset.userId) !== undefined && (dataset.accountId ?? dataset.userId) !== row.accountId)
      || dataset.originalFileName !== command.fileName || dataset.fileSizeBytes !== command.file.size) {
      throw new ApiError({ kind: 'session', code: 'OFFLINE_UPLOAD_MISMATCH', message: 'Dataset trên backend không khớp tài khoản, project, tên hoặc kích thước trong queue.' })
    }
    const hash = hashOf(dataset)
    if (hash !== undefined && hash !== command.hash) throw new ApiError({ kind: 'session', code: 'OFFLINE_UPLOAD_HASH_MISMATCH', message: 'Hash dataset trên backend không khớp file trong queue.' })
    if (requireHash && hash === undefined) throw new ApiError({ kind: 'session', code: 'OFFLINE_UPLOAD_HASH_UNAVAILABLE', message: 'Backend chưa trả SHA-256; không thể phân biệt upload đã hoàn tất với request chưa xử lý.' })
    return hash
  }

  const confirmUpload = async (row: OfflineWrite, dataset: DatasetRecord, serverHash?: string) => {
    if (row.command.kind !== 'upload') return
    const command = row.command
    const response = { datasetId: dataset.id, fileName: dataset.originalFileName, sizeBytes: dataset.fileSizeBytes,
      projectId: command.resourceId, fileHash: command.hash, ...(serverHash ? { serverHash } : {}) }
    await options.repository.confirm(row.id, response)
    notifyConfirmed(row.id)
    // Keep the durable ACK until draft cleanup commits. Remove a completed upload from the
    // active queue only after both the ACK and the draft cleanup are safely stored.
    const savedRow = (await options.repository.list()).find(item => item.id === row.id)
    if (savedRow) await confirmUploadFromSavedAck(savedRow)
    await refreshSnapshot(true)
  }

  const confirmReconciledRow = async (row: OfflineWrite, signal: AbortSignal) => {
    const command = row.command
    if (command.kind === 'upload') {
      const dataset = await currentDataset(command.resourceId, signal)
      if (!dataset) throw new ApiError({ kind: 'session', code: 'OFFLINE_UPLOAD_NOT_FOUND', message: 'Không thấy dataset trên backend sau request upload chưa xác định.' })
      const serverHash = assertDatasetMatches(row, dataset, true)
      await confirmUpload(row, dataset, serverHash)
      return
    }
    if (command.kind === 'patch') {
      const current = recordOf(await apiRequest(`/${command.resource}/${encodeURIComponent(command.resourceId)}`, 'GET', undefined, signal), command.resource === 'workspaces' ? 'workspace' : 'project')
      if (current['id'] !== command.resourceId || !Number.isInteger(current['version'])) throw new ApiError({ kind: 'invalid-response', message: 'Backend không trả version để đối chiếu PATCH.' })
      const matches = Object.entries(command.fields).every(([key, value]) => current[key] === value)
      if (!matches) throw new ApiError({ kind: 'session', code: 'OFFLINE_PATCH_UNCERTAIN', message: 'PATCH chưa thể xác nhận; version hoặc dữ liệu server đã thay đổi. Cần kiểm tra thủ công.' })
      await options.repository.confirm(row.id, current, current['version'] as number)
      notifyConfirmed(row.id)
      await refreshSnapshot(true)
      return
    }
    try {
      await apiRequest(`/${command.resource}/${encodeURIComponent(command.resourceId)}`, 'GET', undefined, signal)
      throw new ApiError({ kind: 'session', code: 'OFFLINE_DELETE_UNCERTAIN', message: 'Đối tượng vẫn tồn tại sau request xóa chưa xác định.' })
    } catch (error) {
      if (normalizeApiError(error).status !== 404) throw error
      await options.repository.confirm(row.id, { deleted: true, resource: command.resource, resourceId: command.resourceId })
      notifyConfirmed(row.id)
      await refreshSnapshot(true)
    }
  }

  const preflight = async (row: OfflineWrite, signal: AbortSignal): Promise<'send' | 'confirmed'> => {
    const command = row.command
    if (command.kind === 'upload') {
      const dataset = await currentDataset(command.resourceId, signal)
      if (!dataset) return 'send'
      const serverHash = assertDatasetMatches(row, dataset, true)
      await confirmUpload(row, dataset, serverHash)
      return 'confirmed'
    }
    if (command.kind !== 'patch') return 'send'
    const current = recordOf(await apiRequest(`/${command.resource}/${encodeURIComponent(command.resourceId)}`, 'GET', undefined, signal), command.resource === 'workspaces' ? 'workspace' : 'project')
    if (current['id'] !== command.resourceId || !Number.isInteger(current['version'])) throw new ApiError({ kind: 'invalid-response', message: 'Backend không trả version để xác minh PATCH.' })
    const fieldsMatch = Object.entries(command.fields).every(([key, value]) => current[key] === value)
    if (current['version'] !== command.expectedVersion) {
      if (fieldsMatch) {
        await options.repository.confirm(row.id, current, current['version'] as number)
        notifyConfirmed(row.id)
        await refreshSnapshot(true)
        return 'confirmed'
      }
      throw new ApiError({ kind: 'http', status: 409, code: 'EXPECTED_VERSION_CONFLICT', message: 'Version trên server đã thay đổi; PATCH được chặn để không ghi đè dữ liệu mới.' })
    }
    return 'send'
  }

  const send = async (row: OfflineWrite, signal: AbortSignal) => {
    const command = row.command
    if (command.kind === 'upload') {
      const form = new FormData()
      form.append('file', new File([command.file], command.fileName, { type: command.mimeType }))
      await apiRequest(`/projects/${encodeURIComponent(command.resourceId)}/datasets/upload`, 'POST', form, signal)
      const dataset = await currentDataset(command.resourceId, signal)
      if (!dataset) throw new ApiError({ kind: 'network', code: 'OFFLINE_UPLOAD_ACK_NOT_VISIBLE', message: 'Upload đã được ACK nhưng dataset chưa xuất hiện để đối chiếu.' })
      const serverHash = assertDatasetMatches(row, dataset, false)
      await confirmUpload(row, dataset, serverHash)
      return
    }
    if (command.kind === 'patch') {
      await apiRequest(`/${command.resource}/${encodeURIComponent(command.resourceId)}`, 'PATCH', {
        ...command.fields, expectedVersion: command.expectedVersion,
      }, signal)
      const current = recordOf(await apiRequest(`/${command.resource}/${encodeURIComponent(command.resourceId)}`, 'GET', undefined, signal), command.resource === 'workspaces' ? 'workspace' : 'project')
      if (current['id'] !== command.resourceId || !Number.isInteger(current['version'])
        || !Object.entries(command.fields).every(([key, value]) => current[key] === value)) {
        throw new ApiError({ kind: 'session', code: 'OFFLINE_PATCH_ACK_MISMATCH', message: 'PATCH đã trả ACK nhưng giá trị server chưa khớp; request cần kiểm tra thủ công.' })
      }
      await options.repository.confirm(row.id, current, current['version'] as number)
      notifyConfirmed(row.id)
      await refreshSnapshot(true)
      return
    }
    await apiRequest(`/${command.resource}/${encodeURIComponent(command.resourceId)}`, 'DELETE', undefined, signal)
    await options.repository.confirm(row.id, { deleted: true, resource: command.resource, resourceId: command.resourceId })
    notifyConfirmed(row.id)
    await refreshSnapshot(true)
  }

  const ensureUploadDraftLinked = async (row: OfflineWrite) => {
    if (row.command.kind !== 'upload') return
    const command = row.command
    const draft = (await options.drafts.list()).find(item => item.id === command.draftId)
    if (!draft || draft.accountId !== row.accountId || draft.projectId !== command.resourceId
      || draft.fileHash?.toLowerCase() !== command.hash.toLowerCase()) {
      throw new ApiError({ kind: 'storage', code: 'OFFLINE_UPLOAD_DRAFT_MISSING', message: 'Không thể gắn queue với draft upload tương ứng; request được chặn để giữ an toàn.' })
    }
    if (draft.queueId && draft.queueId !== row.id) {
      throw new ApiError({ kind: 'storage', code: 'OFFLINE_UPLOAD_DRAFT_ALREADY_QUEUED', message: 'Draft upload đã gắn với request khác; request được chặn để tránh gửi trùng.' })
    }
    if (draft.queueId !== row.id) await options.drafts.markQueued(command.draftId, row.id)
  }

  const repairOrphanUploadDraftLinks = async () => {
    const locks = webLocks()
    if (!locks?.request || disposed) return
    await locks.request(stagingLockName, { mode: 'exclusive' }, async lock => {
      if (!lock || disposed) return
      const [drafts, rows] = await Promise.all([options.drafts.list(), options.repository.list()])
      const queueIds = new Set(rows.map(row => row.id))
      for (const draft of drafts) {
        if (draft.kind === 'project-wizard' || draft.status !== 'queued' || !draft.queueId || queueIds.has(draft.queueId)) continue
        await options.drafts.markUnqueued(draft.id, draft.queueId).catch(() => {})
      }
    })
  }

  const runLocked = async () => {
    if (disposed || paused || !options.isSessionReady() || !navigator.onLine) return
    await repairOrphanUploadDraftLinks().catch(() => {})
    await options.repository.recoverSending()
    await refreshSnapshot()
    for (;;) {
      if (disposed || paused || !options.isSessionReady() || !navigator.onLine) return
      const rows = await options.repository.list()
      const next = rows.find(row => row.state !== 'confirmed')
      if (!next) return
      if (next.state === 'blocked') return
      const controller = new AbortController()
      activeController = controller
      if (next.state === 'uncertain') {
        try {
          await confirmReconciledRow(next, controller.signal)
          continue
        } catch (error) {
          if (controller.signal.aborted || normalizeApiError(error).kind === 'cancelled') return
          const failure = normalizeApiError(error)
          const transportFailure = failure.kind === 'network' || failure.kind === 'timeout'
            || failure.kind === 'http' && ((failure.status ?? 0) >= 500 || failure.status === 408)
          if (transportFailure) {
            await setRowState(next, 'uncertain', failure.message).catch(() => {})
            options.targetManager.reportTransportFailure(failure)
            return
          }
          await setRowState(next, 'blocked', normalizeApiError(error).message)
          return
        } finally { if (activeController === controller) activeController = undefined }
      }
      if (next.state !== 'queued') return
      if (now() < retryAt) return
      let writeMayHaveStarted = false
      try {
        await ensureUploadDraftLinked(next)
        const decision = await preflight(next, controller.signal)
        if (decision === 'confirmed') continue
        await options.repository.update(next.id, { state: 'sending', attempts: next.attempts + 1, error: undefined })
        await refreshSnapshot(true)
        if (next.command.kind === 'upload') await options.drafts.markUploadStarted(next.command.draftId)
        writeMayHaveStarted = true
        await send(next, controller.signal)
      } catch (error) {
        const failure = normalizeApiError(error)
        const persisted = (await options.repository.list().catch(() => [])).find(row => row.id === next.id)
        if (persisted?.state === 'confirmed') {
          await refreshSnapshot(true)
          return
        }
        if (failure.kind === 'session' && failure.code === 'SESSION_NOT_READY') {
          const state = writeMayHaveStarted ? 'uncertain' : 'queued'
          await setRowState(next, state, 'Phiên cần được xác nhận lại trước khi tiếp tục queue.').catch(() => {})
          void options.recoverSession().catch(error => publish({ error: normalizeApiError(error).message }))
          return
        }
        if (controller.signal.aborted || failure.kind === 'cancelled') {
          const state = writeMayHaveStarted ? 'uncertain' : 'queued'
          await setRowState(next, state, state === 'queued'
            ? 'Request chưa bắt đầu gửi; sẽ thử lại sau khi API target mới sẵn sàng.'
            : 'Request đã bị ngắt; backend sẽ được đối chiếu trước khi tiếp tục.').catch(() => {})
          return
        }
        if (failure.kind === 'http' && failure.status === 429) {
          retryAt = now() + (failure.retryAfterMs ?? 30_000)
          await setRowState(next, 'queued', failure.message)
          return
        }
        const conflict = failure.status === 409 || failure.status === 412
          || failure.code?.toLowerCase().includes('version') === true
          || failure.code?.toLowerCase().includes('conflict') === true
        const transportFailure = failure.kind === 'network' || failure.kind === 'timeout'
          || failure.kind === 'http' && ((failure.status ?? 0) >= 500 || failure.status === 408)
        if (!writeMayHaveStarted && transportFailure) {
          await setRowState(next, 'queued', failure.message).catch(() => {})
          options.targetManager.reportTransportFailure(failure)
          return
        }
        const state: OfflineWrite['state'] = conflict || !transportFailure ? 'blocked' : 'uncertain'
        await setRowState(next, state, failure.message).catch(() => {})
        if (state === 'uncertain') {
          options.targetManager.reportTransportFailure(failure)
          return
        }
        return
      } finally { if (activeController === controller) activeController = undefined }
      await refreshSnapshot(true)
    }
  }

  const sync = (): Promise<void> => {
    if (activeTask) return activeTask
    if (disposed || paused || !options.isSessionReady() || !navigator.onLine) return Promise.resolve()
    const task = (async () => {
      let syncError: string | null = null
      publish({ syncing: true, error: null })
      try {
        const locks = webLocks()
        if (!locks?.request) throw new ApiError({ kind: 'config', code: 'WEB_LOCKS_UNAVAILABLE', message: 'Trình duyệt chưa hỗ trợ Web Locks; queue được giữ nhưng chưa thể đồng bộ an toàn giữa các tab.' })
        await locks.request(lockName, { mode: 'exclusive', ifAvailable: true }, async lock => {
          if (!lock || disposed || paused) return
          await runLocked()
        })
      } catch (error) {
        syncError = normalizeApiError(error).message
      } finally {
        activeController = undefined
        publish({ syncing: false })
        activeTask = undefined
        await refreshSnapshot()
        if (syncError) publish({ error: syncError })
      }
    })()
    activeTask = task
    return task
  }

  const toUploadCommand = async (parsed: ParsedCommand, request: ApiRequestOptions): Promise<ParsedCommand> => {
    if (parsed.command.kind !== 'upload') return parsed
    const command = parsed.command
    const fileHash = await sha256Blob(command.file)
    if (request.deferredDraftId !== command.draftId) throw new ApiError({ kind: 'config', message: 'Draft ID không khớp request upload.' })
    const draft = (await options.drafts.list()).find(item => item.id === command.draftId)
    if (!draft || draft.accountId !== options.repository.scope().accountId || draft.kind === 'project-wizard'
      || draft.projectId !== command.resourceId || draft.fileName !== command.fileName || draft.sizeBytes !== command.file.size
      || draft.fileHash?.toLowerCase() !== fileHash.toLowerCase()) {
      throw new ApiError({ kind: 'storage', code: 'OFFLINE_UPLOAD_DRAFT_MISMATCH', message: 'Draft upload không khớp tài khoản, project hoặc hash của payload.' })
    }
    if (!draft.queueId && (draft.status === 'uploading' || draft.status === 'acknowledged' || draft.status === 'uploaded')) {
      throw new ApiError({ kind: 'storage', code: 'OFFLINE_UPLOAD_OUTCOME_UNCERTAIN', message: 'Draft có lần upload cũ chưa gắn queue; cần đối chiếu backend trước khi gửi lại.' })
    }
    return { ...parsed, command: { ...command, hash: fileHash } }
  }

  const enqueue = async (request: ApiRequestOptions, uncertain = false): Promise<OfflineWriteReceipt> => {
    const parsed = parseAllowlistedRequest(request)
    if (!parsed) throw new ApiError({ kind: 'config', code: 'OFFLINE_WRITE_NOT_ALLOWLISTED', message: 'Request này không thuộc allowlist offline; request không được gửi hoặc xếp hàng.' })
    if (disposed) throw new ApiError({ kind: 'cancelled', message: 'Runtime đã đóng trước khi request được lưu vào queue.' })
    if (!webLocks()?.request) throw new ApiError({ kind: 'config', code: 'WEB_LOCKS_UNAVAILABLE', message: 'Trình duyệt chưa hỗ trợ Web Locks; request chưa được đưa vào queue.' })
    const prepared = await toUploadCommand(parsed, request)
    const command = prepared.command
    let row: OfflineWrite | undefined
    if (command.kind === 'upload') {
      const locks = webLocks()
      if (!locks?.request) throw new ApiError({ kind: 'config', code: 'WEB_LOCKS_UNAVAILABLE', message: 'Trình duyệt chưa hỗ trợ Web Locks; upload chưa được đưa vào queue và draft vẫn được giữ.' })
      await locks.request(stagingLockName, { mode: 'exclusive' }, async lock => {
        if (!lock || disposed) throw new ApiError({ kind: 'cancelled', message: 'Runtime đã đóng trước khi upload được lưu vào queue.' })
        const duplicateId = await options.repository.findDuplicate(command)
        if (duplicateId) row = (await options.repository.list()).find(item => item.id === duplicateId)
        if (!row) {
          const draft = (await options.drafts.list()).find(item => item.id === command.draftId)
          if (!draft) throw new ApiError({ kind: 'storage', code: 'OFFLINE_UPLOAD_DRAFT_MISSING', message: 'Không tìm thấy draft upload để gắn với queue.' })
          if (draft.queueId && draft.status !== 'queued') {
            throw new ApiError({ kind: 'storage', code: 'OFFLINE_UPLOAD_OUTCOME_UNCERTAIN', message: 'Draft cho biết upload đã bắt đầu nhưng command tương ứng không còn trong queue; cần kiểm tra thủ công.' })
          }
          const existingRows = await options.repository.list()
          const requestedId = draft.queueId ?? crypto.randomUUID()
          if (existingRows.some(item => item.id === requestedId)) {
            throw new ApiError({ kind: 'storage', code: 'OFFLINE_UPLOAD_QUEUE_LINK_MISMATCH', message: 'Draft đang trỏ tới một queue command khác; cần kiểm tra trước khi gửi.' })
          }
          // Commit the draft link first. A worker cannot see the command until this link is durable.
          if (draft.queueId !== requestedId) await options.drafts.markQueued(draft.id, requestedId)
          try {
          const queueId = await options.repository.add(command, prepared.label, uncertain, requestedId)
            row = (await options.repository.list()).find(item => item.id === queueId)
          } catch (error) {
            await options.drafts.markUnqueued(draft.id, requestedId).catch(() => {})
            throw error
          }
        }
        if (!row) throw new ApiError({ kind: 'storage', message: 'Upload chưa được lưu bền vững vào queue.' })
        if (row.state === 'confirmed') await confirmUploadFromSavedAck(row).catch(() => {})
        else {
          try { await ensureUploadDraftLinked(row) }
          catch (error) {
            const failure = normalizeApiError(error)
            await options.repository.update(row.id, { state: 'blocked', error: failure.message })
            row = { ...row, state: 'blocked', error: failure.message }
          }
        }
        row = (await options.repository.list()).find(item => item.id === row?.id)
      })
    } else {
      const duplicateId = await options.repository.findDuplicate(command)
      if (duplicateId) row = (await options.repository.list()).find(item => item.id === duplicateId)
      if (!row) {
        const queueId = await options.repository.add(command, prepared.label, uncertain)
        row = (await options.repository.list()).find(item => item.id === queueId)
      }
    }
    if (!row) throw new ApiError({ kind: 'storage', message: 'Request chưa được lưu bền vững vào queue.' })
    await refreshSnapshot(true)
    // Receipt is returned only after IndexedDB and upload-draft association have committed.
    if (row.state !== 'blocked' && row.state !== 'confirmed') {
      const schedule = () => queueMicrotask(() => { if (!disposed) void sync() })
      if (activeTask) void activeTask.then(schedule, schedule)
      else schedule()
    }
    return receipt(row)
  }

  async function confirmUploadFromSavedAck(row: OfflineWrite) {
    if (row.command.kind !== 'upload' || row.state !== 'confirmed' || !isRecord(row.response)
      || typeof row.response['datasetId'] !== 'string') return false
    const command = row.command
    const drafts = await options.drafts.list()
    const draft = drafts.find(item => item.id === command.draftId)
    if (!draft) {
      scheduleConfirmedRemoval(row.id)
      return true
    }
    if (draft.queueId && draft.queueId !== row.id) {
      throw new ApiError({ kind: 'storage', code: 'OFFLINE_UPLOAD_DRAFT_ALREADY_QUEUED', message: 'Draft upload đã gắn với request khác; giữ nguyên file để kiểm tra.' })
    }
    if (draft.queueId !== row.id) await options.drafts.markQueued(command.draftId, row.id)
    const cleanup = await options.drafts.confirmUploaded(command.draftId, {
      accountId: row.accountId, projectId: command.resourceId, datasetId: row.response['datasetId'],
      fileName: command.fileName, sizeBytes: command.file.size, fileHash: command.hash,
      queueId: row.id, queueHash: command.hash,
      ...(typeof row.response['serverHash'] === 'string' ? { serverHash: row.response['serverHash'] } : {}),
    })
    if (cleanup.cleaned) scheduleConfirmedRemoval(row.id)
    return cleanup.cleaned
  }

  const refreshAllConfirmedDrafts = async () => {
    try {
      for (const row of await options.repository.list()) {
        if (row.state === 'confirmed' && row.command.kind === 'upload') await confirmUploadFromSavedAck(row).catch(() => false)
      }
      await refreshSnapshot(true)
    } catch { /* Session changes are retried after the session gate opens. */ }
  }

  const cancel = async (id: string, expectedState: 'queued' | 'confirmed' = 'queued') => {
    const locks = webLocks()
    if (!locks?.request) throw new ApiError({ kind: 'config', code: 'WEB_LOCKS_UNAVAILABLE', message: 'Cần Web Locks để thay đổi queue an toàn giữa các tab.' })
    await locks.request(lockName, { mode: 'exclusive' }, async lock => {
      if (!lock || disposed) throw new ApiError({ kind: 'cancelled', message: 'Không thể thay đổi queue khi runtime đã đóng.' })
      const row = (await options.repository.list()).find(item => item.id === id)
      if (!row) return
      if (expectedState === 'confirmed') {
        if (row.state !== 'confirmed') throw new ApiError({ kind: 'session', message: 'Request chưa được xác nhận; không thể xóa khỏi lịch sử.' })
        if (row.command.kind === 'upload') {
          const draftId = row.command.draftId
          const draftStillNeedsCleanup = (await options.drafts.list()).some(draft => draft.id === draftId)
          if (draftStillNeedsCleanup) {
            throw new ApiError({ kind: 'storage', code: 'OFFLINE_UPLOAD_ACK_CLEANUP_PENDING', message: 'Backend đã xác nhận upload nhưng draft chưa dọn xong; giữ ACK để tự thử dọn lại.' })
          }
        }
        await options.repository.remove(id)
        return
      }
      if (row.state !== 'queued' || row.attempts !== 0) throw new ApiError({ kind: 'session', message: 'Request đã bắt đầu xử lý; không thể bỏ queue an toàn.' })
      if (row.command.kind === 'upload') await options.drafts.markUnqueued(row.command.draftId, row.id)
      await options.repository.remove(id)
    })
    await refreshSnapshot(true)
  }

  const recheck = async (id: string) => {
    const locks = webLocks()
    if (!locks?.request) throw new ApiError({ kind: 'config', code: 'WEB_LOCKS_UNAVAILABLE', message: 'Cần Web Locks để thay đổi queue an toàn giữa các tab.' })
    await locks.request(lockName, { mode: 'exclusive' }, async lock => {
      if (!lock || disposed) throw new ApiError({ kind: 'cancelled', message: 'Không thể đối chiếu queue khi runtime đã đóng.' })
      const row = (await options.repository.list()).find(item => item.id === id)
      if (!row || row.state === 'confirmed') return
      if (row.state === 'blocked') await options.repository.update(id, { state: 'uncertain', error: undefined })
    })
    retryAt = 0
    await refreshSnapshot(true)
    await activeTask?.catch(() => {})
    await sync()
  }

  const worker = {
    async pauseForApiTargetSwitch() {
      paused = true
      activeController?.abort()
      await activeTask?.catch(() => {})
    },
    resumeAfterApiTargetSwitch() {
      if (disposed) return
      paused = false
      queueMicrotask(() => { void sync() })
    },
  }
  const unregisterWorker = options.targetManager.registerWorker(worker)
  const recoverSessionAndSync = () => {
    void options.recoverSession()
      .catch(error => publish({ error: normalizeApiError(error).message }))
      .finally(() => { void sync() })
  }
  const onOnline = () => {
    recoverSessionAndSync()
  }
  const onChannel = (event: MessageEvent) => { if (event.data?.type === 'changed') void refreshSnapshot() }
  if (typeof window !== 'undefined') window.addEventListener('online', onOnline)
  channel?.addEventListener('message', onChannel)
  void repairOrphanUploadDraftLinks().catch(() => {})
  const interval = typeof window === 'undefined' ? undefined : window.setInterval(() => {
    if (!options.isSessionReady()) recoverSessionAndSync()
    else void sync()
    void refreshSnapshot()
    void refreshAllConfirmedDrafts()
    void repairOrphanUploadDraftLinks().catch(() => {})
  }, intervalMs)
  void refreshSnapshot()

  const port: OfflineWritePort = {
    getSnapshot: () => snapshot,
    subscribe: listener => { listeners.add(listener); return () => { listeners.delete(listener) } },
    accepts: request => parseAllowlistedRequest(request) !== null,
    enqueue,
    sync,
    cancel,
    recheck,
  }

  return {
    ...port,
    refresh: () => refreshSnapshot(),
    dispose() {
      if (disposed) return
      disposed = true
      paused = true
      activeController?.abort()
      unregisterWorker()
      if (typeof window !== 'undefined') {
        window.removeEventListener('online', onOnline)
        if (interval !== undefined) window.clearInterval(interval)
      }
      channel?.removeEventListener('message', onChannel)
      channel?.close()
      for (const timer of confirmedRemovalTimers.values()) clearTimeout(timer)
      confirmedRemovalTimers.clear()
      listeners.clear()
    },
  }
}

export const isOfflineWriteReceipt = receiptShape
