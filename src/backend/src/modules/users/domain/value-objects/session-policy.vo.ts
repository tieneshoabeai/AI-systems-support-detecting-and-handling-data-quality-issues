/**
 * SESSION — Domain value objects cho vòng đời phiên đăng nhập.
 *
 * "Ghi nhớ đăng nhập" (remember me): phiên thường sống 7 ngày, phiên remember-me
 * sống 30 ngày. Hạn thực tế được lưu ở `user_sessions.expires_at` — đây là nguồn
 * sự thật (JWT refresh chỉ là token ngẫu nhiên lưu dạng hash).
 */

export const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export const SESSION_TTL_DAYS = 7;

/** Hạn phiên khi người dùng chọn "ghi nhớ đăng nhập" — 30 ngày. */
export const REMEMBER_ME_SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export const REMEMBER_ME_SESSION_TTL_DAYS = 30;

export function sessionExpiry(from: Date = new Date(), rememberMe = false): Date {
  const ttl = rememberMe ? REMEMBER_ME_SESSION_TTL_MS : SESSION_TTL_MS;
  return new Date(from.getTime() + ttl);
}

export function isSessionExpired(expiresAt: Date, now: Date = new Date()): boolean {
  return expiresAt.getTime() <= now.getTime();
}
