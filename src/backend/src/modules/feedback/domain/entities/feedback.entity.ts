/**
 * FINDING FEEDBACK — Aggregate root.
 *
 * **Vì sao cần entity thay vì `FeedbackRecord` (interface trần)?**
 * Trước Bước 3, invariant của nhận xét nằm rải rác:
 *   - `feedback-label.vo.ts`: nhãn nào **bắt buộc** kèm lý do.
 *   - `create-finding-feedback.handler.ts` + `update-mine.handler.ts`: cùng một
 *     hàm `checkReason()` bị **copy-paste** ở 2 nơi.
 *   - `feedback-label.vo.ts` ném `Error` trần (không phải `DomainError`).
 *   - `create-finding-feedback.handler.ts`: cắt `reason` ở 2000 ký tự.
 *   - `create-finding-feedback.handler.ts`: `findingId` ≤ 200 ký tự.
 *
 * Rủi ro: 2 bản `checkReason()` có thể lệch nhau khi sửa. Entity gom vào
 * **một chỗ** (Phần 5 §3.3).
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
  ForbiddenError,
  ValidationError,
} from '../../../../shared/domain/errors';
import {
  FEEDBACK_LABELS,
  FEEDBACK_SEVERITIES,
  requiresReason,
  type FeedbackLabel,
  type FeedbackSeverity,
} from '../value-objects/feedback-label.vo';
import { FEEDBACK_EVENTS } from '../events/feedback-events';

/** Giới hạn độ dài (khớp `FindingFeedbackSchema`). */
export const MAX_FEEDBACK_REASON_LENGTH = 2000;
export const MAX_FEEDBACK_AI_RATIONALE_LENGTH = 1000;
export const MAX_FEEDBACK_FINDING_ID_LENGTH = 200;

/** Props đầy đủ của aggregate feedback. */
export interface FeedbackProps extends BaseEntityProps {
  analysisRunId: string;
  projectId: string;
  workspaceId: string;
  findingId: string | null;
  /** Khoá ổn định của finding (không phải ObjectId) — dùng để gom feedback. */
  findingKey: string | null;
  authorId: string;
  label: FeedbackLabel;
  reason: string | null;
  suggestedSeverity: FeedbackSeverity | null;
  aiConfidence: number | null;
  aiRationale: string | null;
  /** Vai trò của tác giả **tại thời điểm** gửi nhận xét (snapshot). */
  authorRoleAtTime: string | null;
  modelId: string | null;
  promptVersion: string | null;
}

/**
 * Aggregate root `FindingFeedback`.
 *
 * Đặc tính:
 *   - **Nhãn hợp lệ** — `label` phải nằm trong `FEEDBACK_LABELS`.
 *   - **Lý do bắt buộc** — `false_positive` / `missed_issue` / `other` cần `reason`.
 *   - **Chỉ tác giả được sửa** — `assertOwnedBy()`.
 *   - **Độc quyền sửa** — `aiConfidence` / `aiRationale` là dữ liệu của hệ thống.
 */
export class Feedback extends BaseEntity<FeedbackProps> {
  private constructor(props: FeedbackProps) {
    super(props);
  }

  // ── Getters ──────────────────────────────────────────────────────────────

  get analysisRunId(): string {
    return this.props.analysisRunId;
  }

  get projectId(): string {
    return this.props.projectId;
  }

  get workspaceId(): string {
    return this.props.workspaceId;
  }

  get findingId(): string | null {
    return this.props.findingId;
  }

  get findingKey(): string | null {
    return this.props.findingKey;
  }

  get authorId(): string {
    return this.props.authorId;
  }

  get label(): FeedbackLabel {
    return this.props.label;
  }

  get reason(): string | null {
    return this.props.reason;
  }

  get suggestedSeverity(): FeedbackSeverity | null {
    return this.props.suggestedSeverity;
  }

  get aiConfidence(): number | null {
    return this.props.aiConfidence;
  }

  get aiRationale(): string | null {
    return this.props.aiRationale;
  }

  get authorRoleAtTime(): string | null {
    return this.props.authorRoleAtTime;
  }

  get modelId(): string | null {
    return this.props.modelId;
  }

