#!/usr/bin/env bash
set -euo pipefail

# Di chuyển đến thư mục backend
cd "$(dirname "$0")/.."

CLOUDFLARED_BIN=""
if command -v cloudflared &> /dev/null; then
  CLOUDFLARED_BIN="cloudflared"
elif [[ -x "bin/cloudflared" ]]; then
  CLOUDFLARED_BIN="./bin/cloudflared"
else
  echo "Chưa tìm thấy binary cloudflared. Đang tiến hành cài đặt..."
  bash scripts/install-cloudflared.sh
  CLOUDFLARED_BIN="./bin/cloudflared"
fi

PORT="${PORT:-3000}"

echo "================================================================================"
echo "          KHỞI CHẠY CLOUDFLARE ZERO TRUST TUNNEL (HTTPS CỔNG 443)              "
echo "================================================================================"
echo "Backend đích: http://localhost:${PORT}"
echo "Đang thiết lập đường hầm QUIC bảo mật tới Cloudflare Global Edge..."
echo "Khi kết nối hoàn tất, Cloudflare sẽ cấp URL dạng: https://*.trycloudflare.com"
echo "Truy cập Swagger OpenAPI: https://<tunnel-url>/api/v1/docs"
echo "Bấm Ctrl+C để dừng đường hầm."
echo "================================================================================"

exec "$CLOUDFLARED_BIN" tunnel --url "http://localhost:${PORT}"
