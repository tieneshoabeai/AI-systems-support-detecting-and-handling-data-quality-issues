---
title: "Báo cáo công nghệ và kỹ thuật dự án"
version: v1
date: 2026-11-05
status: "Hiện trạng đã khảo sát — thiết kế đích đã chốt"
---

## 1. Mục tiêu và phạm vi

Báo cáo này trình bày toàn bộ nền tảng **công nghệ và kỹ thuật** của dự án Data Quality Platform, gồm hai phần:

| Phần | Nội dung | Cơ sở |
|---|---|---|
| **Phần A — Hiện trạng** | Stack đang chạy, cấu trúc mã nguồn, quy mô, công cụ đang dùng, điểm cần lưu ý | Khảo sát trực tiếp mã nguồn `src/backend` |
| **Phần B — Thiết kế đích** | Stack sau khi tái cấu trúc, kèm lý do lựa chọn và trade-off của từng quyết định | 14 phần thiết kế đã chốt |

Phạm vi: backend Node.js/TypeScript. Frontend không nằm trong đợt tái cấu trúc này — tuy nhiên `packages/contracts` đã được chốt làm hợp đồng dữ liệu dùng chung với frontend.

> **Ghi chú.** Báo cáo phản ánh đặc tả riêng của Data Quality Platform. Mọi quyết định công nghệ đều kèm lý do lựa chọn để có thể truy vết ngược về tài liệu gốc.

---

# PHẦN A — HIỆN TRẠNG

## 2. Tổng quan dự án

### 2.1. Định danh

| Hạng mục | Giá trị |
|---|---|
| Tên | `ai-data-quality-backend` |
| Phiên bản | 1.1.0 |
| Mô tả | AI-Driven Data Quality Management & Remediation Platform Backend (Zod & Shared Architecture) |
| Ngôn ngữ | TypeScript |
| Runtime | Node.js 22 |
| Quản lý gói | pnpm 11.3.0 |
| Framework | NestJS 11 |
| Quy mô mã nguồn | **110 file TypeScript · 7.880 dòng** |

### 2.2. Quy mô theo module

| Module | File | LOC | Vai trò |
|---|---|---|---|
| `auth` | 8 | 371 | Xác thực, phiên đăng nhập, JWT |
| `clean-rules` | 7 | 957 | Quy tắc làm sạch dữ liệu |
| `datasets` | 8 | 777 | Nạp file, sheet, bản ghi, suy luận schema |
| `data-view` | 5 | 338 | Bảng dữ liệu, lọc, sắp xếp |
| `exports` | 6 | 550 | Xuất dữ liệu |
| `lineage` | 6 | 722 | Dò dữ liệu (lineage) |
| `projects` | 7 | 297 | Quản lý project |
| `users` | 8 | 395 | Hồ sơ người dùng |
| `versions` | 6 | 811 | Phiên bản dataset |
| `workspaces` | 8 | 456 | Workspace, thành viên |
| `shared` | 40 | 1.957 | Hạ tầng dùng chung |
| **Tổng** | **110** | **7.880** | |

### 2.3. Cấu trúc thư mục

```
src/backend/
├── src/
│   ├── main.ts                    # Bootstrap: Helmet, CORS, Swagger, filter, interceptor
│   ├── app.module.ts              # Module gốc
│   ├── modules/                   # 10 module nghiệp vụ
│   │   ├── auth/                  # controller, service, module, dto, schemas
│   │   ├── datasets/
│   │   └── ...
│   └── shared/                    # 40 file hạ tầng dùng chung
│       ├── application/outbox/    # outbox-event.schema, outbox.service, outbox.module
│       ├── casl/                 # ability factory, policies guard, decorators
│       ├── config/               # env.validation.ts
│       ├── crypto/               # crypto.util, mask-pii
│       ├── database/             # base-mongo.repository, mongoose-transaction, neo4j
│       ├── decorators/ filters/ guards/ interceptors/ pagination/ pipes/
│       ├── storage/              # storage.interface, storage.service, storage.module
│       ├── swagger/ utils/ validation/
├── scripts/                       # bootstrap-database, seed-initial-data, SSL, cloudflared
├── test/                          # 18 file test
├── package.json  tsconfig*.json  jest.config (trong package.json)
```

### 2.4. Cấu trúc một module (hiện tại)

Module hiện tại dùng cấu trúc **phẳng theo vai trò kỹ thuật**, không phân tầng theo domain/application/infrastructure:

```
modules/datasets/
├── datasets.controller.ts        # HTTP
├── datasets.service.ts           # nghiệp vụ + truy cập dữ liệu trộn lẫn
├── datasets.repository.ts        # truy cập MongoDB
├── datasets.module.ts
├── dto/update-dataset.dto.ts
├── schemas/
│   ├── dataset.schema.ts         # Mongoose schema
│   └── dataset-record.schema.ts
└── services/schema-inference.service.ts
```

**Nhận xét kỹ thuật:** `datasets.service.ts` vừa chứa logic nghiệp vụ vừa điều phối truy cận kho dữ liệu; `datasets.repository.ts` truy cập Mongoose trực tiếp. Đây chính là điểm khiến các tầng phụ thuộc chặt vào nhau, khó mở rộng — nguyên nhân gốc đã được xác định khi bắt đầu đợt tái cấu trúc.

---

## 3. Stack công nghệ hiện tại

### 3.1. Thư viện và mức độ sử dụng thực tế

Đếm số lần import trong mã nguồn `src/`:

| Thư viện | Số lần import | Vai trò |
|---|---|---|
| `@nestjs/common` | 68 | Decorator, guard, filter, interceptor, pipe |
| `mongoose` | 29 | ODM — định nghĩa schema, truy vấn, session |
| `zod` | 23 | Validation runtime cho DTO |
| `@nestjs/mongoose` | 24 | Tích hợp Mongoose vào NestJS DI |
| `@nestjs/swagger` | 13 | Sinh OpenAPI từ decorator |
| `@nestjs/config` | 8 | Nạp và kiểm tra biến môi trường |
| `@nestjs/core` | 4 | DI container, module composition |
| `@nestjs/passport` / `@nestjs/jwt` | 3 / 2 | JWT strategy, module |
| `@casl/ability` | 2 | Phân quyền theo ability |
| `express` | 6 | Nền HTTP, middleware |
| `crypto` | 6 | Băm, mã hoá, sinh token |
| `fast-csv` | 3 | Parse CSV streaming |
| `rxjs` | 4 | Lập trình bất đồng bộ, interceptor |
| `busboy` | 1 | Parse multipart upload |
| `@aws-sdk/client-s3` + `lib-storage` | 1 + 1 | Client S3 cho Cloudflare R2 |
| `neo4j-driver` | 1 | Truy vấn đồ thị (lineage) |
| `helmet` | 1 | Security header |
| `bcrypt` | 1 | Băm mật khẩu |
| `zod-to-json-schema` | 1 | Sinh schema OpenAPI từ Zod |

### 3.2. Bảng stack đầy đủ