  get promptVersion(): string | null {
    return this.props.promptVersion;
  }

  // ── Factory ──────────────────────────────────────────────────────────────

  /**
   * Tạo nhận xét mới.
   *
   * Invariant:
   *   - `label` hợp lệ → `ValidationError`.
   *   - `findingId` (nếu có) ≤ 200 ký tự → `ValidationError`.
   *   - `reason` ≤ 2000 ký tự → `ValidationError`.
   *   - `aiRationale` ≤ 1000 ký tự → `ValidationError`.
   *   - Nhãn bắt buộc lý do mà thiếu `reason` → `ValidationError`.
   *
   * Phát domain event `feedback.submitted`.
   */
  static create(props: {
    id: string;
    analysisRunId: string;
    projectId: string;
    workspaceId: string;
    findingId?: string | null;
    findingKey?: string | null;
    authorId: string;
    label: string;
    reason?: string | null;
    suggestedSeverity?: string | null;
    aiConfidence?: number | null;
    aiRationale?: string | null;
    authorRoleAtTime?: string | null;
    modelId?: string | null;
    promptVersion?: string | null;
    now?: Date;
  }): Feedback {
    const now = props.now ?? new Date();
    const label = Feedback.assertLabel(props.label);
    const reason = Feedback.assertReason(props.reason ?? null);
    const findingId = Feedback.assertFindingId(props.findingId ?? null);
    const suggestedSeverity = Feedback.assertSeverity(props.suggestedSeverity ?? null);
    const aiRationale = Feedback.assertAiRationale(props.aiRationale ?? null);

    // Nhãn bắt buộc lý do → kiểm tra ở đây (một chỗ duy nhất).
    if (requiresReason(label) && !reason) {
      throw new ValidationError(
        `Nhãn "${label}" yêu cầu lý do (reason)`,
      );
    }

    const feedback = new Feedback({
      id: props.id,
      analysisRunId: props.analysisRunId,
      projectId: props.projectId,
      workspaceId: props.workspaceId,
      findingId,
      findingKey: props.findingKey ?? null,
      authorId: props.authorId,
      label,
      reason,
      suggestedSeverity,
      aiConfidence: props.aiConfidence ?? null,
      aiRationale,
      authorRoleAtTime: props.authorRoleAtTime ?? null,
      modelId: props.modelId ?? null,
      promptVersion: props.promptVersion ?? null,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
      version: 1,
    });
    feedback.addDomainEvent({
      eventType: FEEDBACK_EVENTS.SUBMITTED,
      aggregateId: props.id,
      payload: {
        analysisRunId: props.analysisRunId,
        projectId: props.projectId,
        label,
        authorId: props.authorId,
      },
      occurredAt: now,
    });
    return feedback;
  }

  /**
   * Dựng lại nhận xét từ dữ liệu đã lưu — **không** phát event.
   */
  static reconstitute(props: FeedbackProps): Feedback {
    return new Feedback({ ...props });
  }

  // ── Truy vấn ─────────────────────────────────────────────────────────────

  /** Nhận xét này có phải của người dùng này không? */
  isOwnedBy(userId: string): boolean {
    return this.props.authorId === userId;
  }

  /** Nhãn này có bắt buộc kèm lý do không? */
  requiresReason(): boolean {
    return requiresReason(this.props.label);
  }

  /** Nhận xét đã bị xoá mềm chưa? */
  isSoftDeleted(): boolean {
    return this.props.deletedAt !== null;
  }

  // ── Hành vi ──────────────────────────────────────────────────────────────

