export declare const SESSION_TTL_MS: number;
export declare const SESSION_TTL_DAYS = 7;
export declare function sessionExpiry(from?: Date): Date;
export declare function isSessionExpired(expiresAt: Date, now?: Date): boolean;
