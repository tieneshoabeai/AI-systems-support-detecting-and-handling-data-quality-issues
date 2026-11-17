export declare const USER_ROLES: readonly ['admin', 'analyst'];
export type UserRole = (typeof USER_ROLES)[number];
export declare const USER_STATUSES: readonly ['active', 'blocked'];
export type UserStatus = (typeof USER_STATUSES)[number];
export declare function isUserBlocked(status: string | null | undefined): boolean;
export declare function isUserDeleted(deletedAt: Date | null | undefined): boolean;
export declare function canUserLogin(status: string | null | undefined, deletedAt: Date | null | undefined): boolean;
export declare function normalizeEmail(email: string): string;
