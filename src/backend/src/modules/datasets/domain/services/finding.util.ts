/**
 * Mục **"Phát hiện"** (findings) — OPEN-03/04/05 (chốt 2026-11-19).
 *
 * Vì hệ thống **chỉ nhận dataset và phân tích** (không cho thao tác lên dataset),
 * mọi vấn đề phát hiện được phải được **báo cáo kèm vị trí lỗi cụ thể** để
 * người dùng tự sửa file rồi xoá dataset & nạp lại.
 *
 * Cấu trúc này dùng chung cho **hai nơi** (mục 5.5 của `24_open_decisions_resolved.md`):
 *   - `GET /datasets/{id}` → `dataset.findings` (thấy ngay sau khi import)
 *   - `analysis_result.findings` (bản đầy đủ gắn với kết quả cụ thể)
 */

/** Loại phát hiện. */
export type DatasetFindingType =
  /** Tên cột rỗng. */
  | 'empty_name'
  /** Tên cột chỉ chứa khoảng trắng. */
  | 'whitespace_only'
  /** Tên cột trùng với cột khác. */
  | 'duplicate_name'
  /** Dòng có số ô khác với header (thiếu/thừa). */
  | 'row_column_mismatch'
  /** Dòng hoàn toàn rỗng (trailing blank row). */
  | 'blank_row'
  /** Ô có dấu phẩy cách bên trong → có thể là lỗi xuống dòng. */
  | 'suspicious_delimiter_in_value'
  /** Ô nghi ngờ sai kiểu (ngày mơ hồ, số vô nghĩa). */
  | 'suspicious_value'
  /** Cột bị thiếu giá trị. */
  | 'missing_values'
  /** Cột chứa giá trị ngoại lệ (outlier). */
  | 'outliers';

/** Mức độ nghiêm trọng. */
export type DatasetFindingSeverity = 'info' | 'low' | 'medium' | 'high' | 'critical';

/**
 * Một phát hiện — luôn có **vị trí lỗi cụ thể** để người dùng biết chính xác
 * cần sửa ở đâu.
 */
export interface DatasetFinding {
  /** Loại phát hiện. */
  type: DatasetFindingType;
  /** Mức độ nghiêm trọng. */
  severity: DatasetFindingSeverity;
  /** Key cột ổn định (`c0`, `c1`, …) — `null` nếu lỗi ở cấp dataset. */
  columnKey: string | null;
  /** Tên cột liên quan (dễ đọc hơn key). */
  columnName: string | null;
  /** Số dòng (0-based) trong file CSV gốc — `null` nếu không gắn dòng. */
  rowIndex: number | null;
  /** Thông điệp mô tả vấn đề (tiếng Việt). */
  message: string;
  /** Chi tiết bổ sung (giá trị đáng ngờ, số lượng…). */
  details?: Record<string, unknown>;
}

/** Tạo phát hiện với các trường mặc định. */
export function makeFinding(
  type: DatasetFindingType,
  severity: DatasetFindingSeverity,
  message: string,
  extra: Partial<Omit<DatasetFinding, 'type' | 'severity' | 'message'>> = {},
): DatasetFinding {
  return {
    type,
    severity,
    columnKey: extra.columnKey ?? null,
    columnName: extra.columnName ?? null,
    rowIndex: extra.rowIndex ?? null,
    message,
    ...(extra.details ? { details: extra.details } : {}),
  };
}
