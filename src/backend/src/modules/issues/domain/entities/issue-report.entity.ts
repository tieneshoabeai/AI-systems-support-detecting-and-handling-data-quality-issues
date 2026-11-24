/**
 * ISSUE REPORT — Aggregate root.
 *
 * **Vì sao cần entity thay vì `IssueReportRecord` (interface trần)?**
 * Trước Bước 3, invariant của báo cáo sự cố nằm rải rác:
 *   - `issue-status.vo.ts`: luồng chuyển trạng thái hợp lệ.
 *   - `update-status.handler.ts`: admin mới được đổi trạng thái.
 *   - `update-my-report.handler.ts`: user chỉ tự sửa được khi `needs_info`.
 *   - `issue.mapper.ts`: cắt chuỗi title/description.
 *   - `update-my-report.handler.ts`: chỉ gỡ được tệp đính kèm thuộc báo cáo.
 *
 * Rủi ro: luồng trạng thái phức tạp (5 trạng thái, 8 transition hợp lệ) dễ
 * bị viết lệch ở nhiều nơi. Entity gom vào **một chỗ** (Phần 5 §3.3).
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
  ALLOWED_ISSUE_TRANSITIONS,
  assertAllowedIssueTransition,
  isUserEditableIssueStatus,
  type IssueStatus,
} from '../value-objects/issue-status.vo';
import { ISSUE_TYPES, type IssueType } from '../value-objects/issue-type.vo';
import { ISSUE_EVENTS } from '../events/issue-events';

/** Giới hạn độ dài (khớp `IssueReportSchema`). */
export const MAX_ISSUE_TITLE_LENGTH = 200;
export const MAX_ISSUE_DESCRIPTION_LENGTH = 5000;
export const MAX_ATTACHMENT_FILENAME_LENGTH = 255;
export const MAX_ATTACHMENT_SIZE_BYTES = 10 * 1024 * 1024;

/** Tệp đính kèm — thuộc về aggregate. */
export interface IssueAttachment {
  id: string;
  filename: string;
  /** Đường dẫn lưu trữ (R2) — **chi tiết hạ tầng, không lộ ra API**. */
  storageKey: string;
  sizeBytes: number;
  contentType: string;
}

/** Ngữ cảnh lỗi kèm theo báo cáo. */
export interface IssueContext {
  apiPath?: string | null;
  errorMessage?: string | null;
  occurredAt?: Date | null;
}

/** Props đầy đủ của aggregate issue report. */
export interface IssueReportProps extends BaseEntityProps {
  userId: string;
  workspaceId: string | null;
  issueType: IssueType;
  title: string;
  description: string;
  status: IssueStatus;
  attachments: IssueAttachment[];
  context: IssueContext | null;
}

/**
 * Aggregate root `IssueReport`.
 *
 * Đặc tính:
 *   - **Luồng trạng thái** — `transitionTo()` kiểm tra transition hợp lệ.
 *   - **Quyền sửa** — `assertUserCanEdit()` chỉ cho phép khi `needs_info`.
 *   - **Tệp đính kèm** — `addAttachment()` / `removeAttachments()` tự kiểm tra.
 */
export class IssueReport extends BaseEntity<IssueReportProps> {
  private constructor(props: IssueReportProps) {
    super(props);
  }

  // ── Getters ──────────────────────────────────────────────────────────────

  get userId(): string {
    return this.props.userId;
  }

  get workspaceId(): string | null {
    return this.props.workspaceId;
  }

  get issueType(): IssueType {
    return this.props.issueType;
  }

  get title(): string {
    return this.props.title;
  }

  get description(): string {
    return this.props.description;
  }

  get status(): IssueStatus {
    return this.props.status;
  }

  get attachments(): IssueAttachment[] {
    return this.props.attachments;
  }

  get context(): IssueContext | null {
    return this.props.context;
  }

  // ── Factory ──────────────────────────────────────────────────────────────

