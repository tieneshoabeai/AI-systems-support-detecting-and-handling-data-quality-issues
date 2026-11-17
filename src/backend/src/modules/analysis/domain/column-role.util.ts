/**
 * Đợt F (Phần 2 v11 mục 3.43, Phần 12 v10 mục 3.19) — vai trò cột phân tích.
 * Chuyển từ `inferRole` (Quality - Structure, packages/core/src/profile/infer-role.ts) cho kiểu cột của dataset.
 * Vai trò quyết định cột nào vào tương quan / VIF / DQ-04; tách khỏi kiểu dữ liệu (DQ-03).
 */

export const ANALYSIS_ROLES = ['identifier', 'category', 'measure', 'text', 'datetime'] as const;
export type AnalysisRole = (typeof ANALYSIS_ROLES)[number];

/** Token tên cột gợi ý mã định danh (chỉ là điều kiện cần, không đủ — không suy định danh chỉ từ tên). */
export const IDENTIFIER_NAME_TOKENS = ['id', 'code', 'zip', 'phone'] as const;
/** Tỷ lệ giá trị khác nhau / số ô hợp lệ tối thiểu để coi là định danh ("≈ 100%"). */
export const IDENTIFIER_MIN_DISTINCT_RATIO = 0.95;
/** Phân loại khi giá trị có lặp lại: khác nhau ≤ 50% số ô hợp lệ. */
export const CATEGORY_MAX_DISTINCT_OF_VALID = 0.5;
/** Số giá trị khác nhau tối đa để là phân loại. */
export const CATEGORY_MAX_DISTINCT = 20;
/** Cột chữ: khác nhau ≤ 5% số dòng cũng là phân loại. */
export const CATEGORY_MAX_DISTINCT_RATIO_OF_ROWS = 0.05;

export interface RoleColumnInput {
  key: string;
  name: string;
  dataType: string;
}

export interface ColumnRoleInfo {
  key: string;
  name: string;
  role: AnalysisRole;
  source: 'system' | 'user';
  uncertain: boolean;
  reason: string;
}

/** Tách tên cột thành token thường: snake_case, kebab, khoảng trắng, camelCase/PascalCase. */
export function nameTokens(name: string): string[] {
  return name
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .split(/[^A-Za-z0-9]+/)
    .filter((t) => t.length > 0)
    .map((t) => t.toLowerCase());
}

export function hasIdentifierName(name: string): boolean {
  const tokens = nameTokens(name);
  return tokens.some((t) => (IDENTIFIER_NAME_TOKENS as readonly string[]).includes(t));
}

function isMissing(v: unknown): boolean {
  return v === null || v === undefined || (typeof v === 'string' && v.trim() === '');
}

interface ValueProfile {
  valid: number;
  distinct: number;
  allInteger: boolean;
}

function profileValues(values: unknown[], dataType: string): ValueProfile {
  const seen = new Set<string>();
  let valid = 0;
  let allInteger = true;
  for (const v of values) {
    if (isMissing(v)) continue;
    if (dataType === 'number') {
      const n = typeof v === 'number' ? v : Number(String(v).trim());
      if (!Number.isFinite(n)) continue; // lệch kiểu — DQ-03 xử lý, không tính vào vai trò
      if (!Number.isInteger(n)) allInteger = false;
      seen.add(String(n));
    } else {
      seen.add(String(v).trim());
    }
    valid++;
  }
  return { valid, distinct: seen.size, allInteger: valid > 0 && allInteger };
}

/** Suy vai trò một cột từ kiểu dataset + toàn bộ giá trị. */
export function inferColumnRole(
  col: RoleColumnInput,
  values: unknown[],
  rowCount: number,
): { role: AnalysisRole; uncertain: boolean; reason: string } {
  if (col.dataType === 'date') return { role: 'datetime', uncertain: false, reason: 'date_type' };
  if (col.dataType === 'boolean') return { role: 'category', uncertain: false, reason: 'boolean_type' };
  const p = profileValues(values, col.dataType);
  if (p.valid === 0) return { role: 'text', uncertain: true, reason: 'no_valid_values' };
  const idName = hasIdentifierName(col.name);
  const distinctOfValid = p.distinct / p.valid;

  if (col.dataType === 'number') {
    if (p.allInteger && idName && distinctOfValid >= IDENTIFIER_MIN_DISTINCT_RATIO) {
      return { role: 'identifier', uncertain: false, reason: 'identifier_name_and_unique_integer' };
    }
    if (p.distinct <= CATEGORY_MAX_DISTINCT && distinctOfValid <= CATEGORY_MAX_DISTINCT_OF_VALID) {
      return { role: 'category', uncertain: true, reason: 'numeric_few_repeated_values' };
    }
    return { role: 'measure', uncertain: idName, reason: idName ? 'identifier_name_but_not_unique' : 'numeric' };
  }

  // string (và kiểu lạ coi như chuỗi)
  if (idName && distinctOfValid >= IDENTIFIER_MIN_DISTINCT_RATIO) {
    return { role: 'identifier', uncertain: false, reason: 'identifier_name_and_unique' };
  }
  if (distinctOfValid > CATEGORY_MAX_DISTINCT_OF_VALID) {
    return { role: 'text', uncertain: idName, reason: 'mostly_unique_text' };
  }
  if (p.distinct <= CATEGORY_MAX_DISTINCT) {
    return { role: 'category', uncertain: idName, reason: 'few_distinct_values' };
  }
  if (rowCount > 0 && p.distinct / rowCount <= CATEGORY_MAX_DISTINCT_RATIO_OF_ROWS) {
    return { role: 'category', uncertain: idName, reason: 'low_distinct_ratio' };
  }
  return { role: 'text', uncertain: true, reason: 'many_distinct_values' };
}

/** Vai trò người dùng được phép gán cho từng kiểu cột (sai → `invalid_column_role`). */
export function isRoleAllowedForType(role: AnalysisRole, dataType: string): boolean {
  if (role === 'measure') return dataType === 'number';
  if (role === 'datetime') return dataType === 'date';
  return dataType !== 'date';
}

/**
 * Suy vai trò cho các cột, áp ghi đè của người dùng.
 * @param rows dòng theo TÊN cột hiện tại
 * @param overrides map key → vai trò (đã kiểm hợp lệ ở lớp ứng dụng)
 */
export function inferColumnRoles(
  columns: RoleColumnInput[],
  rows: Record<string, unknown>[],
  overrides: Record<string, string> | null | undefined,
): ColumnRoleInfo[] {
  return columns.map((c) => {
    const ov = overrides?.[c.key];
    if (ov && (ANALYSIS_ROLES as readonly string[]).includes(ov)) {
      return { key: c.key, name: c.name, role: ov as AnalysisRole, source: 'user', uncertain: false, reason: 'user_override' };
    }
    const r = inferColumnRole(c, rows.map((row) => row[c.name]), rows.length);
    return { key: c.key, name: c.name, ...r, source: 'system' };
  });
}

/** Lý do loại khỏi tương quan/VIF theo vai trò; null nếu cột được dùng. */
export function correlationExclusionReason(role: AnalysisRole): string | null {
  if (role === 'identifier') return 'identifier_column_excluded';
  if (role === 'text') return 'free_text_column_excluded';
  if (role === 'datetime') return 'date_column_excluded_from_correlation_vif';
  return null;
}
