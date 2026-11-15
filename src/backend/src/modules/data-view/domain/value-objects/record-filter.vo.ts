/**
 * DATA-VIEW — Value objects pure (domain).
 * Khong phu thuoc NestJS/Mongoose. Chua operator hop le + props path + resolve key.
 */

export const RECORD_FILTER_OPERATORS = [
  'equals',
  'notEquals',
  'contains',
  'notContains',
  'startsWith',
  'endsWith',
  'greaterThan',
  'greaterThanOrEqual',
  'lessThan',
  'lessThanOrEqual',
  'between',
  'in',
  'isEmpty',
  'isNotEmpty',
] as const;

export type RecordFilterOperator = (typeof RECORD_FILTER_OPERATORS)[number];

export function isValidOperator(op: string): op is RecordFilterOperator {
  return (RECORD_FILTER_OPERATORS as readonly string[]).includes(op);
}

export function propsPath(columnKey: string): string {
  return `props.${columnKey}`;
}

/** Giai key cot: uu tien key c{i}, sau do ten hien thi / ten goc. Pure, dung o application. */
export function resolveColumnKeyPure(
  input: string,
  keys: string[],
  names: Map<string, string>,
): string | null {
  if (keys.includes(input)) return input;
  const hit = names.get(input);
  return hit ?? null;
}
