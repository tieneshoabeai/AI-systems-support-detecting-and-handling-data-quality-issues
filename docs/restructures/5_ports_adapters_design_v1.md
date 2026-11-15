# 5. Thiết kế Ports and Adapters

- **Version:** v1
- **Ngày tạo:** 2026-11-02
- **Cập nhật gần nhất:** 2026-11-05
- **Trạng thái:** Đã chốt cấu trúc tầng trong module, quy tắc chiều dependency, vị trí port, mô hình domain, tổ chức use case, DI token, cơ chế optimistic locking, phân trang, và luồng phát hành sự kiện. Còn mở ở mục 6.2.
- **Giai đoạn:** Tech solution
- **Thứ tự thực hiện:** Phần 5; sử dụng kết quả đã xác nhận của các phần trước.
- **Quan hệ với các phần khác:** Phần 4 v1 đã chốt ranh giới module và cấu trúc thư mục; Phần 6 v3 đã chốt mô hình quyền và cơ chế CASL. Phần này **không** tạo tính năng mới.

## 1. Mục tiêu

Làm rõ và thống nhất thiết kế ports and adapters cho đợt tái cấu trúc backend.

## 2. Nội dung cần bàn luận

- Cấu trúc Domain, Application, Infrastructure và nơi cấu hình Dependency Injection.
- Inbound/outbound ports, adapter, mapper và quy tắc chiều dependency.
- Domain entity, value object, use case input/output và cách giao tiếp giữa module.
- Phân định shared dùng chung và thành phần thuộc riêng nghiệp vụ; lựa chọn cách tổ chức command/query.
- Đối chiếu implementation trong hệ thống tham chiếu làm chuẩn; ghi kỹ thuật/công nghệ sẽ kế thừa, tinh chỉnh hoặc không áp dụng cùng lý do và ảnh hưởng, theo nguyên tắc phần 1.

## 3. Quyết định và thiết kế chi tiết

### 3.1. Các quyết định nền tảng

| # | Quyết định | Nguồn |
|---|---|---|
| 1 | **Rich Domain Model** — entity là class với hành vi, tự bảo vệ invariant | Chốt 2026-11-05 |
| 2 | Port repository đặt ở `domain/ports/`; port hạ tầng đặt ở `application/ports/` | Theo thông lệ ports & adapters |
| 3 | DI token dùng **Symbol** (`export const X_PORT = Symbol('X')`) | Theo thông lệ DI token |
| 4 | **Mỗi use case = 1 handler class riêng** trong `application/commands/` hoặc `application/queries/` | Theo thông lệ 1 UC = 1 handler |
| 5 | Kiểu nền tảng dùng chung (`BaseEntity`, `DomainEvent`, lỗi domain) đặt ở **`packages/core`** | Chốt 2026-11-05 |
| 6 | Optimistic locking bằng **trường `version`** trên entity | Chốt 2026-11-05 |
| 7 | Phân trang **offset** (`page`, `limit`) trong repository port | Đồng bộ Phần 2 v3 (đã chốt offset) |
| 8 | Entity **gom domain event** → handler `dispatchDomainEvents()` → ghi `outbox_event` trong cùng transaction | Bổ sung atomicity so với cách phát event đồng bộ |

### 3.2. Cấu trúc tầng trong một module

Áp dụng cho **mọi** module trong `apps/api/src/modules/<module>/` (Phần 4 v1 mục 3.2):

```
modules/<module>/
├── domain/                          # Tầng trong cùng — không phụ thuộc framework
│   ├── entities/                    # Model nghiệp vụ + invariant + domain event
│   ├── value-objects/               # Kiểu giá trị có validate, transition hợp lệ
│   ├── events/                      # Domain event (không phải event nền)
│   └── ports/                       # Port repository — cổng ra ngoài cho aggregate
├── application/                     # Tầng giữa — điều phối use case
│   ├── commands/                    # Use case thay đổi trạng thái
│   ├── queries/                     # Use case đọc
│   └── ports/                       # Port hạ tầng — storage, email, AI, queue, audit
├── infrastructure/                  # Tầng ngoài — adapter
│   ├── http/                        # Controller, DTO (Zod), response mapper
│   ├── persistence/                 # Schema Mongoose, repository adapter, entity mapper
│   └── messaging/                   # Listener outbox / BullMQ consumer adapter
├── <module>.module.ts               # Composition root — nối port với adapter
└── README.md                        # Trách nhiệm, hợp đồng công khai, dependency
```

**Quy tắc chiều dependency (bắt buộc, kiểm tra bằng script):**

```
domain  ──✗──> application, infrastructure, @nestjs/*, mongoose
application ──✗──> infrastructure, @nestjs/*, mongoose
infrastructure ──✓──> domain, application, @nestjs/*, mongoose
```

Nói cách khác: **mũi tên phụ thuộc luôn hướng vào trong** (`infrastructure → application → domain`).

### 3.3. Domain — Rich Domain Model

**Quyết định.** Entity là class thật, giữ state riêng tư, có hành vi và **tự bảo vệ invariant**. Không cho phép set property tự do từ bên ngoài.

**Ví dụ tham chiếu — aggregate `Incident`:**

```typescript
// packages/core/src/domain/base.entity.ts — nền tảng dùng chung
export interface BaseEntityProps {
  id: string;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date | null;
  version: number;
}

export abstract class BaseEntity {
  readonly id: string;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date | null;
  version: number;

  private _domainEvents: DomainEvent[] = [];

  protected constructor(props: BaseEntityProps) {
    this.id = props.id;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
    this.deletedAt = props.deletedAt ?? null;
    this.version = props.version ?? 0;
  }

  get domainEvents(): ReadonlyArray<DomainEvent> {
    return this._domainEvents;
  }

  protected addDomainEvent(event: DomainEvent): void {
    this._domainEvents.push(event);
  }

  clearDomainEvents(): void {
    this._domainEvents = [];
  }
}
```

**Ba quy tắc bắt buộc cho mọi entity:**

