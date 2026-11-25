# 13. Chiến lược kiểm thử và tiêu chí nghiệm thu

- **Version:** v6
- **Ngày tạo:** 2026-11-02
- **Cập nhật gần nhất:** 2026-11-06 (v6)
- **Trạng thái:** Đã chốt 17 quyết định kiểm thử và thiết kế chi tiết **9 tầng test** (thêm **Tầng 9 — Benchmark AI & học lại**), ma trận truy xuết ngược **120 quy tắc kiểm thử** (S/C/I/O/M) + 79 tính năng + 66 use case + 85 endpoint, ngưỡng coverage theo tầng, checker kiến trúc tự động, `k6` cho hiệu năng, factory + seed cho dữ liệu test, **48** tình huống phân quyền tự động, và quy trình nghiệm thu 3 bước.
- **Thay đổi v2 (2026-11-05):** đồng bộ theo quyết định **dữ liệu bất biến (chỉ đọc)** — bỏ toàn bộ test cho xoá dòng, sửa ô, clean-rules, rollback phiên bản, lineage; bổ sung test **insert-only** cho `dataset_record`; số liệu toàn tài liệu cập nhật (93 quy tắc / 77 tính năng / 62 use case / 80 endpoint / 21 collection / 34 tình huống phân quyền).
- **Thay đổi v4 (2026-11-05):** áp dụng 4 quyết định kiến trúc. (1) **Cursor pagination** — thêm bộ test phân trang keyset (C9–C13) + quy tắc kiến trúc A15. (2) **Kafka + Socket.IO** — thêm container Kafka vào môi trường test, bộ test luồng sự kiện (I15–I21) và test realtime. (3) **AI cục bộ** — quyết định 8 viết lại (mock adapter, không bao giờ gọi network ra ngoài), thêm **Tầng 9 — Benchmark AI & học lại** (quyết định 15–17). (4) **Chỉ `.csv`** — test từ chối `.xlsx` (C13) + quy tắc A16. Ngoài ra: số liệu cập nhật (120 quy tắc / 79 tính năng / 66 use case / 85 endpoint / 48 tình huống phân quyền).
- **Giai đoạn:** Chuẩn bị implementation/evaluation
- **Thứ tự thực hiện:** Phần 13; sử dụng kết quả đã xác nhận của các phần trước.
- **Quan hệ với các phần khác:** gom và kiểm chứng toàn bộ quy tắc đã chốt ở Phần 5 v2 (ports/adapters), Phần 6 v5 (phân quyền), Phần 7 v3 (contract), Phần 8 v4 (schema), Phần 9 v3 (integration), Phần 10 v4 (vận hành), Phần 11 v4 (migration), Phần 12 v6 (logic AI + DQ-05 có điều kiện + AI đánh giá tương quan/VIF); là điều kiện tiên quyết cho Phần 14.

## 1. Mục tiêu

Xác định bộ kiểm thử và tiêu chí nghiệm thu để chứng minh đợt tái cấu trúc backend đạt đúng thiết kế đã chốt, trước khi bắt đầu viết code (Phần 14).

## 2. Nội dung cần bàn luận

- Các tầng test cần thiết và ranh giới trách nhiệm giữa chúng.
- Ánh xạ tính năng / use case / endpoint / quy tắc sang test case.
- Môi trường test, dữ liệu thử, mock và dịch vụ thật.
- Ngưỡng đạt, lệnh kiểm tra và bằng chứng nghiệm thu.

## 3. Quyết định và thiết kế chi tiết

### 3.1. Các quyết định nền tảng

| # | Quyết định | Ghi chú |
|---|---|---|
| 1 | Module `exports` (LEGACY): **xoá hẳn** — gỡ khỏi code, xoá collection, không thêm tính năng mới | Đóng câu hỏi treo từ Phần 11 mục 6.2 #3 |
| 2 | Môi trường E2E: **container Mongo replica set** (1 node, docker-compose riêng) | Có transaction + change stream thật, test đúng production |
| 3 | **8 tầng test** đầy đủ | domain, use case, adapter, contract, E2E, architecture, security, performance |
| 4 | Coverage: **theo tầng** — domain ≥ 90%, application ≥ 80%, infrastructure ≥ 60%, tổng ≥ 70% | Buộc chất lượng ở tầng quan trọng nhất |
| 5 | Ranh giới kiến trúc: **script checker tự động** (`check-module.mjs` kiểu chuẩn) | Chạy trong `test:all` |
| 6 | Hiệu năng: **k6** (`smoke.js` + `stress.js`), chạy thủ công trước release | Không chặn CI |
| 7 | Dữ liệu test E2E: **test factory + seed script** có seed cố định | Lặp lại được, không phụ thuộc dữ liệu thật |
| 8 | Test AI: **luôn mock** — không bao giờ gọi engine suy luận thật trong test tầng 1–8 | Nhanh, ổn định, không tốn tài nguyên CPU; **tầng 9** là ngoại lệ (quyết định 15–16) |
| 9 | Bảo mật: **48 tình huống truy cập trái phép** chuyển thành test tự động | Khớp trực tiếp ma trận quyền Phần 6 v5 |
| 10 | Bằng chứng nghiệm thu: **cả hai** — báo cáo tự động + phần kết luận do người viết | Tự động cho số liệu, người cho phán đoán |
| 11 | CI: **chỉ script `pnpm test:all` chạy local** — không GitHub Actions | Không có auto-deploy |
| 12 | Ngưỡng đạt: **chặn** — test fail hoặc coverage dưới ngưỡng thì không commit, không deploy | Dù chưa có CI, gate áp dụng ở quy trình local |
| 13 | Bảng mapping: **đầy đủ** — 79 tính năng + 66 use case + 85 endpoint + 120 quy tắc | Dùng làm danh sách nghiệm thu |
| 14 | Test hợp đồng API: **cả hai** — snapshot OpenAPI + validate runtime Zod trong E2E | Bắt được cả thay đổi ngoài ý muốn lẫn lỗi runtime |
| 15 | **Tầng 9 — Benchmark AI & học lại**: bộ benchmark cố định đánh giá **5 model cục bộ** (`Qwen3-14B` / `Gemma-3-12B` / `Qwen3-8B` / `Llama-3.1-8B` / `Vistral-7B`) trên cùng tập mẫu, 9 chỉ số, kiểm định thống kê và đường Pareto → chọn model tối ưu | Quyết định chọn model phải dựa trên **số liệu**, không cảm tính |
| 16 | Benchmark **chạy thủ công** (không trong `test:all`) — cần engine thật, thời gian dài | Model cục bộ trên CPU rất chậm; CI không có model |
| 17 | Vòng lặp học lại (feedback → `feedback_example` → truy xuất → cải thiện) có **test tích hợp riêng** | Cơ chế RAG T1 là điểm khác biệt chính của hệ thống |

### 3.2. Tổng quan 8 tầng test

```
                     ────────────────────────────────────────────────────────────────────────────────
                     TẦNG 9  Benchmark AI & học lại     ─ chạy thủ công, cần engine thật
                     TẦNG 8  Hiệu năng (k6)              ─ chạy thủ công trước release
                     ────────────────────────────────────────────────────────────────
                     TẦNG 7  Bảo mật & phân quyền        ─ 48 tình huống, tự động
                     ────────────────────────────────────────────────────────────────
                     TẦNG 6  Kiến trúc (architecture)    ─ script checker tĩnh
                     ────────────────────────────────────────────────────────────────
                     TẦNG 5  E2E / hợp đồng API        ─ container Mongo replica set
                     ────────────────────────────────────────────────────────────────
                     TẦNG 4  Adapter (integration)       ─ Mongo/Redis/R2 thật trong container
                     ────────────────────────────────────────────────────────────────
                     TẦNG 3  Use case (application)      ─ port được mock, logic thật
                     ────────────────────────────────────────────────────────────────
                     TẦNG 2  Domain                     ─ thuần TS, không framework
                     ────────────────────────────────────────────────────────────────
                     TẦNG 1  Hợp đồng API (snapshot)    ─ so khớp openapi.json
```

**Quy tắc về thứ tự chạy (rẻ trước đắn sau):**

| Thứ tự | Tầng | Lý do |
|---|---|---|
| 1 | Tầng 2 (domain) | Nhanh nhất, phát hiện lỗi logic thuần |
| 2 | Tầng 3 (use case) | Vẫn nhanh, không cần I/O |
| 3 | Tầng 1 + 6 (snapshot + architecture) | Tĩnh, mili giây |
| 4 | Tầng 4 (adapter) | Cần container |
| 5 | Tầng 5 (E2E) | Chậm nhất trong nhóm tự động |
| 6 | Tầng 7 (security) | Chạy cùng E2E (dùng chung fixture) |
| 7 | Tầng 8 (k6) | Tách, chạy thủ công |
| 8 | Tầng 9 (benchmark AI) | Tách, chạy thủ công — cần `ai-engine` thật |

**Quy tắc bắt buộc:**
1. Tầng 2 và 3 **không được** chạm MongoDB, Redis, R2, Kafka, engine AI — không mock cũng không. Vi phạm = test không đáng tin.
2. Tầng 2 **không** import NestJS hay Mongoose — cùng quy tắc với mã production (Phần 5).
3. Một test chỉ thuộc **một tầng**. Không trộn unit test với assertion E2E trong cùng file.
4. Test AI **không bao giờ** gọi network ra ngoài (quyết định 8). Tầng 9 là **ngoại lệ duy nhất** — nó gọi `ai-engine` **cục bộ** trong container, không gọi ra internet (quyết định 16).
5. Test E2E **không** dùng dữ liệu thật của bất kỳ workspace nào.

### 3.3. Tầng 1 — Hợp đồng API (snapshot)

**Mục đích:** phát hiện API đổi ngoài ý muốn trước khi deploy.

**Cơ chế:**

```
1. Từ Zod schema trong packages/contracts, sinh OpenAPI schema
2. Ghi ra docs/contracts/openapi.json
3. Commit file này vào repo
4. Trong test:all, sinh lại schema và so khớp với file đã commit
   → lệch → FAIL, kèm diff
```

**Quy tắc bắt buộc:**

| # | Quy tắc |
|---|---|
| 1 | `openapi.json` là **artifact có version** — commit cùng code, thay đổi contract = thay đổi file + PR ghi rõ |
| 2 | Test **không** tự cập nhật file — nếu lệch thì fail, người lập trình chủ động regenerate và commit |
| 3 | Lệnh regenerate: `pnpm contracts:openapi` |
| 4 | Kiểm tra thêm: **không có endpoint trong OpenAPI mà không có trong bảng 85 endpoint** của Phần 7 và ngược lại |
| 5 | Kiểm tra: mọi response có trường `error.code` thuộc danh mục mã lỗi đã chốt ở Phần 7 |

**Phạm vi kiểm tra:**

| Hạng mục | Nguồn |
|---|---|
| 85 endpoint, method, path, query param | Phần 7 mục 3.x |
| Tên trường response (`camelCase`) | Phần 7 mục 3.3 |
| Mã lỗi | Phần 7 mục 3.4 |
| Shape của `meta` phân trang | Phần 7 mục 3.5 |
| Quy ước 202 Accepted cho job bất đồng bộ | Phần 7 mục 3.7 |

### 3.4. Tầng 2 — Domain test

**Phạm vi:** `packages/core` và tầng `domain/` của mọi module trong `apps/api`.

**Nguyên tắc:** test thuần TypeScript, **không** NestJS, **không** Mongoose, **không** I/O.

**Quy trình bắt buộc (Rich Domain Model — Phần 5):**

Mọi aggregate phải có **2 nhóm test**:

| Nhóm | Cách test | Ví dụ |
|---|---|---|
| **Hợp lệ** | `create()` với input hợp lệ → trả về aggregate đúng trạng thái | Tạo workspace với tên hợp lệ → `status = 'active'`, `version = 1` |
| **Không hợp lệ** | `create()` / method thay đổi với input vi phạm → **ném lỗi domain** | Đổi vai trò Owner → ném `DomainError`; tạo project với tên rỗng → ném lỗi |

**Phạm vi test bắt buộc theo aggregate:**

| Aggregate | Nhóm test bắt buộc |
|---|---|
| `User` | Tạo hợp lệ; email không hợp lệ; tài khoản `blocked` không đăng nhập được; `notifications_enabled` |
| `Workspace` | Tạo; đổi tên vi phạm độ dài; chuyển Owner; `storage_used_bytes` vượt quota; xoá |
| `Project` | Tạo; đổi trạng thái theo vòng đời hợp lệ; **không** chuyển trạng thái sai (`draft` → `completed` khi chưa có dataset) |
| `Dataset` | Tạo; `content_fingerprint` đúng định dạng; `row_count` khớp sheet |
| `DatasetSheet` | Tạo; `columns` có key `c0`/`c1` liên tục, không trùng |
| `DatasetRecord` | Tạo; `props` chỉ chứa key hợp lệ; giá trị `null` khác "thiếu key" |
| `IssueReport` | Tạo; chuyển trạng thái theo vòng đời; Admin duyệt không được tự duyệt |
| `AnalysisRun` | Tạo; `status` theo vòng đời; `input_fingerprint` |
| `AiJob` | Tạo; `attempt` tăng; trạng thái terminal |
| `Notification` | Tạo; `is_mandatory` không tắt được |
| `Session` | Tạo; `revoked_at`; hết hạn |

