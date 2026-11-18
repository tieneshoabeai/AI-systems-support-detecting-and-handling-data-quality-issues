/**
 * ANALYSIS — Kiểu dữ liệu tầng application (input/output contract).
 *
 * Tách ra khỏi service gốc khi áp dụng §3.10 Command/Query pattern.
 * Không import HTTP, không import infrastructure.
 */

export interface RunAnalysisInput {
  selected_columns?: string[];
  correlation_method: 'pearson' | 'spearman';
  outlier_method: 'iqr' | 'modified_zscore' | 'both';
  top_n: number;
}

export interface AnalysisConfigInput {
  selected_columns?: string[] | null;
  label_column?: string | null;
  time_column?: string | null;
  time_granularity: 'day' | 'week' | 'month' | 'year';
  value_column?: string | null;
  correlation_method: 'pearson' | 'spearman';
  outlier_method: 'iqr' | 'modified_zscore' | 'both';
  top_n: number;
}