1. **State riêng tư (`_` prefix) + getter công khai.** Không có setter. Mọi thay đổi state phải đi qua hàm hành vi có tên miêu tả nghiệp vụ.
2. **Constructor `private` + hai static factory:**
   - `static create(props)` — tạo mới, gán giá trị mặc định hợp lệ, phát domain event khởi tạo.
   - `static reconstitute(props)` — dựng lại từ dữ liệu đã lưu, **không** phát event.
3. **Invariant được kiểm tra trong chính entity**, không ở handler. Ví dụ vòng đời trạng thái báo cáo sự cố:

```typescript
// apps/api/src/modules/issues/domain/value-objects/issue-status.vo.ts
export type IssueStatusValue = 'new' | 'in_progress' | 'resolved' | 'closed';

const VALID_TRANSITIONS: Record<IssueStatusValue, IssueStatusValue[]> = {
  new: ['in_progress'],
  in_progress: ['new', 'resolved'],   // về 'new' = "Cần bổ sung"
  resolved: ['closed', 'in_progress'],
  closed: [],
};

export function assertIssueTransition(from: IssueStatusValue, to: IssueStatusValue): void {
  if (!VALID_TRANSITIONS[from].includes(to)) {
    throw new InvalidStateTransitionError('issue', from, to);
  }
}

export function isTerminalIssueStatus(status: IssueStatusValue): boolean {
  return status === 'closed';
}
```

**Lưu ý về `reconstitute`:** đây là điểm khác biệt quan trọng so với code hiện tại (dùng Mongoose document trực tiếp làm domain object). Mongoose document có thể bị sửa state ngoài ý muốn (VD `doc.status = 'x'`), phá invariant. Dùng `reconstitute` + mapper để chuyển document → entity, mọi thay đổi phải qua hành vi.

**Entity nào cần Rich Domain Model:**

| Entity | Có invariant cần bảo vệ? | Ghi chú |
|---|---|---|
| `Project` | Có | `status` dẫn xuất từ sự kiện (Phần 2 mục 3.36.1) — không cho set tự do |
| `Workspace` | Có | Chuyển quyền Owner phải nguyên tử, giữ đúng 1 Owner |
| `ProjectMember` | Có | Vai trò hợp lệ; unique Owner mỗi project |
| `IssueReport` | Có | Vòng đời `new → in_progress → resolved → closed` |
| `UserSession` | Có | Revoke là hành động một chiều |
| `Notification` | Có | Đánh dấu đã đọc một chiều |
| `AnalysisResult` | Có | `input_fingerprint` bất biến sau khi tạo |
| `AuditLog` | Không | Append-only, không có hành vi chuyển trạng thái |
| `User` | Có | Không tự sửa `role`/`status` |

### 3.4. Value object

**Quy tắc.** VO là kiểu `type` + hàm khẳng định, hoặc class `readonly` có factory `create()` ném lỗi khi không hợp lệ. VO **không** có id, **không** có hành vi nghiệp vụ riêng ngoài validate.

| VO | Nơi đặt | Ví dụ |
|---|---|---|
| `IssueStatusValue` | `modules/issues/domain/value-objects/` | Chuỗi trạng thái + bảng transition hợp lệ |
| `ProjectStatusValue` | `modules/projects/domain/value-objects/` | `not_started` / `in_progress` / `completed` |
| `WorkspaceRoleValue` | `modules/workspaces/domain/value-objects/` | `owner` / `member` |
| `ProjectRoleValue` | `modules/projects/domain/value-objects/` | `owner` / `member` / `viewer` |
| `Email` | `packages/core/src/value-objects/` | lowercase + trim + validate |
| `PhoneNumber` | `packages/core/src/value-objects/` | Theo mẫu value object `phone-number.vo.ts` |
| `PageRequest` / `PageResult` | `packages/core/src/pagination/` | Chuẩn hoá offset pagination |

**Không tạo VO cho:** `ObjectId` (dùng `string` thuần), `Date` (dùng `Date` thuần), enum đơn giản không kèm ràng buộc (dùng union type).

### 3.5. Domain event

**Quy tắc.** Domain event là sự kiện **đã xảy ra trong aggregate**. Không phải lệnh, không phải intent.

```typescript
// packages/core/src/domain/domain-event.ts
export abstract class DomainEvent {
  abstract readonly eventName: string;
  readonly occurredAt: Date = new Date();

  constructor() {}
}
```

**Phân biệt bắt buộc — Domain event vs Outbox event:**

| | Domain event | Outbox event |
|---|---|---|
| Nằm ở | `domain/events/` | `shared/application/outbox` |
| Phạm vi | Trong một aggregate, trong bộ nhớ | Đã ghi bền vững vào `outbox_event` |
| Số lượng | Có thể 0, 1, nhiều | Một bản ghi DB cho mỗi event |
| Được ai ghi | Entity tự gọi `addDomainEvent()` | Handler gọi `dispatchDomainEvents()` |
| Mục đích | Ghi nhận điều đã xảy ra để handler xử lý | Bảo đảm event không mất khi process chết |

**Danh sách domain event của đợt 1:**

| Module | Event |
|---|---|
| `workspaces` | `WorkspaceCreated`, `WorkspaceOwnerTransferred`, `WorkspaceMemberAdded`, `WorkspaceMemberRemoved` |
| `projects` | `ProjectCreated`, `ProjectDeleted`, `ProjectRoleChanged`, `ProjectOwnerTransferred` |
| `issues` | `IssueReportCreated`, `IssueStatusChanged` |
| `auth` | `UserRegistered`, `PasswordReset`, `PasswordChanged`, `SessionRevoked` |
| `users` | `UserProfileViewedByAdmin` |
| `analysis` | `AnalysisCompleted`, `AnalysisFailed` |
| `summary` | `ProjectSnapshotSaved` |

### 3.6. Port — vị trí, hình dạng và DI token

**Quy tắc vị trí:**

