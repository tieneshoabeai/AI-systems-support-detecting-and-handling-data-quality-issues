# 14. Kế hoạch thực hiện tái cấu trúc

- **Version:** v6
- **Ngày tạo:** 2026-11-02
- **Cập nhật gần nhất:** 2026-11-06 (v6)
- **Thay đổi v5 (2026-11-06):** AI chuyển sang **benchmark 5 model / 9 chỉ số** trước khi chốt (Phần 12 v5). Đợt 5 thêm work package tải **5 file `.gguf`** (~35 GB đĩa) và chạy benchmark đầy đủ (3 lần/model × 200 mẫu = 3.000 lượt suy luận) trước khi chốt cặp model định tuyến hai tầng; ước lượng Đợt 5 tăng 35,5 → **~40 ngày công**; tổng **~181 → ~185,5 ngày công**.
- **Trạng thái:** Đã chốt 18 quyết định triển khai và thiết kế chi tiết **chiến lược Hybrid**, **7 đợt giao hàng**, **cấu trúc monorepo pnpm**, **feature flag chuyển traffic theo module**, **migrate dữ liệu theo từng nhóm module**, quy trình commit/PR, ước tính khối lượng theo module và lịch trình, bảng phân bổ **120 quy tắc kiểm thử** theo đợt, cùng **cảnh báo lệch lịch do chênh lệch ước tính**.
- **Thay đổi v4 (2026-11-05):** áp dụng 4 quyết định kiến trúc. (1) **Cursor pagination** thay offset toàn hệ thống — thêm work package ở Đợt 1 + Đợt 4. (2) **Kafka + Socket.IO** thay BullMQ/Redis — thêm hạ tầng Kafka ở Đợt 1, realtime gateway ở Đợt 1, consumer chuyển đổi ở Đợt 5. (3) **AI cục bộ** — thêm work package `ai-engine` (vLLM/Ollama) + model + benchmark ở Đợt 5; **bỏ** phụ thuộc Gemini. (4) **Chỉ `.csv`** — bỏ `dataset_sheet` khỏi Đợt 4, bỏ thư viện Excel. Ngoài ra: thêm **Đợt 7 — Feedback & học lại** (module `feedback`), ước lượng ~146 → **~181 ngày công**.
- **Giai đoạn:** Sẵn sàng implementation
- **Thứ tự thực hiện:** Phần 14 — cuối cùng trước khi viết code.
- **Quan hệ với các phần khác:** hiện thực hóa toàn bộ Phần 1–13; dùng ma trận **120 quy tắc** của Phần 13 v4 làm danh sách kiểm tra bắt buộc cho từng đợt.

## 1. Mục tiêu

Chuyển từ bộ tài liệu thiết kế (Phần 1–13) sang kế hoạch thực thi cụ thể: chia việc thành các đợt giao hàng có thể kiểm chứng được, với tiêu chí nghiệm thu rõ ràng cho từng đợt.

## 2. Nội dung cần bàn luận

- Chiến lược chuyển đổi từ hệ thống cũ sang hệ thống mới mà không mất dịch vụ.
- Cấu trúc repo mục tiêu và cách chia đợt.
- Ước lượng khối lượng, lịch trình và rủi ro.

## 3. Quyết định và thiết kế chi tiết

### 3.1. Các quyết định nền tảng

| # | Quyết định | Ghi chú |
|---|---|---|
| 1 | Cấu trúc repo: **monorepo pnpm workspaces** — `apps/api`, `apps/worker`, `packages/core`, `packages/contracts` | Đúng như Phần 5 / Phần 13 đã thiết kế |
| 2 | Chiến lược: **Hybrid** — dựng nền tảng trước, chuyển module theo nhóm nghiệp vụ | Giữ API cũ chạy tới khi nhóm module mới sẵn sàng |
| 3 | Chia **7 đợt giao hàng** (v4) | Khớp 20 module + hạ tầng; `feedback` tách riêng |
| 4 | Nhánh: **một nhánh `Hoa24102026`**, không nhánh con, commit theo từng đợt với message `[Đợt N]` | Đơn giản, khó review từng phần — chấp nhận |
| 5 | Giữ code legacy **đến khi cutover xong** rồi xoá hết một lần | Đúng kịch bản Phần 11 (legacy drop ngay khi verify pass) |
| 6 | **TDD nghiêm** — test trước, mỗi use case chỉ xong khi đã có test | Đúng tinh thần Phần 13 |
| 7 | Chuyển traffic bằng **feature flag theo module** | Rollback tức thì |
| 8 | Commit theo **Conventional Commits** (`feat(project):`, `refactor(dataset):`) + scope theo module | Chuẩn, sinh changelog tự động |
| 9 | PR: **tự review + tự đính kèm bằng chứng** (báo cáo test Phần 13) | Không có người review thứ hai (đội 1 người) |
| 10 | Migrate dữ liệu **theo từng nhóm module** — migrate module nào thì chuyển traffic module đó | Khớp chiến lược Hybrid |
| 11 | Staging: **chỉ local + Docker** (docker-compose + Mongo replica set container) | Không tốn tiền, đủ cho đội 1 người |
| 12 | Thời lượng đợt: **1 tuần** | Cảnh báo lệch lịch ở mục 3.8 |
| 13 | Ước lượng: **cả hai** — tổng ngày công chi tiết theo module, kèm phân bổ theo đợt | |
| 14 | Làm việc **tuần tự, 1 người** — mỗi đợt xong mới sang đợt sau | Không overlap |
| 15 | **Không chia đợt cứng như ràng buộc lịch** — 7 đợt giữ làm **đơn vị công việc logic** (checkpoint nghiệm thu), không phải mốc thời gian | Tiến độ do người dùng + AI làm liên tục, ưu tiên tốc độ |
| 16 | **Ước lượng lịch tính theo mô hình người + AI cùng làm** — không phải 1 người 8h/ngày | Xem mục 3.6 |
| 17 | **7 đợt** (thêm **Đợt 7 — Feedback & học lại**) | Module `feedback` cần `analysis` + `ai` đã chạy → tách đợt riêng cho rõ |
| 18 | **AI chỉ chạy nội bộ** — không có SDK AI bên ngoài trong `package.json`; engine là container riêng, chỉ worker gọi | Ràng buộc bảo mật + tuân thủ yêu cầu "không kéo API" |

### 3.2. Chiến lược Hybrid — giải thích cụ thể

**Vấn đề của Big Bang (phương án B) mà bạn đã hỏi:** trong Big Bang, toàn bộ API cũ bị thay bằng API mới chưa hoàn chỉnh. Mọi endpoint chưa chuyển sẽ trả 404, nên **không thể demo cho khách dùng thật hay chạy staging nghiệm thu** cho tới khi dựng xong cả 20 module. Giai đoạn giữa là một hệ thống không dùng được.

**Hybrid giải quyết như thế nào:**

```
        API CŨ (controller hiện tại)          API MỚI (apps/api theo hexagonal)
        ┌──────────────────────┐             ┌──────────────────────────┐
        │  auth, users, ...    │             │  auth, users, ...        │
        │  (NestJS + Mongoose) │             │  (domain/use/adapter)    │
        └──────────┬───────────┘             └──────────┬───────────────┘
                   │                                      │
                   │        ┌─────────────────────────┐   │
                   └───────►│  ROUTER + FEATURE FLAG  │◄──┘
                            └─────────────────────────┘
                             flag ON  → route tới API MỚI
                             flag OFF → route tới API CŨ
```

**Cơ chế thực tế — không phải proxy, mà là 1 router trong 1 tiến trình:**

Vì `apps/api` mới và controller cũ đều là NestJS, ta dùng một `ModuleRouter` tập trung:

```typescript
// packages/core/src/routing/module-router.ts
export type ModuleKey =
  | 'auth' | 'users' | 'audit' | 'workspaces' | 'projects'
  | 'notifications' | 'issues' | 'datasets' | 'data-view'
  | 'analysis' | 'ai' | 'summary' | 'reports';

export interface ModuleRouter {
  resolve(module: ModuleKey): 'legacy' | 'new';
}
```

Cơ chế ở tầng HTTP:

| Bước | Hành động |
|---|---|
| 1 | Mỗi controller mới đăng ký kèm `ModuleKey` qua decorator `@ModuleRoute('auth')` |
| 2 | Request vào được `LegacyAwareInterceptor` đọc `ModuleKey` từ metadata |
| 3 | `ModuleRouter.resolve()` tra cờ trong `MODULE_FLAGS` (đọc từ env hoặc MongoDB `feature_flag`) |
| 4 | Nếu `legacy` → forward sang controller cũ; nếu `new` → xử lý tại controller mới |

**Ưu điểm so với proxy/tiền tố path:**

| Tiêu chí | Feature flag trong tiến trình | Proxy path `/api/v2` |
|---|---|---|
| Frontend phải sửa | Không — URL giữ nguyên | Phải sửa 2 lần |
| Rollback | Tắt cờ → về API cũ trong vài giây | Phải sửa config proxy |
| Chi phí hạ tầng | 0 | Thêm reverse proxy + DNS |
| Độ phức tạp | Trung bình | Thấp |

**Quy tắc bắt buộc:**
1. Cờ mặc định **`legacy`** — chỉ bật `new` khi đợt tương ứng đã pass toàn bộ tiêu chí nghiệm thu (mục 3.7).
2. Cờ được lưu trong MongoDB collection `feature_flag` (doc `{ module, mode, updated_at, updated_by }`) — **không** dùng biến môi trường, vì cần bật/tắt không cần restart container.
3. Bật cờ là **hành động có kiểm soát**: bật cho 1 module → chạy smoke test → quan sát 24h → mới bật module kế tiếp.
4. Cờ được bật **theo workspace** trước khi bật toàn cục (rollout dần): `mode: 'legacy' | 'new' | 'canary'`, `canary` áp cho 10% workspace đầu tiên.
5. Tắt cờ = rollback trong vài giây, không cần deploy.

### 3.3. Cấu trúc repo mục tiêu

```
src/backend/
├── apps/
│   ├── api/                       # NestJS HTTP server
│   │   ├── src/
│   │   │   ├── main.ts
│   │   │   ├── app.module.ts
│   │   │   ├── modules/           # 20 module theo hexagonal (mục 3.4)
│   │   │   │   ├── auth/
│   │   │   │   │   ├── domain/         # aggregate, value object, domain error
│   │   │   │   │   ├── application/    # use case handler
│   │   │   │   │   ├── infrastructure/ # Mongo adapter, port impl
│   │   │   │   │   ├── interfaces/    # controller (HTTP adapter)
│   │   │   │   │   └── module.ts
│   │   │   │   └── ...
│   │   │   └── shared/            # config, logger, filter, guard, interceptor
│   │   └── test/                  # E2E + security của api
│   └── worker/                    # Kafka consumer + outbox relay
│       └── src/
│           ├── main.ts
│           ├── relay/                 # outbox relay (change stream + polling)
│           ├── consumers/             # inbox consumer theo từng event
│           └── jobs/                  # AI job, PDF job, cleanup job
├── packages/
│   ├── core/                       # framework-free: aggregate, ID, domain error, stats
│   │   └── src/
│   │       ├── id/                   # ULID với prefix
│   │       ├── domain/               # base aggregate, DomainError
│   │       ├── stats/                # 7 hàm thống kê (Phần 12)
│   │       └── routing/              # ModuleRouter, ModuleKey
│   ├── contracts/                   # Zod schema + sinh OpenAPI
│   │   └── src/
│   │       ├── auth/ workspace/ project/ ...
│   │       └── openapi/              # generator
│   └── config/                      # Zod env validation dùng chung
├── scripts/
│   ├── check-architecture.mjs        # 12 quy tắc A1–A12 (Phần 13)
│   ├── generate-test-report.mjs      # báo cáo tự động (Phần 13)
│   ├── migrate-*.ts                  # 8 script migration (Phần 11)
│   └── seed-*.ts
├── test/
│   ├── factories/  fixtures/  seed/  k6/
│   ├── integration/
│   └── setup-env.ts
├── docker-compose.test.yml
├── jest.unit.json
├── package.json                     # workspace root
└── pnpm-workspace.yaml
```