**Quy tắc về ngưỡng domain ≥ 90%:**

| # | Quy tắc |
|---|---|
| 1 | Coverage tính **riêng** cho `packages/core` + `*/domain/**` — không gộp với application |
| 2 | Ngưỡng: lines ≥ 90%, branches ≥ 85%, functions ≥ 90% |
| 3 | Dưới ngưỡng → `test:all` **fail** → không commit, không deploy (quyết định 12) |
| 4 | Mọi `DomainError` có nhánh test tương ứng — **không** có `catch` trần nào trong domain không được test |

**Đặc biệt — kiểm thử thuật toán thống kê (`packages/core/src/stats/`):**

Vì dùng `simple-statistics` + `ml-matrix` (Phần 12 mục 3.14), các hàm wrapper của chúng phải có test cho:

| Hàm | Ca test bắt buộc |
|---|---|
| `detectOutliersIQR` | Dữ liệu bình thường (không outlier); dữ liệu có outlier rõ; dữ liệu toàn hằng (IQR = 0 → tránh chia 0); mẫu rỗng; mẫu 1 phần tử |
| `detectOutliersModifiedZ` | Tương tự + trường hợp MAD = 0 |
| `computeMissingRate` | Cột không thiếu; cột thiếu một phần; cột thiếu toàn bộ |
| `computeImbalanceRatio` | Cân bằng; mất cân bằng nhẹ; mất cân bằng nặng |
| `computeVIF` | Không đa cộng tuyến; đa cộng tuyến; ma trận không khả nghịch → trả `null` chứ không ném |
| `computeCorrelation` | Hoàn toàn tương quan; tương quan âm; hằng số → `null` |
| `describeColumn` | Ngày; số; chuỗi; boolean; cột rỗng |

**Quy tắc bắt buộc:** mỗi hàm thống kê phải có **ít nhất 1 ca biên** (edge case) — giá trị 0, 1 phần tử, toàn hằng, rỗng. Đây là nơi bug thường nằm.

### 3.5. Tầng 3 — Use case (application) test

**Phạm vi:** `*/application/**` — 1 handler cho mỗi use case (Phần 5).

**Nguyên tắc:** logic use case thật, **port** (repository, storage, AI, email) được mock.

**Cơ chế mock — quyết định quan trọng:**

| Loại port | Cách mock | Ghi chú |
|---|---|---|
| Repository | **In-memory implementation thật** viết trong `test/fakes/` | Không dùng `jest.mock()` — mock theo interface, giữ hành vi thật (soft delete, optimistic locking) |
| Storage (R2) | Fake adapter ghi vào thư mục tạm | Test được logic upload/download path |
| AI (suy luận cục bộ) | Fake adapter trả phản hồi định sẵn | **Không** gọi network (quyết định 8) |
| Embedding (cục bộ) | Fake adapter trả vector định sẵn | **Không** gọi network |
| Kafka producer | Fake producer ghi vào mảng | **Không** gọi broker thật |
| Socket.IO gateway | Fake gateway ghi event vào mảng | **Không** mở cổng thật |
| Email (SMTP) | Fake adapter ghi vào mảng | Assert được nội dung email |
| Outbox | Fake collector — gom event đã phát | Assert được event đúng trường |

**Vì sao không dùng `jest.mock()`:** mock theo interface giữ được hành vi thật của repository, nên test use case phát hiện được cả lỗi logic lẫn lỗi hợp đồng port. `jest.mock()` che giấu sự khác biệt giữa interface và implementation thật.

**Phạm vi test bắt buộc cho mỗi use case:**

| Nhóm | Nội dung |
|---|---|
| **Happy path** | Input hợp lệ → kết quả mong đợi, side effect đúng (outbox event phát đúng loại, đúng payload) |
| **Không đủ quyền** | Actor sai vai trò → ném `ForbiddenError` hoặc trả 403, **không** có side effect nào |
| **Không tìm thấy** | ID không tồn tại → `NotFoundError` / 404 |
| **Xung đột phiên bản** | `version` không khớp → `ConflictError` / 409 — kiểm tra optimistic locking (Phần 5 mục 3.9) |
| **Lỗi hạ tầng** | Port ném lỗi → use case phải **chuyển đổi** thành lỗi domain, không rò lỗi hạ tầng ra ngoài |
| **Bất biến** | Sau khi thực hiện, bất biến nghiệp vụ vẫn đúng (VD: workspace có đúng 1 Owner) |

**Ngưỡng application ≥ 80%:** lines ≥ 80%, branches ≥ 75%, functions ≥ 80%.

**Số lượng use case cần test:** **66 use case** (Phần 3 v4) — mỗi use case ít nhất 1 ca happy path + 1 ca không đủ quyền. Đây là phần lớn khối lượng công việc của Đợt 1.

### 3.6. Tầng 4 — Adapter (integration) test

**Phạm vi:** `*/infrastructure/**` — adapter MongoDB, Redis, R2.

**Nguyên tắc:** dùng **dịch vụ thật trong container**, không mock.

**Môi trường:**

| Dịch vụ | Cấu hình | Lý do |
|---|---|---|
| MongoDB | Container **replica set 1 node** | Cần transaction + change stream — Atlas M0 không có (quyết định 2) |
| Redis | Container `redis:7-alpine` | cache + Socket.IO adapter + rate-limit |
| Kafka | Container `kafka:3.7` KRaft single-node | Test luồng sự kiện, DLQ, consumer group thật |
| R2 | MinIO container (S3-compatible) | Test được đường dẫn S3 thật mà không tốn phí R2 |

**File `docker-compose.test.yml`:**

```yaml
name: dq-test

services:
  mongo:
    image: mongo:7
    command: ["--replSet", "rs0", "--bind_ip_all"]
    ports:
      - "27018:27017"
    healthcheck:
      test: >
        mongosh --eval "
          try { rs.status().ok }
          catch (e) { rs.initiate({_id:'rs0',members:[{_id:0,host:'mongo:27017'}]}).ok }
        "
      interval: 3s
      timeout: 10s
      retries: 15
      start_period: 10s

  redis:
    image: redis:7-alpine
    ports:
      - "6380:6379"
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 3s
      retries: 10

  minio:
    image: minio/minio:latest
    command: server /data --console-address ":9001"
    environment:
      MINIO_ROOT_USER: testuser
      MINIO_ROOT_PASSWORD: testpassword
    ports:
      - "9000:9000"
    healthcheck:
      test: ["CMD", "mc", "ready", "local"]
      interval: 5s
      retries: 10

  minio-init:
    image: minio/mc:latest
    depends_on:
      minio:
        condition: service_healthy
    entrypoint: >
      /bin/sh -c "
      mc alias set local http://minio:9000 testuser testpassword &&
      mc mb --ignore-existing local/dq-test
      "
```

**Ghi chú về replica set:** container dùng `host: mongo:27017` trong `rs.initiate` — hostname phải khớp với tên service để các client kết nối từ host máy dev vẫn nhận diện được replica set. `MONGODB_URI` cho test: `mongodb://localhost:27018/dq-test?replicaSet=rs0&directConnection=false`.

**Phạm vi test bắt buộc:**

| Adapter | Ca test bắt buộc |
|---|---|
| Mongo repository | CRUD cơ bản; soft delete lọc đúng; `version` increment; unique partial index chặn trùng; TTL index hoạt động |
| Mongo transaction | Rollback khi lỗi giữa chứng; outbox ghi cùng transaction; phát hiện lỗi khi chạy ngoài transaction |
| Outbox relay | Claim → publish → `published`; publish fail → reset `pending` + `retry_count`; lease hết hạn → polling thu hồi |
| Inbox (`processed_event`) | Claim → `completed`; claim lại khi lease hết hạn; unique `(consumer_name, event_id)` chặn trùng |
| Kafka producer/consumer | Publish → consume; message fail → retry theo backoff; message vượt số lần retry → vào topic `dlq.dead-letter` |
| Kafka consumer group | 2 consumer cùng group chia tải message (không xử lý trùng); consumer chết → rebalance, message được đọc lại |
| Inbox chống trùng khi redeliver | Message bị redeliver (offset chưa commit) → consumer **không** xử lý lần 2 nhờ `processed_event` |
| Redis rate-limit | Đếm đúng; reset sau window; trả 429 |
| R2 adapter | Upload → download trùng khớp; multipart upload file lớn; xoá; sinh presigned URL hết hạn |
| Storage local fallback | Ghi/đọc/xoá file trong thư mục tạm |

**Ngưỡng infrastructure ≥ 60%:** lines ≥ 60%, branches ≥ 50%, functions ≥ 60%.

**Quy tắc bắt buộc:**
1. Mỗi test tầng 4 phải **tự dọn dẹp** dữ liệu (`beforeEach` xoá collection, `afterAll` flush Redis + xoá bucket) — không để dữ liệu rò sang test sau.
2. Test phải chạy được **song song** (`--maxWorkers`) → dữ liệu test phải cô lập theo database, không dùng chung collection namespace.
3. Không có test nào phụ thuộc thứ tự chạy.
4. Container phải **dừng sạch** sau khi test (`docker compose -f docker-compose.test.yml down -v`).

### 3.7. Tầng 5 — E2E / hợp đồng API

**Phạm vi:** gọi HTTP thật vào NestJS app đang chạy.

**Cơ chế:**

```
1. Dựng app NestJS (Test.createTestingModule với module thật)
2. Kết nối Mongo replica set container + Redis container + MinIO
3. Seed dữ liệu
4. Gọi HTTP bằng supertest
5. Assert trên status, body, header
```

**Dữ liệu test — quyết định 7 (factory + seed):**

```
test/
├── factories/
│   ├── user.factory.ts        # sinh user với email/số điện thoại có seed cố định
│   ├── workspace.factory.ts
│   ├── project.factory.ts
│   ├── dataset.factory.ts     # sinh dataset với N dòng × M cột, seed cố định
│   └── ...
├── seed/
│   ├── dev.seed.ts            # dữ liệu cho môi trường dev (Phần 10 mục 3.9.2)
│   └── e2e.seed.ts            # dữ liệu nền cho E2E
└── fixtures/
    ├── valid-simple.csv       # file import hợp lệ
    ├── valid-multi-sheet.xlsx # file có nhiều sheet
    ├── invalid-duplicate-col.csv
    ├── invalid-empty-col.csv
    ├── invalid-bad-encoding.csv
    └── large-50k.csv          # để test hiệu năng import
```

**Quy tắc factory bắt buộc:**

| # | Quy tắc |
|---|---|
| 1 | Mỗi factory nhận `seed` và `overrides` — cùng seed ⇒ **cùng dữ liệu** |
| 2 | Seed mặc định cố định (VD `42`) — test lặp lại cho kết quả giống nhau |
| 3 | Email sinh tự động có hậu tố `@test.local` — không dùng email thật, không gửi được email thật |
| 4 | Dữ liệu sinh **không chứa PII thật** — số điện thoại dùng dải `0900000000`+ |
| 5 | File factory tạo tệp tạm, tự xoá sau test |

**Cơ chế seed `e2e.seed.ts` — nội dung tối thiểu:**

| Dữ liệu | Số lượng | Mục đích |
|---|---|---|
| Admin hệ thống | 1 | Test `SYS-ADMIN` |
| User thường | 5 | Test quyền cơ bản |
| Workspace + 3 thành viên | 2 | Test `WS-OWNER` / `WS-MEMBER` |
| Project (draft / in_progress / completed) | 6 | Test vòng đời `status` |
| Dataset đã import | 4 | Test Data View, lọc, tìm kiếm |
| Dataset lỗi tên cột | 1 | Test chặn phân tích |
| Báo cáo sự cố | 3 | Test `issues` |

**Phạm vi test bắt buộc — theo 85 endpoint:**

| Nhóm endpoint | Số | Mức test |
|---|---|---|
| `auth` | 13 | Đầy đủ — happy path + lỗi + rate-limit |
| `users` | 2 | Đầy đủ |
| `workspaces` | 10 | Đầy đủ |
| `projects` | 12 | Đầy đủ |
| `datasets` | 4 | Đầy đủ |
| `data-view` | 6 | Đầy đủ |
| `analysis` | 7 | Đầy đủ |
| `ai` | 1 | Đầy đủ |
| `summary` | 3 | Đầy đủ |
| `reports` | 1 | Đầy đủ |
| `notifications` | 3 | Đầy đủ |
| `issues` | 4 | Đầy đủ |
| `admin` | 1 | Đầy đủ |
| `versions` | 3 | Đầy đủ |
| `audit` | 3 | Đầy đủ |
| `health` | 3 | Đầy đủ — live/ready/deep |
| **Tổng** | **80** | |

