/**
 * USER SESSION — Aggregate root.
 *
 * **Vì sao cần entity thay vì `UserSessionRecord` (interface trần)?**
 * Trước Bước 3, vòng đời phiên nằm rải rác:
 *   - `session-policy.vo.ts`: hạn 7 ngày (thường) / 30 ngày (ghi nhớ đăng nhập).
 *   - `revoke-session.handler.ts` / `revoke-all-user-sessions.handler.ts`:
 *     thu hồi phiên.
 *   - `touch-session.handler.ts`: đánh dấu phiên vừa dùng.
 *   - Repository: lọc `is_revoked: false, expires_at > now` khi tìm phiên hoạt động.
 *
 * Rủi ro: logic "phiên còn hiệu lực" bị viết lại ở nhiều nơi với điều kiện
 * khác nhau → dễ lệch hành vi. Entity gom vào **một chỗ** (Phần 5 §3.3).
 *
 * **Quy tắc bất di bất dịch:**
 *   1. State riêng tư + getter công khai — không có setter tự do.
 *   2. `static create()` (tạo mới) và `static reconstitute()` (dựng lại từ DB).
 *   3. Invariant kiểm tra trong entity, ném `DomainError` — **không** ném
 *      `HttpException` (Bước 2) và **không** ném `Error` trần.
 */
import {
  BaseEntity,
  type BaseEntityProps,
} from '../../../../shared/domain/entities';
import {
  ConflictError,
  ForbiddenError,
} from '../../../../shared/domain/errors';
import {
  isSessionExpired,
  sessionExpiry,
} from '../value-objects/session-policy.vo';

/** Props đầy đủ của aggregate user session. */
export interface UserSessionProps extends BaseEntityProps {
  userId: string;
  refreshTokenHash: string;
  deviceName: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  isRevoked: boolean;
  /** Cờ "ghi nhớ đăng nhập" — phiên sống lâu hơn (30 ngày thay vì 7). */
  rememberMe: boolean;
  /** Lần cuối phiên được dùng (refresh token). */
  lastUsedAt: Date | null;
  expiresAt: Date;
}

/**
 * Aggregate root `UserSession`.
 *
 * Đặc tính:
 *   - **Hạn phiên theo chính sách** — `rememberMe` quyết định 7 hay 30 ngày.
 *   - **`isActive()`** — nguồn sự thật duy nhất cho "phiên còn dùng được".
 *   - **Thu hồi là hành vi của entity** — `revoke()` chặn thu hồi 2 lần.
 */
export class UserSession extends BaseEntity<UserSessionProps> {
  private constructor(props: UserSessionProps) {
    super(props);
  }

  // ── Getters ──────────────────────────────────────────────────────────────

  get userId(): string {
    return this.props.userId;
  }

  get refreshTokenHash(): string {
    return this.props.refreshTokenHash;
  }

  get deviceName(): string | null {
    return this.props.deviceName;
  }

  get ipAddress(): string | null {
    return this.props.ipAddress;
  }

  get userAgent(): string | null {
    return this.props.userAgent;
  }

  get isRevoked(): boolean {
    return this.props.isRevoked;
  }

  get rememberMe(): boolean {
    return this.props.rememberMe;
  }

  get lastUsedAt(): Date | null {
    return this.props.lastUsedAt;
  }

  get expiresAt(): Date {
    return this.props.expiresAt;
  }

  // ── Factory ──────────────────────────────────────────────────────────────

  /**
   * Tạo phiên đăng nhập mới.
   *
   * Nếu không truyền `expiresAt`, hạn được tính theo chính sách
   * (`rememberMe` → 30 ngày, ngược lại 7 ngày).
   */
  static create(props: {
    id: string;
    userId: string;
    refreshTokenHash: string;
    deviceName?: string | null;
    ipAddress?: string | null;
    userAgent?: string | null;
    rememberMe?: boolean;
    expiresAt?: Date;
    now?: Date;
  }): UserSession {
    const now = props.now ?? new Date();
    const rememberMe = props.rememberMe === true;
    return new UserSession({
      id: props.id,
      userId: props.userId,
      refreshTokenHash: props.refreshTokenHash,
      deviceName: props.deviceName ?? null,
      ipAddress: props.ipAddress ?? null,
      userAgent: props.userAgent ?? null,
      isRevoked: false,
      rememberMe,
      lastUsedAt: now,
      expiresAt: props.expiresAt ?? sessionExpiry(now, rememberMe),
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
      version: 1,
    });
  }

  /**
   * Dựng lại phiên từ dữ liệu đã lưu — **không** phát event.
   */
  static reconstitute(props: UserSessionProps): UserSession {
    return new UserSession({ ...props });
  }

  // ── Truy vấn ─────────────────────────────────────────────────────────────

  /** Phiên còn hiệu lực (chưa thu hồi, chưa hết hạn). */
  isActive(now: Date = new Date()): boolean {
    return !this.props.isRevoked && !isSessionExpired(this.props.expiresAt, now);
  }

  /** Phiên đã hết hạn. */
  isExpired(now: Date = new Date()): boolean {
    return isSessionExpired(this.props.expiresAt, now);
  }

  // ── Hành vi ──────────────────────────────────────────────────────────────

  /**
   * Đánh dấu phiên vừa được dùng (refresh token).
   */
  touch(at: Date = new Date()): void {
    this.props.lastUsedAt = at;
    this.props.updatedAt = at;
  }

  /**
   * Thu hồi phiên.
   *
   * Invariant: thu hồi phiên đã thu hồi → `ConflictError`.
   */
  revoke(): void {
    if (this.props.isRevoked) {
      throw new ConflictError('Phiên đăng nhập đã bị thu hồi');
    }
    this.props.isRevoked = true;
    this.props.updatedAt = new Date();
  }

  /**
   * Kiểm tra phiên dùng được — ném lỗi nếu không.
   *
   * Invariant:
   *   - Đã thu hồi → `ForbiddenError`.
   *   - Hết hạn → `ForbiddenError`.
   */
  assertUsable(now: Date = new Date()): void {
    if (this.props.isRevoked) {
      throw new ForbiddenError('Phiên đăng nhập đã bị thu hồi');
    }
    if (isSessionExpired(this.props.expiresAt, now)) {
      throw new ForbiddenError('Phiên đăng nhập đã hết hạn');
    }
  }

  /** Bản chụp props — dùng cho mapper chuyển entity → persistence. */
  toProps(): UserSessionProps {
    return { ...this.props };
  }
}
