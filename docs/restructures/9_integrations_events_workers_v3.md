# 9. Tích hợp, sự kiện và worker

- **Version:** v3
- **Ngày tạo:** 2026-11-02
- **Cập nhật gần nhất:** 2026-11-05 (v3)
- **Thay đổi v3 (2026-11-05):** hạ tầng sự kiện chuyển từ **BullMQ/Redis** sang **Kafka** (5 topic, 6 consumer group, DLQ `dlq.dead-letter`); thêm **Socket.IO** làm kênh realtime tới client; AI chuyển sang **engine cục bộ** (`Qwen3-14B`/`Qwen3-8B`) qua `AiInferencePort`. Đồng bộ theo quyết định **dữ liệu bất biến (chỉ đọc)** — không có event nào phát sinh từ thao tác xoá dòng / sửa ô / clean-rules / rollback phiên bản; consumer **không được** ghi vào `dataset_record`.
- **Trạng thái:** Đã chốt 8 quyết định hạ tầng (relay change stream + polling fallback, 1 hàng đợi, inbox pattern, at-least-once, SMTP, PDF ở worker, cleanup hằng ngày, chỉ worker chạy consumer) và thiết kế chi tiết **toàn bộ sự kiện, hàng đợi, consumer, adapter hạ tầng, chính sách retry và phục hồi lỗi**. Còn mở ở mục 6.2.
- **Giai đoạn:** Tech solution
- **Thứ tự thực hiện:** Phần 9; sử dụng kết quả đã xác nhận của các phần trước.
- **Quan hệ với các phần khác:** kế thừa cơ chế outbox của Phần 4 mục 3.5, schema `outbox_event`/`ai_job` của Phần 8 mục 3.7.4 và 3.8.5, quy ước 202 Accepted của Phần 7 mục 3.10, cơ chế AI của Phần 12 mục 3.9–3.10, tham chiếu mã nguồn triển khai (`outbox-change-stream.watcher.ts`, `inbox-consumer.service.ts`, `domain-event.processor.ts`).

## 1. Mục tiêu

Làm rõ và thống nhất tích hợp, sự kiện và worker cho đợt tái cấu trúc backend.

## 2. Nội dung cần bàn luận

- Các dịch vụ bên ngoài cần giữ hoặc thay đổi; port và adapter tương ứng.
- Hợp đồng sự kiện và producer/consumer; xử lý đồng bộ hoặc bất đồng bộ.
- Nhu cầu worker riêng, retry, idempotency, ordering và phục hồi lỗi.
- Outbox/inbox hoặc cơ chế khác chỉ chọn khi đã đánh giá nhu cầu và trade-off.

## 3. Quyết định và thiết kế chi tiết

### 3.1. Các quyết định nền tảng

| # | Quyết định | Ghi chú |
|---|---|---|
| 1 | Outbox relay: **Change Stream + polling fallback** | Change stream là kênh chính; polling quét event mồ côi |
| 2 | **v3 — Kafka** làm event bus: 5 topic theo bounded context (mục 3.4.2) | `domain.events`, `ai.jobs`, `notification.dispatch`, `realtime.push`, `dlq.dead-letter` |
| 3 | Chống xử lý trùng: **collection `processed_event`** (inbox pattern) | Khoá unique `(consumer_name, event_id)` |
| 4 | Bảo đảm giao: **at-least-once** | Có thể gửi trùng → consumer phải idempotent |
| 5 | Gửi email: **SMTP / Nodemailer** | Không khoá vendor |
| 6 | Sinh PDF: **worker Kafka** | Trả 202 + `pollUrl` |
| 7 | Job dọn dẹp retention: **hằng ngày 02:00 giờ VN** | Đủ cho retention 90/180/365 ngày |
| 8 | Consumer Kafka: **chỉ `apps/worker`** | API không chạy nền |
| 9 | **v3 — Socket.IO** cho realtime tới giao diện | Chạy trong `apps/api`; Kafka **không** đẩy trực tiếp tới trình duyệt |
| 10 | **v3 — AI local**: engine suy luận nội bộ `Qwen3-14B` | Không gọi API mô hình bên ngoài |

### 3.2. Danh mục dịch vụ bên ngoài và port tương ứng

| Dịch vụ | Port | Adapter | Module sử dụng | Bắt buộc | Ghi chú |
|---|---|---|---|---|---|
| Cloudflare R2 (S3) | `StoragePort` | `R2StorageAdapter` + `LocalStorageAdapter` | `datasets`, `issues`, `reports` | ✅ | Có fallback local khi `STORAGE_DRIVER=local` |
| MongoDB | qua repository port | `MongooseXxxRepository` | tất cả | ✅ | Replica set bắt buộc (transaction + change stream) |
| Kafka | `EventPublisherPort` | `KafkaEventPublisherAdapter` | `shared` | ✅ | Event bus + hàng đợi job (v3) |
| Redis | `RateLimiterPort` | `RedisRateLimiterAdapter` | `shared` | ✅ | Rate-limit (Phần 6 mục 3.9) |
| Redis | `SocketAdapterPort` | `RedisSocketAdapter` | `shared` | ❌ | Chỉ khi >1 instance API (Socket.IO Redis adapter) |
| **AI local** | `AiInferencePort` | `LocalInferenceAdapter` → `vLLM`/`Ollama` | `ai` | ✅ | **v3** — mô hình nội bộ `Qwen3-14B`; timeout 180s, 2 retry |
| **Embedding local** | `FeedbackVectorSearchPort` | `MongoVectorSearchAdapter` | `feedback` | ✅ | **v4** — `Qwen3-Embedding-0.6B` chạy cục bộ |
| SMTP | `EmailSenderPort` | `SmtpEmailSenderAdapter` | `auth`, `workspaces` | ✅ | OTP, lời mời, thông báo bắt buộc |
| Google OAuth | `GoogleOAuthPort` | `GoogleOAuthAdapter` | `auth` | ❌ | Tuỳ chọn — chạy được nếu không cấu hình |
| PDF | `PdfRendererPort` | `PdfKitPdfRendererAdapter` | `reports` | ✅ | PDFKit (Phần 4 mục 3.1) |
| Clock | `ClockPort` | `SystemClockAdapter` | tất cả | ✅ | Test được thời gian |
| Id generator | `IdGeneratorPort` | `UlidIdGeneratorAdapter` | tất cả | ✅ | `packages/core` (Phần 8 mục 3.2.1) |

**Quy tắc bắt buộc:**
1. Mọi dịch vụ bên ngoài đều đi qua **port** — không module nào import SDK trực tiếp.
2. `domain/` và `application/` không được import SDK nào (`@aws-sdk/client-s3`, `kafkajs`, `nodemailer`, `socket.io`, `ollama`/`vllm` client).
3. Adapter nằm ở `infrastructure/` của module sở hữu, hoặc ở `shared/infrastructure/` nếu là hạ tầng dùng chung.
4. Mỗi adapter có **fallback hoặc feature flag** để tắt khi chưa cấu hình — hệ thống phải khởi động được khi thiếu cấu hình SMTP hay khi engine AI chưa nạp xong (chỉ log cảnh báo, không crash). **v3:** thiếu `KAFKA_BROKERS` → hệ thống khởi động ở chế độ **suy giảm** (job AI và realtime không chạy, phần còn lại vẫn hoạt động).

### 3.3. Hợp đồng sự kiện nội bộ

#### 3.3.1. Envelope chuẩn

Mọi sự kiện nội bộ dùng **một** envelope thống nhất:

```typescript
export interface DomainEventEnvelope<TPayload = Record<string, unknown>> {
  readonly eventId: string;        // obx_<ULID26> — đồng nhất với outbox_event._id
  readonly eventType: string;      // dot.camelCase
  readonly eventVersion: number;   // hiện tại = 1
  readonly occurredAt: string;     // ISO 8601
  readonly aggregateType: string;  // 'workspace' | 'project' | ...
  readonly aggregateId: string;
  readonly workspaceId: string | null;
  readonly projectId: string | null;
  readonly actorId: string | null;
  readonly payload: TPayload;
}
```

**Quy tắc bắt buộc:**

| # | Quy tắc |
|---|---|
| 1 | `eventId` = `outbox_event._id` — dùng làm khoá idempotency ở consumer |
| 2 | `eventVersion` tăng khi **thay đổi hình dạng** `payload`; consumer phải chấp nhận cả version cũ |
| 3 | `payload` **không** chứa PII, không chứa giá trị ô dữ liệu, không chứa credential |
| 4 | `occurredAt` là thời điểm phát sinh sự kiện, **không** phải thời điểm publish |
| 5 | Envelope là **append-only** — không sửa sau khi ghi outbox |
| 6 | Consumer bỏ qua sự kiện có `eventType` không quan tâm — **không** log cảnh báo, không tính lỗi |