**Mỗi endpoint tối thiểu 2 ca:** happy path + 1 ca lỗi (403 hoặc 404).

**Validate runtime Zod (quyết định 14 — phần 2):**

Mỗi response E2E được validate bằng schema Zod tương ứng trong `packages/contracts`:

```typescript
const response = await request(app.getHttpServer())
  .get(`/api/v1/workspaces/${workspaceId}`)
  .set('Authorization', `Bearer ${token}`);

expect(response.status).toBe(200);
const body = WorkspaceResponseSchema.parse(response.body);  // throw nếu sai shape
expect(body.data.name).toBe('Workspace mẫu');
```

**Quy tắc bắt buộc:**
1. Response **phải** parse được bằng schema — nếu không, test fail.
2. Assert cả **format lỗi**: `{ error: { code, message, details? } }` — `code` phải thuộc danh mục mã lỗi.
3. Assert header `X-Request-Id` tồn tại (Phần 10 mục 3.7.1).
4. **v4** Test phân trang: kiểm tra `meta` có `nextCursor` + `hasMore` + `limit`; **không** có `total`/`offset`.
5. Test 202 Accepted: kiểm tra response có `Location` header trỏ tới endpoint trạng thái job.
6. Test upload: kiểm tra file thực sự lên R2/MinIO và `storage_key` trả về đúng.

### 3.8. Tầng 6 — Kiểm tra kiến trúc

**Quyết định 5:** script checker tự động, theo pattern `check-module.mjs` thông dụng.

**Script:** `scripts/check-architecture.mjs`

**Các quy tắc kiểm tra:**

| # | Quy tắc | Cách kiểm tra |
|---|---|---|
| A1 | `domain/` không import NestJS | grep `from '@nestjs/` trong `*/domain/**` |
| A2 | `domain/` không import Mongoose | grep `from 'mongoose'` |
| A3 | `domain/` không import `infrastructure/` hoặc `application/` | phân tích import path |
| A4 | `application/` không import `infrastructure/` cụ thể — chỉ qua port | grep đường dẫn adapter |
| A5 | Module A không import trực tiếp module B | kiểm tra cross-module import giữa `src/modules/*` |
| A6 | Mọi module có đủ 6 thư mục tầng | kiểm tra cấu trúc thư mục |
| A7 | Mọi file trong `domain/` không dùng `any` | ESLint `no-explicit-any` trên đường dẫn |
| A8 | `packages/core` không import từ `apps/` | kiểm tra đường dẫn import |
| A9 | `packages/contracts` không import từ `apps/` hoặc `packages/core` | kiểm tra đường dẫn import |
| A10 | Mỗi module sở hữu đúng 1 phần schema | script so sánh danh sách schema với bảng sở hữu ở Phần 4 |
| A11 | Không có import từ `node_modules` trực tiếp trong `domain/` | ngoài danh sách cho phép |
| A12 | `apps/worker` không import `apps/api` | tách app rõ ràng |
| A13 | Không route/controller nào ghi vào `dataset_record` ngoài luồng Import | grep `updateOne`/`findOneAndUpdate`/`deleteMany`/`deleteOne`/`bulkWrite` trên repository `dataset_record` |
| A14 | Không tồn tại controller/route cho xoá dòng, sửa ô, clean-rules hay rollback phiên bản | kiểm tra danh mục route trong `packages/contracts` + `apps/api` |
| A15 | **v4** Không có `countDocuments`/`skip()` trong repository — mọi list query dùng **keyset pagination** | grep `countDocuments`/`\.skip(` trong `*/infrastructure/**` |
| A16 | **v4** Không có dependency/import tới SDK AI bên ngoài (`@google/generative-ai`, `openai`, `anthropic`) | grep trong `package.json` + mã nguồn |
| A17 | **v4** Chỉ adapter duy nhất được phép gọi engine suy luận (`AiInferencePort`) — module khác không import HTTP client của engine | kiểm tra import path trong `apps/worker` |
| A18 | **v4** Không có import `xlsx`/`exceljs`/`sheetjs` — hệ thống chỉ đọc CSV | grep trong `package.json` + mã nguồn |

**Quy tắc bắt buộc:**

| # | Quy tắc |
|---|---|
| 1 | Script **fail** (exit ≠ 0) khi có bất kỳ vi phạm nào — cùng cơ chế với test |
| 2 | Chạy trong `test:all` — không phải script tùy chọn |
| 3 | Danh sách ngoại lệ phải **ghi rõ lý do** trong file cấu hình `architecture.config.json`, không được suppress inline |
| 4 | Script có chế độ `--report` in ra bảng: quy tắc | số file kiểm tra | số vi phạm |
| 5 | Không có ngoại lệ "tạm" — ngoại lệ là cam kết lâu dài |

**Quy tắc cấm `any` (A7):**

Hệ thống tham chiếu đã có script `verify-montache.mjs` (kiểm tra `any`); Data Quality sẽ có quy tắc tương tự nhưng **chặt hơn**: `any` bị cấm trong toàn bộ `src/` và `packages/`, trừ 2 file khai báo `eslint-disable` có lý do ghi rõ.

### 3.9. Tầng 7 — Bảo mật và phân quyền

**Quyết định 9:** 48 tình huống truy cập trái phép (Phần 6 v5 mục 3.17) → test tự động.

**Cơ chế:** mỗi tình huống là 1 test E2E gọi API thật với token của vai trò khác.

**Bảng ánh xạ — 48 tình huống (nhóm theo loại tấn công):**

| Nhóm | Số | Mô tả |
|---|---|---|
| **Truy cập chéo workspace** | 8 | User của workspace A thử truy cập tài nguyên workspace B |
| **Truy cập chéo project** | 6 | User của project A thử truy cập project B cùng workspace |
| **Vai trò không đủ** | 6 | `PROJ-MEMBER` thử thao tác của `PROJ-OWNER` |
| **`SYS-ADMIN` vượt phạm vi** | 4 | Admin hệ thống thử đọc dữ liệu nghiệp vụ |
| **Không đăng nhập** | 4 | Gọi API không có token / token sai / token hết hạn |
| **Token bị thu hồi** | 3 | Dùng refresh token đã rotate; dùng session đã revoke |
| **Đối tượng đã xoá** | 3 | Truy cập tài nguyên soft-deleted |

**Bỏ 2 tình huống (2026-11-05):** 2 ca thuộc nhóm *Vai trò không đủ* là thao tác sửa ô / xoá dòng — đã bị gỡ khỏi phạm vi theo quyết định dữ liệu bất biến.

**Quy tắc bắt buộc:**

| # | Quy tắc |
|---|---|
| 1 | Mỗi tình huống assert **status đúng** (401 / 403 / 404) **và** `error.code` đúng |
| 2 | Assert **không có side effect** — dữ liệu không bị thay đổi sau request bị từ chối |
| 3 | Test đi qua **tầng HTTP thật** (guard + CASL + repository), không gọi thẳng service — nếu gọi thẳng service thì guard bị bỏ qua và test vô nghĩa |
| 4 | Mỗi tình huống ghi rõ mã UC và vai trò trong `describe` để truy xuất khi có sự cố |
| 5 | Bổ sung test **IDOR** — đổi ID trong URL của tài nguyên không thuộc phạm vi mình → 403/404 |

**Bộ test bổ sung bắt buộc:**

| Nhóm | Nội dung |
|---|---|
| Rate-limit | Đăng nhập sai 5 lần → 429; upload 21 lần → 429; register 4 lần → 429 |
| Refresh token rotation | Dùng lại refresh token cũ → thu hồi **toàn bộ** phiên |
| OTP | Sai 3 lần → khoá; hết hạn 10 phút → từ chối; tối đa 5 lần gửi/giờ |
| Che PII trong log | Response lỗi không chứa stack trace; log không chứa giá trị ô dữ liệu |
| Upload | File quá 50 MB → 413/400; mime type không hợp lệ → 415; path traversal trong tên file → chặn |
| XSS / injection | Tên project chứa `<script>` → lưu và trả về escaped; truy vấn chứa `$ne` → không rò dữ liệu |

### 3.10. Tầng 8 — Hiệu năng

**Quyết định 6:** k6, chạy thủ công trước release.

**File:** `test/k6/smoke.js`, `test/k6/stress.js` — theo pattern chuẩn.

**Kịch bản smoke:**

| Endpoint | Ngưỡng |
|---|---|
| `GET /api/v1/health/live` | p95 < 100 ms |
| `POST /api/v1/auth/login` | p95 < 500 ms |
| `GET /api/v1/workspaces` | p95 < 500 ms |
| `GET /api/v1/datasets/:id/rows` | p95 < 1000 ms (`limit` 50, không `offset`) |

**Kịch bản stress:**

| Kịch bản | Ngưỡng |
|---|---|
| 50 VU đồng thời đọc dataset 100k dòng | p95 < 2000 ms, `http_req_failed` < 1% |
| 20 VU đồng thời upload file 10 MB | `http_req_failed` < 2% |
| 10 VU chạy phân tích DQ-01 trên dataset 50k dòng | p95 < 8000 ms |

**Quy tắc bắt buộc:**

| # | Quy tắc |
|---|---|
| 1 | Chạy trên **staging**, không phải production — tránh nhiễu dữ liệu thật |
| 2 | Kết quả lưu vào `docs/test-reports/perf-<ngày>.md` — kèm số liệu p50/p95/p99 |
| 3 | Nếu vượt ngưỡng → **không release** cho tới khi tìm ra nguyên nhân hoặc điều chỉnh ngưỡng có ghi nhận |
| 4 | Ngưỡng số liệu trong ngưỡng hiệu năng của Phần 10 mục 3.8.2 (p99 < 5000 ms) là **mức cảnh báo**, không thay thế ngưỡng k6 |
| 5 | Không chạy k6 trong `test:all` — tách lệnh `pnpm test:perf` |

### 3.10b. Tầng 9 — Benchmark AI & học lại

**Quyết định 15–17.** Tầng này **duy nhất** gọi engine suy luận thật, và **chạy thủ công** — không nằm trong `test:all`.

**Mục tiêu:** chọn model AI cục bộ **tối ưu** bằng **số liệu đo được**, không bằng cảm tính; và xác minh vòng lặp học lại (feedback → mẫu → truy xuất → cải thiện) hoạt động.

#### 3.10b.1. Bộ benchmark model

**Tập mẫu:** file `test/benchmark/eval-set.jsonl` — **cố định**, version trong git.

| Thuộc tính | Yêu cầu |
|---|---|
| Số mẫu | **150–200** phát hiện đã được người dùng đánh giá (`label` trong `finding_feedback`) |
| Nguồn | Nhận xét **chưa** dùng làm `feedback_example` — tránh đánh giá ảo (Phần 8 v4 mục 3.7.6 quy tắc 4) |
| Phân bố | Cân bằng 5 nhóm `DQ-01`…`DQ-05`; có cả mẫu `false_positive` và `missed_issue` |
| Ngôn ngữ | Tiếng Việt (đúng miền dữ liệu thật) |
| Khoá | Mẫu **không** nằm trong kho `feedback_example` — kiểm tra tự động trước khi chạy |

**Năm model được so sánh (bắt buộc đủ cả 5):**

| Mã | Model | Tham số | Giả thuyết được kiểm chứng |
|---|---|---|---|
| `M1` | `Qwen3-14B-Q4_K_M` | 14B | Quy mô + đa ngữ thắng (~10 GB RSS) |
| `M2` | `Gemma-3-12B-IT` (QAT Q4) | 12B | Lượng tử QAT bù được phần thiếu tham số (~8 GB RSS) |
| `M3` | `Qwen3-8B-Q4_K_M` | 8B | Một nửa tham số có đủ cho tác vụ có cấu trúc? (~6 GB RSS) |
| `M4` | `Llama-3.1-8B-Instruct-Q4_K_M` | 8B | Baseline hệ sinh thái lớn (~6 GB RSS) |
| `M5` | `Vistral-7B-Chat-Q4_K_M` | 7B | Chuyên biệt tiếng Việt thắng quy mô? (~5 GB RSS) |

**Model bị loại trước benchmark (phải ghi trong báo cáo):** `Qwen3-30B-A3B` (18 GB > RAM), `DeepSeek-R1-Distill-Qwen-14B` (p95 vượt 180 s), `Phi-4-mini` / `PhoGPT-4B` (quá nhỏ cho giải thích tiếng Việt).

> **Model chấm điểm (LLM-as-judge):** `Qwen3-32B` **không khả thi** trên 15 GB RAM. Chấm **chéo** giữa model khác họ (M2 chấm M1, M4 chấm M3) để giảm self-preference bias.

**Chạy benchmark:** `pnpm test:benchmark -- --model=M-A --set=eval-set.jsonl`

