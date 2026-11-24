/**
 * Phần 12 v8 §3.6b — Quyết định nhóm A #2: Che PII trước khi đưa mẫu vào prompt AI.
 *
 * 1. Che theo KIỂU DỮ LIỆU (regex): email, số điện thoại, CCCD/CMND → `***`.
 * 2. Che theo CỘT ĐƯỢC ĐÁNH DẤU PII (dataset.columns[].is_pii = true) → `***`.
 * 3. Cột vai trò `identifier` / `text` → dạng mẫu (shape), không lộ giá trị thật.
 * 4. Giá trị thường còn lại → gửi thô (cắt 40 ký tự).
 *
 * `maskCell()` giữ hành vi cũ (nghiêm ngặt: giá trị lạ → dropped) để tương
 * thích test/regex. Luồng prompt AI dùng `maskForAi()` phía dưới.
 *
 * Giá trị đã che luôn dùng ký hiệu `***`.
 */
import type { AnalysisRole } from './column-role.util';

export const MASKED_TOKEN = '***';

/** Độ dài tối đa của một mẫu giá trị gửi cho AI / hiển thị bằng chứng. */
export const MAX_SAMPLE_LENGTH = 40;

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

// ─────────────────────────────────────────────────────────────────────────────
// GĐ2 — Che theo VAI TRÒ CỘT (port từ `Vqd_BE`).
//
// Cơ chế cũ ("ô không che được thì loại") làm mọi mẫu prompt rỗng khi cột
// chứa giá trị lạ. Nay che theo thứ tự:
//   1. Cột người dùng đánh dấu PII (`is_pii`) → `***`.
//   2. Giá trị khớp mẫu email / số điện thoại / CCCD → `***`.
//   3. Cột vai trò `identifier` / `text` → dạng mẫu (chữ thường → a, chữ hoa → A, số → d).
//   4. Còn lại → giá trị thật (cắt ≤ 40 ký tự).
// ─────────────────────────────────────────────────────────────────────────────

/** Cắt theo code point (không làm vỡ ký tự tiếng Việt / emoji). */
export function truncateChars(s: string, max = MAX_SAMPLE_LENGTH): string {
  const chars = Array.from(s);
  return chars.length <= max ? s : chars.slice(0, max).join('');
}

/**
 * Dạng mẫu của giá trị: chữ thường → `a`, chữ hoa → `A`, chữ số → `d`; giữ dấu câu và khoảng trắng.
 */
export function toShapePattern(value: string): string {
  let out = '';
  for (const ch of value) {
    if (/\p{Nd}/u.test(ch)) out += 'd';
    else if (/\p{Lu}/u.test(ch)) out += 'A';
    else if (/\p{L}/u.test(ch)) out += 'a';
    else out += ch;
  }
  return out;
}

export interface MaskOptions {
  /** Cột được người dùng đánh dấu PII. */
  markedPii: boolean;
  /** Vai trò cột phân tích; không có → coi như giá trị thường. */
  role?: AnalysisRole | null;
}

export type MaskKind = 'pii' | 'shape' | 'raw';

/**
 * Che một ô cho AI / bằng chứng / nhóm Nghi vấn. Trả null với ô thiếu (không có giá trị để gửi).
 */
export function maskForAi(
  value: unknown,
  opts: MaskOptions,
): { value: string; kind: MaskKind } | null {
  if (value === null || value === undefined) return null;
  const s = (value instanceof Date ? value.toISOString() : String(value)).trim();
  if (s === '') return null;
  if (opts.markedPii || detectPiiType(s) !== null) return { value: MASKED_TOKEN, kind: 'pii' };
  if (opts.role === 'identifier' || opts.role === 'text') {
    return { value: truncateChars(toShapePattern(s)), kind: 'shape' };
  }
  return { value: truncateChars(s), kind: 'raw' };
}
