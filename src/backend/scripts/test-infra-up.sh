#!/usr/bin/env bash
# Bật hạ tầng test (mongo replica set + redis + minio) cho E2E/integration.
# Dùng: pnpm run test:infra:up
#
# ── Vì sao có 2 nhánh? ───────────────────────────────────────────────────────
# 1. Nếu **có** Docker daemon → dùng `deploy/docker-compose.test.yml` (đúng
#    hướng dẫn gốc, tái lập được hoàn toàn).
# 2. Nếu **không** có Docker daemon (máy cá nhân, môi trường CI cũ) → khởi
#    động trực tiếp bằng binary native (`mongod`, `redis-server`, `minio`)
#    trên **đúng các cổng mà test mong đợi**:
#      - MongoDB replica set `rs0` @ 27018
#      - Redis               @ 6380
#      - MinIO (S3)         @ 9002 (console 9003)
#
# Cả hai nhánh cho ra cùng một hợp đồng với test ⇒ test không cần biết hạ tầng
# được bật bằng cách nào.
set -euo pipefail
cd "$(dirname "$0")/.."

MONGO_PORT=27018
REDIS_PORT=6380
MINIO_PORT=9002
MINIO_CONSOLE_PORT=9003
DATA_DIR="${DQ_TEST_INFRA_DIR:-/tmp/dq-infra}"
MONGO_ROOT="${ADMIN_EMAIL:-admin@school.local}"
MONGO_ROOT_PASSWORD="${ADMIN_PASSWORD:-Admin@123}"

mkdir -p "$DATA_DIR/logs" "$DATA_DIR/mongo-data" "$DATA_DIR/redis" "$DATA_DIR/minio-data"

# ── MinIO (S3-compatible): binary native trước, container sau ──────────────
# Docker Hub có thể từ chối pull `minio/minio` ("pull access denied"), và bản
# `latest` mới bắt buộc license AIStor ⇒ S3 bị từ chối ⇒ test storage fail.
# ⇒ Ưu tiên binary open-source RELEASE.2025-04-22T22-12-26Z; chỉ khi không tải
#   được mới dùng container `minio-test` (image đã ghim trong compose).
start_minio() {
  if (exec 3<>/dev/tcp/127.0.0.1/$MINIO_PORT) 2>/dev/null; then
    echo "[infra] MinIO @ $MINIO_PORT đã chạy — giữ nguyên."
    return 0
  fi
  local MINIO_BIN="$DATA_DIR/minio-real"
  if [ ! -x "$MINIO_BIN" ]; then
    echo "[infra] Tải MinIO server (bản cuối trước khi open-source bị archive)..."
    local MINIO_REL="RELEASE.2025-04-22T22-12-26Z"
    curl -sSL --max-time 300 -o "$MINIO_BIN" \
      "https://github.com/minio/minio/releases/download/${MINIO_REL}/minio.linux-amd64.${MINIO_REL}" \
      && chmod +x "$MINIO_BIN" \
      || { rm -f "$MINIO_BIN"; echo "[infra] KHÔNG tải được MinIO binary."; }
  fi
  if [ -x "$MINIO_BIN" ]; then
    echo "[infra] Khởi động MinIO @ $MINIO_PORT (native binary) ..."
    MINIO_ROOT_USER=testminio MINIO_ROOT_PASSWORD=testminio123 \
      setsid "$MINIO_BIN" server "$DATA_DIR/minio-data" \
        --address "127.0.0.1:$MINIO_PORT" --console-address "127.0.0.1:$MINIO_CONSOLE_PORT" \
        > "$DATA_DIR/logs/minio.log" 2>&1 < /dev/null &
  elif [ "${1:-}" = "docker" ]; then
    echo "[infra] Fallback: MinIO bằng container minio-test ..."
    docker compose -f deploy/docker-compose.test.yml up -d minio-test \
      || echo "[infra] KHÔNG chạy được container MinIO — test storage sẽ fail."
  else
    echo "[infra] Bỏ qua S3 (test storage sẽ fail)."
    return 0
  fi
  for i in $(seq 1 30); do
    if curl -sf -o /dev/null "http://127.0.0.1:$MINIO_PORT/minio/health/live"; then
      echo "[infra] MinIO sẵn sàng."; return 0
    fi
    sleep 1
  done
  echo "[infra] CẢNH BÁO: MinIO chưa sẵn sàng."
}

