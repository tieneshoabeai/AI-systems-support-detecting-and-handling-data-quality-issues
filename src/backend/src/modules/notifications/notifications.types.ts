/** NOTIFICATIONS — Types (Template Simple). Gop entity + vo + port token + application input. GIU 2 mapper rieng. */
import {
  BaseEntity,
  type BaseEntityProps,
} from '../../shared/domain/entities';
import {
  ConflictError,
  ValidationError,
} from '../../shared/domain/errors';

// --- VO: notification-type ---
export const NOTIFICATION_TYPES = [
  'project_created',
  'project_deleted',
  'project_member_added',
  'issue_needs_info',
  'issue_resolved',
  'analysis_completed',
  'analysis_failed',
  'ai_analysis_ready',
  'report_ready',
  'security_alert',
] as const;

export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

export const MANDATORY_NOTIFICATION_TYPES: NotificationType[] = [
  'issue_needs_info',
  'security_alert',
];

export function isMandatoryNotification(type: string, explicitFlag: boolean): boolean {
  if (explicitFlag) return true;
  return (MANDATORY_NOTIFICATION_TYPES as readonly string[]).includes(type);
}

export function shouldDispatch(enabled: boolean | undefined, mandatory: boolean): boolean {
  if (enabled === false && !mandatory) return false;
  return true;
}

// --- Events ---
export const NOTIFICATION_EVENTS = {
  CREATED: 'notification.created',
  READ: 'notification.read',
} as const;

export type NotificationEventName = (typeof NOTIFICATION_EVENTS)[keyof typeof NOTIFICATION_EVENTS];

// --- Entity: Notification (Aggregate root, giu invariant title 200/summary 500/doc 1 lan) ---
/**
 * NOTIFICATION — Aggregate root.
 *
 * **Vì sao cần entity thay vì `NotificationRecord` (interface trần)?**
 * Trước Bước 3, các invariant của thông báo nằm rải rác:
 *   - `dispatch.handler.ts`: trim + cắt title 200 ký tự, summary 500 ký tự.
 *   - `notification-type.vo.ts`: loại thông báo bắt buộc, quy tắc gửi/tắt.
 *   - `mark-as-read.handler.ts`: chỉ đánh dấu đã đọc 1 lần.
 *   - `notification.mapper.ts`: cắt chuỗi lần nữa (lặp lại logic).
 *
 * Rủi ro: logic "giới hạn độ dài" và "thông báo bắt buộc" bị viết ở nhiều nơi
 * với điều kiện khác nhau. Entity gom vào **một chỗ** (Phần 5 §3.3).
 *
 * **Quy tắc bất di bất dịch:**
 *   1. State riêng tư + getter công khai — không có setter tự do.
 *   2. `static create()` (tạo mới) và `static reconstitute()` (dựng lại từ DB).
 *   3. Invariant kiểm tra trong entity, ném `DomainError` — **không** ném
 *      `HttpException` (Bước 2) và **không** ném `Error` trần.
 */

/** Giới hạn độ dài (khớp `NotificationSchema`). */
export const MAX_TITLE_LENGTH = 200;
export const MAX_SUMMARY_LENGTH = 500;

/** Payload của thông báo — dùng để client điều hướng tới đối tượng liên quan. */
export interface NotificationPayload {
  targetType?: string | null;
  targetId?: string | null;
  actionUrl?: string | null;
}

/** Props đầy đủ của aggregate notification. */
export interface NotificationProps extends BaseEntityProps {
  userId: string;
  type: NotificationType;
  title: string;
  summary: string | null;
  payload: NotificationPayload | null;
  /** Id sự kiện nguồn — dùng chống gửi trùng (idempotency). */
  sourceEventId: string | null;
  isMandatory: boolean;
  /** Thời điểm đánh dấu đã đọc — `null` = chưa đọc. */
  readAt: Date | null;
  /** Thời điểm hết hạn (TTL index trong MongoDB). */
  expiresAt: Date | null;
}

