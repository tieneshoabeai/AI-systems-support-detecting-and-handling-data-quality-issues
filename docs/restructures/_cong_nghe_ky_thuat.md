---
title: "Báo cáo kỹ thuật và công nghệ"
version: v5
date: 2026-11-07
status: "Đã chốt — chờ triển khai mã nguồn"
---


## 1. Mục tiêu và phạm vi

Báo cáo này trình bày toàn bộ quyết định về **kỹ thuật và công nghệ** của Data Quality Platform: stack ngôn ngữ và framework, hạ tầng dữ liệu, cơ chế tích hợp AI, kiến trúc vận hành, bảo mật, hiệu năng và công cụ kiểm thử.

Phạm vi bao gồm toàn bộ các quyết định đã chốt ở 14 phần thiết kế. Mỗi quyết định công nghệ đều kèm lý do lựa chọn và đánh giá trade-off, để có thể truy vết ngược về tài liệu gốc.

Nguyên tắc áp dụng xuyên suốt:

1. Mọi công nghệ chọn dùng đều dựa trên nhu cầu cụ thể của bài toán chất lượng dữ liệu, không sao chép một stack công nghệ có sẵn.
2. Ưu tiên công nghệ đơn giản, ít thành phần vận hành, dễ kiểm thử và dễ phục hồi.
3. Mọi dịch vụ bên ngoài đều được che sau port — không module nghiệp vụ nào import SDK trực tiếp.
4. Hệ thống phải khởi động được khi thiếu cấu hình của dịch vụ bên ngoài (chỉ log cảnh báo, không crash).
5. **v2 — Dữ liệu không rời hệ thống.** AI chạy **cục bộ** (không API bên ngoài); dữ liệu người dùng không được gửi ra Internet.
6. **v2 — Chỉ `.csv`.** Hệ thống chỉ tiêu thụ file `.csv`; không có sheet, không có thư viện Excel.
7. **v2 — Phân trang bằng cursor.** Không dùng `offset`/`total` — giảm tải truy vấn và giữ ổn định khi dữ liệu thay đổi.
8. **v2 — Sự kiện & realtime.** Kafka làm event bus + hàng đợi nền (có DLQ); Socket.IO đẩy thông báo và tiến độ tới client.
9. **v2 — Người dùng đóng góp cho AI.** Mỗi kết quả có khối đánh giá; phản hồi được lưu append-only và dùng để học lại qua RAG few-shot động.

---

## 2. Tổng quan stack công nghệ

### 2.1. Bảng tổng hợp

| Lớp | Công nghệ đã chốt | Phiên bản | Vai trò trong hệ thống |
|---|---|---|---|
| Ngôn ngữ | TypeScript | 6.x | Toàn bộ backend và worker |
| Trình biên dịch tăng tốc | TypeScript Native | 7.x | Tăng tốc biên dịch; `tsc -v` đạt 7.0.2 |
| Runtime | Node.js | 22 LTS | Môi trường thực thi |
| Quản lý gói | pnpm | 11.x | Monorepo workspaces |
| Framework web | NestJS | 11.x | HTTP layer, DI, module composition |
| ORM / ODM | Mongoose | 9.x | Adapter persistence |
| Cơ sở dữ liệu chính | MongoDB Atlas | M0 (dev) / M10 (prod) | Lưu trữ dữ liệu nghiệp vụ, replica set |
| Bus sự kiện | **Kafka** (KRaft single-node) | 3.7 | 5 topic, 6 consumer group, DLQ — thay BullMQ |
| Realtime | **Socket.IO** + adapter Redis | 4.x | Đẩy thông báo/tiến độ tới client |
| Hàng đợi phụ | Redis 7 | 7 | Cache, Socket.IO adapter, rate-limit |
| Lưu trữ đối tượng | Cloudflare R2 | — | Tệp gốc, PDF, tệp đính kèm |
| Validation | Zod | 3.x | DTO runtime validation, sinh OpenAPI |
| Phân quyền | CASL | 7.x | Ability-based authorization |
| Xác thực | Passport + JWT | — | Access token, refresh token, Google OAuth |
| Sinh PDF | PDFKit | — | Tạo báo cáo PDF |
| Gửi email | Nodemailer (SMTP) | — | OTP, lời mời, thông báo |
| AI — suy luận | **vLLM** (prod) / **Ollama** (dev) | — | Engine nội bộ, OpenAI-compatible `:8000` |
| AI — model | **5 ứng viên benchmark:** Qwen3-14B · Gemma-3-12B · Qwen3-8B · Llama-3.1-8B · Vistral-7B (Q4_K_M / QAT Q4) | — | Model cục bộ, CPU-only; **model chốt do benchmark quyết định** (9 chỉ số, đường Pareto) |
| AI — embedding | **Qwen3-Embedding-0.6B** | — | Vector cho kho học lại (RAG T1) |
| Parse CSV | fast-csv, busboy | — | Đọc CSV, stream upload — **không dùng Excel** |
| Băm mật khẩu | bcrypt | 5.x | Lưu trữ mật khẩu |
| Bảo mật HTTP | Helmet | 8.x | Header bảo mật chuẩn |
| Rate-limit | @nestjs/throttler + Redis | 6.x | Chống lạm dụng API |
| Test | Jest + ts-jest | 30.x | Unit, integration, E2E |
| Test E2E | Supertest | 7.x | Gọi HTTP thật |
| Test hiệu năng | k6 | — | Smoke và stress test |
| Test hợp đồng | zod-to-json-schema | 3.x | Sinh openapi.json |
| Observability | Log JSON + health endpoint | — | Tối giản, không Prometheus |
| Triển khai | Docker Compose trên VPS | Ubuntu 22.04 | api + worker + Redis |
| Truy cập Internet | Cloudflare Tunnel + Nginx | — | Không mở port trực tiếp |

### 2.2. Nguyên tắc phân bổ công nghệ

| Nguyên tắc | Giải thích |
|---|---|
| **v2 — Kafka thay BullMQ** | Đảo ngược quyết định của v1: cần **replay**, **DLQ**, **nhiều consumer group**, và hàng đợi bền vững trên disk. Kafka KRaft single-node đủ cho 1 VPS, không cần ZooKeeper |
| **v2 — Có dead-letter queue** | Topic `dlq.dead-letter` — Kafka đã có hạ tầng bền vững nên DLQ gần như miễn phí; mất sự kiện là vi phạm tính đúng đắn dữ liệu |
| **v2 — Socket.IO cho realtime** | Client cần biết khi phân tích xong / có nhận xét mới; polling làm tốn tài nguyên trên VPS |
| **v2 — AI chỉ chạy nội bộ** | **Cấm** SDK AI bên ngoài (`@google/generative-ai`, `openai`, `anthropic`). Dữ liệu không rời hệ thống; chỉ engine trong container mới được gọi |
| **v2 — Chỉ `.csv`** | Bỏ Excel: giảm phụ thuộc, bỏ khái niệm sheet, 1 file = 1 bảng |
| **v2 — Cursor pagination** | Bỏ `offset`/`total`: truy vấn ổn định khi dữ liệu thay đổi, không cần `countDocuments` |
| Không thêm framework CQRS | 66 use case chưa cần lớp trừu tượng thêm; tách `commands/` và `queries/` bằng cấu trúc thư mục là đủ |
| Không dùng EventEmitter2 cho sự kiện nghiệp vụ | Phát đồng bộ trong process, không bền vững |
| Không dùng Prometheus/Grafana/Sentry | Observability tối giản: log JSON có cấu trúc + health endpoint |
| Không dùng Prometheus-style metrics endpoint | Chỉ có health/readiness endpoint |

---

## 3. Ngôn ngữ, công cụ build và quản lý mã nguồn

### 3.1. TypeScript và trình biên dịch

Hệ thống dùng **hai alias npm** cho TypeScript, tách bạch trình biên dịch chuẩn và trình biên dịch native:

```json
{
  "devDependencies": {
    "typescript": "npm:@typescript/typescript6@^6.0.2",
    "@typescript/native": "npm:typescript@^7.0.2"
  }
}
```

- `typescript` (alias 6.x) là trình biên dịch chuẩn, dùng cho `tsc --noEmit` (type-check) và `nest build`.
- `@typescript/native` (alias 7.x) là trình biên dịch native, dùng để tăng tốc vòng lặp phát triển.

