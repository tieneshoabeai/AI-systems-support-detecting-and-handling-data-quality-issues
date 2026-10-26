#!/usr/bin/env bash
set -euo pipefail

# Di chuyển đến thư mục backend
cd "$(dirname "$0")/.."

echo "=== [1/2] Kiểm tra công cụ Cloudflare Tunnel (cloudflared) ==="

# Kiểm tra nếu cloudflared đã được cài đặt trên hệ thống
if command -v cloudflared &> /dev/null; then
  echo "✓ cloudflared đã được cài đặt trên hệ thống: $(cloudflared --version)"
  exit 0
fi

# Kiểm tra nếu binary cục bộ đã tồn tại trong bin/
mkdir -p bin
if [[ -x "bin/cloudflared" ]]; then
  echo "✓ cloudflared binary cục bộ đã sẵn sàng tại bin/cloudflared: $(./bin/cloudflared --version)"
  exit 0
fi

echo "=== [2/2] Đang tải binary cloudflared chính thức từ Cloudflare GitHub Release ==="
DOWNLOAD_URL="https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64"

if command -v curl &> /dev/null; then
  curl -fsSL "$DOWNLOAD_URL" -o bin/cloudflared
elif command -v wget &> /dev/null; then
  wget -qO bin/cloudflared "$DOWNLOAD_URL"
else
  echo "✗ Lỗi: Yêu cầu curl hoặc wget để tải binary cloudflared."
  exit 1
fi

chmod +x bin/cloudflared
echo "✓ Đã tải và cấp quyền thực thi thành công cho bin/cloudflared: $(./bin/cloudflared --version)"
