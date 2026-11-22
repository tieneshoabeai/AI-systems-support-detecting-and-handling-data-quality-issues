# BÁO CÁO CÔNG NGHỆ – KỸ THUẬT – AI – KIẾN TRÚC – MODULE – KIỂM THỬ
## Nền tảng AI hỗ trợ phát hiện và xử lý vấn đề chất lượng dữ liệu

> **Phạm vi rà soát:** toàn bộ `src/backend/src/**/*.ts` (**370 file**), `src/backend/test/**/*.spec.ts` + `src/backend/src/**/*.spec.ts` (**74 file test**, **1 277 ca**), `src/backend/package.json`, `src/backend/eslint.config.mjs`, `src/backend/.env.example`, `src/backend/src/main.ts`, `src/backend/src/app.module.ts`, toàn bộ `*.module.ts`, `*.port.ts`, `*.handler.ts`, `*.schema.ts`.
> **Phiên bản backend:** `ai-data-quality-backend@1.1.0` • **Ngày cập nhật:** 16/11/2026
> **File này thay thế hoàn toàn** 3 file cũ đã xóa: `_cong_nghe_ky_thuat.md`, `_cong_nghe_ky_thuat_v1.md`, `_cong_nghe_ky_thuat_du_an.md`.
> **Số liệu trong báo cáo này đã đo trực tiếp** từ mã nguồn hiện tại (đếm file, đếm route, chạy `test:unit` / `test:arch` / `lint` / `type-check` ngày 16/11/2026).

---

## MỤC LỤC