**Quy tắc bắt buộc về cấu trúc:**
1. `packages/core` và `packages/contracts` **không** import từ `apps/` (quy tắc A8, A9 của Phần 13).
2. `apps/worker` **không** import từ `apps/api` (quy tắc A12).
3. Mỗi module trong `apps/api/src/modules/` có đủ 6 thư mục: `domain/`, `application/`, `infrastructure/`, `interfaces/`, `tests/`, `module.ts` (quy tắc A6).
4. `domain/` không import NestJS/Mongoose (A1, A2) — bắt buộc ngay từ đợt 1.
5. Test domain nằm **cạnh file nguồn** (`*.spec.ts` trong `domain/`), test E2E ở `apps/api/test/`, test adapter ở `test/integration/`.

### 3.4. Sáu đợt giao hàng

#### 3.4.1. Tổng quan

| Đợt | Tên | Module | Số module | Use case | Endpoint | Quy tắc test | Ngày công (ước) |
|---|---|---|---|---|---|---|---|
| **Đợt 1** | Nền tảng & hạ tầng test | `shared`, `packages/*` | 1 + 4 pkg | 4 | 3 | 24 | 12–14 |
| **Đợt 2** | Tài khoản & phiên | `auth`, `users`, `audit` | 3 | 20 | 16 | 20 | 12–14 |
| **Đợt 3** | Không gian làm việc | `workspaces`, `projects` | 2 | 26 | 22 | 18 | 11–13 |
| **Đợt 4** | Dữ liệu | `datasets`, `data-view` | 2 | 18 | 10 | 14 | 9–11 |
| **Đợt 5** | Phân tích & AI cục bộ | `analysis`, `ai`, `summary`, `reports` | 4 | 16 | 12 | 12 | 11–13 |
| **Đợt 6** | Hoàn tất & cutover | `notifications`, `issues` + migration + xoá legacy | 2 | 8 | 8 | 2 | 9–11 |
| **Đợt 7** | Feedback & học lại | `feedback` | 1 | 5 | 5 | — | 4–5 |
| **Tổng** | | | **15 module** | **~95** | **~76** | **~89** | **~181** |

**Cột "ngày công"** là đơn vị chuẩn hóa để so sánh — xét theo mô hình người + AI thì rút còn ~42–58 (mục 3.6.3). Không phải mốc thời gian cam kết (quyết định 15).

**Ghi chú về số lượng use case / endpoint:** bảng Phần 13 v4 ghi 66 use case và 85 endpoint. Bảng trên ghi "~95" và "~76" vì:
- **Use case**: mỗi endpoint có thể phát sinh nhiều use case con (VD `GET /workspaces` → list + filter + sort + paginate + cursor). 66 là số use case **nghiệp vụ** đã chốt; ~95 là số **use case hành vi** cần test (bao gồm các nhánh hành vi).
- **Endpoint**: 85 là tổng cuối cùng của toàn hệ thống; các đợt trên chưa bao gồm endpoint của `notifications`/`issues` chi tiết và một số endpoint bổ sung phát sinh từ feature flag/canary. Con số chính xác chốt lại ở đợt 1 khi sinh OpenAPI snapshot.

**Thứ tự phụ thuộc — tại sao đợt này trước đợt kia:**

```
Đợt 1 (nền tảng)
   │
   ├──► Đợt 2 (auth) ──┐
   │        │           │
   │        ▼           ▼
   │   Đợt 3 (ws/proj) ──► Đợt 4 (datasets) ──► Đợt 5 (analysis/AI)
   │        │                                     │
   └────────┴─────────────────────────────────────┴──► Đợt 6 (thông báo, sự cố, cutover)
```

| Phụ thuộc | Lý do |
|---|---|
| Đợt 1 → mọi đợt | Mọi module dùng `packages/core` (ID, DomainError, outbox port) và `packages/contracts` (Zod schema) |
| Đợt 1 → Đợt 6 | Cần `shared` (outbox relay + inbox) để mọi use case phát event đúng chuẩn |
| Đợt 2 → Đợt 3 | Mọi endpoint từ Đợt 3 trở đi cần guard + token + phân quyền từ `auth` |
| Đợt 3 → Đợt 4 | `data-view` cần port `DatasetReader`/`DatasetWriter` của `datasets`; `analysis` cần `project` |
| Đợt 4 → Đợt 5 | `analysis` đọc `dataset_record`; `summary` cần trạng thái phiên do `data-view` ghi |
| Đợt 5 → Đợt 6 | `notifications` tiêu thụ event từ `analysis`/`ai`; `issues` cần `project` |

#### 3.4.2. Đợt 1 — Nền tảng & hạ tầng kiểm thử

**Mục tiêu:** dựng nền để mọi đợt sau viết code mà không phải sửa hạ tầng.

| Hạng mục | Nội dung |
|---|---|
| **Cấu trúc repo** | `pnpm-workspace.yaml`, `apps/api`, `apps/worker`, `packages/core`, `packages/contracts`, `packages/config` |
| **Hạ tầng test** | `jest.unit.json` với 4 project (domain/application/infrastructure/contract), `test/jest-e2e.json`, `docker-compose.test.yml` (Mongo replica set + Redis + **Kafka KRaft** + MinIO), `test/setup-env.ts` |
| **Script kiến trúc** | `scripts/check-architecture.mjs` — **18 quy tắc A1–A18** (A13–A14 chống vi phạm bất biến dữ liệu; **A15** cấm offset pagination; **A16** cấm SDK AI bên ngoài; **A17** chỉ `AiInferencePort` được gọi engine; **A18** cấm thư viện Excel) |
| **`packages/core`** | `id/` (ULID có prefix), `domain/` (base aggregate + `DomainError`), `stats/` (7 hàm thống kê), `routing/` (`ModuleRouter`, `ModuleKey`) |
| **`packages/contracts`** | Khung Zod + generator OpenAPI + `packages/contracts/src/openapi/` |
| **`packages/config`** | Zod validation **16 nhóm** biến môi trường (Phần 10 v4: thêm `KAFKA_*`, `AI_INFERENCE_*`, `EMBEDDING_*`, `REALTIME_*`, `IMPORT_*`) |
| **`packages/core` — cursor** | Tiện ích **keyset pagination**: `encodeCursor`/`decodeCursor` (base64url, chứa compound sort key), `buildKeysetFilter` — dùng chung cho mọi repository |
| **Module `shared`** | Port `OutboxPort`, `InboxPort`, adapter Mongo cho `outbox_event` + `processed_event`, `ModuleRouter` implementation đọc `feature_flag` |
| **Hạ tầng Kafka** | Container `kafka:3.7` KRaft single-node; 5 topic (`domain.events`, `ai.jobs`, `notification.dispatch`, `realtime.push`, `dlq.dead-letter`); producer wrapper (`KafkaProducerPort`); consumer factory + **inbox idempotency**; script tạo topic |
| **Hạ tầng realtime** | **Socket.IO gateway** mount tại `/api/v1/realtime?token=<accessToken>`; `WsAuthGuard`; adapter Redis (multi-instance); room `user:{id}` / `project:{id}` / `analysis:{id}` |
| **`apps/worker`** | Khung: **consumer Kafka** theo consumer group, outbox relay (change stream + polling fallback) publish ra Kafka, DLQ handler |
| **Đăng ký index** | Script tạo toàn bộ index của **21 collection** (Phần 8) |
| **Feature flag infra** | Collection `feature_flag` + `LegacyAwareInterceptor` (chỉ khung, chưa áp cho module nào) |

**Quy tắc kiểm thử thuộc đợt này:**

| Nhóm | Quy tắc | File test |
|---|---|---|
| Kiến trúc | A1–A12, **A15–A18** | `scripts/check-architecture.mjs` |
| Contract | C1–C8 | `apps/api/test/contract/*.spec.ts` |
| Vận hành | O1, O2, O3, O4, O9, O10, O11, O13 | `test/integration/*.spec.ts` |
| Integration | I1–I7, **I15–I18** | `test/integration/outbox-relay.spec.ts`, `inbox.spec.ts`, `kafka-producer.spec.ts`, `kafka-consumer.spec.ts`, `kafka-dlq.spec.ts` |
| Schema | S16, S17 | `test/integration/outbox-relay.spec.ts`, `inbox.spec.ts` |

**Tiêu chí nghiệm thu Đợt 1:**
1. `pnpm test:all` chạy được từ 1 lệnh, tự bật/tắt container, exit code đúng.
2. Coverage `packages/core` ≥ 90% lines (đặt ngưỡng ngay từ đợt 1 — không có giai đoạn đầu cho qua).
3. `pnpm test:arch` fail khi cố tình vi phạm A1/A2/A5 (test ngược — chứng minh checker hoạt động).
4. `docs/contracts/openapi.json` được commit và sinh lại khớp.
5. Outbox relay chạy được end-to-end trên replica set container: ghi event → relay phát → inbox nhận → `processed_event` có bản ghi.
6. Coverage tổng ≥ 70% (chỉ tính phần đã viết).
7. **v4:** Kafka chạy được end-to-end trong container: ghi event → relay publish → consumer nhận → `processed_event` có bản ghi; message lỗi → vào `dlq.dead-letter`.
8. **v4:** Socket.IO gateway: kết nối với token hợp lệ → nhận event; token sai → từ chối handshake; không có port publish ra host.
9. **v4:** `encodeCursor`/`decodeCursor` round-trip đúng; cursor sai định dạng → `VALIDATION_ERROR`.
10. **v4:** Không container nào publish port `:8000` (engine AI) hay `:9092` (Kafka) ra host.

#### 3.4.3. Đợt 2 — Tài khoản & phiên

**Module:** `auth`, `users`, `audit`

| Nội dung | Chi tiết |
|---|---|
| `auth` | 13 endpoint (Phần 7): register, login, refresh, logout, sessions, sessions/:id, OTP, đổi mật khẩu, quên mật khẩu. Refresh rotation + reuse detection (Phần 6) |
| `users` | 2 endpoint: `GET /users/me`, `PATCH /users/me`. Bỏ `DELETE /users/me` (ngoài 79 tính năng) |
| `audit` | Ghi log hành động nhạy cảm — hạ tầng cho `ADMIN-01`, `WS-09`, `PROJ-10`, `PROJ-11` |
| Domain mới | `User` aggregate (trạng thái `active/blocked`), `Session` aggregate, `AuthToken` value object, `OtpChallenge` |
| Hạ tầng | `JWTGuard`, `CASL` ability factory (5 vai trò), `ThrottlerGuard` (rate-limit theo endpoint), `AuditService` |

**Quy tắc kiểm thử thuộc đợt này:**

| Nhóm | Quy tắc |
|---|---|
| Schema | S1, S2, S3, S4, S6, S7, S11 |
| Contract | C3, C4, C5, C6 |
| Vận hành | O5, O6, O7, O8, O12, O21 |
| Bảo mật | 6 tình huống "không đăng nhập" + 3 "token bị thu hồi" + rate-limit + OTP |

**Tiêu chí nghiệm thu Đợt 2:**
1. 16 endpoint `auth`+`users` có ≥ 2 ca test; endpoint nhạy cảm (`users/me`, `audit`) ≥ 4 ca.
2. 9 tình huống phân quyền của Đợt 2 đều xanh, assert cả status + mã lỗi + không có side effect.
3. Coverage domain `auth`+`users` ≥ 90%, application ≥ 80%.
4. Refresh token rotation: dùng lại refresh cũ → thu hồi **toàn bộ** phiên (test đỏ trước, xanh sau).
5. Rate-limit: login sai 5 lần → 429; register 4 lần → 429.
6. Log không chứa password/token/giá trị ô dữ liệu (test O10, O11).
7. Báo cáo `docs/test-reports/2026-XX-XX-dot-2.md` đính kèm.

#### 3.4.4. Đợt 3 — Không gian làm việc

