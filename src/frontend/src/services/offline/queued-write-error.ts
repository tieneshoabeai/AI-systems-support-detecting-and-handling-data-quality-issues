import { ApiError } from '../../lib/api-error'

export class QueuedWriteError extends ApiError {
  readonly operationId: string
  constructor(operationId: string) {
    super({ kind: 'network', code: 'OFFLINE_WRITE_QUEUED', message: 'Đã lưu yêu cầu trên thiết bị. Sẽ tự động gửi khi kết nối lại.' })
    this.operationId = operationId
  }
}