#### 3.10b.2. Chín chỉ số đánh giá (5 nhóm) và quy tắc quyết định

| # | Nhóm | Chỉ số | Cách đo | Ngưỡng tuyệt đối | Trọng số |
|---|---|---|---|---|---|
| 1 | Chất lượng | F1 phát hiện (micro) | `2PR/(P+R)` trên 200 mẫu | ≥ 0,75 | 30 |
| 2 | Chất lượng | F1 macro theo DQ-01→05 | trung bình 5 lớp | ≥ 0,70 | 10 |
| 3 | Tuân thủ | Tỉ lệ JSON hợp lệ | % parse được ngay, không sửa | ≥ 98 % | 12 |
| 4 | Tuân thủ | Tỉ lệ ảo giác (grounding) | % số liệu trích dẫn **lệch** | ≤ 2 % | 10 |
| 5 | Ngôn ngữ | Chất lượng giải thích tiếng Việt | LLM-as-judge chấm chéo, 1–5 | ≥ 4,0 | 13 |
| 6 | Hiệu năng | p95 latency / 1 job | 3 lần chạy, bỏ warm-up | ≤ 180 s | 10 |
| 7 | Hiệu năng | Throughput | tok/s sinh | ≥ 4 tok/s | 5 |
| 8 | Tài nguyên | RSS đỉnh | `docker stats` khi chạy benchmark | ≤ 11 GB | 5 |
| 9 | Vận hành | Độ ổn định | % job lỗi / retry trên 200 mẫu | ≤ 2 % | 5 |

Tổng trọng số = **100**. Chuẩn hoá min–max trên 5 model; đảo nghịch chỉ số #4, #6, #8, #9. **Rớt bất kỳ ngưỡng tuyệt đối → loại model**, không cần tính điểm.

**Quy tắc quyết định (bắt buộc):**

| # | Quy tắc |
|---|---|
| 1 | Model chỉ được coi là "tối ưu" nếu **đạt tất cả 9 ngưỡng tuyệt đối** |
| 2 | Chênh lệch F1 **< 0,03** giữa hai model → **không coi là khác biệt**, chuyển sang so #3–#9 (model rẻ/ổn định hơn thắng) |
| 3 | Cặp đúng/sai phát hiện → **McNemar test**; điểm judge → **Wilcoxon signed-rank**; chỉ tuyên bố thắng khi **ΔF1 ≥ 0,03 và p < 0,05** |
| 4 | Chọn theo **đường Pareto** (p95 × F1, kích thước = RSS) — không chọn điểm chất lượng tuyệt đối cao nhất |
| 5 | Benchmark chạy **trên đúng phần cứng production** (CPU-only, cùng VPS); chạy trên máy có GPU rồi deploy CPU-only là sai lầm phổ biến |
| 6 | `temperature=0.2`, `top_p=0.9`, `seed` cố định, `max_tokens` cố định; mỗi model chạy **3 lần** → báo cáo mean ± std |
| 7 | Mẫu benchmark **không** nằm trong kho `feedback_example` — kiểm tra tự động trước khi chạy (chống rò rỉ đáp án) |
| 8 | Báo cáo lưu tại `docs/test-reports/benchmark-<model>-<ngày>.md` — **bắt buộc** trước khi chốt model production; ghi kèm điểm 9 chỉ số, giá trị p, đường Pareto |
| 9 | Benchmark chạy lại **bắt buộc** khi: đổi model / phiên bản model / prompt template / engine suy luận / cập nhật kho few-shot |
| 10 | Kết quả benchmark quyết định **cặp model cho kiến trúc định tuyến hai tầng** (tầng nhanh: gợi ý nhãn/phân loại/JSON ngắn; tầng sâu: giải thích/gợi ý/nhận xét) — Phần 12 v5 mục 3.15.6 |
| 11 | Tầng 9 **không** thuộc `test:all` và **không** là tiêu chí nghiệm thu đợt 1 — chạy thủ công trước khi chốt model production |

#### 3.10b.3. Test vòng lặp học lại (RAG T1)

**Kịch bản tích hợp (tầng 4, chạy tự động — dùng fake embedding adapter):**

```
1. Tạo 5 feedback với label `false_positive` cho cùng 1 loại lỗi
2. Worker chuẩn hoá → sinh `feedback_example` (trust_score = 0.6 → chưa đủ 3 người)
3. Thêm 2 feedback nữa từ 2 người khác → trust_score ≥ 0.6 → is_active = true
4. Truy xuất vector top-5 theo `column_profile` → phải trả về mẫu đó
5. Inject 5 mẫu vào prompt của lượt suy luận tiếp theo → assert prompt **chứa** mẫu
6. Xoá 1 feedback nguồn → mẫu tương ứng vẫn tồn tại (đã ẩn danh hoá)
7. Mẫu cũ hơn 180 ngày → bị TTL dọn
```

**Quy tắc bắt buộc:**

| # | Quy tắc |
|---|---|
| 1 | Mẫu được inject **chỉ khi** `is_active = true` **và** `trust_score ≥ 0,6` |
| 2 | Prompt **không được** chứa PII — mẫu đã ẩn danh hoá (kiểm tra bằng regex email/SĐT/tên) |
| 3 | Số mẫu inject tối đa **5** — không được làm phình context (giới hạn RAM) |
| 4 | Mẫu **không** được dùng làm ground truth của bộ benchmark |
| 5 | Xoá project → mẫu ẩn danh hoá **được giữ**, feedback gốc bị xoá |

### 3.11. Ma trận truy xuất ngược — 120 quy tắc kiểm thử

Đây là **trái tim** của Phần 13: gom 120 quy tắc đã rải rác ở 11 phần trước về một bảng, mỗi quy tắc gắn với tầng test và file test cụ thể.

> **Cập nhật 2026-11-05 (dữ liệu bất biến):** bổ sung **S19** (ràng buộc insert-only cho `dataset_record`) và **A13–A14** (cấm route ghi dữ liệu ngoài import). Các quy tắc liên quan xoá dòng / sửa ô / clean-rules / rollback phiên bản đã bị gỡ khỏi ma trận.

**Cấu trúc bảng:** `| Mã | Nội dung rút gọn | Tầng | File test | Trạng thái |`

#### 3.11.1. Quy tắc schema — S1–S19 (Phần 8 v3)

| Mã | Nội dung rút gọn | Tầng | File test | Trạng thái |
|---|---|---|---|---|
| S1 | `_id` có tiền tố đúng + ULID26 | 2 | `core/id-generator.spec.ts` | ☐ |
| S2 | Collection có đúng trường bắt buộc | 4 | `infrastructure/schema-contract.spec.ts` | ☐ |
| S3 | Mọi collection nghiệp vụ có `created_at`/`updated_at` | 4 | `infrastructure/schema-contract.spec.ts` | ☐ |
| S4 | `deleted_at` mặc định `null` | 4 | `infrastructure/schema-contract.spec.ts` | ☐ |
| S5 | Soft delete lọc đúng ở mọi query | 3, 4 | `mongo-repository.spec.ts` | ☐ |
| S6 | Unique partial index chặn trùng khi `deleted_at = null` | 4 | `mongo-repository.spec.ts` | ☐ |
| S7 | `version` tăng đúng khi update | 3, 4 | `mongo-repository.spec.ts` | ☐ |
| S8 | `dataset_record.props` chỉ chứa key hợp lệ | 2, 4 | `dataset-record.spec.ts` | ☐ |
| S9 | `dataset_sheet.columns` key `c0`/`c1` liên tục | 2, 4 | `dataset-sheet.spec.ts` | ☐ |
| S10 | Index compound phục vụ đúng truy vấn | 4 | `index-contract.spec.ts` | ☐ |
| S11 | TTL index dọn đúng thời hạn | 4 | `ttl-index.spec.ts` | ☐ |
| S12 | Transaction boundary đúng cho 19 use case | 3, 4 | `transaction-boundary.spec.ts` | ☐ |
| S13 | R2 key structure đúng quy ước | 4 | `r2-storage.spec.ts` | ☐ |
| S14 | `storage_key` không lộ ra response | 5 | `contract-no-leak.spec.ts` | ☐ |
| S15 | Soft delete không áp cho collection log | 4 | `schema-contract.spec.ts` | ☐ |
| S16 | `outbox_event.status` chỉ 4 giá trị hợp lệ | 4 | `outbox-relay.spec.ts` | ☐ |
| S17 | `processed_event` unique `(consumer_name, event_id)` | 4 | `inbox.spec.ts` | ☐ |
| S18 | `notification.source_event_id` unique partial | 4 | `notification.spec.ts` | ☐ |
| S19 | `dataset_record` **insert-only** — không có `updateOne`/`deleteMany`/`findOneAndUpdate`, không có `deleted_at`, không nằm trong danh sách soft-delete | 2, 4 | `dataset-record-immutable.spec.ts` | ☐ |
| S20 | **v4** `dataset_sheet` **không tồn tại** — cột nằm trực tiếp trong `dataset.columns[]` | 2, 4 | `schema-contract.spec.ts` | ☐ |
| S21 | **v4** `dataset.columns[].key` = `c{i}` liên tục, bất biến khi đổi tên cột | 2, 4 | `dataset-columns.spec.ts` | ☐ |
| S22 | **v4** `finding_feedback` là **append-only** — không có `deleted_at` xoá cứng; `author_role_at_time` không bị ghi lại | 2, 4 | `feedback-immutable.spec.ts` | ☐ |
| S23 | **v4** `feedback_example.trust_score < 0,6` → `is_active = false`; `expires_at` TTL 180 ngày | 4 | `feedback-example.spec.ts` | ☐ |

#### 3.11.2. Quy tắc contract — C1–C8 (Phần 7 v2)

| Mã | Nội dung rút gọn | Tầng | File test | Trạng thái |
|---|---|---|---|---|
| C1 | Response trả dữ liệu thẳng, không bọc | 5 | `api-contract.spec.ts` | ☐ |
| C2 | Trường response `camelCase` | 1, 5 | `api-contract.spec.ts` | ☐ |
| C3 | Lỗi theo `{ error: { code, message, details? } }` | 5 | `api-error-format.spec.ts` | ☐ |
| C4 | `meta` phân trang đúng cấu trúc | 5 | `api-pagination.spec.ts` | ☐ |
| C5 | Upload không yêu cầu idempotency key | 5 | `api-upload.spec.ts` | ☐ |
| C6 | Job bất đồng bộ trả 202 + `Location` | 5 | `api-async.spec.ts` | ☐ |
| C7 | Download trả stream, không nhúng base64 | 5 | `api-download.spec.ts` | ☐ |
| C8 | Mọi endpoint có trong OpenAPI | 1 | `openapi-snapshot.spec.ts` | ☐ |
| C9 | **v4** Phân trang cursor: `meta` có `nextCursor` + `hasMore`, **không** có `total`/`offset` | 5 | `api-cursor-pagination.spec.ts` | ☐ |
| C10 | **v4** Cursor là **opaque** — client không được tự parse; cursor sai định dạng → `VALIDATION_ERROR` | 5 | `api-cursor-pagination.spec.ts` | ☐ |
| C11 | **v4** Duyệt trang bằng cursor → **không trùng, không thiếu, không lệch thứ tự** so với offset (đối chiếu offline) | 5 | `api-cursor-pagination.spec.ts` | ☐ |
| C12 | **v4** Chèn/xoá bản ghi giữa 2 lần đọc → cursor cũ vẫn đọc được dữ liệu **không bị bỏ sót** (tính chất keyset) | 5 | `api-cursor-pagination.spec.ts` | ☐ |
| C13 | **v4** Upload file không phải `.csv` → `400` `UNSUPPORTED_FILE_TYPE` | 5 | `api-upload.spec.ts` | ☐ |

#### 3.11.3. Quy tắc integration — I1–I14 (Phần 9 v2)

