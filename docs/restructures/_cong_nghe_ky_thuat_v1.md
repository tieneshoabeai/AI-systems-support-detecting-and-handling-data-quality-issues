---
title: "Báo cáo kỹ thuật và công nghệ"
version: v1
date: 2026-11-05
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
| Hàng đợi | Redis + BullMQ | Redis 7 | Job table, sự kiện, rate-limit |
| Lưu trữ đối tượng | Cloudflare R2 | — | Tệp gốc, PDF, tệp đính kèm |
| Validation | Zod | 3.x | DTO runtime validation, sinh OpenAPI |
| Phân quyền | CASL | 7.x | Ability-based authorization |
| Xác thực | Passport + JWT | — | Access token, refresh token, Google OAuth |
| Sinh PDF | PDFKit | — | Tạo báo cáo PDF |
| Gửi email | Nodemailer (SMTP) | — | OTP, lời mời, thông báo |
| AI | Google Gemini API | Flash (Free Tier) | Phát hiện bổ sung, giải thích, đề xuất |
| Parse bảng tính | xlsx, fast-csv, busboy | — | Đọc CSV/Excel, stream upload |
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
| Không thêm broker thứ hai | Kafka bị loại: quy mô hiện tại không cần, thêm broker là thêm chi phí vận hành và độ phức tạp |
| Không thêm hạ tầng event platform đầy đủ | BullMQ + Redis + outbox/inbox là đủ cho một tác vụ AI đơn lẻ |
| Không thêm framework CQRS | 62 use case chưa cần lớp trừu tượng thêm; tách `commands/` và `queries/` bằng cấu trúc thư mục là đủ |
| Không dùng EventEmitter2 cho sự kiện nghiệp vụ | Phát đồng bộ trong process, không bền vững |
| Không dùng Prometheus/Grafana/Sentry | Observability tối giản: log JSON có cấu trúc + health endpoint |
| Không có dead-letter queue riêng | Dựa vào `removeOnFail` của BullMQ + trạng thái `failed` trong outbox + log |
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
│   └── src/modules/<module>/ # 20 module nghiệp vụ
└── worker/                   # BullMQ consumer, không có HTTP công khai
packages/
├── core/                     # Kiểu nền tảng dùng chung (thuần TS)
├── contracts/                # DTO Zod + nguồn sinh openapi.json
└── config/                   # Parser biến môi trường bằng Zod
```

**Ràng buộc bắt buộc giữa các package:**

- `packages/contracts` không import `@nestjs/*`, `mongoose`, `bullmq`.
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

**Hệ quả kiểm thử:** toàn bộ thư mục `domain/` của 20 module test được bằng unit test thuần Node, không cần MongoDB, không cần NestJS testing module. Đây là tiêu chí nghiệm thu của quy tắc R12.

### 4.3. Dependency Injection

| Ký hiệu | Cơ chế | Lý do |
|---|---|---|
| DI token | `export const X_PORT = Symbol('X')` | Tránh xung đột tên, không cần sinh code |
| Binding | `{ provide: X_PORT, useExisting: XRepository }` | Interface token → hiện thực cụ thể |
| Composition root | `<module>.module.ts` | Điểm nối port ↔ adapter duy nhất của module |

Không dùng class token cho interface — interface của TypeScript không tồn tại ở runtime, nên bắt buộc phải có token.

### 4.4. 20 module nghiệp vụ

| Nhóm | Module |
|---|---|
| Identity | `users`, `auth`, `audit` |
| Workspace & Project | `workspaces`, `projects` |
| Dataset | `datasets`, `data-view` |
| Analysis | `analysis`, `ai` |
| Hợp đồng & tổng kết | `summary` |
| Giao tiếp | `notifications`, `issues` |
| Hạ tầng dùng chung | `shared`, `reports` |

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

**Lý do chọn MongoDB:** hệ thống xử lý bảng dữ liệu người dùng với schema biến đổi theo từng sheet — mô hình document vừa khớp. Ngoài ra, transaction nhiều document và change stream là hai tính năng **bắt buộc** cho cơ chế outbox đã chốt.

**Đánh đổi:** không có ràng buộc quan hệ mạnh như SQL. Bù lại, toàn bộ tính toàn vẹn được kiểm soát ở tầng ứng dụng qua invariant của domain và ràng buộc rõ ràng trong schema.

### 5.2. Bộ sưu tập dữ liệu

21 collection, phân 4 nhóm:

| Nhóm | Collection | Loại | Xoá |
|---|---|---|---|
| Identity | `user`, `user_session`, `audit_log`, `audit_change` | Thực thể / Log | soft / TTL |
| Workspace & Project | `workspace`, `workspace_member`, `project`, `project_member` | Thực thể | soft |
| Dataset | `dataset`, `dataset_sheet` | Thực thể | soft |
| Dataset (dữ liệu thô) | `dataset_record` | **Thực thể — insert-only, KHÔNG soft delete** | không xoá |
| Analysis & AI | `analysis_run`, `analysis_result`, `cell_evidence`, `ai_job` | Thực thể | soft |
| Hợp đồng & tổng kết | `project_save` | Thực thể | soft |
| Giao tiếp | `notification`, `issue_report` | Log / Thực thể | TTL / soft |
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
| Index | Bắt buộc theo truy vấn: workspace/project, sheet theo dataset, record theo sheet, analysis theo run, TTL theo collection log |

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

---

## 6. Tích hợp bên ngoài và hàng đợi

### 6.1. Danh mục dịch vụ ngoài và port

| Dịch vụ | Port | Adapter | Bắt buộc | Ghi chú |
|---|---|---|---|---|
| Cloudflare R2 | `StoragePort` | `R2StorageAdapter` + `LocalStorageAdapter` | ✅ | Có fallback local |
| MongoDB | qua repository port | `MongooseXxxRepository` | ✅ | Bắt buộc replica set |
| Redis (hàng đợi) | `JobQueuePort` | `BullMqJobQueueAdapter` | ✅ | BullMQ |
| Redis (rate-limit) | `RateLimiterPort` | `RedisRateLimiterAdapter` | ✅ | Chống lạm dụng API |
| Gemini API | `AiAnalyzerPort` | `GeminiAiAnalyzerAdapter` | ✅ | Timeout 60s, 2 lần retry |
| SMTP | `EmailSenderPort` | `SmtpEmailSenderAdapter` | ✅ | OTP, lời mời, thông báo |
| Google OAuth | `GoogleOAuthPort` | `GoogleOAuthAdapter` | ❌ | Tuỳ chọn — chạy được nếu không cấu hình |
| PDF | `PdfRendererPort` | `PdfKitPdfRendererAdapter` | ✅ | PDFKit |
| Clock | `ClockPort` | `SystemClockAdapter` | ✅ | Test được thời gian |
| Id generator | `IdGeneratorPort` | `UlidIdGeneratorAdapter` | ✅ | `packages/core` |

**Quy tắc bắt buộc:**

1. Mọi dịch vụ bên ngoài đều đi qua port — không module nào import SDK trực tiếp.
2. `domain/` và `application/` không được import `@aws-sdk/client-s3`, `bullmq`, `nodemailer`, `@google/generative-ai`.
3. Adapter nằm ở `infrastructure/` của module sở hữu, hoặc ở `shared/infrastructure/` nếu là hạ tầng dùng chung.
4. Mỗi adapter có fallback hoặc feature flag — hệ thống khởi động được khi thiếu `GEMINI_API_KEY` hay `SMTP_HOST` (chỉ log cảnh báo, không crash).

### 6.2. Cơ chế outbox / inbox

| Thành phần | Cơ chế |
|---|---|
| Ghi outbox | Entity gom domain event → handler ghi vào `outbox_event` **trong cùng transaction** với thay đổi nghiệp vụ |
| Relay | 2 kênh: **Change Stream** (chính) + **polling fallback** quét event mồ côi |
| Hàng đợi | BullMQ — **một hàng đợi duy nhất** `domain-events`, consumer tự lọc theo `eventType` |
| Chống xử lý trùng | Collection `processed_event` (inbox pattern), khoá unique `(consumer_name, event_id)` |
| Bảo đảm giao | **at-least-once** → consumer phải idempotent |
| Claim/lease | 4 trạng thái, xử lý lỗ hổng at-least-once |

### 6.3. Sáu loại job

| Job | Hàng đợi | Trả kết quả |
|---|---|---|
| Chạy phân tích AI | `domain-events` | 202 + `pollUrl` |
| Sinh PDF | `domain-events` | 202 + `pollUrl` |
| Gửi email | `domain-events` | — |
| Dọn dẹp retention | Hằng ngày 02:00 VN | — |
| Relay outbox | `domain-events` | — |
| Xử lý sự kiện domain | `domain-events` | — |

---

## 7. Công nghệ AI

### 7.1. Nhà cung cấp và mô hình

| Quyết định | Nội dung |
|---|---|
| Nhà cung cấp | **Google Gemini API** — model Flash của Gemini Free Tier |
| Yêu cầu huấn luyện | Không — dùng API mô hình có sẵn, không vận hành mô hình riêng |
| Timeout | 60 giây |
| Retry | 2 lần |
| Chi phí | Hạn mức Free Tier — thiết kế để không vượt quota |

### 7.2. Ranh giới dữ liệu gửi ra ngoài

| Được gửi | Không được gửi |
|---|---|
| Thống kê tổng hợp có cấu trúc | Tệp gốc |
| Tối đa **20 ô lỗi/cột đã che PII** | Toàn bộ tập bản ghi |
| Mô tả lỗi đã lọc | Ảnh chụp màn hình lỗi |

Chi tiết định danh luôn được che trước khi gửi.

### 7.3. Phân tách trách nhiệm backend ↔ AI

| Phần | Ai quyết định |
|---|---|
| Phát hiện lỗi theo tiêu chí DQ-01 → DQ-04 | **Backend** — thuật toán tất định, tái lập được, kiểm thử được |
| Mức độ ảnh hưởng | **Backend** — theo quy tắc tái lập được (Thấp / Trung bình / Cao / Chưa đủ cơ sở) |
| Phát hiện bổ sung, giải thích, nhận xét, đề xuất | **AI** — dựa trên thống kê backend cung cấp |
| Sửa dữ liệu | **Không ai tự động** — AI không tự sửa dữ liệu |

**Lý do không để AI quyết định toàn bộ mức ảnh hưởng:** quy tắc backend giúp kết quả nhất quán và kiểm thử được, nhưng có thể bỏ sót ý nghĩa nghiệp vụ. Đây là đánh đổi được chấp nhận có chủ đích.

### 7.4. Xử lý khi AI lỗi

| Tình huống | Hành vi |
|---|---|
| AI lỗi hoặc timeout | Tổng kết vẫn được tạo từ kết quả hệ thống, **không có** giải thích/đề xuất AI |
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
| Che PII trước khi gửi AI | Tối đa 20 ô đã che |
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
| IP allowlist MongoDB Atlas | Giới hạn theo IP của VPS |
| R2 bucket không public | Mọi lần tải qua API có kiểm tra quyền |
| Secret trong `.env` | File gitignored, không commit |

---

## 9. Kiến trúc vận hành

### 9.1. Sơ đồ triển khai

```
┌───────────────────────────────────────────────────────────────┐
│                    VPS (1 máy, Ubuntu 22.04)                    │
│                                                                │
│  ┌──────────────────────┐      ┌────────────────────────────┐  │
│  │  Cloudflare Tunnel   │      │      Docker Compose        │  │
│  │  (tunnel → origin)   │─────►│                            │  │
│  └──────────────────────┘      │  ┌────────┐ ┌──────────┐  │  │
│                                │  │  api   │ │  worker  │  │  │
│  ┌──────────────────┐          │  │ :3000  │ │ (no HTTP)│  │  │
│  │  Nginx/Caddy     │◄─────────┤  └────┬───┘ └────┬─────┘  │  │
│  │  (TLS + static)  │  TLS    │       │          │        │  │
│  └──────────────────┘          │       └────┬─────┘        │  │
│                                │            │              │  │
│                                │  ┌─────────┴─────────┐    │  │
│                                │  │      Redis 7      │    │  │
│                                │  │ BullMQ + rate-limit│   │  │
│                                │  └───────────────────┘    │  │
│                                └────────────┬──────────────┘  │
└─────────────────────────────────────────────┼─────────────────┘
                                              │
                    ┌─────────────────────────┼─────────────────────────┐
            ┌───────▼────────┐      ┌─────────▼─────────┐     ┌────────▼────────┐
            │ MongoDB Atlas  │      │  Cloudflare R2    │     │  Gemini API     │
            │ M0 (dev)       │      │  file gốc, PDF,    │     │  phân tích AI   │
            │ M10 (prod)     │      │  tệp đính kèm      │     │                 │
            └────────────────┘      └───────────────────┘     └─────────────────┘
            ┌────────────────┐
            │ SMTP           │
            └────────────────┘
```

### 9.2. Các quyết định vận hành

| # | Quyết định | Ghi chú |
|---|---|---|
| 1 | Nền tảng triển khai: **Docker Compose trên VPS** | 1 file compose cho api + worker + Redis |
| 2 | Observability **tối giản** — log JSON + health endpoint | Không Prometheus/Grafana/Loki/Sentry |
| 3 | Định dạng log: **JSON structured** ra stdout | Máy đọc được, thu thập tập trung dễ |
| 4 | Database: **Atlas M0 cho dev**, **M10 cho production** | M0 không có replica set → cần fallback |
| 5 | Quota dung lượng **theo workspace** (500 MB) | Khớp thiết kế xử lý dữ liệu |
| 6 | **Không** dead-letter queue riêng | `removeOnFail` + `outbox_event.status='failed'` + log |
| 7 | Secret: file `.env` (gitignored) | Chuẩn, đơn giản |
| 8 | Redis: **một instance** cho BullMQ + rate-limit | Đủ cho quy mô hiện tại |
| 9 | R2 giữ nguyên cấu hình `S3_*` | Egress $0 — rẻ hơn S3 |

### 9.3. Biến môi trường

Nhóm biến chính — tất cả parse bằng Zod trong `packages/config`:

| Nhóm | Ví dụ biến |
|---|---|
| Server | `PORT`, `NODE_ENV`, `CORS_ORIGIN` |
| Database | `MONGODB_URI`, `MONGODB_DB_NAME` |
| Storage | `STORAGE_DRIVER`, `S3_ENDPOINT`, `S3_BUCKET`, `S3_ACCESS_KEY_ID` |
| Redis | `REDIS_URL` |
| AI | `GEMINI_API_KEY`, `GEMINI_MODEL`, `GEMINI_TIMEOUT_MS` |
| Email | `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` |
| Auth | `JWT_SECRET`, `JWT_REFRESH_SECRET`, `JWT_EXPIRES_IN`, `GOOGLE_CLIENT_ID` |
| Feature flag | `FEATURE_FLAG_COLLECTION`, `LEGACY_ROUTER_ENABLED` |
| Tunnel | `CLOUDFLARE_TUNNEL_ENABLED`, `SSL_ENABLED`, `SSL_PORT` |

Quy tắc: biến sai kiểu làm **fail sớm lúc khởi động**, không lỗi rối giữa chừng.

### 9.4. Health check

| Endpoint | Ý nghĩa |
|---|---|
| `/health` | Tiến trình còn sống |
| `/health/ready` | Sẵn sàng nhận traffic — đã kết nối MongoDB, Redis, sẵn sàng nhận job |

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
| Timeout AI | 60 giây, retry 2 lần |
| Số ô lỗi gửi AI | Tối đa 20 ô/cột |
| Quota dung lượng | 500 MB mỗi workspace |
| Rate-limit | Redis-backed, theo endpoint |
| Phân trang | `limit` 1–100, mặc định 15 hoặc 10 |
| Job dọn dẹp | Hằng ngày 02:00 giờ VN |

### 10.2. Chiến lược hiệu năng

| Kỹ thuật | Áp dụng ở |
|---|---|
| Index MongoDB theo truy vấn | Mọi truy vấn danh sách và lọc |
| Projection chỉ lấy trường cần | Tránh kéo cả document lớn |
| Phân trang offset có giới hạn | Chặn truy vấn quá nặng |
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

**Quy tắc:** test AI **luôn mock** — không bao giờ gọi Gemini thật trong test (nhanh, ổn định, không tốn quota).

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
- Chuyển đổi theo **lô module** (5 lô) thay vì một cửa sổ dừng hệ thống duy nhất.

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
| Đơn giản trước mạnh mẽ | Modular monolith thay vì microservices; 1 hàng đợi thay vì Kafka |
| Cô lập bằng port | 10 port cho toàn bộ dịch vụ ngoài; không import SDK ở domain/application |
| Cấu hình an toàn | Zod validate lúc khởi động; thiếu credential chỉ log cảnh báo |
| Kiểm thử được | Domain test thuần Node; AI luôn mock; E2E trên container thật |
| Không sao chép stack | Mỗi công nghệ đều có lý do lựa chọn riêng ghi trong báo cáo này |

### 13.2. Cơ hội cải tiến đã nhận diện

| Hạng mục | Trạng thái hiện tại | Hướng cải tiến |
|---|---|---|
| Observability | Log JSON + health endpoint | Chỉ nâng cấp khi có nhu cầu vận hành thực tế |
| Database | Atlas M0/M10 | Nâng cấp tier khi tải tăng; cân nhắc read replica |
| Hàng đợi | BullMQ 1 hàng đợi | Tách hàng đợi khi có nhiều loại job tải lệch nhau |
| Worker | Tách riêng `apps/worker` | Đã tách sẵn, sẵn sàng scale ngang |
| Frontend | Chưa có trong phạm vi | `packages/contracts` đã là hợp đồng dùng chung |
| Trình biên dịch | Alias TS 6.x + native 7.x | Chuyển sang native cho build khi bộ test ổn định |

### 13.3. Công nghệ chưa áp dụng — và lý do

| Công nghệ | Lý do không dùng |
|---|---|
| Kafka | Quá nặng cho quy mô hiện tại; BullMQ + outbox đã đủ |
| CQRS framework | Thêm lớp trừu tượng chưa cần |
| Kubernetes | Quá nặng cho 1 VPS; Docker Compose đủ |
| Prometheus + Grafana | Chưa có nhu cầu vận hành liên tục |
| Elasticsearch | Truy vấn theo substring + index MongoDB đáp ứng |
| Redis Cluster | 1 instance đủ cho quy mô hiện tại |
| Vector database | AI dùng thống kê có cấu trúc, không cần truy văn ngữ nghĩa |

---

## 14. Điều kiện nghiệm thu về công nghệ

1. Toàn bộ công nghệ trong báo cáo này hiện diện trong `package.json` của monorepo mới với phiên bản đã khoá.
2. Không module nào ở `domain/` hoặc `application/` import SDK của dịch vụ ngoài — kiểm chứng bằng quy tắc R7–R12.
3. Hệ thống khởi động thành công khi thiếu `GEMINI_API_KEY` và `SMTP_HOST` — chỉ log cảnh báo.
4. Biến môi trường sai kiểu làm fail sớm lúc khởi động.
5. `docker-compose.test.yml` dựng được MongoDB replica set 1 node + Redis + MinIO.
6. Test AI không bao giờ gọi Gemini thật.
7. Coverage đạt ngưỡng theo tầng; tổng ≥ 70%.
8. `openapi.json` sinh tự động từ `packages/contracts` và được snapshot trong CI.
