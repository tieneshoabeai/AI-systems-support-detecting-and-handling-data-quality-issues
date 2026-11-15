/**
 * Phần 12 v8 §3.6b — Quyết định nhóm A #2: Che PII trước khi đưa mẫu vào prompt AI.
 *
 * 1. Che theo KIỂU DỮ LIỆU (regex): email, số điện thoại, CCCD/CMND.
 * 2. Che theo CỘT NGƯỜI DÙNG ĐÁNH DẤU PII (dataset.columns[].is_pii = true).
 * 3. Ô không che được → LOẠI KHỎI PROMPT, không gửi đi.
 *
 * Giá trị đã che luôn dùng ký hiệu `***`.
 */

export const MASKED_TOKEN = '***';

export interface PiiMaskResult {
  /** true nếu giá trị được thay bằng *** */
  masked: boolean;
  /** true nếu giá trị phải bị loại khỏi prompt (không che được) */
  dropped: boolean;
  /** giá trị đã che, hoặc null nếu bị loại */
  value: string | null;
}

const EMAIL_RE = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;
const PHONE_RE = /^(?:\+?84|0)(?:\d[ .-]?){8,10}\d$/;
const CITIZEN_ID_RE = /^\d{9,13}$/;

/** Nhận diện PII theo kiểu giá trị (regex). */
export function detectPiiType(value: string): 'email' | 'phone' | 'citizen_id' | null {
  const trimmed = value.trim();
  if (EMAIL_RE.test(trimmed)) return 'email';
  if (PHONE_RE.test(trimmed)) return 'phone';
  if (CITIZEN_ID_RE.test(trimmed)) return 'citizen_id';
  return null;
}

/**
 * Che một ô đơn lẻ.
 * @param value giá trị gốc
 * @param columnMarkedPII cột có được người dùng đánh dấu PII không
 * @param dropUnmaskable có loại bỏ ô không che được khỏi prompt không
 */
export function maskCell(
  value: unknown,
  columnMarkedPII: boolean,
  dropUnmaskable = true,
): PiiMaskResult {
  if (value === null || value === undefined) {
    return { masked: false, dropped: false, value: null };
  }
  const s = String(value).trim();
  if (s === '') {
    return { masked: false, dropped: false, value: null };
  }

  // Cột đánh dấu PII → luôn che, không cần regex khớp.
  if (columnMarkedPII) {
    return { masked: true, dropped: false, value: MASKED_TOKEN };
  }

  // Regex theo kiểu dữ liệu.
  if (detectPiiType(s) !== null) {
    return { masked: true, dropped: false, value: MASKED_TOKEN };
  }

  // Không che được → loại khỏi prompt (an toàn mặc định).
  if (dropUnmaskable) {
    return { masked: false, dropped: true, value: null };
  }

  return { masked: false, dropped: false, value: s };
}

/**
 * Che toàn bộ mẫu của một cột.
 * @returns mảng giá trị đã che (đã loại ô không che được) + số ô bị loại
 */
export function maskColumnSamples(
  values: unknown[],
  columnMarkedPII: boolean,
  maxSamples = 20,
): { samples: string[]; droppedCount: number } {
  const samples: string[] = [];
  let droppedCount = 0;
  for (const v of values) {
    if (samples.length >= maxSamples) break;
    const res = maskCell(v, columnMarkedPII);
    if (res.dropped) {
      droppedCount++;
      continue;
    }
    if (res.value !== null) samples.push(res.value);
  }
  return { samples, droppedCount };
}