#### 3.3.2. Danh mục 13 sự kiện

| `eventType` | `aggregateType` | Phát ra bởi | Consumer | Payload |
|---|---|---|---|---|
| `project.created` | `project` | `projects` | `notifications` | `{ projectId, projectName, workspaceId, actorId }` |
| `project.deleted` | `project` | `projects` | `notifications` | `{ projectId, projectName, workspaceId, actorId }` |
| `project.memberAdded` | `project` | `projects` | `notifications` | `{ projectId, projectName, userId, role, actorId }` |
| `project.memberRoleChanged` | `project` | `projects` | `audit` | `{ projectId, userId, fromRole, toRole, actorId }` |
| `project.ownerTransferred` | `project` | `projects` | `audit` | `{ projectId, fromUserId, toUserId, actorId }` |
| `workspace.ownerTransferred` | `workspace` | `workspaces` | `audit` | `{ workspaceId, fromUserId, toUserId, actorId }` |
| `workspace.memberRoleChanged` | `workspace` | `workspaces` | `audit` | `{ workspaceId, userId, fromRole, toRole, actorId }` |
| `issue.statusChanged` | `issue_report` | `issues` | `notifications`, `audit` | `{ issueId, fromStatus, toStatus, actorId, isMandatory }` |
| `analysis.completed` | `analysis_run` | `analysis` | `notifications` | `{ runId, projectId, durationMs, actorId }` |
| `analysis.failed` | `analysis_run` | `analysis` | `notifications` | `{ runId, projectId, errorCode, actorId }` |
| `ai.jobSucceeded` | `ai_job` | `ai` | `notifications` | `{ jobId, runId, projectId, actorId }` |
| `ai.jobFailed` | `ai_job` | `ai` | `notifications` | `{ jobId, runId, projectId, errorCode, actorId }` |
| `report.ready` | `project_save` | `reports` | `notifications` | `{ reportId, projectId, actorId }` |

**Quy tắc bắt buộc:**
1. **Một event → một consumer chính**, trừ `issue.statusChanged` có 2 consumer độc lập (mỗi consumer có inbox riêng nên không xung đột).
2. Sự kiện phát ra **trong cùng transaction** với thay đổi trạng thái (Phần 8 mục 3.9.1).
3. Consumer **bỏ qua** event không thuộc danh sách quan tâm — trả về `skipped` (không phải lỗi).
4. Không có event nào mang nội dung cần bảo mật cao — sự kiện audit chỉ mang id và vai trò, **không** mang email/tên người dùng.

**Ảnh hưởng quyết định "dữ liệu bất biến" (2026-11-05):**
- **Không có event nào** cho thao tác xoá dòng, sửa ô, áp dụng quy tắc làm sạch hay rollback phiên bản — vì các thao tác này không còn tồn tại.
- **Không có consumer nào được quyền ghi vào `dataset_record`.** Đường ghi duy nhất vào `dataset_record` là Import (lô insert 5.000 lần trong transaction). Consumer chỉ được ghi vào `notification`, `audit_log`, `audit_change`, `project_save` (kết quả phân tích + Tổng kết) và các collection hạ tầng.
- Sự kiện `report.ready` phát ra khi PDF đã sinh xong — nội dung báo cáo phản ánh **kết quả phân tích trên dữ liệu gốc**, không phản ánh trạng thái dữ liệu đã sửa.

**Lưu ý về tên sự kiện — khác biệt so với Phần 4 và Phần 8:**
- Phần 4 mục 3.5 dùng `issue.status_changed`, `workspace.owner_transferred` (snake_case).
- Phần 8 mục 3.8.5 dùng `issue.statusChanged`, `workspace.ownerTransferred` (dot.camelCase).
- **Phần 9 chốt `dot.camelCase`** — khớp quy ước đặt tên sự kiện ở Phần 7 mục 3.3. Hai tài liệu trước cần cập nhật ở version tiếp theo.

### 3.4. Cơ chế Outbox — ghi, relay, publish

#### 3.4.1. Ghi outbox (trong module nghiệp vụ)

**Luồng:**

```
Use case handler
  → thực hiện thay đổi trạng thái (trong transaction)
  → gọi dispatchDomainEvents()          [Phần 5 mục 3.11]
  → ghi document outbox_event vào cùng session transaction
  → commit transaction
```

**Cấu trúc `outbox_event` (Phần 8 mục 3.8.5):**

```json
{
  "_id": "obx_01JABC...",
  "event_type": "project.created",
  "aggregate_type": "project",
  "aggregate_id": "prj_01JABC...",
  "workspace_id": "ws_01JABC...",
  "project_id": "prj_01JABC...",
  "actor_id": "usr_01JABC...",
  "payload": { "projectId": "prj_01JABC...", "projectName": "Phân tích Q4" },
  "status": "pending",
  "retry_count": 0,
  "created_at": "2026-11-05T08:00:00.000Z"
}
```

**Quy tắc bắt buộc:**
1. `dispatchDomainEvents()` **phải** được gọi trong transaction — nếu transaction rollback, event cũng rollback.
2. Ghi outbox **không** được fail thì fail cả use case. Nếu ghi outbox lỗi → rollback toàn bộ.
3. `payload` serialize bằng JSON thuần — không chứa `Date`/`ObjectId`; mọi ngày là chuỗi ISO 8601.
4. `status` khởi tạo `pending`.

#### 3.4.2. Relay — 2 kênh, publish vào Kafka (v3)

> **Quyết định 2026-11-05 (v3):** Đích nhận event của outbox chuyển từ **BullMQ/Redis** sang **Kafka**. Lý do: (1) hệ thống cần **AI job chạy nền với độ trễ thấp** và **hàng đợi bền vững**; (2) Kafka cho **lịch sử message lưu lâu** (retention) — cho phép **phát lại** sự kiện và **audit**; (3) nhiều consumer độc lập đọc cùng topic mà không cần thêm hạ tầng.

**Kênh 1 — Change Stream (chính):**

```
MongoDB ChangeStream trên collection `outbox_event`
  filter: { operationType: 'insert' }
  → với mỗi insert: handoff(event) → produce vào Kafka topic → markPublished()
```

**Kênh 2 — Polling fallback (dự phòng):**

```
Mỗi 30 giây: quét outbox_event { status: 'pending', created_at: <= now - 60s }
  → publish → markPublished()
```

**Vì sao cần cả hai:**

| Kênh | Ưu | Nhược |
|---|---|---|
| Change stream | Độ trễ ~ms, không tốn query | Cần replica set; **mất event khi restart** nếu không có resume token; resume token phức tạp |
| Polling | Đơn giản, chịu được restart, tự chữa lành | Độ trễ tới 30s; tốn query |

**Đánh đổi chấp nhận:** dùng change stream **không** có resume token → khi worker restart, các event insert trong lúc downtime có thể bị bỏ sót. Polling fallback 30 giây đóng vai trò "chữa lành" — quét `status: 'pending'` và publish những gì change stream bỏ sót. Như vậy **không mất event**, chỉ chậm tối đa 30 giây.

**Quy tắc bắt buộc:**
1. Change stream lỗi (mất kết nối replica set) → **tự reconnect** với backoff; không làm sập worker.
2. Polling fallback **luôn chạy song song**, kể cả khi change stream hoạt động bình thường — không phải chỉ chạy khi lỗi.
3. Polling chỉ quét event **cũ hơn 60 giây** — để change stream có thời gian publish trước, giảm xung đột.
4. Publish là **idempotent theo `eventId`** — Kafka dùng `key = eventId` (đảm bảo cùng key vào cùng partition, giữ thứ tự) và consumer dùng **inbox pattern** (`processed_event`) để chống xử lý trùng.
6. **v3 — Kafka producer config:** `acks = all`, `enable.idempotence = true`, `max.in.flight.requests = 5`, `retries` không giới hạn (Kafka tự retry). `key = eventId` để đảm bảo thứ tự theo aggregate.
7. **v3 — phân vùng topic:** theo **bounded context**, không theo event:
   - `domain.events` — sự kiện nghiệp vụ (13 loại ở mục 3.3), partition = 6.
   - `ai.jobs` — job AI, partition = 3.
   - `notification.dispatch` — gửi email/thông báo, partition = 3.
   - `realtime.push` — sự kiện đẩy tới WebSocket, partition = 3.
   - `dlq.dead-letter` — message chết, partition = 1, retention 30 ngày.
