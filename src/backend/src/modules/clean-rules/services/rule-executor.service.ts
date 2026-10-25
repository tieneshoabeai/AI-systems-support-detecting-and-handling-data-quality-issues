import { Injectable, Logger } from '@nestjs/common';
import { RuleDefinitionDto, RuleExecutionStat } from '../dto/clean-rule.dto';

export interface RuleExecutionResult {
  transformedRecords: Record<string, unknown>[];
  affectedRowsCount: number;
  droppedRowsCount: number;
  ruleStats: RuleExecutionStat[];
}

@Injectable()
export class RuleExecutorService {
  private readonly logger = new Logger(RuleExecutorService.name);

  /**
   * Thực thi danh sách quy tắc làm sạch xác định trên một mảng bản ghi trong bộ nhớ
   */
  executeRules(
    records: Record<string, unknown>[],
    rules: RuleDefinitionDto[]
  ): RuleExecutionResult {
    // Clone dữ liệu sâu để tránh làm thay đổi mảng đầu vào
    let currentRecords: Record<string, unknown>[] = records.map((r) => ({ ...r }));
    const initialRecordsCount = currentRecords.length;

    // Lưu vết các chỉ số dòng bị ảnh hưởng (sửa đổi giá trị ô hoặc bị xóa)
    const affectedRowIndices = new Set<number>();
    const ruleStats: RuleExecutionStat[] = [];

    for (const rule of rules) {
      let modifiedCellsCount = 0;
      const targetCol = rule.target_column;

      switch (rule.category) {
        case 'null_handling': {
          const res = this.applyNullHandling(currentRecords, rule);
          currentRecords = res.records;
          modifiedCellsCount = res.modifiedCount;
          for (const idx of res.affectedIndices) {
            affectedRowIndices.add(idx);
          }
          break;
        }

        case 'standardization': {
          const res = this.applyStandardization(currentRecords, rule);
          currentRecords = res.records;
          modifiedCellsCount = res.modifiedCount;
          for (const idx of res.affectedIndices) {
            affectedRowIndices.add(idx);
          }
          break;
        }

        case 'deduplication': {
          const res = this.applyDeduplication(currentRecords, rule);
          currentRecords = res.records;
          modifiedCellsCount = res.modifiedCount;
          for (const idx of res.affectedIndices) {
            affectedRowIndices.add(idx);
          }
          break;
        }

        case 'regex': {
          const res = this.applyRegex(currentRecords, rule);
          currentRecords = res.records;
          modifiedCellsCount = res.modifiedCount;
          for (const idx of res.affectedIndices) {
            affectedRowIndices.add(idx);
          }
          break;
        }

        default:
          this.logger.warn(`Bỏ qua quy tắc không rõ nhóm danh mục: ${rule.category}`);
      }

      ruleStats.push({
        action: rule.action,
        category: rule.category,
        target_column: targetCol,
        modified_cells_count: modifiedCellsCount,
      });
    }

    const droppedRowsCount = initialRecordsCount - currentRecords.length;

    return {
      transformedRecords: currentRecords,
      affectedRowsCount: affectedRowIndices.size + droppedRowsCount,
      droppedRowsCount,
      ruleStats,
    };
  }

