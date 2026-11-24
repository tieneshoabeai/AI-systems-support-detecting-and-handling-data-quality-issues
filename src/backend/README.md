# Backend — Nền Tảng Quản Lý Chất Lượng Dữ Liệu Bằng AI

API NestJS cho nền tảng quản lý và giám sát chất lượng dữ liệu có AI hỗ trợ.

| | |
|---|---|
| Framework | NestJS 11 (`^11.1.21`) |
| Ngôn ngữ | TypeScript 6 (`npm:@typescript/typescript6@^6.0.2`, `strict`) |
| Quản lý gói | pnpm 11.3.0 (`packageManager`) |
| Tên gói | `ai-data-quality-backend` |
| Phiên bản | 1.1.0 |

> README này mô tả **backend** (`src/backend`). Kiến trúc tổng thể nằm ở [`README.md`](../../README.md).

---

## 1. Cài đặt nhanh

```bash
cd src/backend
pnpm install
cp .env.example .env
# Sửa .env: MONGODB_URI, JWT_ACCESS_SECRET, JWT_REFRESH_SECRET, DATA_ENCRYPTION_KEY

pnpm start:dev          # API + watch, http://localhost:3000
pnpm start:worker:dev   # Worker (outbox relay + AI + report)
```

Swagger: `http://localhost:3000/api/v1/docs` (thực tế là `${API_PREFIX}/docs`, mặc định `api/v1/docs`).

Hạ tầng phụ trợ cho test:

```bash
pnpm test:infra:up      # MongoDB replica set (27018) + Redis (6380) + MinIO (9002/9003)
pnpm test:infra:down    # Dọn dẹp
```

---

## 2. Biến môi trường

`.env.example` là nguồn chuẩn (10 nhóm: server, MongoDB, R2, JWT, Gemini, Google OAuth, realtime, email, ntfy, bootstrap). Biến bắt buộc (kiểm tra fail-fast lúc khởi động):

| Biến | Yêu cầu |
|---|---|
| `MONGODB_URI` | Chuỗi kết nối MongoDB |
| `JWT_ACCESS_SECRET` | Tối thiểu 32 ký tự |
| `JWT_REFRESH_SECRET` | Tối thiểu 32 ký tự |
| `DATA_ENCRYPTION_KEY` | 64 ký tự hex (AES-256-GCM) |

Biến vận hành đáng chú ý:

| Biến | Mặc định | Tác dụng |
|---|---|---|
| `PORT` / `SSL_PORT` | `3000` / `443` | Cổng HTTP / HTTPS |
| `API_PREFIX` | `api/v1` | Tiền tố route (`${API_PREFIX}/docs` là Swagger) |
| `CORS_ORIGIN` | `http://localhost:5173` | CORS cho frontend |
| `WORKER_MODE` | `all` | Worker đọc để quyết định chạy background job |
| `OUTBOX_RELAY_ENABLED` | `true` | Bật outbox relay (quét mỗi 30 giây) |
| `KAFKA_BROKERS` | rỗng | Rỗng → publisher trong tiến trình; có giá trị → Kafka |
| `AI_MIN_RAM_GB` / `AI_RAM_GUARD_PERCENT` | `4` / `90` | Ngưỡng RAM nhận job AI |
| `ANALYSIS_MAX_ROWS` | `100000` | Số dòng tối đa đưa vào prompt AI |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | rỗng | Bootstrap admin một lần (idempotent, không ghi đè) |
| `S3_ENDPOINT` | — | Endpoint R2; để trống → lưu local `storage/` |
| `SOCKET_ENABLED` | `true` | Bật realtime Socket.IO |
| `GOOGLE_CLIENT_ID/SECRET/REDIRECT_URI` | — | Cả 3 phải có thì `GET /auth/google` mới chạy |

---

## 3. Cấu trúc mã nguồn (thực tế)

```text
src/backend/
├── src/
│   ├── main.ts            # Bootstrap HTTP: trust proxy, helmet, cookie-parser,
│   │                      #   Redis adapter (dự phòng IoAdapter), prefix, Swagger
│   ├── worker.ts          # createApplicationContext, giữ process cho outbox relay
│   ├── app.module.ts      # 13 module nghiệp vụ + Shared/Database/Outbox/Events/Storage + Throttler
│   ├── app.controller.ts  # Health check gốc
│   ├── modules/           # 13 module (analysis, audit, auth, data-view, datasets,
│   │                      #   feedback, issues, notifications, overview, projects,
│   │                      #   realtime, users, workspaces) — xem src/modules/README.md
│   └── shared/            # domain/application/infrastructure/interfaces — xem src/shared/README.md
├── deploy/                # docker-compose.dev.yml / docker-compose.test.yml / mongo/init-replica-set.js
├── scripts/               # Khoảng 40 script: arch, codemod, infra, benchmark — xem scripts/README.md
├── test/                  # unit (67) + integration (7) + e2e (12) + k6 (5) — xem test/README.md
├── storage/               # Dự phòng local khi không có S3_ENDPOINT
├── .env.example
└── package.json
```