# ── Docker khả dụng? ────────────────────────────────────────────────────────
if docker info >/dev/null 2>&1; then
  echo "[infra] Docker daemon khả dụng — dùng docker-compose.test.yml (mongo + redis)"
  docker compose -f deploy/docker-compose.test.yml up -d mongo-test redis-test
  echo "[infra] Cho mongo-test khởi tạo replica set rs0 ..."
  # Lưu ý: rs.initiate() trong container lấy host = tên container (mongod nghe 27017 bên trong,
  # map ra 27018) nên KHÔNG truyền được host 127.0.0.1:27018 ở đây. Client test trên máy host
  # phải dùng directConnection=true — mặc định đã có trong test/helpers/test-infra.ts.
  for i in $(seq 1 30); do
    if docker exec dq-mongo-test mongosh --quiet --eval "try{rs.status().ok}catch(e){rs.initiate()}" 2>/dev/null | grep -q "1\|already initialized\|ok"; then
      echo "[infra] Mongo test sẵn sàng (rs0)."
      break
    fi
    sleep 2
    if [ "$i" = "30" ]; then echo "[infra] CẢNH BÁO: mongo-test chưa sẵn sàng."; fi
  done
  start_minio docker
  docker compose -f deploy/docker-compose.test.yml ps
  exit 0
fi

echo "[infra] KHÔNG có Docker daemon — khởi động bằng binary native."

# ── MongoDB (replica set rs0) ───────────────────────────────────────────────
if ! (exec 3<>/dev/tcp/127.0.0.1/$MONGO_PORT) 2>/dev/null; then
  echo "[infra] Khởi động mongod @ $MONGO_PORT ..."
  # Ưu tiên 1: `systemd-run --user` — mongod trở thành **user service** nên
  #   KHÔNG bị SIGTERM khi terminal đóng hay khi runner dọn process group.
  #   Đây là cách ổn định nhất trên máy cá nhân (có systemd --user).
  # Ưu tiên 2: `mongod --fork` — tự daemonize, nhưng vẫn có thể bị dọn nếu
  #   runner kill cả process group.
  if command -v systemd-run >/dev/null 2>&1 && systemctl --user is-system-running >/dev/null 2>&1; then
    systemctl --user stop dq-mongo-test.service >/dev/null 2>&1 || true
    systemd-run --user --unit=dq-mongo-test --property=Restart=on-failure --collect \
      mongod --dbpath "$DATA_DIR/mongo-data" --port "$MONGO_PORT" --replSet rs0 \
      --bind_ip 127.0.0.1 >/dev/null 2>&1 \
      || mongod --dbpath "$DATA_DIR/mongo-data" --port "$MONGO_PORT" --replSet rs0 \
           --bind_ip 127.0.0.1 --logpath "$DATA_DIR/logs/mongod.log" --fork >/dev/null 2>&1
  else
    mongod --dbpath "$DATA_DIR/mongo-data" --port "$MONGO_PORT" --replSet rs0 \
      --bind_ip 127.0.0.1 --logpath "$DATA_DIR/logs/mongod.log" --fork >/dev/null 2>&1
  fi
  # Chờ mongod nhận kết nối
  for i in $(seq 1 30); do
    if mongosh --quiet --port "$MONGO_PORT" --eval "db.adminCommand('ping').ok" >/dev/null 2>&1; then break; fi
    sleep 1
  done
  # Khởi tạo replica set (idempotent)
  mongosh --quiet --port "$MONGO_PORT" --eval "
    try { rs.initiate({_id:'rs0', members:[{_id:0, host:'127.0.0.1:$MONGO_PORT'}]}); }
    catch(e) { print('rs.initiate: ' + e.message); }
  " >/dev/null 2>&1 || true
  # Chờ replica có primary
  for i in $(seq 1 30); do
    if mongosh --quiet --port "$MONGO_PORT" --eval "db.adminCommand({hello:1}).isWritablePrimary" 2>/dev/null | grep -q true; then
      echo "[infra] Mongo replica set rs0 sẵn sàng."; break
    fi
    sleep 1
  done
else
  echo "[infra] Mongo @ $MONGO_PORT đã chạy — giữ nguyên."
fi

# Tạo user root (cho phép truy cập admin DB)
mongosh --quiet --port "$MONGO_PORT" admin --eval "
  try {
    db.createUser({user: '$MONGO_ROOT', pwd: '$MONGO_ROOT_PASSWORD', roles: [{role:'root', db:'admin'}]});
  } catch(e) { /* đã tồn tại */ }
" >/dev/null 2>&1 || true

# ── Redis ───────────────────────────────────────────────────────────────────
if ! (exec 3<>/dev/tcp/127.0.0.1/$REDIS_PORT) 2>/dev/null; then
  echo "[infra] Khởi động redis-server @ $REDIS_PORT ..."
  redis-server --port "$REDIS_PORT" --bind 127.0.0.1 --daemonize yes \
    --dir "$DATA_DIR/redis" --logfile "$DATA_DIR/logs/redis.log"
  for i in $(seq 1 15); do
    if redis-cli -p "$REDIS_PORT" ping 2>/dev/null | grep -q PONG; then break; fi
    sleep 1
  done
  echo "[infra] Redis sẵn sàng."
else
  echo "[infra] Redis @ $REDIS_PORT đã chạy — giữ nguyên."
fi

# ── MinIO (S3-compatible) ──────────────────────────────────────────────────
start_minio

echo "[infra] Xong. Cổng: mongo=$MONGO_PORT redis=$REDIS_PORT minio=$MINIO_PORT"
