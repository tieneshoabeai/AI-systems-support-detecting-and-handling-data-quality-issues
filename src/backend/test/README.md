# Test — 4 Tầng Kiểm Thử Backend

Thư mục `src/backend/test/` chứa toàn bộ kiểm thử backend: unit (mock, không cần hạ tầng), integration (Mongo/Redis/MinIO thật), e2e (HTTP pipeline thật), k6 (tải trọng).

> Số liệu pass/fail thay đổi theo từng lần chạy — không ghi số cứng ở đây. Chạy lệnh ở mục 3 để lấy số thật.

---

## 1. Bố cục (thực tế — đếm bằng `find`/`ls`)

```text
test/
├── unit/                  # 67 file *.spec.ts, gom theo 14 thư mục domain
│   ├── analysis/          # 11: guard GĐ0/GĐ8/GĐ9/GĐ10/GĐ12, GĐ2, GĐ7, wave5, wave6-10, pdf, report-content
│   ├── arch/              # 9: clean-architecture, guard-coverage, zero-any, contract-coverage,
│   │                      #    modular-monolith (+MM6), mongo-session, open-09 strict, open-09 session, open-10, zod-openapi
│   ├── auth/              # 2: admin-bootstrap, google-oauth
│   ├── datasets/          # 10: csv-delimiter, column-pii, findings, entity, ingestion, wave4,
│   │                      #    data-view, type-coercion, chart-data, chart-swagger-schema
│   ├── feedback/          # 2: entity + wave7 (FB-01→FB-06 + append-only/TTL)
│   ├── infra/             # 8: event-dispatcher, storage, storage-cleanup, group1-infra,
│   │                      #    ai-worker, ai-adapters-outbox, report-worker, external-services-email-push
│   ├── issues/            # 1: issue-report entity
│   ├── notifications/     # 1: notification entity
│   ├── projects/          # 2: entity + service (1 project = 1 dataset)
│   ├── realtime/          # 3: realtime + gateway + revocation (OPEN-08)
│   ├── shared/            # 7: casl, crypto, mask-pii, keyset-pagination, device-detector,
│   │                      #    domain-error (+error-mapping), policies-guard
│   ├── users/             # 2: user entity + user-session entity
│   ├── workflows/         # 6: cascade-workspace-delete, gap-p2-p3, step1-services,
│   │                      #    step3-efgh, step1-remember-me, notifications-issues-wave6
│   └── workspaces/        # 3: entity + service + invitation-email (WS-01/WS-07/quota)
├── integration/           # 7 file: cascade-delete, open09-rollback, record-query,
│                          #    redis-minio, repositories, repositories-analysis, repositories-domain
├── e2e/                   # 12 file *.e2e-spec.ts: 8 ở gốc + 4 trong security/
│   ├── health (ngoại lệ: dùng FakeWorkspacesController), auth-flow, users-me, workspace-project,
│   ├── dataset-dataview, analysis-report-summary, issues-admin,
│   ├── feedback-notifications-overview
│   └── security/          # authorization (thuần ability, 48 case), cookie-parser-regression,
│                          # google-oauth, google-oauth-cookie
├── k6/                    # 5 script: smoke, full-journey, load, stress, analysis-latency
├── fixtures/              # valid-simple.csv (3 dòng), large-50k.csv (1 dòng placeholder), arch-baseline.json (9 dòng)
├── helpers/               # module-handlers.ts, handler-proxy.ts, transaction.ts,
│                          # test-infra.ts, resolve-import.ts
├── factories/             # user.factory.ts, workspace.factory.ts
├── benchmark/             # eval-set.jsonl (2 dòng thật), run-benchmark.mjs (18 dòng)
├── coverage/              # snapshot cũ (không phải output hiện tại) — xem README riêng
├── jest-e2e.json          # testRegex .e2e-spec.ts$
├── jest-integration.json  # testRegex test/integration/.*, --runInBand, timeout 60s
└── unit_test/             # 20 file .md checklist + 1 README (không phải test chạy)
```

Ngoài `test/` còn 2 file spec lẻ: `src/modules/analysis/domain/corr-vif-ai.spec.ts` và `scripts/benchmark/benchmark.spec.ts`.

Vì sao `pnpm test` (testRegex `.*\.spec\.ts$`) không chạy e2e: file e2e tên `*.e2e-spec.ts` (gạch nối trước `spec`), không khớp `\.spec\.ts$` (cần dấu chấm trước `spec`). E2E chỉ chạy qua `test/jest-e2e.json` (testRegex `.e2e-spec.ts$`).

---

## 2. Bốn tầng kiểm thử

| Tầng | Ví dụ thật | Cần hạ tầng? | Lệnh |
|---|---|---|---|
| Unit | `unit/datasets/datasets-wave4.spec.ts`, `unit/shared/policies-guard.spec.ts` | Không | `pnpm test` / `pnpm test:unit` |
| Architecture | `unit/arch/clean-architecture.spec.ts` (CA1–CA14), `unit/arch/zero-any.spec.ts` | Không | `pnpm test:arch` (5/9 file) hoặc `npx jest test/unit/arch` (đủ 9 file) |
| Integration | `integration/repositories.spec.ts`, `integration/record-query.spec.ts` | **Có** (`pnpm test:infra:up`) | `pnpm test:integration` |
| E2E | `e2e/auth-flow.e2e-spec.ts`, `e2e/security/*.e2e-spec.ts` | **Không bắt buộc** (handler mock, không cần Mongo thật) | `pnpm test:e2e` / `pnpm test:security` |

