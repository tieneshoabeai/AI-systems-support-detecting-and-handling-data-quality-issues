#!/usr/bin/env bash
set -euo pipefail

# Di chuyển đến thư mục backend
cd "$(dirname "$0")/.."

cert_dir="certs"
mkdir -p "$cert_dir"

echo "=== [1/2] Kiểm tra chứng chỉ SSL/TLS ==="

if [[ -s "$cert_dir/privkey.pem" && -s "$cert_dir/fullchain.pem" ]]; then
  echo "✓ Cặp chứng chỉ đã tồn tại tại $cert_dir/ (privkey.pem & fullchain.pem)."
  exit 0
fi

echo "=== [2/2] Đang tạo chứng chỉ X.509 RSA-2048 tự ký với SAN (localhost / 127.0.0.1) ==="
openssl req -x509 -newkey rsa:2048 -nodes \
  -keyout "$cert_dir/privkey.pem" -out "$cert_dir/fullchain.pem" \
  -days 365 -subj "/CN=localhost" \
  -addext "subjectAltName=DNS:localhost,IP:127.0.0.1,IP:0.0.0.0"

chmod 600 "$cert_dir/privkey.pem"
chmod 644 "$cert_dir/fullchain.pem"

echo "✓ Đã tạo thành công chứng chỉ tại $cert_dir/ với cấu trúc tương thích Cloudflare Origin CA."