  /**
   * Tạo báo cáo mới — luôn bắt đầu ở trạng thái `new`.
   *
   * Invariant:
   *   - `issueType` hợp lệ → `ValidationError`.
   *   - `title` không rỗng, ≤ 200 ký tự → `ValidationError`.
   *   - `description` ≤ 5000 ký tự → `ValidationError`.
   *
   * Phát domain event `issue.created`.
   */
  static create(props: {
    id: string;
    userId: string;
    workspaceId?: string | null;
    issueType: string;
    title: string;
    description: string;
    context?: IssueContext | null;
    now?: Date;
  }): IssueReport {
    const now = props.now ?? new Date();
    if (!(ISSUE_TYPES as readonly string[]).includes(props.issueType)) {
      throw new ValidationError(`Loại báo cáo không hợp lệ: ${props.issueType}`);
    }
    const title = props.title.trim();
    if (title.length === 0) {
      throw new ValidationError('Tiêu đề báo cáo không được để trống');
    }
    if (title.length > MAX_ISSUE_TITLE_LENGTH) {
      throw new ValidationError(
        `Tiêu đề báo cáo không được vượt quá ${MAX_ISSUE_TITLE_LENGTH} ký tự`,
      );
    }
    const description = props.description.trim();
    if (description.length > MAX_ISSUE_DESCRIPTION_LENGTH) {
      throw new ValidationError(
        `Mô tả báo cáo không được vượt quá ${MAX_ISSUE_DESCRIPTION_LENGTH} ký tự`,
      );
    }

    const issue = new IssueReport({
      id: props.id,
      userId: props.userId,
      workspaceId: props.workspaceId ?? null,
      issueType: props.issueType as IssueType,
      title,
      description,
      status: 'new',
      attachments: [],
      context: props.context ?? null,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
      version: 1,
    });
    issue.addDomainEvent({
      eventType: ISSUE_EVENTS.CREATED,
      aggregateId: props.id,
      payload: { userId: props.userId, issueType: issue.props.issueType },
      occurredAt: now,
    });
    return issue;
  }

  /**
   * Dựng lại báo cáo từ dữ liệu đã lưu — **không** phát event.
   */
  static reconstitute(props: IssueReportProps): IssueReport {
    return new IssueReport({ ...props });
  }

  // ── Truy vấn ─────────────────────────────────────────────────────────────

  /** Transition sang trạng thái kế tiếp có hợp lệ không? */
  canTransitionTo(next: IssueStatus): boolean {
    const allowed = ALLOWED_ISSUE_TRANSITIONS[this.props.status] ?? [];
    return allowed.includes(next);
  }

  /** Người dùng có được tự sửa báo cáo ở trạng thái hiện tại không? */
  isUserEditable(): boolean {
    return isUserEditableIssueStatus(this.props.status);
  }

  /** Báo cáo đã đóng chưa? */
  isClosed(): boolean {
    return this.props.status === 'closed';
  }

  // ── Hành vi ──────────────────────────────────────────────────────────────

  /**
   * Chuyển trạng thái (chỉ quản trị viên).
   *
   * Invariant:
   *   - Transition không hợp lệ → `ValidationError`.
   *   - Báo cáo đã đóng → `ConflictError`.
   *
   * Phát domain event `issue.status_changed` (+ `issue.needs_info` /
   * `issue.resolved` tương ứng).
   */
  transitionTo(next: IssueStatus, at: Date = new Date()): void {
    if (this.isClosed()) {
      throw new ConflictError('Báo cáo đã đóng, không thể chuyển trạng thái');
    }
    // `assertAllowedIssueTransition` ném `Error` trần → bọc lại thành DomainError.
    try {
      assertAllowedIssueTransition(this.props.status, next);
    } catch {
      throw new ValidationError(
        `Chuyển trạng thái không hợp lệ: ${this.props.status} -> ${next}`,
      );
    }
    const from = this.props.status;
    this.props.status = next;
    this.props.updatedAt = at;
    this.props.version += 1;

    this.addDomainEvent({
      eventType: ISSUE_EVENTS.STATUS_CHANGED,
      aggregateId: this.props.id,
      payload: { from, to: next, userId: this.props.userId },
      occurredAt: at,
    });
    if (next === 'needs_info') {
      this.addDomainEvent({
        eventType: ISSUE_EVENTS.NEEDS_INFO,
        aggregateId: this.props.id,
        payload: { userId: this.props.userId },
        occurredAt: at,
      });
    }
    if (next === 'resolved') {
      this.addDomainEvent({
        eventType: ISSUE_EVENTS.RESOLVED,
        aggregateId: this.props.id,
        payload: { userId: this.props.userId },
        occurredAt: at,
      });
    }
  }