> Không phải module nào cũng đủ 4 tầng. `data-view`, `feedback`, `notifications`, `overview`, `audit`, `realtime` là dạng phẳng/service-based (không có `commands/queries`), chỉ các module CQRS (`auth`, `users`, `workspaces`, `projects`, `datasets`, `analysis`, `issues`) mới có handler.

---

## 4. Danh sách lệnh (lấy từ `package.json` thực tế)

### 4.1 Phát triển

| Lệnh | Tác dụng |
|---|---|
| `pnpm start` | `tsc -p tsconfig.build.json && nest start` |
| `pnpm start:dev` | Build rồi chạy watch |
| `pnpm start:debug` | `nest start --debug --watch` |
| `pnpm start:prod` | Chạy `dist/main` |
| `pnpm start:worker` | `nest start --entryFile worker` |
| `pnpm start:worker:dev` | Worker chế độ watch |
| `pnpm start:ssl` / `pnpm start:ssl:dev` | Tự sinh cert rồi chạy HTTPS |
| `pnpm build` | `nest build` |
| `pnpm format` | Prettier `src/**/*.ts test/**/*.ts` |
| `pnpm type-check` | `tsc --noEmit` |
| `pnpm lint` / `pnpm lint:fix` / `pnpm lint:ci` | ESLint `--max-warnings 0` |

### 4.2 Kiểm thử

| Lệnh | Tác dụng |
|---|---|
| `pnpm test` | Jest mặc định (unit + arch, **bỏ qua** `test/integration/`) |
| `pnpm test:watch` | Jest watch mode |
| `pnpm test:cov` / `pnpm test:cov:all` | Báo cáo độ phủ |
| `pnpm test:unit` | Chỉ unit (bỏ integration + 5 spec arch) |
| `pnpm test:arch` | Chỉ 5 spec kiến trúc (`zero-any`, `guard-coverage`, `zod-openapi`, `clean-architecture`, `api-contract-coverage`) |
| `pnpm test:integration` | Integration (`test/jest-integration.json`, `--runInBand`, timeout 60 giây) |
| `pnpm test:e2e` | E2E (`test/jest-e2e.json`, `.e2e-spec.ts`) |
| `pnpm test:security` | Chỉ E2E security (`test/e2e/security`) |
| `pnpm test:e2e:full` | Tự bật/hạ hạ tầng rồi chạy e2e |
| `pnpm test:all` | unit → arch → integration → e2e |
| `pnpm test:all:infra` | Tự bật/hạ hạ tầng rồi chạy `test:all` |
| `pnpm test:perf` | k6 smoke + journey + load + stress |
| `pnpm test:perf:smoke/journey/load/stress/latency` | Chạy riêng từng kịch bản k6 |
| `pnpm test:perf:staging` | Báo cáo hiệu năng staging (`scripts/perf-report.sh`) |
| `pnpm test:benchmark` | Benchmark Node (`test/benchmark/run-benchmark.mjs`) |

### 4.3 Kiểm tra kiến trúc

| Lệnh | Tác dụng |
|---|---|
| `pnpm arch:cross-imports` | Liệt kê import chéo module (`scripts/list-cross-module-imports.ts`) |
| `pnpm arch:api-coverage` | Đối chiếu hợp đồng API với mã nguồn (`scripts/check-api-coverage.cjs`) |
| `pnpm arch:baseline` | Sinh baseline kiến trúc (`test/fixtures/arch-baseline.json`) |
| `pnpm arch:verify-di` | Kiểm tra đồ thị phụ thuộc DI (`scripts/verify-di-graph.ts`) |

### 4.4 Cơ sở dữ liệu

| Lệnh | Tác dụng |
|---|---|
| `pnpm db:seed` | Nạp dữ liệu mẫu (`scripts/seed-initial-data.ts`) |
| `pnpm db:bootstrap` | Bootstrap database (index, collection) |
| `pnpm db:migrate:coerce` | Ép kiểu dữ liệu và dọn bản ghi mồ côi |
| `pnpm db:migrate:storage` | Chỉ migrate storage (`--only=storage`) |
| `pnpm db:reset:mongo` / `:storage` / `:all` | Reset theo phạm vi (`TARGET=...`) |
| `pnpm db:backup:mongo` / `:storage` | Sao lưu |
| `pnpm db:restore:mongo` | Khôi phục MongoDB (`scripts/restore-mongo.sh`) |

### 4.5 Benchmark và hạ tầng