1. [Công nghệ mà dự án sử dụng](#1-công-nghệ-mà-dự-án-sử-dụng)
2. [Các kỹ thuật mà dự án sử dụng](#2-các-kỹ-thuật-mà-dự-án-sử-dụng)
3. [AI sử dụng](#3-ai-sử-dụng)
4. [Kiến trúc của dự án](#4-kiến-trúc-của-dự-án)
5. [Các module](#5-các-module)
6. [Các loại test nào, test như thế nào](#6-các-loại-test-nào-test-như-thế-nào)
7. [Đối chiếu hiện trạng sau Bước 1–8](#7-đối-chiếu-hiện-trạng-sau-bước-18)

---

## 1. CÔNG NGHỆ MÀ DỰ ÁN SỬ DỤNG

### 1.1. Ngôn ngữ, runtime, quản lý gói

| Hạng mục | Giá trị thực tế trong repo |
|---|---|
| Ngôn ngữ | **TypeScript** (`typescript@npm:@typescript/typescript6@^6.0.2`, `@types/node ^20.16.11`) |
| Runtime | **Node.js 22**, `ts-node ^10.9.2`, `tsconfig-paths`, `ts-loader`, `source-map-support` |
| Quản lý gói | **pnpm 11.3.0** (`packageManager: pnpm@11.3.0`), `pnpm-workspace.yaml`, `pnpm-lock.yaml` |
| Phong cách code | `prettier`, `eslint` (flat config + type-aware rules), `husky` (`prepare: husky \|\| true`) |
| Build/Run | `nest build`, `start: tsc -p tsconfig.build.json && nest start`, `start:dev` thêm `--watch`, `start:prod: node dist/main`, `type-check: tsc --noEmit` |
| Lint CI | `eslint "src/**/*.ts" "test/**/*.ts" "scripts/**/*.ts" --max-warnings 0` — **0 cảnh báo** là ngưỡng chặn CI |

### 1.2. Framework backend: NestJS 11 đầy đủ

| Package | Phiên bản | Vai trò trong dự án |
|---|---|---|
| `@nestjs/common`, `@nestjs/core` | `^11.1.21` | DI, Module, Controller, Guard, Filter, Interceptor, Pipe |
| `@nestjs/config` | `^4.0.0` | `ConfigModule.forRoot({ isGlobal: true, validate, envFilePath: ['.env','src/backend/.env'] })` |
| `@nestjs/mongoose` + `mongoose` | `^11.0.4` + `^9.6.2` | ODM duy nhất, mọi persistence đều qua Mongoose |
| `@nestjs/jwt`, `@nestjs/passport`, `passport`, `passport-jwt` | `^11.0.2`, `^11.0.5`, `^0.7.0`, `^4.0.1` | Access token 15 phút, `JwtStrategy` trích `Bearer` header |
| `@nestjs/platform-express` | `^11.1.21` | HTTP server, multipart upload qua Busboy |
| `@nestjs/platform-socket.io`, `@nestjs/websockets`, `socket.io` | `^11.2.8`, `^11.2.8`, `^4.8.4` | Realtime Gateway, `IoAdapter`, rooms `user:/project:/analysis:` |
| `@nestjs/swagger` | `^11.4.3` | OpenAPI tại `/api/v1/docs`, Bearer Auth, 3 servers (Current origin `/`, localhost, tunnel URL) |
| `@nestjs/throttler` | `^6.4.0` | **Đã gắn `ThrottlerGuard` toàn cục** qua `APP_GUARD` — mặc định 200 req/phút; endpoint nhạy cảm override 5–10 req/giờ |
| `rxjs` | `^7.8.2` | `Observable` cho Interceptor/Gateway |
| `reflect-metadata` | `^0.2.2` | Decorator metadata của NestJS |

`AppModule` (`src/backend/src/app.module.ts`) nhập **18 khối**: `ConfigModule`, `ThrottlerModule`, `SharedModule`, `DatabaseModule`, `OutboxModule`, `EventsModule`, `StorageModule`, `UsersModule`, `AuthModule`, `WorkspacesModule`, `ProjectsModule`, `DatasetsModule`, `DataViewModule`, `AnalysisModule`, `NotificationsModule`, `IssuesModule`, `FeedbackModule`, `RealtimeModule`, `AuditModule`, `OverviewModule` + `AppController` (health) + `RequestIdMiddleware`.

`main.ts` (`src/backend/src/main.ts`) làm 7 việc: (1) nạp SSL nếu `SSL_ENABLED`, (2) `trust proxy=1` cho Cloudflare, (3) `helmet` HSTS 1 năm + CSP theo `NODE_ENV`, (4) CORS cho phép `development/*`, `*.trycloudflare.com` và `CORS_ORIGIN`, `credentials:true`, (5) prefix `/api/v1` trừ `/health` và `/health/ready`, (6) `AllExceptionsFilter` + `TransformInterceptor` + `LoggingInterceptor` toàn cục, (7) Swagger 3 servers + `persistAuthorization`, listen có fallback 443→8443 khi thiếu quyền root.

### 1.3. Cơ sở dữ liệu: MongoDB Atlas (replica-set local khi dev)

- `DatabaseModule` là `@Global`, `MongooseModule.forRootAsync` với `MONGODB_URI`, `autoIndex:true`, `serverSelectionTimeoutMS:10000`, `connectTimeoutMS:10000`, `socketTimeoutMS:45000`, `maxPoolSize:20`, `minPoolSize:5`.
- `deploy/docker-compose.dev.yml` + `deploy/mongo/init-replica-set.js` dựng replica-set để dùng transaction.
- **20 model Mongoose** đăng ký qua `MongooseModule.forFeature` (19 file `*.schema.ts` — `AuditLog` + `AuditChange` dùng chung 1 file): `User`, `UserSession`, `Workspace`, `Project`, `Dataset`, `DatasetRecord`, `AnalysisRun`, `AnalysisResult`, `AiJob`, `FewShotExample`, `CellEvidence`, `ProjectSave`, `ReportJob`, `Notification`, `IssueReport`, `FindingFeedback`, `AuditLog`, `AuditChange`, `OutboxEvent`, `ProcessedEvent`. (`AnalysisConfig` đã bị gỡ khi bỏ endpoint `/analysis/config`.)
- Quy tắc ID: domain/application chỉ dùng **chuỗi hex 24 ký tự**, kiểm tra bằng `isObjectIdHex()` (`shared/utils/object-id.util.ts`), chỉ infrastructure mới dùng `Types.ObjectId`.
- TTL index thực tế: `user_session` → `{ expires_at: 1 }, { expireAfterSeconds: 0 }`; `notification` → tương tự; `finding_feedback` → `{ created_at: 1 }, { expireAfterSeconds: 365*24*3600 }`.
- Index keyset cursor phổ biến: `{ created_at: -1, _id: -1 }` (users) và `{ <owner>: 1, created_at: -1 }` cho các collection theo chủ sở hữu.

### 1.4. Lưu trữ kép: Cloudflare R2 (S3-compatible) + đĩa local

- `@aws-sdk/client-s3@^3.670.0`, `@aws-sdk/lib-storage@^3.670.0` (`S3Client`, `Put/Get/Delete/Head/ListObjectsV2`, `Upload`).
- `StorageService` (`shared/storage/storage.service.ts`) đồng thời implement `IStorageService` và `StoragePort`.
- Có đủ `S3_ENDPOINT + S3_ACCESS_KEY_ID + S3_SECRET_ACCESS_KEY` → **CLOUD MODE**; thiếu 1 trong 3 → **LOCAL FALLBACK** tại `storage/` (tự `mkdir -p`).
- Đủ 6 API: `uploadStream`, `downloadStream`, `deleteFile`, `fileExists` (qua `HeadObjectCommand`), `getCurrentUsageBytes` (cộng dồn `ListObjectsV2` hoặc đệ quy thư mục), `checkUploadQuota` so với `STORAGE_MAX_QUOTA_BYTES=10GB`, cảnh báo ở `STORAGE_WARN_THRESHOLD_RATIO=0.9`.
- Quota workspace riêng `WORKSPACE_STORAGE_QUOTA_BYTES=2GB` (O24), kiểm tra bởi `CheckWorkspaceUploadQuotaHandler`, vượt → `413 PayloadTooLarge`.

### 1.5. Bảo mật: JWT + bcrypt + crypto + CASL

- `bcrypt@^5.1.1`, `SALT_ROUNDS=12` qua `BcryptHasherAdapter`.
- `crypto` Node qua `shared/crypto/crypto.util.ts`: `computeSha256Buffer/Stream`, `deriveKeyPbkdf2` (100.000 vòng, SHA-512, key 32B), `encrypt/decryptAes256GcmBuffer` cấu trúc `[MAGIC DATAQUAL 8B][Salt 16B][IV 12B][Payload][Tag 16B]`, `createAes256GcmEncryptStream`.
- Refresh token thô `crypto.randomBytes(40).hex` (chỉ lộ 1 lần lúc login), bản lưu là SHA-256; `ACCESS_TOKEN_TTL_SECONDS=900`, refresh 7 ngày, **refresh remember-me 30 ngày**.
- `@casl/ability@^7.0.2`: `Action = manage|create|read|update|delete|execute|export`; `AppSubjects = all|Workspace|Project|Dataset|DataRecord|Analysis|User|Session|Notification|IssueReport|FindingFeedback`.
- `admin → manage all`; workspace `owner → manage` tài nguyên thuộc workspace; `member → read` + `cannot(create,update,delete,execute)`; user chỉ thao tác tài nguyên của chính mình.
- Ba guard: `JwtAuthGuard` (bỏ qua `@Public()`), `PoliciesGuard` (3 tầng: static-check → load resource theo `:id` → instance-check, dùng `buildSubject`), `RolesGuard` (khóa `/admin/*` cho `admin`).

### 1.6. Validate, tài liệu, upload, tính toán, vận hành

- `zod@^3.23.8`, `zod-to-json-schema@^3.25.2`: 100% DTO biên là Zod schema, `ZodValidationPipe` dùng `safeParse`, lỗi → `400 VALIDATION_ERROR {field,message,code}`; `ApiZodBody/ApiZodQuery/ApiOptimisticLock` + `zodToOpenApiSchema` sinh Swagger từ Zod; schema dùng chung `MongoIdSchema`, `EmailSchema`, `PasswordSchema` (8–100 ký tự), `PaginationQuerySchema`, `CursorQuerySchema`.
- `busboy@^1.6.0` streaming multipart (giới hạn 50MB), `fast-csv@^5.0.2` parse CSV `headers:true`.
- `simple-statistics@^8.0.0`, `ml-matrix@^6.15.1` (`Matrix.inverse/determinant`) cho DQ/tương quan/VIF.
- `helmet@^8.0.0`, `dotenv@^16.4.5`; `ConfigService` + `env.validation.ts` (Zod `EnvironmentSchema`, **73 biến**) kiểm tra toàn bộ biến môi trường lúc boot, sai thì crash sớm kèm message tiếng Việt.
- Hạ tầng kèm theo: `bin/cloudflared`, `certs/`, `scripts/start-cloudflare-tunnel.sh`, `install-cloudflared.sh`, `generate-ssl-certs.sh`, `bootstrap-database.ts` (xóa + gieo lại Mongo/R2 + bắn ntfy), `seed-initial-data.ts`, `lib/ntfy-notifier.ts`, `deploy/`.
- Biến dự phòng chưa có luồng thật (giữ để mở rộng): `REDIS_URL`, `SMTP_*`, `NTFY_*`, `GEMINI_API_KEY` (ghi chú legacy, corr-v1 không dùng), `DATA_ENCRYPTION_KEY`.

---

## 2. CÁC KỸ THUẬT MÀ DỰ ÁN SỬ DỤNG

### 2.1. Hexagonal (Ports & Adapters) 3 tầng nghiêm ngặt + Command/Query Handler

```
Domain (thuần TS, cấm @nestjs/mongoose)
  ↑ ports là Symbol
Application (chỉ @Inject(PORT), input là interface TS thuần)
  ↑ gọi qua port
Infrastructure (controller/DTO-Zod/schema/repo/mapper/adapter/gateway)
  ↑ wiring
NestJS Module ({ provide: PORT, useExisting: Concrete })
```

- **Domain**: `entities/`, `value-objects/*.vo.ts`, `events/*`, `*.util.ts`, `ports/*.port.ts`. Không import Nest/Mongoose/infrastructure.
- **Application**: **Command/Query Handler** — `application/commands/*.handler.ts` (**61 command**) + `application/queries/*.handler.ts` (**46 query**) = **107 handler**, tổng cộng **107 file `.handler.ts`**. Handler **không biết HTTP**: trả kết quả hoặc ném lỗi nghiệp vụ; dependency chỉ qua port token.
- **Infrastructure**: controller chỉ gọi 1 handler qua `handler.execute(...)`; repository implement port + mapper `snake_case (Mongo) ↔ camelCase (domain)`; truy vấn gõ chặt `Parameters<typeof model.find>[0]`, **cấm `as any`**.
- **Zero-any**: cấm `as any`, `: any`, `Record<string,any>`, `Array<any>` trên toàn `src/scripts/test`, có test kiến trúc `zero-any.spec.ts` quét từng dòng, vi phạm là fail CI.
- **Quy tắc phụ thuộc tầng** được cưỡng chế bằng ESLint type-aware rules + test `clean-architecture.spec.ts` (**13 ca**):
  - domain không import `@nestjs/*`, `mongoose`, `bcrypt`, `socket.io`, `express`, `passport*`, `@aws-sdk/*`, `kafkajs`, `ioredis`, `busboy` (nhóm `INFRA_LIBS`).
  - infrastructure không được import trực tiếp Mongoose model từ module khác.
  - application không được import DTO Zod từ infrastructure.
- Tổng: **22 port Symbol** (19 domain + 3 shared), **15 controller HTTP**, **1 gateway WebSocket**, **13 module nghiệp vụ** + 7 module shared.

### 2.2. Validate → Envelope → Phân trang con trỏ

- Mọi DTO biên là Zod tại `infrastructure/http/dtos/` (ví dụ `RegisterSchema`, `LoginSchema`, `CreateWorkspaceSchema`, `QueryRecordsBodySchema`, `RunAnalysisSchema`, `CreateIssueSchema`, `CreateFeedbackSchema`).
- `AllExceptionsFilter` chuẩn hóa: `HttpException` giữ status/message; `ZodError → 400 ZOD_VALIDATION_ERROR`; trùng key `11000 → 409 DUPLICATE_RESOURCE`; `Error → 500 INTERNAL_ERROR`; log `ERROR+stack` cho 5xx, `WARN` gọn cho 4xx (bỏ `favicon.ico`); trả `{ success:false, error:{code,message,timestamp,path} }`.
- `TransformInterceptor` bọc `{ success:true, data }`, bỏ qua khi đã có envelope hoặc stream `Content-Disposition`/`text/csv`.
- `CursorCodec` (base64url) cho `row_index`, `{createdAt,id}`; sai → `VALIDATION_ERROR (C10)`; `CursorPaginatedResponse { items, meta:{nextCursor,hasMore} }` kèm alias cũ `next_cursor/has_more`.
- `page/limit` cho workspaces/projects (max 100, default 15); `cursor/limit` cho data-view/notifications/issues/feedback/admin-users (data-view max 500 default 50).
- **Keyset cursor pagination** đã mở rộng lên **toàn bộ endpoint danh sách**: `users`, `workspaces`, `projects`, `datasets`, `records`, `notifications`, `issues`, `feedback`, `admin users`, `overview`. Test riêng `keyset-pagination.spec.ts` (**23 ca**).

### 2.3. Xác thực đa phiên + phân quyền 3 tầng + khóa lạc quan

- Register chuẩn hóa email (lowercase+trim), check trùng, bcrypt rồi tạo user.
- Login: `findByEmail(+password)` → `isAccountLocked` → `bcrypt.compare` → sinh refresh thô → SHA-256 → `detectDeviceName` (Postman/cURL/Insomnia/Windows/macOS/Linux/Android/iOS/Chrome/Edge/Firefox/Safari) → tạo session (ip+user-agent) → ký access `{sub,email,role,sessionId}`.
- **Remember-me**: cờ `remember_me` trên `user_session`; TTL 30 ngày thay vì 7 ngày, kèm `last_used_at` để theo dõi hoạt động gần nhất.
- Refresh: băm refresh thô → tìm session → check user còn active/chưa xóa mềm → cấp access mới. Logout thu hồi theo `sessionId` trong token.
- `JwtStrategy`: `ExtractJwt.fromAuthHeaderAsBearerToken()`, `secretOrKey=JWT_ACCESS_SECRET`, `ignoreExpiration:false`, `validate` nạp user + `canUserLogin`.
- Realtime handshake: token ở `auth.token` hoặc `query.token`, sai → `4401`, socket tắt → `SOCKET_DISABLED`; `joinProject/joinAnalysis` kiểm quyền qua `ProjectsService/WorkspacesService`, id sai → `{ok:false}`.
- `PoliciesGuard`: static-check (tên subject) → load resource theo `params.id` (`POLICY_RESOURCE_KEY`) → instance-check (`buildSubject`); thiếu quyền `403`, thiếu tài nguyên `404`.
- Issues dùng **optimistic locking** `expectedVersion`, sai → `409/412` yêu cầu đọc lại.

### 2.4. Google OAuth 2.0 (Authorization Code flow) — hiện thực thật

- `GET /auth/google` → trả `authorizationUrl` kèm **`state` CSRF ngẫu nhiên** (lưu trong session/short-lived store) → chuyển hướng tới `accounts.google.com/o/oauth2/v2/auth`.
- `GET /auth/google/callback` → kiểm tra `state` → đổi `code` lấy `access_token`/`id_token` tại `oauth2.googleapis.com/token` → **verify RS256** qua JWKS (`https://www.googleapis.com/oauth2/v3/certs`) → trích `email`, `email_verified`, `sub` → `LoginWithGoogleHandler`.
- **Cấm tự động liên kết** khi email đã tồn tại trong hệ thống → trả `409 CONFLICT` (không tự merge, tránh chiếm đoạt tài khoản).
- Nếu thiếu bất kỳ biến nào trong `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` / `GOOGLE_REDIRECT_URI` → `501 DEPENDENCY_UNAVAILABLE` (không phải 500).
- Adapter `GoogleOAuthAdapter` hiện thực `GOOGLE_OAUTH_PORT` trong `auth/domain/ports/google-oauth.port.ts`.

### 2.5. Ingestion streaming + lưới ảo keyset + thống kê server-side

- Ingestion 3 nhánh `PassThrough`: tính SHA-256 + upload R2/local + parse CSV **song song**, không nạp RAM, không file tạm; vượt 50MB giữa stream → hủy cả 3 nhánh.
- Suy luận schema từ 100 dòng đầu (`SchemaInferenceService`), max 1000 cột; `bulkInsert` mẻ 5000 vào `dataset_records { dataset_id, row_index, props:{c0..cN} }`, rỗng → `null`.
- Tạo metadata `INGESTING` trước → `READY` sau; đặt `hasDataset=true`, cộng quota workspace, ghi outbox `DATASET_INGESTED`; lỗi → xóa file + xóa mềm dataset/records + đánh `FAILED`.
- Ràng buộc: **1 project = 1 dataset active**; sai CSV/thiếu header/quá cột → `VALIDATION_ERROR`.
- Lưới ảo: `listRecords` lọc `dataset_id + row_index > cursor`, sort `row_index`, lấy `limit+1` để biết `hasMore`; `queryRecords` giải key `cN`/tên hiển thị/tên gốc, gom filter cùng cột thành `$or`, dịch **14 toán tử** (`equals,notEquals,contains,notContains,startsWith,endsWith,greaterThan,greaterThanOrEqual,lessThan,lessThanOrEqual,between,in,isEmpty,isNotEmpty`) sang `$regex/$gt/$gte/$lt/$lte/$in/$ne/$exists`, search thành regex case-insensitive, sort `props.cN` rồi `row_index`.
- Thống kê cột bằng aggregate: `total/null_count/numeric_values` → `min/max/average` + histogram **10 buckets**; cột non-number trả histogram rỗng.

### 2.6. Realtime an toàn + Outbox + Worker trong tiến trình + quan sát được

- Nguyên tắc: server là nguồn sự thật; client nhận event chỉ để refresh UI, số liệu chính xác gọi lại REST.
- Envelope chỉ chứa id/trạng thái/số liệu; **cấm** `reason,email,value,cell_value,finding,description,summary_detail,password,token` (`assertNoSensitiveData`); emit luôn `try/catch`, không làm hỏng nghiệp vụ chính; tôn trọng `SOCKET_ENABLED=false`.
- 3 rooms `user:/project:/analysis:`; 7 events: `notification.created, ai.quality.updated, analysis.progress/completed/failed, ai.job.status, feedback.created`.
- Outbox: `recordEvent/getPendingEvents(50)/markAsProcessed/markAsFailed`, retry tối đa 5, hết → `FAILED`. Có `OutboxRelayService` + `InboxService` (idempotency theo `processed_events`).
- Worker `setInterval` + cờ `busy`: `AiWorkerService` poll 10s (lease 10 phút, `skipStaleJobs`, `claimPendingJob`, heartbeat 1/3 lease), `ReportWorkerService` poll 10s; mặc định tắt, bật bằng `AI_WORKER_ENABLED/REPORT_WORKER_ENABLED`.
- Quan sát: `GET /health` (liveness, ngoài prefix) trả `mongodb_atlas{status,readyState}` + `storage{mode,bucket}`; `GET /health/ready` trả `200` khi Mongo sẵn sàng, `503` khi degraded, kèm `uptimeSeconds`, version `1.1.0`.
- Bàn giao frontend: `docs/frontend-handover/README.md`, `01-api-contract.md` (60+ endpoints), `02-realtime-and-env.md`; Swagger qua tunnel phải chọn server `Current origin /` để tránh `Failed to fetch`.

---

## 3. AI SỬ DỤNG

### 3.1. Engine suy luận cục bộ (không gọi API công cộng)

| Cấu hình | Giá trị | Ý nghĩa |
|---|---|---|
| `AI_ENGINE` | `ollama` (dev) / `vllm` (prod) | `LocalInferenceAdapter` POST tới `AI_INFERENCE_BASE_URL`, `AbortController` + timeout |
| `AI_MODEL_PRIMARY` / `AI_MODEL_FAST` | `qwen3-14b` / `qwen3-8b` | Mô hình chính/nhanh, thư mục `AI_MODEL_PATH=/models` |
| `EMBEDDING_MODEL` / `EMBEDDING_DIM` | `qwen3-embedding-0.6b` / `1024` | Embedding RAG nội bộ, không rò dữ liệu |
| `AI_TIMEOUT_MS` / `AI_JOB_TIMEOUT_MS` | `180000` | Timeout mỗi lần gọi AI |
| `AI_MAX_RETRIES` / `AI_MAX_CONCURRENCY` | `2` / `1` | Chỉ retry lỗi mạng/5xx/timeout, chạy tuần tự |
| `AI_MAX_EVIDENCE_PER_COLUMN` | `20` | Trần evidence mỗi cột đưa vào prompt |
| `AI_MASK_PII_ENABLED` | `true` | Bật che PII trước khi đưa mẫu vào prompt |
| `AI_RAG_ENABLED/TOP_K/MIN_TRUST` | `true / 5 / 0.6` | RAG few-shot |
| `AI_RAM_GUARD_PERCENT/MIN_RAM_GB` | `85 / 12` | Giữ RAM cho suy luận local |

`GEMINI_API_KEY` chỉ còn trong schema env với chú thích **legacy**, luồng `corr-v1` hiện tại **không dùng**.

### 3.2. Luồng corr-v1 có căn cứ (grounded, chống ảo giác)

1. `POST /projects/:projectId/analysis` chạy **đồng bộ** DQ + mô tả + mất cân bằng + chuỗi thời gian + tương quan + VIF + evidence, đồng thời tạo `ai_job pending`.
2. `AnalysisService.buildPromptForJob` dựng prompt từ **số liệu thật** + mẫu đã che PII (tối đa 20/cột) + khối few-shot RAG + method `pearson/spearman`.
3. `AiWorkerService` nhận job (lease), gọi `inference.complete({prompt,timeoutMs,modelId})`, timeout thì hủy request.
4. `extractJsonObject` tách JSON object trong text AI; thiếu/sai kiểu → job `failed` (không suy diễn thêm).
5. `groundAiAssessment` đối chiếu với ma trận thật bằng Zod strict `CorrV1RawSchema` (`notablePairs{colA,colB,coef}`, `highVif`, `limits`, `nextSteps`); sai → `failed`.
6. `ingestAiResult` gắn kết quả đã căn cứ vào `analysis_results`; frontend đọc ở `GET .../analysis/result`.
7. `GET /analysis/jobs/:jobId` poll trạng thái; `POST .../retry` chạy lại thủ công.

### 3.3. Thuật toán thống kê thuần domain

- **`dq.util.ts`**: `isMissingCell` chỉ coi `null/undefined/''/whitespace` là thiếu (không coi `0/false/'NA'`); `computeDq0102` đếm thiếu theo cột, dòng thiếu toàn bộ/một phần, trùng fingerprint (bỏ dòng thiếu toàn bộ); `computeDq03` đúng kiểu `string/number/boolean/date`; `detectOutliers` IQR (`Q1-1.5IQR`, `Q3+1.5IQR`, cực trị `3IQR`) + modified z-score, cần n≥4, trả `iqrOutliers/iqrExtreme/zOutliers/union/intersection`.
- **`correlation.util.ts`**: phân loại `numeric/categorical/excluded` (cột `date` luôn loại); `isMissingValue` coi `null/undefined/NA/none/-` là thiếu; `toFiniteNumber/toCategory`; `computePairCell` Pearson (`sampleCorrelation`) hoặc Spearman, ghi `n/totalScanned/missingAOnly/missingBOnly/missingBoth/computable/reason`; `buildCorrelationMatrix` duyệt từng cặp + `notes`.
- **`vif.util.ts`**: cần ≥2 cột số, lọc dòng đủ số, `commonN/commonNRate`, cảnh báo mất >20%/50%, loại cột hằng, nghịch đảo `ml-matrix`, cờ `ok/review/high`.
- **`stats.util.ts`**: `describeColumn`, `evaluateImbalance`, `analyzeTime(day/week/month/year)`.
- **Evidence**: `cell_evidences` tối đa 20/cột, gom `{total,byKind,byColumn,capped}`; `SummaryService` gom `DQ-01/03/04` theo cột + `DQ-02` trùng dòng, sort theo count, top 50, kèm `evidence_refs`, khuyến nghị "xử lý tại nguồn, không tự xóa/sửa dòng", gắn `ai_section` nếu AI xong, save cũ → stale.

### 3.4. RAG few-shot học từ nhận xét người dùng (T1)

- Kho tối đa **50.000 mẫu FIFO**, mẫu >180 ngày bị loại, chỉ dùng `trustScore≥0.6`, `topK=5`.
- So khớp **cosine similarity thuần trong Mongo** (không vector DB riêng), lọc `errorType` + ngôn ngữ `vi` trước khi chấm điểm.
- `normalizeExample/stripIdentifiers/renderFewShotBlock`; nhãn `correct/partially_correct/false_positive/missed_issue/other` ánh xạ sang `correct/false_positive/missed_issue`; `false_positive/missed_issue/other` **bắt buộc reason** (`requiresReason/assertReasonForLabel`).
- `computeTrustScore(agreementCount)` + `isEligibleForStore` mới cho lưu; `embedText` tạo vector; `findDuplicateExample` trùng thì `updateFewShotTrust`, mới thì `saveFewShotExample` + `enforceFewShotCap`.
- `RagFewShotService` chỉ gọi qua `ANALYSIS_REPOSITORY_PORT`; lỗi RAG → trả khối rỗng, **không chặn AI**.

### 3.5. Worker báo cáo + adapter suy luận

- `POST /projects/:projectId/report` chỉ tạo `report_job pending` + trả `{reportId,pollUrl}`, **không sinh file tại API**.
- `ReportWorkerService` poll 10s, đọc `project_save` mới nhất, dựng nội dung, `uploadStream` tới `reports/<project>/<report>.txt`, cập nhật `succeeded{storageKey,fileSizeBytes}`, lỗi → `failed{REPORT_BUILD_FAILED}`.
- `ReportService.downloadReportFile` bọc `findReportById + downloadStream`; `GET .../report/:reportId/file` trả `202` khi chưa xong, stream `text/plain + Content-Disposition` khi xong.

---

## 4. KIẾN TRÚC CỦA DỰ ÁN

### 4.1. Sơ đồ tổng thể

```text
Browser / Swagger (tunnel hoặc localhost)
  → Cloudflare Tunnel → http://localhost:3000
  → NestJS prefix /api/v1 (trừ /health, /health/ready)
  → ThrottlerGuard → JwtAuthGuard → PoliciesGuard / RolesGuard
  → Controller (Zod) → Command/Query Handler (Port)
  → Repository / Adapter → MongoDB Atlas + R2/local
  → Socket.IO Gateway → rooms user:/project:/analysis:
  → Worker setInterval (AI job + Report job)
  → OutboxRelay → Events (Kafka/Redis) → Inbox (idempotent)
```

### 4.2. Sơ đồ tầng Hexagonal + Command/Query Handler

```text
Domain: entity, value-object, event, util, port (Symbol)
  ↑ phụ thuộc ngược qua port
Application: 61 command handler + 46 query handler (chỉ phụ thuộc Port)
  ↑ gọi qua port
Infrastructure: controller, DTO-Zod, schema, repository, mapper, adapter, gateway
  ↑ wiring
NestJS Module: { provide: PORT_SYMBOL, useExisting: Concrete }
```

### 4.3. Vòng đời một request (7 bước)

1. `main.ts`: trust proxy → Helmet → CORS → prefix → Filter/Interceptor.
2. `JwtAuthGuard`: bỏ qua `@Public()`, còn lại check `Bearer` bằng `JwtStrategy`.
3. `PoliciesGuard/RolesGuard`: check CASL theo workspace/project/role.
4. Controller: `ZodValidationPipe` check body/query/param → gọi đúng 1 application service.
5. Service: `isObjectIdHex` → nạp project/workspace kiểm quyền → gọi các port.
6. Repository: chạy Mongoose → mapper `snake→camel` → trả id chuỗi.
7. `TransformInterceptor` bọc `{success:true,data}`; lỗi qua `AllExceptionsFilter` thành `{success:false,error}`.

### 4.4. Luồng dữ liệu chính

```text
Upload CSV → file thô (R2/local) + dataset_records + outbox DATASET_INGESTED
  → Data-View keyset → Analysis config → Analysis run (đồng bộ)
  → AI job corr-v1 (bất đồng bộ) → Summary → Report job (bất đồng bộ) → tải file
  → Feedback đánh giá AI → RAG học mẫu → Notification + Issue → Realtime
```

### 4.5. Cấu trúc thư mục vật lý

```text
src/backend/src/main.ts | app.module.ts | app.controller.ts
src/backend/src/modules/auth|users|workspaces|projects|datasets|data-view|analysis
  |notifications|issues|feedback|realtime|audit|overview/      (13 module)
  mỗi module: {module}.module.ts | index.ts
    application/commands/*.handler.ts   (Command)
    application/queries/*.handler.ts     (Query)
    application/*.service.ts             (service dùng chung, ví dụ worker)
    domain/entities|value-objects|events|ports|*.util.ts
    infrastructure/http/*.controller.ts + dtos/*.ts
    infrastructure/persistence/*.schema.ts + *.repository.ts + *.mapper.ts
    infrastructure/security|ai|websocket|adapters (riêng auth/analysis/realtime/audit)
src/backend/src/shared/application|casl|config|crypto|database|decorators
  |events|filters|guards|interceptors|middleware|pagination|pipes|ports|storage|swagger|utils|validation
src/backend/test/*.spec.ts (24) | test/e2e/** | test/k6 | test/benchmark | scripts/* | deploy/* | storage/
   260|docs/restructures/00_*.md + 00_*.slides.html | docs/frontend-handover/
```

### 4.6. Ma trận 22 ports (+1 AI port)

| Port | Định nghĩa | Cung cấp | Sử dụng |
|---|---|---|---|
| `ANALYSIS_REPOSITORY_PORT` | `analysis/domain/ports/analysis.repository.port.ts` | `AnalysisRepository` | Analysis, Summary, Report, RAG, AiWorker |
| `DATASET_REPOSITORY_PORT` | `datasets/.../dataset.repository.port.ts` | `DatasetsRepository` | Datasets, Analysis, DataView |
| `RECORD_QUERY_PORT` | `data-view/.../record-query.port.ts` | `RecordQueryRepository` (export qua DataViewModule) | DataView, Analysis |
| `PROJECT_REPOSITORY_PORT` | `projects/...` | `ProjectsRepository` | ProjectsService |
| `WORKSPACE_REPOSITORY_PORT` | `workspaces/...` | `WorkspacesRepository` | Workspaces, Projects, Datasets, Feedback, Overview |
| `USER_REPOSITORY_PORT` | `users/...` | `UsersRepository` | Users, Workspaces, Projects, Notify, Issues, Feedback, RealtimeAuth |
| `NOTIFICATION_REPOSITORY_PORT` | `notifications/...` | `NotificationsRepository` | Notify, Issues |
| `ISSUE_REPORT_REPOSITORY_PORT` | `issues/...` | `IssuesRepository` | IssuesService |
| `FEEDBACK_REPOSITORY_PORT` | `feedback/...` | `FeedbackRepository` | FeedbackService |
| `AUDIT_REPOSITORY_PORT` | `audit/domain/ports/audit.repository.port.ts` | `AuditRepository` | `LogHandler`, `AuditLoggerAdapter` |
| `AUDIT_LOGGER_PORT` | `audit/domain/ports/audit-logger.port.ts` | `AuditLoggerAdapter` (facade → `LogHandler`) | Module khác ghi audit log |
| `PROJECT_ACCESS_PORT` | `projects/domain/ports/project.access.port.ts` | Access adapter | Kiểm quyền project |
| `WORKSPACE_ACCESS_PORT` | `workspaces/domain/ports/workspace.access.port.ts` | Access adapter | Kiểm quyền workspace |
| `RAG_FEW_SHOT_PORT` | `analysis/domain/ports/rag-few-shot.port.ts` | `RagFewShotService` | Analysis, AiWorker |
| `REALTIME_PORT` | `shared/ports/realtime.port.ts` | `RealtimeService` (@Global) | Analysis, Notify, Issues, Feedback (`@Optional()`) |
| `REALTIME_TRANSPORT_PORT` | `realtime/domain/ports/realtime-transport.port.ts` | `RealtimeService` | RealtimeAuth |
| `EVENT_PUBLISHER_PORT` | `shared/ports/event-publisher.port.ts` | `EventDispatcherService` | Outbox, module nghiệp vụ |
| `STORAGE_PORT` | `shared/ports/storage.port.ts` | `StorageService` (@Global) | Datasets, Report, Issues (attachment), AppController |
| `OUTBOX_PORT` | `shared/ports/outbox.port.ts` | `OutboxService` (@Global) | DatasetsService, Audit |
| `GOOGLE_OAUTH_PORT` | `auth/domain/ports/google-oauth.port.ts` | `GoogleOAuthAdapter` | `LoginWithGoogleHandler` |
| `AUTH_SESSION_PORT` | `auth/.../auth-session.port.ts` | `UsersAuthSessionAdapter` | AuthService |
| `AUTH_USER_LOOKUP_PORT` | `auth/.../auth-session.port.ts` | `UsersAuthLookupAdapter` | AuthService |
| `PASSWORD_HASHER_PORT` | `auth/.../auth-session.port.ts` | `BcryptHasherAdapter` | AuthService |
| `AUTH_TOKEN_ISSUER_PORT` | `auth/.../auth-session.port.ts` | `JwtIssuerAdapter` | AuthService |
| `AiInferencePort` | `analysis/application/ports/ai-inference.port.ts` | `LocalInferenceAdapter` | AiWorkerService |

---

## 5. CÁC MODULE

### 5.1. Auth — đăng ký/đăng nhập/phiên/Google OAuth

- **Application**: `auth/application/commands/` — `register`, `login`, `login-with-google`, `refresh-access-token`, `logout`, `revoke-session`, `change-password`, `forgot-password`, `reset-password`; `auth/application/queries/` — `get-sessions`, `get-session-by-id`.
- **Domain**: `auth-policy.vo.ts` (khóa tài khoản, hết hạn refresh), `password-policy.vo.ts` (8–100), `auth-events.ts`, 5 ports (session / user-lookup / password-hasher / token-issuer / google-oauth).
- **Infrastructure**: `auth.controller.ts` (`POST register/login/refresh/logout`, `GET sessions`, `DELETE sessions/:id`, `POST change-password`, `POST forgot-password`, `POST reset-password`, `GET google`, `GET google/callback`); `jwt.strategy.ts`; adapters bcrypt/jwt-issuer/lookup/session/google-oauth.
- **Module** nhập `UsersModule+PassportModule+JwtModule.async`, xuất `AuthService/JwtStrategy/PassportModule`.

### 5.2. Users — hồ sơ + tra cứu nền + quản trị

- **Application** `users/application/commands/`: `create-user`, `update-profile`, `update-notification-preferences`, `soft-delete-user`, `create-session`, `touch-session`, `revoke-session`, `revoke-session-by-id`, `revoke-all-user-sessions`; `users/application/queries/`: `find-by-email`, `find-by-id`, `find-paged`, `find-active-sessions`, `find-session-by-id`, `find-session-by-token-hash`.
- **Domain**: `user.entity.ts`, `user-session.entity.ts`, `user-role.vo.ts` (`normalizeEmail/canUserLogin`), `session-policy.vo.ts` (TTL 7 ngày / **30 ngày remember-me**), `USER_REPOSITORY_PORT`.
- **Infrastructure**: `users.controller.ts` (`GET/PATCH/DELETE /users/me`), `admin-users.controller.ts` (`GET /admin/users`, `GET /admin/users/:id` — keyset pagination), `user.schema.ts` (`phone`, `bio`, `google_id`, `auth_provider`), `user-session.schema.ts` (`remember_me`, `last_used_at`, TTL index), `users.repository.ts`.
- **Module** đăng ký 2 schemas, xuất Service/Repo/Port/MongooseModule cho Auth/Realtime dùng lại.

### 5.3. Workspaces — không gian làm việc

- **Application** `workspaces/application/commands/`: `create-workspace`, `update-workspace`, `delete-workspace`, `add-member`, `remove-member`, `transfer-owner`, `leave-workspace`, `increment-storage-used`; `queries/`: `get-workspaces`, `get-workspace-by-id`, `list-workspaces`, `list-members`, `check-workspace-upload-quota`, `resolve-user-workspace-role`.
- **Domain**: `workspace.entity.ts` (`isOwner/isMember/assertActorIsOwner/assertCanRemoveMember/assertCanTransfer/assertCanLeave`), `workspace-role.vo.ts`, `WORKSPACE_REPOSITORY_PORT` + `WORKSPACE_ACCESS_PORT`.
- **Infrastructure**: `workspaces.controller.ts` (CRUD + `GET/POST/DELETE :id/members`, `POST :id/transfer-owner`, `POST :id/leave`); 5 DTOs; `workspace.schema.ts` (members[], `storageUsedBytes`), `workspaces.repository.ts`, `workspace.mapper.ts`.

### 5.4. Projects — dự án trong workspace

- **Application** `projects/application/commands/`: `create-project`, `update-project`, `delete-project`, `mark-completed`, `set-has-dataset`, `add-project-member`, `update-project-member-role`, `remove-project-member`, `transfer-project-owner`; `queries/`: `get-project-by-id`, `get-projects-by-workspace`, `list-projects-by-workspace`, `list-members`, `get-workspace-name`, `resolve-user-project-role`.
- **Domain**: `project.entity.ts` (`assertNoActiveDataset/assertCanModerate/assertCanAccess`), `project-role.vo.ts` (`owner/member/viewer`), `project-status.vo.ts`, `PROJECT_REPOSITORY_PORT` + `PROJECT_ACCESS_PORT`.
- **Infrastructure**: `projects.controller.ts` (CRUD + `GET/POST/PATCH/DELETE :id/members` + `POST :id/transfer-owner`); 4 DTOs; `project.schema.ts`, `projects.repository.ts`, `project.mapper.ts`.

### 5.5. Datasets — cổng ingestion CSV

- **Application** `datasets/application/commands/`: `ingest-dataset-stream`, `map-props-to-original-names`, `delete-dataset`, `cascade-project-datasets`; `queries/`: `get-dataset-by-id`, `get-dataset-by-project-id`, `get-dataset-schema`, `download-dataset-file`.
- **Domain**: `dataset.entity.ts` (`assertIngestible`), `column-type.vo.ts` (`string/number/boolean/date`, `stableColumnKey c{i}`), `dataset-limits.vo.ts` (50MB, 1000 cột, batch 5000, mẫu 500), `DATASET_REPOSITORY_PORT`.
- **Infrastructure**: `datasets.controller.ts` (`POST projects/:projectId/datasets/upload` multipart, `GET` theo project/id, `PATCH :id`, `PATCH :id/columns/pii`, `GET :id/schema`, `GET :id/file`, `DELETE :id`); `dataset.schema.ts`, `dataset-record.schema.ts` (`dataset_id+row_index`), `datasets.repository.ts`, `dataset.mapper.ts`.

### 5.6. Data-View — lưới ảo đọc nhanh

- **Application** `data-view/application/queries/`: `get-records`, `query-records`, `get-column-stats`.
- **Domain**: `record-query.entity.ts`, `record-filter.vo.ts` (14 toán tử + `propsPath`), `record-query.vo.ts` (default 50/max 500), `RECORD_QUERY_PORT` (`listAllRecords/resolveColumnKey/listRecords/queryRecords/getColumnStats`).
- **Infrastructure**: `data-view.controller.ts` (`GET datasets/:datasetId/records`, `POST .../records/query`, `GET .../columns/:columnKey/stats`); 2 DTOs; `record-query.repository.ts` (dịch filter→Mongo, aggregate stats).
- **Module** tái dùng `DatasetRecordSchema`, nhập `DatasetsModule`, xuất `DataViewService + RECORD_QUERY_PORT` cho Analysis.

### 5.7. Analysis — trung tâm DQ + AI (module lớn nhất, 8 schemas)

- **Application**: `analysis/application/commands/`: `run-analysis`, `ingest-ai-result`, `retry-job`, `build-prompt-for-job`, `create-summary`, `request-report`; `queries/`: `get-result`, `get-job`, `get-summary`, `get-report-file-meta`, `download-report-file`. Cộng `summary.service.ts`, `report.service.ts`, `report-worker.service.ts`, `services/ai-worker.service.ts`, `services/rag-few-shot.service.ts`.
- **Domain**: `dq/correlation/vif/stats/ai-grounding/rag-few-shot/pii-mask.util.ts`, `ANALYSIS_REPOSITORY_PORT` (run/result/job/config/save/report/few-shot/evidence, ~25 phương thức), `RAG_FEW_SHOT_PORT`.
- **Infrastructure**: 3 controllers (analysis/summary/report), 2 DTOs, `local-inference.adapter.ts`, 8 schemas (`analysis-run/result/config`, `ai-job`, `few-shot-example`, `cell-evidence`, `project-save`, `report-job`), `analysis.mapper.ts`, `analysis.repository.ts`.
- **API**: `POST/GET .../analysis/config`, `POST .../analysis`, `GET .../analysis/result`, `GET /analysis/jobs/:jobId`, `POST .../retry`, `POST .../result`, `POST/GET .../summary`, `POST .../report`, `GET .../report/:reportId/file`.

### 5.8. Notifications — trung tâm thông báo

- **Application** `notifications/application/commands/`: `dispatch`, `mark-as-read`, `update-preferences`; `queries/`: `list-for-user`, `get-detail`, `count-unread`.
- **Domain**: `notification.entity.ts` (`resolveMandatory/canDispatch`), `notification-type.vo.ts` (10 loại, bắt buộc `issue_needs_info/security_alert`), `NOTIFICATION_REPOSITORY_PORT`.
- **Infrastructure**: `GET /notifications`, `GET /notifications/unread-count`, `GET /notifications/:id`, `PATCH /notifications/:id/read`, `PATCH /users/me/notification-preferences`; `notification.schema.ts` (TTL), `notifications.repository.ts`, `notification.mapper.ts`.

### 5.9. Issues — báo sự cố user + xử lý admin

- **Application** `issues/application/commands/`: `create-report`, `update-my-report` (chỉ khi `status = needs_info`), `update-status`, `upload-attachment`; `queries/`: `list-mine`, `get-mine`, `list-for-admin`, `get-for-admin`, `download-attachment`.
- **Domain**: `issue-report.entity.ts` (máy trạng thái `new→needs_info→in_progress→resolved→closed`), `issue-status.vo.ts` (`USER_EDITABLE_ISSUE_STATUSES = ['needs_info']`), `issue-type.vo.ts` (`function_error/display_error/data_error/feature_feedback/other`), `ISSUE_REPORT_REPOSITORY_PORT`.
- **Infrastructure**: `POST/GET /issues`, `GET /issues/:id`, `GET /admin/issues`, `GET /admin/issues/:id`, `PATCH /admin/issues/:id/status` (khóa `@Roles('admin')`), `PATCH /issues/:id` (sửa của tôi khi `needs_info`); 4 DTOs; `issue-report.schema.ts` (attachments[], context{}, version), `issues.repository.ts`, `issue.mapper.ts`.

### 5.10. Feedback — nhận xét chất lượng AI + nuôi RAG

- **Application** `feedback/application/commands/`: `create-finding-feedback`, `create-run-feedback`, `update-mine`, `remove`, `ai-quality-metrics`; `queries/`: `list-finding-feedback`, `list-run-feedback`.
- **Domain**: `finding-feedback.entity.ts` (`assertReasonForLabel`), `feedback-label.vo.ts` (5 nhãn, 3 nhãn cần reason), `FEEDBACK_REPOSITORY_PORT`.
- **Infrastructure**: `POST analyses/:analysisId/findings/:findingId/feedback`, `POST analyses/:analysisId/feedback`, 2 `GET` list, `PATCH/DELETE /feedback/:id`, `GET projects/:projectId/ai-quality-metrics`; `finding-feedback.schema.ts`, `feedback.repository.ts`, `feedback.mapper.ts`.
- **Quy tắc**: cấm `admin` thao tác nhóm nhận xét (`FB-*`).

### 5.11. Audit — nhật ký thay đổi

- **Application**: `audit/application/commands/log.handler.ts` (`LogHandler`).
- **Domain**: `audit-logger.port.ts` (facade port) + `audit.repository.port.ts`.
- **Infrastructure**: `audit-logger.adapter.ts` (cầu nối port → `LogHandler`), `audit.repository.ts`, `audit-log.schema.ts` (5 index theo `actor_id/target_type+target_id/workspace_id/action/created_at`).
- **Module** `@Global`? không — export `AUDIT_LOGGER_PORT` để module khác ghi log.

### 5.12. Overview — tổng quan người dùng / workspace

- **Application**: `overview/application/queries/get-user-overview.handler.ts`, `get-workspace-overview.handler.ts`.
- **Infrastructure**: `overview.controller.ts` (`GET /overview/workspaces`, `GET /workspaces/:id/overview`).
- **Mục đích**: màn hình dashboard tổng quan — số workspace sở hữu / được chia sẻ / số project, thống kê dataset & phân tích theo workspace.

### 5.13. Realtime — giữ kết nối + đẩy sự kiện

- **Application**: `realtime.service.ts` (giữ `Server`, implement `REALTIME_PORT` + `REALTIME_TRANSPORT_PORT`, `safeEmit` try/catch + `SOCKET_ENABLED`), `realtime-auth.service.ts` (trích/xác thực token → `{userId,email,role}`).
- **Domain**: `realtime-events.ts` (`RealtimeRooms`, 7 event, `RealtimeEnvelope`, `assertNoSensitiveData`, `buildEnvelope`), `REALTIME_PORT`.
- **Infrastructure**: `realtime.gateway.ts` (`path /api/v1/realtime`, `websocket+polling`, `pingInterval 25s`, events `connected/joinProject/leaveProject/joinAnalysis/leaveAnalysis`).
- **Module** `@Global`**, mọi service tiêm `@Optional() REALTIME_PORT` không sợ vòng lặp.

### 5.14. Shared — nền dùng chung

- `casl/`: factory, guards, decorators, subject helper.
- `database/`: `DatabaseModule(@Global)`, `BaseMongoRepository`, `MongooseTransactionService`, transaction/session-context.
- `storage/`: `StorageModule(@Global)`, `STORAGE_PORT`.
- `application/outbox/`: `OutboxModule`, `OUTBOX_PORT`, `OutboxRelayService`, `InboxService` (idempotency).
- `events/`: `EventsModule`, `EventDispatcherService` (`EVENT_PUBLISHER_PORT`), `KafkaConsumerService`.
- `config/crypto/filters/guards/interceptors/middleware/pagination/pipes/swagger/utils/validation/decorators`: dùng chung toàn hệ thống.
- `SharedModule(@Global)` nhập/xuất `DatabaseModule+StorageModule+CaslModule`.

---

## 6. CÁC LOẠI TEST NÀO, TEST NHƯ THẾ NÀO

### 6.1. Tổng quan

- **Công cụ**: `jest@^30.4.2`, `ts-jest@^29.4.9`, `supertest@^7.0.2`, `@nestjs/testing`, `@types/jest@^30.0.0`.
- **Quy mô đã kiểm chứng (21/11/2026):** **74 file test · 1 277 ca · 0 fail**; `tsc --noEmit` **0 lỗi**; `eslint --max-warnings 0` **0 cảnh báo**.
  - `pnpm test` (unit + arch) → **67 suites / 1 069 ca PASS**.
  - `pnpm run test:arch` → **5 suites / 23 ca PASS** (`zero-any`, `guard-coverage`, `zod-openapi`, `clean-architecture`, `api-contract-coverage`).
  - `pnpm run test:integration` → **7 suites / 138 ca PASS** (cần `pnpm test:infra:up`).
  - `pnpm run test:e2e` → **5 suites / 70 ca PASS** (cần hạ tầng).
  - Tổng: **79 suites / 1 277 ca PASS**.
- **Lệnh phân loại** (`package.json`):
  - `test` / `test:watch` / `test:cov`: chạy mặc định.
  - `test:e2e`: theo `test/jest-e2e.json`.
  - `test:unit`: toàn bộ **trừ** `zero-any|guard-coverage|zod-openapi|clean-architecture`.
  - `test:arch`: **chỉ** 4 spec kiến trúc trên.
  - `test:all = test:unit && test:arch && test:e2e`.
  - `test:security`: chỉ `test/e2e/security`.
- **Cách viết chung**: `Test.createTestingModule({ providers: [Service, { provide: PORT_SYMBOL, useValue: mock }] })`, không dùng Mongo thật trong unit, `expect` kết quả + `toHaveBeenCalledWith` kiểm tra port được gọi đúng tham số.

### 6.2. Test đơn vị thuật toán domain — kiểm tra thế nào

| File | Đối tượng | Cách kiểm tra | Số ca |
|---|---|---|---|
| `analysis-wave5.spec.ts` | `dq.util` (thiếu/trùng/sai kiểu/outlier), `stats.util` (mô tả/mất cân bằng/chuỗi thời gian) | Truyền mảng dòng giả, assert `missingCount/duplicateGroups/fullyMissingRows`, `0/false/'NA'` không tính thiếu | 17 |
| `corr-vif-ai.spec.ts` (trong `analysis/domain`) | `correlation/vif/ai-grounding.util` | Truyền ma trận giả, assert Pearson/Spearman, VIF, `groundAiAssessment` đúng/sai theo schema strict | 32 |
| `mask-pii.spec.ts` | `mask-pii.ts`, `pii-mask.util.ts` | Truyền email/SĐT/CCCD + cột PII, assert che `***`, ô không che được bị loại khỏi prompt | 4 |
| `crypto.spec.ts` | `crypto.util` SHA-256/stream | Băm chuỗi + `Readable`, assert ổn định, khác input khác hash, stream không lỗi | 8 |
| `device-detector.spec.ts` | `device-detector.util` | Truyền UA Chrome/Windows/mobile, assert tên thiết bị đúng | 10 |

### 6.3. Test service theo port (mock biên ngoài) — kiểm tra thế nào

| File | Đối tượng | Cách kiểm tra | Số ca |
|---|---|---|---|
| `datasets-ingestion.spec.ts` | `IngestDatasetStreamHandler` | Mock `DATASET/STORAGE/OUTBOX_PORT` + `ProjectsService`, stream CSV giả qua `Readable`, assert checksum/quota/`bulkInsert`/rollback/outbox | 4 |
| `datasets-wave4.spec.ts` | CRUD + schema datasets | Mock repo/storage, assert `rowCount/columnCount/originalName/dataType/missingCount`, đổi tên `cN`, reset cột | 8 |
| `data-view.spec.ts` | `DataViewService` keyset/query | Mock `RECORD_QUERY + DATASET_PORT`, assert `rowIndex/meta.nextCursor/meta.hasMore`, 14 toán tử, sort, search | 9 |
| `projects.spec.ts` | `ProjectsService` + ràng buộc 1 project–1 dataset | Mock 3 ports, assert tạo/liệt kê, `NotFoundException` khi sai id | 10 |
| `workspaces.spec.ts` | `WorkspacesService` CRUD + thành viên | Mock 2 ports, assert `ownerId`, add/remove, `Conflict/BadRequestException` | 13 |
| `notifications-issues-wave6.spec.ts` | Notify + Issues | Mock 4 ports, assert unread count, mark-read, chuyển trạng thái có `expectedVersion` | 9 |
| `feedback-wave7.spec.ts` | `FeedbackService` + RAG | Mock repo/Analysis/Projects/Workspaces/Users, assert bắt buộc `reason`, ánh xạ nhãn, trust score | 13 |
| `realtime.spec.ts` | `RealtimeService` + envelope | Assert `buildEnvelope/RealtimeRooms`, `assertNoSensitiveData` chặn `reason/email/value` | 5 |
| `storage.spec.ts` | `StorageService` 2 chế độ | Mock `ConfigService`, assert local khi trống `S3_ENDPOINT`, cloud khi đủ endpoint, upload/download stream | 2 |

### 6.4. Test phân quyền + kiến trúc — kiểm tra thế nào

| File | Đối tượng | Cách kiểm tra | Số ca |
|---|---|---|---|
| `casl.spec.ts` | `CaslAbilityFactory` | Dựng user `admin/ws-owner/ws-member`, assert `ability.can(Action,Subject)` đúng/sai workspace | 4 |
| `guard-coverage.spec.ts` | Mọi controller | Quét metadata route, trừ `@Public()` đều phải có `JwtAuthGuard`, route nhạy cảm phải có `PoliciesGuard/RolesGuard`, thiếu là fail | 1 |
| `zero-any.spec.ts` | Toàn `src/scripts/test` | Quét từng dòng (trừ comment), regex `: any|as any|Array<any>|Record<.*,any>`, liệt kê đúng file:dòng | 1 |
| `zod-openapi.spec.ts` | `zodToOpenApiSchema` | Truyền Zod mẫu, assert ra đúng `type/properties/required/enum`, Swagger không sai | 1 |
| `clean-architecture.spec.ts` | **Quy tắc phụ thuộc tầng** | Quét import trong domain/application/infrastructure, chặn framework lọt vào domain, chặn import chéo module | 13 |

### 6.5. Test theo đợt triển khai (Bước 1–6)

| File | Đối tượng | Số ca |
|---|---|---|
| `step1-remember-me-and-issue-needs-info.spec.ts` | Remember-me TTL 30 ngày + `last_used_at`; vòng đời issue `needs_info` + quyền sửa của user | 16 |
| `step1-services.spec.ts` | Service dùng chung (audit facade, overview, admin users) | 15 |
| `step3-efgh.spec.ts` | Nhóm E/F/G/H: audit log, overview, admin users, PDF/attachment, event bus | 34 |
| `step6-google-oauth.spec.ts` | Google OAuth: `state` CSRF, verify RS256, `409` khi email đã tồn tại, `501` khi thiếu credential | 10 |
| `keyset-pagination.spec.ts` | Keyset cursor trên toàn bộ endpoint danh sách | 23 |

### 6.6. Cách đọc kết quả đỏ + quy tắc mở rộng

- Thiếu `provide(PORT_SYMBOL)` trong `TestingModule` → Nest báo thiếu dependency (lỗi wiring, không phải logic).
- Sai mapper → `rowIndex/camelCase` lệch (lỗi infrastructure).
- Thêm module mới phải thêm 3 thứ: test domain (util/VO), test service (mock port), bổ sung route vào `guard-coverage` nếu controller mới thiếu guard.
- **Cấm** Mongo/S3 thật trong unit; mọi biên ngoài mock qua port — đúng tinh thần Hexagonal.

---

## 7. ĐỐI CHIẾU HIỆN TRẠNG SAU BƯỚC 1–8

| Hạng mục | Trước (12/11/2026) | Hiện tại (16/11/2026) | Nguồn |
|---|---|---|---|
| File mã nguồn `src/` | 203 | **370** | `find src -name "*.ts"` |
| Handler Command/Query | 0 | **107** (61 command + 46 query) | `find src -name "*.handler.ts"` |
| Module nghiệp vụ | 11 | **13** (+ Audit, + Overview) | `src/modules/*` |
| Port Symbol | 17 | **22** (+ `GOOGLE_OAUTH_PORT`, `AUDIT_*`, `*_ACCESS_PORT`, `RAG_FEW_SHOT_PORT`, `EVENT_PUBLISHER_PORT`, `REALTIME_TRANSPORT_PORT`) | `find src -name "*.port.ts"` |
| Controller HTTP | 12 | **15** | `find src -name "*.controller.ts"` |
| Route HTTP thực thi | — | **84** (khớp 1-1 hợp đồng §3.13) | `pnpm arch:api-coverage` |
| Collection / schema | 19 | **19 file schema Mongoose** | `find src -name "*.schema.ts"` |
| File test | 17 | **74** | `find . -name "*.spec.ts" -not -path "*/node_modules/*"` |
| Ca test tự động | 145 | **1 277** (1 069 unit/arch + 138 integration + 70 e2e) | `pnpm test` + `test:integration` + `test:e2e` |
| Quy tắc kiểm thử | 122 | **143** (135 tự động + 8 thủ công) | `13_testing_acceptance_plan_v9.md` |
| Lint | có warning | **`--max-warnings 0`, 0 cảnh báo** | `pnpm run lint` |
| Type-check | 0 lỗi | **0 lỗi** | `pnpm run type-check` |
| Google OAuth | stub | **Authorization Code flow thật** (CSRF `state`, RS256/JWKS, `409` khi trùng email) | `login-with-google.handler.ts`, `google-oauth.adapter.ts` |
| Remember-me | chưa có | **cờ `remember_me` + TTL 30 ngày + `last_used_at`** | `session-policy.vo.ts`, `user-session.schema.ts` |
| Issue `needs_info` | chưa có | **vòng đời 5 trạng thái + quyền sửa của user** | `issue-status.vo.ts`, `update-my-report.handler.ts` |
| Keyset pagination | chỉ data-view | **toàn bộ endpoint danh sách** | `keyset-pagination.spec.ts` |
| Biến môi trường | 39 | **73** trong schema, **43** trong `.env.example` | `env.validation.ts`, `.env.example` |

---

## 8. KẾT LUẬN

**Đã đạt:**
- Hexagonal 3 tầng nghiêm ngặt với **107 Command/Query Handler**, quy tắc phụ thuộc tầng cưỡng chế bằng ESLint type-aware rules **và** test kiến trúc.
- **1 277 ca test PASS** (1 069 unit/arch + 138 integration + 70 e2e), `tsc --noEmit` 0 lỗi, `eslint --max-warnings 0` 0 cảnh báo.
- Google OAuth 2.0 thật (Authorization Code + CSRF `state` + RS256/JWKS), remember-me 30 ngày, keyset pagination toàn hệ thống, trạng thái `needs_info` cho issue report.
- AI cục bộ có căn cứ (grounded), không rò PII, không gọi API công cộng.
- Streaming 50MB không nạp RAM, quota 2 lớp, outbox retry 5, worker lease + heartbeat.

**Hướng mở rộng:**
- Bổ sung 33 biến nhóm AI/Worker/Kafka/Redis vào `.env.example` để người mới clone không gặp lỗi schema khi boot.
- Bật Redis cache + rate-limit theo endpoint + Socket.IO adapter khi chạy nhiều instance.
- Vector DB riêng khi few-shot vượt 50.000 mẫu.
- Tách worker ra tiến trình riêng (`WORKER_MODE`) khi tải cao.
- E2E qua Cloudflare Tunnel + k6 tải ingestion/analysis.
