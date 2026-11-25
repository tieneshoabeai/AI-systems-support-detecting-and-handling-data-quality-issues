/**
 * Adapter đọc tài nguyên máy từ `/proc` (Linux) để bảo vệ VPS 15 GB.
 *
 * Nguồn sự thật: `/proc/meminfo` (MemTotal / MemAvailable) và RSS của tiến trình
 * engine suy luận (tìm theo tên tiến trình `ollama runner`).
 *
 * Không dùng `docker stats` vì engine chạy trực tiếp (không container) trong
 * triển khai hiện tại; nếu chuyển sang container thì thay nguồn đọc ở đây.
 */
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import {
  ResourceGuardPort,
  type ResourceGuardStatus,
} from '../../application/ports/resource-guard.port';

interface MemInfo {
  totalBytes: number;
  availableBytes: number;
}

@Injectable()
export class SystemResourceGuardAdapter extends ResourceGuardPort {
  private readonly ramGuardPercent: number;
  private readonly minRamBytes: number;
  /** Caching ngắn để không đọc /proc cho mỗi job. */
  private cached: { at: number; status: ResourceGuardStatus } | null = null;
  private static readonly CACHE_MS = 5000;

  constructor(config: ConfigService) {
    super();
    this.ramGuardPercent = config.get<number>('AI_RAM_GUARD_PERCENT') ?? 85;
    this.minRamBytes = (config.get<number>('AI_MIN_RAM_GB') ?? 12) * 1024 ** 3;
  }

  check(): ResourceGuardStatus {
    const now = Date.now();
    if (this.cached && now - this.cached.at < SystemResourceGuardAdapter.CACHE_MS) {
      return this.cached.status;
    }
    const mem = this.readMemInfo();
    const totalBytes = mem?.totalBytes ?? 0;
    const availableBytes = mem?.availableBytes ?? 0;
    const engineRssBytes = this.readEngineRssBytes();
    const usedRatio = totalBytes > 0 ? 1 - availableBytes / totalBytes : 0;

    const reasons: string[] = [];
    if (totalBytes > 0 && usedRatio * 100 > this.ramGuardPercent) {
      reasons.push(
        `RAM he thong da dung ${(usedRatio * 100).toFixed(1)}% > nguong ${this.ramGuardPercent}%`,
      );
    }
    if (totalBytes > 0 && availableBytes < this.minRamBytes) {
      reasons.push(
        `RAM kha dung ${(availableBytes / 1024 ** 3).toFixed(2)} GB < nguong toi thieu ${(this.minRamBytes / 1024 ** 3).toFixed(0)} GB`,
      );
    }
    if (engineRssBytes > 0 && totalBytes > 0 && (engineRssBytes / totalBytes) * 100 > this.ramGuardPercent) {
      reasons.push(
        `RSS engine ${(engineRssBytes / 1024 ** 3).toFixed(2)} GB vuot ${this.ramGuardPercent}% RAM may`,
      );
    }

    const status: ResourceGuardStatus = {
      blocked: reasons.length > 0,
      reason: reasons.join('; '),
      availableBytes,
      totalBytes,
      engineRssBytes,
    };
    this.cached = { at: now, status };
    return status;
  }

  canAcceptAiJob(): boolean {
    return !this.check().blocked;
  }

  blockReason(): string | null {
    const status = this.check();
    return status.blocked ? status.reason : null;
  }

  private readMemInfo(): MemInfo | null {
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

  private readEngineRssBytes(): number {
    try {
      const out = execFileSync('ps', ['-eo', 'rss=,args='], { encoding: 'utf8' });
      let total = 0;
      for (const line of out.split('\n')) {
        if (!/ollama\s+runner|ollama_runner|llama-server|vllm/.test(line)) continue;
        const rssKb = Number(line.trim().split(/\s+/)[0] ?? '0');
        if (Number.isFinite(rssKb)) total += rssKb * 1024;
      }
      return total;
    } catch {
      return 0;
    }
  }
}
