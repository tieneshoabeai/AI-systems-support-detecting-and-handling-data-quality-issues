/**
 * Che giá trị trước khi đưa vào prompt AI / bằng chứng.
 * Đợt F (Phần 2 v11 mục 3.43, Phần 12 v10 mục 3.19) — che theo VAI TRÒ CỘT, thay cơ chế
 * "ô không che được thì loại" (làm mọi mẫu prompt rỗng):
 *
 * 1. Cột người dùng đánh dấu PII (`is_pii`) → `***`.
 * 2. Giá trị khớp mẫu email / số điện thoại / CCCD → `***`.
 * 3. Cột vai trò `identifier` / `text` → dạng mẫu (chữ thường → a, chữ hoa → A, số → d).
 * 4. Còn lại → giá trị thật.
 * Mọi giá trị cắt ≤ 40 ký tự.
 */

import type { AnalysisRole } from './column-role.util';

export const MASKED_TOKEN = '***';
export const MAX_SAMPLE_LENGTH = 40;

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

/** Cắt theo code point (không làm vỡ ký tự tiếng Việt / emoji). */
export function truncateChars(s: string, max = MAX_SAMPLE_LENGTH): string {
  const chars = Array.from(s);
  return chars.length <= max ? s : chars.slice(0, max).join('');
}

/**
 * Dạng mẫu của giá trị: chữ thường → `a`, chữ hoa → `A`, chữ số → `d`; giữ dấu câu và khoảng trắng.
 * Chuyển từ `toShapePattern` (Quality - Structure, profile/patterns.ts), áp cho cả chữ có dấu.
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
 * Che một ô cho AI / bằng chứng. Trả null với ô thiếu (không có giá trị để gửi).
 */
export function maskForAi(value: unknown, opts: MaskOptions): { value: string; kind: MaskKind } | null {
  if (value === null || value === undefined) return null;
  const s = (value instanceof Date ? value.toISOString() : String(value)).trim();
  if (s === '') return null;
  if (opts.markedPii || detectPiiType(s) !== null) return { value: MASKED_TOKEN, kind: 'pii' };
  if (opts.role === 'identifier' || opts.role === 'text') {
    return { value: truncateChars(toShapePattern(s)), kind: 'shape' };
  }
  return { value: truncateChars(s), kind: 'raw' };
}

/** Che toàn bộ mẫu của một cột, tối đa `maxSamples` giá trị (bỏ ô thiếu). */
export function maskColumnSamples(values: unknown[], opts: MaskOptions, maxSamples = 20): string[] {
  const samples: string[] = [];
  for (const v of values) {
    if (samples.length >= maxSamples) break;
    const m = maskForAi(v, opts);
    if (m) samples.push(m.value);
  }
  return samples;
}
