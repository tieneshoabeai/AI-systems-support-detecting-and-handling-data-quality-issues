export declare class CursorCodec {
    static encode<T extends Record<string, unknown>>(payload: T): string;
    static decode<T extends Record<string, unknown>>(cursor: string): T | null;
}
