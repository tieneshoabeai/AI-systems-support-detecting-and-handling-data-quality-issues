export const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export const SESSION_TTL_DAYS = 7;

export function sessionExpiry(from: Date = new Date()): Date {
  return new Date(from.getTime() + SESSION_TTL_MS);
}

export function isSessionExpired(expiresAt: Date, now: Date = new Date()): boolean {
  return expiresAt.getTime() <= now.getTime();
}