| Loại port | Vị trí | Ví dụ |
|---|---|---|
| Port repository (đọc/ghi aggregate) | `domain/ports/` | `ProjectRepositoryPort`, `IssueReportRepositoryPort` |
| Port hạ tầng (dịch vụ ngoài, hạ tầng kỹ thuật) | `application/ports/` | `StoragePort`, `EmailSenderPort`, `AiAnalyzerPort`, `JobQueuePort`, `AuditLogPort` |
| Port giữa các module | `domain/ports/` của module **sở hữu** | `DatasetReader`, `ProjectReader`, `AnalysisResultReader` |

**Quy tắc quan trọng:** port giữa các module do module **sở hữu** định nghĩa. Module tiêu thụ import port từ module sở hữu — không phải ngược lại. Xem bảng port ở Phần 4 mục 3.4.

**DI token — Symbol:**

```typescript
// apps/api/src/modules/projects/domain/ports/project.repository.port.ts
export const PROJECT_REPOSITORY_PORT = Symbol('ProjectRepositoryPort');

export interface ProjectRepositoryPort {
  findById(id: string): Promise<Project | null>;
  listByWorkspace(workspaceId: string, query: ProjectListQuery): Promise<PageResult<Project>>;
  save(project: Project, expectedVersion?: number): Promise<Project>;
  softDelete(id: string): Promise<void>;
}
```

**Quy tắc bắt buộc:**
1. Mỗi port có **một** Symbol token, đặt cùng file với interface.
2. Adapter được bind bằng `{ provide: X_PORT, useExisting: XAdapter }` — không dùng `useClass` để tránh tạo 2 instance.
3. Interface port **không** được import bất kỳ thứ gì từ NestJS hay Mongoose.
4. Port hạ tầng (`application/ports/`) có thể được **nhiều module** dùng — nhưng adapter thuộc `shared/` và được export từ `SharedModule`.

**Đối chiếu thực hành phổ biến:** dùng `export const INCIDENT_REPOSITORY_PORT = Symbol('IncidentRepositoryPort')` và bind `{ provide: INCIDENT_REPOSITORY_PORT, useExisting: IncidentRepository }` — **giữ nguyên cách này**.

### 3.7. Repository port — đặc tả chung

**Quyết định.** Mọi repository port tuân theo một đặc tả chung, đặt ở `packages/core/src/domain/base.repository.port.ts`.

```typescript
// packages/core/src/domain/base.repository.port.ts
export interface OffsetPageRequest {
  page: number;      // 1-based
  limit: number;
}

export interface PageResult<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface BaseRepositoryPort<T> {
  findById(id: string): Promise<T | null>;
  exists(id: string): Promise<boolean>;
  save(entity: T, expectedVersion?: number): Promise<T>;
  softDelete(id: string): Promise<void>;
}
```

**Quy tắc bắt buộc cho mọi repository adapter:**

| # | Quy tắc |
|---|---|
| 1 | Trả về **entity**, không trả về Mongoose document. Adapter có nhiệm vụ map document → entity qua `reconstitute` |
| 2 | Áp dụng `deleted_at: null` **tự động** trong mọi truy vấn — không để lọt sót (kế thừa từ `BaseMongoRepository` hiện tại) |
| 3 | Không có `findById` nào trả về entity của user khác workspace — kiểm tra phạm vi ở tầng application, không ở adapter |
| 4 | `save` với `expectedVersion` → so sánh `version` hiện tại; lệch → ném `OptimisticLockError` → HTTP `CONFLICT` |
| 5 | Truy vấn danh sách **luôn** có phân trang offset + tổng số bản ghi (`countDocuments`) |
| 6 | Sắp xếp có **index phù hợp** — bắt buộc khai báo trong Phần 8 |
| 7 | Ghi vào MongoDB **không** tự động tạo `created_at`/`updated_at` — adapter tự set để không phụ thuộc `timestamps` của Mongoose |

**Đối chiếu mã nguồn hiện tại — cần sửa:**
- `BaseMongoRepository` hiện trả về **Mongoose document** → phải đổi sang trả entity. Đây là thay đổi lớn nhất, ảnh hưởng toàn bộ 10 module.
- `BaseMongoRepository` **không** hỗ trợ optimistic locking → bổ sung.
- `MongoSessionContext` (AsyncLocalStorage) hiện có và tốt → **giữ nguyên**, dùng cho transaction của outbox.

### 3.8. Phân trang — offset

**Quyết định.** Offset pagination, đồng bộ Phần 2 v3 (đã chốt offset cho `WS-02`, `PROJ-02`, `NOTIF-01`, `ISSUE-02`).

```typescript
// packages/core/src/pagination/page-request.ts
export interface OffsetPageRequest {
  page: number;    // 1-based, mặc định 1
  limit: number;   // mặc định theo từng danh sách (15 workspace/project, 10 notification/issue)
}

export const DEFAULT_PAGE = 1;
export const MAX_LIMIT = 100;
```

**Quy tắc:**
1. `page` bắt đầu từ **1**; `limit` mặc định theo danh sách, tối đa 100.
2. Response luôn trả `total` và `totalPages` — frontend cần biết tổng số để hiển thị phân trang.
3. `limit` vượt `MAX_LIMIT` → `VALIDATION_ERROR` (không tự cắt âm thầm — im lặng cắt làm frontend tính sai `totalPages`).
4. **Không dùng cursor** ở đợt này.

**Đánh đổi đã chấp nhận:** offset pagination không ổn định khi có record mới chen giữa (trang 2 có thể lặp/mất dòng). Chấp nhận vì:
- Các danh sách đều có quy mô nhỏ (workspace, project, thông báo, báo cáo của tôi).
- Offset đơn giản, phân trang "đến trang N" hoạt động đúng như người dùng mong đợi.

**Điều kiện chuyển sang cursor:** khi có danh sách vượt 10.000 bản ghi hoặc cần phân trang vô hạn ổn định — ghi nhận điều kiện này cho Phần 13/14.

**Không áp dụng:** mô hình **cursor pagination** (`CursorPaginatedResult`) cho hầu hết danh sách. Không áp dụng ở đây vì đã chốt offset ở Phần 2 v3 — sẽ phải sửa lại quyết định cũ và thay đổi hợp đồng API cho toàn bộ danh sách.

