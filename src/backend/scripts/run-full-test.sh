#!/usr/bin/env bash
# =============================================================================
# CHAY TOAN BO KIM THU 9 TANG - 25/11/2026
# =============================================================================
# Trang thai hien tai:
#   Tang 1-3 Unit          : XONG  (1090/1092)
#   Tang 6  Architecture   : XONG  (5 suite, 23/23)
#   Tang 5-7 E2E + Security: XONG  (12 suite, 94/94)
#   Tang 4  Integration    : XONG  (7 suite, 138/138)
#   Tang 8  Performance k6 : XONG  (smoke/journey/load/stress)
#   Tang 9  Benchmark AI   : M1 + M3 XONG; M2 (gemma3:12b) DANG DO 10/20
#
# Script nay chay lai phan CON THIEU (M2) + sinh bao cao tong hop.
#
# Dung:  bash scripts/run-full-test.sh
# =============================================================================
set -uo pipefail
cd "$(dirname "$0")/.."
ROOT="$(cd ../.. && pwd)"

BLUE='\033[0;34m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; NC='\033[0m'
step() { echo -e "\n${BLUE}=============== $* ===============${NC}"; }
ok()   { echo -e "${GREEN}[OK]${NC} $*"; }
warn() { echo -e "${YELLOW}[!]${NC} $*"; }
err()  { echo -e "${RED}[X]${NC} $*"; }

# =============================================================================
step "BUOC 0: Kiem tra moi truong"
# =============================================================================
echo "Node:      $(node -v)"
echo "pnpm:      $(pnpm -v)"
echo "Docker:    $(docker info >/dev/null 2>&1 && echo 'OK' || echo 'KHONG kha dung (se dung binary native)')"
echo "Ollama:    $(curl -sf -m 3 http://127.0.0.1:11434/api/version 2>/dev/null || echo 'chua chay')"
echo "RAM avail: $(awk '/MemAvailable/ {printf "%d GB", $2/1024/1024}' /proc/meminfo)"

# =============================================================================
step "BUOC 1: Tang 6 - Architecture (khong can infra)"
# =============================================================================
pnpm run test:arch 2>&1 | tail -8
ok "Architecture checks xong"

# =============================================================================
step "BUOC 2: Tang 5-7 - E2E + Security (khong can infra)"
# =============================================================================
pnpm run test:e2e 2>&1 | tail -8
ok "E2E + Security xong"

# =============================================================================
step "BUOC 3: Tang 4 - Integration (can Docker hoac binary native)"
# =============================================================================
pnpm run test:infra:up 2>&1 | tail -10
pnpm run test:integration 2>&1 | tail -12
INTEG_CODE=$?
pnpm run test:infra:down 2>&1 | tail -3
if [ $INTEG_CODE -eq 0 ]; then ok "Integration xong"; else warn "Integration co loi - xem log tren"; fi

# =============================================================================
step "BUOC 4: Tang 8 - Performance k6 (can API chay + Docker cho k6 container)"
# =============================================================================
if curl -sf -m 3 http://localhost:3100/health >/dev/null 2>&1; then
  T=$(curl -s -X POST http://localhost:3100/api/v1/auth/login \
        -H 'Content-Type: application/json' \
        -d '{"email":"perf-1419c5b8@e2e-live.local","password":"Perf@123456"}' \
      | python3 -c "import json,sys; print(json.load(sys.stdin)['data']['access_token'])" 2>/dev/null)
  export STAGING_TOKEN="$T"
  export API_BASE="http://host.docker.internal:3100/api/v1"
  echo "Token: ${T:0:20}..."
  for s in smoke full-journey load stress; do
    echo "--- k6 $s ---"
    bash deploy/monitoring/k6.sh "$s" 2>&1 | grep -E "checks|http_req_duration|scenario:" | head -12
  done
  ok "k6 xong (smoke / full-journey / load / stress)"
else
  warn "API khong chay tren :3100 -> BO QUA k6"
  warn "  Bat lai bang: cd src/backend && pnpm run start:dev"
  warn "  hoac: docker compose -f deploy/docker-compose.e2e.yml up -d api"
fi

# =============================================================================
step "BUOC 5: Tang 9 - Benchmark AI (M2 gemma3:12b con lai)"
# =============================================================================
bash scripts/bench-m2.sh
ok "M2 xong"

# =============================================================================
step "BUOC 6: Duong Pareto + thong ke so sanh"
# =============================================================================
npx ts-node --transpile-only scripts/benchmark/pareto.ts 2>&1 | tail -25
echo ""
npx ts-node --transpile-only scripts/benchmark/compare-models.ts 2>&1 | tail -30

# =============================================================================
step "BUOC 7: Bao cao tong hop 9 tang"
# =============================================================================
python3 scripts/gen-test-report.py || warn "Khong sinh duoc bao cao (khong co python3)"
echo ""
echo -e "${GREEN}HOAN TAT${NC} - bao cao: docs/test-reports/"
ls -la "$ROOT/docs/test-reports/" | tail -20
