# 10. Cấu hình, vận hành và quan sát

- **Version:** v6
- **Ngày tạo:** 2026-11-02
- **Cập nhật gần nhất:** 2026-11-07 (v6)
- **Thay đổi v5 (2026-11-06):** model AI **chưa chốt** — phải benchmark 5 ứng viên (`Qwen3-14B` / `Gemma-3-12B` / `Qwen3-8B` / `Llama-3.1-8B` / `Vistral-7B`) rồi chọn theo đường Pareto (Phần 12 v5 mục 3.15). `AI_MODEL_ID` trở thành **biến bắt buộc** chứ không phải hằng số trong compose; `models/` phải chứa **cả 5 file** `.gguf` trong giai đoạn benchmark (dung lượng đĩa ~35 GB), sau khi chốt chỉ giữ 2 model của kiến trúc định tuyến.
- **Trạng thái:** Đã chốt các quyết định vận hành và thiết kế chi tiết **biến môi trường, docker-compose, health check, structured logging, metrics, backup/restore, quy trình deploy, xử lý sự cố**. **v4 áp dụng 4 quyết định hạ tầng:** (1) **Kafka** thay BullMQ/Redis cho bus sự kiện (5 topic, có **DLQ** — đảo ngược quyết định "không DLQ" của v3); (2) **Socket.IO gateway** trong `api` + adapter Redis; (3) **AI chạy nội bộ** bằng model cục bộ (`Qwen3-14B`/`Qwen3-8B`) qua engine `vLLM`/`Ollama` — **không** còn API bên ngoài; (4) **chỉ `.csv`**. Cùng đó: cursor pagination, RAM ~10 GB cho model trên VPS 15 GB → **bộ nhớ là ràng buộc vận hành số 1**.
- **Giai đoạn:** Tech solution
- **Thứ tự thực hiện:** Phần 10; sử dụng kết quả đã xác nhận của các phần trước.
- **Quan hệ với các phần khác:** vận hành các quyết định của Phần 4 v4 (monorepo, `apps/api` + `apps/worker`, module `feedback`), Phần 6 v5 (TTL token, rate-limit Redis, bảo mật Socket.IO, AI cục bộ), Phần 7 v3 (quy ước endpoint, `/api/v1`, cursor pagination), Phần 8 v4 (**21 collection**, replica set bắt buộc cho transaction), Phần 9 v3 (Kafka, outbox relay, 6 consumer group, Socket.IO), Phần 11 v3 (quy trình cutover migration), Phần 12 v4 (model cục bộ, cơ chế học lại).
- **Thay đổi so với v2:** đồng bộ theo quyết định **dữ liệu bất biến (chỉ đọc)** — job cleanup **không** xoá bản ghi `dataset_record`; đối chiếu lại số liệu 21 collection / 77 tính năng / 80 endpoint; không còn biến môi trường hay cảnh báo nào liên quan xoá dòng, sửa ô, clean-rules hay phiên bản dữ liệu.
- **Thay đổi ở v4:** thêm **Kafka** (`kafka:3.7` KRaft single-node) vào compose; **bỏ BullMQ** khỏi Redis; thêm container **`ai-engine`** (vLLM/Ollama) với giới hạn RAM; thêm **Socket.IO adapter** Redis; bổ sung nhóm biến `KAFKA_*`, `AI_INFERENCE_*`, `REALTIME_*`, `EMBEDDING_*`; đổi quyết định #6 (có **DLQ** qua topic `dlq.dead-letter`); bổ sung mục 3.5.5 (compose mới), 3.6.2 (health check engine), 3.16 (ngân sách RAM & bảo vệ bộ nhớ), 3.17 (chỉ `.csv`).
- **Thay đổi so với v1:** (1) bổ sung **ngoại lệ cutover** — dừng **cả** `api` và `worker` khi migration, thay vì giữ worker chạy như quy trình deploy thường (mục 3.10.2.1); (2) bổ sung quy trình backup bắt buộc cho cutover (mục 3.9.5); (3) bổ sung biến `MIGRATION_CONFIRM` và `MIGRATION_BATCH_SIZE` (mục 3.4.2).

## 1. Mục tiêu

Làm rõ và thống nhất cấu hình, vận hành và quan sát cho đợt tái cấu trúc backend.

## 2. Nội dung cần bàn luận

- Biến môi trường, cấu hình theo môi trường và cách quản lý secret.
- Kiến trúc triển khai, container, dịch vụ phụ thuộc và sức khỏe dịch vụ.
- Logging, metrics, tracing và cảnh báo.
- Sao lưu, khôi phục, triển khai, rollback và xử lý sự cố.

## 3. Quyết định và thiết kế chi tiết

### 3.1. Các quyết định nền tảng

| # | Quyết định | Ghi chú |
|---|---|---|
| 1 | Nền tảng triển khai: **Docker Compose trên VPS** | 1 file compose cho api + worker + Redis |
| 2 | Observability: **tối giản** — log JSON + health endpoint | Không Prometheus/Grafana/Loki/Sentry |
| 3 | Định dạng log: **JSON structured** ra stdout | Máy đọc được, thu thập tập trung dễ |
| 4 | Database: **Atlas M0 cho dev**, **Atlas M10 cho production** | M0 không có replica set → cần fallback (mục 3.4.3) |
| 5 | Quota dung lượng: **theo workspace** (500 MB) | Khớp Phần 12 mục 3.12 |
| 6 | ~~**Không** dead-letter queue riêng~~ | **Đảo ngược ở v4:** có **DLQ** — topic Kafka `dlq.dead-letter` (Phần 9 v3 mục 3.4.4). Lý do: Kafka đã có hạ tầng bền vững, DLQ gần như miễn phí, và mất sự kiện là vi phạm tính đúng đắn dữ liệu |
| 7 | Secret: **`.env` file** (gitignored) | Chuẩn, đơn giản |
| 8 | Redis: **một instance** cho cache + **Socket.IO adapter** + rate-limit | BullMQ đã bị gỡ ở v4; 1 instance vẫn đủ cho quy mô hiện tại |
| 9 | R2: giữ nguyên cấu hình hiện có (`S3_*`) | Egress $0 — rẻ hơn S3 |
| 10 | **Kafka** KRaft single-node trên cùng VPS | 5 topic, 6 consumer group — đủ cho quy mô hiện tại, tránh thêm ZooKeeper |
| 11 | **AI engine chạy trong container riêng** trên cùng VPS | `vLLM` (prod) / `Ollama` (dev); bind trong mạng nội bộ, không publish port |
| 12 | **Giới hạn RAM cứng** cho từng container | Tổng ngân sách ≤ 15 GB; engine chiếm ~10 GB → api/worker/kafka phải vừa ~5 GB |
| 13 | **Chỉ nhận file `.csv`** | Chặn sai định dạng ở cổng upload, không cần cấu hình thêm |
| 14 | **Cursor pagination** thay offset | Không cần thay đổi hạ tầng, nhưng bỏ `countDocuments` giúp giảm tải MongoDB |

### 3.2. Kiến trúc triển khai

```
┌───────────────────────────────────────────────────────────────┐
│                    VPS (1 máy, Ubuntu 22.04)                    │
│                                                                │
│  ┌──────────────────────┐      ┌────────────────────────────┐  │
│  │  Cloudflare Tunnel   │      │      Docker Compose        │  │
│  │ (tunnel, bật WS)     │─────►│                            │  │
│  └──────────────────────┘      │  ┌────────┐ ┌──────────┐  │  │
│                                │  │  api   │ │  worker  │  │  │
│  ┌──────────────────┐          │  │ :3000  │ │ (no HTTP)│  │  │
│  │  Nginx/Caddy     │◄─────────┤  │+Socket │ └────┬─────┘  │  │
│  │  (TLS + static   │  TLS    │  │  .IO   │      │        │  │
│  │   + WS upgrade)  │          │  └────┬───┘      │        │  │
│  └──────────────────┘          │       │          │        │  │
│                                │       │     ┌────▼─────┐  │  │
│                                │       │     │  Kafka   │  │  │
│                                │       │     │ (KRaft)  │  │  │
│                                │       │     │ :9092    │  │  │
│                                │       │     └────┬─────┘  │  │
│                                │  ┌────┴──────┐   │        │  │
│                                │  │  Redis 7  │   │        │  │
│                                │  │ cache +   │   │        │  │
│                                │  │ WS adapt. │   │        │  │
│                                │  └───────────┘   │        │  │
│                                │       │     ┌────▼─────┐  │  │
│                                │       └────►│ ai-engine│  │  │
│                                │             │ vLLM/    │  │  │
│                                │             │ Ollama   │  │  │
│                                │             │ :8000 ⚠RAM│ │  │
│                                │             └────────────┘ │  │
│                                └────────────┬──────────────┘  │
└─────────────────────────────────────────────┼─────────────────┘
                                              │
                    ┌─────────────────────────┼─────────────────────────┐
                    │                         │                         │
            ┌───────▼────────┐      ┌─────────▼─────────┐     ┌────────▼────────┐
            │ MongoDB Atlas  │      │  Cloudflare R2    │     │  SMTP           │
            │ M0 (dev)       │      │  file gốc, PDF,    │     │  (gửi OTP,      │
            │ M10 (prod)     │      │  tệp đính kèm      │     │   thông báo)    │
            └────────────────┘      └───────────────────┘     └─────────────────┘
```

> **v4 — thay đổi cốt lõi trong sơ đồ:**
> - **Gemini API (bên ngoài) → `ai-engine` (nội bộ).** Dữ liệu **không còn rời hệ thống**. Engine bind ở `:8000` **chỉ trong mạng compose**, không publish ra host.
> - **BullMQ (Redis) → Kafka.** Kafka là bus sự kiện bền vững, có replay, có DLQ.
> - **Redis** giữ lại cho cache + Socket.IO adapter (multi-instance) + rate-limit.
> - **`api` nay còn phục vụ WebSocket (Socket.IO)** → Nginx/Caddy phải cấu hình **WebSocket upgrade**; không thì realtime sẽ rơi về polling dài.
> - ⚠ **RAM:** `ai-engine` chiếm ~10 GB trên tổng 15 GB. Đây là ràng buộc vận hành lớn nhất — xem mục 3.16.

**Quyết định về Nginx/Caddy:**

| Hành phần | Vai trò |
|---|---|
| Cloudflare Tunnel | Đưa traffic từ Internet vào VPS **không cần mở port** — giảm bề mặt tấn công |
| Nginx/Caddy | TLS termination + phục vụ frontend tĩnh (khi có frontend) + reverse proxy → `api:3000` + **WebSocket upgrade** cho Socket.IO |

**Ghi chú:** dự án hiện đã có `CLOUDFLARE_TUNNEL_ENABLED` trong `.env` (xem `src/backend/.env.example`) → giữ nguyên cách truy cập qua tunnel, **không** mở port trực tiếp ra Internet.

**Quy tắc bắt buộc:**
1. **Không** expose port MongoDB hay Redis ra Internet — chỉ trong mạng nội bộ Docker.
2. `api` chỉ lắng nghe trong network nội bộ compose; Nginx là cổng vào duy nhất từ Internet.
3. `worker` **không** có port HTTP công khai — chỉ port health check nội bộ.
4. Tài khoản MongoDB Atlas dùng **IP allowlist** giới hạn theo IP của VPS.
5. R2 bucket **không public** (Phần 8 mục 3.10) — mọi lần tải đi qua API có kiểm tra quyền.
6. **v4:** Không publish port của `ai-engine` (`:8000`) ra host. Engine chỉ gọi được từ trong mạng compose. Không có route reverse proxy nào tới engine.
7. **v4:** Không publish port Kafka (`:9092`) ra host. Chỉ `api` và `worker` trong compose kết nối được.
8. **v4:** Cloudflare Tunnel phải bật **WebSocket**; nếu không, Socket.IO sẽ không hoạt động qua tunnel.

### 3.3. Cấu trúc thư mục vận hành

```
/
├── apps/
│   ├── api/
│   │   ├── Dockerfile              # multi-stage
│   │   └── .dockerignore
│   └── worker/
│       ├── Dockerfile
│       └── .dockerignore
├── packages/
│   ├── core/
│   └── contracts/
├── deploy/
│   ├── docker-compose.yml         # production
│   ├── docker-compose.dev.yml     # local (override)
│   ├── nginx/
│   │   └── default.conf
│   ├── mongo/
│   │   └── init-replica-set.js    # chỉ dùng khi tự quản
│   ├── models/
│   │   └── download-model.sh      # tải + kiểm tra checksum model .gguf (v4)
│   └── scripts/
│       ├── backup.sh
│       ├── restore.sh
│       ├── migrate.ts             # chạy ở Phần 11
│       └── run-benchmark.ts       # bộ benchmark model AI (v4, Phần 12 mục 3.15.5)
├── models/                        # (v4) file .gguf của model — gitignored, mount vào ai-engine
│   ├── Qwen3-14B-Q4_K_M.gguf      # M1
│   ├── Gemma-3-12B-IT-Q4.gguf     # M2 (QAT)
│   ├── Qwen3-8B-Q4_K_M.gguf       # M3
│   ├── Llama-3.1-8B-Instruct-Q4_K_M.gguf  # M4
│   ├── Vistral-7B-Chat-Q4_K_M.gguf        # M5
│   # sau benchmark: chỉ giữ 2 model của kiến trúc định tuyến hai tầng
│   └── Qwen3-Embedding-0.6B.gguf
├── .env                           # gitignored
├── .env.example                   # commit, không chứa giá trị thật
├── package.json
├── pnpm-workspace.yaml
├── tsconfig.base.json
└── docs/restructures/
```