/**
 * Aggregate root `Notification`.
 *
 * Đặc tính:
 *   - **Loại thông báo hợp lệ** — `type` phải nằm trong `NOTIFICATION_TYPES`.
 *   - **Bắt buộc theo loại** — `issue_needs_info` / `security_alert` luôn bắt buộc.
 *   - **Đọc 1 lần** — `markAsRead()` idempotent, đọc lần 2 → `ConflictError`.
 *   - **Idempotency** — `sourceEventId` chặn tạo trùng.
 */
export class Notification extends BaseEntity<NotificationProps> {
  private constructor(props: NotificationProps) {
    super(props);
  }

  // ── Getters ──────────────────────────────────────────────────────────────

  get userId(): string {
    return this.props.userId;
  }

  get type(): NotificationType {
    return this.props.type;
  }

  get title(): string {
    return this.props.title;
  }

  get summary(): string | null {
    return this.props.summary;
  }

  get payload(): NotificationPayload | null {
    return this.props.payload;
  }

  get sourceEventId(): string | null {
    return this.props.sourceEventId;
  }

  get isMandatory(): boolean {
    return this.props.isMandatory;
  }

  get readAt(): Date | null {
    return this.props.readAt;
  }

  get expiresAt(): Date | null {
    return this.props.expiresAt;
  }

  // ── Factory ──────────────────────────────────────────────────────────────

  /**
   * Tạo thông báo mới.
   *
   * Invariant:
   *   - `type` phải hợp lệ → `ValidationError`.
   *   - `title` không rỗng, ≤ 200 ký tự → `ValidationError`.
   *   - `summary` ≤ 500 ký tự → `ValidationError`.
   *
   * Phát domain event `notification.created`.
   */
  static create(props: {
    id: string;
    userId: string;
    type: string;
    title: string;
    summary?: string | null;
    payload?: NotificationPayload | null;
    sourceEventId?: string | null;
    /** Ép cờ bắt buộc — nếu không thì suy ra từ `type`. */
    isMandatory?: boolean;
    expiresAt?: Date | null;
    now?: Date;
  }): Notification {
    const now = props.now ?? new Date();
    const type = Notification.assertType(props.type);
    const title = Notification.assertTitle(props.title);
    const summary = Notification.assertSummary(props.summary ?? null);
    const isMandatory = isMandatoryNotification(type, props.isMandatory === true);

    const notification = new Notification({
      id: props.id,
      userId: props.userId,
      type,
      title,
      summary,
      payload: props.payload ?? null,
      sourceEventId: props.sourceEventId ?? null,
      isMandatory,
      readAt: null,
      expiresAt: props.expiresAt ?? null,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
      version: 1,
    });
    notification.addDomainEvent({
      eventType: NOTIFICATION_EVENTS.CREATED,
      aggregateId: props.id,
      payload: { userId: props.userId, type },
      occurredAt: now,
    });
    return notification;
  }

  /**
   * Dựng lại thông báo từ dữ liệu đã lưu — **không** phát event.
   */
  static reconstitute(props: NotificationProps): Notification {
    return new Notification({ ...props });
  }

  // ── Truy vấn ─────────────────────────────────────────────────────────────

  /** Thông báo chưa đọc. */
  isUnread(): boolean {
    return this.props.readAt === null;
  }

  /** Thông báo đã đọc. */
  isRead(): boolean {
    return this.props.readAt !== null;
  }

  /**
   * Thông báo có được gửi cho người dùng không?
   *
   * - `enabled === false` và **không** bắt buộc → không gửi.
   * - Thông báo bắt buộc → luôn gửi (bất kể công tắc).
   */
  static canDispatch(enabled: boolean | undefined, mandatory: boolean): boolean {
    return shouldDispatch(enabled, mandatory);
  }

  /** Suy ra cờ bắt buộc từ loại thông báo. */
  static resolveMandatory(type: string, explicitFlag: boolean): boolean {
    return isMandatoryNotification(type, explicitFlag);
  }

  // ── Hành vi ──────────────────────────────────────────────────────────────