  /**
   * 1. Nhóm Luật Xử lý Thiếu dữ liệu (Null Handling)
   */
  private applyNullHandling(
    records: Record<string, unknown>[],
    rule: RuleDefinitionDto
  ): { records: Record<string, unknown>[]; modifiedCount: number; affectedIndices: number[] } {
    const col = rule.target_column;
    if (!col) return { records, modifiedCount: 0, affectedIndices: [] };

    let modifiedCount = 0;
    const affectedIndices: number[] = [];

    if (rule.action === 'DROP_ROW') {
      const retained: Record<string, unknown>[] = [];
      for (let i = 0; i < records.length; i++) {
        const row = records[i];
        const val = row[col];
        const isNullOrEmpty =
          val === null ||
          val === undefined ||
          (typeof val === 'string' && val.trim() === '');

        if (!isNullOrEmpty) {
          retained.push(row);
        } else {
          modifiedCount++;
          affectedIndices.push(i);
        }
      }
      return { records: retained, modifiedCount, affectedIndices };
    }

    if (rule.action === 'FILL_DEFAULT') {
      const defaultValue = rule.parameters?.default_value ?? '';
      for (let i = 0; i < records.length; i++) {
        const row = records[i];
        const val = row[col];
        const isNullOrEmpty =
          val === null ||
          val === undefined ||
          (typeof val === 'string' && val.trim() === '');

        if (isNullOrEmpty) {
          row[col] = defaultValue;
          modifiedCount++;
          affectedIndices.push(i);
        }
      }
      return { records, modifiedCount, affectedIndices };
    }

    if (rule.action === 'FILL_MEAN' || rule.action === 'FILL_MEDIAN') {
      // 1. Tính toán giá trị số hợp lệ
      const numericValues: number[] = [];
      for (const row of records) {
        const val = row[col];
        if (typeof val === 'number' && !isNaN(val)) {
          numericValues.push(val);
        } else if (typeof val === 'string' && val.trim() !== '') {
          const num = Number(val);
          if (!isNaN(num)) numericValues.push(num);
        }
      }

      let fillVal = 0;
      if (numericValues.length > 0) {
        if (rule.action === 'FILL_MEAN') {
          const sum = numericValues.reduce((acc, curr) => acc + curr, 0);
          fillVal = Number((sum / numericValues.length).toFixed(2));
        } else {
          numericValues.sort((a, b) => a - b);
          const mid = Math.floor(numericValues.length / 2);
          fillVal =
            numericValues.length % 2 !== 0
              ? numericValues[mid]
              : Number(((numericValues[mid - 1] + numericValues[mid]) / 2).toFixed(2));
        }
      }

      for (let i = 0; i < records.length; i++) {
        const row = records[i];
        const val = row[col];
        const isNullOrEmpty =
          val === null ||
          val === undefined ||
          (typeof val === 'string' && val.trim() === '');

        if (isNullOrEmpty) {
          row[col] = fillVal;
          modifiedCount++;
          affectedIndices.push(i);
        }
      }
      return { records, modifiedCount, affectedIndices };
    }

    return { records, modifiedCount, affectedIndices };
  }

  /**
   * 2. Nhóm Luật Chuẩn hóa Dữ liệu (Standardization)
   */
  private applyStandardization(
    records: Record<string, unknown>[],
    rule: RuleDefinitionDto
  ): { records: Record<string, unknown>[]; modifiedCount: number; affectedIndices: number[] } {
    const col = rule.target_column;
    if (!col) return { records, modifiedCount: 0, affectedIndices: [] };

    let modifiedCount = 0;
    const affectedIndices: number[] = [];

    for (let i = 0; i < records.length; i++) {
      const row = records[i];
      const val = row[col];

      if (rule.action === 'TRIM' && typeof val === 'string') {
        const trimmed = val.trim().replace(/\s+/g, ' ');
        if (trimmed !== val) {
          row[col] = trimmed;
          modifiedCount++;
          affectedIndices.push(i);
        }
      } else if (rule.action === 'UPPERCASE' && typeof val === 'string') {
        const upper = val.toUpperCase();
        if (upper !== val) {
          row[col] = upper;
          modifiedCount++;
          affectedIndices.push(i);
        }
      } else if (rule.action === 'LOWERCASE' && typeof val === 'string') {
        const lower = val.toLowerCase();
        if (lower !== val) {
          row[col] = lower;
          modifiedCount++;
          affectedIndices.push(i);
        }
      } else if (rule.action === 'DATE_FORMAT') {
        if (val instanceof Date) {
          const isoDate = val.toISOString().split('T')[0];
          row[col] = isoDate;
          modifiedCount++;
          affectedIndices.push(i);
        } else if (typeof val === 'string' && val.trim() !== '') {
          const parsedTime = Date.parse(val);
          if (!isNaN(parsedTime)) {
            const dateObj = new Date(parsedTime);
            const isoDate = dateObj.toISOString().split('T')[0];
            if (isoDate !== val) {
              row[col] = isoDate;
              modifiedCount++;
              affectedIndices.push(i);
            }
          }
        }
      } else if (rule.action === 'NUMERIC_CAST') {
        if (typeof val === 'string' && val.trim() !== '') {
          const sanitized = val.replace(/[$€£₫,\s]/g, '');
          const num = Number(sanitized);
          if (!isNaN(num) && num !== (val as unknown as number)) {
            row[col] = num;
            modifiedCount++;
            affectedIndices.push(i);
          }
        }
      }
    }

    return { records, modifiedCount, affectedIndices };
  }

