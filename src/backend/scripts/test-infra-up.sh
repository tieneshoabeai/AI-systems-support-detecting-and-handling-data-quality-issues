#!/usr/bin/env bash
# Bật hạ tầng test (mongo replica set + redis + minio) cho E2E/integration.
# Dùng: pnpm run test:infra:up
set -euo pipefail
cd "$(dirname "$0")/.."
docker compose -f deploy/docker-compose.test.yml up -d
echo "Cho mongo-test khoi tao replica set rs0 ..."
for i in $(seq 1 30); do
  if docker exec dq-mongo-test mongosh --quiet --eval "try{rs.status().ok}catch(e){rs.initiate()}" 2>/dev/null | grep -q "1\|already initialized\|ok"; then
    echo "Mongo test san sang (rs0)."
    break
  fi
  sleep 2
  if [ "$i" = "30" ]; then echo "Canh bao: mongo-test chua san sang, kiem tra 'docker logs dq-mongo-test'."; fi
done
docker compose -f deploy/docker-compose.test.yml ps