  /**
   * Đánh dấu đã đọc.
   *
   * Invariant: đánh dấu đã đọc 2 lần → `ConflictError`.
   *
   * Phát domain event `notification.read`.
   */
  markAsRead(at: Date = new Date()): void {
    if (this.props.readAt !== null) {
      throw new ConflictError('Thông báo đã được đánh dấu đã đọc');
    }
    this.props.readAt = at;
    this.props.updatedAt = at;
    this.addDomainEvent({
      eventType: NOTIFICATION_EVENTS.READ,
      aggregateId: this.props.id,
      payload: { userId: this.props.userId, type: this.props.type },
      occurredAt: at,
    });
  }

  /** Bản chụp props — dùng cho mapper chuyển entity → persistence. */
  toProps(): NotificationProps {
    return { ...this.props };
  }

  // ── Kiểm tra invariant (private static) ────────────────────────────────

  private static assertType(type: string): NotificationType {
    if (!(NOTIFICATION_TYPES as readonly string[]).includes(type)) {
      throw new ValidationError(`Loại thông báo không hợp lệ: ${type}`);
    }
    return type as NotificationType;
  }

  private static assertTitle(title: string): string {
    const trimmed = title.trim();
    if (trimmed.length === 0) {
      throw new ValidationError('Tiêu đề thông báo không được để trống');
    }
    if (trimmed.length > MAX_TITLE_LENGTH) {
      throw new ValidationError(
        `Tiêu đề thông báo không được vượt quá ${MAX_TITLE_LENGTH} ký tự`,
      );
    }
    return trimmed;
  }

  private static assertSummary(summary: string | null): string | null {
    if (summary === null) return null;
    if (summary.length > MAX_SUMMARY_LENGTH) {
      throw new ValidationError(
        `Nội dung tóm tắt không được vượt quá ${MAX_SUMMARY_LENGTH} ký tự`,
      );
    }
    return summary;
  }
}

// --- Port token + input (giu Symbol + useExisting) ---
/**
 * NOTIFICATION — Domain repository port (hexagonal chuẩn).
 * Application chỉ gọi qua port này.
 *
 * **Bước 3 — Rich Domain Model:** port trả **entity** `Notification`
 * (không phải record trần) → handler có thể gọi hành vi của entity
 * (`markAsRead()`, `isUnread()`, …).
 */



export const NOTIFICATION_REPOSITORY_PORT = Symbol('NotificationRepositoryPort');

// (Notification/ Payload da dinh nghia o tren)

export interface NotificationListQuery {
  read: 'true' | 'false' | 'all';
  limit: number;
  cursorCreatedAt?: Date;
  cursorId?: string;
  sortOrder: 'asc' | 'desc';
}

export interface NotificationDispatch {
  userId: string;
  type: NotificationType;
  title: string;
}

export interface CreateNotificationRecord {
  userId: string;
  type: string;
  title: string;
  summary?: string | null;
  payload?: NotificationPayload | null;
  sourceEventId?: string | null;
  isMandatory: boolean;
  expiresAt?: Date | null;
}

export interface NotificationRepositoryPort {
  create(doc: CreateNotificationRecord): Promise<Notification>;
  findByIdForUser(id: string, userId: string): Promise<Notification | null>;
  listForUser(userId: string, opts: NotificationListQuery): Promise<Notification[]>;
  countUnread(userId: string): Promise<number>;
  markAsRead(id: string, userId: string): Promise<Notification | null>;
  /** Tạo thông báo chỉ khi `sourceEventId` chưa tồn tại (idempotency). */
  createIfEventNotExists(doc: CreateNotificationRecord): Promise<Notification | null>;
  existsByEvent(userId: string, sourceEventId: string): Promise<boolean>;
}

// --- Application input ---
/**
 * NOTIFICATIONS — Kiểu dữ liệu tầng application (input/output contract).
 *
 * Tách ra khỏi service gốc khi áp dụng §3.10 Command/Query pattern.
 * Không import HTTP, không import infrastructure.
 */



export interface ListNotificationsInput {
  cursor?: string;
  limit: number;
  sortOrder: 'asc' | 'desc';
  read: 'true' | 'false' | 'all';
}

export interface DispatchNotificationInput {
  userId: string;
  type: NotificationType;
  title: string;
  summary?: string | null;
  payload?: { targetType?: string | null; targetId?: string | null; actionUrl?: string | null };
  sourceEventId?: string | null;
  isMandatory?: boolean;
}
