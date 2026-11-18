/**
 * USER — Aggregate root.
 *
 * **Vì sao cần entity thay vì `UserRecord` (interface trần)?**
 * Trước Bước 3, các invariant của user nằm rải rác ở handler:
 *   - `update-profile.handler.ts`: số điện thoại phải duy nhất, tên ≤ 50 ký tự,
 *     giới thiệu ≤ 500 ký tự.
 *   - `create-user.handler.ts`: email phải chuẩn hoá (lowercase/trim) và duy nhất.
 *   - `soft-delete-user.handler.ts`: xoá mềm phải thu hồi toàn bộ phiên.
 *   - `user-role.vo.ts`: chỉ `active` + chưa xoá mới đăng nhập được.
 *
 * Rủi ro: thêm use-case mới → dễ quên một trong các quy tắc trên.
 * Entity gom hết vào **một chỗ**, tự bảo vệ (Phần 5 §3.3).
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
  ValidationError,
} from '../../../../shared/domain/errors';
import {
  canUserLogin,
  isUserBlocked,
  isUserDeleted,
  normalizeEmail,
  type UserRole,
  type UserStatus,
} from '../value-objects/user-role.vo';
import { USER_EVENTS } from '../events/user-events';

/** Nguồn đăng nhập — `local` (email + mật khẩu) hoặc `google` (AUTH-03). */
export type AuthProvider = 'local' | 'google';

/** Giới hạn độ dài trường hồ sơ (khớp `UserSchema`). */
export const MAX_NAME_LENGTH = 50;
export const MAX_BIO_LENGTH = 500;

/** Props đầy đủ của aggregate user. */
export interface UserProps extends BaseEntityProps {
  email: string;
  /** Hash mật khẩu — **không** bao giờ lộ ra response. */
  passwordHash: string | null;
  /** Định danh tài khoản Google (claim `sub` của id_token). */
  googleId: string | null;
  authProvider: AuthProvider;
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
  /** Số điện thoại (E.164-ish) — duy nhất nếu có. */
  phone: string | null;
  /** Giới thiệu ngắn, tối đa 500 ký tự. */
  bio: string | null;
  role: UserRole;
  notificationsEnabled: boolean;
  status: UserStatus;
}

/**
 * Aggregate root `User`.
 *
 * Đặc tính:
 *   - **Email chuẩn hoá** — luôn lowercase + trim (so sánh duy nhất).
 *   - **Chỉ `active` + chưa xoá mới đăng nhập được** — `canLogin()`.
 *   - **Khoá/mở khoá** — `block()` / `unblock()` phát domain event.
 */
export class User extends BaseEntity<UserProps> {
  private constructor(props: UserProps) {
    super(props);
  }

  // ── Getters ──────────────────────────────────────────────────────────────

  get email(): string {
    return this.props.email;
  }

  get passwordHash(): string | null {
    return this.props.passwordHash;
  }

  get googleId(): string | null {
    return this.props.googleId;
  }

  get authProvider(): AuthProvider {
    return this.props.authProvider;
  }

  get firstName(): string {
    return this.props.firstName;
  }

  get lastName(): string {
    return this.props.lastName;
  }

  get avatarUrl(): string | null {
    return this.props.avatarUrl;
  }

  get phone(): string | null {
    return this.props.phone;
  }

  get bio(): string | null {
    return this.props.bio;
  }

  get role(): UserRole {
    return this.props.role;
  }

  get notificationsEnabled(): boolean {
    return this.props.notificationsEnabled;
  }

  get status(): UserStatus {
    return this.props.status;
  }

  // ── Factory ──────────────────────────────────────────────────────────────

