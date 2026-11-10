export const USER_ROLES = ['admin', 'analyst'] as const;

export type UserRole = (typeof USER_ROLES)[number];

export const USER_STATUSES = ['active', 'blocked'] as const;

export type UserStatus = (typeof USER_STATUSES)[number];

export function isUserBlocked(status: string | null | undefined): boolean {
  return status === 'blocked';
}

export function isUserDeleted(deletedAt: Date | null | undefined): boolean {
  return deletedAt !== null && deletedAt !== undefined;
}

export function canUserLogin(status: string | null | undefined, deletedAt: Date | null | undefined): boolean {
  return !isUserBlocked(status) && !isUserDeleted(deletedAt);
}

export function normalizeEmail(email: string): string {
  return email.toLowerCase().trim();
}
