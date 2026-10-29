import axios from 'axios'
import type { AppError, AppErrorKind } from '../types/api/api.types'

// Không giữ cause/config/response thô vì chúng có thể chứa credential.
export class ApiError extends Error implements AppError {
  readonly kind: AppErrorKind
  readonly status?: number
  readonly code?: string
  readonly fieldErrors?: Record<string, string[]>

  constructor(details: AppError) {
    super(details.message)
    this.name = 'ApiError'
    this.kind = details.kind
    this.status = details.status
    this.code = details.code
    this.fieldErrors = details.fieldErrors
  }
}

export const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

const readServerError = (body: unknown): Record<string, unknown> | null => {
  if (!isRecord(body) || body.success !== false || !isRecord(body.error)) {
    return null
  }

  return body.error
}

const readFieldErrors = (message: unknown): Record<string, string[]> | undefined => {
  if (!Array.isArray(message)) return undefined

  const fields = new Map<string, string[]>()

  for (const item of message) {
    if (
      isRecord(item)
      && typeof item.field === 'string'
      && item.field.length > 0
      && typeof item.message === 'string'
    ) {
      const messages = fields.get(item.field) ?? []
      messages.push(item.message)
      fields.set(item.field, messages)
    }
  }

  return fields.size > 0 ? Object.fromEntries(fields) : undefined
}

export const normalizeApiError = (error: unknown): ApiError => {
  if (error instanceof ApiError) return error

  if (axios.isCancel(error)) {
    return new ApiError({ kind: 'cancelled', message: 'Yêu cầu đã bị hủy ở phía client.' })
  }

  if (axios.isAxiosError<unknown>(error)) {
    if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
      return new ApiError({ kind: 'timeout', message: 'Đã hết thời gian chờ phản hồi.' })
    }

    if (error.response) {
      const status = error.response.status
      const serverError = readServerError(error.response.data)
      // Lỗi 5xx không đưa message nội bộ của backend ra giao diện.
      const isClientError = status >= 400 && status < 500
      const message = isClientError && typeof serverError?.message === 'string'
        ? serverError.message
        : status >= 500
          ? 'Máy chủ chưa xử lý được yêu cầu. Vui lòng thử lại sau.'
          : 'Yêu cầu không được máy chủ chấp nhận.'

      return new ApiError({
        kind: 'http',
        status,
        message,
        code: isClientError && typeof serverError?.code === 'string'
          ? serverError.code
          : undefined,
        // Chỉ map field khi response thực sự có danh sách field/message.
        fieldErrors: isClientError ? readFieldErrors(serverError?.message) : undefined,
      })
    }

    return new ApiError({ kind: 'network', message: 'Không thể nhận phản hồi từ API.' })
  }

  return new ApiError({
    kind: 'invalid-response',
    message: 'Không thể xử lý phản hồi API.',
  })
}