8. **v3 — retention:** `domain.events` 7 ngày, `ai.jobs` 3 ngày, `realtime.push` 1 ngày, `dlq.dead-letter` 30 ngày.
5. Nếu change stream khởi động lại không có resume token → đánh dấu cờ `CHANGE_STREAM_RESYNCED` trong log để quan sát được khoảng trống.

#### 3.4.3. Đánh dấu published — chiến lược at-least-once

**Quyết định.** Đánh dấu `status = 'published'` **trước** khi publish (at-least-once).

**Quy trình:**

```
1. Đọc outbox_event { status: 'pending' }
2. ĐẶT status = 'published', published_at = now     ← trước
3. Produce vào Kafka topic (key = eventId)
4. Nếu bước 3 lỗi → đặt lại status = 'pending', retry_count++, last_error
```

**Lý do đánh dấu trước:**
- Nếu đánh dấu sau, worker chết giữa bước 3–4 → event **mất vĩnh viễn** (at-most-once), không có consumer nào biết.
- Nếu đánh dấu trước, worker chết giữa bước 2–3 → event bị đánh dấu published nhưng chưa publish → **mất event**.

**Vậy tại sao at-least-once vẫn an toàn?**
- Vì có **polling fallback** quét `status: 'pending'`. Nếu đánh dấu trước rồi chết, event không còn `pending` → polling cũng không thấy. Đây là lỗ hổng thật.

**Sửa lỗi — dùng trạng thái trung gian `publishing`:**

| Trạng thái | Ý nghĩa | Ai chuyển |
|---|---|---|
| `pending` | Chưa publish | — |
| `publishing` | Đã claim, đang publish | Relay claim → `publishing` |
| `published` | Đã publish thành công | Relay sau khi publish OK |
| `failed` | Publish thất bại quá số lần | Relay |

**Quy trình đúng (at-least-once):**

```
1. Relay claim: findOneAndUpdate(
     { _id, status: 'pending' },
     { $set: { status: 'publishing', lease_expires_at: now + 60s } }
   )
   → nếu không match (đã có relay khác claim) → bỏ qua
2. Produce vào Kafka topic (key = eventId, idempotent producer)
3. ĐẶT status = 'published', published_at = now
4. Nếu bước 2 lỗi → $set { status: 'pending', retry_count++, last_error }
5. Nếu relay chết ở bước 2–3 → event kẹt ở 'publishing'
   → polling fallback quét { status: 'publishing', lease_expires_at: <= now }
   → đưa về 'pending' rồi publish lại
```

**Quy tắc bắt buộc:**
1. **Claim trước, publish sau, đánh dấu published sau cùng.** Không bao giờ đánh dấu `published` trước khi publish thành công.
2. Event kẹt ở `publishing` quá 60 giây → polling fallback đưa về `pending`.
3. `retry_count > 5` → đặt `status = 'failed'` + `last_error`, ghi log cảnh báo. Event failed **không** tự retry tiếp — cần thao tác thủ công.
4. Publish lại cùng `eventId` là **an toàn** — Kafka producer idempotent + consumer có inbox (`processed_event`) chặn xử lý trùng. Đây là lý do có thể chấp nhận at-least-once.
5. TTL index xoá event `published` sau 7 ngày (Phần 8 mục 3.8.5).

**Schema bổ sung cần cập nhật ở Phần 8 (v2):**

| Trường | Kiểu | Ghi chú |
|---|---|---|
| `status` | enum | `pending` \| `publishing` \| `published` \| `failed` — mở rộng từ 3 giá trị |
| `lease_expires_at` | Date | nullable — mốc hết hạn claim |
| `last_error` | String | đã có |
| `published_at` | Date | đã có |

#### 3.4.4. Hàng đợi Kafka — topic, consumer group, retry (v3)

> **Quyết định 2026-11-05 (v3):** Thay hàng đợi BullMQ bằng **Kafka**. Chi tiết topic ở mục 3.4.2.

**Consumer group:**

| Consumer group | Topic | Xử lý |
|---|---|---|
| `notification-worker` | `domain.events` | Tạo notification, ghi audit log |
| `ai-worker` | `ai.jobs` | Suy luận AI cục bộ, ghi kết quả |
| `report-worker` | `domain.events` | Sinh PDF, upload R2 |
| `email-worker` | `notification.dispatch` | Gửi email qua SMTP |
| `realtime-worker` | `realtime.push` | Đẩy sự kiện tới WebSocket |
| `retention-worker` | `domain.events` | Cron 02:00 VN, dọn dữ liệu quá hạn |

**Cấu hình consumer bắt buộc:**

| Tham số | Gi�� trị | Lý do |
|---|---|---|
| `groupId` | theo bảng trên | Độc lập scale từng nhóm |
| `enable.auto.commit` | `false` | **Commit thủ công sau khi xử lý xong** — không mất message |
| `auto.offset.reset` | `earliest` | Consumer mới đọc lại message cũ trong retention |
| `max.poll.interval.ms` | `300000` (5 phút) | Khớp timeout job AI (180s × 2 retry) |
| `session.timeout.ms` | `45000` | Chuẩn Kafka |
| Consumer concurrency AI | **1** | Chỉ 1 request suy luận đồng thời — tránh tranh chấp CPU/RAM |
| Consumer concurrency khác | 5 | Job nhẹ, chạy song song được |

**Xử lý lỗi và retry:**

| Tình huống | Xử lý |
|---|---|
| Message xử lý lỗi tạm thời | **Retry trong consumer** tối đa 2 lần (backoff 5s → 15s → 45s), sau đó commit offset |
| Message xử lý lỗi vĩnh viễn (4xx, schema sai) | **Không retry** → commit offset, ghi log, đẩy bản tin rút gọn vào `dlq.dead-letter` |
| Consumer crash giữa chừng | Offset **chưa commit** → Kafka giao lại message cho consumer khác → inbox chống xử lý trùng |
| Job AI hết thời gian chờ hàng đợi (>10 phút) | `ai_job.status = 'skipped'` (v3) → người dùng bấm "Thử lại AI" (UC-22) |
| Job AI timeout 180s | Retry 2 lần → hết lượt → `failed` → đẩy `dlq.dead-letter` |

**Quy tắc bắt buộc:**
1. **Commit offset sau khi xử lý thành công**, không dùng auto-commit.
2. **Consumer phải idempotent** — bảo đảm bởi inbox `processed_event` (mục 3.4.5).
3. **Message chết không được mất** → đẩy `dlq.dead-letter` (retention 30 ngày) kèm lý do.
4. Không dùng Kafka cho **dữ liệu nghiệp vụ lớn** — chỉ dùng cho **sự kiện và lệnh**.

**Đánh đổi đã chấp nhận:**

| Đánh đổi | Lý do |
|---|---|
| Kafka nặng hơn BullMQ: cần broker, KRaft config, topic/partition, monitoring | Đổi lại: lịch sử message lưu lâu (audit + phát lại), backpressure độc lập theo topic, nhiều consumer độc lập không cần thêm hạ tầng |
| Thêm độ trễ ~10–50ms khi produce | Chấp nhận được — AI job vốn đã bất đồng bộ |
| Phải quản lý consumer group, offset, rebalance | Đây là chi phí vận hành chấp nhận được để đổi lấy khả năng mở rộng |

#### 3.4.5. Inbox — chống xử lý trùng

**Quyết định.** Collection `processed_event` theo mô hình inbox.

**Schema:**

| Trường | Kiểu | Ràng buộc |
|---|---|---|
| `_id` | String | `pev_<ULID26>` |
| `consumer_name` | String | bắt buộc — VD `notifications`, `audit` |
| `event_id` | String | bắt buộc — `obx_...` |
| `event_type` | String | bắt buộc |
| `status` | String | enum `processing` \| `completed` \| `failed`, mặc định `processing` |
| `lease_id` | String | nullable — token của lần claim |
| `locked_at` | Date | nullable |
| `lease_expires_at` | Date | nullable |
| `attempts` | Int | mặc định 1 |
| `last_error_code` | String | nullable |
| `last_error_at` | Date | nullable |
| `completed_at` | Date | nullable |
| `created_at` / `updated_at` | Date | tự động |