### 3.9. Optimistic locking — trường `version`

**Quyết định.** Dùng trường `version` trên entity, tăng mỗi lần `save`.

**Cơ chế:**

```
Client đọc entity        → version = 5
Client sửa và lưu        → gửi kèm expectedVersion = 5
Adapter save():
  updateOne({ _id, version: 5 }, { ...changes, version: 6 })
  → nếu matchedCount = 0 → OptimisticLockError → HTTP 409 CONFLICT
```

**Quy tắc bắt buộc:**
1. Mọi entity có trường `version`, khởi tạo `0`.
2. `save(entity, expectedVersion)` — nếu `expectedVersion` khác `version` hiện tại → ném `OptimisticLockError`.
3. **Bắt buộc** dùng cho các thao tác có rủi ro ghi đè:
   - `PROJ-12` lưu trạng thái project — **bắt buộc**, đây chính là cơ chế hiện thực hoá quy tắc "chặn ghi đè bản mới bằng thay đổi từ bản cũ" đã chốt ở Phần 2 mục 3.19.
   - `WS-09` nhượng quyền Workspace Owner.
   - `PROJ-11` nhượng quỳn Project Owner.
   - `PROJ-10` thay đổi vai trò thành viên project.
   - `ISSUE-04` đổi trạng thái báo cáo (chống hai Admin đổi cùng lúc).
4. `version` **không** đưa vào response DTO cho người dùng tự quản lý — client gửi lại giá trị đọc được, không tự tăng.

**Đối chiếu thực hành phổ biến:** nhiều hệ thống dùng `If-Match` header + ETag (`@IfMatchVersion`) **và** trường `version` trên `BaseEntity`. Ta chọn **chỉ trường `version`**, truyền trong body/request. Lý do: `If-Match` header bắt buộc client phải quản lý ETag — thêm độ phức tạp HTTP cho 5 use case mà trường `version` đã giải quyết được.

**Hệ quả cần ghi nhận:** `expectedVersion` phải là **bắt buộc** (bắt buộc trong DTO) cho 5 use case nêu trên. Không bắt buộc → đọc trực tiếp từ DB và so sánh sau, tức mất tác dụng.

### 3.10. Tổ chức use case — handler cho mỗi UC

**Quyết định.** Mỗi use case = **một handler class riêng**, controller gọi thẳng handler.

```
application/
├── commands/
│   ├── create-project.command.ts        # Command = input DTO của tầng application
│   ├── create-project.handler.ts        # Handler = logic điều phối
│   ├── transfer-workspace-owner.command.ts
│   └── transfer-workspace-owner.handler.ts
└── queries/
    ├── list-projects.query.ts
    └── list-projects.handler.ts
```

**Quy tắc:**
1. **1 file = 1 UC.** Command và Handler tách 2 file — nhưng với UC đơn giản có thể gộp, phải nhất quán trong module.
2. Handler là class `@Injectable()`, được khai báo trong `<module>.module.ts`.
3. Controller **không** chứa logic nghiệp vụ — chỉ: validate (Zod pipe) → gọi handler → map kết quả ra response DTO.
4. Handler **không** biết HTTP — trả về kết quả hoặc ném lỗi nghiệp vụ (`DomainError`). Ánh xạ sang HTTP status do `all-exceptions.filter.ts` thực hiện (Phần 6 mục 3.10).
5. Handler nhận dependency qua constructor injection, **chỉ** qua port token — không inject adapter cụ thể.

**Command/Query pattern:** tách `commands/` và `queries/`, không dùng CQRS framework (`@nestjs/cqrs`). Lý do: hệ thống có 67 UC, thêm CQRS framework tạo thêm lớp trừu tượng mà chưa cần; pattern thư mục đã đủ để phân biệt.

### 3.11. Luồng phát hành sự kiện — gom domain event → outbox

**Quyết định.** Entity gom domain event → handler gọi `dispatchDomainEvents()` → ghi `outbox_event` trong **cùng transaction** → relay publish lên BullMQ.

**Luồng đầy đủ:**

```
┌─ Transaction MongoDB ────────────────────────────────────┐
│                                                          │
│  Handler:                                                 │
│    1. nạp entity từ repository                            │
│    2. gọi hành vi: project.transferOwner(newOwnerId)       │
│         └─ entity thêm ProjectOwnerTransferred vào _domainEvents │
│    3. repository.save(entity, expectedVersion)              │
│    4. dispatchDomainEvents(entity)                         │
│         └─ ghi outbox_event { event_type, payload }         │
│    5. transaction commit                                  │
└──────────────────────────────────────────────────────────┘
                          ↓
              OutboxRelay (tiến trình trong apps/worker)
              đọc outbox_event status=PENDING
              → publish lên BullMQ queue
              → đánh dấu PROCESSED
                          ↓
              Consumer: notifications module
              → tạo Notification
              → đánh dấu inbox đã xử lý (idempotent)
```

**Quy tắc bắt buộc:**

| # | Quy tắc |
|---|---|
| 1 | `dispatchDomainEvents()` **phải** được gọi trong cùng transaction với `save()` — không gọi sau commit |
| 2 | Sau khi dispatch, gọi `entity.clearDomainEvents()` để không ghi trùng |
| 3 | Outbox event là **at-least-once** — đánh dấu `PROCESSED` **trước** khi publish, chấp nhận khả năng mất event hơn là ghi trùng |
| 4 | Mọi consumer phải **idempotent** — dùng `event_id` làm khóa dedup (bảng `inbox_processed_event`) |
| 5 | Payload outbox event **chỉ chứa id và dữ liệu tối thiểu** — không chứa dữ liệu nghiệp vụ nhạy cảm (VD: chỉ `project_id`, `recipient_ids`, không chứa tên cột hay giá trị ô) |
| 6 | Domain event **không** mang payload hạ tầng (không có `secret`, `apiKey`) |