### 3.4. Biến môi trường

#### 3.4.1. Nguyên tắc

| # | Quy tắc |
|---|---|
| 1 | **Không** hardcode secret trong code — tất cả qua biến môi trường |
| 2 | Validate biến môi trường lúc khởi động bằng Zod — **fail fast** nếu thiếu biến bắt buộc |
| 3 | Biến bắt buộc thiếu → tiến trình **không khởi động**, log danh sách biến thiếu (không log giá trị) |
| 4 | Biến tuỳ chọn thiếu → dùng giá trị mặc định, log cảnh báo |
| 5 | `.env` **không** commit; `.env.example` commit với giá trị placeholder |
| 6 | Không log giá trị secret ở bất kỳ log nào |
| 7 | Nhóm biến theo prefix: `APP_`, `DB_`, `REDIS_`, `KAFKA_`, `STORAGE_`, `AUTH_`, `AI_`, `EMBEDDING_`, `REALTIME_`, `MAIL_`, `LOG_`, `RATE_LIMIT_`, `WORKER_`, `RETENTION_` |

#### 3.4.2. Bảng biến môi trường

**Nhóm `APP_` — ứng dụng:**

| Biến | Bắt buộc | Mặc định | Mô tả |
|---|---|---|---|
| `APP_NAME` | ✅ | `AI Data Quality Platform` | Tên ứng dụng |
| `NODE_ENV` | ✅ | `development` | `development` \| `production` \| `test` |
| `API_PREFIX` | ✅ | `api/v1` | Global prefix (Phần 7 mục 3.6) |
| `API_PORT` | ✅ | `3000` | Cổng HTTP của `api` |
| `CORS_ORIGIN` | ✅ | — | Danh sách origin, phân tách bằng `,` |
| `WORKER_PORT` | ❌ | `3001` | Cổng health check của `worker` |
| `LOG_LEVEL` | ❌ | `info` | `debug` \| `info` \| `warn` \| `error` |

**Nhóm `DB_` — MongoDB:**

| Biến | Bắt buộc | Mặc định | Mô tả |
|---|---|---|---|
| `DB_URI` | ✅ | — | Connection string đầy đủ, kèm `retryWrites=true&w=majority` |
| `DB_NAME` | ✅ | — | Tên database |
| `DB_MAX_POOL_SIZE` | ❌ | `20` | Kích thước connection pool |
| `DB_SERVER_SELECTION_TIMEOUT_MS` | ❌ | `10000` | Timeout chọn server |
| `DB_TRANSACTION_TIMEOUT_MS` | ❌ | `15000` | Timeout transaction (Phần 8 mục 3.9.1) |
| `DB_REPLICA_SET` | ❌ | — | Tên replica set — **bắt buộc ở production** |
| `DB_SUPPORTS_TRANSACTIONS` | ❌ | `auto` | `auto` \| `true` \| `false` — xem mục 3.4.3 |
| `DB_SUPPORTS_CHANGE_STREAM` | ❌ | `auto` | `auto` \| `true` \| `false` — xem mục 3.4.3 |

**Nhóm `REDIS_`:**

| Biến | Bắt buộc | Mặc định | Mô tả |
|---|---|---|---|
| `REDIS_URL` | ✅ | `redis://localhost:6379` | **v4:** cache + **Socket.IO adapter** + rate-limit (BullMQ đã bị gỡ) |
| `REDIS_KEY_PREFIX` | ❌ | `dq:` | Namespace key — tránh đụng độ với ứng dụng khác |
| `REDIS_TLS` | ❌ | `false` | Bật khi Redis ngoài Internet |

**Nhóm `STORAGE_` — R2/S3:**

| Biến | Bắt buộc | Mặc định | Mô tả |
|---|---|---|---|
| `STORAGE_DRIVER` | ✅ | `s3` | `s3` \| `local` — `local` dùng thư mục trên VPS |
| `S3_ENDPOINT` | ❌ | — | R2 endpoint |
| `S3_ACCESS_KEY_ID` | ❌ | — | Bắt buộc khi `STORAGE_DRIVER=s3` |
| `S3_SECRET_ACCESS_KEY` | ❌ | — | Bắt buộc khi `STORAGE_DRIVER=s3` |
| `S3_BUCKET_NAME` | ❌ | — | Bắt buộc khi `STORAGE_DRIVER=s3` |
| `S3_REGION` | ❌ | `auto` | R2 dùng `auto` |
| `STORAGE_LOCAL_PATH` | ❌ | `/data/storage` | Bắt buộc khi `STORAGE_DRIVER=local` |
| `STORAGE_MAX_QUOTA_BYTES` | ❌ | `524288000` | 500 MB — **theo workspace** (mục 3.6) |
| `STORAGE_MAX_FILE_BYTES` | ❌ | `52428800` | 50 MB/file (Phần 12 mục 3.12) |

**Nhóm `AUTH_`:**

| Biến | Bắt buộc | Mặc định | Mô tả |
|---|---|---|---|
| `JWT_ACCESS_SECRET` | ✅ | — | ≥ 32 ký tự |
| `JWT_ACCESS_EXPIRATION` | ✅ | `15m` | TTL access token (Phần 6 v4) |
| `JWT_REFRESH_SECRET` | ✅ | — | ≥ 32 ký tự |
| `JWT_REFRESH_EXPIRATION` | ✅ | `7d` | TTL refresh token |
| `SESSION_TTL_DAYS` | ❌ | `30` | TTL session (Phần 6 v4) |
| `DATA_ENCRYPTION_KEY` | ❌ | — | 64 hex — AES-256-GCM cho dữ liệu nhạy cảm |
| `GOOGLE_CLIENT_ID` | ❌ | — | Bật `AUTH-03` khi có |
| `GOOGLE_CLIENT_SECRET` | ❌ | — | |
| `GOOGLE_CALLBACK_URL` | ❌ | — | |

**Nhóm `AI_`** — **v4: suy luận cục bộ, không còn API bên ngoài**:

| Biến | Bắt buộc | Mặc định | Mô tả |
|---|---|---|---|
| `AI_ENGINE` | ✅ | `vllm` | `vllm` (prod) \| `ollama` (dev) \| `llamacpp` (fallback) |
| `AI_INFERENCE_BASE_URL` | ✅ | — | URL **nội bộ** của engine, ví dụ `http://ai-engine:8000/v1`. Adapter fail an toàn (`DEPENDENCY_UNAVAILABLE`) khi thiếu |
| `AI_INFERENCE_API_KEY` | ❌ | — | API key nội bộ gửi qua header `Authorization` — engine **không** chạy ở chế độ open |
| `AI_MODEL_PRIMARY` | ✅ | `qwen3-14b` | Model chính. **Bắt buộc** có checksum SHA-256 kèm theo |
| `AI_MODEL_PRIMARY_SHA256` | ✅ | — | Checksum file `.gguf` — CI/entrypoint từ chối nạp nếu lệch |
| `AI_MODEL_FAST` | ❌ | `qwen3-8b` | Model fast-path (tác vụ độ trễ thấp) |
| `AI_MODEL_FAST_SHA256` | ❌ | — | Checksum model fast-path |
| `AI_MODEL_PATH` | ✅ | `/models` | Thư mục chứa file `.gguf` (mount read-only vào container) |
| `AI_TIMEOUT_MS` | ❌ | `180000` | Timeout mỗi lượt gọi (**180s** — Phần 12 v4 mục 3.15.4) |
| `AI_MAX_RETRIES` | ❌ | `2` | Số lần retry (**tuyệt đối không vô hạn**) |
| `AI_MAX_CONCURRENCY` | ❌ | `1` | Số request suy luận đồng thời — **bắt buộc = 1** trên CPU-only |
| `AI_MAX_EVIDENCE_PER_COLUMN` | ❌ | `20` | Số ô lỗi/cột đưa cho mô hình (Phần 12 mục 3.10) |
| `AI_MAX_PAYLOAD_BYTES` | ❌ | `2000000` | Ngưỡng payload AI |
| `AI_MASK_PII_ENABLED` | ❌ | `true` | **Không được tắt ở production** — áp dụng cả với mô hình cục bộ |
| `AI_RAG_TOP_K` | ❌ | `5` | Số mẫu học lại chèn vào prompt (Phần 12 v4 mục 3.16.4) |
| `AI_RAG_MIN_TRUST_SCORE` | ❌ | `0.6` | Điểm tin cậy tối thiểu để mẫu được dùng làm few-shot |
| `AI_RAG_ENABLED` | ❌ | `true` | Bật/tắt cơ chế học lại T1 |
| `AI_RAM_GUARD_PERCENT` | ❌ | `85` | Dừng nhận job AI mới khi RSS engine vượt ngưỡng % RAM máy |
| `AI_MIN_RAM_GB` | ❌ | `12` | Từ chối khởi động nếu RAM máy < ngưỡng (bảo vệ khỏi OOM) |
| `AI_BENCHMARK_GATE_F1` | ❌ | `0.75` | Ngưỡng benchmark — model mới không đạt thì không được deploy |
| `AI_BENCHMARK_GATE_SCHEMA_RATE` | ❌ | `0.98` | Ngưỡng tỉ lệ JSON schema hợp lệ |
| `AI_BENCHMARK_GATE_HALLUCINATION_RATE` | ❌ | `0.02` | Ngưỡng tỉ lệ ảo giác |

**Nhóm `EMBEDDING_`** — vector cho kho mẫu RAG:

| Biến | Bắt buộc | Mặc định | Mô tả |
|---|---|---|---|
| `EMBEDDING_MODEL` | ✅ | `qwen3-embedding-0.6b` | Model embedding cục bộ — **không** dùng API embedding ngoài |
| `EMBEDDING_DIM` | ✅ | `1024` | Số chiều vector — phải khớp index trong `feedback_example` |
| `EMBEDDING_BASE_URL` | ❌ | = `AI_INFERENCE_BASE_URL` | Engine chứa cả model embedding |

**Nhóm `REALTIME_`** — Socket.IO:

| Biến | Bắt buộc | Mặc định | Mô tả |
|---|---|---|---|
| `REALTIME_ENABLED` | ❌ | `true` | Bật/tắt gateway Socket.IO |
| `REALTIME_PATH` | ❌ | `/api/v1/realtime` | Đường dẫn WebSocket (Phần 7 v3 mục 3.17.2) |
| `REALTIME_MAX_CONNECTIONS_PER_USER` | ❌ | `3` | Số kết nối đồng thời / user |
| `REALTIME_RECONNECT_MAX_PER_MINUTE` | ❌ | `10` | Chống reconnect loop |
| `REALTIME_HEARTBEAT_INTERVAL_MS` | ❌ | `25000` | Chu kỳ ping/pong |
| `REALTIME_ADAPTER` | ❌ | `redis` | `redis` (multi-instance) \| `memory` (dev đơn instance) |

**Nhóm `KAFKA_`** — **v4**:

| Biến | Bắt buộc | Mặc định | Mô tả |
|---|---|---|---|
| `KAFKA_BROKERS` | ✅ | `kafka:9092` | Danh sách broker, phân tách bằng `,` |
| `KAFKA_CLIENT_ID` | ✅ | `dq-platform` | Client ID cho producer/consumer |
| `KAFKA_GROUP_PREFIX` | ❌ | `dq` | Prefix cho consumer group |
| `KAFKA_SASL_MECHANISM` | ❌ | — | VD `scram-sha-256` — bắt buộc nếu broker bật SASL |
| `KAFKA_SASL_USERNAME` | ❌ | — | |
| `KAFKA_SASL_PASSWORD` | ❌ | — | |
| `KAFKA_TOPIC_DOMAIN_EVENTS` | ❌ | `domain.events` | Sự kiện nghiệp vụ |
| `KAFKA_TOPIC_AI_JOBS` | ❌ | `ai.jobs` | Job suy luận cục bộ |
| `KAFKA_TOPIC_NOTIFICATION_DISPATCH` | ❌ | `notification.dispatch` | Gửi email + tạo thông báo |
| `KAFKA_TOPIC_REALTIME_PUSH` | ❌ | `realtime.push` | Đẩy sự kiện tới Socket.IO |
| `KAFKA_TOPIC_DLQ` | ❌ | `dlq.dead-letter` | Sự kiện lỗi quá số lần retry |
| `KAFKA_PARTITION_COUNT` | ❌ | `3` | Số partition mỗi topic |
| `KAFKA_REPLICATION_FACTOR` | ❌ | `1` | Single-node → 1 |
| `KAFKA_RETENTION_HOURS` | ❌ | `168` | Giữ log 7 ngày |
| `KAFKA_MAX_MESSAGE_BYTES` | ❌ | `1048576` | 1 MB — payload lớn phải đi qua tham chiếu id |
| `KAFKA_CONSUMER_MAX_RETRY` | ❌ | `3` | Số lần retry trước khi vào DLQ |

**Nhóm `MAIL_`:**

| Biến | Bắt buộc | Mặc định | Mô tả |
|---|---|---|---|
| `MAIL_ENABLED` | ✅ | `false` | Bật/tắt gửi email |
| `SMTP_HOST` | ❌ | — | Bắt buộc khi `MAIL_ENABLED=true` |
| `SMTP_PORT` | ❌ | `587` | |
| `SMTP_USER` | ❌ | — | |
| `SMTP_PASS` | ❌ | — | |
| `SMTP_FROM` | ❌ | `AI Data Quality Platform <noreply@data-quality.local>` | |
| `SMTP_SECURE` | ❌ | `false` | `true` = port 465 |

