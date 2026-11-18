import type { User } from '../../domain/entities/user.entity';

/**
 * USERS — Mapper entity domain → HTTP response.
 *
 * **Vì sao cần tầng này?**
 * Entity `User` có state riêng tư + getter, không thể serialize thẳng
 * (`JSON.stringify(entity)` sẽ ra `{}` vì mọi thuộc tính nằm trong `props` riêng
 * tư). Tầng presentation phải **chủ động** ánh xạ từng trường.
 *
 * **Bảo mật — không bao giờ lộ bí mật:**
 *   - `passwordHash` — tuyệt đối không ra response.
 *   - `googleId` — định danh Google, không cần thiết cho client.
 *
 * Trước Bước 3, việc cắt field được làm thủ công ở controller
 * (`toSafeProfile()` — dễ sót). Nay mapper là **đường ra HTTP duy nhất**.
 *
 * **Hợp đồng giữ nguyên:** các trường trả về giống hệt `UserRecord` cũ
 * (Phần 7 §3.2 — camelCase) → không vỡ frontend.
 */

/** DTO trả về cho client — shape giống hệt `UserRecord` cũ (trừ field bí mật). */
export interface UserResponse {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
  phone: string | null;
  bio: string | null;
  role: string;
  notificationsEnabled: boolean;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}

/** Entity → response DTO. */
export function toUserResponse(user: User): UserResponse {
  return {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    avatarUrl: user.avatarUrl,
    phone: user.phone,
    bio: user.bio,
    role: user.role,
    notificationsEnabled: user.notificationsEnabled,
    status: user.status,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

/** Danh sách entity → danh sách response DTO. */
export function toUserResponses(users: User[]): UserResponse[] {
  return users.map(toUserResponse);
}
