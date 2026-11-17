export declare const ACCESS_TOKEN_TTL_SECONDS: number;
export declare const REFRESH_TOKEN_TTL_MS: number;
export declare const REFRESH_TOKEN_BYTES = 40;
export declare const DEFAULT_SALT_ROUNDS = 12;
export declare function refreshTokenExpiry(from?: Date): Date;
export declare function isAccountLocked(status: string | null | undefined): boolean;