**Quyết định bắt buộc:** dùng alias, không cài `typescript` 7.x trực tiếp. Lý do — NestJS decorator metadata, `ts-jest` và nguyên tắc **Zero Any Policy** đều cần hành vi decorator metadata ổn định; trình biên dịch native không bảo đảm điều đó. Trình biên dịch native dùng để kiểm tra nhanh, còn bản phát hành dùng trình biên dịch chuẩn.

### 3.2. Rủi ro Breaking Change của TypeScript 7

| Rủi ro | Mức độ | Biện pháp |
|---|---|---|
| Decorator metadata thay đổi | Cao | Không dùng native compiler cho bản phát hành; type-check bằng 6.x |
| `ts-jest` không tương thích | Trung bình | Giữ `ts-jest` và `jest` ở phiên bản đã khoá; không nâng cấp cùng lúc với TypeScript |
| Thay đổi hành vi `useDefineForClassFields` | Trung bình | Kiểm tra lại khi nâng cấp; có bộ test hồi quy 93 quy tắc |
| Bỏ hỗ trợ target cũ | Thấp | Target đặt theo runtime Node 22 |

### 3.3. pnpm workspaces

Monorepo dùng **pnpm workspaces** — chọn thay vì npm workspaces và yarn vì:

- Cài đặt nhanh và tiết kiệm disk nhờ content-addressable store.
- Bảo đảm mỗi package có `node_modules` riêng, chặn "phantom dependency" — rất quan trọng cho quy tắc R7–R9 về độ thuần khiết của package.
- `pnpm-lock.yaml` xác định phiên bản chính xác cho toàn bộ workspace.

### 3.4. Cấu trúc monorepo

```
apps/
├── api/                      # NestJS — HTTP, composition root
│   └── src/modules/<module>/ # 21 module nghiệp vụ
└── worker/                   # Kafka consumer (nhiều consumer group), không HTTP công khai
packages/
├── core/                     # Kiểu nền tảng dùng chung (thuần TS)
├── contracts/                # DTO Zod + nguồn sinh openapi.json
└── config/                   # Parser biến môi trường bằng Zod
```

**Ràng buộc bắt buộc giữa các package:**

- `packages/contracts` không import `@nestjs/*`, `mongoose`, `kafkajs`.
- `packages/core` không import `packages/contracts` và ngược lại.
- Import giữa package chỉ qua `index.ts`.
- `packages/config` parse biến môi trường bằng Zod — biến sai kiểu làm hệ thống **fail sớm lúc khởi động** chứ không lỗi rối giữa chừng.

---

## 4. Framework ứng dụng và kiến trúc lớp

### 4.1. NestJS — lựa chọn và ranh giới sử dụng

NestJS được chọn làm framework vì đã có sẵn hệ sinh thái cần thiết (DI, module composition, guard, interceptor, exception filter) và giảm thời gian triển khai so với framework tối giản.

Tuy nhiên, ranh giới sử dụng được giới hạn chặt để tránh "khung NestJS ăn vào domain":

| Tầng | Có dùng NestJS không | Quy tắc |
|---|---|---|
| `domain/` | **Không** | Không import `@nestjs/*`, không import `mongoose` |
| `application/` | **Không** | Không import decorator HTTP; chỉ dùng interface do domain/application định nghĩa |
| `infrastructure/` | Có | Nơi duy nhất chạm NestJS và Mongoose |

### 4.2. Ports and Adapters trong từng module

Mỗi module có 3 tầng với quy tắc chiều dependency bắt buộc:

```
domain        ──✗──▶  application, infrastructure, @nestjs/*, mongoose
application   ──✗──▶  infrastructure, @nestjs/*, mongoose
infrastructure ──✓──▶  domain, application, @nestjs/*, mongoose
```

**Hệ quả kiểm thử:** toàn bộ thư mục `domain/` của 21 module test được bằng unit test thuần Node, không cần MongoDB, không cần NestJS testing module. Đây là tiêu chí nghiệm thu của quy tắc R12.

### 4.3. Dependency Injection

| Ký hiệu | Cơ chế | Lý do |
|---|---|---|
| DI token | `export const X_PORT = Symbol('X')` | Tránh xung đột tên, không cần sinh code |
| Binding | `{ provide: X_PORT, useExisting: XRepository }` | Interface token → hiện thực cụ thể |
| Composition root | `<module>.module.ts` | Điểm nối port ↔ adapter duy nhất của module |

Không dùng class token cho interface — interface của TypeScript không tồn tại ở runtime, nên bắt buộc phải có token.

### 4.4. 21 module nghiệp vụ

| Nhóm | Module |
|---|---|
| Identity | `users`, `auth`, `audit` |
| Workspace & Project | `workspaces`, `projects` |
| Dataset | `datasets`, `data-view` |
| Analysis | `analysis`, `ai` |
| Hợp đồng & tổng kết | `summary` |
| Giao tiếp | `notifications`, `issues` |
| Hạ tầng dùng chung | `shared`, `reports` |
| Phản hồi & học lại | `feedback` |

**5 module bị gỡ hoàn toàn (2026-11-05)** do quyết định *dữ liệu bất biến*: `versions`, `cell-edit`, `clean-rules`, `lineage`, `exports` — gỡ khỏi code, xoá collection liên quan, không thêm tính năng thay thế.

**Hệ quả kiến trúc:** hệ thống là **read-only đối với dữ liệu bảng**. `dataset_record` chỉ được INSERT lúc Import; không tồn tại đường ghi nào khác. Vì vậy không cần cơ chế version/diff/rollback cho dữ liệu, và không cần đồ thị lineage.

---

## 5. Cơ sở dữ liệu và lưu trữ

### 5.1. MongoDB

| Quyết định | Chi tiết |
|---|---|
| Bản dev | MongoDB Atlas **M0** (miễn phí) |
| Bản production | MongoDB Atlas **M10** |
| Bắt buộc | **Replica set** — cần cho transaction và change stream |
| Xử lý M0 | M0 không có replica set → có đường fallback về job table polling |
| Kết nối | IP allowlist giới hạn theo IP của VPS; không expose port ra Internet |

**Lý do chọn MongoDB:** hệ thống xử lý bảng dữ liệu người dùng với schema biến đổi theo từng tệp CSV — mô hình document vừa khớp. Ngoài ra, transaction nhiều document và change stream là hai tính năng **bắt buộc** cho cơ chế outbox đã chốt.

**Đánh đổi:** không có ràng buộc quan hệ mạnh như SQL. Bù lại, toàn bộ tính toàn vẹn được kiểm soát ở tầng ứng dụng qua invariant của domain và ràng buộc rõ ràng trong schema.

### 5.2. Bộ sưu tập dữ liệu

21 collection, phân 5 nhóm:

| Nhóm | Collection | Loại | Xoá |
|---|---|---|---|
| Identity | `user`, `user_session`, `audit_log`, `audit_change` | Thực thể / Log | soft / TTL |
| Workspace & Project | `workspace`, `workspace_member`, `project`, `project_member` | Thực thể | soft |
| Dataset | `dataset` | Thực thể | soft |
| Dataset (dữ liệu thô) | `dataset_record` | **Thực thể — insert-only, KHÔNG soft delete** | không xoá |
| Analysis & AI | `analysis_run`, `analysis_result`, `cell_evidence`, `ai_job` | Thực thể | soft |
| Hợp đồng & tổng kết | `project_save` | Thực thể | soft |
| Giao tiếp | `notification`, `issue_report` | Log / Thực thể | TTL / soft |
| Phản hồi & học lại | `finding_feedback`, `feedback_example` | Log, append-only | TTL / giữ lâu |
| Hạ tầng | `outbox_event`, `processed_event` | Log, append-only | TTL |

Module `shared` sở hữu 2 collection hạ tầng: `outbox_event` (ghi trong transaction, relay publish) và `processed_event` (inbox chống xử lý trùng).

**Bất biến dữ liệu (2026-11-05):** `dataset_record` là collection **insert-only** — đường ghi duy nhất là Import (lô 5.000 bản ghi). Không `updateOne`/`deleteMany`/`findOneAndUpdate`, không soft-delete. Giá trị thiếu hoặc không hợp lệ chỉ bị loại khỏi **phép tính thống kê cụ thể**, không bị xoá khỏi dataset. Xoá dữ liệu chỉ diễn ra ở cấp cha: `dataset` → `project` → `workspace`.