  /**
   * 3. Nhóm Luật Khử Trùng lặp (Deduplication)
   */
  private applyDeduplication(
    records: Record<string, unknown>[],
    rule: RuleDefinitionDto
  ): { records: Record<string, unknown>[]; modifiedCount: number; affectedIndices: number[] } {
    let modifiedCount = 0;
    const affectedIndices: number[] = [];

    if (rule.action === 'DROP_DUPLICATES') {
      const targetCols =
        rule.target_columns && rule.target_columns.length > 0
          ? rule.target_columns
          : rule.target_column
          ? [rule.target_column]
          : [];

      const keep = rule.parameters?.keep === 'last' ? 'last' : 'first';
      const seen = new Map<string, number>();
      const duplicateIndices = new Set<number>();

      for (let i = 0; i < records.length; i++) {
        const row = records[i];
        let key = '';
        if (targetCols.length > 0) {
          key = targetCols.map((c) => String(row[c] ?? '')).join('|');
        } else {
          key = Object.keys(row)
            .sort()
            .map((k) => String(row[k] ?? ''))
            .join('|');
        }

        if (seen.has(key)) {
          if (keep === 'first') {
            duplicateIndices.add(i);
          } else {
            const prevIndex = seen.get(key);
            if (prevIndex !== undefined) {
              duplicateIndices.add(prevIndex);
            }
            seen.set(key, i);
          }
        } else {
          seen.set(key, i);
        }
      }

      const retained: Record<string, unknown>[] = [];
      for (let i = 0; i < records.length; i++) {
        if (!duplicateIndices.has(i)) {
          retained.push(records[i]);
        } else {
          modifiedCount++;
          affectedIndices.push(i);
        }
      }

      return { records: retained, modifiedCount, affectedIndices };
    }

    return { records, modifiedCount, affectedIndices };
  }

  /**
   * 4. Nhóm Luật Biểu thức Chính quy (Regex Validation & Replacement)
   */
  private applyRegex(
    records: Record<string, unknown>[],
    rule: RuleDefinitionDto
  ): { records: Record<string, unknown>[]; modifiedCount: number; affectedIndices: number[] } {
    const col = rule.target_column;
    if (!col) return { records, modifiedCount: 0, affectedIndices: [] };

    let modifiedCount = 0;
    const affectedIndices: number[] = [];
    const patternStr = typeof rule.parameters?.pattern === 'string' ? rule.parameters.pattern : '';
    if (!patternStr) return { records, modifiedCount: 0, affectedIndices: [] };

    let regex: RegExp;
    try {
      const flags = typeof rule.parameters?.flags === 'string' ? rule.parameters.flags : 'g';
      regex = new RegExp(patternStr, flags);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(`Mẫu biểu thức chính quy không hợp lệ '${patternStr}': ${msg}`);
      return { records, modifiedCount: 0, affectedIndices: [] };
    }

    if (rule.action === 'REPLACE_PATTERN') {
      const replacement =
        typeof rule.parameters?.replacement === 'string' ? rule.parameters.replacement : '';

      for (let i = 0; i < records.length; i++) {
        const row = records[i];
        const val = row[col];
        if (typeof val === 'string') {
          // Reset lastIndex for global regex
          regex.lastIndex = 0;
          if (regex.test(val)) {
            regex.lastIndex = 0;
            row[col] = val.replace(regex, replacement);
            modifiedCount++;
            affectedIndices.push(i);
          }
        }
      }
      return { records, modifiedCount, affectedIndices };
    }

    if (rule.action === 'FILTER_PATTERN') {
      const retained: Record<string, unknown>[] = [];
      for (let i = 0; i < records.length; i++) {
        const row = records[i];
        const val = row[col];
        regex.lastIndex = 0;
        const matches = typeof val === 'string' && regex.test(val);
        if (matches) {
          retained.push(row);
        } else {
          modifiedCount++;
          affectedIndices.push(i);
        }
      }
      return { records: retained, modifiedCount, affectedIndices };
    }

    return { records, modifiedCount, affectedIndices };
  }
}