**Module:** `workspaces`, `projects`

| Nội dung | Chi tiết |
|---|---|
| `workspaces` | 10 endpoint. Đổi vai trò `owner\|editor\|viewer` → `owner\|member`. Bảng `workspace_member` tách collection. Nhượng quyền Owner, `last_accessed_at`, phân trang/tìm kiếm/lọc/sắp xếp |
| `projects` | 12 endpoint. Thêm `project_member` (vai trò `owner\|member\|viewer`). Bỏ `has_dataset`, thêm `status` theo vòng đời (`draft\|in_progress\|completed`) |
| Domain mới | `Workspace` aggregate (quota storage, vòng đời), `WorkspaceMember` aggregate, `Project` aggregate (vòng đời status), `ProjectMember` aggregate |
| Migration | Migrate `workspaces` + `projects` + sinh `workspace_member` + `project_member` (quy tắc M8–M11) |
| Tính năng | `WS-01`→`WS-10`, `PROJ-01`→`PROJ-05`, `PROJ-09`→`PROJ-12` |

**Quy tắc kiểm thử thuộc đợt này:**

| Nhóm | Quy tắc |
|---|---|
| Schema | S2, S3, S4, S5, S6, S7, S10 |
| Contract | C1, C2, C4 |
| Migration | M5, M7, M8, M9, M10, M11, M14, M16, M17 |
| Bảo mật | 8 "truy cập chéo workspace" + 6 "truy cập chéo project" + 6 "vai trò không đủ" (2 ca bị gỡ do bỏ quyền sửa ô/xoá dòng) |
| Vận hành | O24 (upload vượt quota bị chặn), O23 |

**Tiêu chí nghiệm thu Đợt 3:**
1. 22 endpoint có ≥ 2 ca test; endpoint nhạy cảm (`workspaces/:id/members`, `projects/:id/members`) ≥ 4 ca.
2. 20 tình huống phân quyền của Đợt 3 đều xanh.
3. Quy tắc mời: workspace có **đúng 1 Owner** sau mọi thao tác nhượng quyền; project có đúng 1 Owner.
4. Migration 4 mức (Phần 11) pass cho `workspace`/`project`/`workspace_member`/`project_member`.
5. Vòng đời `project.status` đúng: `draft` → `in_progress` → `completed`; chuyển sai bị domain error.
6. Cờ `feature_flag` bật cho `workspaces` và `projects` đã chạy canary 10% workspace.

#### 3.4.5. Đợt 4 — Dữ liệu

**Module:** `datasets`, `data-view`

| Nội dung | Chi tiết |
|---|---|
| `datasets` | 4 endpoint. Import file **`.csv` chỉ** (1 file = 1 bảng), `dataset.columns[]` với `key` `c0`/`c1` **nhúng thẳng** (không có `dataset_sheet`), `dataset_record` với `props`. Dọn file tạm khi lỗi giữa chừng. **Từ chối** file không phải `.csv` → `UNSUPPORTED_FILE_TYPE` |
| `data-view` | 6 endpoint. Lọc, sắp xếp, tìm kiếm, reset tên cột. Đọc qua port `DatasetReader`, ghi **chỉ metadata cột** qua `DatasetColumnWriter` — **không sở hữu collection**. ~~8 endpoint (có xoá dòng, sửa ô)~~ — **bỏ 2026-11-05** |
| ~~`versions`~~ | **BỎ 2026-11-05** — module `versions` không được xây dựng; tính năng lịch sử phiên bản và rollback đã gỡ khỏi phạm vi sản phẩm (Phần 2 mục 3.40) |
| Batch | Import 5.000 record/lần bằng `bulkWrite` unordered; giới hạn 50 MB/file; guard **số cột ≤ 1.000** |
| Domain mới | `Dataset` aggregate (chứa `columns[]`), `DatasetRecord` aggregate, `ColumnSchema` value object. ~~`DatasetSheet`~~ — **bỏ 2026-11-05** (chỉ CSV). ~~`DatasetVersion`~~ — **bỏ 2026-11-05** |
| **Phân trang cursor** | `data-view` và `datasets` dùng **keyset pagination** — `nextCursor`/`hasMore`, không `offset`/`total`; sort key `(created_at, _id)` hoặc `(row_index, _id)` |
| Migration | `datasets` → `dataset` (gộp `columns[]`) + `dataset_record` (props), quy tắc M13–M15; **`dataset_sheet` không migrate** (M27); dataset không phải CSV → bỏ qua (M28) |

**Quy tắc kiểm thử thuộc đợt này:**

| Nhóm | Quy tắc |
|---|---|
| Schema | S8, S10, S13, S14, S15, **S19** (insert-only `dataset_record`), **S20** (không `dataset_sheet`), **S21** (`columns[].key` = `c{i}`) |
| Contract | C5, C7, **C9–C13** (cursor + từ chối `.xlsx`) |
| Migration | M6, M12, M13, M14, M15, **M27, M28** |
| Vận hành | O24, **O34** |
| Tích hợp | — |
| Kiến trúc | **A13, A14** (cấm route ghi `dataset_record` ngoài Import), **A15** (cấm offset), **A18** (cấm thư viện Excel) |

**Tiêu chí nghiệm thu Đợt 4:**
1. 10 endpoint có ≥ 2 ca test.
2. Import 50.000 dòng × 10 cột hoàn tất, `row_count` khớp `dataset.row_count`, `props` đúng key `c0..c9`.
3. Import file có tên cột trùng → lỗi rõ ràng, file tạm **không** còn sót trong storage.
3b. **v4** Upload `.xlsx` → `400 UNSUPPORTED_FILE_TYPE`; upload `.csv` → `dataset.columns[].key` = `c0..c9`.
4. Đảo ngược `props` → tên cột gốc giống hệt file nguồn (quy tắc M15).
5. `storage_key` không lộ ra response (S14).
6. **Bất biến dữ liệu**: `dataset_record` chỉ có đường ghi INSERT lúc Import — checker A13/A14 và test S19 đều xanh; không route nào ghi được ngoài import.
7. Migration hash mẫu 1% — sai lệch 0.
8. **v4** Phân trang cursor: duyệt 3 trang bằng `nextCursor` → không trùng, không thiếu, đúng thứ tự; `meta` **không** có `total`/`offset`.

#### 3.4.6. Đợt 5 — Phân tích & AI

**Module:** `analysis`, `ai`, `summary`, `reports`

| Nội dung | Chi tiết |
|---|---|
| `analysis` | 7 endpoint + DQ-01→DQ-05. `analysis_run`, `analysis_result`, `cell_evidence`. Dùng `simple-statistics` + `ml-matrix` (Phần 12). Tương quan, VIF, mất cân bằng lớp |
| `ai` | 2 endpoint. Port `AiInferencePort` + **adapter suy luận cục bộ** (OpenAI-compatible HTTP tới `ai-engine`), job bất đồng bộ qua Kafka topic `ai.jobs`, **che PII trước khi gửi**. Timeout **180s**, concurrency 1, RAM guard. **Không** SDK AI bên ngoài |
| **Engine AI** | Container `ai-engine`: **vLLM** (prod, OpenAI-compatible `:8000`) / **Ollama** (dev, `:11434`). **5 model ứng viên** tải về cho benchmark (`Qwen3-14B`, `Gemma-3-12B`, `Qwen3-8B`, `Llama-3.1-8B`, `Vistral-7B`); sau benchmark chỉ giữ **2 model** của kiến trúc định tuyến. Checksum SHA-256 từng file model. **Không publish port ra host** |
| **Embedding cục bộ** | `Qwen3-Embedding-0.6B` (~1,2 GB RSS) — sinh vector cho `feedback_example`, truy xuất cosine top-5 |
| `summary` | 3 endpoint. `project_save` — tạo Tổng kết, lưu trạng thái project, khôi phục |
| `reports` | 1 endpoint. Xuất PDF — **sinh ở worker**, không ở API |
| Domain mới | `AnalysisRun`, `AnalysisResult`, `CellEvidence`, `AiJob`, `ProjectSave` aggregate |
| Tính năng | `DQ-01`→`DQ-05`, `ANALYSIS-01`→`ANALYSIS-07`, `AI-01`, `SUMMARY-01`, `REPORT-01` |

**Quy tắc kiểm thử thuộc đợt này:**

| Nhóm | Quy tắc |
|---|---|
| Schema | S2, S3, S4, S7 |
| Contract | C6, C7 |
| Tích hợp | I11, I12, I13, **I21** (job AI qua Kafka) |
| Vận hành | O22 (outbox pending > 300s), **O29–O33** (port AI/Kafka không publish, checksum model, RAM guard, Kafka lag, health engine) |
| Domain | 7 hàm thống kê — mỗi hàm ≥ 1 ca biên |
| **Tầng 9** | Benchmark **5 model × 9 chỉ số** (`pnpm test:benchmark`) — chạy **thủ công**, không trong `test:all`; 200 mẫu × 3 lần/model |

**Tiêu chí nghiệm thu Đợt 5:**
1. 12 endpoint có ≥ 2 ca test.
2. **7 hàm thống kê có ca biên bắt buộc**: mẫu rỗng, 1 phần tử, toàn hằng (IQR = 0, MAD = 0), ma trận không khả nghịch (VIF → `null`, không ném).
3. `ai` test **không bao giờ** gọi network ra ngoài — verify bằng network mock (chỉ tầng 9 được gọi engine thật, trong container).
4. Che PII: giá trị ô dữ liệu không xuất hiện trong payload gửi engine (test I12).
5. PDF sinh ở worker — test kiểm tra API **không** chứa mã sinh PDF (quy tắc I13, kiến trúc).
6. Job AI timeout **180s** → chuyến trạng thái thất bại có kiểm soát, không treo; concurrency = 1.
7. Coverage `packages/core/src/stats/` ≥ 95% branches.
8. **v4** RAM guard: RSS engine > 85% RAM máy → worker **dừng nhận** job AI mới, job đang chờ giữ nguyên trong Kafka.
9. **v5** Báo cáo benchmark **từng model** lưu vào `docs/test-reports/benchmark-<model>-<ngày>.md` trước khi chốt; phải có đủ 5 báo cáo + báo cáo tổng hợp (điểm 9 chỉ số, p-value McNemar/Wilcoxon, đường Pareto) mới được chốt cặp model production.

#### 3.4.6b. Work package bổ sung v6 — DQ-05 có điều kiện + AI đánh giá tương quan/VIF (~+4 ngày công)

- `analysis`: thêm `dq05.status/unassessed-assessed`, thực thi quy tắc theo dòng + checklist 5 điểm (Phần 2 v7 mục 3.5.5); dựng **ma trận tương quan + bảng VIF** theo Phần 2 v7 mục 3.23.1–3.23.2.
- `ai`: thêm prompt `corr-v1` + kiểm chứng trích dẫn số ma trận/VIF (Phần 12 v6 mục 3.6); rule feedback cho quy tắc DQ-05.
- Test: 5 quy tắc S24/C14/I22/I23/O36 (Phần 13 v6 mục 3.11b). Tổng dự án **~185,5 → ~189,5 ngày công**.

#### 3.4.7. Đợt 6 — Hoàn tất & cutover

**Module:** `notifications`, `issues` + toàn bộ migration & dọn dẹp.

| Nội dung | Chi tiết |
|---|---|
| `notifications` | 3 endpoint. Trung tâm thông báo, công tắc bật/tắt, tiêu thụ sự kiện. `source_event_id` unique partial → idempotent |
| `issues` | 4 endpoint. Báo cáo sự cố, vòng đời trạng thái, duyệt báo cáo, upload tệp đính kèm |
| **Migration cutover** | Toàn bộ 8 script `scripts/migrate-*.ts` chạy theo 8 bước Phần 11: backup → verify → migrate → verify → đổi cờ → xoá legacy → drop collection → rollback window 30 ngày |
| **Dọn dẹp** | Xoá **5** module `clean-rules`, `lineage`, `versions`, `cell-edit`, `exports`; gỡ `neo4j-driver` khỏi `package.json`; xoá `Neo4j-*` config; **drop 7 collection LEGACY** (`clean_rules`, `lineage`, `lineage_nodes`, `exports`, `export_tasks`, `dataset_versions`, `dataset_sheet`) |
| **Realtime** | Bật **Socket.IO gateway** thật: kết nối `/api/v1/realtime?token=…`, phòng `user:{id}`/`project:{id}`/`analysis:{id}`; adapter Redis |
| **Bàn giao** | `docs/test-reports/index.md`, tài liệu vận hành, checklist Phần 15 |

