# Cau Hinh Trien Khai

Cau hinh Docker Compose cho moi truong phat trien va kiem thu.

---

## 1. File

| File | Muc dich |
|---|---|
| `docker-compose.dev.yml` | Ha tang phat trien: MongoDB, Redis, MinIO (S3-compatible) |
| `docker-compose.test.yml` | Ha tang kiem thu: MongoDB replica set, Redis, MinIO |
| `mongo/init-replica-set.js` | Script khoi dong MongoDB replica set |

---

## 2. Phat Trien

```bash
docker compose -f deploy/docker-compose.dev.yml up -d
docker compose -f deploy/docker-compose.dev.yml ps
docker compose -f deploy/docker-compose.dev.yml down
```

---

## 3. Kiem Thu

Ban test dung **script shell** thay vi Docker Compose de tranh phu thuoc Docker trong moi truong:

```bash
pnpm test:infra:up
pnpm test:infra:down
```

`scripts/test-infra-up.sh` khoi dong MongoDB replica set bang `systemd-run --user` (fallback `--fork`). Cach nay tranh tien trinh bi keo theo khi lenh ket thuc - quan trong khi chay trong CI runner hoac container.

**Replica set la bat buoc** cho integration test: MongoDB transaction (cascade delete) khong ho tro tren standalone.

---

## 4. Bien Moi Truong

Bien duoc doc tu `.env` cua backend. Xem `../.env.example`.

| Nhom | Bien |
|---|---|
| MongoDB | `MONGODB_URI`, `MONGODB_TEST_URI` |
| Redis | `REDIS_HOST`, `REDIS_PORT`, `REDIS_PASSWORD` |
| S3/R2 | `S3_ENDPOINT`, `S3_BUCKET_NAME`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` |

---

## 5. Khac Nhau Giua Dev Va Test

| Tieu chi | Dev | Test |
|---|---|---|
| MongoDB | Standalone | **Replica set** (can cho transaction) |
| Du lieu | Nam giữ | Xoa sach truoc moi suite |
| MinIO | Bucket `dev` | Bucket rieng, xoa theo prefix |
| Port | Co dinh | Có thai theo bien moi truong |
