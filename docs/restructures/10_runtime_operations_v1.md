# 10. Cấu hình, vận hành và quan sát

- **Version:** v1
- **Ngày tạo:** 2026-11-02
- **Cập nhật gần nhất:** 2026-11-05
- **Trạng thái:** Đã chốt 9 quyết định vận hành (Docker Compose trên VPS, observability tối giản, log JSON, Atlas M0 dev + M10 prod, quota theo workspace, không DLQ, `.env` file, Redis 1 instance) và thiết kế chi tiết **biến môi trường, docker-compose, health check, structured logging, metrics, backup/restore, quy trình deploy, xử lý sự cố**. Còn mở ở mục 6.2.
- **Giai đoạn:** Tech solution
- **Thứ tự thực hiện:** Phần 10; sử dụng kết quả đã xác nhận của các phần trước.
- **Quan hệ với các phần khác:** vận hành các quyết định của Phần 4 v2 (monorepo, `apps/api` + `apps/worker`), Phần 6 v3 (TTL token, rate-limit Redis), Phần 7 v1 (quy ước endpoint, `/api/v1`), Phần 8 v2 (22 collection, replica set bắt buộc cho transaction), Phần 9 v1 (BullMQ, outbox relay, 6 loại job).

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
| 6 | **Không** dead-letter queue riêng | Dựa vào `removeOnFail` + `outbox_event.status='failed'` + log |
| 7 | Secret: **`.env` file** (gitignored) | Chuẩn, đơn giản |
| 8 | Redis: **một instance** cho BullMQ + rate-limit | Đủ cho quy mô hiện tại |
| 9 | R2: giữ nguyên cấu hình hiện có (`S3_*`) | Egress $0 — rẻ hơn S3 |

### 3.2. Kiến trúc triển khai

```
┌───────────────────────────────────────────────────────────────┐
│                    VPS (1 máy, Ubuntu 22.04)                    │
│                                                                │
│  ┌──────────────────────┐      ┌────────────────────────────┐  │
│  │  Cloudflare Tunnel   │      │      Docker Compose        │  │
│  │  (tunnel → origin)   │─────►│                            │  │
│  └──────────────────────┘      │  ┌────────┐ ┌──────────┐  │  │
│                                │  │  api   │ │  worker  │  │  │
│  ┌──────────────────┐          │  │ :3000  │ │ (no HTTP)│  │  │
│  │  Nginx/Caddy     │◄─────────┤  └────┬───┘ └────┬─────┘  │  │
│  │  (TLS + static)  │  TLS    │       │          │        │  │
│  └──────────────────┘          │       └────┬─────┘        │  │
│                                │            │              │  │
│                                │  ┌─────────┴─────────┐    │  │
│                                │  │      Redis 7      │    │  │
│                                │  │ BullMQ + rate-limit│   │  │
│                                │  └───────────────────┘    │  │
│                                └────────────┬──────────────┘  │
└─────────────────────────────────────────────┼─────────────────┘
                                              │
                    ┌─────────────────────────┼─────────────────────────┐
                    │                         │                         │
            ┌───────▼────────┐      ┌─────────▼─────────┐     ┌────────▼────────┐
            │ MongoDB Atlas  │      │  Cloudflare R2    │     │  Gemini API     │
            │ M0 (dev)       │      │  file gốc, PDF,    │     │  phân tích AI   │
            │ M10 (prod)     │      │  tệp đính kèm      │     │                 │
            └────────────────┘      └───────────────────┘     └─────────────────┘
            ┌────────────────┐
            │ SMTP           │
            └────────────────┘
```

**Quyết định về Nginx/Caddy:**

| Hành phần | Vai trò |
|---|---|
| Cloudflare Tunnel | Đưa traffic từ Internet vào VPS **không cần mở port** — giảm bề mặt tấn công |
| Nginx/Caddy | TLS termination + phục vụ frontend tĩnh (khi có frontend) + reverse proxy → `api:3000` |

**Ghi chú:** dự án hiện đã có `CLOUDFLARE_TUNNEL_ENABLED` trong `.env` (xem `src/backend/.env.example`) → giữ nguyên cách truy cập qua tunnel, **không** mở port trực tiếp ra Internet.