### 5.3. Quy ước schema

| Quy ước | Nội dung |
|---|---|
| Định danh | Tiền tố theo loại + 26 ký tự ULID: `ws_`, `prj_`, `ds_`, `sh_`, `run_`, `job_` |
| Đặt tên field | `snake_case` trong MongoDB, `camelCase` ở API — mapper chuyển đổi |
| Field chuẩn | `created_at`, `updated_at`, `created_by`, `updated_by` trên mọi collection |
| Xoá mềm | `is_deleted` + `deleted_at` + `deleted_by` cho thực thể nghiệp vụ |
| Optimistic locking | Trường `version` tăng mỗi lần ghi |
| Index | Bắt buộc theo truy vấn: workspace/project, record theo dataset, analysis theo run, TTL theo collection log, **cursor: hợp lệ theo (sort_key, _id)** |

### 5.4. Transaction và consistency

| Nguyên tắc | Chi tiết |
|---|---|
| Transaction chỉ trong repository adapter | Application không mở transaction trực tiếp |
| Ghi outbox trong cùng transaction | Không có trạng thái trung gian mất dữ liệu |
| Ngoại lệ: import dataset | Import lưu theo lô để tránh transaction quá dài; tiến trình có thể dừng giữa chừng mà không mất dữ liệu |
| Ghi hàng loạt | Xoá dòng, reset dataset, rollback — ghi theo lô, không giữ transaction mở |
| Đọc | Mặc định không dùng transaction; chỉ dùng khi cần nhất quán đọc |

### 5.5. Cloudflare R2 — lưu trữ đối tượng

| Quyết định | Lý do |
|---|---|
| Dùng R2 thay vì S3 | Egress $0 — rẻ hơn đáng kể; API tương thích S3 nên giữ nguyên cấu hình `S3_*` |
| Bucket **không public** | Mọi lần tải đi qua API có kiểm tra quyền |
| Fallback local | Adapter `LocalStorageAdapter` khi `STORAGE_DRIVER=local` — chạy được khi chưa cấu hình R2 |
| Nội dung lưu | Tệp gốc đã upload, PDF sinh ra, tệp đính kèm báo cáo sự cố |

### 5.6. Retention

| Loại dữ liệu | Thời gian giữ |
|---|---|
| Audit log | 365 ngày |
| Phiên đăng nhập | 90 ngày (TTL index) |
| Thông báo | 180 ngày |
| Outbox / processed event | TTL index, dọn dẹp hằng ngày 02:00 giờ VN |
| Bản lưu project và dataset version | Giữ theo vòng đời project, xoá mềm |

### 5.7. Chỉ hỗ trợ tệp CSV

| Quyết định | Chi tiết |
|---|---|
| Định dạng được chấp nhận | **`.csv` duy nhất** — kiểm tra theo phần mở rộng (không theo MIME type, vì trình duyệt gửi MIME không chuẩn) |
| Mã hoá | UTF-8 (có hỗ trợ BOM); CSV `;` phân cách được phát hiện tự động |
| Dòng tiêu đề | Bắt buộc dòng đầu là header; tên cột được chuẩn hoá (lowercase, bỏ khoảng trắng, thay ký tự lạ bằng `_`) |
| Dung lượng tối đa | 500 MB / workspace; 1.000.000 dòng / tệp |
| Parse | `fast-csv` theo luồng (streaming) — không nạp toàn bộ tệp vào RAM |
| Upload | `busboy` multipart, ghi thẳng tới R2 qua luồng |
| Bị loại bỏ | `.xlsx`, `.xls`, `.ods` — không còn thư viện đọc Excel trong monorepo |
| Khái niệm bị gỡ | `dataset_sheet` — **1 tệp = 1 bảng dữ liệu**, không có sheet, không có sheet-switching |

**Lý do bỏ Excel:** (1) giảm bề mặt tấn công và phụ thuộc — thư viện đọc Excel là nguồn CVE lịch sử; (2) đơn giản hoá mô hình dữ liệu — mỗi tệp là một bảng, không cần bảng điều khiển sheet; (3) phù hợp với nghiệp vụ kiểm tra chất lượng dữ liệu, nơi CSV là định dạng phổ biến nhất.

**Hành vi khi người dùng tải lên tệp không phải CSV:** HTTP 415 `UNSUPPORTED_FILE_FORMAT`, kèm thông báo nêu rõ chỉ hỗ trợ `.csv`. Tệp bị từ chối **trước khi** ghi vào R2.

---

## 6. Tích hợp bên ngoài và hàng đợi

### 6.1. Danh mục dịch vụ ngoài và port

| Dịch vụ | Port | Adapter | Bắt buộc | Ghi chú |
|---|---|---|---|---|
| Cloudflare R2 | `StoragePort` | `R2StorageAdapter` + `LocalStorageAdapter` | ✅ | Có fallback local |
| MongoDB | qua repository port | `MongooseXxxRepository` | ✅ | Bắt buộc replica set |
| Kafka | `EventBusPort` | `KafkaEventBusAdapter` | ✅ | KRaft single-node, 5 topic, DLQ |
| Redis (cache + rate-limit) | `CachePort` / `RateLimiterPort` | `RedisCacheAdapter`, `RedisRateLimiterAdapter` | ✅ | Cache, rate-limit, Socket.IO adapter |
| AI suy luận cục bộ | `AiAnalyzerPort` | `LocalInferenceAiAnalyzerAdapter` | ✅ | vLLM `:8000` / Ollama `:11434` |
| AI embedding cục bộ | `EmbeddingPort` | `LocalEmbeddingAdapter` | ✅ | Qwen3-Embedding-0.6B |
| Realtime | `RealtimePublisherPort` | `SocketIoRealtimeAdapter` | ✅ | Redis adapter, phòng theo user/project/analysis |
| SMTP | `EmailSenderPort` | `SmtpEmailSenderAdapter` | ✅ | OTP, lời mời, thông báo |
| Google OAuth | `GoogleOAuthPort` | `GoogleOAuthAdapter` | ❌ | Tuỳ chọn — chạy được nếu không cấu hình |
| PDF | `PdfRendererPort` | `PdfKitPdfRendererAdapter` | ✅ | PDFKit |
| Clock | `ClockPort` | `SystemClockAdapter` | ✅ | Test được thời gian |
| Id generator | `IdGeneratorPort` | `UlidIdGeneratorAdapter` | ✅ | `packages/core` |

**Quy tắc bắt buộc:**

1. Mọi dịch vụ bên ngoài đều đi qua port — không module nào import SDK trực tiếp.
2. `domain/` và `application/` không được import `@aws-sdk/client-s3`, `kafkajs`, `nodemailer`, `socket.io`, **và tuyệt đối không import SDK AI bên ngoài** (`@google/generative-ai`, `openai`, `anthropic`).
3. Adapter nằm ở `infrastructure/` của module sở hữu, hoặc ở `shared/infrastructure/` nếu là hạ tầng dùng chung.
4. Mỗi adapter có fallback hoặc feature flag — hệ thống khởi động được khi thiếu `SMTP_HOST` hay khi `ai-engine` chưa sẵn sàng (chỉ log cảnh báo, không crash).
5. **Không adapter nào trỏ tới dịch vụ AI bên ngoài.** Engine suy luận chỉ được gọi qua mạng nội bộ Docker (`ai-engine:8000`).

### 6.2. Cơ chế outbox / inbox

| Thành phần | Cơ chế |
|---|---|
| Ghi outbox | Entity gom domain event → handler ghi vào `outbox_event` **trong cùng transaction** với thay đổi nghiệp vụ |
| Relay | 2 kênh: **Change Stream** (chính) + **polling fallback** quét event mồ côi |
| Bus sự kiện | **Kafka** — topic `domain.events`; consumer theo `eventType` |
| Hàng đợi nền | **Kafka** — topic `ai.jobs`, `notification.dispatch`, `realtime.push` |
| Dead-letter | Topic `dlq.dead-letter` — message vượt ngưỡng retry bị chuyển sang đây |
| Chống xử lý trùng | Collection `processed_event` (inbox pattern), khoá unique `(consumer_name, event_id)` |
| Bảo đảm giao | **at-least-once** → consumer phải idempotent |
| Claim/lease | 4 trạng thái, xử lý lỗ hổng at-least-once |

### 6.3. Topic Kafka và consumer group