| Mã | Nội dung rút gọn | Tầng | File test | Trạng thái |
|---|---|---|---|---|
| I1 | Event ghi trong cùng transaction với thay đổi | 4 | `transaction-boundary.spec.ts` | ☐ |
| I2 | Relay claim → publish → `published` | 4 | `outbox-relay.spec.ts` | ☐ |
| I3 | Event kẹt `publishing` được polling thu hồi | 4 | `outbox-relay.spec.ts` | ☐ |
| I4 | `retry_count` tăng khi publish fail | 4 | `outbox-relay.spec.ts` | ☐ |
| I5 | `retry_count > 5` → `failed` | 4 | `outbox-relay.spec.ts` | ☐ |
| I6 | Inbox chặn xử lý trùng | 4 | `inbox.spec.ts` | ☐ |
| I7 | Inbox lease hết hạn được chiếm lại | 4 | `inbox.spec.ts` | ☐ |
| I8 | Consumer chỉ chạy ở `apps/worker` | 6 | `architecture.spec.ts` | ☐ |
| I9 | Job Kafka retry đúng số lần (backoff) | 4 | `kafka-consumer.spec.ts` | ☐ |
| I10 | Message bị redeliver sau khi consumer chết → được xử lý lại | 4 | `kafka-consumer.spec.ts` | ☐ |
| I11 | Job AI timeout 180s (v4 — CPU-only) | 4 | `ai-job.spec.ts` | ☐ |
| I12 | Che PII trước khi gửi tới engine suy luận cục bộ | 2, 4 | `pii-masking.spec.ts` | ☐ |
| I13 | PDF sinh ở worker, không ở API | 6 | `architecture.spec.ts` | ☐ |
| I14 | Cleanup job chạy 02:00 VN, xoá đúng retention | 4 | `cleanup-job.spec.ts` | ☐ |
| I15 | **v4** Outbox relay publish ra **Kafka topic đúng** (`domain.events` / `ai.jobs` / `notification.dispatch` / `realtime.push`) | 4 | `kafka-producer.spec.ts` | ☐ |
| I16 | **v4** Message vượt số lần retry → vào topic `dlq.dead-letter` kèm header `x-original-topic` | 4 | `kafka-dlq.spec.ts` | ☐ |
| I17 | **v4** Consumer group: 2 consumer cùng group **không** xử lý trùng message | 4 | `kafka-consumer.spec.ts` | ☐ |
| I18 | **v4** Consumer chết → partition rebalance → message được đọc lại, xử lý đúng 1 lần (nhờ inbox) | 4 | `kafka-consumer.spec.ts` | ☐ |
| I19 | **v4** Sự kiện `analysis.completed` → publish `realtime.push` → Socket.IO emit đúng room (`analysis:{id}`, `project:{id}`, `user:{id}`) | 4, 5 | `realtime-push.spec.ts` | ☐ |
| I20 | **v4** Sự kiện `notification.created` → publish `notification.dispatch` → gửi email **đúng 1 lần** (idempotent qua `source_event_id`) | 4 | `notification-dispatch.spec.ts` | ☐ |
| I21 | **v4** Job AI publish `ai.jobs` → worker consume → gọi engine cục bộ → ghi `ai_job` với `model_id` + `kafka_offset` | 4 | `ai-job-kafka.spec.ts` | ☐ |

#### 3.11.4. Quy tắc vận hành — O1–O28 (Phần 10 v3)

| Mã | Nội dung rút gọn | Tầng | File test | Trạng thái |
|---|---|---|---|---|
| O1 | Thiếu biến môi trường → refuse to start | 5 | `env-validation.spec.ts` | ☐ |
| O2 | Production không có transaction → refuse to start | 5 | `env-validation.spec.ts` | ☐ |
| O3 | Probe tự phát hiện đúng tầng fallback | 4 | `db-capability.spec.ts` | ☐ |
| O4 | Tầng giả lập ghi outbox vẫn hoạt động | 4 | `db-capability.spec.ts` | ☐ |
| O5 | `/health/live` 200 khi Mongo chết | 5 | `health.spec.ts` | ☐ |
| O6 | `/health/ready` 503 khi Mongo/Redis lỗi | 5 | `health.spec.ts` | ☐ |
| O7 | Health không lộ connection string | 5 | `health.spec.ts` | ☐ |
| O8 | `/health/deep` báo đúng AI + R2 | 5 | `health.spec.ts` | ☐ |
| O9 | Log JSON hợp lệ, mỗi dòng parse được | 4 | `logger.spec.ts` | ☐ |
| O10 | Không log giá trị trường redact | 4 | `logger.spec.ts` | ☐ |
| O11 | Không log giá trị ô dữ liệu | 4 | `logger.spec.ts` | ☐ |
| O12 | `X-Request-Id` trả về và có trong log | 5 | `request-id.spec.ts` | ☐ |
| O13 | Metrics snapshot đúng 1 giờ 1 lần, không chứa dữ liệu người dùng | 4 | `metrics.spec.ts` | ☐ |
| O14 | Script backup exit ≠ 0 khi `mongodump` fail | 5 | `backup-script.spec.ts` | ☐ |
| O15 | Restore được thử trên staging | — | *thủ công, ghi log deploy* | ☐ |
| O16 | Deploy script dừng khi thiếu biến bắt buộc | 5 | `deploy-script.spec.ts` | ☐ |
| O17 | Migration idempotent — chạy 2 lần giống nhau | 5 | `migration-idempotent.spec.ts` | ☐ |
| O18 | Worker restart không mất message Kafka (offset chưa commit) | 4 | `kafka-consumer.spec.ts` | ☐ |
| O19 | Container chạy user không phải root | — | *kiểm tra `docker inspect` khi deploy* | ☐ |
| O20 | Image không chứa secret | — | *kiểm tra `docker history` khi build* | ☐ |
| O21 | Redis > 80% → cảnh báo | 4 | `alert-threshold.spec.ts` | ☐ |
| O22 | Outbox pending > 300s → cảnh báo | 4 | `alert-threshold.spec.ts` | ☐ |
| O23 | Cleanup giảm đúng `storage_used_bytes` | 4 | `cleanup-job.spec.ts` | ☐ |
| O24 | Upload vượt quota bị chặn trước khi ghi file | 4, 5 | `storage-quota.spec.ts` | ☐ |
| O25 | Cutover dừng cả `api` và `worker` | — | *kiểm tra trong quy trình cutover* | ☐ |
| O26 | Message Kafka còn nguyên sau khi dừng worker | 4 | `kafka-consumer.spec.ts` | ☐ |
| O27 | Deploy `--mode=migration` chạy backup trước | 5 | `deploy-script.spec.ts` | ☐ |
| O28 | `MIGRATION_CONFIRM=yes` bắt buộc để ghi | 5 | `migration-idempotent.spec.ts` | ☐ |
| O29 | **v4** Không container nào publish port engine AI (`:8000`) hay Kafka (`:9092`) ra host | — | *kiểm tra `docker compose config` khi deploy* | ☐ |
| O30 | **v4** Checksum SHA-256 file model khớp `AI_MODEL_PRIMARY_SHA256` — entrypoint từ chối nạp nếu lệch | 4 | `model-checksum.spec.ts` | ☐ |
| O31 | **v4** Tổng RSS các container ≤ 90% RAM máy | — | *kiểm tra `docker stats` khi deploy* | ☐ |
| O32 | **v4** Tất cả consumer group Kafka có **lag = 0** khi ổn định; `dlq.dead-letter` không có message mới | 4 | `kafka-lag.spec.ts` | ☐ |
| O33 | **v4** Engine suy luận trả 200 ở `/health` sau khi nạp model; nếu không, API vẫn phục vụ được phần không-AI | 5 | `health.spec.ts` | ☐ |
| O34 | **v4** Upload file không phải `.csv` bị từ chối `UNSUPPORTED_FILE_TYPE` | 5 | `api-upload.spec.ts` | ☐ |
| O35 | **v4** Không có lời gọi `countDocuments` trong mã nguồn (kiểm tra tĩnh) | 6 | `architecture.spec.ts` | ☐ |

**Ghi chú:** O15, O19, O20, O25 là kiểm tra **thủ công** — không tự động hoá được (cần thao tác hạ tầng). Đánh dấu bằng ghi chú thay vì ô ☐ để phân biệt "chưa làm" với "làm thủ công".

#### 3.11.5. Quy tắc migration — M1–M24 (Phần 11 v2)

| Mã | Nội dung rút gọn | Tầng | File test | Trạng thái |
|---|---|---|---|---|
| M1 | `migrate` mặc định dry-run | 5 | `migration-idempotent.spec.ts` | ☐ |
| M2 | `--apply` yêu cầu xác nhận | 5 | `migration-idempotent.spec.ts` | ☐ |
| M3 | Chạy 2 lần cho kết quả giống nhau | 5 | `migration-idempotent.spec.ts` | ☐ |
| M4 | `verify` không ghi vào collection nghiệp vụ | 5 | `migration-verify.spec.ts` | ☐ |
| M5 | Đối chiếu số lượng khớp công thức | 5 | `migration-verify.spec.ts` | ☐ |
| M6 | Hash mẫu 1% — sai lệch 0 | 5 | `migration-verify.spec.ts` | ☐ |
| M7 | Referential integrity — 0 orphan | 5 | `migration-verify.spec.ts` | ☐ |
| M8 | Mỗi workspace đúng 1 Owner | 5 | `migration-permission.spec.ts` | ☐ |
| M9 | Mỗi project đúng 1 Owner | 5 | `migration-permission.spec.ts` | ☐ |
| M10 | Thành viên workspace có `project_member` | 5 | `migration-permission.spec.ts` | ☐ |
| M11 | Không membership trùng | 5 | `migration-permission.spec.ts` | ☐ |
| M12 | Collection cũ không bị sửa | 5 | `migration-idempotent.spec.ts` | ☐ |
| M13 | `cell_evidence.value_masked` đã che PII | 5 | `migration-verify.spec.ts` | ☐ |
| M14 | `props` dùng key `c0`/`c1` | 5 | `migration-verify.spec.ts` | ☐ |
| M15 | Đảo ngược `props` → `data` giống hệt | 5 | `migration-verify.spec.ts` | ☐ |
| M16 | `project.status` khớp quy tắc | 5 | `migration-verify.spec.ts` | ☐ |
| M17 | Số bản ghi bị bỏ qua ≤ 1% | 5 | `migration-verify.spec.ts` | ☐ |
| M18 | `id_map` unique `(entity_type, old_id)` | 4 | `id-map.spec.ts` | ☐ |
| M19 | `outbox_event.status` 4 giá trị hợp lệ | 4 | `outbox-relay.spec.ts` | ☐ |
| M20 | Script drop từ chối khi chưa verify | 5 | `migration-verify.spec.ts` | ☐ |
| M21 | Script drop chỉ xoá **7** collection LEGACY | 5 | `migration-verify.spec.ts` | ☐ |
| M22 | Sau cutover request trả đúng dữ liệu | 5 | `cutover-smoke.spec.ts` | ☐ |
| M23 | Rollback mức 1 < 5 phút | — | *thủ công, đo thời gian* | ☐ |
| M24 | Backup trước cutover đã restore thử | — | *thủ công, ghi log deploy* | ☐ |
| M25 | `dataset_versions` **không** được migrate — không có bản ghi nào sang `dataset_version` (collection không còn tồn tại) | 5 | `migration-verify.spec.ts` | ☐ |
| M26 | Sau cutover, `dataset_record` chỉ chứa dữ liệu từ file gốc — không có bản ghi sinh ra từ thao tác sửa/xoá | 5 | `migration-verify.spec.ts` | ☐ |
| M27 | **v4** `dataset_sheet` không tồn tại trong collection mới sau cutover | 5 | `migration-verify.spec.ts` | ☐ |
| M28 | **v4** Mọi `dataset.file_format` = `csv` — dataset Excel cũ bị bỏ qua kèm cảnh báo | 5 | `migration-verify.spec.ts` | ☐ |
| M29 | **v4** `finding_feedback` + `feedback_example` tồn tại và có đủ index (kể cả vector index) | 5 | `migration-verify.spec.ts` | ☐ |

**Tổng kết ma trận (v4):**

| Nhóm | Tổng | Tự động | Thủ công | Ghi chú |
|---|---|---|---|---|
| S (schema) | 23 | 23 | 0 | +S20…S23 (CSV, feedback) |
| C (contract) | 13 | 13 | 0 | +C9…C13 (cursor, CSV) |
| I (integration) | 21 | 21 | 0 | +I15…I21 (Kafka, realtime) |
| O (operations) | 35 | 30 | 5 | +O29…O35 (AI nội bộ) |
| M (migration) | 29 | 26 | 3 | +M27…M29, M21 5→7 collection |
| **Tổng** | **120** | **112** | **8** | |

**Quy tắc bắt buộc:**
1. 112 quy tắc tự động phải có **file test cụ thể** — không có ngoại lệ "test sau".
2. 8 quy tắc thủ công phải có **dòng ghi nhận** trong báo cáo nghiệm thu kèm người thực hiện và ngày.
3. Ma trận này là **nguồn sự thật duy nhất** về trạng thái kiểm thử — cập nhật cùng lúc khi thêm test.

### 3.11b. Quy tắc bổ sung v6 — DQ-05 có điều kiện + ma trận tương quan/VIF + AI đánh giá (mới)

| Mã | Nội dung rút gọn | Tầng | File test |
|---|---|---|---|
| S24 | `analysis_result.dq05.status` chỉ nhận `unassessed/assessed`; `assessed` bắt buộc có `ruleId/version` | 2, 4 | `dq05-status.spec.ts` |
| C14 | `GET analysis/result` trả `correlationMatrix + vif + aiCorrelationAssessment` đúng schema mục 3.13b Phần 7 v4 | 5 | `api-analysis-result.spec.ts` |
| I22 | Ma trận không khả nghịch → VIF `null` + thông báo phụ thuộc tuyến tính hoàn hảo, không ném | 2, 4 | `vif-singular.spec.ts` |
| I23 | AI trích số không tồn tại trong ma trận/VIF → bị loại; AI lỗi không chặn kết quả hệ thống | 3, 4 | `ai-corr-grounding.spec.ts` |
| O36 | Tương quan cao/VIF cao **không** tự sinh quy tắc DQ-05 (kiểm tra tĩnh + test hành vi) | 6 | `architecture.spec.ts` |

