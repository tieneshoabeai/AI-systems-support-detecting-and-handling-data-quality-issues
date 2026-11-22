# Shared Layer - Lớp Cross-Cutting

Lớp `shared` chứa toàn bộ khái niệm **dùng chung cho nhiều module** nhưng **không thuộc về module nào**. Đây là nơi đặt các primitive mà cả 13 module nghiệp vụ đều cần: phân quyền, phân trang, event bus, lưu trữ, giao dịch, mã hoá, lỗi.

> **Quy tắc bất di bất dịch:** `shared` **không được** import từ `modules/` (quy tắc CA5). Nếu một thứ chỉ dùng cho một module, nó **không thuộc về shared** - hãy đặt vào `modules/<tên>/`.

---

## 1. Bốn tầng trong `shared`

```text
shared/
├── domain/           # Primitive thuần: không framework, không module
├── application/      # Port (hợp đồng) mà infrastructure hiện thực
├── infrastructure/   # Adapter kỹ thuật: MongoDB, Kafka, Redis, S3, config
└── interfaces/       # Guard, decorator, pipe, filter, interceptor (framework-facing)
```

Chiều phụ thuộc đi **một chiều**: `interfaces` → `application` → `domain`. `infrastructure` hiện thực các port trong `application`.

Quy tắc bổ sung (được kiểm tra tự động):

| Mã | Quy tắc |
|---|---|
| CA13 | `shared/domain` không import framework |
| CA14 | `shared/domain` không import `shared/interfaces` |

---

## 2. `shared/domain` - Primitive thuần

### 2.1 `domain/security/` - Hợp đồng phân quyền

| File | Nội dung |
|---|---|
| `action.ts` | Enum `Action`: `Manage`, `Create`, `Read`, `Update`, `Delete`, `Execute`, `Export` |
| `subjects.ts` | Union `SubjectName`: `all`, `Workspace`, `Project`, `Dataset`, `DataRecord`, `Analysis`, `User`, `Session`, `Notification`, `IssueReport`, `FindingFeedback` |
| `current-user.ts` | Kiểu ngữ cảnh người dùng hiện tại |
| `current-user-payload.ts` | Payload JWT đã giải mã |
| `policy-resource-loader.ts` | Interface nạp resource cho kiểm tra instance |

**Vì sao nằm ở `domain`?** `@PolicyResource` (tầng Interfaces) và policy loader (tầng Application) đều cần biết tên subject. Hợp đồng phải nằm ở Domain để cả hai cùng import mà không vi phạm chiều phụ thuộc.

### 2.2 `domain/pagination/` - Phân trang Keyset

| File | Vai trò |
|---|---|
| `keyset-cursor.ts` | Định nghĩa cursor: giá trị sort + mốc `_id` |
| `keyset-sort.util.ts` | Chuyển sort request → điều kiện lọc MongoDB |
| `keyset-value.util.ts` | So sánh giá trị giữa hai bản ghi |
| `keyset-filter.util.ts` | Lọc theo điều kiện đã dịch |
| `keyset-memory.util.ts` | Phân trang keyset trên mảng in-memory |
| `keyset-generic-memory.util.ts` | Biến thể generic của bản trên |
| `cursor-codec.ts` | Encode/decode cursor sang base64url |
| `cursor-paginated.response.ts` | DTO response chuẩn (items + nextCursor) |

**Vì sao quan trọng:** `offset`/`skip` của MongoDB phải quét toàn bộ document bị bỏ qua - O(n) và càng chậm khi trang càng lớn. Keyset cursor chỉ nhảy trực tiếp tới vị trí cần đọc, giữ độ trễ ≤ 50 ms kể cả với hàng triệu dòng.

### 2.3 `domain/crypto/` - Bảo mật dữ liệu

| File | Vai trò |
|---|---|
| `crypto.util.ts` | Mã hoá/giải mã AES-256-GCM, hash SHA-256 |
| `mask-pii.ts` | Che PII trong log (email, sđt, CCCD) |

### 2.4 `domain/errors/` - Lỗi nghiệp vụ

| File | Vai trò |
|---|---|
| `domain-error.ts` | Lớp base của lỗi nghiệp vụ (mã lỗi + message + context) |
| `error-codes.ts` | Danh mục mã lỗi chuẩn hoá |
| `index.ts` | Public contract |

Lỗi domain **không** chứa HTTP status. Việc ánh xạ sang HTTP nằm ở `interfaces/errors/error-http-mapping.ts` - giữ domain độc lập với giao thức.

### 2.5 `domain/entities/` - `BaseEntity`

Base class cung cấp: `id`, `createdAt`, `updatedAt`, `deletedAt` và helper `isDeleted`.

### 2.6 `domain/utils/` - Tiện ích dùng chung