| Lớp | Công nghệ | Phiên bản | Trạng thái |
|---|---|---|---|
| Ngôn ngữ | TypeScript | 6.x (alias `@typescript/typescript6`) | Giữ |
| Trình biên dịch tăng tốc | TypeScript Native | 7.x (alias `typescript`) | Giữ |
| Runtime | Node.js | 22 LTS | Giữ |
| Quản lý gói | pnpm | 11.3.0 | Giữ, chuyển sang workspaces |
| Framework | NestJS | 11.x | Giữ |
| ODM | Mongoose | 9.x | Giữ |
| Cơ sở dữ liệu | MongoDB Atlas | — | Giữ, có thêm fallback M0 |
| Cơ sở dữ liệu đồ thị | Neo4j | 5.x | **Đang dùng** cho lineage — đánh giá lại |
| Lưu trữ đối tượng | Cloudflare R2 (S3 API) | — | Giữ |
| Hàng đợi / bus sự kiện | BullMQ + Redis | — | **Chưa dùng** — sẽ thêm **Kafka** (KRaft) thay theo |
| Validation | Zod | 3.23.x | Giữ |
| Phân quyền | CASL | 7.x | Giữ |
| Xác thực | Passport-JWT | — | Giữ |
| Thông báo | Ntfy | — | Đang dùng cho dev |
| AI | Gemini API | — | Đang dùng → **đổi sang AI cục bộ** (`vLLM`/`Ollama`); model chốt bằng **benchmark 5 ứng viên** (Qwen3-14B / Gemma-3-12B / Qwen3-8B / Llama-3.1-8B / Vistral-7B) |
| Parse bảng tính | fast-csv, busboy, xlsx | — | `xlsx` **bỏ** — chỉ còn CSV |
| Test | Jest 30 + ts-jest + Supertest | — | Giữ, mở rộng |
| Test hiệu năng | k6 | — | Chưa dùng — sẽ thêm |
| Observability | Log console + interceptor | — | Sẽ chuẩn hoá thành JSON |
| Triển khai | Cloudflare Tunnel + SSL tự phát | — | Giữ, chuyển sang Docker Compose |

### 3.3. Hạ tầng dùng chung (`shared/`) — 40 file

| Nhóm | Nội dung | Vị trí |
|---|---|---|
| Outbox | `outbox-event.schema.ts`, `outbox.service.ts`, `outbox.module.ts` | `shared/application/outbox/` |
| Phân quyền | `casl-ability.factory.ts`, `policies.guard.ts`, `check-policies.decorator.ts`, `current-resource.decorator.ts`, `policy-resource.decorator.ts`, `subjects.type.ts`, `subject.helper.ts`, `actions.enum.ts` | `shared/casl/` |
| Cơ sở dữ liệu | `base-mongo.repository.ts`, `mongoose-transaction.service.ts`, `mongo-session-context.ts`, `neo4j.service.ts` | `shared/database/` |
| Lưu trữ | `storage.interface.ts`, `storage.service.ts`, `storage.module.ts` | `shared/storage/` |
| Cấu hình | `env.validation.ts` (91 dòng, Zod) | `shared/config/` |
| Bảo vệ dữ liệu | `crypto.util.ts`, `mask-pii.ts` | `shared/crypto/` |
| Lọc lỗi | `all-exceptions.filter.ts` | `shared/filters/` |
| Guard | `jwt-auth.guard.ts`, `roles.guard.ts` | `shared/guards/` |
| Interceptor | `logging.interceptor.ts`, `transform.interceptor.ts` | `shared/interceptors/` |
| Phân trang | `cursor-codec.ts`, `cursor-paginated.response.ts` | `shared/pagination/` |
| Validation pipe | `zod-validation.pipe.ts` | `shared/pipes/` |
| Schema dùng chung | `common-schemas.ts` | `shared/validation/` |

**Nhận xét:** hiện tại `shared/` đã có phần lớn các khối hạ tầng cần thiết (outbox, CASL, storage, masking PII, transaction helper). Đây là nền tảng để chuyển sang Ports & Adapters — phần lớn không cần viết lại, chỉ cần **di chuyển vào đúng module sở hữu** và đặt sau port.

### 3.4. Cấu hình môi trường

91 dòng Zod validation trong `shared/config/env.validation.ts`, dùng `z.preprocess`, `z.coerce.number`, `z.enum`, `z.boolean` — biến sai kiểu bị chặn lúc khởi động.

**47 biến** được khai báo trong `.env.example`, theo 10 nhóm:

