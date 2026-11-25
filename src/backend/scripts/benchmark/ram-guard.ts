/**
 * RAM Guard — chặn job AI khi tài nguyên máy không đủ.
 *
 * Yêu cầu (Phần 12 v8 §3.15.4 + Phần 13):
 *  - Tạm dừng nhận job AI mới khi RSS engine vượt 85% RAM máy.
 *  - Tạm dừng khi RAM khả dụng < 12 GB (VPS 15 GB — tránh OOM).
 *
 * Dùng đúng 2 biến đã khai báo trong `env.validation.ts`:
 *  - `AI_RAM_GUARD_PERCENT` (mặc định 85)
 *  - `AI_MIN_RAM_GB` (mặc định 12)
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync } from 'node:fs';

export interface RamGuardOptions {
  /** Ngưỡng phần trăm RAM hệ thống (mặc định 85). */
  ramGuardPercent?: number;
  /** Ngưỡng RAM khả dụng tối thiểu tính bằng GB (mặc định 12). */
  minRamGb?: number;
  /** Bỏ qua kiểm tra (dùng cho test). */
  skip?: boolean;
}

export interface RamStatus {
  /** RAM khả dụng (bytes). */
  availableBytes: number;
  /** Tổng RAM (bytes). */
  totalBytes: number;
  /** Tỉ lệ đã dùng 0..1. */
  usedRatio: number;
  /** RSS của tiến trình engine (bytes) — 0 nếu không đọc được. */
  engineRssBytes: number;
  /** true khi vượt ngưỡng → không được nhận job mới. */
  blocked: boolean;
  /** Lý do chặn (rỗng nếu không chặn). */
  reason: string;
}

/** Đọc /proc/meminfo (Linux) — trả về null nếu không đọc được. */
function readMemInfo(): { totalBytes: number; availableBytes: number } | null {
  try {
    const raw = readFileSync('/proc/meminfo', 'utf8');
    const totalMatch = /MemTotal:\s+(\d+) kB/.exec(raw);
    const availMatch = /MemAvailable:\s+(\d+) kB/.exec(raw);
    if (!totalMatch?.[1] || !availMatch?.[1]) return null;
    return {
      totalBytes: Number(totalMatch[1]) * 1024,
      availableBytes: Number(availMatch[1]) * 1024,
    };
  } catch {
    return null;
  }
}

/**
 * Tổng RSS của các tiến trình engine suy luận (tiến trình thực sự giữ model).
 * Dùng `ps` vì `/proc/<pid>/statm` không cho biết tiến trình nào là runner.
 *
 * Regex giống `SystemResourceGuardAdapter` của production (bao gồm `vllm`).
 */
export function readEngineRssBytes(): number {
  try {
    const out = execFileSync('ps', ['-eo', 'rss=,args='], { encoding: 'utf8' });
    let total = 0;
    for (const line of out.split('\n')) {
      // Ollama >= 0.40 đổi tên tiến trình suy luận: `ollama runner` → `llama-server`.
      // Không khớp tên mới thì peak_rss_bytes = 0 ⇒ chỉ số "RSS đỉnh" luôn = n/a.
      if (!/ollama\s+runner|ollama_runner|llama-server|vllm/.test(line)) continue;
      const rssKb = Number(line.trim().split(/\s+/)[0] ?? '0');
      if (Number.isFinite(rssKb)) total += rssKb * 1024;
    }
    return total;
  } catch {
    return 0;
  }
}

/** Đếm số tiến trình runner đang sống (dùng để đo headroom khi đổi model). */
export function countEngineRunners(): number {
  try {
    const entries = readdirSync('/proc').filter((e) => /^\d+$/.test(e));
    let count = 0;
    for (const pid of entries) {
      try {
        const cmd = readFileSync(`/proc/${pid}/cmdline`, 'utf8');
        if (/ollama.*runner|llama-server/.test(cmd)) count += 1;
      } catch {
        // tiến trình đã kết thúc — bỏ qua
      }
    }
    return count;
  } catch {
    return 0;
  }
}

/** Đánh giá trạng thái RAM hiện tại. */
export function evaluateRamStatus(options: RamGuardOptions = {}): RamStatus {
  const ramGuardPercent = options.ramGuardPercent ?? 85;
  const minRamGb = options.minRamGb ?? 12;
  const minRamBytes = minRamGb * 1024 ** 3;

  const mem = readMemInfo();
  const totalBytes = mem?.totalBytes ?? 0;
  const availableBytes = mem?.availableBytes ?? 0;
  const usedRatio = totalBytes > 0 ? 1 - availableBytes / totalBytes : 0;
  const engineRssBytes = readEngineRssBytes();

  if (options.skip) {
    return { availableBytes, totalBytes, usedRatio, engineRssBytes, blocked: false, reason: '' };
  }

  const reasons: string[] = [];
  if (totalBytes > 0 && usedRatio * 100 > ramGuardPercent) {
    reasons.push(
      `RAM hệ thống đã dùng ${(usedRatio * 100).toFixed(1)}% > ngưỡng ${ramGuardPercent}%`,
    );
  }
  if (totalBytes > 0 && availableBytes < minRamBytes) {
    reasons.push(
      `RAM khả dụng ${(availableBytes / 1024 ** 3).toFixed(2)} GB < ngưỡng tối thiểu ${minRamGb} GB`,
    );
  }
  if (engineRssBytes > 0 && totalBytes > 0 && (engineRssBytes / totalBytes) * 100 > ramGuardPercent) {
    reasons.push(
      `RSS engine ${(engineRssBytes / 1024 ** 3).toFixed(2)} GB vượt ${ramGuardPercent}% RAM máy`,
    );
  }

  return {
    availableBytes,
    totalBytes,
    usedRatio,
    engineRssBytes,
    blocked: reasons.length > 0,
    reason: reasons.join('; '),
  };
}
