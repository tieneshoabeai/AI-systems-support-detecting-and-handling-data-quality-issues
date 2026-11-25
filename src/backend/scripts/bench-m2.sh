#!/usr/bin/env bash
# =============================================================================
# TAYNG 9 - BENCHMARK AI: chay not M2 (gemma3:12b) cho du 20 mau
# =============================================================================
# Boi canh:
#   - M1 qwen3:14b : DA XONG (20/20 mau) -> F1 0.875 | JSON 100% | judge 4.4
#   - M3 qwen3:8b  : DA XONG (20/20 mau) -> F1 0.435 | JSON  80% | judge 3.05
#   - M2 gemma3:12b: DANG DO (10/20 mau) - moi mau ~6-7 phut tren CPU
#   -> Script nay chay lai M2 tu dau (tu ghi de file ket qua).
#
# CANH BAO RAM: gemma3:12b dung ~11.5 GB RAM khi nap model.
#   Hay chay lenh nay khi da TAT Docker Desktop va cac app nang.
#   Neu RAM tran -> Ollama bi OOM-kill -> failure_rate tang -> ket qua sai.
#
# Dung:  bash scripts/bench-m2.sh
# =============================================================================
set -uo pipefail
cd "$(dirname "$0")/.."

# --- 0. Kiem tra RAM truoc khi nap model 12B ---------------------------------
AVAIL_GB=$(awk '/MemAvailable/ {printf "%d", $2/1024/1024}' /proc/meminfo)
echo "[bench] RAM kha dung: ${AVAIL_GB} GB"
if [ "${AVAIL_GB}" -lt 16 ]; then
  echo "[bench] CANH BAO: RAM kha dung < 16 GB -> gemma3:12b co the bi OOM-kill."
  echo "[bench]     Dong Docker Desktop / cac app nang roi chay lai."
  read -r -p "[bench] Nhan Enter de tiep tuc, Ctrl+C de huy: " _
fi

# --- 1. Bat Ollama native (neu chua chay) ------------------------------------
OLLAMA_BIN="${OLLAMA_BIN:-/tmp/ollama-new/bin/ollama}"
export OLLAMA_MODELS="${OLLAMA_MODELS:-$HOME/.ollama-models}"

if ! curl -sf -m 3 http://127.0.0.1:11434/api/version >/dev/null 2>&1; then
  echo "[bench] Khoi dong Ollama native ..."
  # Flash attention + KV cache q8_0 -> nhe RAM hon, nhanh hon tren GPU yeu.
  OLLAMA_FLASH_ATTENTION=1 OLLAMA_KV_CACHE_TYPE=q8_0 \
  OLLAMA_MAX_LOADED_MODELS=1 OLLAMA_NUM_PARALLEL=1 OLLAMA_CONTEXT_LENGTH=8192 \
    setsid nohup "$OLLAMA_BIN" serve > /tmp/ollama-serve.log 2>&1 < /dev/null &
  for i in $(seq 1 30); do
    curl -sf -m 2 http://127.0.0.1:11434/api/version >/dev/null 2>&1 && break
    sleep 1
  done
fi
echo "[bench] Ollama: $(curl -s -m 3 http://127.0.0.1:11434/api/version)"
echo "[bench] Models: $(curl -s http://127.0.0.1:11434/api/tags | python3 -c 'import json,sys;print([m["name"] for m in json.load(sys.stdin)["models"]])')"

# --- 2. Chay M2 voi 20 mau --------------------------------------------------
echo "[bench] Chay M2 gemma3:12b - 20 mau, 1 lan lap, co judge (cham cheo bang gemma3) ..."
BENCH_OLLAMA_URL=http://127.0.0.1:11434 AI_RAM_GUARD=off \
  npx ts-node --transpile-only scripts/benchmark/run-models.ts \
    --model=M2 --samples=20 --repeats=1 --judge=true \
    2>&1 | tee /tmp/bench-M2.log | grep -E "F1=|Nguong|judge\]|/20"

echo "[bench] Xong M2."
echo "[bench] Buoc tiep theo: pnpm run bench:pareto && pnpm run bench:stats"
