# Triển Khai — Hạ Tầng Cục Bộ Cho Backend

Cấu hình Docker Compose và script khởi tạo replica set cho môi trường dev/test. Thư mục này không chứa code backend, chỉ chứa hạ tầng chạy cục bộ.

---

## 1. Các tệp trong thư mục (thực tế)

| Tệp | Nội dung thật |
|---|---|
| `docker-compose.dev.yml` | 3 service: `mongo` (mongo:7, `--replSet rs0`, cổng 27017), `redis` (redis:7-alpine, cổng 6379), `ai-engine` (ollama, **không mở cổng ra host**) |
| `docker-compose.test.yml` | 3 service test né cổng để tránh đụng dev: `mongo-test` (27018→27017), `redis-test` (6380→6379), `minio-test` (9002→9000, console 9003→9001) |
| `mongo/init-replica-set.js` | `rs.initiate({_id:'rs0', members:[{host:'mongo:27017'}]})` — dùng cho dev, gắn vào `/docker-entrypoint-initdb.d` |

---

## 2. Môi trường dev (`docker-compose.dev.yml`)

```bash
docker compose -f deploy/docker-compose.dev.yml up -d
docker compose -f deploy/docker-compose.dev.yml exec mongo mongosh --eval "rs.initiate()"
docker compose -f deploy/docker-compose.dev.yml ps
docker compose -f deploy/docker-compose.dev.yml down
```

Đặc điểm thật (đọc từ tệp yml):

- Mongo là **single-node replica set** (`--replSet rs0`) để đủ điều kiện chạy transaction cho outbox — không phải standalone.
- Redis **bắt buộc** cho cache + rate-limit + Socket.IO adapter.
- `ai-engine` (Ollama) không mở cổng ra host — chỉ gọi được trong network `dq-net`.

---

## 3. Môi trường test (`docker-compose.test.yml` + script shell)

Không dùng trực tiếp compose khi chạy test — dùng script bọc ngoài để tự chọn Docker hay binary native:

```bash
pnpm test:infra:up      # Bật hạ tầng test
pnpm test:infra:down    # Tắt và xóa minio-data
```

`scripts/test-infra-up.sh` làm 2 nhánh:

1. Có Docker daemon → `docker compose -f deploy/docker-compose.test.yml up -d`, đợi `rs.status().ok` tối đa 30 lần.
2. Không có Docker → chạy binary native (`mongod`, `redis-server`, `minio`) trên **đúng cổng test mong đợi**: Mongo `rs0` ở 27018, Redis ở 6380, MinIO ở 9002 (console 9003).

**Replica set là bắt buộc** cho integration test: transaction MongoDB (xóa cascade, outbox/inbox) không chạy trên standalone.

---

## 4. Biến môi trường liên quan

Đọc từ `.env` của backend (không đọc từ deploy). Nhóm dùng cho hạ tầng:

| Nhóm | Biến |
|---|---|
| MongoDB | `MONGODB_URI`, `MONGODB_TEST_URI` |
| Redis | `REDIS_HOST`, `REDIS_PORT`, `REDIS_PASSWORD` |
| S3/R2 (MinIO test giả lập) | `S3_ENDPOINT`, `S3_BUCKET_NAME`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` |

---

## 5. So sánh dev và test (thực tế từ 2 tệp yml)

| Tiêu chí | Dev (`dev.yml`) | Test (`test.yml`) |
|---|---|---|
| Mongo | replica set `rs0`, cổng 27017, volume `mongo-data` | replica set `rs0`, cổng host 27018, volume `mongo-test-data` |
| Redis | cổng 6379, volume `redis-data` | cổng host 6380, không volume riêng |
| Storage/AI | `ai-engine` Ollama (không MinIO) | `minio-test` (9002/9003), không Ollama |
| Network | `dq-net` | `dq-test-net` |
| Dữ liệu | Giữ lại giữa các lần chạy | Xóa sạch trước mỗi suite (do test tự xóa collection) |
