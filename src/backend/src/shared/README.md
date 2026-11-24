# Shared — Lớp Dùng Chung Xuyên Suốt (Thực Tế)

`src/backend/src/shared/` chứa mọi thứ **dùng chung nhiều module nhưng không thuộc module nào**. Quy tắc bất di bất dịch (CA5, kiểm chứng bởi `unit/arch/clean-architecture.spec.ts`): **`shared` không được import từ `modules/`**.

---

## 1. Bốn tầng trong `shared/` (thực tế)

```text
shared/
├── domain/           # nguyên tố thuần túy: không framework, không module
├── application/      # cổng (hợp đồng) + lỗi
├── infrastructure/   # bộ điều hợp kỹ thuật: database, events, outbox, storage, adapters, config
├── interfaces/       # hướng framework: casl, guards, decorators, pipes, filters, interceptors, middleware, swagger, errors
└── shared.module.ts  # module Nest bọc ngoài
```

Chiều phụ thuộc: `interfaces` → `application` → `domain`. `infrastructure` hiện thực cổng. Bổ sung: CA13 (`shared/domain` không import framework), CA14 (`shared/domain` không import `shared/interfaces`).

---

## 2. `domain/` — nguyên tố thuần túy

| Thư mục | Tệp thật | Vai trò |
|---|---|---|
| `domain/security/` | `action.ts`, `subjects.ts`, `current-user.ts`, `current-user-payload.ts`, `policy-resource-loader.ts` | Hợp đồng phân quyền: `Action` (Manage/Create/Read/Update/Delete/Execute/Export), `SubjectName`, kiểu `CurrentUser`, giao diện nạp resource cho kiểm tra động |
| `domain/pagination/` | `keyset-cursor.ts`, `keyset-sort.util.ts`, `keyset-value.util.ts`, `keyset-filter.util.ts`, `keyset-memory.util.ts`, `keyset-generic-memory.util.ts`, `cursor-codec.ts`, `cursor-paginated.response.ts` | Phân trang keyset (cursor base64url). Vì sao: `skip`/`offset` của Mongo quét O(n) tài liệu bỏ qua — keyset nhảy trực tiếp, giữ độ trễ thấp |
| `domain/crypto/` | `crypto.util.ts`, `mask-pii.ts` | AES-256-GCM + SHA-256; che thông tin nhạy cảm trong log |
| `domain/errors/` | `domain-error.ts`, `error-codes.ts`, `index.ts` | Lớp cơ sở của lỗi nghiệp vụ (mã + thông điệp + ngữ cảnh). Không chứa HTTP status — ánh xạ sang HTTP ở `interfaces/errors/error-http-mapping.ts` |
| `domain/entities/` | `base-entity.ts`, `index.ts` | `BaseEntity`: `id`, `createdAt`, `updatedAt`, `deletedAt`, `isDeleted` |
| `domain/utils/` | `object-id.util.ts`, `realtime-events.ts`, `chart-data.util.ts`, `device-detector.util.ts`, `duration.util.ts`, `email-templates.ts`, `missing-tokens.util.ts`, `list-cursor.ts` | Tiện ích dùng chung |
| `domain/validation/` | `common-schemas.ts` | Schema Zod tái sử dụng (`ObjectIdSchema`, `EmailSchema`, ...) |

## 3. `application/` — cổng

| Tệp thật | Hiện thực mặc định |
|---|---|
| `ports/event-publisher.port.ts` | `HybridEventPublisher` |
| `ports/domain-event-handler.port.ts` | `DomainEventHandlerRegistry` |
| `ports/outbox.port.ts` | `OutboxService` + `OutboxRelayService` |
| `ports/storage.port.ts` | `StorageService` (`shared/infrastructure/storage/storage.service.ts`: S3/R2 nếu có `S3_ENDPOINT`, không thì local `storage/`) |
| `ports/push.port.ts` | `NtfyPushSenderAdapter` |
| `ports/email.port.ts` | `SmtpEmailSenderAdapter` |
| `ports/realtime.port.ts` | `SocketIoRealtimeTransport` |
| `ports/transaction.port.ts` | `MongooseTransactionService` (`withTransaction(fn)`) |
| `ports/workspace-context.port.ts`, `ports/project-context.port.ts` | `WorkspaceContextAdapter`, `ProjectContextAdapter` — chịu lỗi (lỗi → tập rỗng) |
| `errors/` | `status.error.ts`, `index.ts` |

