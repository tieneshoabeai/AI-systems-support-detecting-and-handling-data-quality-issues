import { randomBytes } from 'crypto';

/** Shared ObjectId helper — Application/Domain được phép dùng, không cần mongoose. */
export function isObjectIdHex(id: string): boolean {
  return typeof id === 'string' && /^[0-9a-fA-F]{24}$/.test(id);
}

/**
 * Sinh id dạng hex 24 ký tự (giống ObjectId của MongoDB) — cho tầng
 * application/domain cần tạo aggregate trước khi DB sinh `_id`.
 *
 * **Vì sao cần?** Aggregate như `UserSession` được tạo ở tầng application
 * (domain cần id để phát domain event / gắn vào payload), nhưng id thật do
 * DB sinh. Ta sinh id ở tầng application để **domain không phụ thuộc Mongoose**.
 */
export function newObjectIdHex(): string {
  return randomBytes(12).toString('hex');
}
