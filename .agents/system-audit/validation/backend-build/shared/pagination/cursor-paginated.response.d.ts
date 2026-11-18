export interface CursorMeta {
    nextCursor: string | null;
    hasMore: boolean;
}
export interface CursorPaginatedResponse<T> {
    items: T[];
    meta: CursorMeta;
    next_cursor?: string | null;
    has_more?: boolean;
}
export declare function createCursorPaginatedResponse<T>(items: T[], limit: number, getCursorPayload: (item: T) => Record<string, unknown>): CursorPaginatedResponse<T>;