| Topic | Nội dung | Consumer group |
|---|---|---|
| `domain.events` | Sự kiện nghiệp vụ (outbox relay, kết quả phân tích) | `domain-event-consumer` |
| `ai.jobs` | Job phân tích AI, tóm tắt, embedding | `ai-consumer` |
| `notification.dispatch` | Gửi email / thông báo nội bộ | `notification-consumer` |
| `realtime.push` | Đẩy sự kiện realtime tới client qua Socket.IO | `realtime-publisher` |
| `dlq.dead-letter` | Message chết — giữ để điều tra và phát lại | `dlq-monitor` |

**Consumer là idempotent**: mỗi consumer ghi `processed_event` với khoá unique `(consumer_name, event_id)` trước khi xử lý. Cấu hình consumer giới hạn `maxBytes`, `sessionTimeout` ngắn, commit thủ công theo batch.

**Xử lý lỗi**: lỗi tạm thời → retry backoff luỹ thừa (tối đa 3 lần) → hết hạn retry → `dlq.dead-letter`. Lỗi vĩnh viễn (payload hỏng) → thẳng DLQ.

### 6.4. Realtime bằng Socket.IO

| Hạng mục | Quyết định |
|---|---|
| Thư viện | **Socket.IO 4.x** (WebSocket, tự fallback sang polling) |
| Gắn vào | Cùng HTTP server NestJS, tại path `/api/v1/realtime` |
| Xác thực | Handshake query `?token=<accessToken>` — xác thực trước khi vào phòng |
| Multi-instance | Redis adapter — sự kiện publish từ worker tới đúng instance đang giữ socket |
| Phòng (room) | `user:{userId}`, `project:{projectId}`, `analysis:{analysisId}` |

**Luồng sự kiện end-to-end:**

```
Domain event → outbox_event → relay → Kafka (domain.events / realtime.push)
                                            ↓
                            realtime-publisher consumer
                                            ↓
                              Socket.IO emit tới room
                                            ↓
                                    Client cập nhật UI
```

**Nhóm sự kiện:**

| Sự kiện | Phòng | Ý nghĩa |
|---|---|---|
| `analysis.progress` | `analysis:{id}` | Tiến độ phân tích (phần trăm, giai đoạn) |
| `analysis.completed` | `project:{id}` | Phân tích xong, có kết quả mới |
| `finding.created` | `project:{id}` | Có finding mới — client tải chi tiết |
| `feedback.received` | `user:{id}` | Nhận xét của người khác trên finding chung |
| `import.progress` | `project:{id}` | Tiến độ nạp tệp CSV |
| `job.failed` | `user:{id}` | Job AI thất bại (sau khi hết retry, trước khi vào DLQ) |

**Quy tắc bắt buộc:**

1. Client **luôn** nhận dữ liệu qua REST; Socket.IO chỉ là kênh báo "có gì mới" → client tự gọi API. Không đẩy payload lớn qua socket.
2. Client bắt buộc có fallback polling (mỗi 30 giây) khi socket không kết nối được.
3. Mọi sự kiện đều có `eventId` để client khử trùng.
4. Server **không** tin cậy dữ liệu do client gửi qua socket; mọi thao tác ghi đi qua REST kèm kiểm tra quyền.
5. Khi mất kết nối, client tự kết nối lại với backoff (1s → 30s).

### 6.5. Phân trang bằng cursor (keyset)

| Quyết định | Chi tiết |
|---|---|
| Kiểu | **Keyset / cursor** — thay cho `offset`/`page` |
| Cursor | Chuỗi **base64url** mã hoá JSON: `{ "k": [giá trị sort cuối], "i": "_id cuối", "v": phiên bản }` |
| Ký | HMAC-SHA256 bằng `JWT_SECRET` → chống giả mạo/tam nhằng cursor |
| Trả về | `{ items: [...], nextCursor: string \| null, hasMore: boolean }` |
| Sort mặc định | `created_at DESC, _id DESC` (bất biến, luôn có tiebreaker) |
| `limit` | 1–100, mặc định 15 |
| Không còn | `total`, `countDocuments`, `skip` |

**Vì sao bỏ offset:**

| Vấn đề của offset | Cursor giải quyết |
|---|---|
| Trang sâu phải quét N document — độ trễ tăng tuyến tính | Truy vấn luôn lấy `limit` document đầu sau vị trí khóa |
| Dữ liệu thay đổi giữa 2 lần gọi → trùng hoặc sót bản ghi | Vị trí khóa cố định → không trùng, không sót |
| `countDocuments` tốn CPU trên collection lớn | Không cần đếm tổng |

**Quy tắc bắt buộc:**

1. Mọi endpoint danh sách phải có index hợp lệ theo `(sort_key, _id)` — không có index thì cursor chậm hơn offset.
2. Cursor **bất biến** theo bộ lọc: đổi bộ lọc giữa 2 lần gọi → trả 400 `INVALID_CURSOR`.
3. Cursor chứa phiên bản (`v`) để invalidate khi thuật toán sắp xếp thay đổi.
4. Tất cả repository adapter có sẵn 2 phương thức: `findPage(filter, cursor, limit)` và `count(filter)` — `count` chỉ dùng khi thật sự cần, không dùng cho mặc định.

---

## 7. Công nghệ AI

### 7.1. AI cục bộ (v5 bổ sung triển khai corr-v1 đã kiểm chứng 2026-11-07: `simple-statistics@8.0.0` Pearson/Spearman + `ml-matrix@6.15.1` nghịch đảo ma trận cho VIF; mỗi ô ma trận kèm `totalScanned/missingAOnly/missingBOnly/missingBoth`; VIF kèm `commonNRate/lossWarning` 20%/50%; cột `date` loại với lý do riêng `date_column_excluded_from_correlation_vif`; worker `AiWorkerService` + `claimPendingJob` nguyên tử + `LocalInferenceAdapter` vLLM/Ollama, timeout 180s, retry 2, dung sai grounding 0.01 — xem Phần 12 v7 mục 3.6, Phần 2 v8 mục 3.23, Phần 7 v5 §3.13b, Phần 8 v5 §3.7.2) — engine và mô hình

> **Quyết định v2 (đảo ngược v1):** cấm hoàn toàn AI API bên ngoài. Mọi suy luận diễn ra trong container `ai-engine` của hệ thống.

| Hạng mục | Quyết định |
|---|---|
| Engine production | **vLLM** (chế độ CPU) — HTTP tương thích OpenAI tại `http://ai-engine:8000` |
| Engine dev/local | **Ollama** tại `http://localhost:11434` — cùng API tương thích |
| Engine dự phòng | `llama.cpp` server — khi vLLM/Ollama không khởi động được |
| Tầng sâu (model lớn) | **Do benchmark quyết định** trong 5 ứng viên — tiêu chí F1 + điểm giải thích cao nhất đạt ngưỡng p95 ≤ 180 s và RSS ≤ 11 GB |
| Tầng nhanh (model nhỏ) | **Do benchmark quyết định** — tiêu chí p95 thấp nhất đạt ngưỡng JSON ≥ 98 % và ảo giác ≤ 2 % |
| Model embedding | **Qwen3-Embedding-0.6B** (~1.2 GB RSS) — sinh vector kho học lại |
| Chiến lược routing | **Định tuyến theo loại tác vụ** (không theo tải): gợi ý nhãn / phân loại / JSON ngắn → tầng nhanh; giải thích / gợi ý xử lý / nhận xét → tầng sâu. Fallback: sâu → nhanh → **suy giảm có kiểm soát** (rule-based, cờ `ai_unavailable`) |
| Timeout | 180 giây (CPU chậm hơn API rất nhiều) |
| Retry | 2 lần, backoff luỹ thừa |
| Đồng thời | **1** job AI cùng lúc (giới hạn RAM) |
| RAM guard | Dừng nhận job AI mới khi RSS engine > 85% RAM host |

**Vì sao Qwen3 là hạt giống (chưa phải kết luận)?** Tiếng Việt là điểm yếu của hầu hết model mã nguồn mở cỡ nhỏ; dòng Qwen3 có điểm đánh giá tiếng Việt tốt trong nhóm 8B–14B, hỗ trợ **context 32k–128k** và có chế độ **thinking** bật/tắt. Đây là **giả thuyết ban đầu** — benchmark 5 model ở §7.1.1 mới là thứ chốt.