**Index:**
| Index | Loại | Phục vụ |
|---|---|---|
| `{ consumer_name: 1, event_id: 1 }` | **unique** | Chặn xử lý trùng |
| `{ status: 1, lease_expires_at: 1 }` | compound | Quét claim kẹt (lease hết hạn) |
| `{ created_at: 1 }` | **TTL, `expireAfterSeconds: 604800`** | Xoá sau 7 ngày |

**Quy trình consume (theo mô hình lease với claim + `lease_expires_at`):**

```
1. claim(consumer_name, event_id, lease_ms):
   a. Thử insert { status: 'processing', lease_id, lease_expires_at }
      → duplicate key → đã có bản ghi, đi tiếp b
   b. Đọc bản ghi:
      - status = 'completed'  → trả 'duplicate' (bỏ qua, KHÔNG chạy side effect)
      - status = 'processing' và lease_expires_at > now → trả 'busy' (throw, để Kafka retry)
      - status = 'processing' và lease_expires_at <= now → chiếm lại (stale reclaim),
        tăng attempts, cấp lease mới
      - status = 'failed' → cho phép thử lại, tăng attempts, cấp lease mới
2. Chạy side effect (tạo thông báo / ghi audit log)
3. complete(): status = 'completed', completed_at = now
4. Nếu side effect lỗi → fail(): status = 'failed', last_error_code
   → throw để Kafka retry
```

**Quy tắc bắt buộc:**
1. **`completed` là trạng thái cuối** — không bao giờ xử lý lại event đã `completed`.
2. Lease mặc định **30 giây** — đủ cho side effect nhẹ (insert notification). Job AI/PDF **không** dùng inbox (xem mục 3.5).
3. `busy` → ném lỗi để Kafka retry với backoff, **không** coi là thất bại.
4. Stale reclaim: claim cũ hơn 30 giây được chiếm lại — chống consumer chết giữa chừng làm kẹt event vĩnh viễn.
5. `attempts > 5` với status `failed` → giữ nguyên trong DB để điều tra, không tự retry thêm.

**Vì sao cần inbox (không chỉ dựa vào idempotency logic):**
- Side effect của consumer là **ghi DB** (tạo notification, ghi audit log). Nếu không có inbox, Kafka retry sẽ tạo notification trùng.
- Idempotency "kiểu ứng dụng" (kiểm tra `notification` đã tồn tại chưa) là **race condition** khi 2 worker cùng xử lý. Inbox với unique index giải quyết ở tầng DB — chắc chắn.

#### 3.4.6. Sơ đồ tổng thể

```
┌──────────────┐   transaction   ┌───────────────┐
│  Use case    │ ───────────────► │ outbox_event  │
│  handler     │   (cùng session) │  status=pending│
└──────────────┘                  └───────┬───────┘
                                          │
                    ┌─────────────────────┼─────────────────────┐
                    │ Change Stream        │                     │ Polling 30s
                    ▼                     │                     ▼
            ┌───────────────┐              │            ┌─────────────┐
            │ relay: claim  │◄─────────────┴────────────│ relay: scan │
            │ status→publishing                          │ pending>60s │
            └───────┬───────┘                           └─────────────┘
                    │ produce (key = eventId)
                    ▼
            ┌───────────────┐
            │ Kafka         │
            │ domain.events │
            └───────┬───────┘
                    │ consumer
                    ▼
            ┌───────────────┐      ┌──────────────────┐
            │ inbox claim   │─────►│ processed_event  │
            │ (consumer,evid)│     │ unique(consumer, │
            └───────┬───────┘      │        event_id)  │
                    │ execute       └──────────────────┘
                    ▼
            ┌───────────────┐
            │ notifications │  hoặc  │ audit_log │
            │ create        │            │ + audit_change │
            └───────────────┘            └────────────┘
```

### 3.5. Worker — `apps/worker`

#### 3.5.1. Ranh giới trách nhiệm

**Quyết định.** Chỉ `apps/worker` chạy consumer Kafka. `apps/api` **không** chạy nền — **trừ** Socket.IO gateway (v3), vì gateway chỉ giữ kết nối và push, không xử lý nghiệp vụ.

| Thành phần | `apps/api` | `apps/worker` |
|---|---|---|
| HTTP controller | ✅ | ❌ |
| Xác thực, phân quyền | ✅ | ❌ |
| Use case handler | ✅ | ❌ |
| Consumer Kafka | ❌ | ✅ |
| Outbox relay | ❌ | ✅ |
| **Socket.IO gateway** | ✅ (v3) | ❌ |
| Job AI, PDF, cleanup, email | ❌ | ✅ |
| Health endpoint | ✅ | ✅ (port riêng) |

**Lý do tách riêng (khác Phần 4 v1 ban đầu):**
- Worker AI suy luận cục bộ với timeout **180 giây** — nếu chạy trong API process sẽ giữ event loop và **tranh chấp CPU/RAM** với API, ảnh hưởng latency của request đồng bộ.
- Worker có thể scale độc lập (nhiều instance khi nhiều người dùng chạy phân tích).
- `apps/api` restart không làm mất job đang chạy.

**Đánh đổi:** 2 tiến trình thay vì 1 → cần 2 Dockerfile, 2 service trong compose, 2 lần health check. Chấp nhận.

#### 3.5.2. Danh mục job

| Job | Topic Kafka | Tần suất | Timeout | Mô tả |
|---|---|---|---|---|
| `domain-events` | `domain.events` | theo event | 10s | Xử lý toàn bộ event nội bộ (notification, audit) |
| `ai-analysis` | `ai.jobs` | theo yêu cầu | **180s** (v3) | **Gọi engine AI local**, ghi kết quả AI |
| `report-pdf` | `domain.events` | theo yêu cầu | 60s | Sinh PDF Tổng kết, upload R2 |
| `email-send` | `notification.dispatch` | theo event | 30s | Gửi OTP, lời mời, thông báo bắt buộc |
| `realtime-push` | `realtime.push` | theo event | 5s | **v3** — đẩy sự kiện tới WebSocket |
| `cleanup-retention` | `domain.events` | cron 02:00 VN | 300s | Dọn dữ liệu quá hạn + file R2 |
| `outbox-relay` | *(không phải Kafka job)* | liên tục / 30s | — | Relay chạy nền trong worker |

**v3 — `ai-analysis` chạy trên topic riêng `ai.jobs`** thay vì chung `domain.events`. Lý do: (1) **backpressure độc lập** — job AI nặng (CPU 180s) không được chặn event nhẹ; (2) **consumer group riêng** cho phép scale AI worker độc lập; (3) **timeout khác nhau** (180s vs 10s) không phải chia sẻ.

**Ghi chú:** `email-send` và `report-pdf` **không** dùng inbox — chúng là job có tác vụ trực tiếp, idempotent theo cách riêng (mục 3.5.4).

#### 3.5.3. Luồng AI bất đồng bộ

**Quy trình đầy đủ (Phần 7 mục 3.10, Phần 12 mục 3.9):**

```
[API] POST /projects/{projectId}/analysis
  1. Chạy phân tích hệ thống (đồng bộ, thuần JS)
  2. Ghi analysis_run + analysis_result + cell_evidence  [transaction]
  3. Tạo ai_job { status: 'pending', input_fingerprint }
  4. Ghi outbox_event 'analysis.completed'
  5. Trả 200 với kết quả hệ thống (đồng bộ)
        + trả 202 { jobId, status, pollUrl } cho phần AI

[RELAY] publish outbox 'analysis.completed' → Kafka topic `domain.events`

[WORKER] consumer 'analysis.completed'
  → tạo job ai-analysis { jobId: ai_job._id }
  → worker AI:
      1. claim ai_job: status = 'running', started_at = now
      2. Đọc analysis_result + cell_evidence
      3. Che PII các mẫu ô  (bắt buộc — Phần 12 mục 3.10)
         - không che được → loại mẫu ô khỏi payload
      4. Truy xuất mẫu học lại top-5 từ kho mẫu (Phần 12 mục 3.16.4)
      5. Gọi engine AI local với timeout 180s (model_id + prompt_version ghi vào job)
         - lỗi tạm thời (timeout, engine quá tải, 5xx) → retry tối đa 2 lần
         - lỗi 4xx → không retry, fail ngay
         - engine chưa sẵn sàng → fail an toàn, Tổng kết vẫn có kết quả hệ thống
      6. Kiểm chứng phản hồi:
         - đúng cấu trúc schema
         - mức độ ảnh hưởng không vượt quyền backend
         - mọi tham chiếu bằng chứng phải tồn tại
         - số liệu trích dẫn phải khớp thống kê đã gửi
      7. Ghi kết quả AI vào analysis_result
      7. ai_job: status = 'succeeded', finished_at = now
      8. Ghi outbox_event 'ai.jobSucceeded'
```

