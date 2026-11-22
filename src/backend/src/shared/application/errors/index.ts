/**
 * Public contract của lớp lỗi ở tầng application.
 *
 * Tầng `application` và `infrastructure` import qua `index.ts` này để giữ
 * hợp đồng ổn định (CA8 — cross-module import phải đi qua public contract).
 */

export { StatusError } from './status.error';
