export declare const MASKED_TOKEN = "***";
export interface PiiMaskResult {
    masked: boolean;
    dropped: boolean;
    value: string | null;
}
export declare function detectPiiType(value: string): 'email' | 'phone' | 'citizen_id' | null;
export declare function maskCell(value: unknown, columnMarkedPII: boolean, dropUnmaskable?: boolean): PiiMaskResult;
export declare function maskColumnSamples(values: unknown[], columnMarkedPII: boolean, maxSamples?: number): {
    samples: string[];
    droppedCount: number;
};