**Nhóm `RATE_LIMIT_`** (Phần 6 v4 mục 3.9):

| Biến | Mặc định | Mô tả |
|---|---|---|
| `RATE_LIMIT_ENABLED` | `true` | |
| `RATE_LIMIT_LOGIN_MAX` | `5` | Số lần đăng nhập sai / 15 phút / IP |
| `RATE_LIMIT_LOGIN_WINDOW_SECONDS` | `900` | |
| `RATE_LIMIT_REGISTER_MAX` | `3` | Số lần đăng ký / giờ / IP |
| `RATE_LIMIT_UPLOAD_MAX` | `20` | Số lần upload / giờ / user |
| `RATE_LIMIT_EXPORT_MAX` | `10` | Số lần tải file / giờ / user |
| `RATE_LIMIT_AI_MAX` | `5` | Số lần chạy AI / giờ / project |

**Nhóm `WORKER_`** (Phần 9 mục 3.5):

| Biến | Mặc định | Mô tả |
|---|---|---|
| `WORKER_CONCURRENCY` | `5` | Số job song song (**trừ** job AI: giới hạn bởi `AI_MAX_CONCURRENCY = 1`) |
| `WORKER_KAFKA_ENABLED` | `true` | Tắt ở môi trường không có Kafka |
| `WORKER_OUTBOX_POLL_INTERVAL_MS` | `30000` | Chu kỳ polling fallback |
| `WORKER_OUTBOX_CLAIM_LEASE_SECONDS` | `60` | Lease của trạng thái `publishing` |
| `WORKER_INBOX_LEASE_SECONDS` | `30` | Lease của `processed_event` |
| `WORKER_EVENT_JOB_TIMEOUT_MS` | `10000` | Timeout job domain-events |
| `WORKER_AI_JOB_TIMEOUT_MS` | `180000` | Timeout job AI (**180s** — Phần 12 v4) |
| `WORKER_REPORT_JOB_TIMEOUT_MS` | `60000` | Timeout job PDF |
| `WORKER_CLEANUP_JOB_TIMEOUT_MS` | `300000` | Timeout job cleanup |
| `WORKER_CLEANUP_CRON` | `0 0 17 * * *` | 02:00 giờ VN |
| `OUTBOX_CHANGE_STREAM_ENABLED` | `true` | Tắt ở môi trường không có replica set |

**Nhóm `IMPORT_`** — **v4: chỉ `.csv`**:

| Biến | Mặc định | Mô tả |
|---|---|---|
| `IMPORT_ALLOWED_EXTENSIONS` | `csv` | Danh sách đuôi được phép — **v4 chỉ còn `csv`** |
| `IMPORT_MAX_ROWS` | `5000000` | Số dòng tối đa trong 1 file |
| `IMPORT_CHUNK_SIZE` | `5000` | Số bản ghi ghi mỗi lô (bulk insert) |
| `IMPORT_MAX_FILE_BYTES` | `52428800` | 50 MB/file |
| `IMPORT_DELIMITER_DETECT` | `true` | Tự phát hiện dấu phân cách (`,` `;` `\t` `\|`) |

**Nhóm `MIGRATION_`** (Phần 11 v2):

| Biến | Mặc định | Mô tả |
|---|---|---|
| `MIGRATION_CONFIRM` | `no` | Phải đặt `yes` để `--apply` ghi dữ liệu — chống chạy nhầm |
| `MIGRATION_BATCH_SIZE` | `5000` | Số document mỗi lô `bulkWrite` |
| `MIGRATION_DRY_RUN` | `true` | Chặn ghi dữ liệu — đặt `false` mới cho phép `--apply` |

**Nhóm `RETENTION_`** (Phần 8 mục 3.11):

| Biến | Mặc định | Mô tả |
|---|---|---|
| `RETENTION_NOTIFICATION_DAYS` | `90` | |
| `RETENTION_AUDIT_DAYS` | `365` | |
| `RETENTION_OUTBOX_DAYS` | `7` | |
| `RETENTION_PROCESSED_EVENT_DAYS` | `7` | |
| `RETENTION_AI_JOB_DAYS` | `90` | |
| `RETENTION_ANALYSIS_DAYS` | `180` | |
| `RETENTION_PROJECT_SAVE_DAYS` | `180` | |
| `RETENTION_SOFT_DELETE_DAYS` | `90` | Thực thể nghiệp vụ |
| `RETENTION_RAW_FILES_DAYS` | `90` | File gốc trên R2 |
| `RETENTION_ISSUE_ATTACHMENTS_DAYS` | `180` | Tệp đính kèm |
| `RETENTION_REPORTS_DAYS` | `90` | PDF |

#### 3.4.3. Xử lý môi trường không có replica set (Atlas M0)

**Vấn đề.** Atlas M0 (free tier) là **standalone** — không có replica set. Điều này làm mất 2 khả năng:
1. **Transaction** — bắt buộc cho outbox pattern (Phần 8 mục 3.9.1) và 19 use case ghi trạng thái.
2. **Change Stream** — kênh relay chính (Phần 9 mục 3.4.2).

**Giải pháp — 3 tầng fallback:**

| Tầng | Điều kiện | Hành vi |
|---|---|---|
| 1. Đầy đủ | `DB_SUPPORTS_TRANSACTIONS=true` | Transaction thật + Change Stream + polling |
| 2. Giả lập | `DB_SUPPORTS_TRANSACTIONS=false`, `DB_SUPPORTS_CHANGE_STREAM=false` | **Không** transaction → ghi outbox **ngoài** transaction; chỉ polling |
| 3. Tự phát hiện | `auto` (mặc định) | Probe khi khởi động, chọn tầng 1 hoặc 2 |

**Quy tắc bắt buộc:**

| # | Quy tắc |
|---|---|
| 1 | **Production phải có replica set.** Script khởi động **refuse to start** nếu `NODE_ENV=production` mà `DB_SUPPORTS_TRANSACTIONS` không phải `true` — vì không có transaction thì outbox có thể mất event, vi phạm tính đúng đắn dữ liệu |
| 2 | Ở tầng 2, `dispatchDomainEvents()` ghi outbox **ngay sau** commit thay vì trong cùng transaction — ghi log cảnh báo `[DEGRADED_NO_TRANSACTION]` |
| 3 | Ở tầng 2, `OUTBOX_CHANGE_STREAM_ENABLED` bị ép `false` — chỉ dùng polling |
| 4 | Probe tự phát hiện: chạy `db.admin().command({ hello: 1 })` và kiểm tra `setName` có tồn tại không |
| 5 | Tầng 2 **chỉ dành cho dev** — không dùng cho staging/production |
| 6 | Mọi use case phụ thuộc transaction phải **test được ở cả 2 tầng** — CI chạy test suite 2 lần |

**Sự khác biệt giữa dev và production — bảng so sánh:**

| Khả năng | M0 (dev) | M10 (prod) |
|---|---|---|
| Transaction | ❌ | ✅ |
| Change Stream | ❌ | ✅ (polling vẫn chạy) |
| TTL index | ✅ | ✅ |
| Unique partial index | ✅ | ✅ |
| Full-text / Atlas Search | ❌ | ✅ (nếu bật) |
| Backup | ❌ (không có) | ✅ (Continuous Backup) |
| Point-in-time restore | ❌ | ✅ |
| SLA uptime | Không cam kết | 99.9%+ |

**Cảnh báo bắt buộc:** dữ liệu dev trên M0 **không có backup** và **không có SLA**. Không dùng M0 cho dữ liệu cần giữ. Ghi rõ điều này trong tài liệu bàn giao.

#### 3.4.4. Quy trình đồng bộ cấu hình

| Môi trường | File | Nguồn secret |
|---|---|---|
| Local | `.env` (tự tạo từ `.env.example`) | Developer tự đặt |
| Dev (Atlas M0) | `.env` trên máy dev hoặc VPS dev | Giá trị không nhạy cảm + API key test |
| Production | `.env` trên VPS, `chmod 600`, owner `deploy` | Sinh từ `openssl rand -hex 32` |

**Quy tắc:**
1. `.env` production có `chmod 600` và **không** nằm trong thư mục được backup không mã hoá.
2. Mỗi lần deploy production: **sinh lại** `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `DATA_ENCRYPTION_KEY` nếu cần rotate (làm hỏng tất cả session đang có — phải thông báo).
3. Không có `.env` trong repo. `.gitignore` phải chứa `.env`, `.env.*` (trừ `.env.example`).
4. Deploy script kiểm tra sự tồn tại của **mọi** biến bắt buộc trước khi restart container.

### 3.5. Docker Compose

#### 3.5.1. `docker-compose.yml` (production)

```yaml
name: data-quality

services:
  api:
    build:
      context: .
      dockerfile: apps/api/Dockerfile
    restart: unless-stopped
    env_file: .env
    environment:
      NODE_ENV: production
    depends_on:
      redis:
        condition: service_healthy
      kafka:
        condition: service_healthy
    expose:
      - "3000"
    healthcheck:
      test: ["CMD", "node", "-e", "fetch('http://localhost:3000/api/v1/health/live').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"]
      interval: 30s
      timeout: 5s
      retries: 3
      start_period: 40s
    deploy:
      resources:
        limits:
          memory: 1G

  worker:
    build:
      context: .
      dockerfile: apps/worker/Dockerfile
    restart: unless-stopped
    env_file: .env
    environment:
      NODE_ENV: production
    depends_on:
      redis:
        condition: service_healthy
      kafka:
        condition: service_healthy
      ai-engine:
        condition: service_started
    expose:
      - "3001"
    healthcheck:
      test: ["CMD", "node", "-e", "fetch('http://localhost:3001/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"]
      interval: 30s
      timeout: 5s
      retries: 3
      start_period: 40s
    deploy:
      resources:
        limits:
          memory: 2G

  # (v4) AI cục bộ — suy luận nội bộ, KHÔNG publish port ra host
  ai-engine:
    image: vllm/vllm-openai:latest-cpu
    restart: unless-stopped
    command:
      - "--model=/models/Qwen3-14B-Q4_K_M.gguf"
      - "--served-model-name=qwen3-14b"
      - "--max-model-len=8192"
      - "--dtype=auto"
      - "--api-key=${AI_INFERENCE_API_KEY}"
    environment:
      HF_HOME: /models
      OLLAMA_NUM_PARALLEL: "1"
    volumes:
      - ./models:/models:ro
    expose:
      - "8000"
    healthcheck:
      test: ["CMD-SHELL", "curl -sf http://localhost:8000/health || exit 1"]
      interval: 30s
      timeout: 10s
      retries: 5
      start_period: 300s          # (v4) nạp model 14B mất vài phút
    deploy:
      resources:
        limits:
          memory: 11G             # (v4) engine chiếm ~10 GB; còn lại ~4 GB cho app stack

  # (v4) Kafka — bus sự kiện + hàng đợi job, thay BullMQ
  kafka:
    image: apache/kafka:3.7.0
    restart: unless-stopped
    environment:
      KAFKA_NODE_ID: "1"
      KAFKA_PROCESS_ROLES: "broker,controller"
      KAFKA_CONTROLLER_QUORUM_VOTERS: "1@kafka:9093"
      KAFKA_LISTENERS: "PLAINTEXT://:9092,CONTROLLER://:9093"
      KAFKA_ADVERTISED_LISTENERS: "PLAINTEXT://kafka:9092"
      KAFKA_LISTENER_SECURITY_PROTOCOL_MAP: "CONTROLLER:PLAINTEXT,PLAINTEXT:PLAINTEXT"
      KAFKA_CONTROLLER_LISTENER_NAMES: "CONTROLLER"
      KAFKA_INTER_BROKER_LISTENER_NAME: "PLAINTEXT"
      KAFKA_OFFSETS_TOPIC_REPLICATION_FACTOR: "1"
      KAFKA_TRANSACTION_STATE_LOG_REPLICATION_FACTOR: "1"
      KAFKA_TRANSACTION_STATE_LOG_MIN_ISR: "1"
      KAFKA_GROUP_INITIAL_REBALANCE_DELAY_MS: "0"
      KAFKA_NUM_PARTITIONS: "3"
      KAFKA_LOG_RETENTION_HOURS: "168"
      KAFKA_AUTO_CREATE_TOPICS_ENABLE: "true"
    expose:
      - "9092"
    volumes:
      - kafka-data:/var/lib/kafka/data
    healthcheck:
      test: ["CMD-SHELL", "/opt/kafka/bin/kafka-topics.sh --bootstrap-server localhost:9092 --list || exit 1"]
      interval: 15s
      timeout: 10s
      retries: 10
      start_period: 40s
    deploy:
      resources:
        limits:
          memory: 1G

  redis:
    image: redis:7-alpine
    restart: unless-stopped
    command: >
      redis-server
      --appendonly yes
      --appendfsync everysec
      --maxmemory 256mb
      --maxmemory-policy noeviction
    volumes:
      - redis-data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 3s
      retries: 5
    deploy:
      resources:
        limits:
          memory: 320M

volumes:
  redis-data:
  kafka-data:
