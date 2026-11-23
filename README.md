# NỀN TẢNG FULL-STACK QUẢN LÝ & GIÁM SÁT CHẤT LƯỢNG DỮ LIỆU CÓ AI HỖ TRỢ
### (AI Systems Support Detecting and Handling Data Quality Issues)

[![TypeScript](https://img.shields.io/badge/TypeScript-6.0.2_Strict-blue.svg)](https://www.typescriptlang.org/)
[![NestJS](https://img.shields.io/badge/Backend-NestJS_11-red.svg)](https://nestjs.com/)
[![Node](https://img.shields.io/badge/Node-22.22.3_LTS-green.svg)](https://nodejs.org/)
[![pnpm](https://img.shields.io/badge/pnpm-11.3.0-orange.svg)](https://pnpm.io/)

---

## 1. Định vị & Tuyên ngôn Giá trị

Trong kỷ nguyên Trí tuệ Nhân tạo và Ra quyết định dựa trên Dữ liệu, vấn đề **Dữ liệu rác vào - Kết quả rác ra** (Garbage In, Garbage Out) là rào cản lớn nhất của mọi kỹ sư và chuyên viên phân tích dữ liệu.

Hệ thống này giải quyết bài toán đó bằng 5 nguyên tắc thiết kế cốt lõi:

1. **Tiếp nhận Dữ liệu Chỉ-Đọc** - Streaming Ingestion `.csv` duy nhất, mức tiêu thụ RAM ≤ 20 MB; dữ liệu bất biến. Hệ thống **không sửa, xoá hay thay đổi** bất kỳ dòng/ô nào của dataset gốc.
2. **Khám phá & Thống kê Tốc độ cao** - Lưới dữ liệu ảo (Virtual Grid) phân trang con trỏ Keyset ≤ 50 ms cho hàng triệu dòng. Không `offset`, không `countDocuments`.
3. **AI Cục bộ** - Mô hình ngôn ngữ lớn chạy **nội bộ** qua `vLLM`/`Ollama`, **không** gọi API bên ngoài. 5 ứng viên đã benchmark trên 9 chỉ số chất lượng.
4. **Vòng lặp Người dùng - AI (Human-in-the-Loop)** - Mỗi kết quả AI có khối đánh giá để người dùng nhận xét; phản hồi lưu bất biến và được dùng để **AI học lại** qua RAG few-shot động.
5. **Sự kiện & Realtime** - **Kafka** làm event bus + hàng đợi nền (có dead-letter queue); **Socket.IO** đẩy thông báo và tiến độ tới client.

> **Lưu ý phạm vi dự án:** đây là **đồ án môn học** (đại học UTH), không phải hệ thống production. Thông tin trong README phản ánh đúng trạng thái mã nguồn hiện tại, không phải cam kết SLA vận hành.

---

## 2. Bức tranh Tổng quan Kiến trúc Toàn diện

Hệ thống được thiết kế theo mô hình **Modular Monolith** phân tầng rõ ràng, kết hợp lưu trữ đa mô hình (Polyglot Persistence) và phân tách giao dịch bất đồng bộ qua **Transactional Outbox Pattern**.
## 3. Cấu trúc Thư mục & Bản đồ Kiến trúc

```text
.
├── src/
│   ├── backend/                  # NestJS API
│   │   ├── src/
│   │   │   ├── main.ts            # Bootstrap HTTP server + Swagger + helmet + CORS
│   │   │   ├── worker.ts         # Bootstrap tiến trình worker (outbox + AI + report)
│   │   │   ├── app.module.ts      # Root module: 13 module nghiệp vụ + hạ tầng
│   │   │   ├── modules/           # 13 mô-đun nghiệp vụ (Clean Architecture)
│   │   │   │   ├── users/         # Tài khoản, phiên đăng nhập, quản trị
│   │   │   │   ├── auth/          # JWT, refresh, Google OAuth 2.0, đặt lại mật khẩu
│   │   │   │   ├── workspaces/    # Không gian làm việc + vai trò thành viên
│   │   │   │   ├── projects/      # Dự án + thành viên + snapshot + chuyển chủ sở hữu
│   │   │   │   ├── datasets/      # Tải lên CSV, schema, dòng dữ liệu, xoá dây chuyền
│   │   │   │   ├── data-view/     # Lưới ảo: records, query, stats, charts
│   │   │   │   ├── analysis/      # Phân tích DQ, AI job, báo cáo PDF, bản tóm tắt
│   │   │   │   ├── feedback/      # Phản hồi người dùng + chỉ số chất lượng AI
│   │   │   │   ├── issues/        # Báo cáo lỗi + tệp đính kèm + quản trị
│   │   │   │   ├── notifications/ # Thông báo + tùy chọn người dùng
│   │   │   │   ├── overview/      # Tổng quan workspace
│   │   │   │   ├── realtime/      # Socket.IO gateway + transport port
│   │   │   │   └── audit/         # Nhật ký kiểm toán (append-only)
│   │   │   ├── shared/            # Lớp cross-cutting: domain / application / infrastructure / interfaces
│   │   │   └── test/              # 74 tệp spec (unit + arch + integration + e2e)
│   │   ├── deploy/                # docker-compose.dev.yml, docker-compose.test.yml
│   │   ├── scripts/               # Kịch bản vận hành, kiểm thử, benchmark
│   │   └── package.json
│   ├── plan/                      # Tài liệu kế hoạch
│   ├── edit/                      # Tài liệu biên tập
│   └── reports/                   # Báo cáo sinh tự động (.docx)
├── docs/
│   ├── restructures/              # 12 tài liệu kiến trúc + hợp đồng API v8
│   ├── frontend-handover/         # Bàn giao API cho nhóm frontend
│   ├── modules/                   # Đặc tả theo mô-đun
│   ├── plan/                      # Đặc tả & kế hoạch triển khai
│   ├── report/                    # Báo cáo công nghệ kỹ thuật
│   └── test-reports/              # Kết quả benchmark & hiệu năng
└── remember/                      # Ghi chú làm việc cho AI agent
```
## 4. Công nghệ & Thư viện Sử Dụng

| Lớp | Công nghệ | Phiên bản | Vai trò |
|---|---|---|---|
| Ngôn ngữ | TypeScript | 6.0.2 | Strict mode, Zero-Any policy |
| Framework | NestJS | 11.x | DI, module, guard, interceptor, pipe |
| Runtime | Node.js | 22.22.3 LTS | API server + worker process |
| Quản lý gói | pnpm | 11.3.0 | Workspace, cài đặt nhanh |
| Validation | Zod | 3.23.x | Validate DTO tại biên, sinh lỗi 400 có cấu trúc |
| Phân quyền | CASL (@casl/ability) | 7.x | ABAC 2 tầng: static + dynamic instance check |
| NoSQL | Mongoose | 9.x | MongoDB driver + schema mapping |
| Object Storage | AWS SDK v3 (S3) | - | Cloudflare R2, fallback local `storage/` |
| Realtime | Socket.IO | 4.8.x | WebSocket gateway, phòng theo user/project/analysis |
| Event Bus | KafkaJS | 2.2.x | Kafka broker + consumer (tuỳ chọn) |
| Cache / Lease | ioredis | 6.x | Redis cho lease hàng đợi AI job, rate limit |
| Auth | Passport JWT + bcrypt | - | Access/refresh token, hash mật khẩu |
| Báo cáo | PDFKit | 0.20.x | Sinh báo cáo PDF kết quả phân tích |
| Test | Jest | 30.x | Unit, arch, integration, e2e |
| Lint | ESLint | 10.x | Flat config, `--max-warnings 0` |
| Docs | Swagger (@nestjs/swagger) | 11.x | OpenAPI tại `/api/v1/docs` |
## 5. Ràng buộc Chất lượng & Tiêu chuẩn Bất biến

### 5.1 Clean Architecture 4 tầng

Mỗi module nghiệp vụ tuân thủ cùng một bố cục:

```text
modules/<ten>/
├── domain/           # Lõi nghiệp vụ thuần: entity, value-object, port, event
│   ├── entities/     # Rich domain model - chứa luôn luật (invariant)
│   ├── value-objects/# VO bất biến: validate + chuẩn hoá
│   ├── ports/        # Interface (hexagonal port) - hợp đồng ra ngoài
│   ├── events/       # Domain event định nghĩa sự kiện nghiệp vụ
│   └── services/     # Hàm thuần dùng chung trong domain
├── application/      # Use case: command/query handler (CQRS), policy loader
│   ├── commands/     # Handler ghi (Create, Update, Delete...)
│   ├── queries/      # Handler đọc (Get, List...)
│   ├── services/     # Dịch vụ ứng dụng (cross-use-case)
│   └── policy-loaders/# Nạp resource cho @PolicyResource (chống IDOR)
├── infrastructure/   # Adapter kỹ thuật: MongoDB schema, repository, storage
└── presentation/     # Controller REST, DTO, response mapper
```

**Quy tắc phụ thuộc (bắt buộc nghiêm):**

| Mã | Quy tắc |
|---|---|
| CA1 | `domain` không import từ `application`, `infrastructure`, `presentation` |
| CA2 | `domain` không import framework (Mongoose, NestJS) |
| CA3 | `domain` không import module khác |
| CA4 | `application` chỉ import `domain` |
| CA5 | `shared` không import từ `modules` |
| CA6 | `infrastructure` được phép import `domain` |
| CA7 | `presentation` được phép import `application` |
| CA8 | Import chéo module phải qua file `index.ts` (public contract) |
| CA9 | `presentation` không chứa logic nghiệp vụ |
| CA10 | Repository chỉ được gọi từ `application`/`infrastructure` |
| CA11 | Không dùng `any` trong `domain` |
| CA12 | Không logic nghiệp vụ trong controller |
| CA13 | `shared/domain` không import framework |
| CA14 | `shared/domain` không import `shared/interfaces` |

Các quy tắc này được **kiểm chứng tự động** bằng `test/clean-architecture.spec.ts` và `scripts/check-cross-imports.cjs`.

### 5.2 Zero-Any Policy

- Bật `strict`, `noImplicitAny`, `noImplicitOverride`, `useUnknownInCatchVariables`, `noUnusedLocals`, `noUnusedParameters`, `noUncheckedIndexedAccess`.
- Mọi giá trị `unknown` từ framework đều được **thu hẹp kiểu** qua type guard tường minh trước khi dùng.
- `any` bị cấm trong `domain`; ESLint config chặn theo rule `@typescript-eslint/no-explicit-any`.
### 5.3 Phân quyền CASL ABAC 2 tầng

Hệ thống phân quyền theo **Attribute-Based Access Control** với hai tầng kiểm tra, cả hai đều do `PoliciesGuard` thực thi:

**Tầng 1 - Static check:** so khớp tên subject (`Workspace`, `Project`, `Dataset`...) với hành động (`read`, `create`, `update`, `delete`, `execute`, `export`).

**Tầng 2 - Dynamic check:** nạp resource thật qua `@PolicyResource(...)` + policy loader, sau đó kiểm tra **instance attribute** (`workspace_id`, `owner_id`...). Lớp này chính là lá chắn **IDOR** - người dùng không thể đổi `:id` trong URL để truy cập tài nguyên của người khác.

**Mô hình 3 tầng vai trò:**

| Tầng | Vai trò | Quyền |
|---|---|---|
| Hệ thống | `admin` / `analyst` | `admin` toàn quyền quản trị |
| Workspace | `owner` / `member` | WS-OWNER toàn quyền trên mọi project của workspace |
| Project | `owner` / `member` / `viewer` | PROJ-MEMBER ghi được; PROJ-VIEWER chỉ đọc |

Quy tắc suy ra vai trò project: WS-OWNER → PROJ-OWNER; có mặt trong `project.members` → lấy đúng vai trò ghi trong DB; WS-MEMBER mặc định → PROJ-VIEWER.

Hai **Context Port** giải quyết phần còn thiếu của mô hình này:

- `WORKSPACE_CONTEXT_PORT` - resolve vai trò workspace của user theo request.
- `PROJECT_CONTEXT_PORT` - resolve vai trò project của user theo request.

Cả hai adapter đều **fail-safe**: lỗi truy vấn trả về tập rỗng thay vì ném, để sự cố hạ tầng không chặn oan người dùng hợp lệ.

### 5.4 Giao dịch & Bất biến dữ liệu

- Dữ liệu dataset là **append-only**: chỉ ghi 1 lần lúc import, không có `deleted_at` / `version_number` trên `dataset_record`.
- Các thao tác xoá dùng **cascade** qua domain event (`cascade-project-datasets`, `cascade-dataset-event`), có bọc transaction MongoDB.
- Mọi entity có `deleted_at` cho **soft delete**; truy vấn mặc định luôn lọc `deleted_at: null`.
- Chỉ số unique là **partial index** (`deleted_at: null`) nên email đã xoá mềm vẫn có thể đăng ký lại.
## 6. Kiến trúc Sự kiện & Xử lý Bất đồng bộ

### 6.1 Transactional Outbox

Ghi dữ liệu nghiệp vụ và ghi event phải là **một giao dịch duy nhất**:

```text
Handler -> ghi entity + ghi outbox_events (cùng session) -> COMMIT
                                                        |
                                        OutboxRelayService (30s)
                                                        |
                                              EventPublisherPort
                                          /                  \
                              InProcessEventPublisher    KafkaEventPublisher
                              (mặc định, dev)            (khi có KAFKA_BROKERS)
```

`HybridEventPublisher` tự chọn theo biến môi trường: có `KAFKA_BROKERS` → Kafka, không có → in-process. Nhờ vậy hệ thống chạy được ở máy dev chỉ với MongoDB, nhưng vẫn dùng được Kafka ở môi trường đầy đủ mà không sửa code.

### 6.2 Inbox - Idempotency at-least-once

`InboxService` theo dõi cặp `(consumer_name, event_id)` kèm lease. Mỗi lần nhận event:

1. Thử **claim** lease cho cặp khoá đó.
2. Nếu đã xử lý → **bỏ qua** (idempotent).
3. Nếu lease còn hiệu lực của consumer khác → **bỏ qua** (đang xử lý).
4. Nếu mới → xử lý, sau đó đánh dấu `processed`.

### 6.3 Worker tách riêng

| Tiến trình | Lệnh | Vai trò |
|---|---|---|
| API | `pnpm start:prod` | Chỉ phục vụ HTTP, **không** chạy outbox relay |
| Worker | `pnpm start:worker` | Outbox relay + AI worker + report worker |

Biến `WORKER_MODE` điều khiển: `api` (chỉ HTTP) hoặc `all` (mặc định, chạy cả hai trong một tiến trình).

### 6.4 Guard tài nguyên máy (chống OOM)

`SystemResourceGuardAdapter` đọc `/proc/meminfo` và RSS của tiến trình. Khi RAM hệ thống thấp hơn `AI_MIN_RAM_GB` (mặc định 4 GB) hoặc vượt quá `AI_RAM_GUARD_PERCENT` (mặc định 90%), worker **từ chối nhận** job AI mới cho tới khi tài nguyên ổn định.

Song song, `ANALYSIS_MAX_ROWS` (mặc định 100 000) giới hạn số dòng đưa vào prompt, và `run-analysis.handler.ts` **đơn giản hoá bản sao trung gian** để giảm đỉnh RAM.

### 6.5 RAG few-shot động

Mỗi phản hồi người dùng về một finding được lưu bất biến. `rag-few-shot.util.ts` lọc theo `trust_score` và `max_age_days`, chuẩn hoá, loại bỏ định danh (`stripIdentifiers`), rồi chọn `top_k` ví dụ để chèn vào prompt của lần chạy sau. Đây là cơ chế **AI học lại từ người dùng** mà không cần huấn luyện lại mô hình.
## 7. Bảng API Tổng quan

Base URL: `/api/v1`. Toàn bộ **84 route** khớp 1-1 với hợp đồng `docs/restructures/7_api_contracts_v8.md` (kiểm chứng bằng `pnpm arch:api-coverage`).

| Nhóm | Route | Mô tả |
|---|---|---|
| Health | `GET /health`, `GET /health/ready` | Kiểm tra sống & sẵn sàng |
| Auth | `POST /auth/register`, `POST /auth/login`, `POST /auth/refresh`, `POST /auth/logout` | Vòng đời phiên đăng nhập |
| Auth | `POST /auth/forgot-password`, `POST /auth/reset-password`, `POST /auth/change-password` | Quản lý mật khẩu |
| Auth | `GET /auth/google`, `GET /auth/google/callback` | Đăng nhập Google OAuth 2.0 |
| Auth | `GET /auth/sessions`, `GET /auth/sessions/me`, `GET /auth/sessions/:id`, `DELETE /auth/sessions/:id` | Quản lý phiên |
| Users | `GET /users/me`, `PATCH /users/me`, `DELETE /users/me` | Hồ sơ cá nhân, xoá mềm |
| Users | `GET /admin/users`, `GET /admin/users/:id` | Quản trị tài khoản (admin) |
| Workspaces | `POST/GET /workspaces`, `GET/PATCH/DELETE /workspaces/:id` | CRUD không gian làm việc |
| Workspaces | `GET/POST /workspaces/:id/members`, `DELETE /workspaces/:id/members/:userId` | Thành viên workspace |
| Workspaces | `POST /workspaces/:id/transfer-owner`, `POST /workspaces/:id/leave` | Chuyển quyền sở hữu, rời workspace |
| Projects | `POST/GET /workspaces/:workspaceId/projects` | Tạo & liệt kê project |
| Projects | `GET/PATCH/DELETE /projects/:id` | CRUD project |
| Projects | `GET/POST /projects/:id/members`, `PATCH/DELETE /projects/:id/members/:userId` | Thành viên project |
| Projects | `PUT /projects/:id/snapshot`, `POST /projects/:id/transfer-owner` | Snapshot & chuyển owner |
| Projects | `GET /projects` | Liệt kê project theo vai trò |
| Datasets | `POST /projects/:projectId/datasets/upload` | Upload CSV (multipart) |
| Datasets | `GET /projects/:projectId/datasets`, `GET /datasets/:id`, `DELETE /datasets/:id` | Quản lý dataset |
| Datasets | `GET /datasets/:id/file`, `GET /datasets/:id/schema` | Tải file gốc & schema |
| Data View | `GET /datasets/:datasetId/records` | Lưới ảo, phân trang keyset |
| Data View | `POST /datasets/:datasetId/records/query` | Truy vấn lọc/sắp xếp |
| Data View | `GET /datasets/:datasetId/columns/:columnKey/stats` | Thống kê cột |
| Data View | `GET /datasets/:datasetId/charts` | Dữ liệu biểu đồ (histogram/boxPlot/categoryTopN) |
| Analysis | `POST /projects/:projectId/analysis` | Chạy phân tích chất lượng dữ liệu |
| Analysis | `GET /projects/:projectId/analysis/result`, `GET /analysis/jobs/:jobId` | Đọc kết quả / trạng thái job |
| Analysis | `POST /analysis/jobs/:jobId/retry`, `POST /analysis/jobs/:jobId/result` | Thử lại & nạp kết quả AI |
| Report | `POST /projects/:projectId/report`, `GET /projects/:projectId/report/:reportId/file` | Yêu cầu & tải báo cáo PDF |
| Summary | `POST /projects/:projectId/summary`, `GET /projects/:projectId/summary` | Tổng kết kết quả |
| Feedback | `POST /analyses/:analysisId/findings/:findingId/feedback` | Phản hồi cho một finding |
| Feedback | `POST /analyses/:analysisId/feedback`, `GET /analyses/:analysisId/feedback` | Phản hồi cho cả lần chạy |
| Feedback | `GET /analyses/:analysisId/findings/:findingId/feedback` | Đọc phản hồi của finding |
| Feedback | `PATCH /feedback/:id`, `DELETE /feedback/:id` | Sửa / xoá phản hồi của tôi |
| Feedback | `GET /projects/:projectId/ai-quality-metrics` | Chỉ số chất lượng AI |
| Issues | `POST /issues`, `GET /issues`, `GET /issues/:id`, `PATCH /issues/:id` | Báo cáo lỗi của tôi |
| Issues | `POST /issues/:id/attachments`, `GET /issues/:id/attachments/:attachmentId` | Tệp đính kèm |
| Issues | `GET /admin/issues`, `GET /admin/issues/:id`, `PATCH /admin/issues/:id/status` | Quản trị issue (admin) |
| Notifications | `GET /notifications`, `GET /notifications/:id`, `GET /notifications/unread-count` | Hộp thư |
| Notifications | `PATCH /notifications/:id/read`, `PATCH /users/me/notification-preferences` | Đánh dấu đã đọc, tuỳ chọn |
| Overview | `GET /overview/workspaces`, `GET /workspaces/:id/overview` | Tổng quan |

Chi tiết request/response: `docs/frontend-handover/01-api-contract.md` và `docs/frontend-handover/README.md`.
## 8. Hướng dẫn Cài đặt & Chạy

### 8.1 Yêu cầu môi trường

| Thành phần | Phiên bản | Bắt buộc |
|---|---|---|
| Node.js | 22.x LTS | Co |
| pnpm | 11.x | Co |
| MongoDB | 7.x / Atlas | Co |
| Redis | 7.x | Khuyến nghị (lease AI job) |
| Kafka | 3.x | Tuỳ chọn (mặc định dùng in-process) |
| Cloudflare R2 | - | Tuỳ chọn (mặc định lưu local `storage/`) |

### 8.2 Cài đặt

```bash
cd src/backend
pnpm install
cp .env.example .env
# Chỉnh .env: MONGODB_URI, JWT_ACCESS_SECRET, JWT_REFRESH_SECRET, DATA_ENCRYPTION_KEY
```

`DATA_ENCRYPTION_KEY` phải là chuỗi hex 64 ký tự (32 byte cho AES-256-GCM). Hai secret JWT phải dài ≥ 32 ký tự.

### 8.3 Chạy hạ tầng phụ trợ

```bash
# Docker Compose cho dev
docker compose -f deploy/docker-compose.dev.yml up -d

# MongoDB + Redis cho test
pnpm test:infra:up
```

### 8.4 Chạy ứng dụng

```bash
pnpm start:dev      # API ở chế độ watch, port 3000
pnpm start:worker   # Tiến trình worker (outbox + AI + report)
pnpm start:prod     # API production
```

Swagger: `http://localhost:3000/api/v1/docs`
Health: `http://localhost:3000/api/v1/health`

### 8.5 Biến môi trường quan trọng

| Biến | Mặc định | Ý nghĩa |
|---|---|---|
| `PORT` | `3000` | Cổng HTTP |
| `API_PREFIX` | `api/v1` | Tiền tố route |
| `MONGODB_URI` | - | Chuỗi kết nối MongoDB |
| `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` | - | Khóa ký token |
| `JWT_ACCESS_EXPIRATION` | `15m` | Hạn access token |
| `JWT_REFRESH_EXPIRATION` | `7d` | Hạn refresh token |
| `JWT_REFRESH_REMEMBER_EXPIRATION` | `30d` | Hạn khi chọn ghi nhớ đăng nhập |
| `DATA_ENCRYPTION_KEY` | - | Khoá AES-256-GCM |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | rỗng | Tạo admin 1 lần lúc khởi động (OPEN-01) |
| `WORKER_MODE` | `all` | `api` hoặc `all` |
| `OUTBOX_RELAY_ENABLED` | `true` | Bật/tắt outbox relay |
| `KAFKA_BROKERS` | rỗng | Rỗng → in-process; có giá trị → Kafka |
| `AI_MIN_RAM_GB` | `4` | Ngưỡng RAM tối thiểu để nhận job AI |
| `AI_RAM_GUARD_PERCENT` | `90` | Ngưỡng % RAM để dừng nhận job AI |
| `ANALYSIS_MAX_ROWS` | `100000` | Số dòng tối đa đưa vào prompt |
| `S3_ENDPOINT` / `S3_BUCKET_NAME` | - | R2; để trống → lưu local |
| `CORS_ORIGIN` | `http://localhost:5173` | Danh sách origin cho phép |

Chi tiết đầy đủ: `src/backend/.env.example`.
## 9. Hướng dẫn Kiểm thử

### 9.1 Các lệnh

```bash
# Kiểm thử mặc định (unit + arch, bỏ qua integration)
pnpm test

# Unit test thuần
pnpm test:unit

# Kiểm thử kiến trúc (Clean Architecture, cross-imports, API coverage)
pnpm test:arch

# Tích hợp (cần MongoDB replica set + Redis + MinIO)
pnpm test:infra:up
pnpm test:integration

# E2E
pnpm test:e2e

# Toàn bộ
pnpm test:all

# Báo cáo độ phủ
pnpm test:cov
```

### 9.2 Kết quả hiện tại

| Chỉ số | Giá trị |
|---|---|
| Tổng test | **1 277** (tất cả pass) |
| Số suite | 79 (67 unit/arch + 7 integration + 5 e2e) |
| File spec | 74 (72 trong `test/` + 1 trong `src/` + 1 trong `scripts/benchmark/`) |
| Phủ câu lệnh | **71.03%** (8 796 / 12 383) |
| Phủ dòng | **72.05%** (7 708 / 10 697) |
| Phủ nhánh | **58.33%** (4 091 / 7 013) |
| Phủ hàm | **62.06%** (1 361 / 2 193) |

Phân bố theo tầng (mỗi tầng chạy bằng một lệnh riêng):

| Lệnh | Tầng | Suite | Test |
|---|---|---|---|
| `pnpm test` | unit + arch | 67 | 1 069 |
| `pnpm test:integration` | integration (cần hạ tầng) | 7 | 138 |
| `pnpm test:e2e` | e2e (cần hạ tầng) | 5 | 70 |
| **Tổng** | | **79** | **1 277** |

### 9.3 Vì sao tách integration riêng?

`pnpm test` **cố ý loại** thư mục `test/integration/` qua `testPathIgnorePatterns`. Lý do: các test integration dùng chung một database MongoDB test; nếu chạy song song nhiều worker sẽ tranh chấp khi xoá collection. `pnpm test:integration` chạy riêng với `--runInBand` và timeout riêng.

### 9.4 Kiểm thử kiến trúc tự động

| Lệnh | Kiểm tra |
|---|---|
| `pnpm test:arch` | 14 quy tắc CA1-CA14, session MongoDB, API coverage 1-1 |
| `pnpm arch:cross-imports` | Không import chéo module ngoài public contract |
| `pnpm arch:api-coverage` | Hợp đồng §3.13 khớp mã nguồn (84/84) |
| `pnpm arch:baseline` | So sánh với baseline đã lưu |
| `pnpm lint:ci` | ESLint `--max-warnings 0` |
| `pnpm type-check` | TypeScript không lỗi |
## 10. Benchmark & Hiệu năng

Kết quả đầy đủ nằm ở `docs/test-reports/`.

### 10.1 Benchmark mô hình AI

5 mô hình được đánh giá trên 9 chỉ số chất lượng:

| Mô hình | Ghi chú |
|---|---|
| `Qwen3-14B` | Ứng viên chính |
| `Gemma-3-12B` | Ứng viên chính |
| `Qwen3-8B` | Nhẹ hơn, chạy khi tài nguyên hạn chế |
| `Llama-3.1-8B` | Baseline phổ biến |
| `Vistral-7B` | Nhẹ nhất |

### 10.2 Lệnh benchmark

```bash
pnpm bench:models      # Chạy benchmark mô hình
pnpm bench:gold       # Benchmark trên bộ dữ liệu vàng
pnpm bench:stats      # Thống kê kết quả
pnpm bench:pareto     # Phân tích đường Pareto hiệu năng/chi phí
pnpm test:perf        # Đo độ trễ API
pnpm test:benchmark   # Benchmark tổng
```

### 10.3 Cam kết hiệu năng

| Hạng mục | Mục tiêu | Ghi chú |
|---|---|---|
| Phân trang lưới ảo | ≤ 50 ms | Keyset cursor, không offset |
| Tiêu thụ RAM khi import | ≤ 20 MB | Streaming, không nạp toàn bộ file |
| Lưu trữ bản ghi | Insert-only | Không cập nhật/xoá dòng |

---

## 11. Tài liệu Tham khảo

| Tài liệu | Nội dung |
|---|---|
| `src/backend/README.md` | Hướng dẫn vận hành backend chi tiết |
| `src/backend/src/shared/README.md` | Kiến trúc tầng shared, event bus, outbox/inbox |
| `src/backend/src/modules/*/README.md` | Đặc tả từng module nghiệp vụ |
| `docs/restructures/7_api_contracts_v8.md` | Hợp đồng API đầy đủ (84 route) |
| `docs/restructures/24_open_decisions_resolved.md` | 24 quyết định thiết kế đã chốt |
| `docs/frontend-handover/README.md` | Handoff API cho team frontend |
| `docs/frontend-handover/02-realtime-and-env.md` | Giao thức realtime & biến môi trường |
| `docs/test-reports/index.md` | Tổng hợp kết quả kiểm thử |
| `docs/report/` | Báo cáo công nghệ kỹ thuật (8 chương) |

---

## 12. Giấy phép & Tác giả

Dự án học phần, trường Đại học Bách Khoa Hồ Chí Minh (UTH) - Khoa Công nghệ Thông tin.
