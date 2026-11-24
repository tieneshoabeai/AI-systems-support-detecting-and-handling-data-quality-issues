/**
 * FEEDBACK — Khuôn mẫu học lại RAG (T1) — hàm thuần.
 *
 * Dùng chung cho `FeedbackService.syncFindingExample` và migration
 * `scripts/migrate-scrub-few-shot-examples.ts` (đóng OPEN-FB-01), để hai nơi
 * sinh **cùng một** mẫu cho cùng (finding, nhãn) — Phần 12 v17 §3.24.
 *
 * Không phụ thuộc NestJS/Mongoose.
 */
import {
  extractErrorType,
  mapFeedbackLabelToExampleLabel,
  stripIdentifiers,
  type FewShotExample,
} from '../analysis';
import { FEEDBACK_LABELS } from './feedback.types';

/** Độ dài tối đa của đặc tính cột trong mẫu RAG (Phần 12 v15 §3.24 T1-2). */
export const MAX_COLUMN_TRAITS_LENGTH = 80;

/** Cụm mô tả theo nhãn mẫu (Phần 12 v15 §3.24 T1-1) — KHÔNG dùng `reason` người dùng. */
export const EXAMPLE_LABEL_PHRASES: Readonly<Record<FewShotExample['label'], string>> = {
  correct: 'AI phát hiện đúng',
  false_positive: 'AI báo nhầm, không phải lỗi',
  missed_issue: 'AI bỏ sót vấn đề',
};

/**
 * Làm sạch đặc tính cột (T1-2): bỏ PII, ký tự điều khiển / xuống dòng, đổi dấu
 * nháy kép / backtick thành nháy đơn, gộp khoảng trắng, tối đa 80 ký tự.
 */
export function sanitizeColumnTraits(raw: string): string {
  // eslint-disable-next-line no-control-regex
  const cleaned = stripIdentifiers(raw.replace(/[\u0000-\u001f\u007f]+/g, ' '))
    .replace(/["`]/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
  return cleaned.slice(0, MAX_COLUMN_TRAITS_LENGTH).trim();
}

/** Đặc tính cột từ `findingId` (`DQ-01:ten-cot` → `ten-cot`), đã làm sạch (T1-2). */
export function columnTraitsFromFindingId(findingId: string): string {
  const colPart = findingId.includes(':') ? findingId.split(':').slice(1).join(':') : findingId;
  return sanitizeColumnTraits(colPart);
}

/**
 * Các nhãn nhận xét cùng ánh xạ một nhãn mẫu (Phần 12 v16 §3.24 T1-3): đồng thuận
 * phải đếm trên cả nhóm, vì các nhãn này dùng CHUNG một mẫu (cùng mô tả theo khuôn).
 */
export function labelsForExampleLabel(exampleLabel: FewShotExample['label']): string[] {
  return FEEDBACK_LABELS.filter((l) => mapFeedbackLabelToExampleLabel(l) === exampleLabel);
}

/** Mô tả mẫu theo khuôn (T1-1) — xác định theo (loại lỗi, đặc tính cột, nhãn) nên tự gom trùng. */
export function templateExampleDescription(
  exampleLabel: FewShotExample['label'],
  errorType: string,
  columnTraits: string,
): string {
  const where = columnTraits ? ` trên cột có đặc tính "${columnTraits}"` : '';
  return `${EXAMPLE_LABEL_PHRASES[exampleLabel]} — ${errorType}${where}`;
}

/** Bản nháp mẫu cho một (finding, nhãn) — đúng các trường `syncFindingExample` lưu. */
export interface FindingExampleDraft {
  exampleLabel: FewShotExample['label'];
  /** Các nhãn nhận xét cần đếm đồng thuận (T1-3). */
  labels: string[];
  errorType: string;
  /** Đã qua `stripIdentifiers` (như `normalizeExample`). */
  columnTraits: string;
  /** Đã qua `stripIdentifiers` (như `normalizeExample`) — khoá gom trùng (T1-3). */
  description: string;
  /** Chuỗi đem nhúng (embedding). */
  queryText: string;
}

/**
 * Dựng bản nháp mẫu từ `findingId` + nhãn nhận xét.
 * `null` khi không có `findingId` hoặc nhãn không ánh xạ sang nhãn mẫu (vd `other`).
 */
export function buildFindingExampleDraft(
  findingId: string | null | undefined,
  feedbackLabel: string,
): FindingExampleDraft | null {
  const fid = (findingId ?? '').trim();
  if (!fid) return null;
  const exampleLabel = mapFeedbackLabelToExampleLabel(feedbackLabel);
  if (!exampleLabel) return null;
  const errorType = extractErrorType(fid);
  const traits = columnTraitsFromFindingId(fid);
  const rawDescription = templateExampleDescription(exampleLabel, errorType, traits);
  return {
    exampleLabel,
    labels: labelsForExampleLabel(exampleLabel),
    errorType,
    columnTraits: stripIdentifiers(traits),
    description: stripIdentifiers(rawDescription),
    queryText: `${errorType} | ${traits} | ${rawDescription}`,
  };
}

/**
 * Mẫu đã lưu có theo khuôn T1-1/T1-2 không (Phần 12 v17 §3.24 T1-7).
 * Mẫu lưu trước v15 (mô tả = `reason` hoặc `"<nhãn thô> cho <findingId>"`) → `false`.
 */
export function isTemplatedDescription(doc: {
  label: string;
  errorType: string;
  columnTraits: string | null | undefined;
  description: string;
}): boolean {
  if (!Object.prototype.hasOwnProperty.call(EXAMPLE_LABEL_PHRASES, doc.label)) return false;
  const traits = doc.columnTraits ?? '';
  if (sanitizeColumnTraits(traits) !== traits) return false;
  const expected = stripIdentifiers(
    templateExampleDescription(doc.label as FewShotExample['label'], doc.errorType, traits),
  );
  return doc.description === expected;
}