| File | Vai trò |
|---|---|
| `object-id.util.ts` | Validate `ObjectId` 24 hex |
| `realtime-events.ts` | Hằng số tên phòng & sự kiện realtime |
| `chart-data.util.ts` | Chuẩn hoá dữ liệu biểu đồ |
| `device-detector.util.ts` | Nhận diện thiết bị từ User-Agent |
| `duration.util.ts` | Định dạng thời lượng |
| `email-templates.ts` | Template email dùng chung |
| `missing-tokens.util.ts` | Phát hiện token thiếu trong chuỗi |
| `list-cursor.ts` | Cursor cho danh sách dài hạn |

### 2.7 `domain/validation/` - Schema Zod dùng chung

`common-schemas.ts` chứa các schema tái sử dụng: `ObjectIdSchema`, `EmailSchema`, `PasswordSchema`, `PaginationSchema`...

---

## 3. `shared/application` - Port

Port là **hợp đồng** (interface) mà tầng Infrastructure hiện thực. Tầng Application chỉ biết port, không biết MongoDB/Kafka/S3.

| Port | Trách nhiệm | Hiện thực mặc định |
|---|---|---|
| `event-publisher.port.ts` | Phát domain event | `HybridEventPublisher` |
| `domain-event-handler.port.ts` | Đăng ký handler cho event | `DomainEventHandlerRegistry` |
| `outbox.port.ts` | Ghi/đọc outbox event | `OutboxService` + `OutboxRelayService` |
| `storage.port.ts` | Lưu & tải file | `StorageService` (S3/R2 hoặc local) |
| `push.port.ts` | Gửi push notification | `NtfyPushSenderAdapter` |
| `email.port.ts` | Gửi email | `SmtpEmailSenderAdapter` |
| `realtime.port.ts` | Đẩy sự kiện realtime | `SocketIoRealtimeTransport` |
| `transaction.port.ts` | Chạy callback trong transaction | `MongooseTransactionService` |
| `workspace-context.port.ts` | Resolve vai trò workspace của user | `WorkspaceContextAdapter` |
| `project-context.port.ts` | Resolve vai trò project của user | `ProjectContextAdapter` |

Hai context port là **fail-safe**: lỗi truy vấn trả về tập rỗng thay vì ném, để sự cố hạ tầng không chặn oan người dùng hợp lệ.
## 4. `shared/infrastructure` - Adapter

### 4.1 `infrastructure/config/env.validation.ts`

Validate toàn bộ biến môi trường bằng Zod **lúc khởi động**. Sai cấu hình → ứng dụng **fail fast** thay vì chạy với giá trị mặc định sai. Ví dụ `DATA_ENCRYPTION_KEY` phải đúng 64 hex; `JWT_*_SECRET` phải ≥ 32 ký tự.

### 4.2 `infrastructure/database/`

| File | Vai trò |
|---|---|
| `database.module.ts` | Khai báo `MongooseModule.forRootAsync`, cấu hình connection pool |
| `base-mongo.repository.ts` | Base repository: soft-delete filter, phân trang, mapping chung |
| `mongoose-transaction.service.ts` | Hiện thực `TransactionPort` - `withTransaction(fn)` |
| `mongo-session-context.ts` | Truyền session MongoDB qua `AsyncLocalStorage` cho repository |

### 4.3 `infrastructure/events/` - Event Bus

| File | Vai trò |
|---|---|
| `hybrid-event.publisher.ts` | Chọn publisher theo môi trường: có `KAFKA_BROKERS` → Kafka, không → in-process |
| `in-process-event.publisher.ts` | Phát event đồng bộ trong tiến trình (mặc định, dev) |
| `kafka-event.publisher.ts` | Phát event lên Kafka topic |
| `kafka-consumer.service.ts` | Consumer Kafka cho worker |
| `event-dispatcher.service.ts` | Định tuyến domain event → phòng WebSocket |
| `domain-event-handler.registry.ts` | Registry handler theo tên event |

**Điểm quan trọng:** `EventDispatcherService` **không được phá vỡ luồng nghiệp vụ lõi** khi realtime lỗi. Lỗi realtime được log và nuốt, không rollback transaction đã commit.

### 4.4 `infrastructure/outbox/` - Outbox & Inbox

| File | Vai trò |
|---|---|
| `outbox-event.schema.ts` | Schema MongoDB cho `outbox_events` |
| `processed-event.schema.ts` | Schema MongoDB cho `processed_events` (inbox) |
| `outbox.service.ts` | Ghi outbox event trong cùng transaction với entity |
| `outbox-relay.service.ts` | Poll outbox (chu kỳ 30s), publish, cập nhật trạng thái |
| `inbox.service.ts` | Idempotency at-least-once theo cặp `(consumer_name, event_id)` |

**Vòng đời outbox event:**

```text
PENDING -> PROCESSING -> PUBLISHED
                   |
                   +-> FAILED (sau N lần retry)
```

### 4.5 `infrastructure/storage/`

`StorageService` hiện thực `StoragePort` với hai chế độ:

- **S3-compatible** (Cloudflare R2): khi có `S3_ENDPOINT` + `S3_BUCKET_NAME`.
- **Local filesystem**: mặc định, lưu trong `storage/`.

