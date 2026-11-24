/**
 * Google OAuth — helper dựng URL redirect về frontend sau khi đăng nhập (AUTH-03).
 *
 * Luồng: `GET /auth/google` → Google → `GET /auth/google/callback` → **redirect**
 * về `APP_URL` kèm token trong **fragment** (`#`), KHÔNG phải query string.
 *
 * Vì sao dùng fragment (`#`) chứ không phải query (`?`):
 *   - `access_token`/`refresh_token` là **bí mật**. Fragment KHÔNG được gửi lên
 *     server (không nằm trong HTTP request line) → không bị ghi vào access log
 *     của nginx/Cloudflare, không nằm trong `Referer`. Query string thì **có** bị ghi log.
 *   - Vẫn đọc được bằng `window.location.hash` ở frontend.
 *
 * Vì sao có `mode`:
 *   - `redirect` (mặc định khi có `APP_URL`) — trải nghiệm 1 tab: Google quay về
 *     backend → backend 302 về frontend → frontend đọc token trong fragment.
 *   - `json` — trả JSON envelope (giống hệt `POST /auth/login`) để frontend tự
 *     gọi `GET /auth/google/callback` bằng `fetch` (popup hoặc redirect_uri trực tiếp).
 *
 * Bảo mật:
 *   - Chỉ redirect về **origin** đã cấu hình (`APP_URL`) — KHÔNG nhận URL từ
 *     query/body (tránh open redirect).
 *   - Token trong fragment vẫn là **bí mật**: frontend phải xoá ngay sau khi đọc
 *     (`history.replaceState`) — đây là trách nhiệm của frontend, backend chỉ ghi chú.
 */

/** Chế độ trả kết quả của `GET /auth/google/callback`. */
export type GoogleCallbackMode = 'redirect' | 'json';

/**
 * Chuẩn hoá `APP_URL` về **origin** (scheme + host + port).
 *
 * Bỏ path/query/hash vì chỉ origin được phép nhận token.
 * Trả `null` nếu URL không hợp lệ.
 */
export function normalizeFrontendOrigin(appUrl: string | undefined): string | null {
  if (!appUrl || appUrl.trim().length === 0) return null;
  try {
    const url = new URL(appUrl.trim());
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    return url.origin;
  } catch {
    return null;
  }
}

/**
 * Dựng URL redirect về frontend kèm token trong fragment.
 *
 * @param appUrl   Giá trị `APP_URL` từ config (origin + path gốc của frontend).
 * @param params   Cặp key/value sẽ đưa vào fragment.
 * @param basePath Đường dẫn sau origin (ví dụ `/auth/callback`) — mặc định lấy từ `appUrl`.
 * @returns URL hoàn chỉnh, hoặc `null` nếu `APP_URL` không hợp lệ.
 */
export function buildFrontendRedirectUrl(
  appUrl: string | undefined,
  params: Record<string, string>,
  basePath?: string,
): string | null {
  const origin = normalizeFrontendOrigin(appUrl);
  if (!origin) return null;

  // Đường dẫn gốc của frontend (vd `/auth/callback`) — chỉ giữ path, bỏ query/hash.
  let path = '/';
  try {
    const parsed = new URL((appUrl ?? '').trim());
    path = parsed.pathname && parsed.pathname !== '/' ? parsed.pathname : '/';
  } catch {
    path = '/';
  }
  if (basePath && basePath !== '/') path = basePath;

  const search = new URLSearchParams(params).toString();
  return `${origin}${path}${search ? `#${search}` : ''}`;
}