`pnpm test:integration` chạy riêng `--runInBand` (xem `jest-integration.json`: `maxWorkers: 1`, `forceExit: true`) vì các suite dùng chung một database test — chạy song song sẽ tranh chấp khi xóa collection.

---

## 3. Lệnh chạy (chép từ `package.json`)

```bash
pnpm test                 # mặc định: unit + arch (+ 2 spec lẻ), bỏ qua integration + e2e
pnpm test:watch           # watch mode
pnpm test:cov             # đo phủ → ghi ra src/backend/coverage/
pnpm test:unit            # chỉ unit (ignore integration + 5 spec arch)
pnpm test:arch            # chỉ 5 spec kiến trúc (zero-any, guard-coverage, zod-openapi, clean-architecture, api-contract-coverage)

pnpm test:infra:up        # bật Mongo rs0 @27018 + Redis @6380 + MinIO @9002/9003
pnpm test:integration     # integration --runInBand (cần hạ tầng)
pnpm test:infra:down      # tắt hạ tầng

pnpm test:e2e             # 12 file e2e (jest-e2e.json --runInBand)
pnpm test:security        # chỉ 4 file test/e2e/security
pnpm test:e2e:full        # tự bật/hạ hạ tầng rồi chạy e2e

pnpm test:all             # unit -> arch -> integration -> e2e
pnpm test:all:infra       # tự bật/hạ hạ tầng rồi chạy test:all
pnpm test:cov:all         # coverage --runInBand, ignore node_modules

pnpm test:perf            # k6 smoke + journey + load + stress (không gồm latency)
pnpm test:perf:smoke / :journey / :load / :stress / :latency
pnpm test:perf:staging    # báo cáo staging (scripts/perf-report.sh)
pnpm test:benchmark       # node test/benchmark/run-benchmark.mjs
```

---

## 4. Hạ tầng cho integration (chép từ `scripts/test-infra-up.sh`)

```bash
pnpm test:infra:up
pnpm test:infra:down
```

- Có Docker: `deploy/docker-compose.test.yml` (mongo-test 27018, redis-test 6380, minio-test 9002/9003).
- Không Docker: binary native trên đúng cổng trên (`scripts/test-infra-up.sh`).
- Replica set `rs0` là bắt buộc: transaction (cascade delete, outbox/inbox) không chạy trên standalone.
- URI mặc định trong `helpers/test-infra.ts`: `mongodb://127.0.0.1:27018/?replicaSet=rs0`, `redis://127.0.0.1:6380`, `http://127.0.0.1:9002`.

---

## 5. Quy tắc viết test

- Handler: fake repository/port trả fixture có kiểm soát (success / null / throw / conflict). Assert cả output/error **và** tác vụ ghi/phát event được phép **và** tác vụ tuyệt đối không được gọi.
- Hàm thống kê/crypto: dùng thuật toán thật với đáp án độc lập. Tuyệt đối không mock chính hàm đang test để sinh expected.
- Fake clock: đồng hồ, random ID, timer, provider/model, network đều fake/mock.
- Phân biệt: "giá trị truyền đúng vào port" = unit; "Mongo thật lưu rồi đọc lại" = integration.
- Không tự suy diễn: ca GAP/OPEN/RISK không được coi là hành vi đúng.

---

## 6. Test kiến trúc (`unit/arch/`, 9 file)

Chi tiết từng `describe` xem `unit/arch/README.md`. Tóm tắt:

- `clean-architecture`: 14 quy tắc CA1–CA14, đọc `fixtures/arch-baseline.json` (hiện các mảng đều `[]`).
- `modular-monolith`: MM5 vertical slice phẳng + MM6 cấm `HttpException` trong `*.service.ts`.
- `guard-coverage`: mọi route đều có guard hoặc `@Public()`.
- `zero-any`: quét `src/`, `scripts/`, `test/` — cấm `any`.
- `api-contract-coverage`, `zod-openapi`, `mongo-session`, `open-09`, `open-10`: xem README riêng.

```bash
pnpm arch:cross-imports   # import chéo ngoài public contract
pnpm arch:api-coverage    # hợp đồng API khớp mã nguồn
pnpm arch:baseline        # sinh test/fixtures/arch-baseline.json
pnpm arch:verify-di       # đồ thị DI
```

---

## 7. E2E (12 file) — chi tiết xem `e2e/README.md` + `e2e/security/README.md`

7 file dùng controller thật + handler mock; 1 file `health` dùng `FakeWorkspacesController`; 1 file `authorization` test thuần ability (không HTTP).

## 8. Tải trọng (k6, 5 file) — chi tiết xem `k6/README.md`

`smoke`, `full-journey`, `load`, `stress` (staging, `checks 0.98`), `analysis-latency` (ngưỡng nghiệp vụ đúng p95 < 8000ms).

## 9. Dữ liệu mẫu & Checklist

| File | Mô tả thật |
|---|---|
| `fixtures/valid-simple.csv` | 3 dòng (header + 2 dòng) |
| `fixtures/large-50k.csv` | 1 dòng placeholder (70 bytes), không commit file nặng |
| `fixtures/arch-baseline.json` | 9 dòng, các mảng CA đều rỗng |
| `factories/user.factory.ts`, `factories/workspace.factory.ts` | Factory seed cố định (mặc định 42) |
| `unit_test/` (20 file .md) | **Checklist** 384 checkbox (01–18) + 107 checkbox file 19 — không phải báo cáo kết quả. Xem `unit_test/README.md` |
