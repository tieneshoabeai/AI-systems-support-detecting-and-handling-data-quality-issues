import { composeApiConfig, getInitialApiTarget } from '../configs/api.config'
import type { ApiConfig, ApiTarget, ApiTargetInput, AppError } from '../types'
import { ApiError } from './api-error'

export const API_TARGET_SWITCH_CANCEL_CODE = 'API_TARGET_SWITCH'

export type ApiTargetManagerSnapshot = {
  readonly phase: 'ready' | 'switching' | 'error'
  readonly target: ApiTarget
  readonly pendingTarget: ApiTarget | null
  readonly error: string | null
}

export type ApiTargetRequestLease = {
  readonly target: ApiTarget
  readonly signal: AbortSignal
  release(): void
  wasCancelledForTargetSwitch(): boolean
}

export type ApiTargetWorker = {
  pauseForApiTargetSwitch(): void | Promise<void>
  resumeAfterApiTargetSwitch(target: ApiTarget): void | Promise<void>
}

export type ApiTargetVerifier = (target: ApiTarget, signal: AbortSignal) => Promise<void | (() => void)>

const environmentIdPattern = /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,63}$/

const freezeTarget = (input: ApiTargetInput, revision: number): ApiTarget => {
  if (!environmentIdPattern.test(input.environmentId)) {
    throw new ApiError({ kind: 'config', message: 'EnvironmentId API không hợp lệ.' })
  }
  const config = composeApiConfig(input.baseUrl, input.prefix)
  const apiUrl = new URL(config.baseUrl)
  return Object.freeze({
    baseUrl: apiUrl.origin,
    prefix: apiUrl.pathname.replace(/\/+$/, ''),
    environmentId: input.environmentId,
    revision,
  })
}

export const apiTargetInputFromBaseUrl = (baseUrl: string, environmentId: string): ApiTargetInput => {
  const url = new URL(baseUrl)
  return {
    baseUrl: url.origin,
    prefix: url.pathname.replace(/\/+$/, ''),
    environmentId,
  }
}

const safeSwitchError = (error: unknown) => error instanceof ApiError
  ? error
  : new ApiError({ kind: 'config', message: 'Không thể xác nhận API target mới với backend và phiên hiện tại.' })

export class ApiTargetManager {
  private target: ApiTarget
  private snapshot: ApiTargetManagerSnapshot
  private transitioning = false
  private switchActive = false
  private verifier: ApiTargetVerifier | null = null
  private readonly listeners = new Set<() => void>()
  private readonly outageListeners = new Set<(error: Readonly<AppError>) => void>()
  private readonly workers = new Set<ApiTargetWorker>()
  private readonly workerStates = new Map<ApiTargetWorker, 'paused' | 'running'>()
  private workerSyncTask: Promise<void> = Promise.resolve()
  private sessionReady = false
  private readonly requests = new Set<{
    controller: AbortController
    settled: Promise<void>
    finish(): void
    cancelledForSwitch: boolean
  }>()

  constructor(initialTarget: ApiTargetInput) {
    this.target = freezeTarget(initialTarget, 0)
    this.snapshot = Object.freeze({ phase: 'ready', target: this.target, pendingTarget: null, error: null })
  }