**Đối chiếu mã nguồn hiện tại:**
- `OutboxService` hiện có `recordEvent()` với `aggregate_type: 'DATASET' | 'DATASET_VERSION' | 'TRANSFORMATION'` — **cần mở rộng** thành danh sách sự kiện mới ở mục 3.5.
- `OutboxService` hiện **không có** relay (chỉ có `getPendingEvents`/`markAsProcessed`/`markAsFailed`) — relay chưa được viết. Phần 9 sẽ thiết kế chi tiết.
- `recordEvent()` hiện **nhận `session` thủ công** → sẽ dùng `MongoSessionContext` (AsyncLocalStorage) để không phải truyền session thủ công.

**Không dùng `EventEmitter2` của NestJS** (phổ biến cho sự kiện kiểu `incident-created.event.ts`): `EventEmitter2` phát event **đồng bộ trong process**, không bền vững — process chết là mất event. Với yêu cầu "thông báo bắt buộc" (báo cáo cần bổ sung, bản lưu bị ghi đè) và yêu cầu audit log bắt buộc, mất event là không chấp nhận được.

### 3.12. Composition root — `<module>.module.ts`

**Quy tắc.** Chỉ `<module>.module.ts` được biết adapter cụ thể. Đây là nơi DI nối port với adapter.

```typescript
// apps/api/src/modules/issues/issues.module.ts
@Module({
  imports: [
    MongooseModule.forFeature([{ name: IssueReportMongoDocument.name, schema: IssueReportSchema }]),
  ],
  controllers: [IssueReportController],
  providers: [
    // Adapter
    IssueReportMapper,
    IssueReportRepository,
    // Bind port
    { provide: ISSUE_REPORT_REPOSITORY_PORT, useExisting: IssueReportRepository },
    // Handler
    CreateIssueReportHandler,
    ListMyIssueReportsHandler,
    GetIssueReportHandler,
    ReviewIssueReportHandler,
    // Port hạ tầng dùng chung — từ SharedModule
    StoragePort,        // placeholder minh hoạ, thực tế import từ SharedModule
    EmailSenderPort,
  ],
  exports: [ISSUE_REPORT_REPOSITORY_PORT],
})
export class IssuesModule {}
```

**Quy tắc bắt buộc:**
1. `exports` chỉ export **port** mà module khác cần — không export adapter.
2. Port hạ tầng (`StoragePort`, `EmailSenderPort`, `JobQueuePort`, `AuditLogPort`) được cung cấp bởi `SharedModule` và export ở đó — module nghiệp vụ chỉ `imports: [SharedModule]`.
3. Module **không** import module nghiệp vụ khác để lấy port — port được lấy qua `import type` từ package công khai của module sở hữu, và adapter được bind trong `SharedModule` hoặc module hạ tầng tương ứng.

**Điểm cần chốt kỹ thuật — port giữa các module:** port `DatasetReader` do module `datasets` định nghĩa, nhưng adapter hiện thực cũng do `datasets` viết. Vậy module `analysis` cần bind adapter đó → phải import `DatasetsModule` (chỉ để lấy binding), **không** phải để gọi service. Điều này tạo phụ thuộc `analysis → datasets` ở tầng module, vẫn là hướng đơn, không có vòng. Chấp nhận.

**Quy tắc bổ sung — tránh phụ thuộc module không cần thiết:** nếu module A chỉ cần *đọc* từ module B, A import `BModule` và dùng port được export. Nếu B cần A → phụ thuộc vòng ở tầng module → **vi phạm** và phải tách bằng event (Phần 4 mục 3.8).

### 3.13. `packages/core` — kiểu nền tảng dùng chung

**Quyết định.** `packages/core` chứa code thuần TypeScript, không framework, dùng chung cho `apps/api` và `apps/worker`.

```
packages/core/src/
├── domain/
│   ├── base.entity.ts           # BaseEntity + domain event collection
│   ├── domain-event.ts          # DomainEvent abstract
│   ├── base.repository.port.ts  # BaseRepositoryPort, PageResult
│   ├── errors.ts                # DomainError hierarchy
│   ├── id-generator.ts          # Sinh id (ObjectId-compatible 24 hex)
│   └── optimistic-lock.ts       # OptimisticLockError + helper
├── value-objects/
│   ├── email.vo.ts
│   └── phone-number.vo.ts
├── pagination/
│   ├── page-request.ts
│   └── page-result.ts
├── stats/                       # ← xem mục 3.15
│   └── ...
└── index.ts                     # Public contract — chỉ export qua đây
```

**Quy tắc cứng (kiểm tra bằng script R5 ở Phần 4 mục 3.11):**
- `packages/core` **không** import `@nestjs/*`, `mongoose`, `bullmq`, `@aws-sdk/*`, `ioredis`.
- Mọi import từ ngoài package đều đi qua `index.ts` — không import sâu vào file nội bộ.
- Chạy được trong test thuần Node (không cần NestJS testing module).

**Các lỗi domain cần định nghĩa (đồng bộ mã lỗi Phần 3 v2 mục 3.1):**

```typescript
// packages/core/src/domain/errors.ts
export abstract class DomainError extends Error {
  abstract readonly code: string;
  readonly details?: Record<string, unknown>;

  constructor(message: string, details?: Record<string, unknown>) {
    super(message);
    this.details = details;
  }
}

export class ValidationError extends DomainError {
  readonly code = 'VALIDATION_ERROR';
}
export class NotFoundError extends DomainError {
  readonly code = 'NOT_FOUND';
}
export class ForbiddenError extends DomainError {
  readonly code = 'FORBIDDEN';
}
export class ConflictError extends DomainError {
  readonly code = 'CONFLICT';
}
export class PreconditionFailedError extends DomainError {
  readonly code = 'PRECONDITION_FAILED';
}
export class LimitExceededError extends DomainError {
  readonly code = 'LIMIT_EXCEEDED';
}
export class DependencyUnavailableError extends DomainError {
  readonly code = 'DEPENDENCY_UNAVAILABLE';
}
export class TokenInvalidError extends DomainError {
  readonly code = 'TOKEN_INVALID';
}
export class TokenExpiredError extends DomainError {
  readonly code = 'TOKEN_EXPIRED';
}
export class OptimisticLockError extends DomainError {
  readonly code = 'CONFLICT';
  constructor(entity: string, expected: number, actual: number) {
    super(`${entity} đã bị thay đổi bởi người khác`, { expected, actual });
  }
}
export class InvalidStateTransitionError extends DomainError {
  readonly code = 'PRECONDITION_FAILED';
}
```

