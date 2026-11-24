# Backend - AI Data Quality Platform

API NestJS cho nền tảng quản lý & giám sát chất lượng dữ liệu có AI hỗ trợ.

| | |
|---|---|
| Framework | NestJS 11 |
| Ngôn ngữ | TypeScript 6.0.2 (`strict`) |
| Runtime | Node.js 22 LTS |
| Quản lý gói | pnpm 11.3.0 |
| Package name | `ai-data-quality-backend` |
| Version | 1.1.0 |

> README này mô tả **backend**. Kiến trúc tổng thể của cả dự án nằm ở [`README.md`](../../README.md).

---

## 1. Cài đặt nhanh

```bash
cd src/backend
pnpm install
cp .env.example .env
# Chỉnh .env: MONGODB_URI, JWT_ACCESS_SECRET, JWT_REFRESH_SECRET, DATA_ENCRYPTION_KEY

pnpm start:dev          # API + watch, http://localhost:3000
pnpm start:worker:dev   # Worker (outbox relay + AI + report)
```

Swagger: `http://localhost:3000/api/v1/docs`

Hạ tầng phụ trợ cho test:

```bash
pnpm test:infra:up      # MongoDB replica set + Redis + MinIO
pnpm test:infra:down    # Dọn dẹp
```

---

## 2. Biến môi trường

`.env.example` là nguồn chuẩn. Biến bắt buộc:

| Biến | Yêu cầu |
|---|---|
| `MONGODB_URI` | Chuỗi kết nối MongoDB |
| `JWT_ACCESS_SECRET` | ≥ 32 ký tự |
| `JWT_REFRESH_SECRET` | ≥ 32 ký tự |
| `DATA_ENCRYPTION_KEY` | 64 ký tự hex (AES-256-GCM) |

Biến vận hành đáng chú ý:

| Biến | Mặc định | Tác dụng |
|---|---|---|
| `PORT` | `3000` | Cổng HTTP |
| `API_PREFIX` | `api/v1` | Tiền tố route |
| `WORKER_MODE` | `all` | `api` = chỉ HTTP; `all` = HTTP + background jobs |
| `OUTBOX_RELAY_ENABLED` | `true` | Bật outbox relay |
| `KAFKA_BROKERS` | rỗng | Rỗng → in-process publisher; có giá trị → Kafka |
| `AI_MIN_RAM_GB` | `4` | Ngưỡng RAM tối thiểu để nhận job AI |
| `AI_RAM_GUARD_PERCENT` | `90` | Ngưỡng % RAM hệ thống để dừng nhận job AI |
| `ANALYSIS_MAX_ROWS` | `100000` | Số dòng tối đa đưa vào prompt AI |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | rỗng | Bootstrap admin 1 lần lúc khởi động |
| `S3_ENDPOINT` | - | R2 endpoint; để trống → lưu local `storage/` |

Biến kiểm thử và hiệu năng: xem `.env.example` phần 8-12.

---

## 3. Cấu trúc mã nguồn

```text
src/backend/
├── src/
│   ├── main.ts            # Bootstrap HTTP: Swagger, helmet, CORS, validation pipe
│   ├── worker.ts          # Bootstrap tiến trình worker
│   ├── app.module.ts      # Root module: 13 module nghiệp vụ + hạ tầng
│   ├── modules/           # 13 module nghiệp vụ
│   ├── shared/            # Lớp cross-cutting (xem src/shared/README.md)
│   └── test/              # 74 file spec
├── deploy/                # docker-compose.dev.yml / docker-compose.test.yml
├── scripts/               # Script vận hành, kiểm thử, benchmark
├── test/                  # Unit, arch, integration, e2e, k6
├── .env.example
└── package.json
```