```

#### 3.5.2. Điểm thiết kế đáng chú ý

| # | Quyết định | Lý do |
|---|---|---|
| 1 | `redis --maxmemory 256mb --maxmemory-policy noeviction` | **v4:** giảm từ 512 MB → 256 MB để nhường RAM cho `ai-engine`. `noeviction` thay vì `allkeys-lru` — không được xoá cache/adapter đang dùng. Nếu đầy → báo lỗi rõ ràng |
| 2 | `redis --appendonly yes` | AOF bật — cache và adapter phục hồi sau restart |
| 3 | `depends_on: condition: service_healthy` | API/worker chỉ khởi động khi Redis **và Kafka** sẵn sàng — tránh crash loop. `ai-engine` dùng `service_started` vì nó nạp model lâu |
| 4 | `restart: unless-stopped` | Tự khởi động lại sau crash hoặc reboot VPS |
| 5 | `expose` thay vì `ports` | Không expose trực tiếp ra host — Nginx là cổng vào duy nhất. **v4:** `ai-engine` và `kafka` cũng chỉ `expose` |
| 6 | `memory: 1G` (api), `2G` (worker), **`11G` (ai-engine)**, `1G` (kafka), `320M` (redis) | **v4:** tổng ≤ 15 GB. Engine chiếm phần lớn — đây là ràng buộc vận hành số 1 (mục 3.16) |
| 7 | `start_period: 40s` (api/worker/kafka), **`300s` (ai-engine)** | **v4:** nạp model 14B mất vài phút — không tính vào timeout của job. Nếu `start_period` quá ngắn, container bị restart vô ích |
| 8 | **Không** có service MongoDB | Dùng Atlas — không cần container DB |
| 9 | **Không** có service Nginx trong compose | Nginx chạy trên host (ngoài compose) để tách lớp TLS khỏi app stack |
| 10 | **v4:** Kafka ở chế độ **KRaft single-node** | Không cần ZooKeeper → giảm 1 container và 1 bề mặt tấn công. Đủ cho 5 topic / 6 consumer group |
| 11 | **v4:** `KAFKA_AUTO_CREATE_TOPICS_ENABLE=true` | Tiện cho dev. Ở production nên tạo topic **trước** bằng script và đặt `false` để tránh topic sai cấu hình |
| 12 | **v4:** mount `./models:/models:ro` | Model `.gguf` nằm trên host, mount **read-only** vào engine — không ghi được vào image, dễ thay model bằng symlink + restart |
| 13 | **v4:** `--api-key=${AI_INFERENCE_API_KEY}` cho engine | Engine không chạy ở chế độ open — bắt buộc xác thực nội bộ (Phần 6 v5 mục 3.19) |

**Đánh đổi:** `noeviction` + `maxmemory 256mb` nghĩa là khi Redis đầy, cache/adapter **ghi thất bại** thay vì xoá dữ liệu cũ. Vì Redis không còn giữ job, việc đầy Redis giờ chỉ ảnh hưởng cache và Socket.IO adapter (multi-instance) — nguy hiểm hơn nhiều so với trước. Cần cảnh báo khi Redis vượt 80%.

**Rủi ro vận hành lớn nhất của v4 — tranh chấp RAM:**

| Container | Giới hạn | Ghi chú |
|---|---|---|
| `ai-engine` | 11 GB | RSS thực tế ~10 GB khi nạp 14B Q4_K_M |
| `worker` | 2 GB | Xử lý lọc dataset + phân tích thống kê |
| `api` | 1 GB | |
| `kafka` | 1 GB | JVM heap mặc định có thể vượt — cần `KAFKA_HEAP_OPTS=-Xmx512m` |
| `redis` | 320 MB | |
| **Tổng giới hạn** | **~15,3 GB** | **Sát ngưỡng 15 GB của VPS** |

→ Xem mục 3.16 (ngân sách RAM & bảo vệ bộ nhớ) để biết cơ chế dừng job AI khi thiếu RAM.

#### 3.5.3. `docker-compose.dev.yml` (override local)

```yaml
services:
  api:
    build:
      context: .
      target: development
    command: pnpm --filter @dq/api start:dev
    volumes:
      - ./apps/api:/app/apps/api
      - ./packages:/app/packages
    environment:
      NODE_ENV: development
      LOG_LEVEL: debug
      DB_SUPPORTS_TRANSACTIONS: "false"
      DB_SUPPORTS_CHANGE_STREAM: "false"
      OUTBOX_CHANGE_STREAM_ENABLED: "false"
      STORAGE_DRIVER: local
      REALTIME_ADAPTER: memory
      AI_ENGINE: ollama
      AI_INFERENCE_BASE_URL: http://ai-engine:11434/v1
      AI_MODEL_PRIMARY: qwen3:14b
      AI_MODEL_FAST: qwen3:8b
    ports:
      - "3000:3000"

  worker:
    build:
      context: .
      target: development
    command: pnpm --filter @dq/worker start:dev
    volumes:
      - ./apps/worker:/app/apps/worker
      - ./packages:/app/packages
    environment:
      NODE_ENV: development
      LOG_LEVEL: debug
      DB_SUPPORTS_TRANSACTIONS: "false"
      OUTBOX_CHANGE_STREAM_ENABLED: "false"
      AI_ENGINE: ollama
      AI_INFERENCE_BASE_URL: http://ai-engine:11434/v1
    ports:
      - "3001:3001"

  # (v4) dev dùng Ollama — cài một lệnh, quản lý model dễ
  ai-engine:
    image: ollama/ollama:latest
    restart: unless-stopped
    volumes:
      - ollama-data:/root/.ollama
    expose:
      - "11434"

  # (v4) dev dùng Kafka KRaft single-node
  kafka:
    image: apache/kafka:3.7.0
    restart: unless-stopped
    environment:
      KAFKA_NODE_ID: "1"
      KAFKA_PROCESS_ROLES: "broker,controller"
      KAFKA_CONTROLLER_QUORUM_VOTERS: "1@kafka:9093"
      KAFKA_LISTENERS: "PLAINTEXT://:9092,CONTROLLER://:9093"
      KAFKA_ADVERTISED_LISTENERS: "PLAINTEXT://kafka:9092"
      KAFKA_LISTENER_SECURITY_PROTOCOL_MAP: "CONTROLLER:PLAINTEXT,PLAINTEXT:PLAINTEXT"
      KAFKA_CONTROLLER_LISTENER_NAMES: "CONTROLLER"
      KAFKA_INTER_BROKER_LISTENER_NAME: "PLAINTEXT"
      KAFKA_OFFSETS_TOPIC_REPLICATION_FACTOR: "1"
      KAFKA_TRANSACTION_STATE_LOG_REPLICATION_FACTOR: "1"
      KAFKA_TRANSACTION_STATE_LOG_MIN_ISR: "1"
      KAFKA_GROUP_INITIAL_REBALANCE_DELAY_MS: "0"
      KAFKA_NUM_PARTITIONS: "1"
    expose:
      - "9092"

volumes:
  ollama-data:
```

#### 3.5.4. Dockerfile — multi-stage

**Nguyên tắc chung cho `apps/api/Dockerfile` và `apps/worker/Dockerfile`:**

```dockerfile
# Stage 1: build
FROM node:22-alpine AS builder
RUN corepack enable && corepack prepare pnpm@9 --activate
WORKDIR /app
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY apps/api/package.json apps/api/
COPY apps/worker/package.json apps/worker/
COPY packages/core/package.json packages/core/
COPY packages/contracts/package.json packages/contracts/
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm --filter @dq/core build \
 && pnpm --filter @dq/contracts build \
 && pnpm --filter @dq/api build

# Stage 2: runtime
FROM node:22-alpine AS runtime
RUN corepack enable && corepack prepare pnpm@9 --activate \
 && addgroup -S dq && adduser -S dq -G dq
