#!/usr/bin/env bash
# Tắt hạ tầng test. Dùng: pnpm run test:infra:down
set -euo pipefail
cd "$(dirname "$0")/.."
docker compose -f deploy/docker-compose.test.yml down
echo "Da tat ha tang test."