**Quy tắc bắt buộc:**
1. **AI lỗi không chặn Tổng kết** (Phần 12 mục 3.9). Tổng kết hiển thị kết quả hệ thống kèm thông báo lỗi có kiểm soát.
2. `ai_job.status` là nguồn sự thật cho `GET /analysis/jobs/{jobId}` — trả **luôn 200** kể cả khi `failed` (Phần 7 mục 3.10).
3. `AI-01` (Thử lại) tạo `ai_job` mới với **cùng `input_fingerprint`** — không chạy lại phân tích hệ thống.
4. Che PII là **bắt buộc** trước mọi lời gọi ra ngoài. Nếu không che được → gửi thống kê tổng hợp thuần túy.
5. **Không** ghi log giá trị ô lỗi chưa che — chỉ ghi định danh cột, số dòng gốc, mã lỗi.
6. Kiểm chứng phản hồi AI theo đúng thứ tự 4 bước nêu trên — phát hiện không vượt kiểm chứng bị **loại khỏi kết quả hiển thị**, không phải bị ghi vào DB.

#### 3.5.4. Luồng sinh PDF

```
[API] POST /projects/{projectId}/report
  1. Kiểm tra quyền (PROJ-MEMBER+)
  2. Kiểm tra có project_save is_current
  3. Tạo report record { status: 'pending', reportId }
  4. Enqueue job report-pdf { jobId: reportId }
  5. Trả 202 { jobId, status, pollUrl }

[WORKER] job report-pdf
  1. Đọc project_save + analysis_result
  2. Sinh PDF bằng PDFKit
  3. Upload lên R2: reports/{projectId}/{reportId}.pdf
  4. Cập nhật report: status = 'ready', storage_key, size_bytes
  5. Ghi outbox_event 'report.ready'

[API] GET /projects/{projectId}/report/{reportId}/file
  → kiểm tra quyền → stream từ R2
```

**Quy tắc bắt buộc:**
1. Mỗi lần sinh PDF tạo khoá R2 **mới** — không ghi đè (Phần 8 mục 3.10).
2. `report_id` dùng làm `key` message Kafka → sinh lại cùng report không tạo job trùng.
3. PDF chứa **ngưỡng và quy tắc đã áp dụng** (Phần 12 mục 3.11) — không chỉ số liệu.
4. Nếu Tổng kết không tồn tại hoặc kết quả phân tích stale → job fail với mã `REPORT_PREREQUISITE_MISSING`.

#### 3.5.5. Luồng email

**Quyết định.** SMTP qua `EmailSenderPort`, gửi **bất đồng bộ** qua Kafka topic `notification.dispatch` để không chặn request.

**Các loại email:**

| Loại | Trigger | Bắt buộc | Nội dung |
|---|---|---|---|
| OTP quên mật khẩu | `AUTH-05` | ✅ | Mã OTP 6 số, hạn 10 phút |
| Lời mời vào workspace | `WS-07` | ✅ | Tên workspace, vai trò, link tham gia |
| Thông báo bắt buộc (báo cáo cần bổ sung) | `issue.statusChanged` → `new` | ✅ | Tiêu đề báo cáo, link |
| Cảnh báo bảo mật | `security_alert` | ✅ | Phát hiện tái sử dụng refresh token, thay đổi mật khẩu |

**Quy tắc bắt buộc:**
1. Email **không** chứa liên kết tới file dữ liệu hay PDF — chỉ liên kết tới trang web.
2. Không log nội dung email.
3. Lỗi gửi email **không** làm fail thao tác chính — log cảnh báo, retry tối đa 3 lần.
4. Email bắt buộc gửi **bất kể** công tắc `notifications_enabled` (Phần 2 mục 3.37).
5. OTP lưu dạng **hash** trong `user.password_reset_otp_hash` (Phần 8 mục 3.4.1), hạn 10 phút, tối đa 5 lần thử sai → khoá OTP.

#### 3.5.6. Job cleanup-retention

**Chạy 02:00 giờ VN hằng ngày** (cron `0 0 17 * * *` UTC).

**Nhiệm vụ (theo Phần 8 mục 3.11):**

| Bước | Hành động |
|---|---|
| 1 | Xoá cứng `user_session` hết hạn (TTL index tự làm — job chỉ verify) |
| 2 | Xoá cứng `analysis_run` / `analysis_result` / `cell_evidence` mềm xoá > 180 ngày |
| 3 | Xoá cứng `ai_job` mềm xoá > 90 ngày |
| 4 | Xoá cứng `project_save` không phải `is_current` > 180 ngày |
| 5 | Xoá cứng thực thể mềm xoá > 90 ngày (`user`, `workspace`, `project`, `dataset`, `issue_report`) — **chỉ** khi không còn tham chiếu |
| 6 | Xoá file R2 tương ứng: `raw_files/` > 90 ngày, `issue_attachments/` > 180 ngày, `reports/` > 90 ngày |

**Quy tắc bắt buộc:**
1. Job phải **idempotent** — chạy lại không gây hại.
2. Bước 5 phải kiểm tra tham chiếu trước khi xoá: `project` còn `dataset` → giữ; `dataset` còn `dataset_record` → giữ; `analysis_result` được `project_save` tham chiếu → giữ.
3. **Không bao giờ xoá bản ghi `dataset_record`** — collection này insert-only và không có soft delete. Xoá dữ liệu chỉ diễn ra ở cấp cha (`dataset` → `project` → `workspace`) theo bước 5.
4. Xoá file R2 **sau khi** xoá bản ghi DB — nếu xoá file trước mà xoá DB lỗi thì mất dữ liệu.
5. Job ghi log số lượng đã xoá theo từng loại.
6. Nếu job chạy quá 5 phút → Kafka consumer timeout, retry lần sau. Phải **an toàn khi chạy lại** (đã đảm bảo bởi idempotency).
7. Thời hạn lấy từ biến môi trường, cho phép ghi đè (Phần 8 mục 3.11).

#### 3.5.7. Phục hồi lỗi khi khởi động

**Quy tắc bắt buộc — quét trạng thái kẹt khi worker khởi động:**

| Đối tượng | Điều kiện kẹt | Hành động khôi phục |
|---|---|---|
| `outbox_event` | `status = 'publishing'` và `lease_expires_at <= now` | Đưa về `pending` để publish lại |
| `outbox_event` | `status = 'failed'` và `retry_count <= 5` | Đưa về `pending` (cho phép thử lại tự động 1 lần sau restart) |
| `processed_event` | `status = 'processing'` và `lease_expires_at <= now` | Xoá bản ghi → inbox cho phép claim lại |
| `ai_job` | `status = 'running'` quá 120 giây | Đưa về `pending`, tăng `attempt` (Phần 12 mục 3.9) |
| `ai_job` | `status = 'pending'` và message `ai.jobs` đã bị xoá khỏi retention | Produce lại |
| `analysis_run` | `status = 'running'` quá 300 giây | Đánh dấu `failed` + `error` |
| Message `ai.jobs` failed hết số lần retry | — | Ghi log cảnh báo; xử lý thủ công |

**Quy tắc:**
1. Quét chạy **một lần lúc khởi động**, không chạy định kỳ (ngoài polling fallback cho outbox).
2. Sau khi quét, `ai_job` ở trạng thái `pending` được produce lại vào Kafka topic `ai.jobs`.
3. Quét phải **an toàn khi chạy lại** — idempotent.

### 3.6. Consumer — chi tiết từng module

#### 3.6.1. Consumer `notifications`

**Nguồn:** `project.created`, `project.deleted`, `project.memberAdded`, `issue.statusChanged`, `analysis.completed`, `analysis.failed`, `ai.jobSucceeded`, `ai.jobFailed`, `report.ready`.

**Quy trình:**

```
1. inbox.claim('notifications', eventId)
2. Xác định người nhận theo event:
   - project.created       → thành viên workspace (trừ actor)
   - project.memberAdded   → user vừa được thêm
   - issue.statusChanged   → user gửi báo cáo (chỉ khi toStatus='new' hoặc 'resolved')
   - analysis.* / ai.*     → người khởi tạo phân tích (actorId)
   - report.ready          → người yêu cầu sinh PDF
3. Kiểm tra công tắc: user.notifications_enabled
   → false VÀ !event.isMandatory → bỏ qua (inbox.complete, không tạo notification)
4. Tạo document notification
5. inbox.complete()
```