**Quy tắc kiểm thử thuộc đợt này:**

| Nhóm | Quy tắc |
|---|---|
| Schema | S18 (notification unique partial), S15 |
| Migration | M1, M2, M3, M4, M18, M19, M20, M21, M22, M24, **M27–M29** |
| Vận hành | O14, O15, O16, O17, O19, O20, O25, O26, O27, O28, **O32** (Kafka lag = 0) |
| Tích hợp | **I19** (realtime push), **I20** (notification dispatch) |
| Bảo mật | 3 "đối tượng đã xoá" + 4 "SYS-ADMIN vượt phạm vi" |

**Tiêu chí nghiệm thu Đợt 6:**
1. Migration chạy 2 lần cho kết quả giống nhau (idempotent — M3).
2. Verify 4 mức pass: counts khớp công thức, hash mẫu 1% sai lệch 0, 0 orphan, 0 membership trùng.
3. Script drop từ chối chạy khi chưa verify (M20) và chỉ xoá đúng **7** collection LEGACY (M21).
4. `migrate` mặc định dry-run; `--apply` yêu cầu `MIGRATION_CONFIRM=yes`.
5. Sau cutover, request trả đúng dữ liệu (smoke test toàn bộ **85 endpoint**).
6. Module `clean-rules`, `lineage`, `versions`, `cell-edit`, `exports` đã xoá khỏi repo; `neo4j-driver` không còn trong `package.json`.
7. **112/120 quy tắc tự động xanh; 8 quy tắc thủ công có dòng ghi nhận tên người + ngày.**
8. `pnpm test:all` xanh, coverage đạt cả 5 ngưỡng tầng.
9. **v4** Không còn `dataset_sheet` trong DB; mọi `dataset.file_format` = `csv` (M27, M28).
10. **v4** Tất cả consumer group Kafka có lag = 0; `dlq.dead-letter` rỗng (O32).

#### 3.4.8. Đợt 7 — Feedback & học lại (v4)

**Module:** `feedback`

| Nội dung | Chi tiết |
|---|---|
| `feedback` | 5 endpoint. Nhận xét kết quả (mỗi phát hiện / mỗi lần phân tích), sửa nhận xét, xoá mềm, thống kê chất lượng AI theo project |
| Domain mới | `FindingFeedback` aggregate (append-only), `FeedbackExample` aggregate (kho mẫu ẩn danh hoá) |
| **Ghi nhận** | `finding_feedback` — append-only, lưu `label`, `reason`, `suggested_severity`, **ảnh chụp** `ai_confidence`/`ai_rationale`, `author_role_at_time`, `model_id`, `prompt_version` |
| **Học lại (T1 RAG)** | Worker chuẩn hoá nhận xét → sinh `feedback_example` (ẩn danh hoá, `trust_score` từ ≥ 3 người, `embedding` cục bộ) → truy xuất cosine **top-5** → inject vào prompt lượt suy luận tiếp theo |
| **Bảo vệ PII** | Mẫu trong kho **không** chứa tên/SĐT/email/số liệu cụ thể — kiểm tra bắt buộc trước khi ghi |
| Phân quyền | `PROJ-VIEWER` được nhận xét; `SYS-ADMIN` **không** có quyền với nhóm `FB-*` (Phần 6 v5 mục 3.5b) |
| Migration | **Không có nguồn** — chỉ tạo collection + index (M29); Atlas Vector Search phải được bật |

**Quy tắc kiểm thử thuộc đợt này:**

