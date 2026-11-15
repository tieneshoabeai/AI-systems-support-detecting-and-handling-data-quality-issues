import { Injectable } from '@nestjs/common';
import type {
  DatasetColumnIssueRecord,
  DatasetColumnRecord,
} from '../../domain/ports/dataset.repository.port';

export interface InferredSchema {
  columns: DatasetColumnRecord[];
  issues: DatasetColumnIssueRecord[];
}

/**
 * Wave 4 (S21/M14): suy luan schema voi key cot on dinh c0..cN.
 * - key = `c{i}` theo vi tri, bat bien khi doi ten.
 * - name = ten hien thi (ban dau = ten goc giu nguyen, KHONG trim/sanitize).
 * - originalName = ten goc tu file CSV (dung cho Reset/M15).
 * - Ten rong/trung/whitespace -> columnIssues (chap nhan file, chan phan tich sau).
 * Application service thuan tuy: khong import infrastructure/persistence.
 */
@Injectable()
export class SchemaInferenceService {
  inferSchema(headers: string[], sampleRows: Record<string, unknown>[]): DatasetColumnRecord[] {
    return this.inferSchemaWithIssues(headers, sampleRows).columns;
  }

  inferSchemaWithIssues(headers: string[], sampleRows: Record<string, unknown>[]): InferredSchema {
    const columns: DatasetColumnRecord[] = headers.map((header, i) => {
      const values = sampleRows
        .map((row) => row[header])
        .filter((val) => val !== undefined);

      let missingCount = 0;
      const nonNullValues: unknown[] = [];

      for (const val of values) {
        if (this.isNullOrEmpty(val)) {
          missingCount++;
        } else {
          nonNullValues.push(val);
        }
      }

      return {
        key: `c${i}`,
        index: i,
        name: header,
        originalName: header,
        dataType: this.detectDataType(nonNullValues),
        missingCount,
        isPii: false,
      };
    });
    return { columns, issues: this.detectColumnIssues(headers) };
  }

  /** Phat hien ten cot rong / chi whitespace / trung (so sanh chinh xac, case-sensitive). */
  detectColumnIssues(headers: string[]): DatasetColumnIssueRecord[] {
    const issues: DatasetColumnIssueRecord[] = [];
    const seen = new Map<string, number>();
    headers.forEach((h, i) => {
      const key = `c${i}`;
      if (h === '') {
        issues.push({ columnKey: key, issue: 'empty_name', message: `Cot ${key} co ten rong` });
      } else if (/^\s+$/.test(h)) {
        issues.push({ columnKey: key, issue: 'whitespace_only', message: `Cot ${key} chi chua khoang trang` });
      }
      const first = seen.get(h);
      if (first !== undefined && h !== '') {
        issues.push({ columnKey: key, issue: 'duplicate_name', message: `Ten cot "${h}" bi trung (cot c${first} va ${key})` });
      } else if (first === undefined) {
        seen.set(h, i);
      }
    });
    return issues;
  }

  private isNullOrEmpty(val: unknown): boolean {
    if (val === null || val === undefined) return true;
    if (typeof val === 'string') {
      const str = val.trim().toLowerCase();
      return str === '' || str === 'null' || str === 'undefined' || str === 'na' || str === 'n/a';
    }
    return false;
  }

  private detectDataType(values: unknown[]): DatasetColumnRecord['dataType'] {
    if (values.length === 0) return 'string';

    let booleanCount = 0;
    let numberCount = 0;
    let dateCount = 0;

    for (const val of values) {
      if (typeof val === 'boolean') {
        booleanCount++;
      } else if (typeof val === 'number') {
        numberCount++;
      } else if (typeof val === 'string') {
        const trimmed = val.trim();
        if (this.isBooleanString(trimmed)) {
          booleanCount++;
        } else if (this.isNumericString(trimmed)) {
          numberCount++;
        } else if (this.isDateString(trimmed)) {
          dateCount++;
        }
      }
    }

    const total = values.length;
    const threshold = 0.8;

    if (numberCount / total >= threshold) return 'number';
    if (booleanCount / total >= threshold) return 'boolean';
    if (dateCount / total >= threshold) return 'date';

    return 'string';
  }

  private isBooleanString(str: string): boolean {
    const lower = str.toLowerCase();
    return lower === 'true' || lower === 'false' || lower === 'yes' || lower === 'no';
  }

  private isNumericString(str: string): boolean {
    if (str === '') return false;
    const num = Number(str);
    return !isNaN(num) && isFinite(num);
  }

  private isDateString(str: string): boolean {
    if (!str.includes('-') && !str.includes('/')) return false;
    const timestamp = Date.parse(str);
    return !isNaN(timestamp);
  }
}
