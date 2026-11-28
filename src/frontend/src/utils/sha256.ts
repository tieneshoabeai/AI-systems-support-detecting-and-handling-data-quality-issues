import { ApiError } from '../lib/api-error'

export async function sha256Blob(blob: Blob): Promise<string> {
  if (!globalThis.crypto?.subtle) {
    throw new ApiError({ kind: 'storage', code: 'DRAFT_HASH_UNAVAILABLE', message: 'Trình duyệt không hỗ trợ SHA-256 để xác minh bản nháp.' })
  }
  try {
    const digest = await crypto.subtle.digest('SHA-256', await blob.arrayBuffer())
    return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('')
  } catch {
    throw new ApiError({ kind: 'storage', code: 'DRAFT_HASH_FAILED', message: 'Không thể tính SHA-256 cho file bản nháp.' })
  }
}
