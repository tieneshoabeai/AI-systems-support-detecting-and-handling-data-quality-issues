import * as http from 'http';
import * as https from 'https';
import { URL } from 'url';

export interface PushNotificationOptions {
  title: string;
  message: string;
  priority?: 'min' | 'low' | 'default' | 'high' | 'urgent';
  tags?: string[];
}

const PRIORITY_MAP: Record<NonNullable<PushNotificationOptions['priority']>, number> = {
  min: 1,
  low: 2,
  default: 3,
  high: 4,
  urgent: 5,
};

/**
 * Gửi thông báo đẩy tức thì tới ntfy.sh qua JSON Body (Zero Any, hỗ trợ đầy đủ Unicode tiếng Việt).
 * Sử dụng HTTP/HTTPS Client gốc của Node.js để không phát sinh phụ thuộc bên ngoài.
 */
export async function sendPushNotification(options: PushNotificationOptions): Promise<boolean> {
  const enabled = process.env.NTFY_ENABLED === 'true';
  const baseUrl = process.env.NTFY_BASE_URL ?? 'https://ntfy.sh';
  const topic = process.env.NTFY_TOPIC?.trim();
  const token = process.env.NTFY_ACCESS_TOKEN?.trim();
  const timeoutMs = Number(process.env.NTFY_REQUEST_TIMEOUT_MS ?? 5000);

  if (!enabled || !topic) {
    return false;
  }

  const priorityNum = PRIORITY_MAP[options.priority ?? 'default'];

  const payloadObject = {
    topic,
    title: options.title,
    message: options.message,
    priority: priorityNum,
    tags: options.tags ?? [],
  };

  const payloadString = JSON.stringify(payloadObject);
  const payloadBuffer = Buffer.from(payloadString, 'utf8');

  return new Promise<boolean>((resolve) => {
    try {
      const url = new URL(baseUrl);
      const isHttps = url.protocol === 'https:';
      const client = isHttps ? https : http;

      const headers: Record<string, string | number> = {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Length': payloadBuffer.length,
      };

      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const req = client.request(
        {
          hostname: url.hostname,
          port: url.port ? Number(url.port) : isHttps ? 443 : 80,
          path: '/',
          method: 'POST',
          family: 4,
          headers,
          timeout: timeoutMs,
        },
        (res) => {
          res.resume(); // Tiêu thụ stream giải phóng memory socket
          const success = typeof res.statusCode === 'number' && res.statusCode >= 200 && res.statusCode < 300;
          resolve(success);
        }
      );

      req.on('timeout', () => {
        req.destroy();
        resolve(false);
      });

      req.on('error', () => {
        resolve(false);
      });

      req.write(payloadBuffer);
      req.end();
    } catch {
      resolve(false);
    }
  });
}