**Quy tắc bắt buộc:**
1. **Không** gửi thông báo cho chính actor (trừ thông báo bắt buộc `issue_needs_info` — người gửi báo cáo cần biết).
2. Thông báo bắt buộc (`is_mandatory = true`) gửi **bất kể** công tắc.
3. Mỗi event có thể tạo **nhiều** notification (VD `project.created` cho nhiều thành viên) — inbox chặn trùng ở mức event, không phải mức notification. Vì vậy **phải** tạo notification trong 1 lần `insertMany` với `ordered: false`, và dùng unique partial trên `(user_id, source_event_id)` để chống trùng nếu event bị xử lý lại.
4. `notification.source_event_id` — trường mới cần thêm vào schema `notification` (Phần 8 mục 3.8.3), unique partial với `user_id`.

#### 3.6.2. Consumer `audit`

**Nguồn:** `issue.statusChanged`, `workspace.ownerTransferred`, `project.ownerTransferred`, `workspace.memberRoleChanged`, `project.memberRoleChanged`.

**Quy trình:**

```
1. inbox.claim('audit', eventId)
2. Ghi audit_log { actor_id, action, target_type, target_id, ... }
3. Ghi audit_change[] cho các trường đã đổi (nếu event mang diff)
4. inbox.complete()
```

**Quy tắc bắt buộc:**
1. `audit_log` ghi **append-only** — không có soft delete, chỉ TTL.
2. `audit_change.before_value` / `after_value` chỉ chứa giá trị nghiệp vụ **không nhạy cảm**.
3. Consumer `audit` **không** ghi log hành động xem danh sách (`ISSUE_LIST_VIEWED`, `USER_LIST_VIEWED`) — hai hành động đó được ghi **đồng bộ** trong use case vì chúng không phát sinh từ thay đổi trạng thái (Phần 6 mục 3.8).
4. Ghi audit là tác dụng phụ — lỗi ghi audit **không** làm fail thao tác chính.

#### 3.6.3. Consumer `email`

**Nguồn:** không dùng outbox event trực tiếp — được enqueue **trực tiếp** từ use case (vì email là hành động chủ động, không phải hệ quả của thay đổi trạng thái).

**Quy trình:**

```
1. Nhận job { type, to, subject, templateData, isMandatory }
2. Nếu !isMandatory và user.notifications_enabled = false → bỏ qua
3. Render template (Handlebars hoặc template thuần)
4. Gửi qua SMTP
5. Xoá OTP sau khi gửi thành công (nếu type = 'otp')
```

**Quy tắc bắt buộc:**
1. `to` là email đã xác thực — không gửi tới email lấy từ nội dung form nào khác.
2. Không gửi email cho tài khoản `status = 'blocked'`.
3. Lỗi SMTP tạm thời → retry 3 lần với backoff; lỗi vĩnh viễn (550, không tồn tại) → fail, không retry.
4. OTP bị tiêu tốn sau **5 lần thử sai** — khoá và yêu cầu gửi lại.
5. `key` message Kafka = `<userId>:<type>:<nonce>` — vì cùng 1 user có thể gửi OTP nhiều lần, không dùng `eventId`.

#### 3.6.4. Consumer `analysis` / `ai`

Đã mô tả ở mục 3.5.3 và 3.5.4. Không dùng inbox — idempotent theo `ai_job.status` và `report.status`.

### 3.7. Quy ước hợp đồng sự kiện

#### 3.7.1. Đặc tả sự kiện

Mỗi sự kiện có **một file** trong module sở hữu: `domain/events/<event-name>.event.ts`.

```typescript
// apps/api/src/modules/projects/domain/events/project-created.event.ts
export const PROJECT_CREATED = 'project.created';

export interface ProjectCreatedPayload {
  readonly projectId: string;
  readonly projectName: string;
  readonly workspaceId: string;
  readonly actorId: string;
}

export class ProjectCreatedEvent extends DomainEvent<ProjectCreatedPayload> {
  static readonly type = PROJECT_CREATED;
  static readonly version = 1;
}
```

**Quy tắc bắt buộc:**
1. Payload là `readonly interface` — không dùng `class` có mutable field.
2. Tên file: `<event-name>.event.ts` với `event-name` là kebab-case (`project-created.event.ts`).
3. Tên event: `dot.camelCase` — hậu tố `Created`, `Changed`, `Transferred`, `Failed`, `Succeeded`, `Ready`.
4. Mỗi event có `version` — tăng khi đổi hình dạng payload.

#### 3.7.2. Bảng ánh xạ event → consumer → tác dụng

| Event | Consumer | Tác dụng |
|---|---|---|
| `project.created` | `notifications` | Thông báo thành viên workspace |
| `project.deleted` | `notifications` | Thông báo thành viên project |
| `project.memberAdded` | `notifications` | Thông báo người được thêm |
| `project.memberRoleChanged` | `audit` | Ghi log đổi vai trò |
| `project.ownerTransferred` | `audit` | Ghi log nhượng quyền |
| `workspace.ownerTransferred` | `audit` | Ghi log nhượng quyền |
| `workspace.memberRoleChanged` | `audit` | Ghi log đổi vai trò |
| `issue.statusChanged` | `notifications` | Thông báo bắt buộc khi cần bổ sung |
| `issue.statusChanged` | `audit` | Ghi log đổi trạng thái |
| `analysis.completed` | `notifications` | Thông báo phân tích xong |
| `analysis.failed` | `notifications` | Thông báo phân tích lỗi |
| `ai.jobSucceeded` | `notifications` | Thông báo AI xong |
| `ai.jobFailed` | `notifications` | Thông báo AI lỗi |
| `report.ready` | `notifications` | Thông báo PDF sẵn sàng |

#### 3.7.3. Quy tắc tương thích

| # | Quy tắc |
|---|---|
| 1 | Consumer phải chấp nhận event `version` cũ hơn hiện tại — không throw khi version < hiện tại |
| 2 | Event `version` mới hơn mà consumer không hiểu → **bỏ qua** (log cảnh báo), không fail |
| 3 | Bỏ trường khỏi payload → tăng `version` |
| 4 | Thêm trường **tuỳ chọn** vào payload → **không** tăng version (consumer cũ bỏ qua trường lạ) |
| 5 | Đổi kiểu của trường → tăng `version` |

### 3.8. Đối chiếu với mã nguồn hiện tại

| Thành phần hiện tại | Vấn đề | Quyết định |
|---|---|---|
| `shared/application/outbox/outbox-event.schema.ts` | `aggregate_type` chỉ có `DATASET\|DATASET_VERSION\|TRANSFORMATION` — thiếu `PROJECT`, `WORKSPACE`, `ISSUE_REPORT` | Mở rộng theo bảng mục 3.3.2 |
| `outbox-event.schema.ts` | `status: PENDING\|PROCESSED\|FAILED` — không có trạng thái trung gian | Thêm `publishing` (mục 3.4.3) |
| `outbox-event.schema.ts` | Không có `event_id` tách riêng — dùng `_id` ObjectId làm khoá | `_id` = `obx_...` đã là khoá idempotency |
| `outbox-event.schema.ts` | Không có `workspace_id`, `project_id`, `actor_id` | Thêm 3 trường để consumer lọc theo phạm vi |
| `shared/application/outbox/` | Chỉ có `OutboxService` ghi event, **chưa có relay** | Viết mới `OutboxRelayService` + `OutboxChangeStreamWatcher` |
| Module `ai` hiện tại | Job table trong MongoDB + polling trong API process (Phần 12 mục 3.9) | Thay bằng **Kafka topic `ai.jobs`** + `apps/worker` |
| Module `ai` hiện tại | Không có che PII bắt buộc trước khi gọi mô hình | Bắt buộc che PII trước mọi lời gọi (mục 3.5.3) |
| Module `ai` hiện tại | Timeout/retry chưa có | **180s timeout** (v3), 2 retry, chỉ retry lỗi tạm thời |
| `shared/storage/` | Ghi file trực tiếp, không qua port; lỗi giữa chừng để sót file tạm | `StoragePort` + dọn file tạm (Phần 8 mục 3.10) |
| `shared/storage/` | Ghi đuôi `.csv` cho cả `.xlsx` | **Chỉ hỗ trợ `.csv`** — từ chối mọi định dạng khác (v3) |
| *(chưa có)* | — | `EmailSenderPort` + adapter SMTP |
| *(chưa có)* | — | `PdfRendererPort` + adapter PDFKit |
| *(chưa có)* | — | `processed_event` (inbox) |
| *(chưa có)* | — | `apps/worker` — app consumer Kafka riêng |
| *(chưa có)* | — | **v3** — `LocalInferenceAdapter` + engine suy luận nội bộ |
| *(chưa có)* | — | **v3** — Socket.IO gateway trong `apps/api` |