**Chấm điểm (LLM-as-judge).** `Qwen3-32B` **vượt RAM 15 GB** → bỏ. Thay bằng **chấm chéo** giữa model 8–14B **khác họ** với model đang được chấm, để tránh self-preference bias (model tự chấm mình thường cao hơn 0,3–0,6 điểm).

### 7.1.1. Năm ứng viên benchmark và chín chỉ số

Mỗi model đại diện **một giả thuyết khác nhau** về cái gì quyết định chất lượng — để kết quả benchmark kiểm chứng được một kết luận, không chỉ xếp hạng.

| Mã | Model | Params / Quant | RSS ước tính | Giả thuyết được kiểm chứng |
|---|---|---|---|---|
| M1 | **Qwen3-14B** | 14.8B / Q4_K_M | ~10 GB | Quy mô + đa ngữ thắng |
| M2 | **Gemma-3-12B-IT** | 12B / QAT Q4 | ~8 GB | Lượng tử QAT bù được phần thiếu tham số |
| M3 | **Qwen3-8B** | 8.2B / Q4_K_M | ~6 GB | Một nửa tham số có đủ cho tác vụ có cấu trúc? |
| M4 | **Llama-3.1-8B-Instruct** | 8B / Q4_K_M | ~5.5 GB | Baseline hệ sinh thái lớn |
| M5 | **Vistral-7B-Chat** | 7B / Q4_K_M | ~5 GB | Chuyên biệt tiếng Việt thắng quy mô? |

*Embedding: `Qwen3-Embedding-0.6B` (~1,2 GB) — độc lập với lựa chọn model sinh, sinh vector kho học lại.*

**Loại trước benchmark:** `Qwen3-30B-A3B` (18 GB > RAM) · `DeepSeek-R1-Distill-Qwen-14B` (p95 vượt 180 s) · `Phi-4-mini` / `PhoGPT-4B` (quá nhỏ cho giải thích tiếng Việt).

**Chín chỉ số (5 nhóm, trọng số 100):**

| # | Nhóm | Chỉ số | Ngưỡng | Trọng số |
|---|---|---|---|---|
| 1 | Chất lượng | F1 phát hiện (micro) | ≥ 0,75 | 30 |
| 2 | Chất lượng | F1 macro theo DQ-01→05 | ≥ 0,70 | 10 |
| 3 | Tuân thủ | Tỉ lệ JSON hợp lệ | ≥ 98 % | 12 |
| 4 | Tuân thủ | Tỉ lệ ảo giác (grounding) | ≤ 2 % | 10 |
| 5 | Ngôn ngữ | Chất lượng giải thích tiếng Việt (chấm chéo 1–5) | ≥ 4,0 | 13 |
| 6 | Hiệu năng | p95 latency / 1 job | ≤ 180 s | 10 |
| 7 | Hiệu năng | Throughput | ≥ 4 tok/s | 5 |
| 8 | Tài nguyên | RSS đỉnh | ≤ 11 GB | 5 |
| 9 | Vận hành | Độ ổn định (% job lỗi/retry) | ≤ 2 % | 5 |

**Quy tắc chốt:** rớt bất kỳ ngưỡng → loại; chênh F1 < 0,03 → không coi là khác biệt; kiểm định **McNemar** (cặp đúng/sai) + **Wilcoxon** (điểm judge), chỉ tuyên bố thắng khi **ΔF1 ≥ 0,03 và p < 0,05**; chọn theo **đường Pareto** (p95 × F1, kích thước = RSS). Benchmark chạy **trên đúng VPS production (CPU-only)**, 200 mẫu, 3 lần/model.

### 7.1.2. Quy trình chọn model tối ưu (bắt buộc thực hiện)

1. **Thu thập tập vàng** — **200 mẫu** (chấp nhận 150–300) phát hiện lỗi thật, lấy chủ yếu từ **nhận xét người dùng** (`finding_feedback`), phủ đủ 5 nhóm DQ × 3 mức ảnh hưởng, có cả `false_positive` và `missed_issue`. **Chống rò rỉ đáp án:** mẫu không nằm trong kho few-shot `feedback_example`.
2. **Chạy cả 5 model** trên cùng prompt, cùng tham số (`temperature=0.2`, `top_p=0.9`, `seed` cố định, `max_tokens` cố định) — **trên đúng VPS production CPU-only**, không chạy trên máy có GPU. Mỗi model chạy **3 lần**, bỏ lượt warm-up.
3. **Chấm 9 chỉ số** ở bảng §7.1.1 — chuẩn hoá min–max rồi nhân trọng số; model rớt bất kỳ ngưỡng tuyệt đối nào bị loại ngay.
4. **Kiểm định thống kê:** McNemar cho cặp đúng/sai phát hiện, Wilcoxon signed-rank cho điểm judge. Chỉ tuyên bố thắng khi **ΔF1 ≥ 0,03 và p < 0,05**.
5. **Vẽ đường Pareto** (p95 latency × F1, kích thước = RSS) — chọn điểm Pareto tốt nhất, không chọn điểm chất lượng tuyệt đối cao nhất. Khi hoà: giấy phép → headroom RAM → latency → tái dùng họ model.
6. **Chốt cặp model** cho **kiến trúc định tuyến hai tầng** (tầng nhanh: gợi ý nhãn/phân loại/JSON ngắn; tầng sâu: giải thích/gợi ý/nhận xét) — ghi vào `AI_PRIMARY_MODEL` / `AI_FALLBACK_MODEL`.
7. **Ghi lại kết quả** vào `docs/benchmarks/benchmark-<model>-<ngày>.md` kèm model, phiên bản, checksum, quant, tham số, điểm 9 chỉ số, giá trị p, đường Pareto.
8. **Chạy lại bắt buộc** mỗi khi đổi model / quant / prompt template / engine suy luận / cập nhật kho few-shot — và mỗi quý để chống hồi quy chất lượng.

### 7.2. Ranh giới dữ liệu — không rời hệ thống

**Không có dữ liệu nào ra khỏi host.** Mô hình chạy trong container cùng Docker network, không có route ra Internet.

| Được truyền vào mô hình | Bị chặn |
|---|---|
| Thống kê tổng hợp có cấu trúc | Tệp gốc (toàn bộ nội dung CSV) |
| Tối đa **20 ô lỗi/cột đã che PII** | Toàn bộ tập bản ghi |
| Mô tả lỗi đã lọc | Ảnh chụp màn hình lỗi |
| — | Bất kỳ request nào tới miền bên ngoài |

Chi tiết định danh luôn được che trước khi đưa vào prompt. Ngoài ra, `ai-engine` được cấu hình **không có egress** (không NAT outbound) trong `docker-compose`.

### 7.3. Phân tách trách nhiệm backend ↔ AI

| Phần | Ai quyết định |
|---|---|
| Phát hiện lỗi theo tiêu chí DQ-01 → DQ-04 | **Backend** — thuật toán tất định, tái lập được, kiểm thử được |
| DQ-05 (v4 mới) | **Backend có điều kiện** — mặc định `unassessed`; `assessed` khi có quy tắc được xác nhận (checklist 5 điểm, kiểm tra theo dòng) |
| Ma trận tương quan + VIF (v4 mới) | **Backend tính, AI diễn giải** — backend dựng ma trận/VIF; AI chỉ nhận xét trên số đã có, cấm suy quy tắc/kết luận nhân quả |
| Mức độ ảnh hưởng | **Backend** — theo quy tắc tái lập được (Thấp / Trung bình / Cao / Chưa đủ cơ sở) |
| Phát hiện bổ sung, giải thích, nhận xét, đề xuất | **AI** — dựa trên thống kê backend cung cấp |
| Sửa dữ liệu | **Không ai tự động** — AI không tự sửa dữ liệu |

**Lý do không để AI quyết định toàn bộ mức ảnh hưởng:** quy tắc backend giúp kết quả nhất quán và kiểm thử được, nhưng có thể bỏ sót ý nghĩa nghiệp vụ. Đây là đánh đổi được chấp nhận có chủ đích.

### 7.4. Học lại từ phản hồi người dùng (Human-in-the-Loop, RAG T1)

#### 7.4.1. Cấu trúc phản hồi trên mỗi kết quả

Mỗi **finding** (kết quả phát hiện) đi kèm một khối đánh giá cho người dùng nhận xét:

