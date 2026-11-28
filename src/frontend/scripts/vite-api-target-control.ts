import { createHash, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto'
import { createServer } from 'node:http'
import { mkdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import type { AddressInfo } from 'node:net'
import type { Plugin, ViteDevServer } from 'vite'

const controlPath = '/__dev/api-target'
const controlStatusPath = `${controlPath}/status`
const updateEvent = 'dev-api-target:update'
const cancelEvent = 'dev-api-target:cancel'
const readyEvent = 'dev-api-target:ready'
const acknowledgementEvent = 'dev-api-target:ack'
const environmentIdPattern = /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,63}$/
const prefix = '/api/v1'

type SwaggerTarget = { origin: string; prefix: typeof prefix }
type OperationState = 'waiting_for_tab' | 'backend_ready' | 'rejected'
type Operation = {
  requestId: string
  environmentId: string
  state: OperationState
  message: string
  updatedAt: number
}
type ControlDescriptor = {
  root: string
  pid: number
  vitePort: number
  controlPort: number
  token: string
  environmentId: string
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const parseSwaggerUrl = (value: unknown): SwaggerTarget | null => {
  if (typeof value !== 'string' || value.trim() !== value || value.length > 2048) return null
  try {
    const url = new URL(value)
    const path = url.pathname.replace(/\/$/, '')
    if (url.protocol !== 'https:' || !url.hostname || url.username || url.password
      || url.search || url.hash || !/^\/api\/v1\/docs(?:-json)?$/.test(path)) return null
    return { origin: url.origin, prefix }
  } catch {
    return null
  }
}

const loopbackAddress = (address: string | undefined) =>
  address === '127.0.0.1' || address === '::1' || address === '::ffff:127.0.0.1'

const statusBody = (operation: Operation) => ({
  requestId: operation.requestId,
  state: operation.state,
  message: operation.message,
  environmentId: operation.environmentId,
  updatedAt: operation.updatedAt,
})

export const viteApiTargetControl = (): Plugin => {
  let vite: ViteDevServer | undefined
  let root = ''
  let environmentId = 'qa-main'
  let vitePort = 5173
  let controlPort = 0
  let token = randomBytes(32).toString('hex')
  let descriptorPath = ''
  let controlServer: ReturnType<typeof createServer> | undefined
  const operations = new Map<string, Operation>()
  const acknowledgementTimers = new Map<string, ReturnType<typeof setTimeout>>()

  const updateOperation = (operation: Operation, state: OperationState, message: string) => {
    operation.state = state
    operation.message = message
    operation.updatedAt = Date.now()
  }

  const json = (response: import('node:http').ServerResponse, status: number, value: unknown) => {
    response.writeHead(status, {
      'Cache-Control': 'no-store',
      'Content-Type': 'application/json; charset=utf-8',
      'X-Content-Type-Options': 'nosniff',
    })
    response.end(JSON.stringify(value))
  }

  const authorizedLoopbackRequest = (request: import('node:http').IncomingMessage) => {
    const expectedHost = `127.0.0.1:${controlPort}`
    if (request.socket.remoteAddress === undefined || !loopbackAddress(request.socket.remoteAddress)) return false
    if (request.headers.host !== expectedHost || request.headers.origin !== undefined) return false
    const fetchSite = request.headers['sec-fetch-site']
    if (fetchSite !== undefined && fetchSite !== 'none') return false
    const tokenHeader = request.headers['x-vite-control-token']
    const supplied = Buffer.from(typeof tokenHeader === 'string' ? tokenHeader : '', 'utf8')
    const expected = Buffer.from(token, 'utf8')
    return supplied.length === expected.length && timingSafeEqual(supplied, expected)
  }

  const readJson = async (request: import('node:http').IncomingMessage): Promise<unknown> => {
    if (!request.headers['content-type']?.toLowerCase().startsWith('application/json')) return null
    const chunks: Buffer[] = []
    let length = 0
    for await (const chunk of request) {
      const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
      length += bytes.length
      if (length > 4096) throw new Error('Request body is too large.')
      chunks.push(bytes)
    }
    try { return JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown } catch { return null }
  }

  const handleAcknowledgement = (payload: unknown) => {
    if (!isRecord(payload) || typeof payload['requestId'] !== 'string') return
    const operation = operations.get(payload['requestId'])
    if (!operation || operation.state !== 'waiting_for_tab') return
    const timer = acknowledgementTimers.get(operation.requestId)
    if (timer) clearTimeout(timer)
    acknowledgementTimers.delete(operation.requestId)
    if (payload['environmentId'] !== environmentId || payload['applied'] !== true) {
      const reason = typeof payload['reason'] === 'string' ? payload['reason'].slice(0, 240) : 'Tab từ chối cấu hình.'
      updateOperation(operation, 'rejected', reason)
      return
    }
    updateOperation(operation, 'backend_ready', 'Tab đã xác nhận API mới sau health check và kiểm tra tài khoản.')
    vite?.ws.send(readyEvent, {
      requestId: operation.requestId,
      environmentId: operation.environmentId,
      revision: payload['revision'],
    })
  }

  const serveControlRequest = async (
    request: import('node:http').IncomingMessage,
    response: import('node:http').ServerResponse,
  ) => {
    const url = new URL(request.url ?? '/', `http://127.0.0.1:${controlPort}`)
    if (url.pathname !== controlPath && url.pathname !== controlStatusPath) {
      json(response, 404, { state: 'rejected', message: 'Control endpoint không tồn tại.' })
      return
    }
    if (!authorizedLoopbackRequest(request)) {
      json(response, 403, { state: 'rejected', message: 'Chỉ terminal cục bộ được phép dùng control endpoint.' })
      return
    }

    if (url.pathname === controlStatusPath) {
      if (request.method !== 'GET') { json(response, 405, { state: 'rejected', message: 'Phương thức không được hỗ trợ.' }); return }
      const requestId = url.searchParams.get('requestId') ?? ''
      const operation = operations.get(requestId)
      if (!operation) { json(response, 404, { state: 'rejected', message: 'Không tìm thấy yêu cầu cập nhật.' }); return }
      json(response, 200, statusBody(operation))
      return
    }

    if (request.method !== 'POST') { json(response, 405, { state: 'rejected', message: 'Phương thức không được hỗ trợ.' }); return }
    let body: unknown
    try { body = await readJson(request) } catch {
      json(response, 413, { state: 'rejected', message: 'Request body vượt quá giới hạn.' })
      return
    }
    if (!isRecord(body)) { json(response, 400, { state: 'rejected', message: 'Body JSON không hợp lệ.' }); return }
    const target = parseSwaggerUrl(body['swaggerUrl'])
    if (!target) {
      json(response, 400, { state: 'rejected', message: 'Swagger URL phải có dạng https://<host>/api/v1/docs hoặc /api/v1/docs-json, không có query/hash.' })
      return
    }
    if (typeof body['environmentId'] !== 'string' || !environmentIdPattern.test(body['environmentId'])) {
      json(response, 400, { state: 'rejected', message: 'EnvironmentId không hợp lệ.' })
      return
    }
    if (body['environmentId'] !== environmentId) {
      json(response, 409, { state: 'rejected', message: `EnvironmentId phải khớp với Vite đang chạy (${environmentId}).` })
      return
    }
    if ([...operations.values()].some(operation => operation.state === 'waiting_for_tab')) {
      json(response, 409, { state: 'rejected', message: 'Một lần đổi API target khác vẫn đang được xử lý.' })
      return
    }
    const oldOperations = [...operations.values()].filter(operation => Date.now() - operation.updatedAt > 10 * 60_000)
    for (const operation of oldOperations) operations.delete(operation.requestId)

    const requestId = randomUUID()
    const operation: Operation = {
      requestId,
      environmentId,
      state: 'waiting_for_tab',
      message: 'URL hợp lệ; đang chờ tab xác nhận cấu hình.',
      updatedAt: Date.now(),
    }
    operations.set(requestId, operation)
    const timer = setTimeout(() => {
      if (operation.state === 'waiting_for_tab') {
        updateOperation(operation, 'rejected', 'Tab không xác nhận cấu hình và phiên trong 180 giây.')
        acknowledgementTimers.delete(requestId)
        vite?.ws.send(cancelEvent, { requestId })
      }
    }, 180_000)
    acknowledgementTimers.set(requestId, timer)
    vite?.ws.send(updateEvent, { requestId, ...target, environmentId })
    json(response, 202, statusBody(operation))
  }

  const startControlServer = async (devServer: ViteDevServer) => {
    const handler = (request: import('node:http').IncomingMessage, response: import('node:http').ServerResponse) => {
      void serveControlRequest(request, response).catch(() => {
        if (!response.headersSent) json(response, 500, { state: 'rejected', message: 'Control endpoint gặp lỗi nội bộ.' })
        else response.destroy()
      })
    }
    controlServer = createServer(handler)
    const firstPort = vitePort + 1
    let lastError: unknown
    for (let port = firstPort; port <= firstPort + 20; port += 1) {
      try {
        await new Promise<void>((resolveListen, rejectListen) => {
          const onError = (error: Error) => { controlServer?.off('listening', onListening); rejectListen(error) }
          const onListening = () => { controlServer?.off('error', onError); resolveListen() }
          controlServer?.once('error', onError)
          controlServer?.once('listening', onListening)
          controlServer?.listen(port, '127.0.0.1')
        })
        const address = controlServer.address() as AddressInfo
        controlPort = address.port
        break
      } catch (error) {
        lastError = error
      }
    }
    if (!controlPort) throw new Error(`Không mở được control endpoint trên loopback: ${String(lastError)}`)

    const localAppData = process.env['LOCALAPPDATA']
    const dataDirectory = localAppData
      ? join(localAppData, 'ThuongFEAI', 'vite-control')
      : join(tmpdir(), 'thuongfeai-vite-control')
    const rootHash = createHash('sha256').update(root.toLowerCase()).digest('hex').slice(0, 16)
    descriptorPath = join(dataDirectory, `vite-control-${rootHash}-${vitePort}-${process.pid}.json`)
    await mkdir(dataDirectory, { recursive: true })
    const descriptor: ControlDescriptor = { root, pid: process.pid, vitePort, controlPort, token, environmentId }
    await writeFile(descriptorPath, JSON.stringify(descriptor), { encoding: 'utf8', mode: 0o600 })

    const cleanup = () => {
      for (const timer of acknowledgementTimers.values()) clearTimeout(timer)
      acknowledgementTimers.clear()
      controlServer?.close()
      void rm(descriptorPath, { force: true })
    }
    devServer.httpServer?.once('close', cleanup)
  }

  return {
    name: 'dev-api-target-control',
    apply: 'serve',
    configResolved(config) {
      root = resolve(config.root)
      vitePort = Number(config.server.port ?? 5173)
      environmentId = config.env['VITE_API_ENVIRONMENT_ID']?.trim() || 'qa-main'
      if (!environmentIdPattern.test(environmentId)) throw new Error('VITE_API_ENVIRONMENT_ID không hợp lệ.')
    },
    async configureServer(devServer) {
      vite = devServer
      devServer.ws.on(acknowledgementEvent, handleAcknowledgement)
      await startControlServer(devServer)
    },
  }
}