Cùng một interface nên module không cần biết backend lưu trữ nào đang dùng.

### 4.6 `infrastructure/adapters/`

| File | Vai trò |
|---|---|
| `ntfy-push-sender.adapter.ts` | Gửi push qua ntfy.sh |
| `smtp-email-sender.adapter.ts` | Gửi email qua SMTP |

---

## 5. `shared/interfaces` - Tầng Framework

### 5.1 `interfaces/casl/` - Phân quyền CASL

| File | Vai trò |
|---|---|
| `casl-ability.factory.ts` | Tạo `PureAbility` từ subject + context |
| `policies.guard.ts` | Guard thực thi kiểm tra 2 tầng |
| `check-policies.decorator.ts` | `@CheckPolicies(...)` khai báo yêu cầu trên handler |
| `policy-resource.decorator.ts` | `@PolicyResource(...)` khai báo cách nạp resource |
| `current-resource.decorator.ts` | Inject resource đã nạp vào handler |
| `subject.helper.ts` | Chuẩn hoá subject object → tên subject |

**Kiểm tra 2 tầng trong `PoliciesGuard`:**

1. **Static:** so khớp tên subject với hành động (không cần truy vấn DB).
2. **Dynamic:** nạp resource thật qua policy loader rồi kiểm tra thuộc tính instance (`workspace_id`, `owner_id`...). Đây là lá chắn **IDOR**.

**Xử lý subject dạng object:** nếu subject là object `{ __type: 'Project' }`, guard phải trích `__type` ra thành chuỗi trước khi `can()`. Nếu không, static check pass nhưng dynamic check fail - đây là lỗi đã được sửa và có test riêng trong `test/policies-guard.spec.ts`.

### 5.2 `interfaces/guards/`

| File | Vai trò |
|---|---|
| `jwt-auth.guard.ts` | Xác thực Bearer token, trừ route `@Public()` |
| `roles.guard.ts` | Kiểm tra vai trò hệ thống (`admin`, `analyst`) |

### 5.3 `interfaces/decorators/`

| File | Vai trò |
|---|---|
| `current-user.decorator.ts` | Inject `CurrentUser` vào handler |
| `public.decorator.ts` | `@Public()` - mở route không cần token |
| `roles.decorator.ts` | `@Roles(...)` - yêu cầu vai trò hệ thống |
| `if-match.decorator.ts` | `@IfMatch()` - header `If-Match` cho optimistic locking |

### 5.4 `interfaces/pipes/zod-validation.pipe.ts`

Validate body/query/param bằng Zod schema. Lỗi trả **400** với payload có cấu trúc (danh sách field + message), không phải stack trace.

### 5.5 `interfaces/filters/all-exceptions.filter.ts`

Chuyển mọi exception thành response thống nhất:

```json
{
  "statusCode": 400,
  "error": "Bad Request",
  "message": "...",
  "errorCode": "DQ_VALIDATION_ERROR",
  "requestId": "...",
  "timestamp": "...",
  "path": "/api/v1/..."
}
```

### 5.6 `interfaces/interceptors/`

| File | Vai trò |
|---|---|
| `transform.interceptor.ts` | Bọc response vào envelope `{ data, meta }` |
| `logging.interceptor.ts` | Log request kèm `requestId` và thời gian xử lý |

### 5.7 `interfaces/middleware/request-id.middleware.ts`

Sinh `requestId` cho mỗi request, gắn vào response header và log context.

### 5.8 `interfaces/swagger/`

`api-zod.decorator.ts` + `zod-openapi.ts` sinh OpenAPI schema **trực tiếp từ Zod schema** - không khai báo trùng lặp DTO cho Swagger.

---

## 6. Quy ước đặt tên

| Tiền tố / hậu tố | Ý nghĩa |
|---|---|
| `*.port.ts` | Interface hợp đồng (tầng Application) |
| `*.adapter.ts` | Hiện thực của port (tầng Infrastructure) |
| `*.service.ts` | Lớp dịch vụ dùng chung |
| `*.guard.ts` | Guard của NestJS |
| `*.decorator.ts` | Decorator |
| `*.util.ts` | Hàm thuần, không trạng thái |
| `*.vo.ts` | Value Object bất biến |
| `*.entity.ts` | Entity có hành vi |
| `*.schema.ts` | Schema Mongoose |

---

## 7. Kiểm thử liên quan

| File spec | Phạm vi |
|---|---|
| `test/policies-guard.spec.ts` | CASL 2 tầng, IDOR, context port |
| `test/event-dispatcher.spec.ts` | Realtime routing, inbox idempotency, registry |
| `test/realtime-gateway.spec.ts` | WebSocket handshake, phòng, quyền |
| `test/ai-adapters-outbox.spec.ts` | LocalInferenceAdapter, ResourceGuard, OutboxRelay |
| `test/integration/record-query.spec.ts` | Keyset pagination, null sorting |
| `test/mongo-session-arch.spec.ts` | Truyền session MongoDB qua AsyncLocalStorage |
