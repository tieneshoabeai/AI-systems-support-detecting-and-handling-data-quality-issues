import { ApiError, isRecord } from '../../lib/api-error'
import type { ApiClient } from '../../types'
import type { AuthHealth } from '../../types'

export const createHealthService = (api: ApiClient) => ({
  async readiness(signal: AbortSignal) {
    const result = await api.request<unknown>({ path: '/health/ready', scope: 'health', auth: 'public', timeoutMs: 5000, signal })
    if (!isRecord(result) || result['status'] !== 'ok') {
      throw new ApiError({ kind: 'invalid-response', message: 'Máy chủ trả trạng thái sẵn sàng không hợp lệ.' })
    }
    const checks = isRecord(result['checks']) ? result['checks'] : null
    const mongodb = checks && isRecord(checks['mongodb']) ? checks['mongodb'] : null
    const storage = checks && isRecord(checks['storage']) ? checks['storage'] : null
    return {
      mongo: mongodb?.['status'] === 'ok' ? 'ok' : mongodb?.['status'] === 'fail' ? 'fail' : null,
      storage: storage?.['status'] === 'ok' ? 'ok' : storage?.['status'] === 'fail' ? 'fail' : null,
      storageMode: storage?.['mode'] === 'cloud_s3_r2' ? 'Đám mây' : storage?.['mode'] === 'local_fallback' ? 'Cục bộ' : null,
    }
  },
  async check(options: { signal?: AbortSignal } = {}): Promise<AuthHealth> {
    const response = await api.request<unknown>({
      path: '/health', scope: 'health', auth: 'public', timeoutMs: 5000, ...(options.signal === undefined ? {} : { signal: options.signal }),
    })
    if (!isRecord(response) || response['status'] !== 'ok' || !isRecord(response['services'])
      || !isRecord(response['services']['mongodb_atlas'])
      || (response['services']['mongodb_atlas']['status'] !== 'connected'
        && response['services']['mongodb_atlas']['status'] !== 'disconnected')) {
      throw new ApiError({ kind: 'invalid-response', message: 'Không thể xác nhận trạng thái dịch vụ.' })
    }
    // Neo4j không tự chặn auth; không trả thông tin bucket/hạ tầng cho UI.
    return { available: response['services']['mongodb_atlas']['status'] === 'connected' }
  },
})