  /**
   * Tạo tài khoản mới — email được chuẩn hoá, mặc định `analyst` + `active`.
   *
   * Phát domain event `user.created`.
   */
  static create(props: {
    id: string;
    email: string;
    passwordHash?: string | null;
    googleId?: string | null;
    authProvider?: AuthProvider;
    firstName: string;
    lastName: string;
    avatarUrl?: string | null;
    role?: UserRole;
    now?: Date;
  }): User {
    const now = props.now ?? new Date();
    const user = new User({
      id: props.id,
      email: normalizeEmail(props.email),
      passwordHash: props.passwordHash ?? null,
      googleId: props.googleId ?? null,
      authProvider: props.authProvider ?? (props.googleId ? 'google' : 'local'),
      firstName: props.firstName.trim(),
      lastName: props.lastName.trim(),
      avatarUrl: props.avatarUrl ?? null,
      phone: null,
      bio: null,
      role: props.role ?? 'analyst',
      notificationsEnabled: true,
      status: 'active',
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
      version: 1,
    });
    user.addDomainEvent({
      eventType: USER_EVENTS.CREATED,
      aggregateId: props.id,
      payload: { email: user.props.email, role: user.props.role },
      occurredAt: now,
    });
    return user;
  }

  /**
   * Dựng lại user từ dữ liệu đã lưu — **không** phát event.
   */
  static reconstitute(props: UserProps): User {
    return new User({ ...props });
  }

  // ── Truy vấn ─────────────────────────────────────────────────────────────

  /** Tài khoản có thể đăng nhập không (chưa bị khoá, chưa bị xoá). */
  canLogin(): boolean {
    return canUserLogin(this.props.status, this.props.deletedAt);
  }

  isAdmin(): boolean {
    return this.props.role === 'admin';
  }

  isBlocked(): boolean {
    return isUserBlocked(this.props.status);
  }

  /** Tài khoản đã bị xoá mềm hay chưa. */
  override isDeleted(): boolean {
    return isUserDeleted(this.props.deletedAt);
  }

  /** Tài khoản dùng Google đăng nhập (không có mật khẩu). */
  isGoogleAccount(): boolean {
    return this.props.authProvider === 'google';
  }

  // ── Hành vi ──────────────────────────────────────────────────────────────

  /**
   * Kiểm tra tài khoản đủ điều kiện đăng nhập — ném lỗi nếu không.
   *
   * Invariant:
   *   - Bị khoá → `ForbiddenError`.
   *   - Đã xoá mềm → `ForbiddenError`.
   */
  assertCanLogin(): void {
    if (this.isDeleted()) {
      throw new ForbiddenError('Tài khoản không tồn tại hoặc đã bị xoá');
    }
    if (this.isBlocked()) {
      throw new ForbiddenError('Tài khoản của bạn đã bị khóa. Vui lòng liên hệ quản trị viên.');
    }
  }

  /**
   * Cập nhật hồ sơ cá nhân.
   *
   * Invariant:
   *   - Tên không rỗng, ≤ 50 ký tự → `ValidationError`.
   *   - Giới thiệu ≤ 500 ký tự → `ValidationError`.
   *   - Số điện thoại phải duy nhất — **kiểm tra ở tầng application** (cần
   *     truy vấn DB) → entity nhận `phoneOwnerId` để so sánh.
   */
  updateProfile(patch: {
    firstName?: string;
    lastName?: string;
    avatarUrl?: string | null;
    phone?: string | null;
    bio?: string | null;
  }): void {
    if (patch.firstName !== undefined) {
      const trimmed = patch.firstName.trim();
      if (trimmed.length === 0) {
        throw new ValidationError('Tên không được để trống');
      }
      if (trimmed.length > MAX_NAME_LENGTH) {
        throw new ValidationError(`Tên không được vượt quá ${MAX_NAME_LENGTH} ký tự`);
      }
      this.props.firstName = trimmed;
    }
    if (patch.lastName !== undefined) {
      const trimmed = patch.lastName.trim();
      if (trimmed.length === 0) {
        throw new ValidationError('Họ không được để trống');
      }
      if (trimmed.length > MAX_NAME_LENGTH) {
        throw new ValidationError(`Họ không được vượt quá ${MAX_NAME_LENGTH} ký tự`);
      }
      this.props.lastName = trimmed;
    }
    if (patch.avatarUrl !== undefined) {
      this.props.avatarUrl = patch.avatarUrl === '' ? null : patch.avatarUrl;
    }
    if (patch.phone !== undefined) {
      const phone = patch.phone === '' ? null : patch.phone?.trim() ?? null;
      if (phone !== null && phone.length === 0) {
        throw new ValidationError('Số điện thoại không hợp lệ');
      }
      this.props.phone = phone;
    }
    if (patch.bio !== undefined) {
      const bio = patch.bio === '' ? null : patch.bio;
      if (bio !== null && bio.length > MAX_BIO_LENGTH) {
        throw new ValidationError(`Giới thiệu không được vượt quá ${MAX_BIO_LENGTH} ký tự`);
      }
      this.props.bio = bio;
    }
    this.props.updatedAt = new Date();
  }

