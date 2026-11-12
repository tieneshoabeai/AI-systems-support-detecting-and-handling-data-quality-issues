#!/usr/bin/env bash
set -euo pipefail
# Backup storage local (STORAGE local fallback): dong bo thu muc storage ra backups/
SRC="${STORAGE_LOCAL_DIR:-./storage}"
OUT="backups/storage-$(date +%F-%H%M)"
mkdir -p "$OUT"
cp -a "$SRC/." "$OUT/" 2>/dev/null || echo "Khong co thu muc $SRC - bo qua (dang dung R2/S3 thi backup bang lifecycle cua bucket)"
echo "Da backup storage vao $OUT"
