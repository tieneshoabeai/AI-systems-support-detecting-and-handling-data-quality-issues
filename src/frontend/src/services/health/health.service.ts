import { ApiError, isRecord } from '../../lib/api-error'
import type { ApiClient } from '../../types/api/api.types'
import type { AuthHealth } from '../../types/health/health.types'

export const createHealthService = (api: ApiClient) => ({
  async check(options: { signal?: AbortSignal } = {}): Promise<AuthHealth> {
    const response = await api.request<unknown>({
      path: '/health', auth: 'public', timeoutMs: 5000, signal: options.signal,
    })
    if (!isRecord(response) || response.status !== 'ok' || !isRecord(response.services)
      || !isRecord(response.services.mongodb_atlas)
      || (response.services.mongodb_atlas.status !== 'connected'
        && response.services.mongodb_atlas.status !== 'disconnected')) {
      throw new ApiError({ kind: 'invalid-response', message: 'Không thể xác nhận trạng thái dịch vụ.' })
    }
    // Neo4j không tự chặn auth; không trả thông tin bucket/hạ tầng cho UI.
    return { available: response.services.mongodb_atlas.status === 'connected' }
  },
})
