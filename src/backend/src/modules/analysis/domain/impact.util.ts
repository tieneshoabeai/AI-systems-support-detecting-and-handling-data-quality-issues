/**
 * E2 — muc anh huong va thu tu uu tien (Phan 2 muc 3.29, Phan 12 v9 muc 3.18).
 * Nguong la QUY UOC DU AN, khong phai chuan thong ke chung; phai the hien kem ly do trong Tong ket/PDF.
 * Gia tri dung bien (1%, 10%, 0,5%, 5%) thuoc muc trung binh.
 */

export type Severity = 'high' | 'medium' | 'low' | 'no_data';
export type DqGroup = 'DQ-01' | 'DQ-02' | 'DQ-03' | 'DQ-04';

export const SEVERITY_RANK: Record<Severity, number> = { high: 0, medium: 1, low: 2, no_data: 3 };
export const SEVERITY_LABEL: Record<Severity, string> = {
  high: 'Cao',
  medium: 'Trung bình',
  low: 'Thấp',
  no_data: 'Không có dữ liệu',
};

const RATE_BANDS: Record<'DQ-01' | 'DQ-02' | 'DQ-03', { lowBelow: number; highAbove: number }> = {
  'DQ-01': { lowBelow: 0.01, highAbove: 0.1 },
  'DQ-02': { lowBelow: 0.005, highAbove: 0.05 },
  'DQ-03': { lowBelow: 0.01, highAbove: 0.1 },
};

export const THRESHOLDS: { dq: string; rule: string; reason: string }[] = [
  { dq: 'DQ-01', rule: 'Thiếu dữ liệu: < 1% thấp; 1%–10% trung bình; > 10% cao', reason: 'Tỷ lệ trên số dòng đang phân tích của cột; quy ước dự án (Phần 2 mục 3.29).' },
  { dq: 'DQ-02', rule: 'Trùng lặp: < 0,5% thấp; 0,5%–5% trung bình; > 5% cao', reason: 'Tỷ lệ dòng trùng trên số dòng quét; quy ước dự án.' },
  { dq: 'DQ-03', rule: 'Sai kiểu/định dạng: < 1% thấp; 1%–10% trung bình; > 10% cao', reason: 'Tỷ lệ trên số ô không thiếu của cột; quy ước dự án.' },
  { dq: 'DQ-04', rule: 'Ngoại lệ: chỉ vượt IQR 1,5× thấp; vượt IQR 3× hoặc Modified Z > 3,5 trung bình; cả hai phương pháp cùng đánh dấu cao', reason: 'Ngoại lệ không mặc định là lỗi cần xóa.' },
  { dq: 'DQ-05', rule: 'Mâu thuẫn giữa các cột: Chưa đánh giá', reason: 'Chưa có quy tắc nghiệp vụ được xác nhận (Phần 2 mục 3.5.5).' },
];

/** DQ-01/02/03 theo ty le. `rate` null hoac mau so 0 -> no_data (khong ap nguong, khong tra 0%). */
export function rateSeverity(dq: 'DQ-01' | 'DQ-02' | 'DQ-03', rate: number | null | undefined): Severity {
  if (rate === null || rate === undefined || !Number.isFinite(rate)) return 'no_data';
  const band = RATE_BANDS[dq];
  if (rate < band.lowBelow) return 'low';
  if (rate > band.highAbove) return 'high';
  return 'medium';
}

export interface OutlierBreakdown { iqr: number; iqrExtreme: number; zscore: number; both: number }

/** DQ-04 theo phuong phap danh dau; khong co diem nao -> null (khong phai van de). */
export function outlierSeverity(b: OutlierBreakdown | null | undefined): Severity | null {
  if (!b) return null;
  if (b.both > 0) return 'high';
  if (b.iqrExtreme > 0 || b.zscore > 0) return 'medium';
  if (b.iqr > 0) return 'low';
  return null;
}

export function severityReason(dq: DqGroup, severity: Severity, rate: number | null | undefined): string {
  if (severity === 'no_data') return 'Không có dòng để đánh giá — không áp ngưỡng';
  const pct = typeof rate === 'number' ? `${(rate * 100).toFixed(2)}%` : '-';
  const rule = THRESHOLDS.find((t) => t.dq === dq)?.rule ?? '';
  return dq === 'DQ-04' ? `${SEVERITY_LABEL[severity]} theo phương pháp đánh dấu (${rule})` : `${pct} → ${SEVERITY_LABEL[severity]} (${rule})`;
}

/** Đợt H (Phần 2 v13 mục 3.45): ngưỡng |độ lệch| để kèm cảnh báo phân phối lệch vào lý do DQ-04. */
export const SKEWNESS_WARN_ABS = 1;

/**
 * Đợt H: câu giải thích kèm lý do (không đổi mức ảnh hưởng).
 * DQ-03 cột số: tách ô ký hiệu thiếu khỏi ô sai định dạng thật; DQ-04: cảnh báo phân phối lệch.
 */
export function issueExplanation(
  dq: DqGroup,
  col: { invalidCount?: number; symbolMissingCount?: number | null; skewness?: number | null },
): string | null {
  if (dq === 'DQ-03' && (col.symbolMissingCount ?? 0) > 0) {
    const sym = col.symbolMissingCount as number;
    const real = Math.max(0, (col.invalidCount ?? 0) - sym);
    return `trong đó ${sym} ô là ký hiệu thiếu (NA, null…), ${real} ô sai định dạng thật — tổng số ô không có giá trị thực tế cao hơn tỷ lệ DQ-01`;
  }
  if (dq === 'DQ-04' && typeof col.skewness === 'number' && Math.abs(col.skewness) > SKEWNESS_WARN_ABS) {
    return `phân phối lệch (độ lệch ${col.skewness.toFixed(2)}), đuôi dài có thể là giá trị bình thường — xem xét trước khi coi là lỗi`;
  }
  return null;
}

/** De xuat xu ly tai nguon theo mau (khong do AI sinh). Khong de xuat xoa/sua du lieu trong he thong. */
export function recommendationFor(dq: DqGroup, column: string | null): string {
  const col = column ? `cột "${column}"` : 'toàn bảng';
  switch (dq) {
    case 'DQ-01':
      return `Kiểm tra quy trình thu thập/nhập liệu của ${col}: xác định giá trị thiếu là "không áp dụng" hay bị bỏ sót, bổ sung tại nguồn.`;
    case 'DQ-02':
      return 'Xác định khóa nghiệp vụ và nguồn sinh bản ghi trùng (nhập lặp, đồng bộ nhiều lần); loại trùng tại hệ thống nguồn.';
    case 'DQ-03':
      return `Chuẩn hóa định dạng/kiểu của ${col} tại nguồn (đơn vị, dấu thập phân, định dạng ngày); kiểm tra lại kiểu cột đã suy luận.`;
    case 'DQ-04':
      return `Đối chiếu các giá trị bất thường của ${col} với chứng từ gốc; chỉ hiệu chỉnh khi xác nhận là lỗi — ngoại lệ có thể là giá trị thật.`;
    default:
      return `Kiểm tra ${col} tại nguồn.`;
  }
}

export function compareIssues(
  a: { severity: Severity; rate: number | null; count: number },
  b: { severity: Severity; rate: number | null; count: number },
): number {
  return (
    SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity] ||
    (b.rate ?? -1) - (a.rate ?? -1) ||
    b.count - a.count
  );
}