**Quy tắc bắt buộc:**
1. **Không** expose port MongoDB hay Redis ra Internet — chỉ trong mạng nội bộ Docker.
2. `api` chỉ lắng nghe trong network nội bộ compose; Nginx là cổng vào duy nhất từ Internet.
3. `worker` **không** có port HTTP công khai — chỉ port health check nội bộ.
4. Tài khoản MongoDB Atlas dùng **IP allowlist** giới hạn theo IP của VPS.
5. R2 bucket **không public** (Phần 8 mục 3.10) — mọi lần tải đi qua API có kiểm tra quyền.

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
│   └── scripts/
│       ├── backup.sh
│       ├── restore.sh
│       └── migrate.ts             # chạy ở Phần 11
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
| 7 | Nhóm biến theo prefix: `APP_`, `DB_`, `REDIS_`, `STORAGE_`, `AUTH_`, `AI_`, `MAIL_`, `LOG_`, `RATE_LIMIT_`, `WORKER_`, `RETENTION_` |

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
| `REDIS_URL` | ✅ | `redis://localhost:6379` | BullMQ + rate-limit |
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
| `JWT_ACCESS_EXPIRATION` | ✅ | `15m` | TTL access token (Phần 6 v3) |
| `JWT_REFRESH_SECRET` | ✅ | — | ≥ 32 ký tự |
| `JWT_REFRESH_EXPIRATION` | ✅ | `7d` | TTL refresh token |
| `SESSION_TTL_DAYS` | ❌ | `30` | TTL session (Phần 6 v3) |
| `DATA_ENCRYPTION_KEY` | ❌ | — | 64 hex — AES-256-GCM cho dữ liệu nhạy cảm |
| `GOOGLE_CLIENT_ID` | ❌ | — | Bật `AUTH-03` khi có |
| `GOOGLE_CLIENT_SECRET` | ❌ | — | |
| `GOOGLE_CALLBACK_URL` | ❌ | — | |

**Nhóm `AI_`:**

| Biến | Bắt buộc | Mặc định | Mô tả |
|---|---|---|---|
| `AI_PROVIDER` | ✅ | `gemini` | `gemini` \| `disabled` |
| `GEMINI_API_KEY` | ❌ | — | Bắt buộc khi `AI_PROVIDER=gemini` |
| `AI_TIMEOUT_MS` | ❌ | `60000` | Timeout mỗi lượt gọi (Phần 12 mục 3.9) |
| `AI_MAX_RETRIES` | ❌ | `2` | Số lần retry |
| `AI_MAX_EVIDENCE_PER_COLUMN` | ❌ | `20` | Số ô lỗi/cột gửi AI (Phần 12 mục 3.10) |
| `AI_MAX_PAYLOAD_BYTES` | ❌ | `2000000` | Ngưỡng payload AI |
| `AI_MASK_PII_ENABLED` | ❌ | `true` | **Không được tắt ở production** |

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

**Nhóm `RATE_LIMIT_`** (Phần 6 v3 mục 3.9):

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
| `WORKER_CONCURRENCY` | `5` | Số job song song |
| `WORKER_OUTBOX_POLL_INTERVAL_MS` | `30000` | Chu kỳ polling fallback |
| `WORKER_OUTBOX_CLAIM_LEASE_SECONDS` | `60` | Lease của trạng thái `publishing` |
| `WORKER_INBOX_LEASE_SECONDS` | `30` | Lease của `processed_event` |
| `WORKER_EVENT_JOB_TIMEOUT_MS` | `10000` | Timeout job domain-events |
| `WORKER_AI_JOB_TIMEOUT_MS` | `120000` | Timeout job AI |
| `WORKER_REPORT_JOB_TIMEOUT_MS` | `60000` | Timeout job PDF |
| `WORKER_CLEANUP_JOB_TIMEOUT_MS` | `300000` | Timeout job cleanup |
| `WORKER_CLEANUP_CRON` | `0 0 17 * * *` | 02:00 giờ VN |
| `OUTBOX_CHANGE_STREAM_ENABLED` | `true` | Tắt ở môi trường không có replica set |

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

  redis:
    image: redis:7-alpine
    restart: unless-stopped
    command: >
      redis-server
      --appendonly yes
      --appendfsync everysec
      --maxmemory 512mb
      --maxmemory-policy noeviction
    volumes:
      - redis-data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 3s
      retries: 5

volumes:
  redis-data:
