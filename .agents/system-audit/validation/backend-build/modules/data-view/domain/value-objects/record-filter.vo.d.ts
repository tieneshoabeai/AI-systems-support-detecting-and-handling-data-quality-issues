export declare const RECORD_FILTER_OPERATORS: readonly ['equals', 'notEquals', 'contains', 'notContains', 'startsWith', 'endsWith', 'greaterThan', 'greaterThanOrEqual', 'lessThan', 'lessThanOrEqual', 'between', 'in', 'isEmpty', 'isNotEmpty'];
export type RecordFilterOperator = (typeof RECORD_FILTER_OPERATORS)[number];
export declare function isValidOperator(op: string): op is RecordFilterOperator;
export declare function propsPath(columnKey: string): string;
export declare function resolveColumnKeyPure(input: string, keys: string[], names: Map<string, string>): string | null;
