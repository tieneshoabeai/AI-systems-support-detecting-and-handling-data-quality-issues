/**
 * `BaseEntity` — lớp cơ sở cho mọi entity nghiệp vụ.
 *
 * **Vì sao cần?**
 * Trước Bước 3, tầng `domain` chỉ có các `interface *Record` — cấu trúc dữ liệu
 * trần, không có hành vi. Mọi invariant (VD: "workspace phải có đúng 1 Owner")
 * được rải rác trong handler, dễ bị bỏ sót.
 *
 * `BaseEntity` đặt nền:
 *   1. **State riêng tư + getter công khai** — không có setter tự do.
 *   2. **`version`** — nền cho optimistic locking (Phần 5 §3.1 quyết định 6).
 *   3. **Domain event** — entity gom event, handler đẩy qua outbox (Phần 5 §3.1
 *      quyết định 8).
 *
 * **Thuần tuyệt đối** — không import framework, không biết HTTP, không biết Mongoose.
 * Đây là ranh giới được rule **CA13** bảo vệ.
 *
 * **Generic** — mỗi aggregate có props riêng, nên `BaseEntity<TProps>` giữ kiểu
 * chính xác cho `this.props` thay vì phải ép kiểu ở từng getter.
 */

/** Trạng thái xoá mềm + mốc thời gian + phiên bản — chung cho mọi aggregate. */
export interface BaseEntityProps {
  id: string;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date | null;
  /** Phiên bản hiện tại — dùng cho optimistic locking. */
  version: number;
}

/**
 * Lớp cơ sở cho entity nghiệp vụ.
 *
 * Subclass **phải** gọi `super(props)` và dùng `static create()` / `static reconstitute()`
 * — constructor là `protected` để chặn việc khởi tạo từ bên ngoài.
 */
export abstract class BaseEntity<TProps extends BaseEntityProps = BaseEntityProps> {
  protected readonly props: TProps;

  /**
   * Domain event chưa được phát — handler gọi `dispatchDomainEvents()` để ghi
   * vào `outbox_event` trong cùng transaction.
   */
  private _domainEvents: DomainEvent[] = [];

  protected constructor(props: TProps) {
    this.props = { ...props };
  }

  get id(): string {
    return this.props.id;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  get deletedAt(): Date | null {
    return this.props.deletedAt ?? null;
  }

  get version(): number {
    return this.props.version;
  }

  /** `true` khi bản ghi đã bị xoá mềm — entity này không còn dùng được. */
  isDeleted(): boolean {
    return this.deletedAt !== null;
  }

  /** Domain event đang chờ phát. */
  get domainEvents(): ReadonlyArray<DomainEvent> {
    return this._domainEvents;
  }

  /** Ghi nhận domain event — chỉ subclass được gọi. */
  protected addDomainEvent(event: DomainEvent): void {
    this._domainEvents.push(event);
  }

  /**
   * Lấy và xoá danh sách event đang chờ.
   *
   * Handler gọi method này sau khi ghi event vào outbox — để entity không phát
   * trùng cùng một event nếu được lưu lại nhiều lần trong cùng luồng.
   */
  dispatchDomainEvents(): DomainEvent[] {
    const events = [...this._domainEvents];
    this._domainEvents = [];
    return events;
  }

  /**
   * Bản chụp state dùng để đối chiếu/so sánh — không chứa event.
   *
   * `toObject()` là **chuẩn hoá serialisation** mà tầng ngoài (CASL subject,
   * log, cache) dùng để đọc entity như một object phẳng — vì `props` là
   * private nên `Object.entries(entity)` chỉ thấy `props`/`_domainEvents`.
   */
  toObject(): TProps {
    return this.snapshot();
  }

  /** Bản chụp state để đối chiếu/so sánh — không chứa event. */
  protected snapshot(): TProps {
    return { ...this.props };
  }
}

/**
 * `DomainEvent` — sự kiện nghiệp vụ phát ra từ entity.
 *
 * **Khác `DomainEventEnvelope`** (`shared/application/ports/event-publisher.port.ts`):
 * envelope là hợp đồng với hạ tầng publish (có `eventId`, `occurredAt`…),
 * còn `DomainEvent` ở đây là **ý định nghiệp vụ** do entity phát ra — chưa có
 * hạ tầng nào biết tới.
 */
export interface DomainEvent {
  /** Tên sự kiện, dạng `dot.camelCase` (VD: `workspace.owner_transferred`). */
  readonly eventType: string;
  /** Id của aggregate phát sự kiện. */
  readonly aggregateId: string;
  /** Dữ liệu nghiệp vụ kèm theo. */
  readonly payload: Readonly<Record<string, unknown>>;
  /** Thời điểm phát — adapter tự điền nếu không truyền. */
  readonly occurredAt?: Date;
}