WORKDIR /app
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/apps/worker/dist ./apps/worker/dist
COPY --from=builder /app/packages/core/dist ./packages/core/dist
COPY --from=builder /app/packages/contracts/dist ./packages/contracts/dist
COPY --from=builder /app/package.json ./
USER dq
EXPOSE 3000
CMD ["node", "apps/api/dist/main.js"]
```

**Quy tắc bắt buộc:**
1. Chạy bằng **user không phải root** (`dq`) — giảm bề mặt tấn công nếu container bị thoát.
2. `pnpm install --frozen-lockfile` — không bao giờ cài phiên bản lệch lockfile.
3. Copy `node_modules` từ stage build — không cài lại ở runtime (chậm, có thể fail mạng).
4. Không copy source `.ts` vào image runtime — chỉ `dist/`.
5. `.dockerignore` loại `node_modules`, `dist`, `.git`, `.env`, `docs`, `test`.
6. Image không chứa secret — secret đến từ `env_file` lúc runtime.

**Quyết định về `pnpm` và workspace:** dùng `pnpm deploy` hoặc copy thủ công như trên. Với monorepo có 2 app + 2 package, copy thủ công giữ đơn giản hơn `pnpm deploy` (yêu cầu `inject-workspace-packages`).

### 3.6. Health check và sẵn sàng

#### 3.6.1. Ba cấp độ

| Endpoint | Kiểm tra | Dùng cho |
|---|---|---|
| `GET /api/v1/health/live` | Tiến trình còn sống — trả 200 ngay, **không** kiểm tra gì khác | Docker healthcheck, liveness probe |
| `GET /api/v1/health/ready` | MongoDB kết nối được, Redis kết nối được | Readiness probe — chỉ nhận traffic khi sẵn sàng |
| `GET /api/v1/health/deep` | Thêm: kiểm tra R2 (HEAD bucket), kiểm tra **Kafka** (metadata), kiểm tra **engine suy luận** (`/health` của vLLM) | Chẩn đoán thủ công, không dùng cho probe tự động |

**Trả về mẫu `/api/v1/health/ready`:**

```json
{
  "status": "ok",
  "checks": {
    "mongodb": { "status": "ok", "latencyMs": 12, "transactions": true, "replicaSet": "atlas-xxxx-shard-0" },
    "redis": { "status": "ok", "latencyMs": 1 }
  },
  "uptimeSeconds": 3600,
  "version": "1.0.0"
}
```

**Trả về mẫu khi có vấn đề (HTTP 503):**

```json
{
  "status": "degraded",
  "checks": {
    "mongodb": { "status": "ok", "latencyMs": 15, "transactions": true },
    "redis": { "status": "fail", "error": "ECONNREFUSED" }
  },
  "uptimeSeconds": 3600
}
```

**Quy tắc bắt buộc:**
1. `/health/live` **không** kiểm tra dependency — nếu kiểm tra MongoDB, khi DB chết container bị restart liên tục dù vấn đề nằm ở DB.
2. `/health/ready` trả 503 nếu bất kỳ dependency nào lỗi — Nginx dùng nó để cắt traffic.
3. Endpoint health **không** yêu cầu xác thực, nhưng **không** lộ chi tiết lỗi nội bộ ra ngoài. Trả mã lỗi chuẩn (`ECONNREFUSED`), không trả stack trace hay connection string.
4. Endpoint health **không** nằm sau global prefix `/api/v1`? — **Có**, nằm trong `/api/v1/health/*` cho nhất quán. Nginx/load balancer cấu hình đường dẫn tương ứng.
5. `worker` có `/health` riêng trên port 3001 — kiểm tra worker đang chạy (heartbeat Kafka consumer gần nhất < 60 giây).

#### 3.6.2. Kiểm tra sẵn sàng theo vai trò

| Service | Check đầu tiên | Hành vi khi lỗi |
|---|---|---|
| `api` | MongoDB + Redis + **Kafka** | 503, Nginx cắt traffic |
| `worker` | MongoDB + Redis + **Kafka** + heartbeat consumer gần đây | 503, worker không nhận job mới |

**Ghi chú quan trọng:** `worker` chỉ cần MongoDB + Redis + Kafka để **chạy**; nếu **engine suy luận** lỗi thì job AI fail nhưng hệ thống vẫn phục vụ được phần khác. Vì vậy `/health` của worker **không** kiểm tra engine AI — kiểm tra ở `/health/deep`.

**v4 — trạng thái engine suy luận và cổng sẵn sàng:** `ai-engine` có thể mất vài phút để nạp model 14B. Trong khoảng thời gian đó, `ai-engine` **đã sẵn sàng về mặt container** nhưng **chưa sẵn sàng về mặt suy luận**. Hệ thống phải phân biệt hai loại:

| Tình trạng | Hành vi mong đợi |
|---|---|
| Engine chưa nạp xong | API trả `202 Accepted`, job AI vào hàng đợi Kafka `ai.jobs`, chờ. Không phải lỗi |
| Engine đã nạp xong | Job AI chạy bình thường |
| Engine chết giữa chừng | Job fail với `DEPENDENCY_UNAVAILABLE`, Tổng kết vẫn trả kết quả phân tích hệ thống (AI fail mềm — Phần 12 v4 mục 3.9) |

### 3.7. Logging

#### 3.7.1. Định dạng

**Quyết định.** JSON structured log ra stdout, dùng `nestjs-pino` (bọc `pino`).

```json
{
  "level": 30,
  "time": "2026-11-05T08:15:32.481Z",
  "pid": 1,
  "hostname": "dq-api-7f9c",
  "service": "api",
  "env": "production",
  "msg": "Dataset imported",
  "requestId": "req_01JABC...",
  "userId": "usr_01JABC...",
  "workspaceId": "ws_01JABC...",
  "projectId": "prj_01JABC...",
  "durationMs": 4210,
  "route": "POST /api/v1/workspaces/:workspaceId/projects/:projectId/datasets",
  "statusCode": 201
}
```

**Quy tắc bắt buộc:**

| # | Quy tắc |
|---|---|
| 1 | **Không** log `password`, `token`, `refreshToken`, `otp`, `secret`, `authorization` — có `redact` list cố định |
| 2 | **Không** log giá trị ô dữ liệu (PII) — chỉ log định danh cột, số dòng, mã lỗi (Phần 12 mục 3.10) |
| 3 | **Không** log nội dung email gửi đi |
| 4 | Mọi log có `requestId` — sinh từ header `X-Request-Id` nếu có, không thì tự sinh (ULID) |
| 5 | `requestId` trả về client trong header `X-Request-Id` để tra cứu |
| 6 | Log ở mức `info` trở xuống ghi ra stdout; `debug` chỉ khi `LOG_LEVEL=debug` |
| 7 | Trường nghiệp vụ dùng **camelCase** để nhất quán với contract API (Phần 7 mục 3.3) |
| 8 | Không log stack trace ở mức `error` cho lỗi đã biết — chỉ `msg` + mã lỗi |

#### 3.7.2. Danh mục log theo sự kiện

| Sự kiện | Mức | Trường bắt buộc |
|---|---|---|
| Khởi động app | `info` | `version`, `env`, `dbTransactions`, `changeStreamEnabled` |
| Từ chối khởi động (thiếu biến) | `fatal` | `missingVars` (chỉ tên biến) |
| Yêu cầu HTTP | `info` | `requestId`, `method`, `route`, `statusCode`, `durationMs`, `userId` |
| Lỗi HTTP 4xx | `warn` | `requestId`, `code`, `route` |
| Lỗi HTTP 5xx | `error` | `requestId`, `code`, `route`, `stack` (server-side only) |
| Đăng nhập thành công | `info` | `userId`, `sessionId` |
| Đăng nhập thất bại | `warn` | `email` (đã mask: `a***@e***.com`), `ip`, `reason` |
| Phát hiện tái sử dụng refresh token | `warn` | `userId`, `sessionId`, `ip` |
| Rate-limit bị chặn | `warn` | `route`, `ip`, `userId` |
| Upload dataset | `info` | `datasetId`, `projectId`, `sizeBytes`, `rowCount`, `durationMs` |
| Upload thất bại | `error` | `projectId`, `errorCode`, `reason` |
| Import dataset hoàn tất | `info` | `datasetId`, `totalRows`, `durationMs` |
| Chạy phân tích | `info` | `runId`, `projectId`, `inputFingerprint` |
| Gọi AI | `info` | `jobId`, `model`, `promptTokens`, `responseTokens`, `durationMs` — **không** log prompt/response |
| AI — RAM guard | `warn` | `rssBytes`, `thresholdPercent`, `action: "pause_ai_jobs"` |
| AI — model chưa nạp | `warn` | `model`, `waitedMs` |
| **Gọi AI — che PII** | `info` | `jobId`, `maskedColumns`, `droppedSamples`, `sampleCount` — **không** log giá trị ô |
| AI thất bại | `error` | `jobId`, `errorCode`, `attempt`, `retryable` |
| Sinh PDF | `info` | `reportId`, `projectId`, `sizeBytes`, `durationMs` |
| Publish outbox | `debug` | `eventId`, `eventType` |
| Consumer inbox | `debug` | `consumerName`, `eventId`, `outcome` |
| Job Kafka fail | `error` | `topic`, `partition`, `offset`, `jobName`, `attemptsMade`, `errorCode` |
| Sự kiện vào DLQ | `error` | `topic`, `partition`, `offset`, `originalTopic`, `attempts` |
| Job cleanup | `info` | `deletedCounts` (theo loại), `filesDeleted`, `durationMs` |
| Relay phát hiện event kẹt | `warn` | `eventId`, `status`, `ageSeconds` |
| Phục hồi khi khởi động | `info` | `staleAiJobs`, `staleOutboxEvents`, `staleInboxClaims` |

#### 3.7.3. Quy tắc dữ liệu nhạy cảm

**Danh sách redact cố định (pino):**

```
req.headers.authorization
req.headers.cookie
req.headers['x-api-key']
password
passwordHash
password_hash
refreshToken
refresh_token
refreshTokenHash
otp
otpHash
accessToken
secret
apiKey
```

**Quy tắc bổ sung:**
1. Email trong log luôn được **mask**: `a***@e***.com` — trường `email` chỉ dùng cho log đăng nhập.
2. Giá trị ô dữ liệu: **không bao giờ**. Kể cả ở mức `debug`.
3. `inputFingerprint` là hash — an toàn để log.
4. Không log nội dung `payload` của outbox event (có thể chứa tên project — chấp nhận được, nhưng không cần).

### 3.8. Metrics

**Quyết định.** Không dựng stack Prometheus/Grafana. Metrics được **ghi vào log JSON** dưới trường `metrics` khi xảy ra sự kiện đáng chú ý, kèm cơ chế đếm in-process.

**Quyết định này có trade-off rõ ràng:**

| Ưu | Nhược |
|---|---|
| Không thêm thành phần hạ tầng, không tăng chi phí vận hành | Không có dashboard trực quan |
| Log đã có sẵn → truy vấn được bằng `jq`/log query | Không có cảnh báo tự động theo ngưỡng |
| Dễ bảo trì | Phải tự viết script phân tích log |

**Bù lại, hệ thống có:**
1. **Script phân tích log** (`deploy/scripts/analyze-logs.sh`) đếm chuỗi lỗi theo mã trong 1 giờ gần nhất → dùng cho cảnh báo thủ công hoặc cron báo email.
2. **Bảng số liệu vận hành** duy nhất, cập nhật mỗi 1 giờ, in ra log `metrics` — xem mục 3.8.1.
3. **Health endpoint** làm tín hiệu sống.

#### 3.8.1. Bảng số liệu vận hành (hourly)

```json
{
  "level": 30,
  "time": "2026-11-05T09:00:00.000Z",
  "service": "api",
  "msg": "Hourly metrics snapshot",
  "metrics": {
    "http": {
      "requestsTotal": 1284,
      "errors4xx": 12,
      "errors5xx": 3,
      "p95LatencyMs": 342,
      "p99LatencyMs": 1890
    },
    "jobs": {
      "aiCompleted": 8,
      "aiFailed": 1,
      "reportsGenerated": 4,
      "emailsSent": 2,
      "emailsFailed": 0
    },
    "outbox": {
      "pending": 0,
      "publishing": 0,
      "failed": 0,
      "oldestPendingAgeSeconds": 0
    },
    "storage": {
      "totalBytes": 2147483648,
      "workspaceCount": 4
    },
    "db": {
      "connectionPoolActive": 2,
      "connectionPoolSize": 20
    },
    "redis": {
      "usedMemoryBytes": 52428800,
      "maxMemoryBytes": 536870912,
      "bullQueueDepth": 0
    }
  }
}
```

**Quy tắc bắt buộc:**
1. Snapshot ghi **mỗi 1 giờ** bởi một timer trong app — không phụ thuộc cron bên ngoài.
2. Metrics **không** chứa dữ liệu người dùng — chỉ số lượng và tỷ lệ.
3. `oldestPendingAgeSeconds` > 300 → cảnh báo (outbox bị nghẽn).
4. `redis.usedMemoryBytes` > 80% `maxMemoryBytes` → cảnh báo.
5. `p99LatencyMs` > 5000 → cảnh báo.

#### 3.8.2. Ngưỡng cảnh báo

| Chỉ số | Ngưỡng | Hành động |
|---|---|---|
| `outbox.oldestPendingAgeSeconds` | > 300s | Cảnh báo — relay nghẽn |
| `outbox.failed` | > 0 | Cảnh báo — có event không publish được |
| `jobs.aiFailed` (1 giờ) | > 20% tổng AI job | Cảnh báo — engine suy luận có vấn đề |
| `redis.usedMemoryBytes` | > 80% | Cảnh báo — sắp đầy |
| `http.errors5xx` (1 giờ) | > 10 | Cảnh báo — lỗi hệ thống |
| `http.p99LatencyMs` | > 5000 | Cảnh báo — hiệu năng |
| `db.connectionPoolActive` | > 90% pool size | Cảnh báo — thiếu connection |
| Health `/ready` fail | > 2 lần liên tiếp | Cảnh báo nghiêm trọng |

**Cơ chế cảnh báo:** script `deploy/scripts/check-alerts.sh` chạy bằng cron mỗi 5 phút, đọc log 5 phút gần nhất, so với ngưỡng, gửi email qua SMTP (dùng chính SMTP của hệ thống). Không cần hệ thống cảnh báo riêng.

### 3.9. Sao lưu và khôi phục

#### 3.9.1. Chiến lược theo môi trường

| Môi trường | Database | Sao lưu | Khôi phục |
|---|---|---|---|
| Local | Atlas M0 hoặc Mongo local | **Không** | Không cần |
| Dev | Atlas M0 | **Không** (M0 không hỗ trợ backup) | Tạo lại từ seed script |
| Production | Atlas M10 | **Continuous Backup** của Atlas + snapshot R2 hằng ngày | PITR của Atlas hoặc restore từ snapshot |

#### 3.9.2. Lưu ý quan trọng về Atlas M0

**M0 không có tính năng backup.** Dữ liệu dev trên M0 có thể mất bất kỳ lúc nào do:
- Atlas có thể xoá cluster free tier không hoạt động.
- Chính sách Atlas về free tier.
- Lỗi thao tác người dùng.

**Quy tắc bắt buộc:**
1. **Không** dùng M0 cho dữ liệu cần giữ. Chỉ dùng cho dữ liệu test/fixture.
2. Có **seed script** để tạo lại dữ liệu dev trong < 5 phút: `pnpm --filter @dq/api seed:dev`.
3. Dữ liệu dev **không** phải dữ liệu thật — không chứa PII, không dùng email thật.
4. Ghi rõ cảnh báo này trong tài liệu bàn giao.

#### 3.9.3. Sao lưu production

**Tầng 1 — Atlas Continuous Backup (bắt buộc):**
- Bật trong Atlas UI: **Continuous Cloud Backup**.
- Bảo lưu liên tục + **Point-in-Time Restore (PITR)** — khôi phục được về bất kỳ thời điểm nào trong 35 ngày gần nhất.
- Không cần tự viết script.

**Tầng 2 — Snapshot R2 hằng ngày (defense in depth):**

```bash
#!/usr/bin/env bash
# deploy/scripts/backup.sh — chạy bằng cron 03:00 giờ VN
set -euo pipefail

TIMESTAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP_DIR="/tmp/dq-backup/${TIMESTAMP}"
RETENTION_DAYS=30

mkdir -p "${BACKUP_DIR}"

# 1. Dump database (không chứa file R2 — đã có versioning)
mongodump \
  --uri="${DB_URI}" \
  --archive="${BACKUP_DIR}/data.archive.gz" \
  --gzip

# 2. Upload lên R2 với retention 30 ngày
aws s3 cp "${BACKUP_DIR}/data.archive.gz" \
  "s3://${S3_BUCKET_NAME}/backups/data-${TIMESTAMP}.archive.gz" \
  --endpoint-url "${S3_ENDPOINT}"

# 3. Dọn bản local
rm -rf "${BACKUP_DIR}"

# 4. Xoá bản R2 cũ hơn retention
aws s3 ls "s3://${S3_BUCKET_NAME}/backups/" \
  --endpoint-url "${S3_ENDPOINT}" \
  | awk '{print $4}' \
  | while read -r key; do
      age=$(( ( $(date +%s) - $(date -d "$(basename "$key" | sed -E 's/data-([0-9]{8})-([0-9]{6}).*/\1 \2/')" +%s) ) / 86400 ))
      if [ "$age" -gt "$RETENTION_DAYS" ]; then
        aws s3 rm "s3://${S3_BUCKET_NAME}/${key}" --endpoint-url "${S3_ENDPOINT}"
      fi
    done
```

**Quy tắc bắt buộc:**
1. Chạy bằng **cron** ngoài container — không phụ thuộc trạng thái app.
2. **Kiểm tra kết quả backup** — script phải exit code khác 0 nếu `mongodump` thất bại, và gửi email cảnh báo.
3. **Backup không chứa file R2** — R2 đã có versioning, chỉ cần bật versioning trên bucket.
4. Giữ **30 bản** R2 + PITR 35 ngày của Atlas.
5. **Quy trình restore phải được thử định kỳ** — ít nhất 1 lần/quý trên môi trường staging. Backup chưa được restore thử coi như **không có backup**.

**Quy trình khôi phục:**

```bash
# 1. Tạo cluster mới trên Atlas (M10, cùng region)
# 2. Đổi DB_URI trong .env trên VPS
# 3. Restore:
mongorestore \
  --uri="${NEW_DB_URI}" \
  --archive="s3://${S3_BUCKET_NAME}/backups/data-20261105-030000.archive.gz" \
  --gzip \
  --nsFrom='${DB_NAME}.*' \
  --nsTo='${DB_NAME}.*'
# 4. Kiểm tra số lượng document từng collection
# 5. Restart api + worker
# 6. Kiểm tra /api/v1/health/ready
```

**Điểm kiểm tra sau restore (bắt buộc):**

| Kiểm tra | Cách |
|---|---|
| Số document mỗi collection | So sánh với snapshot thời điểm backup |
| Index còn đủ | `db.collection.getIndexes()` — đặc biệt unique partial và TTL |
| Outbox không kẹt | Không có event ở trạng thái `publishing` |
| Bản lưu project còn nguyên | Kiểm tra `project_save` có `is_current = true` |
| Phân quyền | Đăng nhập thử bằng tài khoản `WS-OWNER` và `PROJ-VIEWER` |

#### 3.9.4. Sao lưu file R2

**Quyết định:** bật **versioning** trên bucket R2 — bản cũ được giữ, giới hạn 7 phiên bản.

```bash
aws s3api put-bucket-versioning \
  --bucket "${S3_BUCKET_NAME}" \
  --versioning-configuration Status=Enabled \
  --endpoint-url "${S3_ENDPOINT}"
