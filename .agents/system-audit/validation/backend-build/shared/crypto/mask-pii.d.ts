export declare function maskPhone(phone: string, visibleSuffix?: number): string;
export declare function maskEmail(email: string): string;
export declare function maskCitizenId(id: string): string;
export declare function maskPiiForLog(field: 'phone' | 'email' | 'citizenId', value: string): string;
export declare function sanitizeObjectForLog<T>(obj: T): T;
