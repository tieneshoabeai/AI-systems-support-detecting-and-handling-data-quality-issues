import { Injectable } from '@nestjs/common';
import {
  makeFinding,
  type DatasetFinding,
} from '../../domain/services/finding.util';
import type { DatasetColumn, DatasetColumnIssue } from '../../domain/entities/dataset.entity';

/**
 * DATASETS — Dịch vụ phát hiện vấn đề dữ liệu (OPEN-03/04/05).
 *
 * Vì dataset **bất biến** sau khi nạp, hệ thống không sửa được gì ⇒ mọi vấn đề
 * phải được **báo cáo kèm vị trí lỗi cụ thể** để người dùng tự sửa file rồi
 * xoá dataset & nạp lại.
 *
 * Dịch vụ này **thuần** (không import infrastructure/persistence).
 */
@Injectable()
export class DatasetFindingService {
  /**
   * Chuyển lỗi tên cột (`columnIssues`) thành phát hiện.
   *
   * Lỗi tên cột là loại phát hiện **chặn phân tích** (GAP-003) → severity
   * `high`.
   */
  fromColumnIssues(
    issues: readonly DatasetColumnIssue[],
    columns: readonly DatasetColumn[],
  ): DatasetFinding[] {
    return issues.map((issue) => {
      const column = issue.columnKey
        ? columns.find((c) => c.key === issue.columnKey)
        : undefined;
      const type =
        issue.issue === 'empty_name'
          ? 'empty_name'
          : issue.issue === 'whitespace_only'
            ? 'whitespace_only'
            : 'duplicate_name';
      return makeFinding(type, 'high', issue.message, {
        columnKey: issue.columnKey,
        columnName: column?.name ?? null,
        rowIndex: null,
        details: { issue: issue.issue },
      });
    });
  }

  /**
   * Phát hiện dòng trống hoàn toàn (trailing blank row).
   *
   * OPEN-05: **không tự xoá** dòng rỗng — chỉ báo cáo.
   */
  detectBlankRows(
    headers: readonly string[],
    rows: ReadonlyArray<{ rowIndex: number; values: Record<string, unknown> }>,
  ): DatasetFinding[] {
    const findings: DatasetFinding[] = [];
    for (const row of rows) {
      const allEmpty = headers.every((h) => {
        const v = row.values[h];
        return v === null || v === undefined || (typeof v === 'string' && v.trim() === '');
      });
      if (allEmpty) {
        findings.push(
          makeFinding('blank_row', 'low', `Dòng ${row.rowIndex + 2} trống hoàn toàn (dòng trống ở cuối file).`, {
            columnKey: null,
            columnName: null,
            rowIndex: row.rowIndex,
            details: { csvLine: row.rowIndex + 2 },
          }),
        );
      }
    }
    return findings;
  }

  /**
   * Phát hiện ô có dấu phẩy cách bên trong giá trị — dấu hiệu lỗi xuống dòng.
   *
   * Ví dụ: cột `dia_chi` chứa `"123 Nguyễn Huệ, Quận 1"` trong file **không**
   * được quote ⇒ CSV parser sẽ tách nhầm thành 2 cột.
   */
  detectSuspiciousDelimiterInValue(
    headers: readonly string[],
    rows: ReadonlyArray<{ rowIndex: number; values: Record<string, unknown> }>,
  ): DatasetFinding[] {
    const findings: DatasetFinding[] = [];
    for (const row of rows) {
      headers.forEach((h, i) => {
        const v = row.values[h];
        if (typeof v !== 'string') return;
        // Dấu phẩy cách **bên trong** giá trị chỉ xuất hiện khi file KHÔNG quote
        // đúng ⇒ dấu hiệu lỗi xuống dòng / thiếu dấu ngoặc kép.
        if (!v.includes(',')) return;
        findings.push(
          makeFinding(
            'suspicious_delimiter_in_value',
            'medium',
            `Cột "${h}" (${`c${i}`}) dòng ${row.rowIndex + 2} chứa dấu phẩy cách bên trong giá trị — có thể do thiếu dấu ngoặc kép.`,
            {
              columnKey: `c${i}`,
              columnName: h,
              rowIndex: row.rowIndex,
              details: { csvLine: row.rowIndex + 2, valuePreview: v.slice(0, 120) },
            },
          ),
        );
      });
    }
    return findings;
  }

  /**
   * Gom nhiều nguồn phát hiện lại, sắp xếp theo mức độ nghiêm trọng giảm dần
   * rồi theo vị trí (dòng, cột).
   */
  merge(findings: readonly DatasetFinding[]): DatasetFinding[] {
    const ORDER: Record<string, number> = {
      critical: 0,
      high: 1,
      medium: 2,
      low: 3,
      info: 4,
    };
    return [...findings].sort((a, b) => {
      const bySeverity = (ORDER[a.severity] ?? 9) - (ORDER[b.severity] ?? 9);
      if (bySeverity !== 0) return bySeverity;
      const byRow = (a.rowIndex ?? -1) - (b.rowIndex ?? -1);
      if (byRow !== 0) return byRow;
      return (a.columnKey ?? '').localeCompare(b.columnKey ?? '');
    });
  }
}