| Lệnh | Tác dụng |
|---|---|
| `pnpm bench:models` / `:gold` / `:stats` / `:pareto` | Benchmark mô hình AI (`scripts/benchmark/`) |
| `pnpm test:infra:up` / `:down` | MongoDB replica set + Redis + MinIO cho test |
| `pnpm tunnel` / `:install` / `:start` | Cloudflare Tunnel |
| `pnpm ssl:generate` | Sinh chứng thư SSL tự ký (`scripts/generate-ssl-certs.sh`) |

---

## 5. Chất lượng mã nguồn

### 5.1 Kiểm tra bắt buộc trước khi commit

```bash
pnpm type-check && pnpm lint && pnpm test
```

### 5.2 Quy mô kiểm thử hiện tại (đếm từ mã nguồn)

| Chỉ số | Giá trị |
|---|---|
| Tệp spec dạng unit (`*.spec.ts`) | **76** (67 trong `test/unit/` + 7 trong `test/integration/` + 1 trong `src/` + 1 trong `scripts/benchmark/`) |
| Tệp E2E (`*.e2e-spec.ts`) | **12** (8 ở `test/e2e/` + 4 trong `test/e2e/security/`) |
| Suite unit | 67 (gom theo 14 thư mục domain trong `test/unit/`) |
| Cảnh báo ESLint | 0 (`--max-warnings 0`) |

> Số liệu pass/fail thay đổi theo từng lần chạy — không ghi số cứng ở đây. Chạy `pnpm test`, `pnpm test:integration`, `pnpm test:e2e` để lấy số thật.

### 5.3 Vì sao `pnpm test` không chạy integration?

`package.json` khai báo `testPathIgnorePatterns` chứa `<rootDir>/test/integration/`. Các test integration dùng chung một database MongoDB test; chạy song song nhiều worker sẽ gây tranh chấp khi xóa collection. Vì vậy:

- `pnpm test` → unit + arch (nhanh, không cần hạ tầng).
- `pnpm test:integration` → chạy riêng, `--runInBand`, timeout 60 giây, cần `pnpm test:infra:up`.

---

## 6. Điểm khởi động (thực tế)

### 6.1 `src/main.ts`

1. Trust proxy Cloudflare (`trust proxy = 1`), `helmet` (HSTS + CSP), `cookieParser()` (bắt buộc cho `google_oauth_state`).
2. Redis adapter nếu có (`useRedisAdapterIfConfigured`), không thì `IoAdapter` bộ nhớ.
3. Prefix từ `API_PREFIX` (mặc định `api/v1`), `ZodValidationPipe` toàn cục, `AllExceptionsFilter` + `TransformInterceptor`/`LoggingInterceptor`.
4. Swagger tại `${apiPrefix}/docs` (tiêu đề `AI-Driven Data Quality Management Platform API`, có `addBearerAuth`, server `/` + localhost + tunnel URL).
5. SSL tùy chọn qua `SSL_ENABLED`, đọc cert từ `SSL_KEY_PATH`/`SSL_CERT_PATH`.

### 6.2 `src/worker.ts`

`createApplicationContext(AppModule)` (không có HTTP server). Giữ process sống cho `OutboxRelayService` (quét mỗi 30 giây) + AI/report worker theo event. Xử lý `SIGTERM`/`SIGINT` êm.

### 6.3 `src/app.module.ts`

- 13 module nghiệp vụ: `Users`, `Auth`, `Workspaces`, `Projects`, `Datasets`, `DataView`, `Analysis`, `Notifications`, `Issues`, `Feedback`, `Realtime`, `Audit`, `Overview`.
- Hạ tầng dùng chung: `SharedModule`, `DatabaseModule` (Mongoose), `OutboxModule`, `EventsModule`, `StorageModule` (S3/R2 hoặc local), `ConfigModule` (kiểm tra Zod lúc khởi động), `ThrottlerModule` (200 req/phút, endpoint nhạy cảm giảm xuống 5–10 req/giờ).
- `RequestIdMiddleware` gắn `X-Request-Id` cho mọi request.

---

## 7. Bảo mật

| Cơ chế | Thư viện / tệp (thực tế) |
|---|---|
| Xác thực JWT | `JwtAuthGuard`, Passport (`modules/auth/infrastructure/auth/jwt.strategy.ts`) |
| Phân quyền ABAC 2 tầng | `PoliciesGuard` + `@casl/ability` (`shared/interfaces/casl/`) |
| Băm mật khẩu | `bcrypt` (`SALT_ROUNDS=12`, `select: false`) |
| Mã hóa khóa refresh | SHA-256 chỉ lưu hash, nguồn thật là `user_sessions.expires_at` |
| Chống IDOR | Guard + CASL + policy loader nạp resource động |
| Bảo vệ header | `helmet`, HSTS, CSP |
| Giới hạn tốc độ | `@nestjs/throttler` |