  /**
   * Đổi email — email mới phải chuẩn hoá và khác email cũ.
   *
   * Invariant:
   *   - Email rỗng → `ValidationError`.
   *   - Email không đổi → `ConflictError`.
   */
  changeEmail(email: string): void {
    const normalized = normalizeEmail(email);
    if (normalized.length === 0) {
      throw new ValidationError('Email không được để trống');
    }
    if (normalized === this.props.email) {
      throw new ConflictError('Email mới phải khác email hiện tại');
    }
    this.props.email = normalized;
    this.props.updatedAt = new Date();
  }

  /** Đặt lại mật khẩu (hash do tầng application cung cấp). */
  setPasswordHash(passwordHash: string): void {
    if (passwordHash.trim().length === 0) {
      throw new ValidationError('Mật khẩu không được để trống');
    }
    this.props.passwordHash = passwordHash;
    this.props.updatedAt = new Date();
  }

  /**
   * Gắn định danh Google — tài khoản đăng nhập bằng Google không có mật khẩu.
   */
  linkGoogleId(googleId: string): void {
    const gid = googleId.trim();
    if (gid.length === 0) {
      throw new ValidationError('Định danh Google không được để trống');
    }
    this.props.googleId = gid;
    this.props.authProvider = 'google';
    this.props.updatedAt = new Date();
  }

  /** Bật/tắt thông báo. */
  setNotificationsEnabled(enabled: boolean): void {
    this.props.notificationsEnabled = enabled;
    this.props.updatedAt = new Date();
  }

  /**
   * Khoá tài khoản — chặn đăng nhập.
   *
   * Invariant: khoá tài khoản đã bị khoá → `ConflictError`.
   *
   * Phát domain event `user.blocked`.
   */
  block(): void {
    if (this.isBlocked()) {
      throw new ConflictError('Tài khoản đã bị khóa');
    }
    this.props.status = 'blocked';
    this.props.updatedAt = new Date();
    this.addDomainEvent({
      eventType: USER_EVENTS.BLOCKED,
      aggregateId: this.props.id,
      payload: { email: this.props.email },
      occurredAt: this.props.updatedAt,
    });
  }

  /**
   * Mở khoá tài khoản.
   *
   * Phát domain event `user.unblocked`.
   */
  unblock(): void {
    if (!this.isBlocked()) {
      throw new ConflictError('Tài khoản không bị khóa');
    }
    this.props.status = 'active';
    this.props.updatedAt = new Date();
    this.addDomainEvent({
      eventType: USER_EVENTS.UNBLOCKED,
      aggregateId: this.props.id,
      payload: { email: this.props.email },
      occurredAt: this.props.updatedAt,
    });
  }

  /**
   * Xoá mềm tài khoản.
   *
   * Invariant: xoá tài khoản đã xoá → `ConflictError`.
   */
  softDelete(): void {
    if (this.isDeleted()) {
      throw new ConflictError('Tài khoản đã bị xoá');
    }
    this.props.deletedAt = new Date();
    this.props.status = 'blocked';
    this.props.updatedAt = new Date();
  }

  /** Bản chụp props — dùng cho mapper chuyển entity → persistence. */
  toProps(): UserProps {
    return { ...this.props };
  }
}