  getSnapshot = (): ApiTargetManagerSnapshot => this.snapshot

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener)
    return () => { this.listeners.delete(listener) }
  }

  subscribeBackendOutages = (listener: (error: Readonly<AppError>) => void): (() => void) => {
    this.outageListeners.add(listener)
    return () => { this.outageListeners.delete(listener) }
  }

  reportTransportFailure = (error: Readonly<AppError>): void => {
    if (!(error.kind === 'network' || error.kind === 'timeout'
      || (error.kind === 'http' && (error.status ?? 0) >= 500))) return
    for (const listener of this.outageListeners) {
      try { listener(error) } catch { /* Outage observers cannot interrupt an API request. */ }
    }
  }

  getTarget = (): ApiTarget => this.target

  getApiConfig = (target: ApiTarget = this.target): ApiConfig => composeApiConfig(target.baseUrl, target.prefix)

  setVerifier = (verifier: ApiTargetVerifier): void => { this.verifier = verifier }

  setSessionReady = async (ready: boolean): Promise<void> => {
    this.sessionReady = ready
    try {
      await this.syncWorkers()
    } catch {
      const message = ready
        ? 'Phiên đã được xác nhận nhưng worker hàng đợi không thể chạy an toàn.'
        : 'Không thể tạm dừng worker hàng đợi khi phiên cần xác nhận lại.'
      this.publish('error', this.target, null, message)
      throw new ApiError({ kind: 'config', message })
    }
  }

  registerWorker = (worker: ApiTargetWorker): (() => void) => {
    this.workers.add(worker)
    void this.syncWorkers().catch(() => {})
    return () => { this.workers.delete(worker); this.workerStates.delete(worker) }
  }

  beginRequest = (options: { requiresSession?: boolean; allowWhenSessionUnverified?: boolean } = {}): ApiTargetRequestLease => {
    if (this.transitioning) {
      throw new ApiError({
        kind: 'cancelled',
        code: API_TARGET_SWITCH_CANCEL_CODE,
        message: 'Request đang tạm dừng trong lúc xác nhận API URL mới.',
      })
    }
    if (options.requiresSession && !this.sessionReady && !options.allowWhenSessionUnverified) {
      throw new ApiError({
        kind: 'session',
        code: 'SESSION_NOT_READY',
        message: 'Yêu cầu đăng nhập đang tạm dừng cho đến khi phiên được xác nhận lại.',
      })
    }
    const controller = new AbortController()
    let settle!: () => void
    const settled = new Promise<void>(resolve => { settle = resolve })
    const record = {
      controller,
      settled,
      finish: () => {},
      cancelledForSwitch: false,
    }
    record.finish = () => {
      if (!this.requests.delete(record)) return
      settle()
    }
    this.requests.add(record)
    return {
      target: this.target,
      signal: controller.signal,
      release: record.finish,
      wasCancelledForTargetSwitch: () => record.cancelledForSwitch,
    }
  }

  async switchTarget(input: ApiTargetInput, externalSignal?: AbortSignal): Promise<ApiTarget> {
    if (this.switchActive) {
      throw new ApiError({ kind: 'config', message: 'Một lần chuyển API URL khác đang được xử lý.' })
    }

    const previous = this.target
    let candidate: ApiTarget
    try {
      candidate = freezeTarget(input, previous.revision + 1)
      if (candidate.environmentId !== previous.environmentId) {
        throw new ApiError({ kind: 'config', message: `EnvironmentId phải giữ nguyên là ${previous.environmentId} khi chỉ đổi tunnel URL.` })
      }
      if (new URL(candidate.baseUrl).protocol !== 'https:') {
        throw new ApiError({ kind: 'config', message: 'API URL mới phải dùng HTTPS.' })
      }
      if (candidate.prefix !== previous.prefix || candidate.prefix !== '/api/v1') {
        throw new ApiError({ kind: 'config', message: 'Chỉ được đổi origin; API prefix phải giữ nguyên là /api/v1.' })
      }
    } catch (error) {
      const failure = safeSwitchError(error)
      this.publish('error', previous, null, failure.message)
      throw failure
    }

    this.transitioning = true
    this.switchActive = true
    const verificationController = new AbortController()
    const abortVerification = () => verificationController.abort(externalSignal?.reason)
    if (externalSignal?.aborted) abortVerification()
    else externalSignal?.addEventListener('abort', abortVerification, { once: true })
    this.publish('switching', previous, candidate, null)
    try {
      try { await this.syncWorkers() } catch {
        throw new ApiError({ kind: 'config', message: 'Không thể tạm dừng worker hàng đợi; API URL hiện tại vẫn được giữ.' })
      }
      if (verificationController.signal.aborted) throw new ApiError({ kind: 'cancelled', message: 'Đã hủy chuyển API URL.' })
      const activeRequests = [...this.requests]
      for (const request of activeRequests) {
        request.cancelledForSwitch = true
        request.controller.abort()
      }
      await this.waitForRequests(activeRequests.map(request => request.settled), 1500)
      if (verificationController.signal.aborted) throw new ApiError({ kind: 'cancelled', message: 'Đã hủy chuyển API URL.' })

      if (!this.verifier) {
        throw new ApiError({ kind: 'config', message: 'API target manager chưa được nối với xác thực phiên.' })
      }
      const commitVerifiedSession = await this.verifier(candidate, verificationController.signal)
      if (verificationController.signal.aborted) {
        throw new ApiError({ kind: 'cancelled', message: 'Xác nhận API target mới đã bị hủy.' })
      }

      // Commit hồ sơ đã xác minh trong cùng lượt đồng bộ trước khi công bố target.
      // Nếu phiên đổi trong lúc health/profile check, API target cũ vẫn được giữ.
      commitVerifiedSession?.()
      this.target = candidate
      this.transitioning = false
      this.publish('ready', candidate, null, null)

      try { await this.syncWorkers() } catch {
        this.publish('error', candidate, null, 'API mới đã được xác nhận nhưng không thể bật lại một worker hàng đợi.')
        await this.syncWorkers().catch(() => {})
      }
      return candidate
    } catch (error) {
      const failure = safeSwitchError(error)
      this.publish('error', this.target, candidate, failure.message)
      throw failure
    } finally {
      externalSignal?.removeEventListener('abort', abortVerification)
      this.transitioning = false
      this.switchActive = false
    }
  }

  private publish(
    phase: ApiTargetManagerSnapshot['phase'],
    target: ApiTarget,
    pendingTarget: ApiTarget | null,
    error: string | null,
  ) {
    this.snapshot = Object.freeze({ phase, target, pendingTarget, error })
    for (const listener of this.listeners) {
      try { listener() } catch { /* Subscribers cannot interrupt a target transition. */ }
    }
  }

  private syncWorkers = (): Promise<void> => {
    const task = this.workerSyncTask.then(async () => {
      const shouldRun = this.sessionReady && this.snapshot.phase === 'ready' && !this.transitioning
      const target = this.target
      const changes = [...this.workers].filter(worker => this.workerStates.get(worker) !== (shouldRun ? 'running' : 'paused'))
      const results = await Promise.allSettled(changes.map(worker => shouldRun
        ? worker.resumeAfterApiTargetSwitch(target)
        : worker.pauseForApiTargetSwitch()))
      for (let index = 0; index < changes.length; index += 1) {
        const worker = changes[index]
        const result = results[index]
        if (!worker || !result) continue
        if (result.status === 'fulfilled') this.workerStates.set(worker, shouldRun ? 'running' : 'paused')
        else this.workerStates.delete(worker)
      }
      for (const worker of this.workerStates.keys()) if (!this.workers.has(worker)) this.workerStates.delete(worker)
      if (results.some(result => result.status === 'rejected')) {
        throw new ApiError({ kind: 'config', message: 'Một worker không thể đổi trạng thái an toàn.' })
      }
    })
    this.workerSyncTask = task.catch(() => {})
    return task
  }

  private async waitForRequests(requests: readonly Promise<void>[], timeoutMs: number) {
    if (requests.length === 0) return
    let timeout: ReturnType<typeof setTimeout> | undefined
    try {
      await Promise.race([
        Promise.all(requests),
        new Promise<void>(resolve => { timeout = setTimeout(resolve, timeoutMs) }),
      ])
    } finally {
      if (timeout !== undefined) clearTimeout(timeout)
    }
  }
}

let sharedManager: ApiTargetManager | null = null

export const getApiTargetManager = (): ApiTargetManager => {
  sharedManager ??= new ApiTargetManager(getInitialApiTarget())
  return sharedManager
}