```

**Quy tắc:**
1. Bucket có versioning — xoá nhầm vẫn khôi phục được.
2. **Không** dùng lifecycle rule xoá file gốc dataset — việc xoá do job cleanup theo retention (Phần 8 mục 3.11) điều khiển, để có audit trail.
3. File gốc dataset được xoá **cùng lúc** xoá dataset ở cấp cha (`project` → `workspace`); không có cơ chế "phiên bản dữ liệu" riêng vì module `versions` đã bị gỡ.

### 3.9.5. Sao lưu bắt buộc cho cutover migration

**Quy tắc:** trước khi chạy cutover migration (Phần 11 mục 3.3 bước 1), **bắt buộc** phải có backup đã được restore thử.

**Quy trình (3 bước):**

```bash
# 1. Dump toàn bộ database
bash deploy/scripts/backup.sh

# 2. Kiểm tra file backup tồn tại và có kích thước > 0
aws s3 ls "s3://${S3_BUCKET_NAME}/backups/" --endpoint-url "${S3_ENDPOINT}" \
  | tail -1

# 3. Restore thử lên cluster tạm để xác nhận backup dùng được
#    (bỏ qua nếu Atlas Continuous Backup + PITR đã bật và test trong 3 tháng gần nhất)
```

**Quy tắc bắt buộc:**

| # | Quy tắc |
|---|---|
| 1 | Không có backup → **không được cutover**. Không có ngoại lệ |
| 2 | Backup phải **đã được restore thử** ít nhất 1 lần — backup chưa test coi như không có backup |
| 3 | File backup phải nằm trên **R2 bucket production**, không cùng VPS (rủi ro mất cả VPS) |
| 4 | Ghi log: thời điểm backup, kích thước file, kết quả kiểm tra, người thực hiện |
| 5 | Giữ file backup **ít nhất 30 ngày** sau cutover — không xoá sớm |

**Đối chiếu với Phần 11:** Phần 11 mục 3.3 đánh dấu backup là "khuyến nghị, không chặn" (theo quyết định của người dùng tại mục 3.1 #12). **V2 của Phần 10 siết lại**: với cutover, backup là **bắt buộc**. Lý do: quyết định "không chặn" được đưa ra khi chưa đánh giá rủi ro cụ thể; với thao tác ghi hàng triệu document, thiếu backup là rủi ro không chấp nhận được.

### 3.10. Quy trình triển khai

#### 3.10.1. Môi trường

| Môi trường | Database | Storage | Ai | Ai đặt ở đâu |
|---|---|---|---|---|
| Local | Atlas M0 hoặc Mongo local | `local` | `disabled` | Máy dev |
| Dev | Atlas M0 | `local` | `disabled` | VPS dev |
| Staging | Atlas M10 (riêng) | R2 bucket riêng | **engine nội bộ** (model nhẹ hơn) | VPS staging |
| Production | Atlas M10 | R2 bucket production | **engine nội bộ** `Qwen3-14B` | VPS production |

**Quy tắc:**
1. **Mỗi môi trường dùng Atlas cluster riêng** — không dùng chung M10 giữa staging và production.
2. **Mỗi môi trường dùng R2 bucket riêng** — `dq-files-staging` và `dq-files-production`.
3. Staging bắt buộc có replica set → chạy đúng code path với production (transaction + change stream).
4. Staging là nơi **thử restore** (mục 3.9.3).

#### 3.10.2. Quy trình deploy

**Vì sao không dùng CI/CD tự động:** dự án chưa có CI, quy mô nhỏ, đội 1 người. Quy trình thủ công 6 bước đơn giản, dễ kiểm soát, ít rủi ro hơn việc thiết lập pipeline. Nếu số lượng deploy tăng > 5 lần/ngày thì xem xét CI.

```bash
#!/usr/bin/env bash
# deploy/scripts/deploy.sh
set -euo pipefail

cd /opt/data-quality

echo "==> 1. Kiểm tra biến môi trường bắt buộc"
node -e "
  const { validateEnv } = require('./apps/api/dist/config/env.validation.js');
  const r = validateEnv();
  if (!r.ok) { console.error('Thiếu biến:', r.missing); process.exit(1); }
"

echo "==> 2. Pull code mới"
git fetch --all
git checkout "${DEPLOY_REF:-main}"
git pull --ff-only

echo "==> 3. Build"
docker compose build --pull

echo "==> 4. Dừng api (giữ worker chạy để không mất job)"
docker compose stop api

echo "==> 5. Chạy migration (nếu có) — Phần 11"
docker compose run --rm api node dist/migrate.js

echo "==> 6. Start lại"
docker compose up -d

echo "==> 7. Kiểm tra health"
sleep 15
curl -fsS http://localhost:3000/api/v1/health/ready | jq .

