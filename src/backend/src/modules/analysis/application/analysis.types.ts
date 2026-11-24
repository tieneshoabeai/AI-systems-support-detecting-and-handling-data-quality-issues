/**
 * ANALYSIS — Kiểu dữ liệu tầng application (input/output contract).
 *
 * Tách ra khỏi service gốc khi áp dụng §3.10 Command/Query pattern.
 * Không import HTTP, không import infrastructure.
 *
 * OPEN-06 — Không còn "cấu hình cột phân tích" thủ công: cột đo / phân loại /
 * thời gian / nhãn được **tự suy luận** từ schema + tên cột. Body chỉ còn
 * tham số phương pháp.
 */

export interface RunAnalysisInput {
  correlation_method: 'pearson' | 'spearman';
  outlier_method: 'iqr' | 'modified_zscore' | 'both';
  top_n: number;
  /** Top N giá trị phổ biến của cột phân loại (biểu đồ + phụ lục A của PDF). */
  chart_top_n?: number;
}
