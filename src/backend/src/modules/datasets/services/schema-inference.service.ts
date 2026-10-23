import { Injectable } from '@nestjs/common';
import { ColumnDataType, IColumnDefinition } from '../schemas/dataset.schema';

@Injectable()
export class SchemaInferenceService {
  /**
   * Suy luận kiểu dữ liệu Tầng 0 dựa trên tối đa 500 dòng mẫu đầu tiên
   */
  inferSchema(headers: string[], sampleRows: Record<string, unknown>[]): IColumnDefinition[] {
    return headers.map((header) => {
      const sanitizedName = this.sanitizeColumnName(header);
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

      const dataType = this.detectDataType(nonNullValues);

      return {
        name: sanitizedName,
        original_name: header,
        data_type: dataType,
        missing_count: missingCount,
      };
    });
  }

  /**
   * Chuẩn hóa tên cột thành snake_case an toàn cho MongoDB field name
   */
  sanitizeColumnName(rawHeader: string): string {
    const trimmed = rawHeader.trim();
    if (!trimmed) return 'column_unnamed';

    return trimmed
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Bỏ dấu tiếng Việt
      .replace(/[^a-z0-9_]+/g, '_')     // Thay ký tự đặc biệt thành dấu gạch dưới
      .replace(/^_+|_+$/g, '')          // Bỏ gạch dưới ở đầu/cuối
      || 'column';
  }

  private isNullOrEmpty(val: unknown): boolean {
    if (val === null || val === undefined) return true;
    if (typeof val === 'string') {
      const str = val.trim().toLowerCase();
      return str === '' || str === 'null' || str === 'undefined' || str === 'na' || str === 'n/a';
    }
    return false;
  }

  private detectDataType(values: unknown[]): ColumnDataType {
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
    const threshold = 0.8; // 80% số bản ghi khớp

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
    // Chỉ kiểm tra các chuỗi có định dạng ngày (chứa - hoặc /)
    if (!str.includes('-') && !str.includes('/')) return false;
    const timestamp = Date.parse(str);
    return !isNaN(timestamp);
  }
}