**Ánh xạ sang HTTP status** (do `all-exceptions.filter.ts` xử lý, không nằm trong `packages/core`):

| Mã lỗi | HTTP status |
|---|---|
| `VALIDATION_ERROR` | 400 |
| `UNAUTHENTICATED` | 401 |
| `TOKEN_INVALID`, `TOKEN_EXPIRED` | 401 |
| `FORBIDDEN` | 403 |
| `NOT_FOUND` | 404 |
| `CONFLICT` | 409 |
| `PRECONDITION_FAILED` | 422 |
| `LIMIT_EXCEEDED` | 429 |
| `DEPENDENCY_UNAVAILABLE` | 503 |

### 3.14. `packages/contracts` — hợp đồng dữ liệu

**Quyết định.** `packages/contracts` chứa schema Zod của DTO request/response và kiểu TypeScript tương ứng.

```
packages/contracts/src/
├── common/
│   ├── pagination.contract.ts     # OffsetPageQuery, PageResponseMeta
│   ├── error.contract.ts           # ApiErrorResponse
│   └── id.contract.ts              # MongoIdSchema, ObjectIdString
├── auth/
│   ├── auth.contract.ts            # LoginRequest, LoginResponse, SessionResponse
│   └── ...
├── workspaces/
├── projects/
├── issues/
├── notifications/
├── analysis/
├── datasets/
└── index.ts
```

**Quy tắc cứng:**
1. `packages/contracts` **không** chứa logic nghiệp vụ — chỉ mô tả hình dạng dữ liệu và validate.
2. Dùng **Zod 4** (đồng bộ stack đã chốt ở Phần 4 v1 mục 3.1).
3. **Một nguồn cho cả validate và OpenAPI:** dùng `zod-to-json-schema` để sinh schema OpenAPI từ schema Zod — không viết lại DTO cho Swagger. Kế thừa `shared/swagger/api-zod.decorator.ts` hiện có.
4. `packages/contracts` không import từ `packages/core` và ngược lại — hai package độc lập, tránh phụ thuộc chéo.
5. Kiểu TypeScript được suy ra từ schema Zod: `export type LoginRequest = z.infer<typeof LoginRequestSchema>`.

**Quan hệ với `packages/core`:** `core` = kiểu nền tảng nghiệp vụ dùng chung (entity base, VO, lỗi, thống kê). `contracts` = hình dạng dữ liệu trao đổi qua API. Hai package không import lẫn nhau.

### 3.15. Vị trí thư viện thống kê

**Đối chiếu mâu thuẫn đã ghi nhận ở Phần 4 mục 6 #2.** Phần 12 v3 mục 3.14 đã chốt dùng `simple-statistics` + `ml-matrix` cho phân tích. Có hai lựa chọn về nơi đặt:

**Quyết định (chốt 2026-11-05):** đặt thư viện thống kê trong **`packages/core/src/stats/`**, vì:
1. Cả `apps/api` và `apps/worker` đều có thể cần tính lại thống kê (VD worker tính lại thống kê khi phân tích chạy lại).
2. Thuật toán thống kê là **logic thuần**, không phụ thuộc framework — đúng nguyên tắc của `packages/core`.
3. Cho phép test thuần Node không cần NestJS.

**Quy tắc:** `packages/core/src/stats/` chỉ chứa **wrapper mỏng** quanh `simple-statistics` và `ml-matrix`:
- `describeColumn(values)` → trả `{ count, missing, mean, median, stdDev, min, max, q1, q3, iqr }`
- `modifiedZScore(values)` → trả mảng điểm số
- `pearsonCorrelation(x, y)`, `spearmanCorrelation(x, y)`
- `cramersV(contingencyTable)`, `etaSquared(...)`
- `vif(X, y)`
- `classImbalanceRatio(labels)`

**Không** viết lại phép tính từ đầu — bọc thư viện đã chốt (Phần 12 mục 3.14). Wrapper tồn tại để: (1) chuẩn hoá tên và kiểu trả về; (2) xử lý trường hợp thiếu mẫu trả về "không tính được" thay vì `NaN`; (3) giữ `packages/core` không phụ thuộc trực tiếp vào 2 thư viện này nếu sau này đổi.

### 3.16. Đối chiếu với hệ thống tham chiếu — kế thừa / tinh chỉnh / không áp dụng

| Hạng mục tham chiếu | Quyết định | Lý do |
|---|---|---|
| Cấu trúc `domain/application/infrastructure` | **Kế thừa** | Đúng kiến trúc đã chốt ở Phần 1 |
| Rich Domain Model, `assertXTransition` | **Kế thừa** | Đã chốt ở mục 3.3 |
| `static create()` / `static reconstitute()` | **Kế thừa** | Ngăn sửa state ngoài hành vi |
| `DomainEvent` + `addDomainEvent` + `clearDomainEvents` | **Kế thừa** | Nền cho outbox |
| Symbol token + `useExisting` | **Kế thừa** | Đã chốt ở mục 3.6 |
| Handler cho mỗi UC, tách `commands/` `queries/` | **Kế thừa** | Đã chốt ở mục 3.10 |
| `BaseEntity` + `version` | **Kế thừa** | Nền optimistic locking |
| `@nestjs/cqrs` | **Không áp dụng** | 67 UC chưa cần; thư mục đã đủ phân biệt |
| `EventEmitter2` cho domain event | **Không áp dụng** | Không bền vững — dùng outbox (mục 3.11) |
| Cursor pagination | **Không áp dụng** | Đã chốt offset ở Phần 2 v3 |
| `If-Match` header + ETag | **Không áp dụng** | Dùng trường `version` trong body |
| Kafka event platform, Elasticsearch, MinIO | **Không áp dụng** | Quá nặng cho phạm vi; đã chốt BullMQ + R2 ở Phần 4 |
| `organizationId` multi-tenant trong `BaseEntity` | **Tinh chỉnh** | Hệ thống đơn tenant — bỏ `organizationId`, thay bằng `workspace_id`/`project_id` khi cần |
| `BaseRepositoryPort` + `CursorPaginatedResult` | **Tinh chỉnh** | Đổi sang offset + `PageResult` |
| `optimistic-lock.ts` | **Kế thừa ý tưởng** | Triển khai lại trong `packages/core` theo trường `version` |
| `shared/domain/errors.ts` | **Kế thừa** | Đưa vào `packages/core` để dùng chung `api` + `worker` |
| `policy.loader` (CASL policy loader) | **Tinh chỉnh** | Rút gọn: chỉ 5 vai trò, dùng CASL với subject cụ thể theo Phần 6 mục 3.10 |
| Script `check-module.mjs` | **Kế thừa** | Bổ sung 6 quy tắc R1–R6 (Phần 4 mục 3.11) |
| `shared/domain/import-result.ts` | **Kế thừa** | Dùng cho kết quả Import nhiều sheet với lỗi từng sheet |