**Tổng sau v6: 120 → 125 quy tắc (112 → 117 tự động).**

### 3.12. Bảng mapping tính năng / use case / endpoint

**Quyết định 13:** bảng đầy đủ.

**Cấu trúc:** 3 bảng riêng, mỗi bảng có cột `Tầng test` và `Trạng thái`.

#### 3.12.1. Mapping 79 tính năng → tầng test

| Nhóm tính năng | Mã | Số | Tầng test chính | Ghi chú |
|---|---|---|---|---|
| Xác thực | `AUTH-01`→`AUTH-13` | 13 | 3, 5, 7 | Nhiều ca lỗi — bảo mật nhạy cảm |
| Hồ sơ người dùng | `USER-01`, `USER-02` | 2 | 3, 5 | |
| Quản trị hệ thống | `ADMIN-01` | 1 | 5, 7 | Chỉ `SYS-ADMIN` |
| Workspace | `WS-01`→`WS-10` | 10 | 3, 5, 7 | `WS-08` cần dữ liệu tổng quan |
| Project | `PROJ-01`→`PROJ-13` (trừ `PROJ-06`→`PROJ-08`) | 10 | 3, 5, 7 | Vòng đời `status` cần test riêng — 3 tính năng lịch sử phiên bản đã gỡ |
| Dataset | `FILE-01`, `FILE-02`, `DATA-02` | 3 | 3, 4, 5 | Import là luồng phức tạp nhất — `DATA-01` (xoá dòng) đã gỡ |
| Data View | `VIEW-01`→`VIEW-08` | 8 | 3, 5 | Lọc/sort/tìm kiếm — nhiều ca |
| Phân tích | `ANALYSIS-01`→`ANALYSIS-07` | 7 | 2, 3, 5 | Thuật toán ở tầng 2 |
| Phát hiện DQ | `DQ-01`→`DQ-05` | 5 | 2, 3, 5 | `DQ` tách riêng trong Phần 2 |
| AI | `AI-01`, `AI-02` | 2 | 2, 4, 5 | Luôn mock ở tầng 1–8; `AI-02` = **Thử lại AI** |
| **Feedback & học lại** | `FB-01`→`FB-06` | 6 | 2, 3, 4, 5, 9 | `FB-05` (kho mẫu học lại) cần **tầng 9** |
| Tổng kết | `SUMMARY-01` | 1 | 3, 5 | |
| Báo cáo PDF | `REPORT-01` | 1 | 4, 5 | Sinh ở worker |
| Thông báo | `NOTIF-01`→`NOTIF-03` | 3 | 3, 4, 5 | Idempotent qua `source_event_id` |
| Báo cáo sự cố | `ISSUE-01`→`ISSUE-04` | 4 | 3, 5, 7 | Upload tệp đính kèm |
| **Tổng** | | **79** | | | |

**Cột trạng thái:** mỗi tính năng có 1 trong 4 trạng thái: `☐ chưa test` · `◐ test đang viết` · `☑ đã test` · `⊘ ngoài phạm vi`.

#### 3.12.2. Mapping 66 use case → tầng test

| Nhóm UC | Mã | Số | Tầng test chính | Ca bắt buộc |
|---|---|---|---|---|
| Sản phẩm mới | `UC-01`→`UC-27` (trừ `UC-11`) | 26 | 3, 5 | happy + không đủ quyền |
| LEGACY (đã bỏ) | `UC-28`→`UC-31` | 4 | — | `⊘` — xoá khỏi phạm vi (quyết định 1) |
| Xác thực / tài khoản | `UC-32`→`UC-46` | 15 | 3, 5, 7 | + token reuse, rate-limit |
| Workspace/project bổ sung | `UC-47`→`UC-59` (trừ `UC-58`, `UC-59`) | 11 | 3, 5, 7 | + quyền xoá tài nguyên (không còn rollback phiên bản) |
| Thông báo | `UC-60`→`UC-63` | 4 | 3, 4, 5 | + idempotent |
| Báo cáo sự cố | `UC-64`→`UC-67` | 4 | 3, 5, 7 | + upload, quyền Admin |
| **Nhận xét kết quả** | `UC-68`→`UC-72` | 5 | 2, 3, 4, 5, 9 | + quyền theo vai trò, snapshot `ai_confidence`, vòng lặp học lại |
| **Tổng** | | **66** | |
**Ghi chú (2026-11-05):**
- `UC-11` (xoá dòng), `UC-18` (sửa ô), `UC-28`→`UC-30` (clean-rules, lineage, exports), `UC-29` (lịch sử phiên bản), `UC-30` (lineage), `UC-58`/`UC-59` (lịch sử phiên bản project) — **bị gỡ khỏi phạm vi** do quyết định dữ liệu bất biến.
- `UC-12` (Reset Dataset) được **thu hẹp**: chỉ còn đặt lại **tên cột** về đúng tên trong file gốc — không đụng tới dữ liệu.
- 5 use case bị gỡ → 67 → 62.

#### 3.12.3. Mapping 85 endpoint → tầng test

| Nhóm endpoint | Số | Tầng | Ghi chú |
|---|---|---|---|
| `auth` | 13 | 5, 7 | 5 endpoint cần token hợp lệ |
| `users` | 2 | 5 | |
| `workspaces` | 10 | 5, 7 | |
| `projects` | 12 | 5, 7 | |
| `datasets` | 4 | 5 | Upload multipart |
| `data-view` | 8 | 5 | Phân trang + lọc |
| `analysis` | 7 | 5 | Một số bất đồng bộ |
| `ai` | 1 | 5 | 202 Accepted |
| `summary` | 3 | 5 | |
| `reports` | 1 | 5 | Stream download |
| `notifications` | 3 | 5 | |
| `issues` | 4 | 5, 7 | Upload tệp đính kèm |
| `admin` | 1 | 5, 7 | |
| `audit` | 3 | 5, 7 | Quyền xem theo phạm vi workspace |
| `health` | 3 | 5 | |
| `feedback` | 5 | 3, 5, 7 | `FB-01`→`FB-05` (UC-68…UC-72) |
| **Tổng** | **85** | | Mỗi endpoint ≥ 2 ca test |

**Endpoint bị gỡ (2026-11-05):** `POST /datasets/{id}/records/delete`, `PATCH /datasets/{id}/records/{rowIndex}`, `POST /datasets/{id}/versions`, `GET /datasets/{id}/versions/diff`, `GET /datasets/{id}/versions/{versionNumber}` — tổng 85 → 80.

**Quy tắc bắt buộc:**
1. Mỗi endpoint có **ít nhất 2 ca**: happy path + 1 ca lỗi.
2. Endpoint nhạy cảm (audit, admin, issues, users, feedback) có **ít nhất 4 ca**: thêm 2 ca phân quyền.
3. Bảng mapping được cập nhật **mỗi khi** thêm endpoint mới ở Phần 7 hoặc thêm test.
4. **v4:** Mọi endpoint trả danh sách phải có test phân trang **cursor** (C9–C12) — không dùng `offset`.

### 3.13. Ngưỡng đạt và quy trình kiểm tra

#### 3.13.1. Lệnh kiểm tra

```json
{
  "scripts": {
    "test:unit": "jest --config jest.unit.json",
    "test:domain": "jest --config jest.unit.json --selectProjects domain",
    "test:app": "jest --config jest.unit.json --selectProjects application",
    "test:infra": "jest --config jest.unit.json --selectProjects infrastructure",
    "test:contract": "jest --config jest.unit.json --selectProjects contract",
    "test:e2e": "jest --config test/jest-e2e.json --runInBand",
    "test:security": "jest --config test/jest-e2e.json --selectProjects security",
    "test:arch": "node scripts/check-architecture.mjs",
    "test:coverage": "jest --coverage",
    "test:perf": "k6 run test/k6/smoke.js && k6 run test/k6/stress.js",
    "test:all": "pnpm test:unit && pnpm test:contract && pnpm test:arch && pnpm test:e2e && pnpm test:security",
    "test:report": "node scripts/generate-test-report.mjs"
  }
}
```

**Quy tắc bắt buộc:**

| # | Quy tắc |
|---|---|
| 1 | `test:all` là lệnh **duy nhất** dùng để quyết định "đủ điều kiện commit" — không ghép lệnh thủ công |
| 2 | `test:all` **không** chạy `test:perf` (k6 cần app chạy thật + staging) |
| 3 | `test:all` **tự bật/tắt** container test — người dùng chỉ cần `pnpm test:all` |
| 4 | Mọi lỗi test phải **fail** script — không dùng `--passWithNoTests` |
| 5 | `test:coverage` chạy **sau** `test:all` để không chậm bước phát hiện lỗi sớm |

#### 3.13.2. Ngưỡng coverage theo tầng

| Tầng | Đường dẫn | lines | branches | functions | statements |
|---|---|---|---|---|---|
| Domain | `packages/core/src/**`, `*/domain/**` | **≥ 90%** | ≥ 85% | ≥ 90% | ≥ 90% |
| Application | `*/application/**` | **≥ 80%** | ≥ 75% | ≥ 80% | ≥ 80% |
| Infrastructure | `*/infrastructure/**` | **≥ 60%** | ≥ 50% | ≥ 60% | ≥ 60% |
| Contracts | `packages/contracts/src/**` | ≥ 95% | ≥ 90% | ≥ 95% | ≥ 95% |
| **Tổng** | toàn bộ `src/` + `packages/` | **≥ 70%** | ≥ 65% | ≥ 70% | ≥ 70% |

**Quy tắc bắt buộc:**
1. Ngưỡng áp dụng **riêng từng tầng** — domain đạt 90% nhưng tổng dưới 70% vẫn fail.
2. Ngưỡng **có hiệu lực ngay** khi module được viết — không có "giai đoạn đầu cho qua".
3. File bị loại khỏi coverage phải khai báo lý do trong `jest.config.js` (`coveragePathIgnorePatterns`), không được bỏ âm thầm.
4. Ngưỡng chỉ có thể **nới** bằng một quyết định ghi trong tài liệu kèm lý do và thời điểm hẹn sửa.

**Đối chiếu:** hệ thống tham chiếu đặt ngưỡng global thấp hơn nhiều (lines 47% / functions 42% / branches 32%). Data Quality đặt **cao hơn** vì:
- Code mới viết lại từ đầu — không có "di sản" để biện minh cho coverage thấp.
- Tầng domain là nơi chứa logic nghiệp vụ — chi phí sửa bug cao nhất, nên coverage cao nhất.

#### 3.13.3. Gate chặn (quyết định 12)

**Áp dụng khi nào:**

| Mốc | Gate |
|---|---|
| Trước khi commit | `pnpm test:all` phải xanh |
| Trước khi deploy lên staging | `pnpm test:all` + `pnpm test:coverage` đạt ngưỡng |
| Trước khi deploy lên production | Tất cả mục trên + `pnpm test:perf` đạt ngưỡng + smoke test cutover |
| Trước cutover migration | Tất cả mục trên + verify migration 4 mức pass |

**Không có GitHub Actions (quyết định 11) nên gate chạy thủ công.** Để giảm rủi ro quên chạy, có thể thêm **git hook** (`husky` `pre-commit`) chạy `pnpm test:unit && pnpm test:arch` — phần nhanh, chặn lỗi sớm. Đây là tuỳ chọn, không phải yêu cầu bắt buộc.

**Quy tắc bắt buộc:**
1. Test fail ⇒ **không commit, không deploy**. Không có ngoại lệ "chạy lại có thể pass".
2. Coverage dưới ngưỡng ⇒ không deploy.
3. Không dùng `--force` để bypass.
4. Nếu một test đang lỗi tạm thời (vd fake AI adapter sai) → sửa test, **không** xoá assertion.

#### 3.13.4. Quy trình 3 bước

```
  BƯỚC 1              BƯỚC 2                    BƯỚC 3
┌──────────────┐   ┌──────────────────┐   ┌────────────────────────┐
│ CHẠY TEST    │   │ KIỂM CHỨNG       │   │ LẬP BÁO CÁO            │
│              │   │                  │   │                        │
│ pnpm test:all│──►│ Ngưỡng đạt?      │──►│ Báo cáo tự động        │
│ pnpm test:cov│   │ 112/120 quy tắc   │   │ + Kết luận của người   │
│ test:perf    │   │ 79 tính năng      │   │ + Cập nhật ma trận     │
│              │   │ 62 UC / 80 EP    │   │                        │
└──────────────┘   └──────────────────┘   └────────────────────────┘
     FAIL                FAIL                     FAIL
       ↓                   ↓                        ↓
   KHÔNG COMMIT      KHÔNG DEPLOY            KHÔNG NGHIỆM THU
```

