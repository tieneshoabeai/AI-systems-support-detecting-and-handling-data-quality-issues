#!/usr/bin/env bash
# =============================================================================
# TAYNG 9 - CHAY MOT MODEL BENCHMARK (M1..M5) - 20 MAU
# =============================================================================
# Dung:
#   bash scripts/bench-one.sh M5          # chay 1 model
#   bash scripts/bench-one.sh M5 M3       # chay nhieu model theo thu tu
#
# Vi sao can script nay?
#   - Tu bat Ollama native + kiem tra RAM truoc khi nap model.
#   - Tu theo doi RAM va canh bao khi tran (rule: tran RAM -> chay tay).
#   - Tu ghi log rieng cho tung model vao /tmp/bench-<model>.log
#
# CANH BAO RAM (may nay 30 GB):
#   M2 gemma3:12b  ~11.5 GB  <- nhat, hay TAT Docker Desktop truoc
#   M1 qwen3:14b   ~ 9.1 GB
#   M3 qwen3:8b    ~ 5.6 GB
#   M4 llama3.1:8b ~ 5.2 GB
#   M5 mistral:7b  ~ 3.2 GB
#
# BI QUAN TRONG: BENCH_NUM_CTX=4096 + OLLAMA_CONTEXT_LENGTH=4096
#   - KV cache 8K cua gemma3:12b (~9GB model + ~1.2GB KV) gay OOM-kill luc load.
#   - 4096 van du cho prompt ~1100 token + output 640 token.
#   - Dong thoi BENCH_MAX_INFRA_RETRIES=3 de chay lai khi loi ha tang.
# =============================================================================
set -uo pipefail
cd "$(dirname "$0")/.."

OLLAMA_BIN="${OLLAMA_BIN:-/tmp/ollama-new/bin/ollama}"
export OLLAMA_MODELS="${OLLAMA_MODELS:-$HOME/.ollama-models}"

# --- 0. Kiem tra RAM ---------------------------------------------------------
AVAIL_GB=$(awk '/MemAvailable/ {printf "%d", $2/1024/1024}' /proc/meminfo)
echo "[bench] RAM kha dung: ${AVAIL_GB} GB"

# --- 1. Dam bao Ollama native dang chay --------------------------------------
if ! curl -sf -m 3 http://127.0.0.1:11434/api/version >/dev/null 2>&1; then
  echo "[bench] Khoi dong Ollama native (num_ctx=4096) ..."
  # Flash attention + KV cache q8_0 + num_ctx 4096 -> nhe RAM, it reload hon.
  OLLAMA_FLASH_ATTENTION=1 OLLAMA_KV_CACHE_TYPE=q8_0 \
  OLLAMA_MAX_LOADED_MODELS=1 OLLAMA_NUM_PARALLEL=1 OLLAMA_CONTEXT_LENGTH=4096 \
  OLLAMA_KEEP_ALIVE=30m \
    setsid nohup "$OLLAMA_BIN" serve > /tmp/ollama-serve.log 2>&1 < /dev/null &
  for i in $(seq 1 30); do
    curl -sf -m 2 http://127.0.0.1:11434/api/version >/dev/null 2>&1 && break
    sleep 1
  done
fi
echo "[bench] Ollama: $(curl -s -m 3 http://127.0.0.1:11434/api/version)"

# --- 2. Chay tung model ------------------------------------------------------
for MODEL in "$@"; do
  echo ""
  echo "================================================================"
  echo "[bench] BAT DAU $MODEL  ($(date '+%H:%M:%S'))"
  echo "================================================================"

  AVAIL_GB=$(awk '/MemAvailable/ {printf "%d", $2/1024/1024}' /proc/meminfo)
  echo "[bench] RAM kha dung luc bat dau: ${AVAIL_GB} GB"
  if [ "${AVAIL_GB}" -lt 16 ]; then
    echo "[bench] CANH BAO: RAM < 16 GB. Model 12B co the bi OOM-kill."
    read -r -p "[bench] Nhan Enter de tiep tuc, Ctrl+C de huy: " _
  fi

  # Pre-load model vao RAM truoc -> tranh "load race" gay 500 khi chay song song.
  echo "[bench] Pre-load $MODEL vao RAM ..."
  curl -s -m 600 http://127.0.0.1:11434/api/chat \
    -d "{\"model\":\"$MODEL\",\"messages\":[{\"role\":\"user\",\"content\":\"ping\"}],\"stream\":false,\"options\":{\"num_predict\":1}}" \
    -o /dev/null
  echo "[bench] Pre-load xong. Bat dau suy luan 20 mau ..."

  BENCH_OLLAMA_URL=http://127.0.0.1:11434 \
  AI_RAM_GUARD=off \
  BENCH_NUM_CTX=4096 \
  BENCH_MAX_INFRA_RETRIES=3 \
  BENCH_INFRA_BACKOFF_MS=90000 \
    npx ts-node --transpile-only scripts/benchmark/run-models.ts \
      --model="$MODEL" --samples=20 --repeats=1 --judge=true \
      2>&1 | tee "/tmp/bench-${MODEL}.log" | grep --line-buffered -E "F1=|Nguong|judge\]|/20|Error|error"

  echo "[bench] KET THUC $MODEL  ($(date '+%H:%M:%S'))"

  # Giai phong RAM: tat runner cua model vua chay
  pkill -9 -f "llama-server" 2>/dev/null
  sleep 5
done

echo ""
echo "[bench] XONG TAT CA. Buoc tiep theo:"
echo "  npx ts-node --transpile-only scripts/benchmark/pareto.ts"
echo "  python3 scripts/gen-test-report.py"