  /**
   * Chủ nhận xét sửa lại nhận xét của chính mình.
   *
   * Invariant:
   *   - Không phải tác giả → `ForbiddenError`.
   *   - `label` mới phải hợp lệ → `ValidationError`.
   *   - Nhãn bắt buộc lý do mà thiếu `reason` → `ValidationError`.
   *   - `reason` ≤ 2000 ký tự → `ValidationError`.
   *
   * Phát domain event `feedback.submitted` (sửa nhận xét = gửi lại).
   */
  updateByAuthor(
    userId: string,
    patch: {
      label?: string;
      reason?: string | null;
      suggestedSeverity?: string | null;
    },
    at: Date = new Date(),
  ): void {
    if (!this.isOwnedBy(userId)) {
      throw new ForbiddenError('Chỉ chủ nhận xét được sửa');
    }
    const nextLabel =
      patch.label !== undefined ? Feedback.assertLabel(patch.label) : this.props.label;
    const nextReason =
      patch.reason !== undefined
        ? Feedback.assertReason(patch.reason)
        : this.props.reason;

    if (requiresReason(nextLabel) && !nextReason) {
      throw new ValidationError(
        `Nhãn "${nextLabel}" yêu cầu lý do (reason)`,
      );
    }

    this.props.label = nextLabel;
    this.props.reason = nextReason;
    if (patch.suggestedSeverity !== undefined) {
      this.props.suggestedSeverity = Feedback.assertSeverity(patch.suggestedSeverity);
    }
    this.props.updatedAt = at;
    this.props.version += 1;

    this.addDomainEvent({
      eventType: FEEDBACK_EVENTS.SUBMITTED,
      aggregateId: this.props.id,
      payload: {
        analysisRunId: this.props.analysisRunId,
        projectId: this.props.projectId,
        label: nextLabel,
        authorId: this.props.authorId,
      },
      occurredAt: at,
    });
  }

  /**
   * Xoá mềm nhận xét.
   *
   * Phát domain event `feedback.promoted` — nhận xét bị ẩn khỏi bảng điều khiển.
   */
  softDelete(at: Date = new Date()): void {
    this.props.deletedAt = at;
    this.props.updatedAt = at;
    this.addDomainEvent({
      eventType: FEEDBACK_EVENTS.PROMOTED,
      aggregateId: this.props.id,
      payload: {
        analysisRunId: this.props.analysisRunId,
        projectId: this.props.projectId,
      },
      occurredAt: at,
    });
  }

  /** Bản chụp props — dùng cho mapper chuyển entity → persistence. */
  toProps(): FeedbackProps {
    return { ...this.props };
  }

  // ── Kiểm tra invariant (private static) ────────────────────────────────

  private static assertLabel(label: string): FeedbackLabel {
    if (!(FEEDBACK_LABELS as readonly string[]).includes(label)) {
      throw new ValidationError(`Nhãn nhận xét không hợp lệ: ${label}`);
    }
    return label as FeedbackLabel;
  }

  private static assertSeverity(severity: string | null): FeedbackSeverity | null {
    if (severity === null) return null;
    if (!(FEEDBACK_SEVERITIES as readonly string[]).includes(severity)) {
      throw new ValidationError(`Mức độ nghiêm trọng không hợp lệ: ${severity}`);
    }
    return severity as FeedbackSeverity;
  }

  private static assertReason(reason: string | null): string | null {
    if (reason === null) return null;
    const trimmed = reason.trim();
    if (trimmed.length === 0) return null;
    if (trimmed.length > MAX_FEEDBACK_REASON_LENGTH) {
      throw new ValidationError(
        `Lý do không được vượt quá ${MAX_FEEDBACK_REASON_LENGTH} ký tự`,
      );
    }
    return trimmed;
  }

  private static assertAiRationale(rationale: string | null): string | null {
    if (rationale === null) return null;
    const trimmed = rationale.trim();
    if (trimmed.length === 0) return null;
    if (trimmed.length > MAX_FEEDBACK_AI_RATIONALE_LENGTH) {
      throw new ValidationError(
        `Giải thích AI không được vượt quá ${MAX_FEEDBACK_AI_RATIONALE_LENGTH} ký tự`,
      );
    }
    return trimmed;
  }

  private static assertFindingId(findingId: string | null): string | null {
    if (findingId === null) return null;
    const trimmed = findingId.trim();
    if (trimmed.length === 0) return null;
    if (trimmed.length > MAX_FEEDBACK_FINDING_ID_LENGTH) {
      throw new ValidationError(
        `findingId không được vượt quá ${MAX_FEEDBACK_FINDING_ID_LENGTH} ký tự`,
      );
    }
    return trimmed;
  }
}
