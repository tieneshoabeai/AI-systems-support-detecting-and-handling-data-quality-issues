#!/usr/bin/env bash
# Chạy một script k6 bằng Docker (không cần cài k6), đẩy metric sang Prometheus của stack monitoring.
# Dùng (từ src/backend):
#   bash deploy/monitoring/k6.sh smoke            # smoke | full-journey | load | stress | analysis-latency
#   API_BASE=http://host.docker.internal:3000/api/v1 bash deploy/monitoring/k6.sh smoke   # app chạy native
# Biến truyền vào script nếu có: STAGING_TOKEN WORKSPACE_ID PROJECT_ID DATASET_ID ANALYSIS_ID ITERATIONS
# Kết quả: test-results/k6/<script>-<thời điểm>.{txt,json} + *-stats.csv (CPU/RAM từng container mỗi 5 s);
# dashboard Grafana lọc theo testid.
set -euo pipefail
cd "$(dirname "$0")/../.."
name="${1:?Thiếu tên script, vd: smoke}"
[ -f "test/k6/$name.js" ] || { echo "Không có test/k6/$name.js" >&2; exit 1; }
stamp="$(date +%Y%m%d-%H%M%S)"
mkdir -p test-results/k6
# Ghi CPU/RAM các container của stack e2e trong lúc test chạy
stats="test-results/k6/$name-$stamp-stats.csv"
echo "time,container,cpu_percent,mem_usage" > "$stats"
( while true; do
    docker stats --no-stream --format "$(date +%T),{{.Name}},{{.CPUPerc}},{{.MemUsage}}" \
      $(docker ps --filter name=dq-e2e --format '{{.Names}}') >> "$stats" 2>/dev/null || true
    sleep 5
  done ) &
trap 'kill $! 2>/dev/null || true' EXIT
docker run --rm -i --network dq-monitoring --add-host host.docker.internal:host-gateway \
  -u "$(id -u):$(id -g)" \
  -v "$PWD/test/k6:/scripts:ro" -v "$PWD/test-results/k6:/out" \
  -e API_BASE="${API_BASE:-http://host.docker.internal:3100/api/v1}" \
  -e STAGING_TOKEN -e WORKSPACE_ID -e PROJECT_ID -e DATASET_ID -e ANALYSIS_ID -e ITERATIONS \
  -e K6_PROMETHEUS_RW_SERVER_URL=http://prometheus:9090/api/v1/write \
  -e K6_PROMETHEUS_RW_TREND_STATS="p(50),p(90),p(95),p(99),min,max,avg" \
  grafana/k6:0.54.0 run -o experimental-prometheus-rw \
  --tag testid="$name-$stamp" --summary-export "/out/$name-$stamp.json" "/scripts/$name.js" \
  | tee "test-results/k6/$name-$stamp.txt"