### 3.9. Quy tắc kiểm thử hạ tầng

| # | Kiểm tra |
|---|---|
| I1 | Mọi event được ghi vào outbox **cùng transaction** với thay đổi trạng thái — test bằng cách rollback transaction và xác nhận không còn event |
| I2 | Produce lại cùng `eventId` không tạo message trùng (Kafka idempotent producer + `key = eventId`) |
| I3 | Consumer xử lý lại event đã `completed` **không** tạo tác dụng phụ trùng |
| I4 | Worker restart giữa chừng → job không kẹt vĩnh viễn (quét phục hồi lúc khởi động) |
| I5 | Event kẹt `publishing` > 60s được polling đưa về `pending` và publish lại |
| I6 | Không payload event nào chứa PII (kiểm tra tự động trên tập payload thật) |
| I7 | Job AI vượt 180s bị đánh dấu failed, không treo worker |
| I8 | Che PII: mẫu ô không che được bị loại khỏi payload AI (không gửi giá trị thô) |
| I9 | Job cleanup chạy lại 2 lần liên tiếp cho kết quả giống nhau (idempotent) |
| I10 | Job cleanup **không** xoá bản ghi còn được tham chiếu |
| I11 | Email gửi lỗi **không** làm fail thao tác chính đã commit |
| I12 | Mọi `eventType` trong code có trong bảng mục 3.3.2 — không có event mồ côi |
| I13 | Mọi consumer group đăng ký trong Kafka có handler cho `eventType` nó quan tâm; không consumer nào đăng ký toàn bộ 13 event mà không lọc |
| I14 | Worker dừng đột ngột giữa lúc xử lý event → event được xử lý lại sau lease hết hạn, không mất |

### 3.10. Socket.IO — realtime tới giao diện (v3)

> **Quyết định 2026-11-05 (v3):** Thêm **Socket.IO** để đẩy trạng thái realtime tới giao diện. **Kafka và Socket.IO là hai tầng khác nhau, không thay thế nhau.**

#### 3.10.1. Ranh giới rõ ràng giữa Kafka và Socket.IO

| | Kafka | Socket.IO |
|---|---|---|
| **Vai trò** | Event bus **nội bộ** giữa các service/worker | Kênh **server → client** tới trình duyệt |
| **Đối tượng** | Worker, consumer group | Trình duyệt |
| **Bền vững** | Có (message lưu theo retention) | Không (mất khi client offline) |
| **Xác thực** | Không (mạng nội bộ) | **Có** (access token) |
| **Vai trò trong luồng** | Nhận sự kiện từ outbox, xử lý nghiệp vụ | Chỉ **đẩy thông báo** đã xử lý xong |

**Luồng đầy đủ:**

```
Domain → outbox_event → [Kafka: domain.events] → consumer xử lý
     → ghi DB + produce vào [Kafka: realtime.push]
     → realtime-worker đọc realtime.push
     → Socket.IO gateway → phòng `project:{projectId}` → trình duyệt
```

**Vì sao không đẩy Kafka thẳng tới trình duyệt:**
1. Kafka **không xác thực** client và không phù hợp làm kênh cho trình duyệt.
2. Kafka **giữ message** → client offline sẽ nhận message cũ không liên quan, gây rối.
3. Kafka cần giao thức phức tạp hơn WebSocket/Socket.IO.
4. Kafka **không nên expose** ra ngoài mạng nội bộ.

#### 3.10.2. Cấu hình gateway

| Thành phần | Cấu hình |
|---|---|
| Thư viện | `socket.io` (v4) |
| Vị trí chạy | `apps/api` (gateway chỉ giữ kết nối và push, **không** xử lý nghiệp vụ) |
| Xác thực | Access token trong query param `?token=...`; server xác thực **trước** khi accept |
| Mã đóng khi xác thực fail | `4401` (mã riêng của Socket.IO) |
| Path | `/api/v1/realtime` |
| Ping interval | 25 giây |
| Ping timeout | 20 giây → ngắng kết nối quá ~60s = mất kết nối |
| CORS | Chỉ origin của frontend đã cấu hình |
| Giới hạn kết nối / user | 5 kết nối đồng thời (chống rò rỉ kết nối) |
| Redis adapter | Chỉ bật khi **>1 instance API** (`REDIS_SOCKET_ADAPTER=true`) |

#### 3.10.3. Phòng và sự kiện

| Phòng | Ai ở trong | Sự kiện |
|---|---|---|
| `user:{userId}` | Người dùng đã đăng nhập | `notification.created`, `ai.quality.updated` |
| `project:{projectId}` | Thành viên có quyền xem project | `analysis.progress`, `analysis.completed`, `analysis.failed` |
| `analysis:{analysisId}` | Thành viên đang xem lần phân tích | `ai.job.status`, `finding.created` |

**Quy tắc bắt buộc:**
1. **Server là nguồn sự thật.** Client dùng sự kiện realtime **chỉ để cập nhật giao diện**. Khi cần dữ liệu chính xác → gọi lại API. Không dùng payload realtime làm dữ liệu nghiệp vụ.
2. **Không gửi dữ liệu nhạy cảm.** Không gửi giá trị ô lỗi, không gửi nội dung nhận xét người dùng, không gửi bất kỳ dữ liệu ô nào. Chỉ gửi id, trạng thái, số liệu tổng hợp.
3. **Server không giữ trạng thái.** Mọi trạng thái đọc từ MongoDB. Socket.IO chỉ là kênh truyền.
4. **Client phải reconnect** (Socket.IO tự reconnect với backoff). Khi reconnect → **gọi lại API** để đồng bộ, vì có thể đã bỏ sót sự kiện.
5. **Phòng `project:*` cần kiểm tra quyền khi join** — không chỉ dựa vào việc client gửi `projectId`.
6. Khi engine AI hoặc Kafka không sẵn sàng → **không có sự kiện realtime** cho phần đó; client phải polling dự phòng (fallback sang `pollUrl` của 202 Accepted).

#### 3.10.4. Đánh đổi

| Đánh đổi | Lý do |
|---|---|
| Thêm dependency `socket.io` + `socket.io-redis` | Đổi lại: giao diện cập nhật trạng thái tức thì, không phải polling |
| Phải quản lý vòng đời kết nối, heartbeat, reconnect | Đã có cơ chế sẵn của Socket.IO |
| Phải bảo đảm không rò rỉ kết nối khi deploy | Giới hạn 5 kết nối/user + đóng socket khi user logout |
| Socket.IO Redis adapter khi >1 instance | Chưa cần ở hiện tại (1 VPS, 1 instance API) |

## 4. Đầu vào và đầu ra

**Đầu vào**
- Phần 2 v3 — định nghĩa tính năng có tác dụng phụ (thông báo, audit), thông báo bắt buộc.
- Phần 3 v4 — 66 use case, quy tắc "tác dụng phụ không được làm hỏng thao tác chính".
- Phần 4 v1 — outbox pattern, cơ chế event, rủi ro relay, quy tắc dependency.
- Phần 5 v2 — `dispatchDomainEvents()`, `EventPublisherPort`, `StoragePort`, `AiInferencePort`, `FeedbackVectorSearchPort`.
- Phần 6 v3 — 8 hành động audit, chính sách token, rate-limit Redis.
- Phần 7 v1 — 202 Accepted, `{ jobId, status, pollUrl }`, quy ước tên sự kiện dot.camelCase.
- Phần 8 v1 — schema `outbox_event`, `ai_job`, `notification`, `audit_log`/`audit_change`, retention, layout R2.
- Phần 12 v4 — cơ chế AI local, timeout/retry, che PII, kiểm chứng phản hồi, quy tắc import CSV, nhận xét người dùng và học lại.
- Mã nguồn hiện tại — `outbox-event.schema.ts`, `outbox.service.ts`.
- Tham chiếu triển khai — `outbox-change-stream.watcher.ts`, `inbox-consumer.service.ts`, `domain-event.processor.ts`, `processed-event.schema.ts`, `event-queue.constants.ts`.

