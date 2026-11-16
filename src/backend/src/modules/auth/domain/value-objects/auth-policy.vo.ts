export const ACCESS_TOKEN_TTL_SECONDS = 15 * 60;

export const REFRESH_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export const REFRESH_TOKEN_BYTES = 40;

export const DEFAULT_SALT_ROUNDS = 12;

export function refreshTokenExpiry(from: Date = new Date()): Date {
  return new Date(from.getTime() + REFRESH_TOKEN_TTL_MS);
}

export function isAccountLocked(status: string | null | undefined): boolean {
  return status === 'blocked';
}
