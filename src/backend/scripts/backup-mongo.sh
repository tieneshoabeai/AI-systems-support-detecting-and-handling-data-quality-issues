#!/usr/bin/env bash
set -euo pipefail
# Backup Mongo: mongodump --uri=$MONGODB_URI --out=backups/<ngay>
OUT="backups/mongo-$(date +%F-%H%M)"
mkdir -p "$OUT"
if [ -z "${MONGODB_URI:-}" ]; then echo "Thieu MONGODB_URI" >&2; exit 1; fi
mongodump --uri="$MONGODB_URI" --out="$OUT"
echo "Da backup Mongo vao $OUT"