### 3.14. Bằng chứng nghiệm thu

**Quyết định 10:** cả báo cáo tự động lẫn phần kết luận của người.

#### 3.14.1. Báo cáo tự động

**Script:** `scripts/generate-test-report.mjs` → ghi `docs/test-reports/<đợt>-<ngày>.md`.

**Cấu trúc báo cáo:**

```markdown
# Báo cáo kiểm thử — Đợt 1 — 2026-11-20

## 1. Tổng quan
| Hạng mục | Kết quả |
|---|---|
| Tổng test | 1.284 |
| Pass | 1.271 |
| Fail | 13 |
| Skip | 0 |
| Thời gian | 4 phút 12 giây |

## 2. Coverage theo tầng
| Tầng | lines | branches | functions | Ngưỡng | Kết quả |
|---|---|---|---|---|---|
| Domain | 91.2% | 86.4% | 92.0% | 90/85/90 | ✅ Đạt |
| Application | 82.1% | 77.3% | 84.5% | 80/75/80 | ✅ Đạt |
| Infrastructure | 64.8% | 52.1% | 63.2% | 60/50/60 | ✅ Đạt |
| Contracts | 96.1% | 91.0% | 97.3% | 95/90/95 | ✅ Đạt |
| Tổng | 73.4% | 68.9% | 74.8% | 70/65/70 | ✅ Đạt |

## 3. Quy tắc kiểm thử
| Nhóm | Tổng | Đạt | Chưa đạt | Thủ công |
|---|---|---|---|---|
| S | 18 | 18 | 0 | 0 |
| C | 8 | 8 | 0 | 0 |
| I | 14 | 14 | 0 | 0 |
| O | 28 | 24 | 0 | 4 |
| M | 24 | 21 | 0 | 3 |

## 4. Test fail (chi tiết)
| File | Test | Thông báo |
|---|---|---|

## 5. Hiệu năng (k6)
| Endpoint | p50 | p95 | p99 | Ngưỡng | Kết quả |

## 6. Ma trận tính năng
| Nhóm | Số | Đã test | Chưa test | Ngoài phạm vi |
```

**Quy tắc bắt buộc:**
1. Báo cáo sinh tự động — **không** sửa tay phần số liệu (phần kết luận của người viết ở mục 2 nằm trong file riêng hoặc phần cuối).
2. Báo cáo **commit vào repo** cùng code — là bằng chứng nghiệm thu theo thời điểm.
3. File báo cáo không bị ghi đè — mỗi lần chạy tạo file mới theo ngày.

#### 3.14.2. Kết luận của người (phần bổ sung)

Nằm ở cuối file báo cáo, viết tay:

```markdown
## 7. Kết luận nghiệm thu

**Phạm vi đã kiểm thử:** Đợt 1 — auth, workspace, project cơ bản.

**Đánh giá:** Đạt. 13 test fail đều là lỗi dữ liệu fixture, không phải lỗi logic — đã sửa fixture.

**Hạng chế đã biết:**
- Chưa có test hiệu năng cho import file 50MB.
- Endpoint `GET /audit-logs` mới thêm chưa có ca lỗi 403.

**Người đánh giá:** <tên> — 2026-11-20
```

#### 3.14.3. Cấu trúc thư mục bằng chứng

```
docs/test-reports/
├── 2026-11-20-dot-1.md
├── 2026-11-28-dot-2.md
├── 2026-12-10-dot-3.md
├── perf-2026-11-25.md
└── index.md                    ← bảng tổng hợp các đợt
```

**Quy tắc:** `index.md` liệt kê từng đợt: ngày, phạm vi, kết quả, link báo cáo. Đây là tài liệu bàn giao chính cho Phần 15.

### 3.15. Xử lý test không ổn định (flaky)

**Định nghĩa:** test pass/fail ngẫu nhiên giữa các lần chạy giống nhau.

**Quy tắc bắt buộc:**

| # | Quy tắc |
|---|---|
| 1 | Mọi test flaky phải được ghi nhận vào `docs/test-reports/flaky.md` kèm lý do |
| 2 | Nguyên nhân phổ biến nhất ở dự án này: **race condition** với Kafka consumer/worker, **thứ tự chạy test**, **dữ liệu dùng chung** |
| 3 | Sửa triệt để, không dùng `jest.retryTimes()` để che |
| 4 | Test E2E chạy `--runInBand` — tránh tranh chấp dữ liệu |
| 5 | Test adapter phải tự dọn dẹp — không dựa vào `afterAll` của test khác |
| 6 | Nếu một test flaky > 3 lần liên tiếp → **tạm `skip` có ghi chú** và ghi vào backlog sửa — không để xanh giả |

### 3.16. Quy tắc kiểm thử vận hành

| # | Kiểm tra |
|---|---|
| T1 | `pnpm test:all` chạy một lệnh, tự bật/tắt container, trả exit code đúng |
| T2 | Test thiếu biến môi trường → **fail**, không skip âm thầm |
| T3 | Coverage dưới ngưỡng tầng → **fail** |
| T4 | Coverage tổng dưới 70% → **fail** |
| T5 | Test AI không bao giờ gọi network ra ngoài — kiểm tra bằng mock network |
| T6 | Mọi file test có đúng 1 tầng — không trộn unit với E2E |
| T7 | Test tầng 2/3 không import Mongoose/NestJS — kiểm tra bằng script kiến trúc |
| T8 | Test E2E tự dọn dẹp dữ liệu — chạy lại 2 lần cho kết quả giống nhau |
| T9 | Test không phụ thuộc thứ tự chạy — chạy với `--randomize` (Jest 30) vẫn xanh |
| T10 | 48 tình huống phân quyền đều assert status **và** mã lỗi **và** không có side effect |
| T11 | Mọi endpoint có ≥ 2 ca test; endpoint nhạy cảm có ≥ 4 ca |
| T12 | Mọi quy tắc trong ma trận 93 có file test cụ thể hoặc đánh dấu thủ công |
| T13 | `openapi.json` đã commit khớp với schema sinh ra |
| T14 | Migration test chạy trên dữ liệu fixture mô phỏng dữ liệu lệch (thiếu Owner, nhiều Owner) |
| T15 | Báo cáo test sinh tự động chứa đủ 6 mục bắt buộc |
| T16 | `test:perf` không chạy trong `test:all` |
| T17 | Không có test nào dùng dữ liệu thật của workspace thật |
| T18 | Test có PII luôn dùng dải số giả (`0900000000`+) và email `@test.local` |

### 3.17. Đối chiếu với code hiện tại

**Hiện trạng:** `src/backend/test/` có **16 file `*.spec.ts`**, tất cả ở mức integration nặng — gọi MongoDB thật qua Mongoose, không mock, không có tầng unit tách biệt. Không có `jest.config.js` riêng (chỉ có `test/jest-e2e.json`), không có coverage threshold, không có test kiến trúc, không có test hiệu năng.

| Vấn đề | Xử lý ở Phần 13 |
|---|---|
| 16 file spec gọi Mongo thật, chậm và phụ thuộc Atlas | Tách lại: phần logic → tầng 2/3 với fake port; phần I/O → tầng 4 với container |
| `jest.config.js` không tồn tại | Tạo `jest.unit.json` với `projects` tách theo tầng (domain/application/infrastructure/contract) |
| Không có coverage threshold | Thêm ngưỡng theo tầng (mục 3.13.2) |
| Test trong `test/` chứ không cạnh code | Chuyển sang cạnh file: `*.spec.ts` đặt cạnh module (`src/modules/x/domain/y.spec.ts`) — theo hệ thống tham chiếu |
| Không có test kiến trúc | Thêm `scripts/check-architecture.mjs` (mục 3.8) |
| Không có CI | `pnpm test:all` local (quyết định 11) |
| Không có k6 | Thêm `test/k6/smoke.js` + `stress.js` |

**Quyết định về vị trí file test — theo hệ thống tham chiếu:**

| Loại | Vị trí | Lý do |
|---|---|---|
| Unit / domain / application | Cạnh file nguồn (`*.spec.ts` trong `src/`) | Thấy ngay khi sửa, Jest mặc định tìm |
| E2E | `test/e2e/*.e2e-spec.ts` | Tách biệt, chạy bằng config riêng |
| Adapter | `test/integration/*.spec.ts` | Cần container, tách khỏi unit để chạy nhanh |
| Security | `test/e2e/security/*.e2e-spec.ts` | Chạy cùng E2E nhưng project riêng |
| Fixture / factory | `test/factories/`, `test/fixtures/`, `test/seed/` | Tái sử dụng nhiều nơi |

**Đối chiếu với mô hình kiểm thử thông dụng:**

| Khả năng của mẫu | Có dùng không | Lý do |
|---|---|---|
| `jest.config.js` với `projects` | ✅ Có — `jest.unit.json` với 4 project | Phân tầng rõ ràng, chạy song song |
| `test/jest-e2e.json` riêng | ✅ Có | E2E cần `runInBand` + timeout dài |
| `coverageThreshold` | ✅ Có — nhưng đặt **cao hơn** (mục 3.13.2) | Code viết mới, không có di sản |
| `test/setup-env.ts` | ✅ Có | Nạp biến test, reset trạng thái |
| `test/factories/`, `test/fixtures/` | ✅ Có | Quyết định 7 |
| `scripts/check-module.mjs` | ✅ Có — mở rộng thành `check-architecture.mjs` với 14 quy tắc | Quyết định 5 |
| `test/k6/smoke.js` + `stress.js` | ✅ Có | Quyết định 6 |
| `test:outbox`, `test:inbox`, `test:replica-set` script riêng | ✅ Có — gộp vào `test:all` | Tránh phải nhớ chạy |
| `check:duplication` (jscpd) | ❌ **Không dùng** | Đo trùng lặp code, không phải tiêu chí nghiệm thu; tỉ lệ trùng lặp không quyết định đạt/không đạt |
| `security-check.mjs` | ✅ Có — gộp vào tầng 6 | Phù hợp quyết định 5 |
| `verify:montache.mjs` (check `any`) | ✅ Có — quy tắc A7 | Cấm `any` trong `src/` và `packages/` |

### 3.18. Ước tính khối lượng công việc kiểm thử

| Tầng | Số test ước tính | Thời gian viết |
|---|---|---|
| 1 — Contract | ~20 | 2 ngày công |
| 2 — Domain | ~250 (nhiều ca cho `create()` + biên) | 5 ngày công |
| 3 — Use case | ~185 (62 UC × 2–3 ca) | 8 ngày công |
| 4 — Adapter | ~120 | 5 ngày công |
| 5 — E2E | ~200 (85 endpoint × 2–4 ca) | 9 ngày công |
| 6 — Architecture | ~12 quy tắc trong 1 script | 2 ngày công |
| 7 — Security | ~62 (48 tình huống + bộ bổ sung) | 4 ngày công |
| 8 — Performance | 2 script k6 | 1 ngày công |
| Hạ tầng test | compose, factories, seed, fixtures, script báo cáo | 4 ngày công |
| **Tổng** | **~850 test** | **~38 ngày công** |

**Ghi chú:** tổng ~850 test nhưng phần lớn là ca nhỏ, viết nhanh. Ước tính này **chưa** gồm thời gian viết code production tương ứng (Phần 14).

**Rủi ro:** khối lượng test lớn hơn code. Đây là hệ quả của quyết định 3 (đầy đủ 8 tầng) + 13 (mapping đầy đủ) + 9 (34 tình huống tự động). Đánh đổi được chấp nhận vì đợt này là **viết lại toàn bộ backend** — không có test sẽ không có cách chứng minh tính đúng đắn.

### 3.19. Điều kiện hoàn tất phần này

Bộ kiểm thử và tiêu chí nghiệm thu đã thống nhất trước khi thực thi kế hoạch implementation.

**Trạng thái v4:** 17 quyết định kiểm thử đã chốt. **9 tầng test** với ngưỡng coverage riêng; ma trận **120 quy tắc** (112 tự động + 8 thủ công); bảng mapping 79 tính năng / 66 use case / 85 endpoint; quy trình 3 bước với gate chặn; báo cáo tự động 6 mục + kết luận của người; 18 quy tắc kiểm thử T1–T18; ước tính ~930 test / ~46 ngày công. Còn 2 câu hỏi mở tại mục 6.2.

## 4. Đầu vào và đầu ra