  /**
   * Người dùng tự sửa báo cáo của chính mình.
   *
   * Invariant:
   *   - Chỉ được sửa khi trạng thái là `needs_info` → `ForbiddenError`.
   *   - `title`/`description` phải thoả giới hạn độ dài → `ValidationError`.
   *   - `removeAttachmentIds` phải thuộc báo cáo → `ValidationError`.
   *
   * Sau khi sửa → trạng thái quay về `in_progress` (luồng "gửi lại").
   */
  updateByUser(
    patch: {
      title?: string;
      description?: string;
      removeAttachmentIds?: string[];
    },
    at: Date = new Date(),
  ): void {
    if (!this.isUserEditable()) {
      throw new ForbiddenError(
        'Báo cáo hiện không ở trạng thái chờ bổ sung thông tin nên không thể tự sửa.',
      );
    }
    if (patch.title !== undefined) {
      const title = patch.title.trim();
      if (title.length === 0) {
        throw new ValidationError('Tiêu đề báo cáo không được để trống');
      }
      if (title.length > MAX_ISSUE_TITLE_LENGTH) {
        throw new ValidationError(
          `Tiêu đề báo cáo không được vượt quá ${MAX_ISSUE_TITLE_LENGTH} ký tự`,
        );
      }
      this.props.title = title;
    }
    if (patch.description !== undefined) {
      const description = patch.description.trim();
      if (description.length > MAX_ISSUE_DESCRIPTION_LENGTH) {
        throw new ValidationError(
          `Mô tả báo cáo không được vượt quá ${MAX_ISSUE_DESCRIPTION_LENGTH} ký tự`,
        );
      }
      this.props.description = description;
    }
    if (patch.removeAttachmentIds && patch.removeAttachmentIds.length > 0) {
      this.removeAttachments(patch.removeAttachmentIds);
    }
    // Luồng "gửi lại sau khi bổ sung" → `needs_info` → `in_progress`.
    this.props.status = 'in_progress';
    this.props.updatedAt = at;
    this.props.version += 1;
  }

  /**
   * Thêm tệp đính kèm.
   *
   * Invariant:
   *   - Tên tệp ≤ 255 ký tự → `ValidationError`.
   *   - Kích thước ≤ 10 MB → `ValidationError`.
   */
  addAttachment(attachment: IssueAttachment, at: Date = new Date()): void {
    if (attachment.filename.trim().length === 0) {
      throw new ValidationError('Tên tệp đính kèm không được để trống');
    }
    if (attachment.filename.length > MAX_ATTACHMENT_FILENAME_LENGTH) {
      throw new ValidationError(
        `Tên tệp đính kèm không được vượt quá ${MAX_ATTACHMENT_FILENAME_LENGTH} ký tự`,
      );
    }
    if (attachment.sizeBytes > MAX_ATTACHMENT_SIZE_BYTES) {
      throw new ValidationError(
        `Tệp đính kèm không được vượt quá ${MAX_ATTACHMENT_SIZE_BYTES / (1024 * 1024)} MB`,
      );
    }
    this.props.attachments = [...this.props.attachments, attachment];
    this.props.updatedAt = at;
  }

  /**
   * Gỡ tệp đính kèm — chỉ gỡ được tệp thực sự thuộc báo cáo.
   *
   * Invariant: id không thuộc báo cáo → `ValidationError`.
   *
   * @returns danh sách `storageKey` của các tệp đã gỡ (để dọn storage).
   */
  removeAttachments(ids: string[], at: Date = new Date()): string[] {
    const owned = new Set(this.props.attachments.map((a) => String(a.id)));
    const unknown = ids.filter((id) => !owned.has(String(id)));
    if (unknown.length > 0) {
      throw new ValidationError(
        `Tệp đính kèm không thuộc báo cáo: ${unknown.join(', ')}`,
      );
    }
    const target = new Set(ids.map(String));
    const removed = this.props.attachments.filter((a) => target.has(String(a.id)));
    this.props.attachments = this.props.attachments.filter(
      (a) => !target.has(String(a.id)),
    );
    this.props.updatedAt = at;
    return removed.map((a) => a.storageKey);
  }

  /** Bản chụp props — dùng cho mapper chuyển entity → persistence. */
  toProps(): IssueReportProps {
    return { ...this.props };
  }
}