| Nhóm | Quy tắc |
|---|---|
| Schema | **S22** (append-only), **S23** (`trust_score` / TTL 180 ngày) |
| Contract | C1–C4, C9 (cursor), **C13** (CSV — nhóm feedback không đọc file nhưng chung contract) |
| Tích hợp | **I19** (realtime push khi có nhận xét mới) |
| Vận hành | **O30** (checksum model), **O32** (Kafka lag) |
| Migration | **M29** (2 collection feedback có đủ index) |
| Bảo mật | 12 tình huống phân quyền mới của nhóm `FB-*` (Phần 6 v5 mục 3.17 #37–#48) |
| Tích hợp RAG | Vòng lặp 7 bước (Phần 13 mục 3.10b.3) — tầng 4, fake embedding adapter |

**Tiêu chí nghiệm thu Đợt 7:**
1. 5 endpoint có ≥ 2 ca test; quyền theo vai trò đúng (viewer được nhận xét, admin bị chặn).
2. Nhận xét lưu **append-only**; sửa nhận xét cập nhật `updated_at`, **không** xoá dữ liệu gốc.
3. `ai_confidence`/`ai_rationale` là **ảnh chụp** tại thời điểm nhận xét — AI chạy lại **không** đổi giá trị này.
4. Mẫu vào kho **không chứa PII** — test regex bắt buộc.
5. Vòng lặp học lại chạy đúng 7 bước; mẫu `trust_score < 0,6` **không** được inject.
6. Xoá project → mẫu ẩn danh hoá **được giữ**, nhận xét gốc bị xoá.
7. Truy xuất top-5 theo `column_profile` trả về đúng mẫu liên quan.

### 3.5. Ước lượng khối lượng — chi tiết theo module

**Đơn vị: ngày công** (1 ngày = 8 giờ công thực hiện). Bao gồm cả viết code **và** viết test theo tầng.

#### 3.5.1. Phần hạ tầng (Đợt 1)

| Hạng mục | Ngày công |
|---|---|
| Monorepo setup + cấu trúc `apps/`, `packages/` | 1,5 |
| `packages/core` — id, domain base, DomainError | 1,5 |
| `packages/core/stats` — 7 hàm + test biên | 3 |
| `packages/contracts` — khung Zod + generator OpenAPI | 2 |
| `packages/config` — Zod env validation **16 nhóm** (thêm `KAFKA_*`, `AI_INFERENCE_*`, `EMBEDDING_*`, `REALTIME_*`, `IMPORT_*`) | 1,5 |
| `packages/core` — **cursor pagination** (`encodeCursor`/`decodeCursor`/`buildKeysetFilter`) + test | 2 |
| Hạ tầng **Kafka** — producer wrapper, consumer factory + inbox idempotency, script tạo 5 topic, DLQ handler | 4 |
| Hạ tầng **Socket.IO** — gateway (`/api/v1/realtime`), `WsAuthGuard`, adapter Redis, 3 room | 3 |
| `docker-compose.test.yml` — thêm container **Kafka KRaft** | 0,5 |
| `jest.unit.json` 4 project + `jest-e2e.json` + setup-env | 1 |
| `docker-compose.test.yml` + hướng dẫn replica set | 1,5 |
| `scripts/check-architecture.mjs` — **18 quy tắc** (A1–A18) | 2,5 |
| Module `shared` — outbox/inbox port + adapter | 2,5 |
| `apps/worker` khung — consumer Kafka + relay | 2,5 |
| Script tạo index 21 collection | 1 |
| Feature flag infra + interceptor | 1,5 |
| `scripts/generate-test-report.mjs` | 1 |
| **Tổng Đợt 1** | **~34** |

#### 3.5.2. Phần module (Đợt 2–6)

| Module | Use case | Endpoint | Domain | Application | Adapter | Test (tầng 3/5/7) | Tổng |
|---|---|---|---|---|---|---|---|
| `auth` | 13 | 13 | 3,5 | 4 | 2 | 5 | 14,5 |
| `users` | 3 | 2 | 1 | 1 | 0,5 | 1,5 | 4 |
| `audit` | 1 | 0 | 0,5 | 1 | 0,5 | 1 | 3 |
| `workspaces` | 10 | 10 | 2,5 | 3 | 1,5 | 4 | 11 |
| `projects` | 12 | 12 | 3 | 3,5 | 1,5 | 4,5 | 12,5 |
| `datasets` | 8 | 4 | 3 | 3 | 3 | 5 | 14 |
| `data-view` | 8 | 6 | 2 | 3 | 1 | 3 | 8 |
| `analysis` | 10 | 7 | 4 | 3,5 | 2 | 5 | 14,5 |
| `ai` | 3 | 1 | 1 | 1,5 | 1,5 | 2 | 6 |
| `summary` | 3 | 3 | 1 | 1,5 | 1 | 2 | 5,5 |
| `reports` | 2 | 1 | 0,5 | 1 | 1 | 1,5 | 4 |
| `notifications` | 4 | 3 | 1 | 1,5 | 1 | 2 | 5,5 |
| `issues` | 5 | 4 | 1,5 | 2 | 1 | 2,5 | 7 |
| `feedback` | 5 | 5 | 1,5 | 2 | 1,5 | 3 | 9,5 |
| `ai` (**v4** — engine cục bộ) | +2 | 0 | 0 | 1,5 | 2,5 | 1 | 5,5 |
| `datasets` (**v4** — bỏ sheet) | −1 | 0 | −0,5 | −0,5 | −0,5 | 0 | −1,5 |
| **Tổng module** | **84** | **78** | **26** | **34** | **22,5** | **43,5** | **~132** |

#### 3.5.3. Phần migration & bàn giao (Đợt 6)

| Hạng mục | Ngày công |
|---|---|
| 8 script `migrate-*.ts` | 6 |
| Verify 4 mức | 2,5 |
| Cutover + rollback window giám sát | 2 |
| Xoá 5 module LEGACY + gỡ Neo4j | 1 |
| **v4** Bỏ `dataset_sheet` khỏi migrate + bỏ qua dataset không-CSV (M27, M28) | 1 |
| **v4** Tạo 2 collection feedback + vector index (M29) | 0,5 |
| Tài liệu bàn giao + `test-reports/index.md` | 2 |
| **Tổng** | **15** |

#### 3.5.4. Tổng hợp

| Nhóm | Ngày công |
|---|---|
| Hạ tầng (Đợt 1) | 34 |
| 16 module (Đợt 2–7) | 132 |
| Migration & bàn giao (Đợt 6) | 15 |
| **TỔNG** | **~181 ngày công** |

**Ước lượng theo mô hình người + AI:** ~181 ngày công chuẩn hóa ↔ **~53–71 đơn vị thực thi** (mục 3.6.3).

**Đối chiếu với Phần 13:** Phần 13 v4 ước lượng **~46 ngày công chỉ cho phần test** (v2: ~38, +8 do thêm tầng 9, cursor, Kafka, feedback). Con số ~181 ngày công ở đây **bao gồm cả ~46 ngày test đó** → phần code = **~135 ngày công**. Tỷ lệ test/code ≈ 25/75, hợp lý với TDD nghiêm.

**Ghi chú quan trọng:** ~181 ngày công là đơn vị **chuẩn hóa** (1 người, 8 giờ/ngày), dùng để so sánh giữa các đợt và giữ quy mô khối lượng. **Không phải dự đoán lịch thực tế** — mô hình thực thi là người + AI, xem mục 3.6.3.

**Chi tiết ~181 ngày công theo đợt (v4):**

| Đợt | Hạ tầng | Module | Migration | Tổng | So với bảng 3.4.1 |
|---|---|---|---|---|---|
| Đợt 1 | 34 | — | — | **34** | 12–14 (ước thấp, đã cập nhật) |
| Đợt 2 | — | 21,5 | — | **21,5** | 12–14 (đã cập nhật) |
| Đợt 3 | — | 23,5 | 2 | **25,5** | 11–13 (đã cập nhật) |
| Đợt 4 | — | 22,5 | 1,5 | **24** | 9–11 (v4: bỏ `dataset_sheet`, thêm cursor) |
| Đợt 5 | — | 35,5 | — | **35,5** | 11–13 (v4: +engine AI cục bộ) |
| Đợt 6 | — | 11,5 | 12 | **23,5** | 9–11 (v4: drop 7 collection LEGACY) |
| Đợt 7 | — | 9,5 | 0,5 | **10** | 4–5 (v4: module `feedback`) |
| **Tổng** | **34** | **124** | **16** | **~181** | |

**Căn cứ điều chỉnh (v4 — 2026-11-05):**
- Đợt 1: thêm cursor pagination (2), hạ tầng Kafka (4), hạ tầng Socket.IO (3), 5 nhóm biến môi trường (0,5), checker thêm 4 quy tắc (0,5), container Kafka test (0,5) → tăng ~10,5 ngày công (22 → 34).
- Đợt 4: bỏ `dataset_sheet` (−1,5) nhưng thêm cursor pagination cho `data-view`/`datasets` (+2) → tăng ~0,5 ngày công.
- Đợt 5: thêm engine AI cục bộ (vLLM/Ollama + RAM guard + checksum) + **benchmark 5 model / 9 chỉ số + kiểm định thống kê** → tăng ~10 ngày công (30 → 40).
- Đợt 6: drop **7** collection LEGACY (thay vì 5) + không migrate `dataset_sheet` → tăng ~2 ngày công.
- Đợt 7 (mới): module `feedback` + kho học lại + RAG → ~10 ngày công.

**Căn cứ điều chỉnh (v2 — 2026-11-05):**
- Đợt 4: bỏ module `versions` (7 ngày công) và bỏ 2 endpoint xoá dòng/sửa ô trong `data-view` (khoảng 3,5 ngày công) → giảm ~7,5 ngày công.
- Đợt 6: thêm việc xoá 2 module (`versions`, `cell-edit`) và bỏ script migrate `dataset_versions` → giảm ~1,5 ngày công, tăng ~0,5 ngày công cho kiểm chứng → giảm ~0,5 ngày công.
- Không thay đổi ước lượng ở Đợt 1, 2, 3, 5 vì các tính năng bị bỏ không nằm trong các đợt này.

### 3.6. Lịch trình và cách ước lượng thực tế

#### 3.6.1. Vấn đề phát hiện khi đối chiếu

Bảng ước lượng ở mục 3.5 cho **~181 ngày công** theo chuẩn "1 người, 8 giờ/ngày". Quyết định ban đầu "1 tuần/đợt × 7 đợt = 7 tuần" mâu thuẫn với con số đó.

| Vấn đề | Số liệu |
|---|---|
| Nếu 1 người, 8 giờ/ngày, 5 ngày/tuần | ~181 ngày công ≈ **36 tuần** |
| Quyết định "1 tuần/đợt" | 7 tuần |
| **Chênh lệch** | ~29 tuần |

**Nhưng quyết định cuối cùng của người dùng là: không cần chia đợt như một ràng buộc lịch.** Việc thực thi sẽ do **người dùng + AI làm liên tục**, nên con số "ngày công của 1 người" không phản ánh thực tế.

#### 3.6.2. Cách hiểu mới về "đợt"

| Khái niệm | Ý nghĩa |
|---|---|
| **Đợt = đơn vị công việc logic** | Một nhóm module có phụ thuộc chặt chẽ, xong thì có 1 checkpoint nghiệm thu rõ ràng |
| **Đợt ≠ mốc thời gian** | Không có cam kết "Đợt 3 xong trong 1 tuần". Tiến độ thực tế phụ thuộc tốc độ làm việc chung |
| **Đợt ≠ hạn chót nghiệm thu khách hàng** | Cổng nghiệm thu là **điều kiện kỹ thuật để đi tiếp**, không phải mốc giao hàng |
| **Cổng nghiệm thu vẫn giữ nguyên** | Không vì bỏ ràng buộc lịch mà bỏ tiêu chí chất lượng — 9 mục ở mục 3.8 vẫn bắt buộc |

**Lý do giữ cấu trúc 7 đợt:** đơn vị công việc này quá lớn để làm một lần, và phụ thuộc giữa các đợt là **kỹ thuật chứ không phải thời gian** (Đợt 3 cần `auth` xong; Đợt 5 cần `datasets` xong). Giữ ranh giới đợt giúp:

- Mỗi đợt có một **điểm kiểm soát** rõ ràng → phát hiện sai sót sớm.
- Nếu cần **dừng giữa chừng** (hết thời gian, đổi ưu tiên), vẫn có một trạng thái chạy được.
- Đối chiếu trực tiếp với **6 đơn vị đánh giá** của Phần 15.

#### 3.6.3. Ước lượng theo mô hình người + AI

Bảng 3.5.4 chia ~181 ngày công thành 3 phần. Với mô hình làm việc chung, mỗi phần được ước lượng lại:

| Phần | Ngày công (1 người) | Mô hình người + AI | Ghi chú |
|---|---|---|---|
| **Thiết kế & quyết định** | ~15 | **~3–5** | Người dùng chốt, AI đối chiếu tài liệu đã chốt ở Phần 1–14 |
| **Viết code** | ~95 | **~28–38** | AI viết phần lớn; người dùng review + sửa chỗ logic nhạy cảm (quyền, migration, transaction) |
| **Viết test** | ~46 | **~14–19** | AI sinh test theo ma trận 120 quy tắc; người dùng xác nhận ca bắt buộc |
| **Tổng** | **~181** | **~53–71** | |

**Con số này cũng là ước lượng, không phải cam kết** — cùng cảnh báo với K18.

#### 3.6.4. Ba phương án giữ nguyên phạm vi (tham khảo, không bắt buộc chọn)

Nếu sau này cần rút ngắn thêm, các phương án đã được phân tích:

| Phương án | Cách làm | Lợi | Hại |
|---|---|---|---|
| **A. Chia việc cho AI nhiều hơn** | AI viết cả test lẫn code, người dùng tập trung review quyền/migration/transaction | Giảm rõ rệt thời gian | Chất lượng review phụ thuộc kỷ luật |
| **B. Cắt phạm vi** | ~~Hoãn `versions` (7 ngày công)~~ — **đã bỏ hẳn 2026-11-05**; còn lại: PDF `reports` (4 ngày), `data-view` nâng cao (4 ngày), **tầng 9 benchmark (3 ngày)** | Giảm ~11 ngày công | ~~Tạo nợ kỹ thuật~~ — không còn áp dụng vì `versions` đã gỡ khỏi phạm vi (79 tính năng) |
| **C. Thêm người** | Người A làm Đợt 1 + review chéo; người B làm Đợt 2–3 | Giảm thời gian còn lại | Phải bổ sung quy trình review 2 người (quyết định 9 hiện là "tự review") |

**Khuyến nghị:** **Phương án A** — phù hợp với mô hình đã chốt (người + AI), không cắt tính năng, không cần thêm người.

#### 3.6.5. Quy tắc về điều chỉnh giữa chứng

| # | Quy tắc |
|---|---|
| 1 | Ước lượng ở mục 3.5 được **cập nhật sau mỗi đợt** (quy tắc K17) |
| 2 | Nếu tốc độ thực tế lệch > 30% so với ước lượng → **dừng lại, điều chỉnh phạm vi** trước khi tiếp tục (K16) |
| 3 | Việc "dừng lại" được phép xảy ra **giữa đợt**, không phải chỉ giữa các đợt — luôn giữ được trạng thái chạy được |
| 4 | Ước lượng phải ghi kèm **ngày đo**, không chỉ con số |
| 5 | Không dùng ước lượng để áp lợi ép tốc độ — mục tiêu là **đúng và kiểm chứng được**, không phải nhanh nhất |

### 3.7. Quy trình commit, branch và PR

#### 3.7.1. Nhánh

| Quy tắc | Nội dung |
|---|---|
| 1 | Nhánh duy nhất: **`Hoa24102026`** |
| 2 | Không tạo nhánh con — quyết định 4 |
| 3 | Không merge vào `main` cho tới khi Phần 15 (đánh giá cuối) xác nhận |
| 4 | Nhánh này là nơi chứa toàn bộ quá trình tái cấu trúc |
| 5 | Trước khi bắt đầu: tạo tag `pre-refactor` trên commit hiện tại để rollback được |

#### 3.7.2. Quy ước commit

**Conventional Commits + scope theo module (quyết định 8):**

```
<type>(<scope>): <mô tả>

[body: giải thích "tại sao", không phải "cái gì"]

[refs: UC-xx, RULE-xx]
```

| Kiểu | Dùng khi nào | Ví dụ |
|---|---|---|
| `feat` | Thêm tính năng mới | `feat(auth): thêm refresh token rotation và reuse detection` |
| `refactor` | Đổi cấu trúc không đổi hành vi | `refactor(projects): tách domain khỏi Mongoose schema` |
| `test` | Chỉ thêm/sửa test | `test(auth): bổ sung ca OTP hết hạn` |
| `fix` | Sửa lỗi | `fix(datasets): xoá file tạm khi import lỗi giữa chừng` |
| `docs` | Tài liệu | `docs(contracts): cập nhật openapi snapshot` |
| `chore` | Tooling, config | `chore(deps): thêm simple-statistics và ml-matrix` |
| `refactor!` | Breaking change | `refactor(datasets)!: đổi `data` sang `props` (M14)` |

**Scope:** tên module — `auth`, `users`, `audit`, `workspaces`, `projects`, `datasets`, `data-view`, `analysis`, `ai`, `summary`, `reports`, `notifications`, `issues`, `shared`, `core`, `contracts`, `worker`, `test`, `infra`. ~~`versions`~~ đã bị gỡ khỏi phạm vi (2026-11-05).

**Tiền tố đợt trong body (không phải trong type):**

```
feat(auth): thêm refresh token rotation

Đợt 2 — refactor(auth) theo hexagonal.
Áp dụng UC-32, UC-33, UC-34.
Quy tắc liên quan: O12, C3.
```

**Quy tắc bắt buộc:**
1. Một commit = một ý nghĩa. Không gộp 3 module vào 1 commit.
2. Commit message **tiếng Việt hoặc tiếng Anh đều được**, nhưng phải nhất quán trong cùng nhánh.
3. Body phải nêu **UC nào** và **quy tắc test nào** được áp dụng → giúp tra ngược khi có sự cố.
4. Không commit file `.env`, `atlas-credentials.env`, `certs/`, `*.pem`.
5. Không commit `dist/`, `coverage/`, `node_modules/` — kiểm tra `.gitignore` ở đợt 1.

#### 3.7.3. Quy trình PR (tự review — quyết định 9)

Không có người review thứ hai, nên bằng chứng thay cho người review:

**Checklist PR (bắt buộc, đính kèm trong mô tả PR):**

| # | Mục kiểm tra | Nguồn |
|---|---|---|
| 1 | `pnpm test:all` xanh | Phần 13 mục 3.13.1 |
| 2 | `pnpm test:coverage` đạt ngưỡng 5 tầng | Phần 13 mục 3.13.2 |
| 3 | `pnpm test:arch` xanh (12 quy tắc A1–A12) | Phần 13 mục 3.8 |
| 4 | Ước lượng khối lượng đợt — cập nhật sau khi làm | Mục 3.5 |
| 5 | Danh sách quy tắc test đã đạt (mã S/C/I/O/M) | Phần 13 mục 3.11 |
| 6 | Ưu tiên cao: thao tác xoá dữ liệu — đã có xác nhận | Mục 3.9 |
| 7 | Đã đọc lại diff — không có debug log, `console.log`, `TODO` bỏ quên | — |
| 8 | Đã đính kèm báo cáo `docs/test-reports/<đợt>-<ngày>.md` | Phần 13 mục 3.14 |
| 9 | Migration script chạy được `--dry-run` không lỗi | Phần 11 |
| 10 | Feature flag mặc định `legacy` | Mục 3.2 |
| 11 | Không có phụ thuộc chéo module mới (A5) | Phần 13 mục 3.8 |
| 12 | `pnpm type-check` xanh | — |

**Quy tắc bắt buộc:**
1. Không merge nếu còn mục checklist chưa tick.
2. Mục 8 (báo cáo test) là bắt buộc — không có báo cáo thì PR không hoàn tất.
3. Với đợt 3–6, bắt buộc chạy `pnpm test:perf` (k6) trước khi merge — nằm ngoài `test:all`.
4. Nếu một mục checklist **không thể** tick → ghi rõ lý do trong PR và ghi vào `docs/test-reports/flaky.md` nếu liên quan test lỗi.
5. PR quá 1.500 dòng thay đổi → **phải tách** thành nhiều PR, dù không có nhánh con.

### 3.8. Cổng nghiệm thu giữa các đợt

Mỗi đợt kết thúc phải qua một cổng (gate) trước khi sang đợt sau:

```
  ┌─────────────────────────────────────────────────────────┐
  │                  CỔNG NGHIỆM THU ĐỢT N                 │
  │                                                         │
  │  1. Test tự động        pnpm test:all        → xanh    │
  │  2. Coverage 5 tầng     pnpm test:coverage    → đạt     │
  │  3. Kiến trúc           pnpm test:arch        → xanh    │
  │  4. Hiệu năng           pnpm test:perf        → đạt    │  (Đợt 3+)
  │  5. Quy tắc đợt         ma trận 120 quy tắc   → đạt    │
  │  6. Báo cáo             docs/test-reports/    → có     │
  │  7. Tự review           checklist 12 mục      → tick   │
  │  8. Cập nhật ước lượng  mục 3.5               → cập nhật│
  │  9. Tag phiên bản       git tag dot-N         → có     │
  │                                                         │
  │            FAIL bất kỳ mục nào → KHÔNG sang đợt sau   │
  └─────────────────────────────────────────────────────────┘
```

**Quy tắc bắt buộc:**
1. Đợt sau **không bắt đầu** khi đợt hiện tại chưa qua cổng.
2. Mỗi đợt kết thúc → `git tag dot-N` → điểm rollback.
3. Khi đợt 6 cutover thành công → `git tag v2.0.0`.

### 3.9. Quy trình cutover theo từng nhóm module

**Khác biệt so với Phần 11:** Phần 11 mô tả **một lần cutover lớn** (8 bước, dừng cả API lẫn worker). Phần 14 này áp dụng **cắt nhỏ theo nhóm module** (quyết định 10) — vẫn giữ nguyên 8 bước, chỉ chạy cho tập collection của nhóm đó.

| Bước | Nội dung | Áp dụng cho nhóm module |
|---|---|---|
| 1 | **Backup** trước cutover (`mongodump` → R2) | Nhóm collection bị ảnh hưởng |
| 2 | **Dry-run** script migrate (`--dry-run`) — không ghi | Nhóm đó |
| 3 | **Migrate** (`--apply`) theo batch 5.000 | Nhóm đó |
| 4 | **Verify** 4 mức (counts, hash 1%, referential, permissions) | Nhóm đó |
| 5 | **Bật cờ** `feature_flag` cho module → canary 10% → 100% | Module đó |
| 6 | Theo dõi 24h (error rate, p95, outbox pending) | — |
| 7 | **Xoá collection cũ** của nhóm (sau khi cờ đã ổn định 7 ngày) | Nhóm đó |
| 8 | **Giữ rollback window 30 ngày** — trước khi drop | — |

**Quy tắc bắt buộc:**
1. Mỗi nhóm module có **một lần cutover riêng**, không gộp — giảm rủi ro và blast radius.
2. Bước 1–4 có thể chạy **khi worker đang chạy** (vì mới ghi vào collection MỚI, không đụng collection cũ).
3. Bước 5–7 cần **dừng worker** trong 1 phút (để không có ghi vào collection cũ trong lúc đổi cờ) — đây là điểm khác biệt so với cutover lớn của Phần 11 vốn dừng cả API lẫn worker.
4. Nếu verify mức 2 (hash) lệch > 0 → **dừng**, không bật cờ, rollback.
5. Drop collection cũ **chỉ sau 7 ngày** cờ ổn định 100% — không drop ngay sau khi bật.
6. Script drop **từ chối chạy** nếu chưa có file verify pass (quy tắc M20).

**Lịch cắt nhóm (nhúng vào đợt tương ứng):**

| Đợt | Nhóm cắt | Collection liên quan | Script |
|---|---|---|---|
| Đợt 2 | Tài khoản | `users` → `user`, `sessions` → `user_session` | `migrate-users.ts`, `migrate-sessions.ts` |
| Đợt 3 | Không gian | `workspaces` → `workspace` + `workspace_member`, `projects` → `project` + `project_member` | `migrate-workspaces.ts`, `migrate-projects.ts` |
| Đợt 4 | Dữ liệu | `datasets` → `dataset` (gộp `columns[]`) + `dataset_record` | `migrate-datasets.ts`, `migrate-records.ts` |
| Đợt 5 | Phân tích | `analysis_runs` → `analysis_run` + `analysis_result` + `cell_evidence` | `migrate-analysis.ts` |
| Đợt 6 | Hoàn tất | `notifications`, `issue_reports`, `audit_logs` + drop LEGACY (5 collection, gồm `dataset_versions`) | `migrate-misc.ts`, `drop-legacy.ts` |

### 3.10. Staging cục bộ

**Quyết định 11:** không có staging trên cloud. Môi trường thử trước cutover là **docker-compose local**.

```yaml
# docker-compose.dev.yml (dùng cho staging cục bộ)
name: dq-staging

services:
  mongo:
    image: mongo:7
    command: ["--replSet", "rs0", "--bind_ip_all"]
    ports: ["27018:27017"]
  redis:
    image: redis:7-alpine
    ports: ["6380:6379"]
  kafka:
    image: kafka:3.7
    # KRaft single-node — không publish :9092 ra host
    environment:
      KAFKA_NODE_ID: 1
      KAFKA_PROCESS_ROLES: broker,controller
      KAFKA_LISTENERS: PLAINTEXT://kafka:9092,CONTROLLER://kafka:9093
      KAFKA_ADVERTISED_LISTENERS: PLAINTEXT://kafka:9092
      KAFKA_CONTROLLER_QUORUM_VOTERS: 1@kafka:9093
      KAFKA_OFFSETS_TOPIC_REPLICATION_FACTOR: 1
    volumes: ["kafka-data:/var/lib/kafka/data"]
  ai-engine:
    image: vllm/vllm-openai:latest
    # Không publish :8000 ra host — chỉ trong mạng compose
    environment:
      MODEL_ID: ${AI_MODEL_ID}   # chốt sau benchmark
      MAX_MODEL_LEN: "8192"
    volumes: ["./models:/models:ro"]
    deploy:
      resources:
        limits:
          memory: 11G
  minio:
    image: minio/minio:latest
    command: server /data
    environment:
      MINIO_ROOT_USER: staging
      MINIO_ROOT_PASSWORD: stagingpass
    ports: ["9000:9000"]
  api:
    build:
      context: .
      dockerfile: apps/api/Dockerfile
    environment:
      NODE_ENV: staging
      MONGODB_URI: mongodb://mongo:27017/dq-staging?replicaSet=rs0
      REDIS_URL: redis://redis:6379
      S3_ENDPOINT: http://minio:9000
      KAFKA_BROKERS: kafka:9092
      REALTIME_ADAPTER: redis
    ports: ["3000:3000"]
    depends_on: [mongo, redis, minio, kafka]
  worker:
    build:
      context: .
      dockerfile: apps/worker/Dockerfile
    environment:
      MONGODB_URI: mongodb://mongo:27017/dq-staging?replicaSet=rs0
      REDIS_URL: redis://redis:6379
      KAFKA_BROKERS: kafka:9092
      AI_INFERENCE_BASE_URL: http://ai-engine:8000/v1
      AI_MODEL_PRIMARY: ${AI_MODEL_PRIMARY}   # chốt sau benchmark (5 ứng viên)
    depends_on: [mongo, redis, kafka, ai-engine]

volumes:
  kafka-data:
```

**Quy tắc bắt buộc:**
1. Staging dùng **dữ liệu đã migrate từ dev** — không dùng dữ liệu thật của khách hàng.
2. Mỗi lần cutover nhóm: chạy smoke test toàn bộ endpoint của nhóm đó trên staging trước khi bật cờ ở dev.
3. Staging phải có **khả năng rollback**: giữ snapshot Mongo trước khi migrate (bước 1).
4. Không dùng staging để test hiệu năng tải nặng — k6 chạy ở local với dữ liệu sinh từ factory, tránh phụ thuộc mạng.
5. **v4:** Port `:9092` (Kafka) và `:8000` (engine AI) **không** publish ra host — chỉ trong mạng compose.
6. **v4:** Tổng giới hạn RAM của các container ≤ 90% RAM máy (`ai-engine` 11 G, `worker` 2 G, `api` 1 G, `kafka` 1 G, `redis` 320 M).
7. **v4:** File model AI phải có sẵn ở `./models` kèm checksum SHA-256 khớp `AI_MODEL_PRIMARY_SHA256`.

### 3.11. Phân bổ 120 quy tắc kiểm thử theo đợt

| Quy tắc | Đợt | Ghi chú |
|---|---|---|
| A1–A12 (kiến trúc, 12) | **Đợt 1** | Checker viết trước, áp dụng cho mọi module về sau |
| **A15** (cấm offset pagination) | **Đợt 1** | Tiện ích cursor trong `packages/core` dùng chung |
| **A16–A18** (cấm SDK AI ngoài, cấm import engine ngoài port, cấm thư viện Excel) | **Đợt 1** | Ràng buộc kiến trúc có hiệu lực ngay từ đầu |
| A13–A14 (kiến trúc, 2) | **Đợt 4** | Cấm route ghi `dataset_record` ngoài luồng Import (dữ liệu bất biến) |
| C1–C8 (contract, 8) | **Đợt 1** | Snapshot OpenAPI + validate runtime |
| **C9–C12** (cursor, 4) | **Đợt 1 + 4** | Tiện ích cursor ở Đợt 1; áp dụng cho list ở Đợt 4 |
| S16, S17 (outbox, inbox) | **Đợt 1** | Schema hạ tầng |
| I1–I7 (outbox/inbox, 7) | **Đợt 1** | Relay + idempotency — nền cho mọi module |
| O1–O4, O9–O11, O13 (7) | **Đợt 1** | Env, capability, logger, metrics |
| S1–S7 (schema cơ bản, 7) | **Đợt 2** | `user`, `user_session`, `audit_log` |
| O5–O8, O12, O21 (5) | **Đợt 2** | Health, request-id, Redis alert |
| O14, O16, O17, O27, O28 (5) | **Đợt 2** | Script backup/deploy, idempotent |
| S8–S10, S13–S15 (7) | **Đợt 4** | `dataset_record`, `dataset.columns[]`, R2 |
| S19 (1) | **Đợt 4** | Ràng buộc insert-only cho `dataset_record` |
| S18 (1) | **Đợt 6** | `notification.source_event_id` |
| I8–I14 (7) | **Đợt 5–6** | Worker, Kafka, AI, PDF, cleanup |
| **I15–I18** (Kafka, 4) | **Đợt 1** | Producer, DLQ, consumer group, rebalance |
| **I19–I20** (realtime + notification dispatch, 2) | **Đợt 6** | Socket.IO push, email idempotent |
| **I21** (job AI qua Kafka, 1) | **Đợt 5** | Job AI publish/consume với `model_id` |
| O19, O20, O23, O25, O26 (5) | **Đợt 6** | Container user, secret, cleanup, cutover |
| O15, O24 (2) | **Đợt 3–4** | Restore thử, quota |
| M1–M24 (migration, 24) | **Đợt 2–6** | Theo nhóm cắt (mục 3.9) |
| M25–M26 (migration, 2) | **Đợt 6** | `dataset_versions` không migrate; dữ liệu sau cutover chỉ đến từ file gốc |
| **M27–M28** (CSV, 2) | **Đợt 6** | Không `dataset_sheet`; mọi `file_format` = `csv` |
| **M29** (feedback, 1) | **Đợt 7** | 2 collection feedback có đủ index |
| **S20–S21** (CSV columns, 2) | **Đợt 4** | `dataset_sheet` không tồn tại; `columns[].key` = `c{i}` |
| **S22–S23** (feedback, 2) | **Đợt 7** | Append-only; `trust_score` + TTL 180 ngày |
| **O29–O35** (AI nội bộ + cursor + CSV, 7) | **Đợt 1–6** | Port, checksum, RAM, lag, health, CSV, cấm `countDocuments` |

**Tổng kết:**

| Đợt | Số quy tắc |
|---|---|
| Đợt 1 | 43 + A15–A18 (4) + C9–C12 (4) + I15–I18 (4) + O35 (1) = **56** |
| Đợt 2 | 17 |
| Đợt 3 | 12 |
| Đợt 4 | 11 + S20–S21 (2) + C13 (1) + O34 (1) = **15** |
| Đợt 5 | 4 + I21 (1) + O29–O33 (5) = **10** |
| Đợt 6 | 10 + I19–I20 (2) + M27–M28 (2) + O32 (1) = **15** (+8 quy tắc thủ công ghi nhận) |
| Đợt 7 | S22–S23 (2) + M29 (1) + 12 tình huống phân quyền `FB-*` = **15** |
| **Tổng** | **~120** |

**Ghi chú:** một số quy tắc được kiểm tra bởi nhiều đợt (VD S2 "collection có đúng trường bắt buộc" — mỗi đợt thêm collection mới đều phải pass lại). Con số trên là **quy tắc được "chốt"** lần đầu.

### 3.12. Rủi ro và kế hoạch xử lý

| # | Rủi ro | Khả năng | Tác động | Kế hoạch xử lý |
|---|---|---|---|---|
| R1 | Lệch lịch do ước lượng sai | Cao | Cao | Mục 3.6: dừng + điều chỉnh phạm vi khi lệch > 30%; cập nhật ước lượng mỗi đợt |
| R2 | Migration làm mất dữ liệu | Thấp | Rất cao | Verify 4 mức + backup + rollback 3 cấp (Phần 11) + cắt nhỏ theo nhóm |
| R3 | Hạ tầng test làm chậm vòng lặp phát triển | Trung bình | Trung bình | Tách project Jest; `test:unit` chạy < 30s; container chỉ bật khi cần |
| R4 | Feature flag gây trạng thái lẫn lộn (một request đi 2 nhánh) | Trung bình | Trung bình | Gắn cờ ở **tầng interceptor**, không gắn trong controller; test phải chứng minh 1 request chỉ đi 1 nhánh |
| R5 | Không có người review thứ hai (đội 1 người) | Chắc chắn | Cao | Checklist 12 mục + bằng chứng test bắt buộc + tự review bằng checklist; cân nhắc AI review cho đợt 3–6 |
| R6 | Test AI lộ PII ra ngoài | Thấp | Rất cao | Test network mock bắt buộc từ Đợt 5; assert payload không chứa giá trị ô |
| R7 | `clean-rules`/`lineage`/`exports` xoá muộn gây rối | Trung bình | Thấp | Xoá đúng 1 lần ở Đợt 6 sau khi cutover pass (quyết định 5) |
| R11 | Vô tình để lọt đường ghi dữ liệu ngoài Import (vi phạm bất biến) | Trung bình | Rất cao | Quy tắc S19 + A13–A14 trong checker kiến trúc chạy trong `test:all` — fail build nếu vi phạm |
| R8 | Dữ liệu thực tế lệch mạnh so với giả định schema | Trung bình | Cao | Câu hỏi còn mở của Phần 11 (số lượng `dataset_record` thực tế) — cần đo trước Đợt 4 |
| R9 | Monorepo làm chậm CI/local do cài lại | Thấp | Thấp | pnpm workspace dùng store chung; chỉ 4 package nên nhẹ |
| R10 | Phạm vi 79 tính năng bị "nở" khi code | Cao | Trung bình | Mọi tính năng mới phải thêm vào Phần 2 v5 trước khi code; không code ngoài danh mục |
| **R12** | **RAM/đĩa cho 5 model benchmark** — 5 file `.gguf` ~35 GB đĩa; model lớn nhất ~10 GB RSS cộng Mongo/Redis/Kafka/worker | Trung bình | **Rất cao** | Giới hạn memory container (`ai-engine` 11 G); RAM guard dừng job AI khi RSS > 85%; benchmark xong **xoá 3 file model không chọn**; kiểm tra RSS tổng ≤ 90% (O31) |
| **R13** | **Model AI quá chậm trên CPU** — suy luận 14B có thể > 60s/lượt | Cao | Cao | Timeout 180s + concurrency 1; benchmark tầng 9 đo p95 trước khi chốt; fallback `Qwen3-8B`; job AI **fail mềm** — hệ thống vẫn trả kết quả phân tích |
| **R14** | **Kafka single-node là điểm đơn** | Trung bình | Cao | Volume `kafka-data` bền vững; consumer idempotent (inbox) nên redeliver an toàn; giám sát lag (O32); tài liệu nêu rõ giới hạn khi mở rộng |
| **R15** | **Cursor sai khi thứ tự sort không ổn định** (trùng `created_at`) | Trung bình | Cao | Luôn sort theo **compound key** `(created_at, _id)` — `_id` là khóa duy nhất; test C11, C12 bắt trùng/thiếu |

### 3.13. Đối chiếu với code hiện tại

**Hiện trạng:** `src/backend/` — 7.880 dòng TypeScript, 10 module NestJS (`auth`, `clean-rules`, `datasets`, `data-view`, `exports`, `lineage`, `projects`, `users`, `versions`, `workspaces`), 16 file `*.spec.ts` gọi Mongo thật, 1 `package.json` đơn, chưa có monorepo.

| Vấn đề hiện tại | Xử lý trong kế hoạch |
|---|---|
| Cấu trúc phẳng (`dto/`, `schemas/`, `*.service.ts`, `*.repository.ts`) | Chuyển sang hexagonal 6 thư mục — Đợt 1 tạo khung, mỗi đợt sau áp vào module của mình |
| 10 module, trong đó 3 phải xoá | Xoá `clean-rules`, `lineage`, `exports` ở Đợt 6 |
| `neo4j-driver` trong dependencies | Gỡ ở Đợt 6 |
| `jest` config nằm trong `package.json`, không tách project | `jest.unit.json` với 4 project — Đợt 1 |
| Test gọi Mongo thật (Atlas) | Chuyển sang container replica set — Đợt 1 |
| `pnpm-workspace.yaml` đã tồn tại nhưng chưa dùng | Tận dụng cho monorepo — Đợt 1 |
| Script `bootstrap-database.ts` có nhánh `TARGET=neo4j` | Bỏ nhánh Neo4j — Đợt 6 |

**Đối chiếu với mô hình triển khai thông dụng:**

| Khả năng của mẫu | Có dùng không | Lý do |
|---|---|---|
| Monorepo pnpm | ✅ Có — 4 package | Quyết định 1 |
| `jest.config.js` + `test/jest-e2e.json` | ✅ Có | Phần 13 đã chốt |
| `scripts/check-module.mjs` | ✅ Có — mở rộng thành `check-architecture.mjs` | Quyết định 12 của Phần 13 |
| `test/k6/smoke.js` + `stress.js` | ✅ Có | Quyết định 13 của Phần 13 |
| `test/factories/`, `test/fixtures/` | ✅ Có | Quyết định 14 của Phần 13 |
| `docs/17` làm nơi lưu ngưỡng hiệu năng | ✅ Có — chuyển thành `docs/test-reports/perf-*.md` | Quyết định 2 của Phần 14 |
| Quy trình PR có bằng chứng | ✅ Có — nhưng tự review thay vì người thứ hai | Quyết định 9 |
| Có CI (GitHub Actions) | ❌ **Không dùng** | Quyết định 11 của Phần 13 |
| Có `husky` pre-commit | ❌ **Không dùng** | Câu hỏi mở #1 của Phần 13 — chưa chốt, sẽ chốt khi bắt đầu Đợt 1 |

### 3.14. Quy tắc kế hoạch

| # | Quy tắc |
|---|---|
| K1 | Đợt sau không bắt đầu khi đợt hiện tại chưa qua cổng nghiệm thu (mục 3.8) |
| K2 | Mỗi đợt kết thúc → `git tag dot-N` |
| K3 | Không có nhánh con; tất cả trên `Hoa24102026` |
| K4 | Không merge `main` trước Phần 15 |
| K5 | Feature flag mặc định `legacy`; bật `new` chỉ sau khi đợt pass cổng |
| K6 | Bật cờ theo thứ tự: canary 10% → 100% → giữ 7 ngày → mới drop collection cũ |
| K7 | Mọi commit có Conventional Commits + scope module + body nêu UC và quy tắc test |
| K8 | PR đính kèm báo cáo test + checklist 12 mục |
| K9 | PR > 1.500 dòng thay đổi phải tách |
| K10 | TDD nghiêm: use case chỉ xong khi đã có test |
| K11 | Mọi module mới phải pass `pnpm test:arch` (12 quy tắc A) |
| K12 | Không thêm tính năng ngoài danh mục 84 — thêm phải cập nhật Phần 2 v4 trước |
| K13 | Không commit secret, `.env`, `dist/`, `coverage/` |
| K14 | Cutover cắt nhỏ theo nhóm module; mỗi nhóm 1 lần cutover riêng |
| K15 | Verify hash mẫu lệch > 0 → dừng, không bật cờ, rollback |
| K16 | Lệch ước lượng > 30% → dừng, điều chỉnh phạm vi trước khi tiếp tục |
| K17 | Ước lượng được cập nhật sau mỗi đợt (mục 3.5) |
| K18 | Số liệu trong tài liệu này là ước lượng, không phải cam kết |
| K19 | Đợt là **đơn vị công việc logic**, không phải mốc thời gian — được phép dừng giữa đợt mà vẫn giữ trạng thái chạy được |
| K20 | Ước lượng phải ghi kèm **ngày đo**, không chỉ con số |

### 3.15. Điều kiện hoàn tất phần này

Kế hoạch thực hiện đã thống nhất trước khi viết code.

**Trạng thái v4:** 18 quyết định triển khai đã chốt; chiến lược Hybrid với feature flag trong tiến trình; cấu trúc monorepo 5 package + 2 app; **7 đợt** với scope, quy tắc test và tiêu chí nghiệm thu riêng; ước lượng **~181 ngày công** chi tiết theo module; **cảnh báo lệch lịch** 7 tuần vs 36 tuần với 3 phương án; quy trình commit/PR/checklist 12 mục; cổng nghiệm thu 9 mục; quy trình cutover cắt nhỏ theo nhóm; staging local (**thêm Kafka + ai-engine**); phân bổ **120 quy tắc** theo đợt; **15 rủi ro** kèm kế hoạch xử lý (thêm R12 RAM, R13 độ trễ AI, R14 Kafka single-node, R15 cursor); 20 quy tắc kế hoạch K1–K20. Còn 1 câu hỏi mở tại mục 6.2 (thêm `husky` pre-commit).

## 4. Đầu vào và đầu ra

**Đầu vào**
- **Phần 2 v5** — 79 tính năng, danh mục module LEGACY.
- Phần 4 v2 — 15 module mới + `shared`, bảng sở hữu collection, đồ thị phụ thuộc, đợt giao hàng gợi ý.
- Phần 5 v1 — hexagonal, 6 thư mục tầng, Rich Domain Model.
- Phần 6 v4 — 5 vai trò, 34 tình huống truy cập trái phép.
- **Phần 7 v3** — 85 endpoint, quy ước response/lỗi/phân trang cursor.
- Phần 8 v3 — 21 collection, 19 quy tắc S.
- Phần 9 v2 — 13 sự kiện, outbox/inbox, 14 quy tắc I.
- Phần 10 v3 — 28 quy tắc O, biến môi trường, health check, backup.
- Phần 11 v2 — 26 quy tắc M, quy trình cutover 8 bước, rollback 3 cấp.
- Phần 12 v3 — thuật toán thống kê, che PII, bất biến dữ liệu.
- **Phần 13 v4** — 9 tầng test, ma trận **120 quy tắc**, ngưỡng coverage, quy trình nghiệm thu 3 bước, ước tính ~46 ngày công test.
- Mã nguồn hiện tại — 7.880 dòng, 10 module NestJS, 16 file spec gọi Mongo thật, `pnpm-workspace.yaml` đã có nhưng chưa dùng.
- Mô hình triển khai thông dụng — monorepo, `jest.config.js` có `projects`, `scripts/check-module.mjs`, `test/k6/`, `docs/17`.
- Quyết định của người dùng — 14 lựa chọn triển khai (2026-11-05).

**Đầu ra**
- 16 quyết định triển khai nền tảng.
- Cơ chế `ModuleRouter` + `feature_flag` collection + `LegacyAwareInterceptor` — 3 trạng thái (`legacy`/`canary`/`new`).
- Cấu trúc monorepo mục tiêu (2 app + 3 package) với 5 quy tắc cấu trúc bắt buộc.
- **7 đợt giao hàng** — scope, quy tắc test, tiêu chí nghiệm thu riêng cho từng đợt.
- Ước lượng **~181 ngày công** chi tiết theo hạng mục, module và đợt.
- **Cách hiểu mới về "đợt"**: đơn vị công việc logic, không phải mốc thời gian (mục 3.6.2).
- **Ước lượng theo mô hình người + AI**: ~181 ngày công chuẩn hóa ↔ ~53–71 đơn vị thực thi (mục 3.6.3).
- Quy ước Conventional Commits + 8 kiểu + scope module + mẫu body tham chiếu UC/quy tắc.
- Checklist PR 12 mục + quy tắc tách PR > 1.500 dòng.
- Cổng nghiệm thu 9 mục giữa các đợt.
- Quy trình cutover cắt nhỏ theo 5 nhóm module, lịch cắt theo đợt.
- Cấu hình staging local (`docker-compose.dev.yml`).
- Bảng phân bổ **120 quy tắc** theo đợt.
- 10 rủi ro R1–R10 kèm kế hoạch xử lý.
- 18 quy tắc kế hoạch K1–K18.

## 5. Điều kiện hoàn tất phần này

Kế hoạch thực hiện đã thống nhất trước khi viết code.

**Trạng thái v4:** 18 quyết định đã chốt; chiến lược Hybrid; **7 đợt**; **~181 ngày công** ước lượng; quy trình commit/PR/cổng nghiệm thu; cutover theo nhóm; **120 quy tắc** phân bổ theo đợt; **15 rủi ro**; 20 quy tắc K1–K20. Còn 2 câu hỏi mở tại mục 6.2.

## 6. Câu hỏi và phụ thuộc còn mở

### 6.1. Đã chốt ở v1

| # | Câu hỏi | Kết quả |
|---|---|---|
| 1 | Cấu trúc repo mục tiêu | **Monorepo pnpm** — `apps/api`, `apps/worker`, `packages/core`, `packages/contracts` (+ `packages/config`) — mục 3.3 |
| 2 | Chiến lược triển khai | **Hybrid** — dựng nền tảng trước, chuyển module theo nhóm — mục 3.2 |
| 3 | Chia đợt | **7 đợt** — mục 3.4 |
| 4 | Nhánh | **`Hoa24102026`**, không nhánh con, commit theo đợt — mục 3.7.1 |
| 5 | Giữ code legacy | **Đến khi cutover xong rồi xoá hết một lần** — mục 3.5 (Đợt 6) |
| 6 | Thứ tự test | **TDD nghiêm** — mục 3.14 K10 |
| 7 | Chuyển traffic | **Feature flag theo module** — mục 3.2 |
| 8 | Quy ước commit | **Conventional Commits + scope module** — mục 3.7.2 |
| 9 | Review PR | **Tự review + bằng chứng đính kèm** — mục 3.7.3 |
| 10 | Thời điểm migrate dữ liệu | **Theo từng nhóm module** — mục 3.9 |
| 11 | Staging | **Chỉ local + Docker** — mục 3.10 |
| 12 | Thời lượng đợt | **1 tuần** (cadence) — **cảnh báo lệch lịch** ở mục 3.6 |
| 13 | Cách ước lượng | **Cả hai** — tổng ngày công theo module + phân bổ theo đợt — mục 3.5 |
| 14 | Song song | **Tuần tự, 1 người** — mục 3.14 K1 |
| 15 | Chia đợt có ràng buộc lịch không? | **Không** — 7 đợt là đơn vị công việc logic, không phải mốc thời gian — mục 3.6.2 |
| 16 | Ước lượng lịch theo mô hình nào? | **Người + AI cùng làm** — ~181 ngày công chuẩn hóa ↔ ~53–71 đơn vị thực thi — mục 3.6.3 |

### 6.2. Còn mở

| # | Câu hỏi | Ảnh hưởng | Nơi xử lý |
|---|---|---|---|
| 1 | ~~Dùng phương án nào để xử lý chênh lệch lịch 7 tuần vs ~36 tuần?~~ | **Đã chốt:** không chia đợt cứng như ràng buộc lịch — 7 đợt là **đơn vị công việc logic**, tiến độ do người dùng + AI làm liên tục (quyết định 15, mục 3.6.2) | Đã xử lý |
| 2 | Có nên thêm **`husky` pre-commit** chạy `pnpm test:unit && pnpm test:arch`? Nhẹ, chặn lỗi sớm, nhưng thêm dependency và có thể làm chậm commit | Trải nghiệm commit — với quy trình 1 người thì lợi ích khá rõ | Chốt ở **Đợt 1** (nằm trong checklist mục 3.13) |

### 6.3. Phụ thuộc bên ngoài

- **Docker** — cần cho `docker-compose.test.yml` (Mongo replica set, Redis, MinIO) và `docker-compose.dev.yml` (staging cục bộ).
- **k6** — cài riêng, chạy ở Đợt 3+.
- **MongoDB Atlas M0** — chỉ dùng cho dev; **không** dùng cho test (thiếu replica set).
- **R2 / MinIO** — MinIO container ở test và staging; R2 thật chỉ ở production.
- **Engine suy luận cục bộ** (`ai-engine`) — không dùng ở tầng test 1–8 (luôn mock); chỉ tầng 9 (benchmark) gọi engine trong container.
- **Nhân sự** — mô hình thực thi là **người dùng + AI** (quyết định 15, 16), không phụ thuộc nhân sự bên ngoài.

### 6.4. Phụ thuộc chéo với Phần 15

| Phụ thuộc | Mô tả |
|---|---|
| **Bắt buộc** | Phần 15 (đánh giá cuối) dùng ma trận **120 quy tắc** + 3 bảng mapping của Phần 13 v4 làm tiêu chí đánh giá cuối |
| **Bắt buộc** | Phần 15 dùng **7 đợt** của Phần 14 làm đơn vị đánh giá (mỗi đợt 1 mục đánh giá) |
| **Bắt buộc** | Phần 15 phải xác nhận việc xoá 3 module LEGACY và gỡ Neo4j (Đợt 6) |
| **Ràng buộc** | Chỉ merge `main` sau khi Phần 15 xác nhận (K4) |
| **Ghi nhận** | Câu hỏi mở #1 của Phần 13 (soak test) và #2 (husky) — #2 đã đưa sang mục 6.2 của Phần 14; #1 vẫn treo ở Phần 13 |

## 7. Prompting log và lịch sử thay đổi

- **Yêu cầu:** Người dùng yêu cầu liệt kê toàn bộ các phần theo thứ tự thực hiện, tạo sẵn file v1, lần lượt hoàn thiện vòng đầu rồi tạo v2 khi có thay đổi tiếp theo.
- **v1 / 2026-11-02:** Tạo khung phần 14 / Chuẩn bị thảo luận tuần tự / Chỉ tạo tài liệu, chưa thực thi thay đổi backend hoặc dữ liệu.
- **v5 / 2026-11-06:** AI chuyển sang **benchmark 5 model / 9 chỉ số** trước khi chốt (Phần 12 v5 mục 3.15); Đợt 5 thêm work package tải 5 file `.gguf` (~35 GB đĩa) + benchmark 3.000 lượt suy luận + kiểm định thống kê + đường Pareto; Đợt 5 ước lượng 35,5 → **40 ngày công**, tổng **~185,5 ngày công**; biến `AI_MODEL_ID`/`AI_MODEL_PRIMARY` trở thành **giá trị chốt sau benchmark**, không hard-code trong compose / Theo yêu cầu người dùng 2026-11-06.
- **v4 / 2026-11-05:** Áp dụng 4 quyết định kiến trúc. (1) **Cursor pagination**: thêm tiện ích `encodeCursor`/`decodeCursor`/`buildKeysetFilter` vào `packages/core` (Đợt 1) và áp dụng cho `datasets`/`data-view` (Đợt 4); checker thêm A15 (cấm `countDocuments`/`skip`). (2) **Kafka + Socket.IO**: thêm hạ tầng Kafka KRaft + producer/consumer/DLQ (Đợt 1), gateway Socket.IO + `WsAuthGuard` + adapter Redis (Đợt 1), realtime push + notification dispatch (Đợt 6), job AI qua topic `ai.jobs` (Đợt 5); bỏ BullMQ khỏi mọi mục. (3) **AI cục bộ**: thêm container `ai-engine` (vLLM prod / Ollama dev) + `Qwen3-14B`/`Qwen3-8B` + embedding cục bộ + RAM guard + checksum + benchmark tầng 9 (Đợt 5); bỏ phụ thuộc Gemini. (4) **Chỉ `.csv`**: bỏ `dataset_sheet` khỏi Đợt 4 (cột nhúng vào `dataset`), drop collection `dataset_sheet` ở Đợt 6, checker A18 cấm thư viện Excel. Ngoài ra: thêm **Đợt 7 — Feedback & học lại** (module `feedback`, kho `feedback_example`, RAG top-5); 6 → **7 đợt**; ma trận 93 → **120 quy tắc**; ước lượng ~146 → **~181 ngày công** (↔ ~53–71 đơn vị thực thi); thêm 4 rủi ro R12–R15.
- **v1 / 2026-11-05 (bổ sung):** Bổ sung quyết định 15–16 sau khi người dùng chốt "không cần chia đợt, làm nhanh nhất có thể". Viết lại mục 3.6: đợt = đơn vị công việc logic (không phải mốc thời gian); thêm ước lượng theo mô hình người + AI (~146 ngày công chuẩn hóa ↔ ~42–58 đơn vị thực thi); thêm quy tắc K19–K20; đóng câu hỏi mở #1 (xử lý chênh lệch lịch).
- **v1 / 2026-11-05:** Hoàn thiện vòng đầu. Chốt 14 quyết định triển khai; thiết kế chiến lược Hybrid với `ModuleRouter` + `feature_flag` collection + `LegacyAwareInterceptor` (3 trạng thái legacy/canary/new); cấu trúc monorepo 2 app + 3 package với 5 quy tắc cấu trúc; 6 đợt giao hàng — mỗi đợt có scope, quy tắc test, tiêu chí nghiệm thu; ước lượng ~146 ngày công chi tiết theo hạng mục/module/đợt; **cảnh báo lệch lịch** (6 tuần vs ~36 tuần) với 3 phương án xử lý; quy ước Conventional Commits với 8 kiểu + scope module + mẫu body tham chiếu UC/quy tắc; checklist PR 12 mục; cổng nghiệm thu 9 mục; quy trình cutover cắt nhỏ theo 5 nhóm module; staging local docker-compose; bảng phân bổ 93 quy tắc theo đợt; 10 rủi ro R1–R10; đối chiếu code hiện tại và hệ thống tham chiếu; 18 quy tắc K1–K18.
