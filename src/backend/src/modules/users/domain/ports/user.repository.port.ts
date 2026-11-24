/**
 * USER — Domain repository port (chuẩn hexagonal như dự án mẫu).
 * Application chỉ phụ thuộc port này, không import persistence/schema.
 * Mọi id là string (hex ObjectId), không dùng ObjectId ở tầng domain/application.
 *
 * **Bước 3 — Rich Domain Model:** port trả **entity** `User` / `UserSession`
 * (không phải record trần) → handler có thể gọi hành vi của entity để kiểm tra
 * invariant trước khi ghi.
 */

import type { User } from '../entities/user.entity';
import type { UserSession } from '../entities/user-session.entity';
import type { ListCursor } from '../../../../shared/domain/utils/list-cursor';

export const USER_REPOSITORY_PORT = Symbol('UserRepositoryPort');

/** Re-export từ entity để tầng ngoài không import sâu. */
export type { User, UserProps, AuthProvider } from '../entities/user.entity';
export type { UserSession, UserSessionProps } from '../entities/user-session.entity';

/**
 * Các kiểu sắp xếp được hỗ trợ cho danh sách hồ sơ (ADMIN-01).
 *
 * Hợp đồng §3.4 quy định `sortBy` ∈ {createdAt, updatedAt, name, email, role, status}.
 * Biểu diễn nội bộ dùng mã snake_case để khớp với tên trường trong collection.
 */
export const USER_SORT_OPTIONS = [
  'created_at',
  'updated_at',
  'name',
  'email',
  'role',
  'status',
] as const;

export type UserSort = (typeof USER_SORT_OPTIONS)[number] | string;

/** Chiều sắp xếp. */
export type UserSortOrder = 'asc' | 'desc';

/** Bộ lọc + phân trang keyset cho danh sách hồ sơ. */
export interface UserListQuery {
  search?: string;
  role?: string;
  status?: string;
  sort?: UserSort;
  sortOrder?: UserSortOrder;
  /** Con trỏ keyset đã giải mã — `undefined` khi lấy trang đầu tiên. */
  cursor?: ListCursor;
  limit?: number;
}

/**
 * Input của use-case list hồ sơ (tầng application → HTTP).
 * `cursor` ở đây là chuỗi opaque do client gửi lên, chưa giải mã.
 */
export interface UserListInput {
  search?: string;
  role?: string;
  status?: string;
  sortBy?: string;
  sortOrder?: UserSortOrder;
  cursor?: string;
  limit?: number;
}

/** Dữ liệu tạo tài khoản mới — repository map sang document (id do DB sinh). */
export interface CreateUserInput {
  email: string;
  passwordHash: string | null;
  googleId: string | null;
  authProvider: 'local' | 'google';
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
  role: 'admin' | 'analyst';
}

/** Tạo tài khoản từ hồ sơ Google — không có mật khẩu (`password_hash` để trống). */
export interface CreateUserWithGoogleInput {
  email: string;
  googleId: string;
  firstName: string;
  lastName: string;
  avatarUrl?: string | null;
}

export interface UpdateProfileInput {
  firstName?: string;
  lastName?: string;
  avatarUrl?: string | null;
  phone?: string | null;
  bio?: string | null;
}

/** Dữ liệu tạo phiên đăng nhập (id do DB sinh). */
export interface CreateSessionInput {
  userId: string;
  refreshTokenHash: string;
  deviceName?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  /** Phiên "ghi nhớ đăng nhập" — hạn 30 ngày thay vì 7 ngày. */
  rememberMe?: boolean;
  expiresAt: Date;
}

/** Trạng thái bí mật đặt lại mật khẩu (OTP). */
export interface PasswordResetState {
  tokenHash: string | null;
  expiresAt: Date | null;
  attempts: number;
  sentCount: number;
  windowStart: Date | null;
}

/** User + trạng thái reset mật khẩu (khi cần đọc `password_reset_*`). */
export type UserWithResetSecret = User & PasswordResetState;

export interface UserRepositoryPort {
  findByEmail(email: string, includePassword?: boolean): Promise<User | null>;
  findById(id: string): Promise<User | null>;
  /** Tìm tài khoản theo định danh Google (`sub` của id_token) — dùng cho AUTH-03. */
  findByGoogleId(googleId: string): Promise<User | null>;
  /** Tìm user theo số điện thoại (kiểm tra duy nhất — G1). */
  findByPhone(phone: string): Promise<User | null>;
  /** Lấy nhiều user theo id (populate tên/email thành viên — E6). */
  findByIds(ids: string[]): Promise<User[]>;
  findByIdWithResetSecret(id: string): Promise<UserWithResetSecret | null>;
  findByEmailWithResetSecret(email: string): Promise<UserWithResetSecret | null>;
  setPasswordResetOtp(email: string, tokenHash: string, expiresAt: Date, sentCount: number, windowStart: Date | null): Promise<boolean>;
  incrementResetAttempts(email: string): Promise<number>;
  clearPasswordReset(email: string): Promise<boolean>;
  setPasswordHash(userId: string, passwordHash: string): Promise<boolean>;
  /**
   * Danh sách hồ sơ theo **keyset cursor** (ADMIN-01).
   *
   * Không dùng `countDocuments` — `hasMore` suy ra bằng cách lấy `limit + 1` bản ghi.
   */
  findPaged(opts: UserListQuery): Promise<{ items: User[]; nextCursor: string | null; hasMore: boolean }>;

  create(data: CreateUserInput): Promise<User>;
  /** Tạo tài khoản từ hồ sơ Google (không mật khẩu) — AUTH-03. */
  createWithGoogle(data: CreateUserWithGoogleInput): Promise<User>;
  /**
   * Gắn `google_id` vào một tài khoản đã có (liên kết tự động theo email
   * đã được Google xác minh — AUTH-03).
   *
   * @returns tài khoản sau khi gắn, hoặc `null` nếu không tìm thấy /
   *          `google_id` đã bị một tài khoản khác chiếm.
   */
  linkGoogleId(userId: string, googleId: string): Promise<User | null>;
  updateProfile(userId: string, data: UpdateProfileInput): Promise<User | null>;
  updateNotificationPreferences(userId: string, enabled: boolean): Promise<boolean>;
  /**
   * OPEN-08 — Đổi trạng thái tài khoản (`active` ⇄ `blocked`).
   *
   * Việc khoá tài khoản phải kèm thu hồi realtime (đóng socket ngay) —
   * xem `UserAccessRevocationService`.
   */
  setStatus(userId: string, status: 'active' | 'blocked'): Promise<boolean>;
  softDeleteUser(userId: string): Promise<boolean>;

  createSession(data: CreateSessionInput): Promise<UserSession>;
  findSessionByTokenHashIncludingRevoked(refreshTokenHash: string): Promise<UserSession | null>;
  findActiveSessions(userId: string): Promise<UserSession[]>;
  findSessionByTokenHash(refreshTokenHash: string): Promise<UserSession | null>;
  findSessionById(sessionId: string): Promise<UserSession | null>;
  /** Cập nhật `last_used_at` khi phiên được dùng (refresh token). */
  touchSession(sessionId: string, lastUsedAt: Date): Promise<boolean>;
  revokeSession(userId: string, sessionId: string): Promise<boolean>;
  revokeSessionById(sessionId: string): Promise<boolean>;
  revokeAllUserSessions(userId: string): Promise<number>;
}
