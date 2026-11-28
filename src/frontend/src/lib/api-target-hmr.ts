import { getApiEnvironmentId } from '../configs/api.config'
import type { ApiTarget, ApiTargetInput } from '../types'
import { ApiError, isRecord, normalizeApiError } from './api-error'
import { getApiTargetManager } from './api-target-manager'

const updateEvent = 'dev-api-target:update'
const cancelEvent = 'dev-api-target:cancel'
const readyEvent = 'dev-api-target:ready'
const acknowledgementEvent = 'dev-api-target:ack'
const environmentPrefix = 'environment:'
const activeSwitches = new Map<string, AbortController>()

if (import.meta.hot) {
  import.meta.hot.on(cancelEvent, (payload: unknown) => {
    if (!isRecord(payload) || typeof payload['requestId'] !== 'string') return
    activeSwitches.get(payload['requestId'])?.abort()
  })

  import.meta.hot.on(updateEvent, (payload: unknown) => {
    const requestId = isRecord(payload) && typeof payload['requestId'] === 'string' ? payload['requestId'] : ''
    void (async () => {
      try {
        if (!requestId || !isRecord(payload)
          || typeof payload['origin'] !== 'string'
          || payload['prefix'] !== '/api/v1'
          || typeof payload['environmentId'] !== 'string') {
          throw new ApiError({ kind: 'config', message: 'Sự kiện đổi API target không hợp lệ.' })
        }
        const expectedEnvironmentId = getApiEnvironmentId().slice(environmentPrefix.length)
        if (payload['environmentId'] !== expectedEnvironmentId) {
          throw new ApiError({ kind: 'config', message: 'EnvironmentId của tab không khớp với Vite đang chạy.' })
        }
        const origin = new URL(payload['origin'])
        if (origin.protocol !== 'https:' || origin.origin !== payload['origin'] || origin.pathname !== '/') {
          throw new ApiError({ kind: 'config', message: 'Origin API mới không hợp lệ.' })
        }
        const target: ApiTargetInput = {
          baseUrl: origin.origin,
          prefix: '/api/v1',
          environmentId: payload['environmentId'],
        }
        const controller = new AbortController()
        activeSwitches.set(requestId, controller)
        try {
          const committed: ApiTarget = await getApiTargetManager().switchTarget(target, controller.signal)
          window.dispatchEvent(new CustomEvent('dev-api-target:applied', {
            detail: { requestId, environmentId: committed.environmentId, revision: committed.revision },
          }))
          import.meta.hot?.send(acknowledgementEvent, {
            requestId,
            environmentId: committed.environmentId,
            applied: true,
            revision: committed.revision,
          })
        } finally {
          if (activeSwitches.get(requestId) === controller) activeSwitches.delete(requestId)
        }
      } catch (error) {
        const failure = error instanceof ApiError ? error : normalizeApiError(error)
        window.dispatchEvent(new CustomEvent('dev-api-target:switch-failed', {
          detail: { requestId, message: failure.message },
        }))
        import.meta.hot?.send(acknowledgementEvent, {
          requestId,
          environmentId: isRecord(payload) ? payload['environmentId'] : '',
          applied: false,
          reason: failure.message,
        })
      }
    })()
  })

  import.meta.hot.on(readyEvent, (payload: unknown) => {
    if (!isRecord(payload) || typeof payload['requestId'] !== 'string'
      || typeof payload['environmentId'] !== 'string') return
    const expectedEnvironmentId = getApiEnvironmentId().slice(environmentPrefix.length)
    if (payload['environmentId'] !== expectedEnvironmentId) return
    window.dispatchEvent(new CustomEvent('dev-api-target:ready', {
      detail: { requestId: payload['requestId'], environmentId: payload['environmentId'], revision: payload['revision'] },
    }))
  })
}
