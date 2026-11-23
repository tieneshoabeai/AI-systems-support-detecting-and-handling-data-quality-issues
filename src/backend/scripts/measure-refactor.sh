#!/usr/bin/env bash
# Đo baseline sau mỗi phase refactor
set -euo pipefail
cd "$(dirname "$0")/.."

printf '=== File .ts trong src/modules ===\n'
find src/modules -name '*.ts' | wc -l

printf '=== LOC trong src/modules ===\n'
find src/modules -name '*.ts' -exec cat {} + | wc -l

printf '=== Thư mục con trong src/modules ===\n'
find src/modules -mindepth 2 -type d | wc -l

printf '=== Handler ===\n'
ls src/modules/*/application/{commands,queries}/*.handler.ts 2>/dev/null | wc -l || true

printf '=== Route (contract 3.13) ===\n'
node scripts/check-api-coverage.cjs | tail -3
