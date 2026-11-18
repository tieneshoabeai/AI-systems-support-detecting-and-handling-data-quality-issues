/**
 * Tiện ích mã hóa và giải mã Opaque Cursor (Base64 URL-safe) phục vụ phân trang Virtual Grid
 */
export class CursorCodec {
  /**
   * Mã hóa payload bất kỳ (ví dụ: { row_index: 500, created_at: '...' }) thành chuỗi Base64
   */
  static encode<T extends Record<string, unknown>>(payload: T): string {
    const jsonString = JSON.stringify(payload);
    return Buffer.from(jsonString, 'utf8').toString('base64url');
  }

  /**
   * Giải mã chuỗi Base64 trở lại đối tượng ban đầu, an toàn không crash nếu chuỗi bị lỗi
   */
  static decode<T extends Record<string, unknown>>(cursor: string): T | null {
    try {
      const jsonString = Buffer.from(cursor, 'base64url').toString('utf8');
      return JSON.parse(jsonString) as T;
    } catch {
      return null;
    }
  }
}
