#!/usr/bin/env bash
# Chạy k6 smoke + stress lên STAGING và ghi báo cáo docs/test-reports/perf-<ngày>.md
# (Phần 13 v7 §3.10 + §3.14: cấm chạy perf trên production, kết quả commit vào repo).
# Dùng: API_BASE=https://staging.example.com/api/v1 STAGING_TOKEN=... DATASET_ID=... pnpm run test:perf:staging
set -euo pipefail
cd "$(dirname "$0")/../.."
if ! command -v k6 >/dev/null 2>&1; then
  echo "Chua cai k6. Cai tai https://k6.io/docs/get-started/installation/ roi chay lai." >&2
  exit 1
fi
if [ "${API_BASE:-}" = "" ]; then
  echo "Thieu API_BASE (VD: API_BASE=https://staging.example.com/api/v1 $0)" >&2
  exit 1
fi
case "$API_BASE" in
  *localhost*|*127.0.0.1*) ;;
  *) echo "API_BASE=$API_BASE (xac nhan la STAGING, khong phai production). Nhan Enter de tiep tuc, Ctrl+C de huy."; read -r _ ;;
esac
OUT="docs/test-reports/perf-$(date +%F).md"
mkdir -p docs/test-reports
echo "Chay smoke..."
k6 run --out json="docs/test-reports/smoke-$(date +%F).json" test/k6/smoke.js | tee "docs/test-reports/smoke-$(date +%F).log"
echo "Chay stress..."
k6 run --out json="docs/test-reports/stress-$(date +%F).json" test/k6/stress.js | tee "docs/test-reports/stress-$(date +%F).log"
cat > "$OUT" <<EOF
# Bao cao hieu nang — $(date +%F)

- API_BASE: $API_BASE
- Smoke log: smoke-$(date +%F).log | Stress log: stress-$(date +%F).log
- Nguong smoke: health p95<100ms; login/workspaces p95<500ms; rows p95<1000ms; fail<1%.
- Nguong stress: doc 50VU p95<2000ms fail<1%; upload 20VU fail<2%; DQ-01 10VU p95<8000ms.
- Ket luan: xem log chi tiet; vuot nguong -> KHONG release (Phan 13 v7 §3.10 quy tac 3).

EOF
echo "Da ghi $OUT (nho commit vao repo)."
