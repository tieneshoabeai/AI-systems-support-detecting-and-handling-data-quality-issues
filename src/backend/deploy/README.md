# Cấu hình triển khai

Cấu hình Docker Compose cho môi trường phát triển và kiểm thử.

---

## 1. Tệp cấu hình

| Tệp | Mục đích |
|---|---|
| `docker-compose.dev.yml` | Hạ tầng phát triển: MongoDB, Redis, MinIO (tương thích S3) |
| `docker-compose.test.yml` | Hạ tầng kiểm thử: MongoDB replica set, Redis, MinIO |
| `mongo/init-replica-set.js` | Kịch bản khởi động MongoDB replica set |

---

## 2. Phát triển

```bash
docker compose -f deploy/docker-compose.dev.yml up -d
docker compose -f deploy/docker-compose.dev.yml ps
docker compose -f deploy/docker-compose.dev.yml down
```

---

## 3. Kiểm thử

Bản kiểm thử dùng **kịch bản shell** thay vì Docker Compose để tránh phụ thuộc Docker trong mọi môi trường:

```bash
pnpm test:infra:up
pnpm test:infra:down
```

`scripts/test-infra-up.sh` khởi động MongoDB replica set bằng `systemd-run --user` (dự phòng `--fork`). Cách này tránh tiến trình bị kéo theo khi lệnh kết thúc — quan trọng khi chạy trong CI runner hoặc container.

**Replica set là bắt buộc** cho kiểm thử tích hợp (integration test): giao dịch (transaction) MongoDB phục vụ xoá dây chuyền (cascade delete) không hỗ trợ trên standalone.

---

## 4. Biến môi trường

Biến được đọc từ `.env` của backend. Xem `../.env.example`.

| Nhóm | Biến |
|---|---|
| MongoDB | `MONGODB_URI`, `MONGODB_TEST_URI` |
| Redis | `REDIS_HOST`, `REDIS_PORT`, `REDIS_PASSWORD` |
| S3/R2 | `S3_ENDPOINT`, `S3_BUCKET_NAME`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` |

---

## 5. Khác nhau giữa Dev và Test

| Tiêu chí | Dev | Test |
|---|---|---|
| MongoDB | Standalone | **Replica set** (cần cho transaction) |
| Dữ liệu | Giữ lại | Xoá sạch trước mỗi suite |
| MinIO | Bucket `dev` | Bucket riêng, xoá theo tiền tố (prefix) |
| Cổng | Cố định | Có thể thay đổi theo biến môi trường |
