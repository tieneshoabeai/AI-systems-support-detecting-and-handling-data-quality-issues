/**
 * HTTP client tối giản cho benchmark — KHÔNG dùng `fetch` của Node.
 *
 * Lý do: `fetch` (undici) mặc định `headersTimeout = 300000` (5 phút).
 * Suy luận CPU-only của model 8B–14B với prompt ~1.500 token thường vượt 5 phút
 * → mọi request bị `UND_ERR_HEADERS_TIMEOUT` và cả bộ benchmark rơi vào trạng thái
 * "100% lỗi" dù engine hoạt động bình thường.
 *
 * `node:http` không có giới hạn header timeout, nên timeout được kiểm soát
 * hoàn toàn bằng `REQUEST_TIMEOUT_MS` trong `models.ts`.
 */
import http from 'node:http';

export interface HttpJsonResult {
  status: number;
  body: string;
  durationMs: number;
  error: string | null;
}

/**
 * POST JSON và nhận response dạng text.
 * @param timeoutMs timeout tổng cho request (mặc định không giới hạn ngoài socket).
 */
export async function postJson(
  url: string,
  payload: unknown,
  timeoutMs: number,
): Promise<HttpJsonResult> {
  const started = Date.now();
  const target = new URL(url);
  const body = JSON.stringify(payload);
  return new Promise<HttpJsonResult>((resolve) => {
    const req = http.request(
      {
        hostname: target.hostname,
        port: target.port || 80,
        path: `${target.pathname}${target.search}`,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(body),
        },
        timeout: timeoutMs,
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (c: Buffer) => chunks.push(c));
        res.on('end', () => {
          resolve({
            status: res.statusCode ?? 0,
            body: Buffer.concat(chunks).toString('utf8'),
            durationMs: Date.now() - started,
            error: null,
          });
        });
      },
    );
    req.on('timeout', () => {
      req.destroy();
      resolve({
        status: 0,
        body: '',
        durationMs: Date.now() - started,
        error: `timeout sau ${timeoutMs}ms`,
      });
    });
    req.on('error', (err: Error) => {
      resolve({
        status: 0,
        body: '',
        durationMs: Date.now() - started,
        error: err.message,
      });
    });
    req.write(body);
    req.end();
  });
}
