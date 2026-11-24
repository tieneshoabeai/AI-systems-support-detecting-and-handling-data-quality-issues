/**
 * DATASETS — Hàm thuần dùng chung cho handlers.
 *
 * Tách ra khỏi service gốc khi áp dụng §3.10 Command/Query pattern.
 */

import * as crypto from 'crypto';
import { DomainError, ERROR_CODES, ValidationError } from '../../../shared/domain/errors';

export function validationError(message: string, details?: unknown): DomainError {
  return new ValidationError( message, details);
}

export function unsupportedFileType(fileName: string): DomainError {
  return new DomainError(ERROR_CODES.UNSUPPORTED_FILE_TYPE, `Chi ho tro file .csv (nhan duoc: ${fileName})`);
}

export function assertCsvMagicBytes(head: Buffer, fileName: string): void {
  if (head.length === 0) return;
  // Excel OOXML (PK..) hoặc OLE2 (D0 CF..) có mật khẩu -> từ chối rõ lý do
  if (head.length >= 4 && head[0] === 0x50 && head[1] === 0x4b) {
    throw new ValidationError( 'File Excel không được chấp nhận. Vui lòng xuất sang CSV.', { reason: 'excel_not_allowed', fileName });
  }
  if (
    head.length >= 8 &&
    head[0] === 0xd0 &&
    head[1] === 0xcf &&
    head[2] === 0x11 &&
    head[3] === 0xe0
  ) {
    throw new ValidationError( 'File Excel có mật khẩu không được hỗ trợ.', { reason: 'password_protected', fileName });
  }
  // Từ chối nhị phân (NUL bytes / không phải text)
  const nul = head.includes(0x00);
  if (nul) {
    throw new DomainError(ERROR_CODES.UNSUPPORTED_FILE_TYPE, `Chi ho tro file .csv (nhan duoc: ${fileName})`, { reason: 'binary_not_csv', fileName });
  }
}

export function newHexId(): string {
  return crypto.randomBytes(12).toString('hex');
}
