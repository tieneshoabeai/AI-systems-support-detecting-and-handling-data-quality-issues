/**
 * OPEN-05 (chốt 2026-11-19) — định dạng CSV được **thu hẹp** còn phẩy cách (`,`).
 *
 * Lý do: hỗ trợ 4 delimiter (`;`, tab, `|`) buộc phải có logic **đoán** (sniff)
 * dấu phân cách → mâu thuẫn với nguyên tắc "không tự chuẩn hoá dữ liệu theo suy
 * đoán". Thu hẹp về 1 định dạng là nhất quán nhất.
 *
 * File dùng dấu phân cách khác ⇒ **từ chối kèm lý do cụ thể**, không tự đoán.
 */
import { ValidationError } from '../../../../shared/domain/errors';

/** Dấu phân cách duy nhất được hỗ trợ. */
export const SUPPORTED_DELIMITER = ',';

/** Tên hiển thị của từng dấu phân cách (dùng trong thông báo lỗi). */
const DELIMITER_LABELS: Record<string, string> = {
  ',': 'phẩy cách (,)',
  ';': 'chấm phẩy (;)',
  '\t': 'tab (\\t)',
  '|': 'gạch dọc (|)',
};

/**
 * Bỏ dấu ngoặc kép bao quanh **từng ô** của một dòng CSV.
 *
 * Dùng để đếm dấu phân cách **ngoài** quoted field — nếu không, một dòng
 * `a,"b,c";d` sẽ bị đếm sai.
 */
function stripQuotedCells(line: string): string {
  let out = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i] as string;
    if (ch === '"') {
      // `""` là escape cho dấu ngoặc kép bên trong quoted field.
      if (inQuotes && line[i + 1] === '"') {
        i++;
        continue;
      }
      inQuotes = !inQuotes;
      continue;
    }
    if (!inQuotes) out += ch;
  }
  return out;
}

/**
 * Đếm số lần xuất hiện của mỗi dấu phân cách trong một dòng CSV (ngoài quoted field).
 */
export function countDelimiters(line: string): Record<string, number> {
  const stripped = stripQuotedCells(line);
  const counts: Record<string, number> = { ',': 0, ';': 0, '\t': 0, '|': 0 };
  for (const ch of stripped) {
    if (ch in counts) counts[ch] = (counts[ch] as number) + 1;
  }
  return counts;
}

/**
 * Tìm dấu phân cách **đáng ngờ** trong dòng header đầu tiên.
 *
 * @returns Dấu phân cách không được hỗ trợ tìm thấy, hoặc `null` nếu dòng header
 *          hợp lệ (phẩy cách, hoặc chỉ có 1 cột).
 */
export function findForbiddenDelimiter(headerLine: string): string | null {
  const counts = countDelimiters(headerLine);
  const comma = counts[','] as number;

  // Dòng header chỉ có 1 cột → không có dấu phân cách nào, hợp lệ (sẽ báo
  // "thiếu phân cách" ở bước kiểm tra số cột).
  if (comma === 0) {
    const others = Object.entries(counts).filter(([d, n]) => d !== ',' && n > 0);
    if (others.length === 0) return null;
    // Có dấu phân cách khác nhưng không có phẩy → file KHÔNG phải CSV phẩy cách.
    // Chọn dấu xuất hiện nhiều nhất (dấu phân cách thật của file).
    others.sort((a, b) => (b[1] as number) - (a[1] as number));
    return others[0]?.[0] as string;
  }

  // Có phẩy cách nhưng cũng có dấu khác → kiểm tra dấu khác có **nhiều hơn**
  // phẩy không (dấu phân cách thật) hay không.
  const others = Object.entries(counts).filter(([d, n]) => d !== ',' && (n as number) > 0);
  if (others.length === 0) return null;

  const top = others.sort((a, b) => (b[1] as number) - (a[1] as number))[0];
  if (!top) return null;
  const [delim, n] = top;
  // Dấu khác xuất hiện nhiều hơn phẩy → đó mới là dấu phân cách thật.
  if ((n as number) > comma) return delim;
  return null;
}

/**
 * Kiểm tra dòng header có phải CSV phẩy cách không — ném `ValidationError` nếu sai.
 *
 * @param headerLine Dòng header đầu tiên (đã đọc từ file, có thể có BOM).
 */
export function assertCommaDelimitedCsv(headerLine: string): void {
  const line = headerLine.replace(/^\uFEFF/, '').replace(/\r$/, '');
  const forbidden = findForbiddenDelimiter(line);
  if (forbidden) {
    const label = DELIMITER_LABELS[forbidden] ?? forbidden;
    throw new ValidationError(
      `File dùng dấu phân cách ${label}. Hệ thống chỉ nhận CSV phẩy cách (,) — ` +
        `vui lòng xuất lại file với dấu phẩy cách rồi tải lên.`,
      { reason: 'unsupported_delimiter', detectedDelimiter: forbidden, supported: ',' },
    );
  }
}

/**
 * Bỏ BOM UTF-8 ở đầu chuỗi (nếu có).
 *
 * Encoding chuẩn là UTF-8; BOM là biến thể "UTF-8 with BOM" — vẫn chấp nhận
 * nhưng phải bỏ BOM trước khi so khớp tên cột, nếu không cột đầu tiên sẽ có
 * tiền tố BOM và tên cột bị coi là trùng/lỗi.
 */
export function stripBom(text: string): string {
  return text.startsWith('\uFEFF') ? text.slice(1) : text;
}