**Đầu ra**
- 8 quyết định hạ tầng nền tảng.
- Bảng 11 dịch vụ bên ngoài ↔ port ↔ adapter.
- Envelope sự kiện chuẩn + bảng 13 sự kiện với payload cụ thể.
- Cơ chế outbox đầy đủ: ghi trong transaction, 2 kênh relay (change stream + polling), chiến lược claim/lease 4 trạng thái, at-least-once an toàn.
- Cấu hình Kafka đầy đủ (topic, partition, consumer group, retry, DLQ, concurrency).
- Schema `processed_event` + quy trình inbox 4 bước (claim/lease/reclaim/complete).
- Sơ đồ tổng thể luồng event.
- Ranh giới trách nhiệm `apps/api` vs `apps/worker`.
- 7 loại job với timeout và mô tả (thêm `realtime-push`).
- **v3** — mục 3.10: Socket.IO gateway (kết nối, phòng, sự kiện, xác thực, reconnect).
- Luồng AI 8 bước, luồng PDF 5 bước, luồng email 5 bước, job cleanup 6 bước.
- Bảng 7 trường hợp kẹt và cách phục hồi khi khởi động.
- Chi tiết 4 consumer (`notifications`, `audit`, `email`, `analysis`/`ai`).
- Quy tắc hợp đồng sự kiện + bảng tương thích version.
- Đối chiếu mã nguồn hiện tại (11 điểm).
- 14 quy tắc kiểm thử hạ tầng I1–I14.

## 5. Điều kiện hoàn tất phần này

Hợp đồng tích hợp và trách nhiệm xử lý lỗi được xác nhận; không mặc định thêm broker/worker.

**Trạng thái v1:** hợp đồng sự kiện, cơ chế relay, inbox, retry, phục hồi lỗi và adapter hạ tầng đã chốt. Không thêm broker nào ngoài Redis/BullMQ — đã đánh giá và loại Kafka (đã có trong hệ thống tham chiếu nhưng quá nặng cho 13 sự kiện nội bộ).

## 6. Câu hỏi và phụ thuộc còn mở

### 6.1. Đã chốt

**Ở v3 (2026-11-05):**
- **Kafka** thay BullMQ làm event bus và hàng đợi job; 5 topic, 6 consumer group (mục 3.4.2, 3.4.4).
- **Socket.IO** cho realtime tới giao diện; chạy trong `apps/api` (mục 3.10).
- **AI local** — `AiInferencePort` → engine nội bộ `vLLM`/`Ollama`; không còn Gemini API.

**Ở v1:**

| # | Câu hổi | Kết quả |
|---|---|---|
| 1 | Cách relay đọc outbox | **Change Stream + polling fallback** (mục 3.4.2) |
| 2 | Cấu trúc hàng đợi | **Một hàng đợi** `domain-events` (mục 3.4.4) |
| 3 | Chống xử lý trùng | **Collection `processed_event`** — inbox pattern (mục 3.4.5) |
| 4 | Mức bảo đảm giao | **At-least-once**, an toàn nhờ claim/lease 4 trạng thái (mục 3.4.3) |
| 5 | Gửi email | **SMTP / Nodemailer** (mục 3.5.5) |
| 6 | Sinh PDF | **Ở worker**, trả 202 + pollUrl (mục 3.5.4) |
| 7 | Lịch cleanup | **Hằng ngày 02:00 giờ VN** (mục 3.5.6) |
| 8 | Tiến trình chạy consumer | **Chỉ `apps/worker`** (mục 3.5.1) |

### 6.2. Còn mở

| # | Câu hỏi | Ảnh hưởng | Nơi xử lý |
|---|---|---|---|
| 1 | ~~Worker `ai-analysis` chạy song song bao nhiêu instance?~~ **v3: đã chốt** — topic riêng `ai.jobs`, concurrency **1** (giới hạn tài nguyên CPU) | Đã chốt tại mục 3.4.4 |
| 2 | ~~Có cần **dead-letter queue** (DLQ) riêng?~~ **v3: đã chốt** — topic `dlq.dead-letter`, retention 30 ngày | Đã chốt tại mục 3.4.2, 3.4.4 |
| 3 | Email retry có cần backoff dài hơn (vài giờ) cho lỗi SMTP tạm thời? | Tỷ lệ gửi thành công | Phần 14 |
| 4 | Template email: dùng file Handlebars hay hằng số TS? Ảnh hưởng khả năng chỉnh sửa nội dung mà không sửa code | Bảo trì | Phần 14 |
| 5 | `processed_event` có cần phân vùng (partition) theo `consumer_name` để tránh số lượng document lớn? | Hiệu năng index | Phần 8 (v2) khi dữ liệu thực tế |
| 6 | Có cần gửi **báo cáo định kỳ** (VD bảng tin hằng tuần) không? Nếu có → thêm event + job định kỳ | Phạm vi sản phẩm | Phần 2 (v4) |

**Phụ thuộc cứng:**
- Câu hỏi 2 ảnh hưởng thiết kế monitoring ở Phần 10.
- Câu hỏi 1 ảnh hưởng cấu hình `apps/worker` trong `docker-compose` (Phần 10).
- Phần 8 cần **v2** để cập nhật: `outbox_event.status` có trạng thái `publishing` + `lease_expires_at` (mục 3.4.3), `notification.source_event_id` (mục 3.6.1), và thêm collection `processed_event` (mục 3.4.5).

### 6.3. Phụ thuộc bên ngoài

- `kafkajs` — producer/consumer Kafka, topic, consumer group, retry.
- `socket.io` (+ `socket.io-redis` khi >1 instance API) — realtime tới giao diện.
- `mongoose` 9 — repository, transaction, change stream.
- `nodemailer` — SMTP.
- `pdfkit` — sinh PDF.
- **v3 — không còn SDK API mô hình bên ngoài.** Engine suy luận nội bộ truy cập qua HTTP OpenAI-compatible (`vLLM`) hoặc HTTP native (`Ollama`) — qua `AiInferencePort`.
- `@aws-sdk/client-s3` — adapter R2.
- MongoDB **replica set** — bắt buộc cho transaction **và** change stream.
- `packages/contracts` — kiểu payload event dùng chung giữa `api` và `worker`.

## 7. Prompting log và lịch sử thay đổi

- **Xác nhận v3 / 2026-11-05:** Thay BullMQ bằng **Kafka** làm event bus và hàng đợi job — 5 topic theo bounded context, 6 consumer group, commit offset thủ công, retry 2 lần rồi `dlq.dead-letter`; topic riêng `ai.jobs` cho AI với concurrency 1 / Theo lựa chọn người dùng / Viết lại mục 3.4.2, 3.4.3, 3.4.4, 3.5.2, cập nhật 3.1, 3.2, 3.9.
- **Xác nhận v3 / 2026-11-05:** Thêm **Socket.IO** cho realtime tới giao diện, phân biệt rõ ranh giới với Kafka / Theo lựa chọn người dùng / Bổ sung mục 3.10.
- **Xác nhận v3 / 2026-11-05:** AI chạy qua **engine suy luận nội bộ** (`AiInferencePort`), timeout 60s → **180s**, ghi `model_id` + `prompt_version` vào job / Theo lựa chọn người dùng / Cập nhật mục 3.2, 3.5.2, 3.5.3, 6.3.

- **Yêu cầu:** Người dùng yêu cầu liệt kê toàn bộ các phần theo thứ tự thực hiện, tạo sẵn file v1, lần lượt hoàn thiện vòng đầu rồi tạo v2 khi có thay đổi tiếp theo.
- **v1 / 2026-11-02:** Tạo khung phần 9 / Chuẩn bị thảo luận tuần tự / Chỉ tạo tài liệu, chưa thực thi thay đổi backend hoặc dữ liệu.
- **v1 / 2026-11-05:** Hoàn thiện vòng đầu. Chốt 8 quyết định hạ tầng; thiết kế envelope sự kiện + 13 sự kiện; cơ chế outbox đầy đủ (2 kênh relay, chiến lược claim/lease 4 trạng thái giải quyết lỗ hổng at-least-once); cấu hình BullMQ; inbox pattern `processed_event`; 6 loại job; luồng AI/PDF/email/cleanup; 7 trường hợp phục hồi lỗi khi khởi động; 4 consumer chi tiết; quy tắc tương thích version; đối chiếu mã nguồn hiện tại (11 điểm) và tham chiếu hệ thống tham chiếu; 14 quy tắc kiểm thử I1–I14. Ghi nhận 3 điểm cần cập nhật ở Phần 8 (v2).
