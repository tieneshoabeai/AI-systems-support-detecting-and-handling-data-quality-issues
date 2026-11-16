/**
 * DATASETS — Hàm thuần dùng chung cho handlers.
 *
 * Tách ra khỏi service gốc khi áp dụng §3.10 Command/Query pattern.
 */

import { BadRequestException } from '@nestjs/common';
import * as crypto from 'crypto';

export function validationError(message: string, details?: unknown): BadRequestException {
  return new BadRequestException({
    message,
    error: 'VALIDATION_ERROR',
    details,
  } as never);
}

export function unsupportedFileType(fileName: string): BadRequestException {
  return new BadRequestException({
    message: `Chi ho tro file .csv (nhan duoc: ${fileName})`,
    error: 'UNSUPPORTED_FILE_TYPE',
  } as never);
}

export function assertCsvMagicBytes(head: Buffer, fileName: string): void {
  if (head.length === 0) return;
  // Excel OOXML (PK..) hoặc OLE2 (D0 CF..) có mật khẩu -> từ chối rõ lý do
  if (head.length >= 4 && head[0] === 0x50 && head[1] === 0x4b) {
    throw new BadRequestException({
      message: 'File Excel không được chấp nhận. Vui lòng xuất sang CSV.',
      error: 'VALIDATION_ERROR',
      details: { reason: 'excel_not_allowed', fileName },
    } as never);
  }
  if (
    head.length >= 8 &&
    head[0] === 0xd0 &&
    head[1] === 0xcf &&
    head[2] === 0x11 &&
    head[3] === 0xe0
  ) {
    throw new BadRequestException({
      message: 'File Excel có mật khẩu không được hỗ trợ.',
      error: 'VALIDATION_ERROR',
      details: { reason: 'password_protected', fileName },
    } as never);
  }
  // Từ chối nhị phân (NUL bytes / không phải text)
  const nul = head.includes(0x00);
  if (nul) {
    throw new BadRequestException({
      message: `Chi ho tro file .csv (nhan duoc: ${fileName})`,
      error: 'UNSUPPORTED_FILE_TYPE',
      details: { reason: 'binary_not_csv', fileName },
    } as never);
  }
}

export function newHexId(): string {
  return crypto.randomBytes(12).toString('hex');
}
