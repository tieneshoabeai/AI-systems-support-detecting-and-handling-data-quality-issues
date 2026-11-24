#!/usr/bin/env bash
# Tắt hạ tầng test. Dùng: pnpm run test:infra:down
#
# Tắt cả hai chế độ: docker-compose (nếu có daemon) và binary native.
set -euo pipefail
cd "$(dirname "$0")/.."

DATA_DIR="${DQ_TEST_INFRA_DIR:-/tmp/dq-infra}"

if docker info >/dev/null 2>&1; then
  docker compose -f deploy/docker-compose.test.yml down || true
fi

# User service systemd (nếu `test-infra-up.sh` đã dùng cách này cho mongod).
if command -v systemctl >/dev/null 2>&1; then
  systemctl --user stop dq-mongo-test.service >/dev/null 2>&1 || true
fi

# Binary native: dừng theo cổng đang listen.
for port in 27018 6380 9002; do
  pids="$(ss -ltnp 2>/dev/null | awk -v p=":$port" '$4 ~ p {print $NF}' \
    | grep -oE 'pid=[0-9]+' | cut -d= -f2 | sort -u || true)"
  for pid in $pids; do
    echo "[infra] Dừng pid $pid (cổng $port) ..."
    kill "$pid" 2>/dev/null || true
  done
done

rm -rf "$DATA_DIR/minio-data" 2>/dev/null || true
echo "[infra] Đã tắt hạ tầng test."