### 3.17. Đối chiếu với mã nguồn hiện tại — danh sách sửa bắt buộc

| # | Vị trí | Vấn đề | Sửa |
|---|---|---|---|
| 1 | `shared/database/base-mongo.repository.ts` | Trả về Mongoose document, không phải entity | Viết lại: adapter trả entity qua `reconstitute` |
| 2 | `shared/database/base-mongo.repository.ts` | Không có optimistic locking | Thêm `save(entity, expectedVersion)` → `OptimisticLockError` |
| 3 | `shared/database/base-mongo.repository.ts` | Filter không chuẩn hoá `id`/`workspace_id`/`project_id` thành string | Giữ `subject.helper.ts` hiện có nhưng chuyển sang dùng trong repository adapter |
| 4 | Toàn bộ `modules/*/schemas/` | Dùng Mongoose document làm domain object | Tách schema (infrastructure) khỏi entity (domain), thêm mapper |
| 5 | `shared/application/outbox/outbox.service.ts` | `aggregate_type` chỉ có 3 giá trị cũ | Mở rộng theo danh sách sự kiện ở mục 3.5 |
| 6 | `shared/application/outbox/outbox.service.ts` | Chưa có relay, chưa có dedup inbox | Thiết kế ở Phần 9 |
| 7 | `shared/application/outbox/outbox.service.ts` | `recordEvent` nhận `session` thủ công | Dùng `MongoSessionContext` (đã có, giữ nguyên) |
| 8 | `shared/storage/storage.interface.ts` | Tên `IStorageService` — đổi sang port `StoragePort` theo chuẩn Phần 4 | Đổi tên, đặt port ở `application/ports/` của module dùng, adapter ở `shared/` |
| 9 | `shared/storage/storage.service.ts` | Có bug: ghi `raw_files/{id}.csv` cho cả file `.xlsx` | Sửa theo mục 3.6 của Phần 2 (giữ đúng extension gốc) |
| 10 | `shared/casl/casl-ability.factory.ts` | `can(Manage, 'all')` cho admin | Sửa theo Phần 6 mục 3.10 |
| 11 | `shared/decorators/current-user.decorator.ts` | Nhúng `workspaceId`/`workspaceRole` vào token | Bỏ khỏi token; đọc vai trò từ DB mỗi request |
| 12 | Toàn bộ `modules/*/*.service.ts` | Service class lớn gộp nhiều UC | Tách thành handler theo UC (mục 3.10) |
| 13 | `shared/pipes/zod-validation.pipe.ts` | Chỉ hỗ trợ 1 nguồn schema | Bổ sung hỗ trợ schema từ `packages/contracts` |
| 14 | `shared/swagger/api-zod.decorator.ts` | Giữ nguyên | Dùng để sinh OpenAPI từ `packages/contracts` |

### 3.18. Kiểm tra dependency bắt buộc

Ngoài 6 quy tắc R1–R6 ở Phần 4 mục 3.11, Phần 5 bổ sung:

| # | Kiểm tra | Mô tả |
|---|---|---|
| R7 | Package purity mở rộng | `packages/contracts` không import `@nestjs/*`, `mongoose`, `bullmq` |
| R8 | Không import chéo `packages/` | `packages/core` không import `packages/contracts` và ngược lại |
| R9 | Public contract | Import giữa package chỉ qua `index.ts` |
| R10 | Handler không chứa HTTP | Không file trong `application/` import `@nestjs/common` decorator (`@Controller`, `@Res`) |
| R11 | Controller không chứa logic nghiệp vụ | File trong `infrastructure/http/` không import trực tiếp repository/port, chỉ qua handler |
| R12 | Domain không phụ thuộc Mongoose | Không `import ... from 'mongoose'` trong `domain/` |

**Kết quả R12 dùng làm tiêu chí nghiệm thu:** toàn bộ `domain/` của 21 module phải test được bằng unit test thuần Node không cần MongoDB.

## 4. Đầu vào và đầu ra

**Đầu vào**
- Phần 1 v1 — Modular Monolith + Ports and Adapters.
- Phần 2 v3 — mã lỗi, quy tắc nghiệp vụ, đặc tả tính năng.
- Phần 3 v2 — 67 UC, quy ước lỗi (mục 3.1), các trạng thái.
- Phần 4 v1 — ranh giới module, bảng port, cấu trúc thư mục, 6 quy tắc kiểm tra.
- Phần 6 v3 — mô hình 5 vai trò, cơ chế CASL, optimistic locking liên quan.
- Phần 12 v2 — thư viện thống kê, cơ chế AI, input fingerprint.
- Mã nguồn hiện tại — `base-mongo.repository.ts`, `outbox.service.ts`, `storage.service.ts`, `casl-ability.factory.ts`.
- Mẫu tham chiếu — `incident` module (entity, VO, port, handler, mapper, module), `shared/domain/`.

