#!/usr/bin/env bash
set -euo pipefail
# Restore Mongo: ./restore-mongo.sh backups/mongo-YYYY-MM-DD-HHMM
SRC="${1:-}"
if [ -z "$SRC" ] || [ -z "${MONGODB_URI:-}" ]; then echo "Dung: MONGODB_URI=... ./restore-mongo.sh <thu-muc-backup>" >&2; exit 1; fi
mongorestore --uri="$MONGODB_URI" --drop "$SRC"
echo "Da restore Mongo tu $SRC"