| Trường | Kiểu | Bắt buộc | Ý nghĩa |
|---|---|---|---|
| `verdict` | enum | ✅ | `correct` / `incorrect` / `partially_correct` / `not_applicable` |
| `confidence` | int 1–5 | ✅ | Người dùng tự đánh giá mức tin cậy của phát hiện |
| `issueCategory` | enum | ❌ | Phân loại lại lỗi: `false_positive`, `missed_case`, `wrong_severity`, `wrong_evidence`, `other` |
| `comment` | string ≤ 2000 | ❌ | Nhận xét tự do |
| `correctedExplanation` | string ≤ 2000 | ❌ | Giải thích đúng thay thế — **nguồn vàng quan trọng nhất** |
| `evidenceRefs` | string[] | ❌ | Ô/dòng đúng mà AI đã chỉ ra sai |
| `rating` | int 1–5 | ❌ | Điểm chất lượng giải thích, tách khỏi `verdict` |
| `responseTimeMs` | int | ✅ | Thời gian người dùng suy nghĩ — tín hiệu độ khó của finding |

Bộ phản hồi có **3 mức** (tăng dần chi phí cho người dùng):

1. **Nhanh (1 chạm)** — 4 nút: Đúng / Sai / Một phần / Không áp dụng. Chi phí thấp nhất, thu thập nhiều nhất.
2. **Có chú thích** — thêm `issueCategory` + `comment`. Dành cho finding mà AI tự tin nhưng người dùng thấy sai.
3. **Sửa bằng chứng** — cho phép chỉ định đúng dòng/cột đáng lẽ phải bị báo. Tạo mẫu few-shot giá trị cao nhất.

Người dùng **không bắt buộc** phản hồi — hệ thống hoạt động bình thường nếu không có phản hồi nào. Tỉ lệ phản hồi là chỉ số chất lượng, không phải ràng buộc.

#### 7.4.2. Lưu trữ phản hồi

| Collection | Vai trò | Chính sách ghi |
|---|---|---|
| `finding_feedback` | Nhận xét gốc của người dùng | **append-only**, không sửa, không xoá (trừ khi người dùng tự yêu cầu xoá) |
| `feedback_example` | Kho mẫu few-shot đã khử định danh | append-only, có `source_feedback_id` trỏ về gốc |

**Bất biến:** `finding_feedback` là bằng chứng chất lượng — không được `update` hay `delete` để tránh "nghịch lý thuộc độc" và giữ được audit trail.

**Khử định danh khi tạo mẫu:** thay mọi chuỗi giống email, số điện thoại, mã định danh, tên riêng bằng placeholder `[EMAIL]`, `[PHONE]`, `[NAME]`. Chỉ mẫu đã khử mới được nhúng vào vector store.

#### 7.4.3. Vòng lặp học lại (T1 — dynamic few-shot injection)

```
Người dùng phản hồi
      ↓ ghi append-only
finding_feedback
      ↓ định kỳ (ngày) + lọc điều kiện
feedback_example  ──embed (Qwen3-Embedding-0.6B)──▶  vector store
      ↓
Khi AI phân tích: truy vấn top-5 mẫu tương tự theo cosine similarity
      ↓
Prompt = instruction + thống kê + **5 mẫu few-shot động**
      ↓
Qwen3-14B / 8B sinh kết quả
```

- Vector lưu trong MongoDB (`feedback_example.embedding`, index `cosine`), tránh thêm hạ tầng vector DB riêng.
- Mẫu chỉ vào kho khi: `verdict = incorrect` **hoặc** `correctedExplanation` khác rỗng, và đã khử định danh.
- Chống tự khuếch đại: giới hạn 1 mẫu cho mỗi `finding_signature` (hash loại lỗi + cột + kiểu dữ liệu) trong cửa sổ 30 ngày; ưu tiên mẫu có `confidence` cao và được nhiều người xác nhận.
- Prompt có **budget cứng**: tối đa 5 mẫu, tổng ≤ 4.000 token, để không làm vượt context và giảm tốc độ CPU.
- Hiệu quả đo bằng **A/B nội bộ**: so sánh F1 có/không few-shot trên tập vàng trước khi triển khai rộng.

#### 7.4.4. Đo lường hiệu quả học lại

| Chỉ số | Cách đo | Mục tiêu |
|---|---|---|
| Tỉ lệ phản hồi | `finding_feedback` / tổng finding hiển thị | ≥ 25% |
| Tỉ lệ đúng | `verdict = correct` / tổng phản hồi | ≥ 80% |
| Tỉ lệ "AI sai" | `verdict = incorrect` | Theo dõi xu hướng giảm |
| Lợi ích few-shot | ΔF1 trên tập vàng, có vs không | > 0 |
| Độ trễ tăng thêm | p95 sau khi bật few-shot | ≤ +15% |

### 7.4b. DQ-05 có điều kiện + AI đánh giá tương quan/VIF (v4 mới — theo Phần 2 v7, Phần 12 v6)