**Đầu ra**
- Cấu trúc tầng và quy tắc chiều dependency.
- Mẫu entity/value-object/domain event cụ thể.
- Đặc tả chung của repository port, pagination, optimistic locking.
- Quy tắc đặt port, DI token, composition root.
- Nội dung `packages/core` và `packages/contracts`.
- Bảng đối chiếu với mẫu tham chiếu: kế thừa / tinh chỉnh / không áp dụng.
- 14 điểm sửa bắt buộc trong code hiện tại.
- 12 quy tắc kiểm tra dependency (R1–R12).

## 5. Điều kiện hoàn tất phần này

Có hợp đồng và quy tắc kiến trúc đủ cụ thể để triển khai và kiểm tra dependency.

**Trạng thái v1:** cấu trúc tầng, vị trí port, DI token, mô hình domain, tổ chức use case, cơ chế optimistic locking, phân trang, luồng outbox, nội dung hai package dùng chung và quy tắc kiểm tra dependency đã chốt. Còn 5 câu hỏi mở tại mục 6.2.

## 6. Câu hỏi và phụ thuộc còn mở

### 6.1. Đã chốt ở v1

| # | Câu hỏi | Kết quả |
|---|---|---|
| 1 | Phong cách domain model | **Rich Domain Model** (mục 3.3) |
| 2 | Vị trí port | `domain/ports/` = repository; `application/ports/` = hạ tầng (mục 3.6) |
| 3 | DI token | **Symbol** (mục 3.6) |
| 4 | Tổ chức use case | **1 handler class / UC** (mục 3.10) |
| 5 | Vị trí kiểu nền tảng dùng chung | **`packages/core`** (mục 3.13) |
| 6 | Cơ chế chống ghi đè đồng thời | **Trường `version`** (mục 3.9) |
| 7 | Phân trang | **Offset** (mục 3.8) |
| 8 | Luồng phát hành sự kiện | Gom domain event → `dispatchDomainEvents()` → outbox (mục 3.11) |
| 9 | Vị trí thư viện thống kê | **`packages/core/src/stats/`** (mục 3.15) |
| 10 | Có dùng CQRS framework không | **Không** — chỉ phân thư mục `commands/` `queries/` (mục 3.10) |
| 11 | `EventEmitter2` cho domain event | **Không** — dùng outbox để bền vững (mục 3.11) |
| 12 | `If-Match` header | **Không** — dùng `expectedVersion` trong body (mục 3.9) |

### 6.2. Còn mở

| # | Câu hỏi | Ảnh hưởng | Nơi xử lý |
|---|---|---|---|
| 1 | Command và Handler có tách 2 file hay gộp 1 file? Thông lệ tách 2 file nhưng UC của ta có nhiều UC đơn giản | Quy ước file, ảnh hưởng khối lượng file | Phần 14 (khi bắt đầu viết code) |
| 2 | Có cần `mapper` riêng cho mỗi entity, hay đặt hàm `toDomain` / `toPersistence` ngay trong file repository adapter? | Số file, khả năng tái sử dụng | Phần 14 |
| 3 | `packages/contracts` có cần export Zod schema cho **frontend** dùng chung, hay chỉ dùng trong backend? | Monorepo có `apps/web` hay không | Phần 4 mục 6 #2, Phần 14 |
| 4 | Có cần một `use-case` abstraction chung (interface `UseCase<I, O>`) để controller gọi thống nhất? | Đồng nhất controller | Phần 14 |
| 5 | Ai chịu trách nhiệm sinh `id` cho entity mới — `packages/core` (`id-generator.ts`) hay MongoDB ObjectId? Hiện có mô hình sinh 24 hex ngẫu nhiên | Tương thích với `ObjectId` của Mongoose | Phần 8 (schema) |

**Phụ thuộc cứng:** câu hỏi 5 phải chốt trước khi thiết kế schema ở Phần 8, vì quyết định này ảnh hưởng kiểu khóa chính của toàn bộ 21 collection. Câu hỏi 3 ảnh hưởng phạm vi monorepo.

### 6.3. Phụ thuộc bên ngoài

- `simple-statistics` + `ml-matrix` — thư viện phân tích đã chốt ở Phần 12 mục 3.14; dùng qua wrapper trong `packages/core/src/stats/`.
- `zod` 4 + `zod-to-json-schema` — validate và sinh OpenAPI từ một nguồn.
- `@casl/ability` — dựng ability theo ngữ cảnh (Phần 6 mục 3.10).
- `mongoose` 9 — adapter persistence; `domain/` không được import.
- `bullmq` + `ioredis` — hàng đợi và rate-limit (Phần 6 mục 3.9).
- MongoDB transaction — cần replica set; bắt buộc cho cơ chế outbox (Phần 9).

## 7. Prompting log và lịch sử thay đổi

- **Yêu cầu:** Người dùng yêu cầu liệt kê toàn bộ các phần theo thứ tự thực hiện, tạo sẵn file v1, lần lượt hoàn thiện vòng đầu rồi tạo v2 khi có thay đổi tiếp theo.
- **v1 / 2026-11-02:** Tạo khung phần 5 / Chuẩn bị thảo luận tuần tự / Chỉ tạo tài liệu, chưa thực thi thay đổi backend hoặc dữ liệu.
- **Bổ sung v1 / 2026-11-02:** Thêm yêu cầu đối chiếu hệ thống tham chiếu về kỹ thuật và công nghệ / Theo yêu cầu người dùng / Chưa quyết định implementation cụ thể.
- **v1 / 2026-11-05:** Hoàn thiện vòng đầu. Chốt 12 quyết định: Rich Domain Model; port ở `domain/ports/` + `application/ports/`; Symbol token; 1 handler/UC; `packages/core` cho kiểu nền tảng; trường `version` cho optimistic locking; offset pagination; gom domain event → outbox trong transaction; thống kê ở `packages/core/src/stats/`; không CQRS framework; không `EventEmitter2`; không `If-Match`; bảng đối chiếu với mẫu tham chiếu (kế thừa/tinh chỉnh/không áp dụng); 14 điểm sửa bắt buộc trong code hiện tại; 12 quy tắc kiểm tra dependency R1–R12.
