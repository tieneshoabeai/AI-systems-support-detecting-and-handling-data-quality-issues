export interface DescriptiveStat {
    column: string;
    dataType: string;
    count: number;
    missingCount: number;
    invalidCount: number;
    mean: number | null;
    median: number | null;
    min: number | null;
    max: number | null;
    stdev: number | null;
    q1: number | null;
    q3: number | null;
    distinctCount: number | null;
    topValues: {
        value: string;
        count: number;
    }[] | null;
    reason: string | null;
}
export declare function describeColumn(column: string, dataType: string, rawValues: unknown[]): DescriptiveStat;
export interface ImbalanceResult {
    status: 'no_label' | 'not_applicable_continuous' | 'no_valid_labels' | 'single_class' | 'evaluated';
    labelColumn: string | null;
    classes: {
        value: string;
        count: number;
        rate: number | null;
    }[];
    classCount: number;
    largest: string[];
    smallest: string[];
    imbalanceRatio: number | null;
    warning: string | null;
    validRows: number;
    missingLabelRows: number;
    reason: string | null;
}
export declare function evaluateImbalance(labelColumn: string | null, labelDataType: string | null, rows: Record<string, unknown>[]): ImbalanceResult;
export interface TimeBucket {
    period: string;
    recordCount: number;
    validCount: number;
    missingCount: number;
    invalidCount: number;
    median: number | null;
    mean: number | null;
    min: number | null;
    max: number | null;
    sum: number | null;
}
export interface TimeAnalysis {
    status: 'no_time_column' | 'evaluated' | 'insufficient_data';
    timeColumn: string | null;
    granularity: 'day' | 'week' | 'month' | 'year';
    buckets: TimeBucket[];
    emptyBuckets: string[];
    longestEmptyRun: number;
    deltas: {
        period: string;
        absChange: number | null;
        pctChange: number | null;
    }[];
    volatilePeriods: string[];
    reason: string | null;
}
export declare function analyzeTime(timeColumn: string | null, valueColumn: string | null, rows: Record<string, unknown>[], granularity?: TimeAnalysis['granularity']): TimeAnalysis;