- DQ-05 mặc định `unassessed` (`no_rule_confirmed`); kích hoạt khi có ≥01 quy tắc được xác nhận (rule_id, biểu thức kiểm tra, mức ảnh hưởng, người + thời điểm xác nhận, phiên bản). Tương quan cao/VIF cao không tự sinh quy tắc.
- Backend tạo **ma trận tương quan** (Pearson/Spearman, Cramér's V, η² kèm `n`) và **bảng VIF** (`VIF>5` tham khảo, `>10` cao). AI diễn giải: cặp đáng chú ý, cột VIF cao, giới hạn, bước tiếp theo — kiểm chứng trích dẫn số, loại câu bịa số.

### 7.5. Xử lý khi AI lỗi

| Tình huống | Hành vi |
|---|---|
| AI lỗi hoặc timeout | Tổng kết vẫn được tạo từ kết quả hệ thống, **không có** giải thích/đề xuất AI; job đẩy sang DLQ sau 3 lần retry |
| RAM quá tải | RAM guard chặn job AI mới, job chờ trong Kafka; hệ thống không suy sụp |
| Đầu vào không đổi | Cho phép thử lại riêng phần AI (UC-22) |
| Phản hồi hợp lệ một phần | Giữ nhận xét hợp lệ, loại phần không đạt, báo phần chưa đầy đủ tại Tổng kết |
| Phản hồi hỏng toàn bộ | Chỉ dùng kết quả hệ thống |

---

## 8. Bảo mật

### 8.1. Xác thực

| Cơ chế | Chi tiết |
|---|---|
| Access token | JWT Bearer trong header `Authorization` |
| Refresh token | Làm mới qua `POST /auth/refresh` — endpoint công khai, trả cặp token mới |
| Google OAuth | Tuỳ chọn — hệ thống chạy được nếu không cấu hình |
| Mật khẩu | bcrypt, 5.x |
| OTP quên mật khẩu | Mã ngẫu nhiên có hạn, dùng một lần |
| Phân biệt lỗi | `TOKEN_INVALID` (sai/đã dùng/bị thu hồi) vs `TOKEN_EXPIRED` (hết hạn) — frontend biết chính xác hành động cần làm |

### 8.2. Phân quyền

| Thành phần | Công nghệ | Ghi chú |
|---|---|---|
| Ability engine | CASL 7.x | Ability-based, khai báo quyền theo action + subject |
| Guard | NestJS guard | Kiểm tra ability trước khi vào handler |
| Policy pattern | Policy class theo module | Tách quy tắc phức tạp ra khỏi guard |
| Audit | Module `audit` | Ghi log thay đổi quyền và thao tác nhạy cảm |

Mô hình 5 vai trò: `WS-OWNER`, `WS-MEMBER`, `PROJ-OWNER`, `PROJ-MEMBER`, `PROJ-VIEWER`, cộng `SYS-ADMIN` tách biệt ở tầng hệ thống.

### 8.3. Bảo vệ dữ liệu nhạy cảm

| Biện pháp | Chi tiết |
|---|---|
| Che PII trước khi đưa vào prompt | Tối đa 20 ô đã che |
| `ai-engine` không có egress ra Internet | Dữ liệu không rời host |
| Lỗi 500 không lộ chi tiết | Không stack trace, không tên collection, không giá trị nghiệp vụ |
| Lỗi `DEPENDENCY_UNAVAILABLE` | Nêu dịch vụ nào lỗi, không nêu host/credential |
| Lỗi xác thực trung tính | Không tiết lộ email có tồn tại hay không |
| Audit log | Ghi lại thao tác trên dữ liệu và thay đổi quyền |
| Rate-limit | Redis-backed, áp dụng trên endpoint nhạy cảm |

### 8.4. Bảo mật vận hành

| Biện pháp | Chi tiết |
|---|---|
| Không expose MongoDB/Redis ra Internet | Chỉ trong mạng nội bộ Docker |
| Cloudflare Tunnel | Không cần mở port trên VPS |
| Nginx/Caddy | Cổng vào duy nhất từ Internet; TLS termination |
| Worker không có port HTTP công khai | Chỉ port health check nội bộ |
| `ai-engine` chỉ lắng nghe trong mạng nội bộ | Không publish port ra host |
| Kafka chỉ nghe nội bộ | Không expose broker ra Internet |
| IP allowlist MongoDB Atlas | Giới hạn theo IP của VPS |
| R2 bucket không public | Mọi lần tải qua API có kiểm tra quyền |
| Secret trong `.env` | File gitignored, không commit |

---

## 9. Kiến trúc vận hành

### 9.1. Sơ đồ triển khai

```
┌────────────────────────────────────────────────────────────────────┐
│                    VPS (1 máy, Ubuntu 22.04, 16 vCPU / 15 GB)       │
│                                                                     │
│  ┌──────────────────────┐      ┌────────────────────────────────┐   │
│  │  Cloudflare Tunnel   │      │        Docker Compose          │   │
│  │  (tunnel → origin)   │─────►│                                │   │
│  └──────────────────────┘      │  ┌────────┐ ┌──────────┐      │   │
│                                │  │  api   │ │  worker  │      │   │
│  ┌──────────────────┐          │  │ :3000  │ │ (no HTTP)│      │   │
│  │  Nginx/Caddy     │◄─────────┤  │  + WS  │ └────┬─────┘      │   │
│  │  (TLS + static)  │  TLS    │  └────┬───┘      │            │   │
│  └──────────────────┘          │       │          │            │   │
│                                │       └────┬─────┘            │   │
│                                │            │                  │   │
│                                │  ┌─────────┼──────────┬──────────────┐
│                                │  │  Kafka  │  Redis 7 │  ai-engine  │   │
│                                │  │ KRaft  │ cache +  │  vLLM :8000  │   │
│                                │  │ :9092  │ rate +   │  Qwen3-14B   │   │
│                                │  │ 5 topic│ SocketIO │  Qwen3-8B    │   │
│                                │  │  + DLQ │  adapter │  Embed-0.6B  │   │
│                                │  └────────┴──────────┴──────────────┘   │
│                                └──────────────────┬────────────────────┘
└──────────────────────────────────────────────────┼─────────────────────┘
                                                   │
                    ┌──────────────────────────────┼──────────────────────────┐
            ┌───────▼────────┐      ┌─────────────▼───────────┐   ┌────────▼────────┐
            │ MongoDB Atlas  │      │    Cloudflare R2        │   │  SMTP           │
            │ M0 (dev)       │      │    file gốc, PDF,        │   │                │
            │ M10 (prod)     │      │    tệp đính kèm          │   └─────────────────┘
            └────────────────┘      └─────────────────────────┘

    ❌ KHÔNG có mũi tên ra Internet cho dữ liệu người dùng.
       ai-engine không có egress; không có SDK AI bên ngoài nào được cài.
```

### 9.2. Các quyết định vận hành

| # | Quyết định | Ghi chú |
|---|---|---|
| 1 | Nền tảng triển khai: **Docker Compose trên VPS** | 1 file compose cho api + worker + Redis |
| 2 | Observability **tối giản** — log JSON + health endpoint | Không Prometheus/Grafana/Loki/Sentry |
| 3 | Định dạng log: **JSON structured** ra stdout | Máy đọc được, thu thập tập trung dễ |
| 4 | Database: **Atlas M0 cho dev**, **M10 cho production** | M0 không có replica set → cần fallback |
| 5 | Quota dung lượng **theo workspace** (500 MB) | Khớp thiết kế xử lý dữ liệu |
| 6 | **Có** dead-letter queue trên Kafka | Topic `dlq.dead-letter` — giữ để điều tra, phát lại |
| 7 | Secret: file `.env` (gitignored) | Chuẩn, đơn giản |
| 8 | Redis: **một instance** cho cache + rate-limit + Socket.IO adapter | Đủ cho quy mô hiện tại |
| 8b | Kafka: **KRaft single-node**, không ZooKeeper | 1 broker, không cần ZooKeeper; đủ cho 1 VPS |
| 8c | `ai-engine` giới hạn bộ nhớ `mem_limit` | Dừng OOM làm sập cả VPS |
| 8d | RAM guard dừng job AI khi RSS > 85% RAM host | Ưu tiên giữ API sống hơn giữ AI chạy |
| 9 | R2 giữ nguyên cấu hình `S3_*` | Egress $0 — rẻ hơn S3 |

### 9.3. Biến môi trường

Nhóm biến chính — tất cả parse bằng Zod trong `packages/config`:

| Nhóm | Ví dụ biến |
|---|---|
| Server | `PORT`, `NODE_ENV`, `CORS_ORIGIN` |
| Database | `MONGODB_URI`, `MONGODB_DB_NAME` |
| Storage | `STORAGE_DRIVER`, `S3_ENDPOINT`, `S3_BUCKET`, `S3_ACCESS_KEY_ID` |
| Redis | `REDIS_URL` |
| Kafka | `KAFKA_BROKERS`, `KAFKA_CLIENT_ID`, `KAFKA_CONSUMER_GROUP` |
| Realtime | `REALTIME_PATH`, `REALTIME_CORS_ORIGIN` |
| AI (cục bộ) | `AI_ENGINE_DRIVER` (`vllm`\|`ollama`\|`llamacpp`), `AI_BASE_URL`, `AI_PRIMARY_MODEL`, `AI_FALLBACK_MODEL`, `AI_EMBEDDING_MODEL`, `AI_TIMEOUT_MS`, `AI_MAX_CONCURRENCY` |
| AI (hạn ngạch) | `AI_MAX_ERROR_CELLS`, `AI_MAX_CONTEXT_TOKENS`, `AI_RAM_GUARD_RATIO` |
| Feedback | `FEEDBACK_FEWSHOT_TOP_K`, `FEEDBACK_FEWSHOT_TOKEN_BUDGET` |
| Email | `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` |
| Auth | `JWT_SECRET`, `JWT_REFRESH_SECRET`, `JWT_EXPIRES_IN`, `GOOGLE_CLIENT_ID` |
| Feature flag | `FEATURE_FLAG_COLLECTION`, `LEGACY_ROUTER_ENABLED` |
| Tunnel | `CLOUDFLARE_TUNNEL_ENABLED`, `SSL_ENABLED`, `SSL_PORT` |

Quy tắc: biến sai kiểu làm **fail sớm lúc khởi động**, không lỗi rối giữa chừng.

### 9.4. Health check

| Endpoint | Ý nghĩa |
|---|---|
| `/health` | Tiến trình còn sống |
| `/health/ready` | Sẵn sàng nhận traffic — đã kết nối MongoDB, Redis, Kafka |
| `/health/ai` | Trạng thái `ai-engine`: model đang nạp, RSS hiện tại, RAM guard có kích hoạt không |

### 9.5. Sao lưu và khôi phục

| Đối tượng | Cơ chế |
|---|---|
| MongoDB Atlas | Snapshot tự động theo lịch + `mongodump` định kỳ ra R2 |
| R2 | Versioning bật; bucket không public |
| `.env` | Sao lưu riêng, mã hoá, lưu ngoài VPS |
| Kiểm thử khôi phục | Định kỳ — quy trình khôi phục phải được thử, không chỉ tài liệu hoá |

---

## 10. Hiệu năng và giới hạn

### 10.1. Ngưỡng kỹ thuật đã chốt

| Hạng mục | Ngưỡng |
|---|---|
| Timeout AI | 180 giây, retry 2 lần |
| Số ô lỗi đưa vào prompt | Tối đa 20 ô/cột |
| Đồng thời AI | 1 job |
| RAM guard | Dừng job AI mới khi RSS engine > 85% RAM host |
| Quota dung lượng | 500 MB mỗi workspace |
| Rate-limit | Redis-backed, theo endpoint |
| Phân trang | **cursor-based**: `limit` 1–100, mặc định 15; trả `nextCursor` + `hasMore` |
| Few-shot budget | ≤ 5 mẫu, ≤ 4.000 token |
| Job dọn dẹp | Hằng ngày 02:00 giờ VN |

### 10.2. Chiến lược hiệu năng

| Kỹ thuật | Áp dụng ở |
|---|---|
| Index MongoDB theo truy vấn | Mọi truy vấn danh sách và lọc |
| Projection chỉ lấy trường cần | Tránh kéo cả document lớn |
| Phân trang cursor (keyset) | Ổn định khi dữ liệu thay đổi, không cần `countDocuments` |
| Index hợp lệ theo sort key | `(created_at, _id)` / `(row_index, _id)` — bắt buộc cho cursor |
| Streaming upload/download | Không nạp toàn bộ tệp vào bộ nhớ |
| Job table thay vì xử lý đồng bộ | Tác vụ dài trả 202 ngay |
| Cache Redis | Rate-limit counter, trạng thái feature flag |

---

## 11. Công cụ kiểm thử

| Công cụ | Vai trò |
|---|---|
| Jest + ts-jest | Unit test, integration test |
| Supertest | E2E — gọi HTTP thật |
| k6 | Smoke và stress test, chạy thủ công trước release |
| zod-to-json-schema | Sinh `openapi.json` từ `packages/contracts` |
| Docker Compose test | MongoDB replica set 1 node + Redis + MinIO |
| Script checker kiến trúc | Kiểm tra 12 quy tắc dependency R1–R12 |
| Script security check | 34 tình huống truy cập trái phép |

**Quy tắc:** test AI **luôn mock** — không bao giờ gọi engine thật trong test (nhanh, ổn định). Bộ **benchmark** (§7.1.2) là nơi duy nhất được gọi engine thật, chạy thủ công theo lịch, không nằm trong CI.

Ngoài ra cần thêm:

| Công cụ | Vai trò |
|---|---|
| `k6` (bổ sung) | Load test endpoint phân trang cursor và đẩy event Kafka |
| Test container Kafka | KRaft 1 node cho integration test |
| Test container vLLM/Ollama | Chỉ chạy trong môi trường benchmark, không chạy trong CI mặc định |

### 11.1. Ngưỡng coverage theo tầng

| Tầng | Ngưỡng |
|---|---|
| Domain | ≥ 90% |
| Application | ≥ 80% |
| Infrastructure | ≥ 60% |
| Contracts | ≥ 95% |
| **Tổng** | **≥ 70%** |

---

## 12. Chiến lược chuyển đổi công nghệ

### 12.1. Hybrid — chuyển đổi theo lô module

Chiến lược **không Big Bang**. Hệ thống mới và hệ thống cũ cùng chạy, định tuyến bằng cờ tính năng theo workspace:

```
legacy  ──▶  canary (10% workspace)  ──▶  new
```

- Bộ định tuyến chạy **trong tiến trình** (in-process), đọc collection `feature_flag`.
- Chuyển đổi 3 trạng thái, quay lại `legacy` mất vài giây, không cần triển khai lại.
- Chuyển đổi theo **lô module** (7 lô) thay vì một cửa sổ dừng hệ thống duy nhất.
- Các thay đổi hạ tầng lớn (BullMQ → Kafka, Gemini → AI cục bộ) cũng được **chuyển đổi theo cờ tính năng**: `LEGACY_AI_PROVIDER_ENABLED`, `LEGACY_QUEUE_ENABLED` — cho phép rollback nhanh.

### 12.2. Công cụ chuyển đổi dữ liệu

8 script `ts-node`, 3 chế độ:

| Chế độ | Tác dụng |
|---|---|
| `--dry-run` | Mặc định — chỉ báo cáo kế hoạch, không ghi |
| `--apply` | Thực thi chuyển đổi |
| `--verify` | Đối chiếu dữ liệu sau chuyển đổi |

---

## 13. Tổng hợp công nghệ và hướng phát triển

### 13.1. Nguyên tắc công nghệ đã áp dụng

| Nguyên tắc | Thể hiện |
|---|---|
| Đơn giản trước mạnh mẽ | Modular monolith thay vì microservices; Kafka single-node thay vì cụm broker |
| Cô lập bằng port | 13 port cho toàn bộ dịch vụ ngoài; không import SDK ở domain/application |
| Cấu hình an toàn | Zod validate lúc khởi động; thiếu credential chỉ log cảnh báo |
| Kiểm thử được | Domain test thuần Node; AI luôn mock; E2E trên container thật |
| Không sao chép stack | Mỗi công nghệ đều có lý do lựa chọn riêng ghi trong báo cáo này |
| Dữ liệu là của người dùng | AI chạy cục bộ; không gửi bất kỳ nội dung nào ra Internet |
| Quyết định dựa trên đo | Chọn model bằng benchmark thật trên CPU, không chọn cảm tính |

### 13.2. Cơ hội cải tiến đã nhận diện

| Hạng mục | Trạng thái hiện tại | Hướng cải tiến |
|---|---|---|
| Observability | Log JSON + health endpoint | Chỉ nâng cấp khi có nhu cầu vận hành thực tế |
| Database | Atlas M0/M10 | Nâng cấp tier khi tải tăng; cân nhắc read replica |
| Hàng đợi | Kafka 5 topic | Tách broker khi tải vượt 1 node; cân bằng lại partition theo độ trễ consumer |
| Worker | Tách riêng `apps/worker` | Đã tách sẵn, sẵn sàng scale ngang |
| Frontend | Chưa có trong phạm vi | `packages/contracts` đã là hợp đồng dùng chung |
| Trình biên dịch | Alias TS 6.x + native 7.x | Chuyển sang native cho build khi bộ test ổn định |
| AI | Qwen3-14B + 8B + Embedding-0.6B | Nâng cấp lên Qwen3-Next hoặc model 32B khi RAM tăng; thêm quantization IQ3 |
| Học lại | RAG T1 few-shot động | Thêm LoRA fine-tune khi đủ tập vàng (≥ 5.000 mẫu) |

### 13.3. Công nghệ chưa áp dụng — và lý do

| Công nghệ | Lý do không dùng |
|---|---|
| ~~Kafka~~ | **Đã áp dụng ở v2** — dùng cho event bus, hàng đợi nền, DLQ |
| CQRS framework | Thêm lớp trừu tượng chưa cần |
| Kubernetes | Quá nặng cho 1 VPS; Docker Compose đủ |
| Prometheus + Grafana | Chưa có nhu cầu vận hành liên tục |
| Elasticsearch | Truy vấn theo substring + index MongoDB đáp ứng |
| Redis Cluster | 1 instance đủ cho quy mô hiện tại |
| GPU / tăng tốc | VPS không có GPU; CPU-only là ràng buộc chấp nhận được |
| Vector database riêng (Qdrant/Milvus) | Vector nhúng trong MongoDB (`feedback_example`) đủ cho kho mẫu ở quy mô hiện tại |

---

## 14. Điều kiện nghiệm thu về công nghệ

1. Toàn bộ công nghệ trong báo cáo này hiện diện trong `package.json` của monorepo mới với phiên bản đã khoá.
2. Không module nào ở `domain/` hoặc `application/` import SDK của dịch vụ ngoài — kiểm chứng bằng quy tắc R7–R12.
3. Hệ thống khởi động thành công khi thiếu `SMTP_HOST` và khi `ai-engine` chưa sẵn sàng — chỉ log cảnh báo.
4. Biến môi trường sai kiểu làm fail sớm lúc khởi động.
5. `docker-compose.test.yml` dựng được MongoDB replica set 1 node + Redis + MinIO.
6. Test AI không bao giờ gọi engine thật.
6b. **Không có phụ thuộc nào tới SDK AI bên ngoài** trong `package.json` của monorepo — kiểm chứng bằng script `check-no-external-ai`.
6c. Benchmark model chạy được và có kết quả lưu tại `docs/benchmarks/` — model được chọn theo số liệu đo, không theo cảm tính.
6d. Mọi endpoint danh sách trả `nextCursor`/`hasMore`; không endpoint nào còn tham số `offset`/`page`.
7. Coverage đạt ngưỡng theo tầng; tổng ≥ 70%.
8. `openapi.json` sinh tự động từ `packages/contracts` và được snapshot trong CI.