echo "==> Deploy hoàn tất: $(git rev-parse --short HEAD)"
```

**Quy tắc bắt buộc:**

| # | Quy tắc |
|---|---|
| 1 | **Luôn deploy bằng git commit cụ thể** — không `git pull` mù; `DEPLOY_REF` phải là commit SHA hoặc tag |
| 2 | **Dừng `api` trước, giữ `worker` chạy** — worker xử lý hết job đang pending trong lúc API restart |
| 3 | Migration chạy **trước** khi start API mới — script phải idempotent để chạy lại an toàn |
| 4 | Kiểm tra `/health/ready` sau deploy — fail thì rollback (mục 3.10.3) |
| 5 | Ghi log mỗi lần deploy: commit SHA, thời gian, kết quả, người thực hiện |
| 6 | Deploy **không** tự động rotate secret |

##### 3.10.2.1. Ngoại lệ: quy trình cutover migration

**Quy tắc của v1 là:** *"Dừng `api` trước, giữ `worker` chạy để không mất job"*.

**Quy tắc này KHÔNG áp dụng cho cutover migration** (Phần 11 mục 3.3).

| | Deploy thường | Cutover migration |
|---|---|---|
| `api` | Dừng | **Dừng** |
| `worker` | **Giữ chạy** | **Dừng** |
| Lý do | Worker xử lý hết job pending trong lúc API restart, không mất job | Worker cũ có thể ghi vào **collection cũ** (`outbox_events`, `dataset_records`) trong lúc migration đang chạy → dữ liệu ghi thêm sau khi đã đếm → **sai lệch số lượng**, verify fail |

**Quy tắc bắt buộc cho cutover:**

| # | Quy tắc |
|---|---|
| 1 | Dừng **cả** `api` và `worker` trước khi chạy script migration |
| 2 | **v4:** Message Kafka đang chờ **không mất** — Kafka lưu bền vững trên volume `kafka-data`; consumer offset chưa commit thì message được đọc lại sau khi bật lại worker |
| 3 | **v4:** Message **đang xử lý dở** (in-flight) sẽ bị gián đoạn — consumer không commit offset → message được redeliver. Consumer phải **idempotent** (inbox pattern `processed_event`) |
| 4 | Sau khi bật lại, kiểm tra `outbox_event` không có event kẹt ở `publishing` quá 60 giây — polling fallback sẽ tự phục hồi (Phần 9 mục 3.4.3) |
| 5 | Toàn bộ quy trình cutover tuân thủ **8 bước** ở Phần 11 mục 3.3 — bước 1 (backup) là bước khuyến nghị, các bước còn lại là bắt buộc |
| 6 | Deploy script phải **nhận biết** chế độ: `--mode=migration` dừng cả 2 container; mặc định `--mode=normal` chỉ dừng `api` |

**Điểm khác biệt về mức độ khuyến nghị backup:**

| Giai đoạn | Mức backup |
|---|---|
| Deploy thường | Khuyến nghị — Atlas Continuous Backup đã có sẵn |
| **Cutover migration** | **Bắt buộc** — đây là thao tác ghi hàng loạt lên dữ liệu nghiệp vụ; không có backup thì không thể khôi phục khi script lỗi |

Quy trình backup bắt buộc cho cutover: mục 3.9.5.

#### 3.10.3. Rollback

| Mức | Khi nào | Cách |
|---|---|---|
| **L1 — Rollback code** | Lỗi logic, không có migration | `git checkout <commit trước>` → `docker compose build` → `up -d` (~3 phút) |
| **L2 — Rollback kèm migration** | Migration đã chạy, không tương thích ngược | Cần migration `down` — viết **ngược** cho mọi migration (mục 3.10.4) |
| **L3 — Restore từ backup** | Lỗi dữ liệu, hỏng collection | Restore từ Atlas PITR hoặc snapshot R2 (mục 3.9.3) — mất dữ liệu phát sinh sau backup |

**Quy tắc bắt buộc:**
1. **Luôn** có L1 khả dụng — đây là lý do chính để deploy theo commit cụ thể.
2. Migration **phải** có chiều `down` — viết trong Phần 11.
3. Migration phải **tương thích ngược** trong 1 version: đọc được dữ liệu do schema cũ ghi và schema mới ghi. Nếu không, phải ghi rõ trong tài liệu migration rằng rollback chỉ L3.
4. Trước khi deploy lần đầu lên production, **luyện tập** deploy + rollback trên staging.

#### 3.10.4. Quy tắc migration (liên kết Phần 11)

| # | Quy tắc |
|---|---|
| 1 | Mọi script migration nằm ở `apps/api/src/migrate/` hoặc `deploy/scripts/migrate.ts` |
| 2 | Chạy theo thứ tự đánh số: `001_xxx.ts`, `002_yyy.ts` |
| 3 | Mỗi migration có `up()` và `down()` |
| 4 | **Idempotent** — chạy lại không gây hại (dùng `updateMany` có điều kiện, không `insertMany` trùng) |
| 5 | Ghi log số lượng document bị ảnh hưởng |
| 6 | Migration **không** xoá dữ liệu cũ — chỉ đánh dấu `deleted_at` hoặc đặt cờ. Xoá thật do job cleanup lo (Phần 8 mục 3.11) |
| 7 | Chạy trước khi start API mới (bước 5 trong mục 3.10.2) |

### 3.11. Xử lý sự cố

#### 3.11.1. Sự cố thường gặp và cách xử lý

| Triệu chứng | Nguyên nhân khả dĩ | Cách xử lý |
|---|---|---|
| API trả 503 liên tục | MongoDB mất kết nối | `docker compose logs api \| grep mongodb` → kiểm tra Atlas dashboard |
| Worker không xử lý event | **Kafka** không sẵn sàng hoặc consumer group bị kẹt | `docker compose logs kafka \| tail -50`; `kafka-consumer-groups.sh --bootstrap-server kafka:9092 --describe --group dq-notifications`; `docker compose logs worker` |
| Event tích tụ ở `pending` | Relay chết hoặc Change Stream lỗi | Kiểm tra log `[OutboxRelay]`; xác nhận `OUTBOX_CHANGE_STREAM_ENABLED=true` và replica set còn sống |
| Event kẹt ở `publishing` | Relay chết giữa chừng | Tự phục hồi sau 60s bằng polling; nếu vẫn kẹt, kiểm tra log relay |
| Job AI fail liên tục | **Engine suy luận** không sẵn sàng / timeout 180s / RAM đầy | `docker compose logs ai-engine \| tail -50` → kiểm tra model đã nạp xong; `docker stats` → xem RSS engine; `docker compose logs worker \| grep ai.jobFailed` |
| AI job không chạy (hàng đợi đầy) | RAM guard kích hoạt (RSS engine > 85% RAM) | Kiểm tra log `[AiRamGuard]`; giảm `AI_MAX_MODEL_LEN` hoặc dừng `ai-engine` khi không cần |
| Engine bị OOM-kill | Tổng RAM vượt 15 GB | `docker stats` → giảm `memory` của worker/api, hoặc dừng `ai-engine` khi không chạy phân tích |
| Realtime không hoạt động | Nginx thiếu WebSocket upgrade, hoặc Cloudflare Tunnel tắt WS | `curl -i -N -H "Connection: Upgrade" -H "Upgrade: websocket" ...` → phải trả `101 Switching Protocols`; kiểm tra config `proxy_set_header Upgrade` |
| Client không nhận được sự kiện realtime | Chưa vào đúng phòng (room) | Kiểm tra log gateway `join room`; xác nhận user có quyền xem project đó |
| Kafka consumer bị rebalance liên tục | `KAFKA_GROUP_INITIAL_REBALANCE_DELAY_MS` quá cao hoặc consumer chậm | Đặt `0`; kiểm tra `max.poll.interval.ms` của consumer AI (phải > 180s) |
| Thông báo không đến | `notifications_enabled = false` hoặc event chưa publish | Kiểm tra `user.notifications_enabled`; kiểm tra `outbox_event.status` cho event tương ứng |
| Upload thất bại 429 | Vượt quota workspace | Kiểm tra `workspace.storage_used_bytes` và `STORAGE_MAX_QUOTA_BYTES` |
| Lọc dữ liệu chậm | Sheet > 200.000 dòng | Trả `VALIDATION_ERROR` với `dataset_too_large_for_filtering` — cần giải pháp khác (Phần 8 mục 6.2 #1) |
| Lỗi 409 khi lưu | `version` không khớp | Client cần đọc lại resource; kiểm tra `expectedVersion` trong body |
| Email không gửi | `MAIL_ENABLED=false` hoặc SMTP lỗi | Kiểm tra `MAIL_ENABLED`; `docker compose logs worker \| grep email` |
| PDF tải 404 | `storage_key` sai hoặc file đã bị cleanup | Kiểm tra `RETENTION_REPORTS_DAYS`; xem log cleanup |
| MongoDB "not primary" | Đang kết nối Atlas M0 (không replica set) ở production | Lỗi cấu hình nghiêm trọng — sửa `DB_SUPPORTS_TRANSACTIONS` hoặc đổi sang M10 |

#### 3.11.2. Checklist khi sự cố

1. **Xác định phạm vi:** API, worker, hay cả hai?
2. **Kiểm tra health:** `curl /api/v1/health/ready` (api) và `curl :3001/health` (worker).
3. **Kiểm tra log 5 phút gần nhất:** `docker compose logs --since 5m api worker`.
4. **Kiểm tra dependency:** Atlas dashboard (MongoDB), Redis `info`, R2 (không cần).
5. **Kiểm tra outbox:** `db.outbox_event.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }])`.
6. **Kiểm tra Kafka:** `kafka-consumer-groups.sh --bootstrap-server kafka:9092 --list` — mọi consumer group phải có **lag = 0**; kiểm tra topic `dlq.dead-letter` có message mới không.
6b. **Kiểm tra RAM (v4):** `docker stats --no-stream` — tổng RSS không được vượt 90% RAM máy.
7. **Sửa** → xác nhận health OK → ghi log sự cố (thời điểm, triệu chứng, nguyên nhân, cách xử lý).
8. Nếu nguyên nhân chưa rõ hoặc lặp lại → ghi vào backlog kỹ thuật.

### 3.12. Bảo mật vận hành

| # | Quy tắc |
|---|---|
| 1 | VPS dùng **SSH key**, không mật khẩu. Tắt `PasswordAuthentication` |
| 2 | `ufw` chỉ mở port 22, 80, 443. MongoDB/Redis **không** mở port |
| 3 | Fail2ban cho SSH |
| 4 | Container chạy user không phải root |
| 5 | Image dùng tag cụ thể (`node:22-alpine`), không dùng `latest` |
| 6 | Cập nhật base image định kỳ (hằng tháng) |
| 7 | Secrets trong `.env` có `chmod 600`, không commit, không trong log |
| 8 | R2 bucket không public; R2 API token có quyền tối thiểu (chỉ 1 bucket) |
| 9 | Atlas IP allowlist giới hạn theo IP VPS |
| 10 | Database user có quyền tối thiểu — không phải `readWrite` trên toàn bộ cluster |
| 11 | Sao lưu `.env` vào vault hoặc máy khác có mã hoá — không lưu trong cùng VPS duy nhất |
| 12 | Kiểm tra `npm audit` trước mỗi deploy; cảnh báo nếu có CVE mức high/critical |
| 13 | Không log request body chứa `password`, `otp`, `refreshToken` (đã redact ở mục 3.7.3) |
| 14 | **v4:** Không publish port `ai-engine` (`:8000`) hay Kafka (`:9092`) ra host; `ufw` không mở |
| 15 | **v4:** Engine suy luận **bắt buộc** có `--api-key`; không chạy ở chế độ open |
| 16 | **v4:** File model phải có checksum SHA-256 khớp cấu hình — entrypoint từ chối nạp nếu lệch |
| 17 | **v4:** Access token trong query string của kết nối Socket.IO **không được** ghi vào access log — phải lọc ở Nginx và ở logger |
| 18 | **v4:** `models/` nằm ngoài repo, `chmod 644` cho file, thư mục không ghi được bởi user khác |

### 3.13. Đối chiếu với cấu hình hiện tại

| Biến hiện tại (`.env.example`) | Xử lý ở v1 |
|---|---|
| `PORT` | → `API_PORT` (đổi tên cho rõ) |
| `MONGODB_URI` | → `DB_URI` + `DB_NAME` tách riêng |
| `S3_*` (6 biến) | Giữ nguyên tên, thêm `STORAGE_DRIVER` để chọn `local`/`s3` |
| `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET` | Giữ |
| `JWT_ACCESS_EXPIRATION`, `JWT_REFRESH_EXPIRATION` | Giữ |
| `SALT_ROUNDS` | Giữ (bcrypt) |
| `DATA_ENCRYPTION_KEY` | Giữ |
| `GEMINI_API_KEY` | **Bỏ ở v4** — không còn API AI bên ngoài. Thay bằng `AI_INFERENCE_BASE_URL`, `AI_MODEL_*`, `AI_INFERENCE_API_KEY` |
| `SMTP_*` (5 biến) | Giữ, thêm `MAIL_ENABLED`, `SMTP_SECURE` |
| `CLOUDFLARE_TUNNEL_*` | Giữ — dùng tunnel, không mở port |
| `SSL_ENABLED`, `SSL_PORT`, `SSL_KEY_PATH`, `SSL_CERT_PATH` | Giữ — TLS terminate ở Nginx, không ở app |
| `NTFY_ENABLED`, `NTFY_BASE_URL`, `NTFY_TOPIC`, `NTFY_ACCESS_TOKEN` | **Bỏ** — không dùng ntfy; thay bằng email SMTP |
| `SOCKET_ENABLED` | **Bỏ** ở v3 (không có websocket trong danh mục) — **v4 khôi phục** dưới dạng nhóm `REALTIME_*` (Socket.IO cho realtime push) |
| *(chưa có)* | Thêm toàn bộ nhóm `REDIS_*`, `WORKER_*`, `RETENTION_*`, `RATE_LIMIT_*`, `LOG_LEVEL`, `DB_*`, `STORAGE_MAX_*` |
| *(chưa có — v4)* | Thêm nhóm `KAFKA_*`, `EMBEDDING_*`, `REALTIME_*`, `IMPORT_*`, và bổ sung `AI_*` mới (`AI_ENGINE`, `AI_MODEL_*`, `AI_INFERENCE_*`, `AI_MAX_CONCURRENCY`, `AI_RAG_*`, `AI_RAM_GUARD_PERCENT`, `AI_BENCHMARK_GATE_*`) |

**Ghi chú:** `STORAGE_MAX_QUOTA_BYTES` đã tồn tại trong code hiện tại nhưng chưa chốt phạm vi áp dụng — v1 chốt **theo workspace** (mục 3.6).

### 3.14. Quota dung lượng theo workspace

**Quyết định.** Quota tính theo **workspace**: `STORAGE_MAX_QUOTA_BYTES` (mặc định 500 MB) trên mỗi workspace.

**Cách tính:** `workspace.storage_used_bytes` được cập nhật khi:
- Upload dataset thành công → `+ file_size_bytes`
- Xoá dataset (soft delete) → **không** trừ ngay (file còn giữ 90 ngày để khôi phục)
- Job cleanup xoá cứng dataset → `- file_size_bytes`

**Quy tắc bắt buộc:**
1. Kiểm tra quota **trước** khi ghi file — từ chối ngay nếu vượt, không ghi rồi mới xoá (Phần 7 mục 3.8).
2. `storage_used_bytes` được cập nhật **trong cùng transaction** với việc tạo dataset.
3. Job cleanup phải **giảm** `storage_used_bytes` tương ứng khi xoá dataset cứng — nếu không, quota sẽ bị "giữ" mãi.
4. Nếu cần nới quota cho workspace cụ thể → sửa giá trị trong DB, không sửa biến môi trường toàn cục.

**Đánh đổi:** tính theo workspace có thể bị "vượt" tạm thời khi nhiều workspace cùng dùng chung storage của tổ chức. Chấp nhận — người dùng không thấy storage của workspace khác, và quản trị có thể nới quota khi cần.

### 3.15. Quy tắc kiểm thử vận hành

| # | Kiểm tra |
|---|---|
| O1 | Ứng dụng **refuse to start** khi thiếu biến môi trường bắt buộc — kiểm tra danh sách biến thiếu, không log giá trị |
| O2 | Ứng dụng **refuse to start** ở production nếu `DB_SUPPORTS_TRANSACTIONS` không phải `true` |
| O3 | Probe tự phát hiện chọn đúng tầng (đầy đủ / giả lập) theo khả năng replica set |
| O4 | Ở tầng giả lập, ghi outbox vẫn hoạt động và log cảnh báo `[DEGRADED_NO_TRANSACTION]` |
| O5 | `/health/live` trả 200 ngay cả khi MongoDB chết |
| O6 | `/health/ready` trả 503 khi MongoDB hoặc Redis lỗi |
| O7 | `/health/ready` không lộ connection string, stack trace hay tên host nội bộ |
| O8 | `/health/deep` báo đúng trạng thái AI provider và R2 |
| O9 | Log JSON hợp lệ — mỗi dòng parse được bằng `JSON.parse`, có `time`, `level`, `msg` |
| O10 | Không log giá trị cho các trường trong redact list — kiểm tra bằng test tự động |
| O11 | Không log giá trị ô dữ liệu ở bất kỳ mức log nào |
| O12 | `X-Request-Id` được trả về client và có trong log |
| O13 | Metrics snapshot đúng 1 giờ 1 lần, không chứa dữ liệu người dùng |
| O14 | Script backup exit code ≠ 0 khi `mongodump` thất bại |
| O15 | Quy trình restore được thử thành công ít nhất 1 lần trên staging (kiểm tra thủ công, ghi vào log deploy) |
| O16 | Deploy script dừng và báo lỗi khi thiếu biến bắt buộc, **trước** khi restart container |
| O17 | Migration chạy lại 2 lần cho kết quả giống nhau (idempotent) |
| O18 | **v4:** Worker dừng → start lại → không mất message (Kafka lưu bền vững, offset chưa commit) |
| O19 | Container chạy bằng user không phải root (`docker inspect` → `Config.User` ≠ `root`/`""`) |
| O20 | Image không chứa file `.env` hay secret (`docker history` không có layer chứa secret) |
| O21 | Redis vượt 80% bộ nhớ → cảnh báo được phát ra |
| O22 | `outbox.oldestPendingAgeSeconds` vượt 300 → cảnh báo được phát ra |
| O23 | Job cleanup giảm đúng `workspace.storage_used_bytes` |
| O24 | Upload vượt quota bị từ chối **trước** khi ghi file — không còn file rác trong R2 |
| O25 | Chế độ cutover dừng **cả** `api` và `worker` — không chỉ `api` |
| O26 | **v4:** Message Kafka đang chờ vẫn còn nguyên sau khi dừng worker và bật lại |
| O27 | Deploy script với `--mode=migration` chạy backup trước, và **dừng** nếu backup thất bại |
| O28 | `MIGRATION_CONFIRM=yes` là bắt buộc để script migration ghi dữ liệu |
| O29 | **v4:** Không container nào publish port engine AI (`:8000`) hay Kafka (`:9092`) ra host |
| O30 | **v4:** Checksum SHA-256 của file model khớp `AI_MODEL_PRIMARY_SHA256` — entrypoint từ chối nạp nếu lệch |
| O31 | **v4:** Tổng RSS của tất cả container ≤ 90% RAM máy |
| O32 | **v4:** Tất cả consumer group Kafka có **lag = 0** sau khi hệ thống ổn định; topic `dlq.dead-letter` không có message mới |
| O33 | **v4:** Engine suy luận trả `200` ở `/health` sau khi nạp model; nếu không, API vẫn phục vụ được phần không-AI |
| O34 | **v4:** Upload file không phải `.csv` bị từ chối với `UNSUPPORTED_FILE_TYPE` |
| O35 | **v4:** Cursor pagination: không có lời gọi `countDocuments` trong mã nguồn (kiểm tra tĩnh) |

## 4. Đầu vào và đầu ra

**Đầu vào**
- Phần 4 v2 — monorepo `apps/api` + `apps/worker` + `packages/*`, cấu trúc thư mục vận hành.
- Phần 6 v4 — TTL token/session, rate-limit Redis, 8 hành động audit.
- Phần 7 v2 — `/api/v1` prefix, quy ước response/lỗi, `X-Request-Id`.
- Phần 8 v4 — **21 collection**, yêu cầu replica set cho transaction, layout storage, retention, ràng buộc insert-only, 2 collection feedback.
- Phần 12 v4 — **model AI cục bộ** (`Qwen3-14B`/`Qwen3-8B`), ràng buộc RAM, timeout 180s, cơ chế học lại T1.
- Phần 9 v3 — **Kafka** (5 topic, 6 consumer group, DLQ), outbox relay 2 kênh, **Socket.IO gateway**, quy tắc idempotency.
- Phần 11 (chưa có) — quy tắc migration `up`/`down`/idempotent được kế hoạch ở mục 3.10.4.
- Mã nguồn hiện tại — `src/backend/.env.example` (39 biến), cấu hình Cloudflare Tunnel, `S3_*` cho R2, `MONGODB_URI` đang trỏ Atlas.
- Quyết định của người dùng — 8 lựa chọn vận hành (2026-11-05).

**Đầu ra**
- 9 quyết định vận hành nền tảng.
- Sơ đồ kiến trúc triển khai (**v4:** VPS + api/worker + **Kafka** + **ai-engine** + Redis + Atlas + R2 + SMTP — **không còn Gemini**).
- **Bảng ~120 biến môi trường** chia **16 nhóm** (`APP_`, `DB_`, `REDIS_`, `KAFKA_`, `STORAGE_`, `AUTH_`, `AI_`, `EMBEDDING_`, `REALTIME_`, `MAIL_`, `RATE_LIMIT_`, `WORKER_`, `IMPORT_`, `MIGRATION_`, `RETENTION_`, `LOG_`), có đánh dấu bắt buộc/tùy chọn và mặc định.
- Cơ chế 3 tầng fallback cho môi trường không có replica set (Atlas M0) — bao gồm quy tắc refuse-to-start ở production.
- `docker-compose.yml` production + `docker-compose.dev.yml` override, kèm 9 quyết định thiết kế và giải thích.
- Dockerfile multi-stage 2 stage cho api và worker, kèm 6 quy tắc bắt buộc.
- 3 cấp độ health check (live/ready/deep) + mẫu response + 5 quy tắc.
- Định dạng log JSON + danh mục 22 sự kiện log + danh sách redact + 4 quy tắc dữ liệu nhạy cảm.
- Metrics không cần Prometheus: bảng số liệu hourly + 8 ngưỡng cảnh báo + cơ chế cảnh báo bằng script cron.
- Chiến lược backup 2 tầng (Atlas Continuous Backup + snapshot R2) + script backup/restore + 5 điểm kiểm tra sau restore + cảnh báo về M0 không có backup.
- Quy trình deploy 7 bước + 3 mức rollback + 7 quy tắc migration.
- Bảng 12 sự cố thường gặp + checklist 8 bước.
- 13 quy tắc bảo mật vận hành.
- Đối chiếu với `.env.example` hiện tại (giữ 20, bỏ 6, thêm ~70).
- Quota theo workspace — 4 quy tắc cập nhật `storage_used_bytes`.
- 24 quy tắc kiểm thử vận hành O1–O24.

## 5. Điều kiện hoàn tất phần này

Cấu hình, quy trình vận hành và quan sát đã rõ ràng; các rủi ro vận hành đã được ghi nhận kèm cách xử lý.

**Trạng thái v2:** 9 quyết định vận hành đã chốt (không đổi). Hạ tầng, cấu hình, health check, logging, metrics, backup, deploy, rollback và xử lý sự cố đã thiết kế chi tiết. Bổ sung 4 quy tắc vận hành liên quan đến cutover migration.

**Thay đổi v1 → v2 (2026-11-05):** đồng bộ với **Phần 11 v1** (chốt xong sau Phần 10 v1):
1. **Ngoại lệ cutover** (mục 3.10.2.1) — deploy thường dừng `api`/giữ `worker`, nhưng cutover migration phải dừng **cả 2** để tránh worker ghi thêm vào collection cũ trong lúc migrate.
2. **Backup bắt buộc cho cutover** (mục 3.9.5) — siết lại từ "khuyến nghị" ở v1; kèm quy trình 3 bước và 5 quy tắc.
3. **Nhóm biến `MIGRATION_*`** (mục 3.4.2).
4. **Quy tắc O25–O28** — tổng số quy tắc kiểm thử 24 → 28.

## 6. Câu hỏi và phụ thuộc còn mở

### 6.1. Đã chốt ở v1

| # | Câu hỏi | Kết quả |
|---|---|---|
| 1 | Nền tảng triển khai | **Docker Compose trên VPS** (mục 3.2) |
| 2 | Stack quan sát | **Tối giản** — log JSON + health endpoint, không Prometheus/Grafana/Sentry (mục 3.8) |
| 3 | Định dạng log | **JSON structured** ra stdout (mục 3.7) |
| 4 | Chiến lược sao lưu | **Atlas M0 cho dev + M10 cho production**; M0 không có backup → cần seed script (mục 3.9) |
| 5 | Phạm vi quota | **Theo workspace** (mục 3.14) |
| 6 | Dead-letter queue | **v4: CÓ** — topic Kafka `dlq.dead-letter` (đảo ngược quyết định của v3; mục 3.1 #6) |
| 7 | Quản lý secret | **`.env` file**, `chmod 600` ở production (mục 3.4.4) |
| 8 | Redis | **v4: Một instance** cho cache + Socket.IO adapter + rate-limit (BullMQ đã bị gỡ; mục 3.5.2) |
| 9 | R2 | Giữ nguyên cấu hình `S3_*` hiện có; bật versioning (mục 3.9.4) |
| 10 | **v4** Hạ tầng sự kiện | **Kafka** KRaft single-node, 5 topic, 6 consumer group, có DLQ (mục 3.5.1) |
| 11 | **v4** AI | Suy luận **nội bộ** bằng `vLLM` (prod) / `Ollama` (dev); model `Qwen3-14B` + `Qwen3-8B`; **không** API bên ngoài |
| 12 | **v4** Realtime | **Socket.IO** gateway trong `api`, adapter Redis cho multi-instance |
| 13 | **v4** Định dạng đầu vào | Chỉ `.csv` — `IMPORT_ALLOWED_EXTENSIONS=csv` |

### 6.2. Đã chốt v6 (2026-11-07) — xem ghi chú cuối mục. Câu hỏi gốc:

### 6.2-gốc. Còn mở

| # | Câu hỏi | Ảnh hưởng | Nơi xử lý |
|---|---|---|---|
| 1 | ~~CI/CD GitHub Actions hay thủ công?~~ **Đã chốt v6: GIỮ THỦ CÔNG 6 bước, chưa CI/CD** | Đã chốt | Phần 14 v7 |
| 2 | ~~Số instance worker 1 hay 2?~~ **Đã chốt v6: 1 WORKER, concurrency 1 cho AI** (RAM hạn chế) | Đã chốt | docker-compose |
| 3 | ~~Ngưỡng cảnh báo~~ **Đã chốt v6: GIỮ MẶC ĐỊNH, chỉnh khi có tải thật** | Đã chốt | — |
| 4 | ~~Rotation secret tự động hay thủ công?~~ **Đã chốt v6: TỰ ĐỘNG THEO LỊCH (cron) + thủ công khi nghi rò rỉ** | Đã chốt | Phần 14 v7 |
| 5 | ~~Trang quản trị vận hành~~ **Đã chốt v6: CHỈ API `GET /admin/*`, không UI** | Đã chốt | Phần 7 v6 |

**Phụ thuộc cứng:**
- Câu hỏi 2 ảnh hưởng cấu hình `docker-compose.yml` production.
- Câu hỏi 1 ảnh hưởng thiết kế `deploy/scripts/deploy.sh` — nếu có CI thì script phải chạy được không tương tác.
- Phần 11 phải tuân thủ 7 quy tắc migration ở mục 3.10.4 (`up`/`down`, idempotent, không xoá dữ liệu cũ).

### 6.3. Phụ thuộc bên ngoài

- **MongoDB Atlas** — M10 cho production/staging (replica set bắt buộc), M0 cho dev.
- **Cloudflare R2** — bucket theo môi trường, versioning bật, egress $0.
- **Redis 7** — cache + **Socket.IO adapter** + rate-limit, AOF bật, `noeviction`.
- **Nginx/Caddy** — TLS termination + reverse proxy (chạy ngoài compose trên host).
- **Cloudflare Tunnel** — đường vào không cần mở port.
- **SMTP** — cảnh báo vận hành và email hệ thống.
- **Engine suy luận nội bộ** — `ai-engine` (vLLM/Ollama), không có API key bên ngoài. Cần file model cục bộ + checksum SHA-256.
- **cron** — backup 03:00, cleanup do worker, check-alerts mỗi 5 phút.


### 6.2b. Quyết định chốt v6 (2026-11-07)

- **Health:** `GET /health` (liveness, không auth) + `GET /health/ready` (Mongo replica set + Redis + ai-engine + Kafka) **ngoài** `/api/v1` cho LB/monitoring.
- **Mongo:** dùng **Atlas M0 free cho dev nhanh** (theo quyết định người dùng); test/staging dùng **single-node replica set local bằng Docker** (`mongod --replSet rs0`, free hoàn toàn, đủ transaction outbox). Không dùng Atlas M0 cho test (oplog ngắn, backup hạn chế).
- **Redis: BẮT BUỘC** cùng Mongo (cache + rate-limit + Socket.IO adapter); thiếu Redis → API vẫn khởi động nhưng cảnh báo, realtime/rate-limit suy giảm.
- **Retention: KHÔNG xóa tự động** — giới hạn bằng **quota workspace**; TTL chỉ cho session/token theo Phần 6 v6.
- **Guard:** RAM khả dụng < 12GB từ chối khởi động engine 14B; disk model ≥ 40GB; kiểm tra AVX2/AVX512 lúc deploy (Phần 12 v8 §6.3).

### 6.2c. Trạng thái triển khai (v6, cập nhật 2026-11-07)

Đã hiện thực hoá:

| Quyết định | File hiện thực | Ghi chú |
|---|---|---|
| `GET /health` (liveness) + `GET /health/ready` (readiness), **ngoài `/api/v1`** | `src/backend/src/app.controller.ts`, `src/backend/src/main.ts` | `health/ready` trả **503** khi Mongo chưa kết nối; không lộ stack trace |
| Redis **bắt buộc** (cache + rate-limit + Socket.IO adapter) | `src/backend/src/shared/config/env.validation.ts` (`REDIS_URL`, `REDIS_KEY_PREFIX`) | API vẫn khởi động nếu thiếu Redis nhưng cảnh báo |
| Mongo single-node replica set local (miễn phí) | `deploy/docker-compose.dev.yml`, `deploy/mongo/init-replica-set.js` | `mongod --replSet rs0` — đủ transaction cho outbox |
| Nhóm biến `AI_*` đầy đủ (model, checksum, RAM guard, RAG, concurrency=1) | `src/backend/src/shared/config/env.validation.ts`, `.env.example` | `AI_MAX_CONCURRENCY` cố định = 1; `AI_MASK_PII_ENABLED` mặc định `true` |
| Heartbeat/lease AI worker — timeout 10 phút → `skipped` | `src/backend/src/modules/analysis/ai/ai-worker.service.ts`, `analysis.repository.ts` | `skipStaleJobs()` + `heartbeatJob()`; `AiJobSchema` có `heartbeat_at`/`lease_expires_at` |
| Retry AI theo cấu hình | `ai-worker.service.ts`, `analysis.service.ts` | `AI_MAX_RETRIES` (mặc định 2) → tổng 3 lượt; job hết lượt → `failed` |
| **Pre-commit `husky`** chạy `test:unit` + `test:arch` | `.husky/pre-commit`, `src/backend/package.json` | `core.hooksPath = .husky`; `test:arch` = zero-any + guard-coverage + zod-openapi |


## 7. Prompting log và lịch sử thay đổi

- **Yêu cầu:** Người dùng yêu cầu liệt kê toàn bộ các phần theo thứ tự thực hiện, tạo sẵn file v1, lần lượt hoàn thiện vòng đầu rồi tạo v2 khi có thay đổi tiếp theo.
- **v1 / 2026-11-02:** Tạo khung phần 10 / Chuẩn bị thảo luận tuần tự / Chỉ tạo tài liệu, chưa thực thi thay đổi backend hoặc dữ liệu.
- **v4 / 2026-11-05:** Áp dụng 4 quyết định hạ tầng (Kafka + DLQ, Socket.IO, AI nội bộ, chỉ `.csv`); thêm nhóm biến `KAFKA_*`, `AI_INFERENCE_*`, `EMBEDDING_*`, `REALTIME_*`, `IMPORT_*`; thêm mục 3.5.5, 3.6.2, 3.16, 3.17; thêm quy tắc O29–O35 (28 → 35).
- **v2 / 2026-11-05:** Đồng bộ với Phần 11 v1. (1) Thêm mục 3.10.2.1 — ngoại lệ cutover: dừng cả `api` và `worker` (vì worker cũ ghi vào collection cũ trong lúc migrate gây sai lệch số lượng); job BullMQ vẫn an toàn nhờ Redis `appendonly yes`; deploy script có `--mode=migration`. (2) Thêm mục 3.9.5 — backup **bắt buộc** cho cutover (3 bước, 5 quy tắc), siết lại so với v1. (3) Thêm nhóm biến `MIGRATION_*`. (4) Thêm quy tắc O25–O28 (tổng 24 → 28).
- **v3 / 2026-11-05:** Đồng bộ theo quyết định **dữ liệu bất biến (chỉ đọc)**: job cleanup không xoá bản ghi `dataset_record` (insert-only, không soft delete); đối chiếu lại số liệu 21 collection / 77 tính năng / 80 endpoint; cập nhật tham chiếu Phần 6 v4, 7 v2, 8 v3, 9 v2, 11 v2.
- **v1 / 2026-11-05:** Hoàn thiện vòng đầu. Chốt 9 quyết định vận hành; bảng ~90 biến môi trường trong 11 nhóm; cơ chế 3 tầng fallback cho Atlas M0 (không replica set) kèm quy tắc refuse-to-start ở production; `docker-compose.yml` + override dev + Dockerfile multi-stage; 3 cấp độ health check; log JSON với danh mục 22 sự kiện và danh sách redact; metrics không cần Prometheus (bảng hourly + 8 ngưỡng cảnh báo + script cron); backup 2 tầng Atlas + R2 kèm cảnh báo M0 không có backup; quy trình deploy 7 bước + 3 mức rollback; bảng 12 sự cố + checklist 8 bước; 13 quy tắc bảo mật vận hành; đối chiếu `.env.example` hiện tại; quota theo workspace; 24 quy tắc kiểm thử O1–O24.
