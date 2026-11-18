import { DomainError } from '../../domain/errors/domain-error';
import type { ErrorCode } from '../../domain/errors/error-codes';

/**
 * `StatusError` — lỗi nghiệp vụ **có HTTP status tường minh**.
 *
 * Khi nào dùng?
 *   Khi hợp đồng API của một endpoint **bắt buộc** một status cụ thể mà
 *   không thể suy ra từ mã lỗi. Ví dụ (Phần 7 §3.4, luồng Google OAuth):
 *
 *   | HTTP | `error.code`      | `details.reason`          |
 *   |------|-------------------|---------------------------|
 *   | 401  | `VALIDATION_ERROR` | `invalid_oauth_state`, …  |
 *
 *   `VALIDATION_ERROR` mặc định map sang **400**. Nhưng endpoint
 *   `GET /auth/google/callback` khi Google từ chối yêu cầu phải trả **401**
 *   (theo hợp đồng Phần 7 §3.4 và test e2e `google-oauth.e2e-spec.ts`).
 *
 * Vì sao đặt ở `shared/application/` chứ không phải `shared/domain/`?
 *   - `shared/domain/` phải **thuần tuyệt đối** (CA13) — không được biết HTTP.
 *   - Sự kiện "endpoint này cần status 401" là quyết định của **tầng trên
 *     domain**, không phải của kernel nghiệp vụ thuần.
 *   - Tầng `application` và `infrastructure` đều cần dùng → đặt ở đây giúp
 *     cả hai cùng import (không vi phạm CA19: `infrastructure` không import
 *     `shared/interfaces`).
 */
export class StatusError extends DomainError {
  /** HTTP status tường minh — ghi đè ánh xạ mặc định theo mã. */
  readonly status: number;

  constructor(status: number, code: ErrorCode, message: string, details?: unknown) {
    super(code, message, details);
    this.status = status;
  }
}