**Đầu vào**
- Phần 3 v4 — 66 use case, ma trận quyền, vòng đời trạng thái.
- Phần 4 v3 — 20 module, ranh giới sở hữu, 5 module LEGACY.
- Phần 5 v1 — Rich Domain Model (`create()`/`reconstitute()`), quy tắc chiều dependency, optimistic locking, luồng outbox.
- Phần 6 v5 — 48 tình huống truy cập trái phép, ma trận quyền 5 vai trò + nhóm `FB-*`, chính sách token/rate-limit, bảo mật Socket.IO, ranh giới AI cục bộ.
- Phần 7 v3 — 85 endpoint, quy ước response/lỗi/phân trang cursor, mã lỗi.
- Phần 8 v3 — 21 collection, 19 quy tắc S1–S19.
- Phần 9 v2 — 13 sự kiện, outbox/inbox, 14 quy tắc I1–I14.
- Phần 10 v3 — 28 quy tắc O1–O28, biến môi trường, health check.
- Phần 11 v2 — 26 quy tắc M1–M26, quy trình cutover.
- Phần 12 v3 — ngưỡng ảnh hưởng, che PII, thư viện thống kê, bất biến dữ liệu.
- Mã nguồn hiện tại — 16 file `test/*.spec.ts` gọi Mongo thật, không có `jest.config.js`, không có coverage threshold.
- Mô hình kiểm thử thông dụng — `jest.config.js` có `projects`, `test/jest-e2e.json`, `test/factories/`, `test/fixtures/`, `test/k6/`, `scripts/check-module.mjs`, `scripts/security-check.mjs`, `scripts/verify-montache.mjs`, 9 script `test:*` chuyên biệt.
- Quyết định của người dùng — 14 lựa chọn kiểm thử (2026-11-05).

**Đầu ra**
- 14 quyết định kiểm thử nền tảng.
- 8 tầng test với ranh giới trách nhiệm rõ ràng và thứ tự chạy tối ưu.
- Cơ chế mock tầng 3 — fake implementation theo interface thay vì `jest.mock()`, kèm lý do.
- `docker-compose.test.yml` với Mongo replica set 1 node + Redis + MinIO.
- Quy tắc test bắt buộc cho từng aggregate domain, đặc biệt 7 hàm thống kê với ca biên bắt buộc.
- 14 quy tắc kiến trúc A1–A14 trong `scripts/check-architecture.mjs`.
- 48 tình huống phân quyền theo 9 nhóm + 6 nhóm test bổ sung.
- **Ma trận truy xuất ngược 120 quy tắc** (S/C/I/O/M) → tầng test + file test cụ thể.
- Bảng mapping 79 tính năng, 66 use case, 85 endpoint với cột trạng thái.
- Ngưỡng coverage theo 5 nhóm tầng (domain 90% / application 80% / infrastructure 60% / contracts 95% / tổng 70%).
- 12 lệnh `test:*` + quy tắc `test:all` là lệnh duy nhất quyết định đủ điều kiện commit.
- Quy trình nghiệm thu 3 bước với gate chặn ở 4 mốc.
- Cấu trúc báo cáo tự động 6 mục + mẫu kết luận của người + cấu trúc `docs/test-reports/`.
- Quy tắc xử lý test flaky (6 quy tắc).
- Bảng đối chiếu code hiện tại — 6 vấn đề và cách xử lý; bảng đối chiếu hệ thống tham chiếu 12 dòng (giữ 11, bỏ 1 `jscpd`).
- Ước tính ~850 test / ~38 ngày công.
- 18 quy tắc kiểm thử T1–T18.

## 5. Điều kiện hoàn tất phần này

Bộ kiểm thử và tiêu chí đạt được thống nhất trước khi thực thi kế hoạch implementation.

**Trạng thái v4:** 17 quyết định đã chốt; **9 tầng**; ma trận **120 quy tắc**; 3 bảng mapping; ngưỡng theo tầng; quy trình 3 bước; 18 quy tắc T1–T18. Còn 2 câu hỏi mở tại mục 6.2.

## 6. Câu hỏi và phụ thuộc còn mở

### 6.1. Đã chốt ở v1

| # | Câu hỏi | Kết quả |
|---|---|---|
| 1 | Module `exports` (LEGACY) | **Xoá hẳn** — đóng câu hỏi treo từ Phần 11 (mục 3.7.4) |
| 2 | Môi trường E2E | **Container Mongo replica set** + Redis + MinIO (mục 3.6) |
| 3 | Các tầng test | **8 tầng đầy đủ** (mục 3.2) |
| 4 | Ngưỡng coverage | **Theo tầng** — domain 90 / app 80 / infra 60 / tổng 70 (mục 3.13.2) |
| 5 | Kiểm tra kiến trúc | **Script tự động** 14 quy tắc (mục 3.8) |
| 6 | Test hiệu năng | **k6** thủ công (mục 3.10) |
| 7 | Dữ liệu test E2E | **Factory + seed script** (mục 3.7) |
| 8 | Test AI | **Luôn mock** — không gọi engine suy luận thật ở tầng 1–8 (mục 3.5) |
| 9 | Test bảo mật | **48 tình huống tự động** (mục 3.9) |
| 10 | Bằng chứng nghiệm thu | **Cả hai** — báo cáo tự động + kết luận của người (mục 3.14) |
| 11 | CI | **Chỉ script `pnpm test:all` local** — không GitHub Actions (mục 3.13.1) |
| 12 | Gate | **Chặn** — fail thì không commit, không deploy (mục 3.13.3) |
| 13 | Bảng mapping | **Đầy đủ** — 77 / 62 / 80 / 93 (mục 3.11, 3.12) |
| 14 | Test hợp đồng API | **Cả hai** — snapshot OpenAPI + validate runtime Zod (mục 3.3, 3.7) |

### 6.2. Còn mở

| # | Câu hỏi | Ảnh hưởng | Nơi xử lý |
|---|---|---|---|
| 1 | Có nên thêm **git hook** (`husky` `pre-commit`) chạy `pnpm test:unit && pnpm test:arch`? Nhẹ, chặn lỗi sớm, nhưng thêm dependency và có thể làm chậm commit | Trải nghiệm commit | Phần 14 — quyết định cùng lúc chốt quy trình commit |
| 2 | Có nên thêm **kiểm thử tải dài hạn** (soak test) chạy vài giờ trước release để phát hiện rò rỉ bộ nhớ / job treo? K6 có `soak` executor | Rủi ro vận hành dài hạn | Phần 14 — cân nhắc khi đã có kịch bản `stress` ổn định |

### 6.3. Phụ thuộc bên ngoài

- **Docker** — cần cho `docker-compose.test.yml` (Mongo replica set, Redis, MinIO).
- **k6** — cài riêng, không nằm trong `package.json`; chỉ cần khi chạy `test:perf`.
- **MongoDB Atlas M0** — dùng cho môi trường dev; **không** dùng cho test (thiếu replica set).
- **R2 / MinIO** — MinIO container trong test để không tốn phí và không phụ thuộc mạng.
- **Engine suy luận cục bộ** — **không** dùng ở tầng 1–8 (luôn mock); chỉ tầng 9 gọi engine trong container.

### 6.4. Phụ thuộc chéo với Phần 14

| Phụ thuộc | Mô tả |
|---|---|
| **Bắt buộc** | Phần 14 phải tham chiếu ma trận 120 quy tắc và bảng mapping để xác định test nào viết trước, test nào sau |
| **Bắt buộc** | Mỗi đợt giao hàng trong Phần 14 phải kèm tiêu chí nghiệm thu theo mục 3.13.3 |
| **Bắt buộc** | Phần 14 phải có bước "viết test" **đi kèm** bước "viết code" trong cùng đợt — không viết code xong mới viết test |
| **Ràng buộc** | Phần 14 phải đặt **hạ tầng test** (compose, factory, seed, checker) là đợt 0 — trước mọi module khác |
| **Ràng buộc** | Ngưỡng coverage áp dụng **ngay khi module đầu tiên được viết** — không có giai đoạn đầu cho qua |
| **Ghi nhận** | Câu hỏi mở #3 ở Phần 11 (số lượng `dataset_record` thực tế) vẫn còn — ảnh hưởng kịch bản k6 và thời gian chạy test import |

## 7. Prompting log và lịch sử thay đổi

- **Yêu cầu:** Người dùng yêu cầu liệt kê toàn bộ các phần theo thứ tự thực hiện, tạo sẵn file v1, lần lượt hoàn thiện vòng đầu rồi tạo v2 khi có thay đổi tiếp theo.
- **v1 / 2026-11-02:** Tạo khung phần 13 / Chuẩn bị thảo luận tuần tự / Chỉ tạo tài liệu, chưa thực thi thay đổi backend hoặc dữ liệu.
- **v5 / 2026-11-06:** Tầng 9 nâng từ **4 model / 9 chỉ số rời** thành **5 model theo giả thuyết + 9 chỉ số trên 5 nhóm** có ngưỡng tuyệt đối, trọng số 100, kiểm định thống kê (McNemar/Wilcoxon), đường Pareto và 11 quy tắc quyết định; bỏ judge `Qwen3-32B` (vượt RAM) → chấm chéo; quyết định benchmark chọn **cặp model** cho kiến trúc định tuyến hai tầng (Phần 12 v5 mục 3.15.6) / Theo yêu cầu người dùng ngày 2026-11-06 / Cập nhật mục 3.10b.1–3.10b.2 và quyết định 15.
- **v4 / 2026-11-05:** Áp dụng 4 quyết định kiến trúc. (1) **Cursor pagination**: thêm quy tắc C9–C12 (cursor opaque, không trùng/thiếu, chống bỏ sót khi chèn dữ liệu) + quy tắc kiến trúc A15 (cấm `countDocuments`/`skip`). (2) **Kafka + Socket.IO**: thêm container Kafka vào môi trường test tầng 4; thêm quy tắc I15–I21 (publish đúng topic, DLQ, consumer group, rebalance, realtime push, notification dispatch, job AI qua Kafka); bỏ nhóm test BullMQ (I9, I10, O18, O26 chuyển sang Kafka). (3) **AI cục bộ**: quyết định 8 viết lại (luôn mock ở tầng 1–8, không bao giờ gọi network ra ngoài); thêm **Tầng 9 — Benchmark AI & học lại** (quyết định 15–17) với bộ benchmark 4 model, 9 chỉ số, quy tắc quyết định chọn model, và 7 bước test vòng lặp RAG T1. Thêm quy tắc kiến trúc A16–A18 (cấm SDK AI bên ngoài, cấm import trực tiếp engine ngoài port, cấm thư viện Excel). (4) **Chỉ `.csv`**: thêm C13, O34, A18, M27–M28. Ngoài ra: thêm S20–S23 (CSV columns, feedback append-only), M29 (2 collection feedback có index); số liệu 93 → **120 quy tắc** (112 tự động + 8 thủ công), 77 → **79 tính năng**, 62 → **66 use case**, 80 → **85 endpoint**, 34 → **48 tình huống phân quyền**, 8 → **9 tầng test**.
- **v2 / 2026-11-05:** Đồng bộ theo quyết định **dữ liệu bất biến (chỉ đọc)**. (1) Bỏ toàn bộ test cho xoá dòng, sửa ô, clean-rules, rollback phiên bản và lineage; (2) bổ sung quy tắc **S19** (ràng buộc insert-only cho `dataset_record`) và **M25–M26** (`dataset_versions` không migrate; dữ liệu sau cutover chỉ đến từ file gốc); (3) bổ sung quy tắc kiến trúc **A13–A14** (cấm route ghi dữ liệu ngoài import); (4) giảm 2 tình huống phân quyền (36 → 34) do thu hẹp quyền `PROJ-MEMBER`/`PROJ-OWNER`/`WS-OWNER`; (5) cập nhật toàn bộ số liệu: 92 → **93 quy tắc** (86 tự động + 7 thủ công), 84 → **77 tính năng**, 67 → **62 use case**, 85 → **80 endpoint**; (6) đồng bộ tham chiếu Phần 3 v3, 6 v4, 7 v2, 8 v3, 9 v2, 10 v3, 11 v2, 12 v3.
- **v1 / 2026-11-05:** Hoàn thiện vòng đầu. Chốt 14 quyết định kiểm thử; thiết kế 8 tầng test với ranh giới trách nhiệm và thứ tự chạy tối ưu; cơ chế fake port thay `jest.mock()`; `docker-compose.test.yml` với Mongo replica set + Redis + MinIO; 12 quy tắc kiến trúc A1–A12; 36 tình huống phân quyền theo 7 nhóm; **ma trận truy xuất ngược 92 quy tắc** (S/C/I/O/M) với cột tầng test và file test cụ thể; 3 bảng mapping (84 tính năng / 67 use case / 85 endpoint); ngưỡng coverage 5 nhóm theo tầng; 12 lệnh `test:*` với `test:all` là lệnh duy nhất; quy trình nghiệm thu 3 bước + gate chặn ở 4 mốc; cấu trúc báo cáo tự động 6 mục + kết luận của người; quy tắc xử lý test flaky; bảng đối chiếu code hiện tại và hệ thống tham chiếu; ước tính ~850 test / ~38 ngày công; 18 quy tắc T1–T18.
