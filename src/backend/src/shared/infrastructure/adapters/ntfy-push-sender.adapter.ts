import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  type PushMessage,
  type PushSenderPort,
} from '../../application/ports/push.port';

/**
 * Adapter PUSH_SENDER_PORT — gửi push notification qua `ntfy.sh`.
 *
 * Vì sao ntfy: là dịch vụ push HTTP đơn giản, không cần app di động, không
 * cần SDK — phù hợp cho môi trường dev/demo. Hợp đồng `PushSenderPort` không
 * gắn với vendor nên có thể thay bằng FCM/APNs mà không đổi tầng trên.
 *
 * Hành viết:
 *   - `NTFY_ENABLED=false` hoặc thiếu `NTFY_TOPIC` → `isConfigured()` = false.
 *   - Lỗi gửi → trả `false` + log cảnh báo. KHÔNG ném lỗi (push là kênh bổ sung).
 *   - Dùng `fetch` của Node 20+ → không cần thêm dependency.
 */
@Injectable()
export class NtfyPushSenderAdapter implements PushSenderPort {
  private readonly logger = new Logger(NtfyPushSenderAdapter.name);
  private readonly enabled: boolean;
  private readonly baseUrl: string;
  private readonly topic: string | undefined;
  private readonly accessToken: string | undefined;
  private readonly timeoutMs: number;

  constructor(config: ConfigService) {
    // `ConfigService` đã validate thành boolean, nhưng script kiểm chứng đọc
    // `process.env` thô (string) → chấp nhận cả hai dạng.
    const enabledRaw = config.get<boolean | string>('NTFY_ENABLED');
    this.enabled =
      enabledRaw === true ||
      (typeof enabledRaw === 'string' && enabledRaw.toLowerCase() === 'true');
    this.baseUrl = (config.get<string>('NTFY_BASE_URL') ?? 'https://ntfy.sh').replace(/\/+$/, '');
    this.topic = config.get<string>('NTFY_TOPIC')?.trim() || undefined;
    this.accessToken = config.get<string>('NTFY_ACCESS_TOKEN')?.trim() || undefined;
    this.timeoutMs = config.get<number>('NTFY_REQUEST_TIMEOUT_MS') ?? 5000;
  }

  isConfigured(): boolean {
    return this.enabled && Boolean(this.topic);
  }

  async send(message: PushMessage): Promise<boolean> {
    if (!this.isConfigured()) {
      this.logger.warn(
        'Chưa cấu hình ntfy (NTFY_ENABLED=true + NTFY_TOPIC) — bỏ qua gửi push.',
      );
      return false;
    }

    const title = message.title?.trim();
    const body = message.body?.trim();
    if (!title || !body) {
      this.logger.warn('Push thiếu `title` hoặc `body` — bỏ qua gửi.');
      return false;
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (this.accessToken) {
      headers['Authorization'] = `Bearer ${this.accessToken}`;
    }
    if (message.tags?.length) {
      headers['X-Tags'] = message.tags.join(',');
    }
    if (message.priority) {
      headers['X-Priority'] = message.priority;
    }
    if (message.click) {
      headers['X-Click'] = message.click;
    }
    if (message.email) {
      headers['X-Email'] = message.email;
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    (timer as unknown as { unref?: () => void }).unref?.();

    try {
      const response = await fetch(`${this.baseUrl}/${encodeURIComponent(this.topic ?? '')}`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ topic: this.topic, title, message: body }),
        signal: controller.signal,
      });
      if (!response.ok) {
        this.logger.warn(
          `ntfy từ chối yêu cầu (HTTP ${response.status}) — bỏ qua push.`,
        );
        return false;
      }
      this.logger.log(`Đã gửi push ntfy tới topic "${this.topic}".`);
      return true;
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Gửi push ntfy thất bại: ${msg}`);
      return false;
    } finally {
      clearTimeout(timer);
    }
  }
}