## 4. `infrastructure/` — bộ điều hợp

| Thư mục | Tệp thật | Vai trò |
|---|---|---|
| `config/` | `env.validation.ts` | Kiểm tra Zod toàn bộ biến môi trường lúc khởi động (fail-fast). Ví dụ `DATA_ENCRYPTION_KEY` phải 64 hex |
| `database/` | `database.module.ts`, `base-mongo.repository.ts`, `mongoose-transaction.service.ts`, `mongo-session-context.ts` | `MongooseModule.forRootAsync`, repo cơ sở (lọc xóa mềm, phân trang), session qua `AsyncLocalStorage` |
| `events/` | `hybrid-event.publisher.ts`, `in-process-event.publisher.ts`, `kafka-event.publisher.ts`, `kafka-consumer.service.ts`, `event-dispatcher.service.ts`, `domain-event-handler.registry.ts`, `events.module.ts` | Chọn publisher theo `KAFKA_BROKERS` (rỗng → trong tiến trình, có → Kafka). `EventDispatcherService` định tuyến event → phòng WebSocket, **lỗi realtime không phá vỡ nghiệp vụ lỗi** |
| `outbox/` | `outbox-event.schema.ts`, `processed-event.schema.ts`, `outbox.service.ts`, `outbox-relay.service.ts` (quét 30 giây), `inbox.service.ts`, `outbox.module.ts` | Vòng đời `PENDING -> PROCESSING -> PUBLISHED / FAILED`; inbox idempotent theo `(consumer_name, event_id)` |
| `storage/` | `storage.interface.ts`, `storage.module.ts`, `storage.service.ts` | 2 chế độ: S3-compatible (R2) hoặc local `storage/` — cùng giao diện |
| `adapters/` | `ntfy-push-sender.adapter.ts`, `smtp-email-sender.adapter.ts`, `redis-io.adapter.ts` | Đẩy thông báo/email/bộ điều hợp Redis Socket.IO |

## 5. `interfaces/` — tầng framework

| Thư mục | Tệp thật | Vai trò |
|---|---|---|
| `casl/` | `casl-ability.factory.ts`, `casl.module.ts`, `policies.guard.ts`, `check-policies.decorator.ts`, `policy-resource.decorator.ts`, `current-resource.decorator.ts`, `subject.helper.ts` | Phân quyền ABAC 2 tầng: (1) tĩnh theo subject, (2) động nạp resource qua policy loader (lá chắn IDOR). Subject dạng object phải trích `__type` trước khi `can()` |
| `guards/` | `jwt-auth.guard.ts`, `roles.guard.ts` | Xác thực Bearer (trừ route `@Public()`), kiểm tra vai trò hệ thống |
| `decorators/` | `current-user.decorator.ts`, `public.decorator.ts`, `roles.decorator.ts`, `if-match.decorator.ts` | Tiêm `CurrentUser`, mở route, yêu cầu vai trò, khóa lạc quan (`If-Match`) |
| `pipes/` | `zod-validation.pipe.ts` | Kiểm tra body/query/param bằng Zod — lỗi 400 có payload field+thông điệp |
| `filters/` | `all-exceptions.filter.ts` | Chuyển mọi ngoại lệ về phản hồi thống nhất (`statusCode`, `errorCode`, `requestId`, `timestamp`, `path`) |
| `interceptors/` | `transform.interceptor.ts`, `logging.interceptor.ts` | Bọc phong bì `{ data, meta }`, ghi log kèm `requestId` |
| `middleware/` | `request-id.middleware.ts` | Sinh `X-Request-Id` cho mỗi request |
| `swagger/` | `api-zod.decorator.ts`, `zod-openapi.ts` | Sinh OpenAPI trực tiếp từ schema Zod — không khai báo DTO 2 lần |
| `errors/` | `error-http-mapping.ts`, `index.ts` | Ánh xạ lỗi domain → trạng thái HTTP |

## 6. Test liên quan (thực tế)

Thư mục `unit/shared/` (7 tệp: `casl`, `crypto`, `mask-pii`, `keyset-pagination`, `device-detector`, `domain-error`, `policies-guard`) cùng `unit/arch/` và `unit/infra/event-dispatcher.spec.ts` + `integration/record-query.spec.ts` (keyset, sắp xếp null).