| Nhóm | Biến |
|---|---|
| Ứng dụng | `APP_NAME`, `NODE_ENV`, `PORT`, `API_PREFIX` |
| Truy cập | `CORS_ORIGIN`, `CLOUDFLARE_PROXY_TRUST`, `CLOUDFLARE_TUNNEL_ENABLED`, `CLOUDFLARE_TUNNEL_URL` |
| MongoDB | `MONGODB_URI` |
| R2 / S3 | `S3_ENDPOINT`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_BUCKET_NAME`, `S3_REGION` |
| AI | ~~`GEMINI_API_KEY`~~ → `AI_INFERENCE_BASE_URL`, `AI_MODEL_ID`, `AI_MODEL_PATH` |
| Xác thực | `JWT_ACCESS_SECRET`, `JWT_ACCESS_EXPIRATION`, `JWT_REFRESH_SECRET`, `JWT_REFRESH_EXPIRATION`, `SALT_ROUNDS`, `DATA_ENCRYPTION_KEY` |
| Email | `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` |
| Thông báo | `NTFY_ENABLED`, `NTFY_BASE_URL`, `NTFY_TOPIC`, `NTFY_ACCESS_TOKEN`, `NTFY_REQUEST_TIMEOUT_MS` |
| SSL | `SSL_ENABLED`, `SSL_PORT`, `SSL_KEY_PATH`, `SSL_CERT_PATH` |
| Seed | `OWNER_EMAIL`, `OWNER_PASSWORD`, `ORGANIZATION_ID` |

R2 hỗ trợ **local fallback** — để trống `S3_ENDPOINT` thì lưu tại `src/backend/storage`.

### 3.5. Bảo mật hiện tại

| Biện pháp | Cơ chế | Vị trí |
|---|---|---|
| Security header | Helmet, HSTS 1 năm + preload, CSP chỉ ở production | `main.ts` |
| Trust proxy | `set('trust proxy', 1)` khi `CLOUDFLARE_PROXY_TRUST` | `main.ts` |
| Xác thực | `jwt-auth.guard.ts` + Passport-JWT | `shared/guards/` |
| Phân quyền | CASL — ability factory + policies guard + decorator | `shared/casl/` |
| Che PII | `mask-pii.ts` | `shared/crypto/` |
| Mã hoá | `crypto.util.ts` + `DATA_ENCRYPTION_KEY` | `shared/crypto/` |
| Rate-limit | `@nestjs/throttler` 6.x | dependency |
| Lọc lỗi | `all-exceptions.filter.ts` — chuẩn hoá exception về response | `shared/filters/` |
| Log | `logging.interceptor.ts` | `shared/interceptors/` |

### 3.6. Kiểm thử hiện tại

18 file test trong `test/`:

| File test | Phạm vi |
|---|---|
| `casl.spec.ts` | Logic phân quyền |
| `clean-rules.spec.ts` | Quy tắc làm sạch |
| `crypto.spec.ts` | Tiện ích mã hoá |
| `mask-pii.spec.ts` | Che PII |
| `datasets-ingestion.spec.ts` | Luồng nạp dữ liệu |
| `data-view.spec.ts` | Bảng dữ liệu |
| `device-detector.spec.ts` | Nhận diện thiết bị |
| `exports.spec.ts` | Xuất dữ liệu |
| `guard-coverage.spec.ts` | Độ phủ guard |
| `lineage.spec.ts` | Dò dữ liệu |
| `projects.spec.ts` | Project |
| `storage.spec.ts` | Lưu trữ |
| `versions.spec.ts` | Phiên bản |
| `workspaces.spec.ts` | Workspace |
| `zero-any.spec.ts` | **Chống `any`** — nguyên tắc Zero Any Policy |
| `zod-openapi.spec.ts` | Đồng bộ Zod ↔ OpenAPI |
| `jest-e2e.json` | Cấu hình E2E |

**Điểm mạnh cần giữ:** `zero-any.spec.ts` và `zod-openapi.spec.ts` là hai test có giá trị cao — chúng kiểm soát chất lượng type và tính nhất quán hợp đồng API ở mức toàn repo.

---

## 4. Đánh giá hiện trạng

### 4.1. Điểm mạnh

| # | Điểm mạnh | Chi tiết |
|---|---|---|
| 1 | Đã có Zod làm nguồn sự thật cho validation | `zod-openapi.spec.ts` bảo đảm đồng bộ với OpenAPI |
| 2 | Đã có outbox service | Nền tảng cho cơ chế at-least-once đã chốt |
| 3 | Đã có CASL với policy pattern | Không phải xây mới phân quyền |
| 4 | Đã có masking PII và crypto util | Tái sử dụng cho ranh giới dữ liệu AI |
| 5 | Có `base-mongo.repository.ts` và transaction helper | Không phải xây mới tầng persistence |
| 6 | Zero Any Policy có test kiểm chứng | Chất lượng type được bảo vệ tự động |
| 7 | Có Cloudflare Tunnel + SSL tự phát | Nền tảng vận hành sẵn có |
| 8 | Storage có local fallback | Chạy được khi chưa cấu hình R2 |

### 4.2. Điểm cần khắc phục

| # | Vấn đề | Tác động | Mức độ |
|---|---|---|---|
| 1 | Module phẳng, service/repository trộn logic | Phụ thuộc chặt, khó mở rộng, khó test | **Cao** |
| 2 | Repository import Mongoose trực tiếp, không qua port | Domain gắn chặt với công nghệ lưu trữ | **Cao** |
| 3 | Phân trang dùng cursor (`cursor-codec.ts`) | Thiếu `hasMore` và chữ ký HMAC — cần mở rộng, **không đổi sang offset** | Trung bình |
| 4 | Chưa có worker tách riêng; job chạy trong API process | Chặn scale ngang, tác vụ dài chiếm tài nguyên API | **Cao** |
| 5 | Chưa có bus sự kiện bền vững | Không có replay, DLQ, nhiều consumer group | Trung bình |
| 5b | AI gọi Gemini API (dữ liệu ra ngoài Internet) | Vi phạm yêu cầu "dữ liệu không rời hệ thống" | **Cao** |
| 5c | Hỗ trợ Excel (`xlsx`) + khái niệm sheet | Bề mặt tấn công & độ phức tạp không cần thiết | Trung bình |
| 5d | Chưa có vòng lặp phản hồi người dùng cho AI | AI không học được từ phản hồi thật | Trung bình |
| 6 | Logging dạng console chưa chuẩn JSON | Khó thu thập tập trung | Trung bình |
| 7 | Chưa có kiểm thử hợp đồng API tự động | Đặc tả API và code có thể lệch nhau | Trung bình |
| 8 | Chưa có script kiểm tra dependency | Ranh giới tầng không được bảo vệ tự động | Trung bình |
| 9 | Neo4j cho lineage | Hạ tầng thừa nếu không cần truy vấn đồ thị sâu | Thấp |
| 10 | Chưa có kiểm thử hiệu năng | Không biết ngưỡng vận hành | Thấp |

---

# PHẦN B — THIẾT KẾ ĐÍCH

## 5. Nguyên tắc công nghệ

| # | Nguyên tắc | Thể hiện cụ thể |
|---|---|---|
| 1 | Đơn giản trước mạnh mẽ | Modular monolith thay vì microservices; Kafka single-node thay vì cụm broker |
| 2 | Cô lập bằng port | 13 port cho toàn bộ dịch vụ ngoài; không import SDK ở domain/application |
| 3 | Không sao chép stack | Mỗi công nghệ có lý do lựa chọn riêng, ghi trong tài liệu |
| 4 | Cấu hình an toàn | Zod validate lúc khởi động; thiếu credential chỉ log cảnh báo, không crash |
| 5 | Kiểm thử được | Domain test thuần Node; AI luôn mock; E2E trên container thật |
| 6 | **Dữ liệu không rời hệ thống** | AI suy luận cục bộ (vLLM/Ollama); không SDK AI bên ngoài; `ai-engine` không egress |
| 6b | **Một bus sự kiện duy nhất** | Kafka làm cả event bus, hàng đợi nền và DLQ — không thêm broker khác |
| 6c | **Chỉ `.csv`** | Bỏ Excel và khái niệm sheet; 1 tệp = 1 bảng |
| 6d | **Cursor pagination** | Bỏ `offset`/`total`: truy vấn ổn định, không cần `countDocuments` |
| 7 | Không thêm framework CQRS | Tách `commands/` và `queries/` bằng cấu trúc thư mục là đủ |
| 8 | Observability tối giản | Log JSON + health endpoint, không Prometheus/Grafana/Sentry |

---

## 6. Kiến trúc đích

### 6.1. Monorepo

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

Quyết định dùng **pnpm workspaces** — bảo đảm mỗi package có `node_modules` riêng, chặn "phantom dependency", đây là điều kiện tiên quyết cho quy tắc R7–R9 về độ thuần khiết của package.

### 6.2. Cấu trúc tầng trong một module

```
apps/api/src/modules/<module>/
├── domain/                          # Tầng trong cùng — không phụ thuộc framework
│   ├── entities/                    # Model nghiệp vụ + invariant + domain event
│   ├── value-objects/               # Kiểu giá trị có validate, transition hợp lệ
│   ├── events/                      # Domain event (không phải event nền)
│   └── ports/                       # Port repository — cổng ra ngoài cho aggregate
├── application/                     # Tầng giữa — điều phối use case
│   ├── commands/                    # Use case thay đổi trạng thái
│   ├── queries/                     # Use case đọc
│   └── ports/                       # Port hạ tầng — storage, email, AI, queue, audit
├── infrastructure/                  # Tầng ngoài — adapter
│   ├── http/                        # Controller, DTO (Zod), response mapper
│   ├── persistence/                 # Schema Mongoose, repository adapter, entity mapper
│   └── messaging/                   # Kafka producer/consumer adapter, outbox relay
├── <module>.module.ts               # Composition root — nối port với adapter
└── README.md                        # Trách nhiệm, hợp đồng công khai, dependency
```

### 6.3. Quy tắc chiều dependency

```
domain        ──✗──▶  application, infrastructure, @nestjs/*, mongoose
application   ──✗──▶  infrastructure, @nestjs/*, mongoose
infrastructure ──✓──▶  domain, application, @nestjs/*, mongoose
```

**Hệ quả kiểm thử:** toàn bộ `domain/` của 21 module test được bằng unit test thuần Node, không cần MongoDB, không cần NestJS testing module — tiêu chí nghiệm thu của quy tắc R12.

### 6.4. NestJS — ranh giới sử dụng

| Tầng | Dùng NestJS? | Quy tắc |
|---|---|---|
| `domain/` | **Không** | Không import `@nestjs/*`, không import `mongoose` |
| `application/` | **Không** | Không import decorator HTTP; chỉ dùng interface do domain/application định nghĩa |
| `infrastructure/` | Có | Nơi duy nhất chạm NestJS và Mongoose |

### 6.5. Dependency Injection

```typescript
export const PROJECT_REPOSITORY_PORT = Symbol('ProjectRepositoryPort');

// composition root — <module>.module.ts
providers: [
  { provide: PROJECT_REPOSITORY_PORT, useExisting: ProjectRepository },
]
```

Không dùng class token cho interface — interface TypeScript không tồn tại ở runtime nên bắt buộc phải có token.

### 6.6. 21 module nghiệp vụ

| Nhóm | Module |
|---|---|
| Identity | `users`, `auth`, `audit` |
| Workspace & Project | `workspaces`, `projects` |
| Dataset | `datasets` |
| Analysis | `analysis`, `ai` |
| Hợp đồng & tổng kết | `summary` |
| Giao tiếp | `notifications`, `issues` |
| Hạ tầng dùng chung | `shared`, `data-view`, `reports` |

Module `exports` được **xoá hẳn**: gỡ khỏi code, xoá collection, không thêm tính năng mới. Module `lineage` và `clean-rules` hiện tại được đánh giá lại — nguyên tắc tái cấu trúc, hợp nhất vào module phù hợp nếu phạm vi nghiệp vụ trùng lặp.

**v2 — thêm module `feedback`**: lưu nhận xét của người dùng trên mỗi kết quả và cung cấp mẫu few-shot cho vòng lặp học lại của AI. Tổng: **21 module**.

---

## 7. Cơ sở dữ liệu và lưu trữ

### 7.1. MongoDB

| Quyết định | Chi tiết |
|---|---|
| Bản dev | MongoDB Atlas **M0** (miễn phí) |
| Bản production | MongoDB Atlas **M10** |
| Bắt buộc | **Replica set** — cần cho transaction và change stream |
| Xử lý M0 | M0 không có replica set → có fallback về job table polling |
| Kết nối | IP allowlist theo IP VPS; không expose port ra Internet |

**Lý do chọn:** hệ thống xử lý bảng dữ liệu người dùng với schema biến đổi theo từng tệp CSV — mô hình document vừa khớp. Transaction nhiều document và change stream là hai tính năng **bắt buộc** cho cơ chế outbox.

**Đánh đổi:** không có ràng buộc quan hệ mạnh như SQL; toàn vẹn do tầng ứng dụng kiểm soát qua invariant domain.

### 7.2. 21 collection

| Nhóm | Collection | Loại | Xoá |
|---|---|---|---|
| Identity | `user`, `user_session`, `audit_log`, `audit_change` | Thực thể / Log | soft / TTL |
| Workspace & Project | `workspace`, `workspace_member`, `project`, `project_member` | Thực thể | soft |
| Dataset | `dataset`, `dataset_record` | Thực thể | soft |
| Analysis & AI | `analysis_run`, `analysis_result`, `cell_evidence`, `ai_job` | Thực thể | soft |
| Hợp đồng & tổng kết | `project_save` | Thực thể | soft |
| Giao tiếp | `notification`, `issue_report` | Log / Thực thể | TTL / soft |
| Phản hồi & học lại | `finding_feedback`, `feedback_example` | Log, append-only | TTL / giữ lâu |
| Hạ tầng | `outbox_event`, `processed_event` | Log, append-only | TTL |

### 7.3. Quy ước schema

| Quy ước | Nội dung |
|---|---|
| Định danh | Tiền tố theo loại + 26 ký tự ULID: `ws_`, `prj_`, `ds_`, `sh_`, `run_`, `job_` |
| Đặt tên field | `snake_case` trong MongoDB, `camelCase` ở API — mapper chuyển đổi |
| Field chuẩn | `created_at`, `updated_at`, `created_by`, `updated_by` trên mọi collection |
| Xoá mềm | `is_deleted` + `deleted_at` + `deleted_by` cho thực thể nghiệp vụ |
| Optimistic locking | Trường `version` tăng mỗi lần ghi |
| Index | Bắt buộc theo truy vấn: workspace/project, record theo dataset, analysis theo run, TTL theo collection log, **cursor: hợp lệ theo (sort_key, _id)** |

### 7.4. Transaction và consistency

| Nguyên tắc | Chi tiết |
|---|---|
| Transaction chỉ trong repository adapter | Application không mở transaction trực tiếp |
| Ghi outbox trong cùng transaction | Không có trạng thái trung gian mất dữ liệu |
| Ngoại lệ: import dataset | Lưu theo lô để tránh transaction quá dài; tiến trình có thể dừng giữa chừng mà không mất dữ liệu |
| Ghi hàng loạt | Import dataset — ghi theo lô, không giữ transaction mở |
| Đọc | Mặc định không dùng transaction; chỉ dùng khi cần nhất quán đọc |

### 7.5. Cloudflare R2

| Quyết định | Lý do |
|---|---|
| Dùng R2 thay vì S3 | Egress $0 — rẻ hơn đáng kể; API tương thích S3 nên giữ nguyên cấu hình `S3_*` |
| Bucket **không public** | Mọi lần tải đi qua API có kiểm tra quyền |
| Fallback local | Adapter `LocalStorageAdapter` khi `STORAGE_DRIVER=local` — chạy được khi chưa cấu hình R2 |
| Nội dung lưu | Tệp gốc đã upload, PDF sinh ra, tệp đính kèm báo cáo sự cố |

### 7.6. Retention

| Loại dữ liệu | Thời gian giữ |
|---|---|
| Audit log | 365 ngày |
| Phiên đăng nhập | 90 ngày (TTL index) |
| Thông báo | 180 ngày |
| Outbox / processed event | TTL index, dọn dẹp hằng ngày 02:00 giờ VN |
| Bản lưu project | Giữ theo vòng đời project, xoá mềm |
| Phản hồi người dùng (`finding_feedback`) | Giữ lâu — bằng chứng chất lượng, append-only |

---

## 8. Tích hợp bên ngoài và hàng đợi

### 8.1. Danh mục dịch vụ ngoài và port

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
4. Mỗi adapter có fallback hoặc feature flag — hệ thống khởi động được khi thiếu `SMTP_HOST` hay khi `ai-engine` chưa sẵn sàng.
5. **Không adapter nào trỏ tới dịch vụ AI bên ngoài.** Engine suy luận chỉ được gọi qua mạng nội bộ Docker (`ai-engine:8000`).

### 8.2. Cơ chế outbox / inbox

| Thành phần | Cơ chế |
|---|---|
| Ghi outbox | Entity gom domain event → handler ghi vào `outbox_event` **trong cùng transaction** |
| Relay | 2 kênh: **Change Stream** (chính) + **polling fallback** quét event mồ côi |
| Bus sự kiện | **Kafka** — topic `domain.events`; consumer tự lọc theo `eventType` |
| Hàng đợi nền | **Kafka** — `ai.jobs`, `notification.dispatch`, `realtime.push` |
| Dead-letter | Topic `dlq.dead-letter` — message vượt ngưỡng retry |
| Chống xử lý trùng | Collection `processed_event` (inbox pattern), khoá unique `(consumer_name, event_id)` |
| Bảo đảm giao | **at-least-once** → consumer phải idempotent |
| Claim/lease | 4 trạng thái, xử lý lỗ hổng at-least-once |

### 8.3. Topic Kafka và consumer group

| Topic | Nội dung | Consumer group | Kết quả |
|---|---|---|---|
| `domain.events` | Sự kiện nghiệp vụ (relay outbox, kết quả phân tích) | `domain-event-consumer` | 202 + `pollUrl` |
| `ai.jobs` | Phân tích AI, sinh PDF, embedding | `ai-consumer` | 202 + `pollUrl` |
| `notification.dispatch` | Gửi email, thông báo nội bộ | `notification-consumer` | — |
| `realtime.push` | Đẩy sự kiện realtime qua Socket.IO | `realtime-publisher` | — |
| `dlq.dead-letter` | Message chết — giữ để điều tra, phát lại | `dlq-monitor` | — |

Dọn dẹp retention chạy lịch 02:00 VN. Consumer **idempotent**: ghi `processed_event` khoá unique `(consumer_name, event_id)` trước khi xử lý. Lỗi tạm thời → retry backoff luỹ thừa (tối đa 3) → `dlq.dead-letter`; lỗi vĩnh viễn → thẳng DLQ.

### 8.4. Realtime bằng Socket.IO

| Hạng mục | Quyết định |
|---|---|
| Thư viện | **Socket.IO 4.x** (WebSocket, tự fallback sang polling) |
| Gắn vào | Cùng HTTP server NestJS, path `/api/v1/realtime` |
| Xác thực | Handshake query `?token=<accessToken>` — xác thực trước khi vào phòng |
| Multi-instance | Redis adapter |
| Phòng (room) | `user:{userId}`, `project:{projectId}`, `analysis:{analysisId}` |

Luồng: `domain event → outbox_event → relay → Kafka → realtime-publisher consumer → Socket.IO emit → client`.

Sự kiện: `analysis.progress`, `analysis.completed`, `finding.created`, `feedback.received`, `import.progress`, `job.failed`.

Quy tắc: (1) client luôn lấy dữ liệu qua REST, socket chỉ báo "có gì mới"; (2) client có fallback polling 30 giây; (3) mọi sự kiện có `eventId` để khử trùng; (4) server không tin dữ liệu client gửi qua socket; (5) reconnect backoff 1s → 30s.

### 8.5. Phân trang bằng cursor (keyset)

| Quyết định | Chi tiết |
|---|---|
| Kiểu | **Keyset / cursor** — thay cho `offset`/`page` |
| Cursor | base64url mã hoá JSON `{ "k": [sort cuối], "i": "_id cuối", "v": phiên bản }`, ký **HMAC-SHA256** bằng `JWT_SECRET` |
| Trả về | `{ items: [...], nextCursor: string \| null, hasMore: boolean }` |
| Sort mặc định | `created_at DESC, _id DESC` (bất biến, luôn có tiebreaker) |
| `limit` | 1–100, mặc định 15 |
| Không còn | `total`, `countDocuments`, `skip` |

Quy tắc: (1) mọi endpoint danh sách cần index hợp lệ theo `(sort_key, _id)`; (2) đổi bộ lọc giữa 2 lần gọi → HTTP 400 `INVALID_CURSOR`; (3) cursor có phiên bản để invalidate khi thuật toán sắp xếp đổi; (4) repository adapter có sẵn `findPage(filter, cursor, limit)`; `count` chỉ dùng khi thật sự cần.

### 8.6. Chỉ hỗ trợ tệp CSV

| Quyết định | Chi tiết |
|---|---|
| Định dạng | **`.csv` duy nhất** — kiểm tra theo phần mở rộng |
| Mã hoá | UTF-8 (hỗ trợ BOM); CSV `;` được phát hiện tự động |
| Dòng tiêu đề | Bắt buộc; tên cột chuẩn hoá (lowercase, bỏ khoảng trắng) |
| Dung lượng | 500 MB / workspace; 1.000.000 dòng / tệp |
| Parse | `fast-csv` theo luồng; upload `busboy` multipart ghi thẳng vào R2 |
| Bị loại bỏ | `.xlsx`, `.xls`, `.ods` — không còn thư viện đọc Excel trong monorepo |
| Khái niệm bị gỡ | `dataset_sheet` — 1 tệp = 1 bảng dữ liệu |
| Hành vi | Tệp không phải CSV → HTTP 415 `UNSUPPORTED_FILE_FORMAT`, từ chối **trước khi** ghi vào R2 |

---

## 9. Công nghệ AI

### 9.1. AI cục bộ — engine và mô hình

> **v2 (đảo ngược v1):** cấm hoàn toàn AI API bên ngoài. Mọi suy luận diễn ra trong container `ai-engine`.

| Hạng mục | Quyết định |
|---|---|
| Engine production | **vLLM** (chế độ CPU) — HTTP tương thích OpenAI tại `http://ai-engine:8000` |
| Engine dev/local | **Ollama** tại `http://localhost:11434` — cùng API tương thích |
| Engine dự phòng | `llama.cpp` server |
| Tầng sâu (model lớn) | **Do benchmark quyết định** — F1 + điểm giải thích cao nhất đạt p95 ≤ 180 s, RSS ≤ 11 GB |
| Tầng nhanh (model nhỏ) | **Do benchmark quyết định** — p95 thấp nhất đạt JSON ≥ 98 %, ảo giác ≤ 2 % |
| Model embedding | **Qwen3-Embedding-0.6B** (~1.2 GB RSS) — vector kho học lại |
| Routing | **Theo loại tác vụ**: gợi ý nhãn / phân loại / JSON ngắn → tầng nhanh; giải thích / gợi ý / nhận xét → tầng sâu. Fallback: sâu → nhanh → suy giảm có kiểm soát (`ai_unavailable`) |
| Timeout | 180 giây (CPU chậm hơn API rất nhiều) |
| Retry | 2 lần, backoff luỹ thừa |
| Đồng thời | **1** job AI (giới hạn RAM) |
| RAM guard | Dừng nhận job AI mới khi RSS engine > 85% RAM host |
| Chi phí | Chỉ tiền điện — không phí API |

**Năm ứng viên benchmark** — mỗi model đại diện một giả thuyết khác nhau:

| Mã | Model | Quant | RSS ước tính | Giả thuyết được kiểm chứng |
|---|---|---|---|---|
| M1 | Qwen3-14B | Q4_K_M | ~10 GB | Quy mô + đa ngữ thắng |
| M2 | Gemma-3-12B-IT | QAT Q4 | ~8 GB | Lượng tử QAT bù được phần thiếu tham số |
| M3 | Qwen3-8B | Q4_K_M | ~6 GB | Một nửa tham số có đủ cho tác vụ có cấu trúc? |
| M4 | Llama-3.1-8B-Instruct | Q4_K_M | ~5.5 GB | Baseline hệ sinh thái lớn |
| M5 | Vistral-7B-Chat | Q4_K_M | ~5 GB | Chuyên biệt tiếng Việt thắng quy mô? |

**Loại trước benchmark:** Qwen3-30B-A3B (18 GB > RAM) · DeepSeek-R1-Distill-Qwen-14B (p95 quá cao) · Phi-4-mini / PhoGPT-4B (quá nhỏ).

**Chín chỉ số (trọng số 100):** F1 micro (30) · F1 macro theo DQ-01→05 (10) · JSON hợp lệ (12) · ảo giác (10) · chất lượng giải thích tiếng Việt chấm chéo (13) · p95 latency (10) · throughput (5) · RSS đỉnh (5) · độ ổn định (5). Rớt bất kỳ ngưỡng tuyệt đối → loại; chênh F1 < 0,03 → không coi là khác biệt; **McNemar + Wilcoxon**, chỉ tuyên bố thắng khi **ΔF1 ≥ 0,03 và p < 0,05**; chọn theo **đường Pareto** (p95 × F1, kích thước = RSS).

**Quy trình chọn model (bắt buộc):** thu tập **200 mẫu vàng** từ nhận xét người dùng (chống rò rỉ đáp án với kho few-shot) → chạy **cả 5 model** trên **đúng VPS production CPU-only**, cùng prompt/tham số (temperature 0.2, top_p 0.9, seed cố định), 3 lần/model → chấm 9 chỉ số → kiểm định thống kê → vẽ Pareto → chốt **cặp model cho định tuyến hai tầng** → lưu `docs/benchmarks/benchmark-<model>-<ngày>.md` → chạy lại khi đổi model/quant/prompt/engine hoặc mỗi quý.

**Vì sao Qwen3 là hạt giống (chưa phải kết luận)?** Tiếng Việt là điểm yếu của hầu hết model mã nguồn mở cỡ nhỏ; Qwen3 có điểm đánh giá tiếng Việt tốt trong nhóm 8B–14B, hỗ trợ context 32k–128k, và có chế độ **thinking** bật/tắt. Đây là giả thuyết — benchmark 5 model mới là thứ chốt. **Chấm điểm:** không dùng `Qwen3-32B` (vượt RAM) — **chấm chéo** giữa model 8–14B khác họ để tránh self-preference bias.

### 9.1.1. Học lại từ phản hồi người dùng (Human-in-the-Loop, RAG T1)

Mỗi **finding** đi kèm một khối đánh giá cho người dùng nhận xét:

| Trường | Kiểu | Bắt buộc | Ý nghĩa |
|---|---|---|---|
| `verdict` | enum | ✅ | `correct` / `incorrect` / `partially_correct` / `not_applicable` |
| `confidence` | int 1–5 | ✅ | Mức tin cậy người dùng đánh giá cho phát hiện |
| `issueCategory` | enum | ❌ | `false_positive`, `missed_case`, `wrong_severity`, `wrong_evidence`, `other` |
| `comment` | string ≤ 2000 | ❌ | Nhận xét tự do |
| `correctedExplanation` | string ≤ 2000 | ❌ | Giải thích đúng thay thế — **nguồn vàng quan trọng nhất** |
| `evidenceRefs` | string[] | ❌ | Ô/dòng đúng mà AI chỉ sai |
| `rating` | int 1–5 | ❌ | Điểm chất lượng giải thích |
| `responseTimeMs` | int | ✅ | Thời gian người dùng suy nghĩ — tín hiệu độ khó của finding |

**3 mức phản hồi** (tăng dần chi phí): (1) nhanh 1 chạm — 4 nút Đúng/Sai/Một phần/Không áp dụng; (2) có chú thích — thêm `issueCategory` + `comment`; (3) sửa bằng chứng — chỉ định đúng dòng/cột. Người dùng **không bắt buộc** phản hồi.

**Lưu trữ:** `finding_feedback` (gốc, **append-only** — không sửa, không xoá) và `feedback_example` (mẫu few-shot đã khử định danh, append-only, có `source_feedback_id`). Khử định danh: thay chuỗi giống email/SĐT/tên bằng `[EMAIL]`, `[PHONE]`, `[NAME]`.

**Vòng lặp:** phản hồi → `finding_feedback` → lọc (`verdict=incorrect` hoặc có `correctedExplanation`) → khử định danh → embed (Qwen3-Embedding-0.6B) → truy vấn **top-5** theo cosine similarity → chèn vào prompt. Budget cứng: ≤ 5 mẫu, ≤ 4.000 token. Chống tự khuếch đại: 1 mẫu mỗi `finding_signature` trong 30 ngày. Hiệu quả đo bằng A/B nội bộ trên tập vàng.

**Đo lường:** tỉ lệ phản hồi ≥ 25% · tỉ lệ đúng ≥ 80% · ΔF1 (có vs không few-shot) > 0 · độ trễ tăng thêm ≤ +15%.

### 9.2. Ranh giới dữ liệu — không rời hệ thống

**Không có dữ liệu nào ra khỏi host.** Mô hình chạy trong container cùng Docker network, không có route ra Internet.

| Được truyền vào mô hình | Bị chặn |
|---|---|
| Thống kê tổng hợp có cấu trúc | Tệp gốc (toàn bộ nội dung CSV) |
| Tối đa **20 ô lỗi/cột đã che PII** | Toàn bộ tập bản ghi |
| Mô tả lỗi đã lọc | Ảnh chụp màn hình lỗi |
| — | Bất kỳ request nào tới miền bên ngoài |

Chi tiết định danh luôn được che trước khi đưa vào prompt — tái sử dụng `shared/crypto/mask-pii.ts` sẵn có. `ai-engine` được cấu hình **không NAT outbound**.

### 9.3. Phân tách trách nhiệm backend ↔ AI

| Phần | Ai quyết định |
|---|---|
| Phát hiện lỗi theo tiêu chí DQ-01 → DQ-04 | **Backend** — thuật toán tất định, tái lập được, kiểm thử được |
| Mức độ ảnh hưởng | **Backend** — theo quy tắc tái lập được (Thấp / Trung bình / Cao / Chưa đủ cơ sở) |
| Phát hiện bổ sung, giải thích, nhận xét, đề xuất | **AI** — dựa trên thống kê backend cung cấp |
| Sửa dữ liệu | **Không ai tự động** — AI không tự sửa dữ liệu |

**Lý do:** quy tắc backend giúp kết quả nhất quán và kiểm thử được, nhưng có thể bỏ sót ý nghĩa nghiệp vụ. Đây là đánh đổi được chấp nhận có chủ đích.

### 9.4. Xử lý khi AI lỗi

| Tình huống | Hành vi |
|---|---|
| AI lỗi hoặc timeout | Tổng kết vẫn được tạo từ kết quả hệ thống, **không có** giải thích/đề xuất AI; job vào DLQ sau 3 retry |
| RAM quá tải | RAM guard chặn job AI mới; job chờ trong Kafka; hệ thống không sụp |
| Đầu vào không đổi | Cho phép thử lại riêng phần AI (UC-22) |
| Phản hồi hợp lệ một phần | Giữ nhận xét hợp lệ, loại phần không đạt, báo phần chưa đầy đủ tại Tổng kết |
| Phản hồi hỏng toàn bộ | Chỉ dùng kết quả hệ thống |

---

## 10. Bảo mật

### 10.1. Xác thực

| Cơ chế | Chi tiết |
|---|---|
| Access token | JWT Bearer trong header `Authorization` |
| Refresh token | Làm mới qua `POST /auth/refresh` — trả cặp token mới |
| Google OAuth | Tuỳ chọn — hệ thống chạy được nếu không cấu hình |
| Mật khẩu | bcrypt, 5.x |
| OTP quên mật khẩu | Mã ngẫu nhiên có hạn, dùng một lần |
| Phân biệt lỗi | `TOKEN_INVALID` (sai/đã dùng/bị thu hồi) vs `TOKEN_EXPIRED` (hết hạn) |

### 10.2. Phân quyền

| Thành phần | Công nghệ | Ghi chú |
|---|---|---|
| Ability engine | CASL 7.x | Ability-based, khai báo theo action + subject |
| Guard | NestJS guard | Kiểm tra ability trước khi vào handler |
| Policy pattern | Policy class theo module | Tách quy tắc phức tạp ra khỏi guard |
| Audit | Module `audit` | Ghi log thay đổi quyền và thao tác nhạy cảm |

Mô hình 5 vai trò: `WS-OWNER`, `WS-MEMBER`, `PROJ-OWNER`, `PROJ-MEMBER`, `PROJ-VIEWER`, cộng `SYS-ADMIN` tách biệt ở tầng hệ thống.

### 10.3. Bảo vệ dữ liệu nhạy cảm

| Biện pháp | Chi tiết |
|---|---|
| Che PII trước khi đưa vào prompt | Tối đa 20 ô đã che |
| `ai-engine` không egress | Dữ liệu không rời host |
| Lỗi 500 không lộ chi tiết | Không stack trace, không tên collection, không giá trị nghiệp vụ |
| Lỗi `DEPENDENCY_UNAVAILABLE` | Nêu dịch vụ nào lỗi, không nêu host/credential |
| Lỗi xác thực trung tính | Không tiết lộ email có tồn tại hay không |
| Audit log | Ghi lại thao tác trên dữ liệu và thay đổi quyền |
| Rate-limit | Redis-backed, áp dụng trên endpoint nhạy cảm |

### 10.4. Bảo mật vận hành

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

## 11. Kiến trúc vận hành

### 11.1. Sơ đồ triển khai

```
┌────────────────────────────────────────────────────────────────────┐
│              VPS (1 máy, Ubuntu 22.04, 16 vCPU / 15 GB RAM)         │
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

    ❌ KHÔNG có mũi tên dữ liệu ra Internet. ai-engine không egress,
       không cài SDK AI bên ngoài nào.
```

### 11.2. Các quyết định vận hành

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
| 8b | Kafka: **KRaft single-node**, không ZooKeeper | 1 broker, đủ cho 1 VPS |
| 8c | `ai-engine` giới hạn bộ nhớ `mem_limit` | Chặn OOM làm sập cả VPS |
| 8d | RAM guard dừng job AI khi RSS > 85% RAM host | Giữ API sống hơn giữ AI chạy |
| 9 | R2 giữ nguyên cấu hình `S3_*` | Egress $0 — rẻ hơn S3 |

### 11.3. Health check

| Endpoint | Ý nghĩa |
|---|---|
| `/health` | Tiến trình còn sống |
| `/health/ready` | Sẵn sàng nhận traffic — đã kết nối MongoDB, Redis, Kafka |
| `/health/ai` | Trạng thái `ai-engine`: model đang nạp, RSS, RAM guard |

### 11.4. Sao lưu và khôi phục

| Đối tượng | Cơ chế |
|---|---|
| MongoDB Atlas | Snapshot tự động theo lịch + `mongodump` định kỳ ra R2 |
| R2 | Versioning bật; bucket không public |
| `.env` | Sao lưu riêng, mã hoá, lưu ngoài VPS |
| Kiểm thử khôi phục | Định kỳ — quy trình khôi phục phải được thử, không chỉ tài liệu hoá |

---

## 12. Hiệu năng và giới hạn

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

Chiến lược hiệu năng: index MongoDB theo truy vấn · projection chỉ lấy trường cần · streaming upload/download không nạp toàn bộ tệp vào bộ nhớ · **phân trang cursor (keyset)** ổn định khi dữ liệu thay đổi, không cần `countDocuments` · index hợp lệ theo `(sort_key, _id)` · job Kafka thay xử lý đồng bộ · cache Redis cho rate-limit counter và trạng thái feature flag.

---

## 13. Công cụ kiểm thử

| Công cụ | Vai trò |
|---|---|
| Jest + ts-jest | Unit test, integration test |
| Supertest | E2E — gọi HTTP thật |
| k6 | Smoke và stress test, chạy thủ công trước release |
| zod-to-json-schema | Sinh `openapi.json` từ `packages/contracts` |
| Docker Compose test | MongoDB replica set 1 node + Redis + MinIO + Kafka KRaft 1 node |
| Script checker kiến trúc | Kiểm tra 12 quy tắc dependency R1–R12 |
| Script security check | 36 tình huống truy cập trái phép |

**Quy tắc:** test AI **luôn mock** — không bao giờ gọi engine thật trong test. Bộ benchmark model (mục 9.1) là nơi duy nhất gọi engine thật, chạy thủ công theo lịch, không nằm trong CI. Thêm script `check-no-external-ai` đảm bảo `package.json` không chứa SDK AI bên ngoài.

### 13.1. Ngưỡng coverage theo tầng

| Tầng | Ngưỡng |
|---|---|
| Domain | ≥ 90% |
| Application | ≥ 80% |
| Infrastructure | ≥ 60% |
| Contracts | ≥ 95% |
| **Tổng** | **≥ 70%** |

### 13.2. Chín tầng kiểm thử

1. API snapshot contract (`openapi.json`) · 2. Domain (pure TS) · 3. Application use case (mock qua interface fakes) · 4. Infrastructure adapter (container Mongo replica set + Redis + MinIO + Kafka) · 5. E2E + runtime Zod validation · 6. Architecture rules (script checker R1–R12) · 7. Security (48 kịch bản) · 8. Performance (k6 manual smoke/stress) · **9. Benchmark AI & học lại** (so sánh model, đo F1/p95, kiểm tra vòng lặp few-shot)

---

## 14. Chiến lược chuyển đổi công nghệ

### 14.1. Hybrid — chuyển đổi theo lô module

Chiến lược **không Big Bang**. Hệ thống mới và hệ thống cũ cùng chạy, định tuyến bằng cờ tính năng theo workspace:

```
legacy  ──▶  canary (10% workspace)  ──▶  new
```

- Bộ định tuyến chạy **trong tiến trình** (in-process), đọc collection `feature_flag`.
- Chuyển đổi 3 trạng thái, quay lại `legacy` mất vài giây, không cần triển khai lại.
- Chuyển đổi theo **lô module** (7 lô) thay vì một cửa sổ dừng hệ thống duy nhất.
- Các thay đổi hạ tầng lớn cũng chuyển đổi theo cờ tính năng: `LEGACY_AI_PROVIDER_ENABLED`, `LEGACY_QUEUE_ENABLED` — cho phép rollback nhanh.

### 14.2. Công cụ chuyển đổi dữ liệu

8 script `ts-node`, 3 chế độ: `--dry-run` (mặc định, chỉ báo cáo) · `--apply` (thực thi) · `--verify` (đối chiếu sau chuyển đổi).

---

## 15. Bảng đối chiếu hiện trạng → thiết kế đích

| Hạng mục | Hiện tại | Thiết kế đích | Lý do |
|---|---|---|---|
| Cấu trúc module | Phẳng: controller/service/repository | 3 tầng domain/application/infrastructure | Sửa gốc rễ phụ thuộc chặt |
| Truy cận kho | Repository import Mongoose trực tiếp | Repository qua port, adapter Mongoose ở infrastructure | Cho phép test domain không cần DB |
| Phân trang | Cursor (`cursor-codec.ts`) | **Giữ cursor**, bổ sung `hasMore` + ký HMAC | Đảo ngược quyết định v1 — offset không ổn định khi dữ liệu đổi |
| Worker | Chưa tách, job trong API process | `apps/worker` riêng, consumer Kafka nhiều group | Cho phép scale ngang, tác vụ dài không chiếm API |
| Hàng đợi | Chưa có | **Kafka** (KRaft, 5 topic, DLQ) | Replay, nhiều consumer group, độ bền disk |
| Realtime | Chưa có | **Socket.IO** + Redis adapter | Đẩy thông báo/tiến độ tới client |
| AI | Gemini API (Flash, Free Tier) | **vLLM/Ollama + 5 model ứng viên benchmark** | Dữ liệu không rời hệ thống; model chốt theo 9 chỉ số đo được |
| Định dạng tệp | CSV + Excel (có sheet) | **Chỉ `.csv`** | Giảm phụ thuộc, bỏ khái niệm sheet |
| Phản hồi người dùng | Chưa có | Module `feedback` + RAG T1 few-shot động | AI học lại từ phản hồi thật |
| Outbox | Có `outbox.service.ts` | Giữ, chuyển vào `shared`, ghi trong cùng transaction | Đã có nền tảng, chỉ cần tái cấu trúc |
| Logging | Console qua interceptor | JSON structured ra stdout | Thu thập tập trung dễ |
| Health check | Chưa chuẩn hoá | `/health` + `/health/ready` | Sẵn sàng cho Docker healthcheck |
| Hợp đồng API | `zod-openapi.spec.ts` kiểm tra đồng bộ | `packages/contracts` sinh `openapi.json` + snapshot test | Hợp đồng là chuẩn, có gate |
| Kiểm tra dependency | Chưa có | Script checker R1–R12 trong `test:all` | Bảo vệ ranh giới tầng tự động |
| Cấu trúc gói | Một package `src/backend` | pnpm workspaces: apps/ + packages/ | Tái sử dụng `packages/core` giữa API và worker |
| Config | `env.validation.ts` trong shared | `packages/config` dùng chung | API và worker parse cùng một schema |
| Test | 18 file, unit + E2E | 8 tầng, 92 quy tắc, coverage theo tầng | Ràng buộc chất lượng ở tầng quan trọng nhất |
| Hiệu năng | Chưa đo | k6 smoke + stress trước release | Biết ngưỡng vận hành |
| Neo4j | Đang dùng cho lineage | Đánh giá lại — hợp nhất hoặc loại bỏ | Tránh giữ hạ tầng thừa |

---

## 16. Công nghệ chưa áp dụng — và lý do

| Công nghệ | Lý do không dùng |
|---|---|
| ~~Kafka~~ | **Đã áp dụng ở v2** — event bus + hàng đợi nền + DLQ |
| CQRS framework | Thêm lớp trừu tượng chưa cần |
| Kubernetes | Quá nặng cho 1 VPS; Docker Compose đủ |
| Prometheus + Grafana | Chưa có nhu cầu vận hành liên tục |
| Elasticsearch | Truy vấn theo substring + index MongoDB đáp ứng |
| Redis Cluster | 1 instance đủ cho quy mô hiện tại |
| GPU / tăng tốc | VPS không có GPU; CPU-only là ràng buộc chấp nhận được |
| Vector database riêng (Qdrant/Milvus) | Vector nhúng trong MongoDB (`feedback_example`) đủ cho kho mẫu hiện tại |
| gRPC | Nội bộ một tiến trình + worker; REST đủ và frontend thân thiện hơn |

---

## 17. Điều kiện nghiệm thu về công nghệ

1. Toàn bộ công nghệ trong báo cáo này hiện diện trong `package.json` của monorepo mới với phiên bản đã khoá.
2. Không module nào ở `domain/` hoặc `application/` import SDK của dịch vụ ngoài — kiểm chứng bằng quy tắc R7–R12.
3. Hệ thống khởi động thành công khi thiếu `SMTP_HOST` và khi `ai-engine` chưa sẵn sàng — chỉ log cảnh báo.
4. Biến môi trường sai kiểu làm fail sớm lúc khởi động.
5. `docker-compose.test.yml` dựng được MongoDB replica set 1 node + Redis + MinIO + Kafka KRaft 1 node.
6. Test AI không bao giờ gọi engine thật.
6b. **Không phụ thuộc nào tới SDK AI bên ngoài** trong `package.json` — kiểm chứng bằng script `check-no-external-ai`.
6c. `ai-engine` không có egress ra Internet.
6d. Mọi endpoint danh sách trả `nextCursor`/`hasMore`; không còn tham số `offset`/`page`.
6e. Endpoint upload từ chối tệp không phải `.csv` với HTTP 415 trước khi ghi vào R2.
6f. Benchmark model chạy được và có kết quả lưu tại `docs/benchmarks/`.
6g. `finding_feedback` bất biến — không có đường `update`/`delete` trong mã nguồn.
7. Coverage đạt ngưỡng theo tầng; tổng ≥ 70%.
8. `openapi.json` sinh tự động từ `packages/contracts` và được snapshot trong CI.
9. `worker` không lắng nghe port HTTP công khai.
10. Log ở định dạng JSON ra stdout, có `X-Request-Id` xuyên suốt.

---

## 18. Tóm tắt

Hệ thống hiện tại có nền tảng tốt ở lớp hạ tầng dùng chung — outbox, CASL, storage, masking PII, transaction helper, Zod validation, Zero Any Policy — nhưng **cấu trúc module phẳng** khiến các tầng phụ thuộc chặt vào nhau. Đây chính là điểm cần khắc phục, và được giải quyết bằng Ports & Adapters thay vì viết lại toàn bộ.

Thiết kế đích **vẫn giữ nền tảng sẵn có** (MongoDB, R2, CASL, Zod, masking PII, outbox, transaction helper) và **bổ sung 4 thành phần hạ tầng**: worker tách riêng, Kafka (event bus + hàng đợi + DLQ), Socket.IO (realtime) và container AI cục bộ. Đây là chiến lược tái cấu trúc kèm 5 quyết định kiến trúc đã chốt — không phải chiến lược đổi stack, để giảm rủi ro và giữ nguyên hành vi nghiệp vụ đã được kiểm chứng.

**Năm quyết định kiến trúc v2 (2026-11-05):** AI cục bộ thay Gemini API · Kafka thay BullMQ · Cursor pagination thay offset · Socket.IO cho realtime · Chỉ `.csv` — kèm vòng lặp Human-in-the-Loop để AI học lại từ phản hồi người dùng.

Điểm khác biệt cốt lõi của thiết kế đích so với hiện trạng không nằm ở thư viện được dùng, mà ở **ranh giới trách nhiệm**: mọi module đều có cùng một cấu trúc 3 tầng, mọi dịch vụ bên ngoài đều đi sau port, mọi quy tắc đều được kiểm tra tự động bằng script. Đó là thứ làm cho hệ thống có thể mở rộng tiếp mà không phải viết lại lần nữa.
