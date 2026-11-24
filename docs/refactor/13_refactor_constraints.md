# 13. Ràng buộc refactor — Không được vi phạm khi flatten

> **Mục đích:** Khóa mọi điểm từng gây vỡ test, lệch API, hỏng framework/tunnel khi refactor. File `12_business_invariants.md` nói **giữ cái gì**; file này nói **không được làm gì + kiểm tra bằng gì**.
> **Cách dùng:** Trước mỗi commit, chạy checklist §13.6. Vi phạm 1 ràng buộc TC/AC/FC là revert, không debug quá 15 phút.

---

## 13.1. Ràng buộc test (TC) — refactor xong test phải xanh không sửa assert

- **TC-01 — Không sửa assert, chỉ sửa import path.** Mọi `*.spec.ts` giữ nguyên `expect()`. Chỉ đổi đường dẫn `../modules/...` khi file di chuyển. Assert sai là revert, không sửa test cho khớp code mới.
- **TC-02 — Giữ chữ ký `execute()` của 107 handler.** Kể cả chữ ký xấu cũng giữ: `UpdateMineHandler.execute(userId, roleOrId, idOrDto, dtoOrRole?)` (quá tải 4 tham số), `CreateSessionHandler.execute({user_id, refresh_token_hash, ...})` (snake_case), `MapPropsToOriginalNamesHandler.execute()` (không tham số). Đổi tên/thứ tự tham số là vỡ test gọi trực tiếp.
- **TC-03 — Giữ Symbol DI token + cơ chế `useExisting`/`useClass`.** Không đổi tên Symbol, không đổi `useExisting` thành `useClass` (và ngược lại). Đặc biệt: `RAG_FEW_SHOT_PORT → useExisting RagFewShotService`, `AiInferencePort → useClass LocalInferenceAdapter`, mọi `*_REPOSITORY_PORT → useExisting *Repository`.
- **TC-04 — Giữ đăng ký subscriber + `OnModuleInit`.** 3 subscriber (`cascade-dataset-event`, `cascade-project-event`, `realtime-revocation`) phải còn `registry.register()` trong `onModuleInit()` và còn trong `providers` của `*.module.ts`. Quên 1 dòng là cascade/realtime thu hồi không chạy mà unit test vẫn xanh, chỉ integration/E2E đỏ.
- **TC-05 — Giữ `resolveMongoSession` / `mongo-session-context`.** Repository nào đang truyền `session` thì sau khi gộp vào `*.repository.ts` vẫn phải truyền. Bỏ session là transaction mất tác dụng, test `open09-transaction-rollback` + `cascade-delete` đỏ.
- **TC-06 — Giữ `deleted_at: null` trong mọi query list/find.** Soft-delete là `deleted_at: Date | null` + index partial unique. Khi gộp mapper + repository không được bỏ điều kiện này, không được “làm sạch” nhánh tương thích camel/snake/ObjectId cũ trong `feedback.repository.ts`.
- **TC-07 — Không đụng `test/fixtures`, `test/helpers`, jest config.** Giữ `testRegex` của `jest-e2e.json` (`*.e2e-spec.ts`) và `jest-integration.json` (`test/integration/*.spec.ts`, `maxWorkers: 1`, timeout 60s). Không đổi `moduleNameMapper @/`.
- **TC-08 — Arch test phải được cập nhật đồng bộ (bản hybrid).** `clean-architecture.spec.ts` (CA1–CA11, CA20) **giữ hiệu lực bên trong 7 module Hexagonal**, không áp dụng cho 6 Simple. `modular-monolith.spec.ts` (MM1–MM4 + MM5') + `guard-coverage.spec.ts` (mọi endpoint phải có `JwtAuthGuard` hoặc `@Public()`) + `api-contract-coverage.spec.ts` phải xanh cho cả 13 module. Luật: service mới (`*.service.ts` của Simple) không import `HttpException`/`HttpStatus`; `shared/` không import từ `modules/`; cross-module chỉ qua `index.ts`; không chu trình; không SDK AI ngoài.
- **TC-09 — Hạ tầng test giữ nguyên cổng.** `test-infra-up.sh`: Mongo replica `rs0` @ 27018, Redis @ 6380, MinIO @ 9002 (console 9003). Không đổi cổng, không đổi biến `DQ_TEST_INFRA_DIR`. Chạy `test:infra:up → test:integration + test:e2e → test:infra:down` đúng thứ tự ở P7.

## 13.2. Ràng buộc API (AC) — 82 route + envelope + guard không đổi

- **AC-01 — 82 route bất biến (đối chiếu §12.1).** Không thêm/bớt/đổi prefix/method/path. Sau mỗi module chạy `arch:api-coverage` phải khớp 82. Riêng 2 bẫy thứ tự phải giữ khi gộp controller: `GET auth/sessions/me` trước `GET auth/sessions/:id`; `GET notifications/unread-count` trước `GET notifications/:id`.
- **AC-02 — Giữ `app.setGlobalPrefix('api/v1')` + exclude `health`, `health/ready`.** `AppController` giữ 2 endpoint `@Public()` ngoài prefix. Không chuyển health vào module.
- **AC-03 — Giữ envelope `TransformInterceptor`.** Mọi JSON trả `{success: true, data}`; không bọc lại nếu đã có `success/data`; không bọc file download (`Content-Disposition` hoặc `text/csv`). Khi gộp controller không được `return {success, data}` thủ công.
- **AC-04 — Giữ `AllExceptionsFilter` + `error-http-mapping`.** Thứ tự: `DomainError → StatusError.status` → `HttpException.getStatus()` → `ZodError → 400 VALIDATION_ERROR` → Mongo `11000 → 409 DUPLICATE_RESOURCE` → còn lại `500 INTERNAL_ERROR`. Không ném `HttpException` từ service (MM6/CA20); lỗi nghiệp vụ dùng `DomainError` + `code` ổn định.
- **AC-05 — Giữ validation Zod qua `ZodValidationPipe`.** DTO gộp vào `*.controller.ts` (template Simple) vẫn phải đi qua pipe; lỗi Zod bắn `{errors: [...]}` để filter map sang `VALIDATION_ERROR + {fields}`. Không thay bằng `class-validator`.
- **AC-06 — Giữ guard/policy/decorator từng route.** `@UseGuards(JwtAuthGuard, PoliciesGuard)` + cặp `@PolicyResource` + `@CheckPolicies` giữ nguyên thứ tự; `@Public()` chỉ ở register/login/google/forgot/reset + health; `@Roles('admin')` chỉ ở `admin/*`; `@Throttle` của auth (100–500/giờ) giữ nguyên; `RequestIdMiddleware.forRoutes('*')` giữ.
- **AC-07 — Giữ upload/download file.** `datasets` upload CSV + `issues` upload attachment dùng interceptor stream; không đổi thành `@Body()` JSON. Download giữ header `Content-Disposition` để interceptor không bọc envelope.
- **AC-08 — Giữ phân trang cursor + response shape.** `DEFAULT_RECORD_LIMIT=50`, `MAX_RECORD_LIMIT=500`, `normalizeRecordLimit()`; sort keyset nulls-last; `users/me/notification-preferences` vẫn nằm ở controller notifications (không chuyển sang users); `PUT projects/:id/snapshot` giữ PUT, không đổi PATCH.
- **AC-09 — Giữ Swagger/OpenAPI.** `DocumentBuilder` + `api-zod.decorator`/`zod-openapi` còn nguyên; tunnel truy cập `https://<tunnel-url>/api/v1/docs`. Không xóa `@ApiTags/@ApiOperation/@ApiResponse`.

## 13.3. Ràng buộc framework/hạ tầng (FC) — tunnel, worker, env, script

- **FC-01 — Giữ `AppModule` wiring.** Danh sách `imports` (Throttler 200/phút, Config, Shared, Database, Outbox, Events, Storage + 13 module) và `APP_GUARD ThrottlerGuard` giữ nguyên. `*.module.ts` sau flatten chỉ đổi đường dẫn import, không đổi `imports/exports/providers`. `AuditModule` vẫn `@Global()`.
- **FC-02 — Giữ `main.ts` bootstrap.** Thứ tự: trust proxy (Cloudflare) → helmet (HSTS) → `cookieParser()` (bắt buộc cho Google OAuth `google_oauth_state`) → CORS (`credentials: true`, cho `*.trycloudflare.com`, header `CF-Connecting-IP/CF-Ray`) → global prefix → `AllExceptionsFilter` → `TransformInterceptor + LoggingInterceptor` → Swagger. Đổi thứ tự là vỡ CORS/auth/log.
- **FC-03 — Giữ realtime adapter.** `useRedisAdapterIfConfigured()` còn nguyên; fallback `IoAdapter`; gateway giữ 4 message `joinProject/joinAnalysis/leaveProject/leaveAnalysis` + check trạng thái lúc handshake + `disconnectUser(userId, status)` idempotent, `extractUserId` chấp nhận cả `user_id`/`userId`.
- **FC-04 — Giữ `worker.ts`.** Entry `start:worker` chạy `OutboxRelayService` (30s) + AI/report workers theo event; giữ `WORKER_MODE=all`. Không gộp worker vào HTTP process.
- **FC-05 — Giữ `env.validation.ts` + tên script.** Không đổi tên biến (`PORT, API_PREFIX, MONGODB_URI, REDIS_URL, S3_*, JWT_*_SECRET (min 16), REFRESH 7d/30d, CLOUDFLARE_*, SSL_*, REPORT_WORKER_ENABLED`); không đổi tên script `tunnel/start-cloudflare-tunnel.sh` (đọc `PORT`), `test:infra:up/down`, `db:*`, `arch:*`, `start:ssl`, `bench:*`. Tunnel + `test-infra` độc lập với cấu trúc `modules/` nên không cần sửa khi flatten.
- **FC-06 — Giữ `StorageModule/OutboxModule/EventsModule` ở `shared`.** Upload dataset/issues, outbox relay, `hybrid/in-process/kafka publisher`, `event-dispatcher` không di chuyển vào module. `StorageService.getCloudStatus()` phục vụ `health/ready` giữ nguyên.

## 13.4. Ràng buộc nghiệp vụ dễ sót (BC) — đã đọc từ mã thật

- **BC-01 — datasets:** không đụng ingest 2 pha (delimiter `,`, giữ dòng rỗng, header trùng thành finding, batch 5000, sample 500); giữ `coerceValue` + `threshold 0.8` + `Asia/Ho_Chi_Minh`; giữ `Dataset.create→markReady/markFailed`; giữ `DatasetRecord` chỉ khai báo ở datasets; giữ `MapPropsToOriginalNames` là migration.
- **BC-02 — cascade:** `DeleteWorkspace/Project/Dataset` + `SoftDeleteUser/BlockUser` giữ trong cùng `tx.runInTransaction` với `recordEvent`; outbox strict (lỗi thì rollback), audit best-effort (lỗi thì warn). Không hoán đổi 2 cơ chế này.
- **BC-03 — policy/context:** 7 loader + 4 adapter giữ nguyên class/file riêng; token context nằm ở `shared`, module chỉ implement; `workspace-context.adapter` fail-safe giữ try/catch; `LocalInferenceAdapter` đọc `ConfigService` trực tiếp.
- **BC-04 — feedback/issues/notifications:** giữ `ensureNotAdmin`, `isObjectIdHex`, optimistic locking `expectedVersion`, title ≤200/desc ≤5000, 2 mapper notifications không gộp, 2 entity feedback chung 1 repository.
- **BC-05 — users/auth:** giữ `MAX_WORKSPACES_PER_USER=20` (chỉ tính owned, admin miễn), session 7 ngày / remember-me 30 ngày, password 8–100, refresh rotation, `rememberMe=false` mặc định, throttle auth.

## 13.5. Ràng buộc thao tác (PC) — làm sao để không trượt

- **PC-01 — Một module/một commit + tag.** Dùng `git mv` (không copy tay), xong 1 module chạy cổng kiểm soát rồi mới commit. Không gộp 2 module vào 1 commit.
- **PC-02 — Cổng kiểm soát trước mỗi commit:** `type-check 0` → `lint 0` → `jest` xanh → `arch:api-coverage 82/82` → `grep tên cũ = 0` → module phẳng (Simple) hoặc chuẩn hóa xong (Hexagonal) → ghi `notes.md`.
- **PC-03 — Test đỏ >15 phút thì revert về tag gần nhất**, ghi lý do vào `notes.md`, sang module khác. Không sửa assert để test xanh.
- **PC-04 — 7 module Hexagonal chuẩn hóa-only (mở rộng từ T3 move-only):** `git diff` của `analysis, auth, datasets, projects, workspaces, users, issues` chỉ được là chuẩn hóa import qua `index.ts` + README (không gộp entity/port/handler, không đổi logic). Có dòng `+`/`-` đổi logic là vi phạm, revert ngay.
- **PC-05 — Đường cắt (bản hybrid):** P5 → P4 → `feedback` → P3; P6 tài liệu không cắt; từ giờ 20 chỉ verify + polish.

## 13.6. Checklist khóa trước mỗi commit (tick hết mới được commit)

```
☐ TC: import path duy nhất đổi; Symbol/useExisting/useClass giữ; subscriber còn đăng ký; session còn truyền; deleted_at:null còn đủ
☐ AC: route đủ 82 + đúng thứ tự sessions/me, unread-count; guard/policy/public/roles/throttle giữ; envelope + filter + Zod giữ; upload/download giữ stream
☐ FC: AppModule/shared/main/worker/env/script giữ; tunnel + test-infra cổng giữ; realtime adapter giữ
☐ BC: ingest 2 pha + coerce + quota + TTL + password + expectedVersion + title/desc giữ (§12.6); cascade strict/outbox + audit best-effort giữ (§12.5)
☐ PC: 1 module/1 commit; type-check/lint/jest/coverage xanh; diff H chuẩn hóa-only (không gộp/đổi logic); notes.md đã ghi
```