```

#### 3.5.2. Điểm thiết kế đáng chú ý

| # | Quyết định | Lý do |
|---|---|---|
| 1 | `redis --maxmemory 512mb --maxmemory-policy noeviction` | `noeviction` thay vì `allkeys-lru` — **không được** xoá job BullMQ đang chờ. Nếu đầy, BullMQ báo lỗi rõ ràng thay vì âm thầm mất job |
| 2 | `redis --appendonly yes` | AOF bật — job không mất khi container restart |
| 3 | `depends_on: condition: service_healthy` | API/worker chỉ khởi động khi Redis sẵn sàng — tránh crash loop |
| 4 | `restart: unless-stopped` | Tự khởi động lại sau crash hoặc reboot VPS |
| 5 | `expose` thay vì `ports` | Không expose trực tiếp ra host — Nginx là cổng vào duy nhất |
| 6 | `memory: 1G` cho api, `2G` cho worker | Worker xử lý lọc dataset trong JS (Phần 8 mục 3.6.3) + phân tích thống kê — cần nhiều RAM hơn |
| 7 | `start_period: 40s` | Container được tính là "khỏe" sau 40s — tránh restart loop khi app khởi động chậm (kết nối Atlas, probe transaction) |
| 8 | **Không** có service MongoDB | Dùng Atlas — không cần container DB |
| 9 | **Không** có service Nginx trong compose | Nginx chạy trên host (ngoài compose) để tách lớp TLS khỏi app stack |

**Đánh đổi:** `noeviction` + `maxmemory 512mb` nghĩa là khi Redis đầy, BullMQ **ghi job thất bại** thay vì xoá job cũ. Đây là hành vi đúng — mất job cũ còn tệ hơn là báo lỗi rõ ràng. Cần cảnh báo khi Redis vượt 80%.

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
    ports:
      - "3001:3001"
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
| `GET /api/v1/health/deep` | Thêm: kiểm tra R2 (HEAD bucket), kiểm tra AI provider | Chẩn đoán thủ công, không dùng cho probe tự động |

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
5. `worker` có `/health` riêng trên port 3001 — kiểm tra BullMQ worker đang chạy (heartbeat gần nhất < 60 giây).

#### 3.6.2. Kiểm tra sẵn sàng theo vai trò

| Service | Check đầu tiên | Hành vi khi lỗi |
|---|---|---|
| `api` | MongoDB + Redis | 503, Nginx cắt traffic |
| `worker` | Redis + heartbeat job gần đây | 503, BullMQ không nhận job mới |

**Ghi chú quan trọng:** `worker` chỉ cần Redis + MongoDB để **chạy**; nếu AI provider lỗi thì job AI fail nhưng hệ thống vẫn phục vụ được phần khác. Vì vậy `/health` của worker **không** kiểm tra AI provider — kiểm tra AI ở `/health/deep`.

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
| Import dataset hoàn tất | `info` | `datasetId`, `sheetCount`, `totalRows`, `durationMs` |
| Chạy phân tích | `info` | `runId`, `projectId`, `inputFingerprint` |
| Gọi AI | `info` | `jobId`, `provider`, `promptTokens`, `responseTokens`, `durationMs` |
| **Gọi AI — che PII** | `info` | `jobId`, `maskedColumns`, `droppedSamples`, `sampleCount` — **không** log giá trị ô |
| AI thất bại | `error` | `jobId`, `errorCode`, `attempt`, `retryable` |
| Sinh PDF | `info` | `reportId`, `projectId`, `sizeBytes`, `durationMs` |
| Publish outbox | `debug` | `eventId`, `eventType` |
| Consumer inbox | `debug` | `consumerName`, `eventId`, `outcome` |
| Job BullMQ fail | `error` | `queue`, `jobName`, `attemptsMade`, `errorCode` |
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
| `jobs.aiFailed` (1 giờ) | > 20% tổng AI job | Cảnh báo — Gemini có vấn đề |
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
3. Job cleanup xoá **phiên bản hiện tại**; phiên bản cũ của R2 tự hết hạn theo lifecycle rule riêng (nếu có).

### 3.10. Quy trình triển khai

#### 3.10.1. Môi trường

| Môi trường | Database | Storage | Ai | Ai đặt ở đâu |
|---|---|---|---|---|
| Local | Atlas M0 hoặc Mongo local | `local` | `disabled` | Máy dev |
| Dev | Atlas M0 | `local` | `disabled` | VPS dev |
| Staging | Atlas M10 (riêng) | R2 bucket riêng | `gemini` | VPS staging |
| Production | Atlas M10 | R2 bucket production | `gemini` | VPS production |

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
| Worker không xử lý event | Redis đầy hoặc worker crash | `redis-cli info memory` → nếu `used_memory > 512mb`, kiểm tra job bị kẹt; `docker compose logs worker` |
| Event tích tụ ở `pending` | Relay chết hoặc Change Stream lỗi | Kiểm tra log `[OutboxRelay]`; xác nhận `OUTBOX_CHANGE_STREAM_ENABLED=true` và replica set còn sống |
| Event kẹt ở `publishing` | Relay chết giữa chừng | Tự phục hồi sau 60s bằng polling; nếu vẫn kẹt, kiểm tra log relay |
| Job AI fail liên tục | Gemini lỗi / hết quota | `docker compose logs worker \| grep ai.jobFailed` → kiểm tra `GEMINI_API_KEY`, quota |
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
6. **Kiểm tra BullMQ:** `redis-cli llen bull:domain-events:wait` — phải bằng 0.
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
| `GEMINI_API_KEY` | Giữ, thêm nhóm `AI_*` |
| `SMTP_*` (5 biến) | Giữ, thêm `MAIL_ENABLED`, `SMTP_SECURE` |
| `CLOUDFLARE_TUNNEL_*` | Giữ — dùng tunnel, không mở port |
| `SSL_ENABLED`, `SSL_PORT`, `SSL_KEY_PATH`, `SSL_CERT_PATH` | Giữ — TLS terminate ở Nginx, không ở app |
| `NTFY_ENABLED`, `NTFY_BASE_URL`, `NTFY_TOPIC`, `NTFY_ACCESS_TOKEN` | **Bỏ** — không dùng ntfy; thay bằng email SMTP |
| `SOCKET_ENABLED` | **Bỏ** — không có websocket trong 84 tính năng |
| *(chưa có)* | Thêm toàn bộ nhóm `REDIS_*`, `WORKER_*`, `RETENTION_*`, `RATE_LIMIT_*`, `LOG_LEVEL`, `DB_*`, `STORAGE_MAX_*` |

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
| O18 | Worker dừng → start lại → không mất job (Redis AOF bật, BullMQ job còn trong hàng đợi) |
| O19 | Container chạy bằng user không phải root (`docker inspect` → `Config.User` ≠ `root`/`""`) |
| O20 | Image không chứa file `.env` hay secret (`docker history` không có layer chứa secret) |
| O21 | Redis vượt 80% bộ nhớ → cảnh báo được phát ra |
| O22 | `outbox.oldestPendingAgeSeconds` vượt 300 → cảnh báo được phát ra |
| O23 | Job cleanup giảm đúng `workspace.storage_used_bytes` |
| O24 | Upload vượt quota bị từ chối **trước** khi ghi file — không còn file rác trong R2 |

## 4. Đầu vào và đầu ra

**Đầu vào**
- Phần 4 v2 — monorepo `apps/api` + `apps/worker` + `packages/*`, cấu trúc thư mục vận hành.
- Phần 6 v3 — TTL token/session, rate-limit Redis, 8 hành động audit.
- Phần 7 v1 — `/api/v1` prefix, quy ước response/lỗi, `X-Request-Id`.
- Phần 8 v2 — 22 collection, yêu cầu replica set cho transaction, layout storage, retention.
- Phần 9 v1 — BullMQ, outbox relay 2 kênh, 6 loại job, 7 trường hợp phục hồi, quy tắc idempotency.
- Phần 11 (chưa có) — quy tắc migration `up`/`down`/idempotent được kế hoạch ở mục 3.10.4.
- Mã nguồn hiện tại — `src/backend/.env.example` (39 biến), cấu hình Cloudflare Tunnel, `S3_*` cho R2, `MONGODB_URI` đang trỏ Atlas.
- Quyết định của người dùng — 8 lựa chọn vận hành (2026-11-05).

**Đầu ra**
- 9 quyết định vận hành nền tảng.
- Sơ đồ kiến trúc triển khai (VPS + 2 container + Redis + Atlas + R2 + Gemini + SMTP).
- **Bảng ~90 biến môi trường** chia 11 nhóm, có đánh dấu bắt buộc/tùy chọn và mặc định.
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

**Trạng thái v1:** 9 quyết định vận hành đã chốt. Hạ tầng, cấu hình, health check, logging, metrics, backup, deploy, rollback và xử lý sự cố đã thiết kế chi tiết. Còn 5 câu hỏi mở tại mục 6.2.

## 6. Câu hỏi và phụ thuộc còn mở

### 6.1. Đã chốt ở v1

| # | Câu hỏi | Kết quả |
|---|---|---|
| 1 | Nền tảng triển khai | **Docker Compose trên VPS** (mục 3.2) |
| 2 | Stack quan sát | **Tối giản** — log JSON + health endpoint, không Prometheus/Grafana/Sentry (mục 3.8) |
| 3 | Định dạng log | **JSON structured** ra stdout (mục 3.7) |
| 4 | Chiến lược sao lưu | **Atlas M0 cho dev + M10 cho production**; M0 không có backup → cần seed script (mục 3.9) |
| 5 | Phạm vi quota | **Theo workspace** (mục 3.14) |
| 6 | Dead-letter queue | **Không** — dựa vào `removeOnFail` + `outbox_event.status='failed'` + log (mục 3.1 #6) |
| 7 | Quản lý secret | **`.env` file**, `chmod 600` ở production (mục 3.4.4) |
| 8 | Redis | **Một instance** cho BullMQ + rate-limit (mục 3.5.2) |
| 9 | R2 | Giữ nguyên cấu hình `S3_*` hiện có; bật versioning (mục 3.9.4) |

### 6.2. Còn mở

| # | Câu hỏi | Ảnh hưởng | Nơi xử lý |
|---|---|---|---|
| 1 | Có cần **CI/CD** (GitHub Actions) chạy test + build + deploy, hay giữ quy trình thủ công? Hiện quy trình thủ công 6 bước ở mục 3.10.2 | Tốc độ deploy, chất lượng | Phần 14 |
| 2 | **Số instance worker** ở production — 1 hay 2? Concurrency hiện đặt 5 | Chi phí RAM, độ trễ AI | Phần 10 (v2) khi có dữ liệu thực tế |
| 3 | Ngưỡng cảnh báo ở mục 3.8.2 có phù hợp không, hay cần chỉnh theo tải thực tế? | Vận hành | Phần 10 (v2) |
| 4 | Có cần **rotation secret** tự động theo lịch, hay chỉ thủ công khi nghi ngờ rò rỉ? | Bảo mật | Phần 14 |
| 5 | Có cần thêm **trang quản trị vận hành** (UI xem outbox kẹt, job fail, số liệu) không? | Vận hành | Phần 14 — có thể dùng chính API `GET /admin/*` |

**Phụ thuộc cứng:**
- Câu hỏi 2 ảnh hưởng cấu hình `docker-compose.yml` production.
- Câu hỏi 1 ảnh hưởng thiết kế `deploy/scripts/deploy.sh` — nếu có CI thì script phải chạy được không tương tác.
- Phần 11 phải tuân thủ 7 quy tắc migration ở mục 3.10.4 (`up`/`down`, idempotent, không xoá dữ liệu cũ).

### 6.3. Phụ thuộc bên ngoài

- **MongoDB Atlas** — M10 cho production/staging (replica set bắt buộc), M0 cho dev.
- **Cloudflare R2** — bucket theo môi trường, versioning bật, egress $0.
- **Redis 7** — BullMQ + rate-limit, AOF bật, `noeviction`.
- **Nginx/Caddy** — TLS termination + reverse proxy (chạy ngoài compose trên host).
- **Cloudflare Tunnel** — đường vào không cần mở port.
- **SMTP** — cảnh báo vận hành và email hệ thống.
- **Gemini API** — `GEMINI_API_KEY`.
- **cron** — backup 03:00, cleanup do worker, check-alerts mỗi 5 phút.

## 7. Prompting log và lịch sử thay đổi

- **Yêu cầu:** Người dùng yêu cầu liệt kê toàn bộ các phần theo thứ tự thực hiện, tạo sẵn file v1, lần lượt hoàn thiện vòng đầu rồi tạo v2 khi có thay đổi tiếp theo.
- **v1 / 2026-11-02:** Tạo khung phần 10 / Chuẩn bị thảo luận tuần tự / Chỉ tạo tài liệu, chưa thực thi thay đổi backend hoặc dữ liệu.
- **v1 / 2026-11-05:** Hoàn thiện vòng đầu. Chốt 9 quyết định vận hành; bảng ~90 biến môi trường trong 11 nhóm; cơ chế 3 tầng fallback cho Atlas M0 (không replica set) kèm quy tắc refuse-to-start ở production; `docker-compose.yml` + override dev + Dockerfile multi-stage; 3 cấp độ health check; log JSON với danh mục 22 sự kiện và danh sách redact; metrics không cần Prometheus (bảng hourly + 8 ngưỡng cảnh báo + script cron); backup 2 tầng Atlas + R2 kèm cảnh báo M0 không có backup; quy trình deploy 7 bước + 3 mức rollback; bảng 12 sự cố + checklist 8 bước; 13 quy tắc bảo mật vận hành; đối chiếu `.env.example` hiện tại; quota theo workspace; 24 quy tắc kiểm thử O1–O24.