Mỗi module nghiệp vụ tuân theo **Clean Architecture 4 tầng**: `domain` → `application` → `infrastructure` → `presentation`. Chi tiết quy tắc phụ thuộc ở [README gốc, mục 5.1](../../README.md#51-clean-architecture-4-tầng).
## 4. Danh sách lệnh

### 4.1 Phát triển

| Lệnh | Tác dụng |
|---|---|
| `pnpm start` | Build rồi chạy |
| `pnpm start:dev` | Build rồi chạy watch |
| `pnpm start:debug` | Chế độ debug Node |
| `pnpm start:prod` | Chạy `dist/main` |
| `pnpm start:worker` | Chạy tiến trình worker |
| `pnpm start:worker:dev` | Worker chế độ watch |
| `pnpm start:ssl` / `pnpm start:ssl:dev` | Chạy qua HTTPS (tự sinh cert) |
| `pnpm build` | `nest build` |
| `pnpm format` | Prettier |
| `pnpm type-check` | `tsc --noEmit` |
| `pnpm lint` / `pnpm lint:fix` / `pnpm lint:ci` | ESLint (`--max-warnings 0`) |

### 4.2 Kiểm thử

| Lệnh | Tác dụng |
|---|---|
| `pnpm test` | Jest mặc định (unit + arch, **bỏ qua** `test/integration/`) |
| `pnpm test:watch` | Jest watch mode |
| `pnpm test:cov` | Báo cáo độ phủ |
| `pnpm test:unit` | Chỉ unit test |
| `pnpm test:arch` | Chỉ test kiến trúc |
| `pnpm test:integration` | Integration (cần hạ tầng, `--runInBand`) |
| `pnpm test:e2e` | E2E (`test/jest-e2e.json`) |
| `pnpm test:security` | E2E security suite |
| `pnpm test:all` | unit → arch → integration → e2e |
| `pnpm test:all:infra` | Tự bật/hạ hạ tầng rồi chạy `test:all` |
| `pnpm test:perf` | k6 smoke + stress |
| `pnpm test:benchmark` | Benchmark Node |

### 4.3 Kiểm tra kiến trúc

| Lệnh | Tác dụng |
|---|---|
| `pnpm arch:cross-imports` | Liệt kê import chéo module |
| `pnpm arch:api-coverage` | Đối chiếu hợp đồng API §3.13 với mã nguồn |
| `pnpm arch:baseline` | Sinh baseline kiến trúc |
| `pnpm arch:verify-di` | Kiểm tra đồ thị phụ thuộc DI |

### 4.4 Database

| Lệnh | Tác dụng |
|---|---|
| `pnpm db:seed` | Nạp dữ liệu mẫu |
| `pnpm db:bootstrap` | Bootstrap database (index, collection) |
| `pnpm db:migrate:coerce` | Ép kiểu dữ liệu & dọn orphan |
| `pnpm db:migrate:storage` | Chỉ migrate storage |
| `pnpm db:reset:mongo` / `:storage` / `:all` | Reset theo phạm vi |
| `pnpm db:backup:mongo` / `:storage` | Sao lưu |
| `pnpm db:restore:mongo` | Khôi phục MongoDB |

### 4.5 Benchmark & hạ tầng

| Lệnh | Tác dụng |
|---|---|
| `pnpm bench:models` | Benchmark mô hình AI |
| `pnpm bench:gold` | Mô tả bộ dữ liệu vàng |
| `pnpm bench:stats` | So sánh kết quả giữa các mô hình |
| `pnpm bench:pareto` | Phân tích đường Pareto |
| `pnpm test:infra:up` / `:down` | MongoDB replica set + Redis + MinIO cho test |
| `pnpm test:perf:staging` | Báo cáo hiệu năng staging |
| `pnpm tunnel:install` / `pnpm tunnel` | Cloudflare Tunnel |
| `pnpm ssl:generate` | Sinh chứng thư SSL tự ký |

---

## 5. Chất lượng mã nguồn

### 5.1 Kiểm tra bắt buộc trước khi commit

```bash
pnpm type-check && pnpm lint && pnpm test
```

### 5.2 Kết quả kiểm thử hiện tại

| Chỉ số | Giá trị |
|---|---|
| Test pass | **1 277 / 1 277** |
| Suite | 79 (67 unit/arch + 7 integration + 5 e2e) |
| File spec | 74 (72 trong `test/` + 1 trong `src/` + 1 trong `scripts/benchmark/`) |
| Phủ câu lệnh | 71.03% (8 796 / 12 383) |
| Phủ dòng | 72.05% (7 708 / 10 697) |
| Phủ nhánh | 58.33% (4 091 / 7 013) |
| Phủ hàm | 62.06% (1 361 / 2 193) |
| ESLint warning | 0 |
| TypeScript error | 0 |

Chi tiết theo tầng (mỗi tầng chạy bằng một lệnh riêng):

| Lệnh | Tầng | Suite | Test |
|---|---|---|---|
| `pnpm test` | unit + arch | 67 | 1 069 |
| `pnpm test:integration` | integration (cần hạ tầng) | 7 | 138 |
| `pnpm test:e2e` | e2e (cần hạ tầng) | 5 | 70 |
| **Tổng** | | **79** | **1 277** |

### 5.3 Vì sao `pnpm test` không chạy integration?

`package.json` khai báo `testPathIgnorePatterns` chứa `<rootDir>/test/integration/`. Các test integration dùng chung một database MongoDB test; chạy song song nhiều worker sẽ gây tranh chấp khi xoá collection. Vì vậy:

- `pnpm test` → unit + arch (nhanh, không cần hạ tầng).
- `pnpm test:integration` → riêng, `--runInBand`, timeout riêng, cần `pnpm test:infra:up`.

---

## 6. Điểm khởi động

### 6.1 `src/main.ts`

Bootstrap HTTP server: tạo `NestFactory` với logger, gắn `helmet`, `CORS` theo `CORS_ORIGIN`, `ZodValidationPipe` toàn cục, prefix `API_PREFIX`, bật Swagger tại `/api/v1/docs`, `shutdown hooks`.

### 6.2 `src/worker.ts`

Bootstrap bằng `createApplicationContext` (không có HTTP server). Đọc `WORKER_MODE` để quyết định chạy background job hay không, giữ tiến trình sống, đăng ký `SIGTERM`/`SIGINT` để đóng graceful.

### 6.3 `src/app.module.ts`

Root module khai báo 13 module nghiệp vụ (`UsersModule`, `AuthModule`, `WorkspacesModule`, `ProjectsModule`, `DatasetsModule`, `DataViewModule`, `AnalysisModule`, `FeedbackModule`, `IssuesModule`, `NotificationsModule`, `OverviewModule`, `RealtimeModule`, `AuditModule`) cùng các module hạ tầng dùng chung (`ConfigModule`, `MongooseModule`, `EventsModule`, `OutboxModule`, `CaslModule`).

---

## 7. Bảo mật

| Cơ chế | Thư viện / file |
|---|---|
| Xác thực JWT | `JwtAuthGuard`, `PassportStrategy` trong `modules/auth` |
| Phân quyền ABAC | `PoliciesGuard` + `@casl/ability` (`shared/interfaces/casl/`) |
| Băm mật khẩu | `bcrypt` (12 rounds) |
| Hash refresh token | SHA-256, lưu trong `user_sessions` |
| Mã hoá dữ liệu nhạy cảm | AES-256-GCM với `DATA_ENCRYPTION_KEY` |
| Header bảo mật | `helmet` |
| Validate input | `zod` qua `ZodValidationPipe` |
| Rate limit / lease | `ioredis` |
| Audit log | module `audit`, append-only |

Chi tiết phân quyền: [README gốc, mục 5.3](../../README.md#53-phân-quyền-casl-abac-2-tầng).

---

## 8. Tài liệu liên quan

| Tài liệu | Nội dung |
|---|---|
| [`README.md`](../../README.md) | Kiến trúc tổng thể dự án |
| [`src/shared/README.md`](src/shared/README.md) | Lớp cross-cutting, event bus, outbox/inbox |
| [`src/modules/*/README.md`](src/modules) | Đặc tả từng module nghiệp vụ |
| [`../../docs/restructures/7_api_contracts_v8.md`](../../docs/restructures/7_api_contracts_v8.md) | Hợp đồng API đầy đủ |
| [`../../docs/frontend-handover/README.md`](../../docs/frontend-handover/README.md) | Handoff cho team frontend |
| [`test/unit_test/README.md`](test/unit_test/README.md) | Kịch bản kiểm thử chi tiết |
| [`../../docs/test-reports/index.md`](../../docs/test-reports/index.md) | Kết quả benchmark & hiệu năng |
