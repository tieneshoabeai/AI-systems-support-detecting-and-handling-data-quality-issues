import type { Document, Types } from 'mongoose';
import { Schema } from 'mongoose';
import type { BaseEntity } from '../../../../shared/infrastructure/database/base-mongo.repository';

export interface IAnalysisConfig extends Document, BaseEntity {
  _id: Types.ObjectId;
  project_id: Types.ObjectId;
  workspace_id: Types.ObjectId;
  selected_columns: string[] | null;
  label_column: string | null;
  time_column: string | null;
  time_granularity: 'day' | 'week' | 'month' | 'year';
  value_column: string | null;
  correlation_method: 'pearson' | 'spearman';
  outlier_method: 'iqr' | 'modified_zscore' | 'both';
  top_n: number;
  /**
   * GĐ7 — Ghi đè vai trò cột do người dùng chỉ định.
   *
   * Shape: `{ [columnKey: 'c0']: 'identifier' | 'category' | 'measure' | 'text' | 'datetime' }`.
   *
   * Vì sao cần: `inferColumnRoles()` suy vai trò từ **tên cột + phân bố giá trị**.
   * Có những cột bị suy sai (VD cột "ma_so" toàn số 0/1 → bị coi là `measure`
   * thay vì `identifier`) và người dùng không có cách sửa. Ghi đè thủ công là
   * cần thiết để người dùng kiểm soát việc cột nào đi vào tương quan/VIF.
   *
   * Key là **key cột ổn định** (`c0`, `c1`, …) — không phải tên hiển thị — để
   * việc đổi tên cột không làm mất ghi đè.
   */
  column_roles: Record<string, string> | null;
  deleted_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

export const AnalysisConfigSchema = new Schema<IAnalysisConfig>(
  {
    project_id: { type: Schema.Types.ObjectId, ref: 'Project', required: true, unique: true },
    workspace_id: { type: Schema.Types.ObjectId, ref: 'Workspace', required: true },
    selected_columns: { type: [String], default: null },
    label_column: { type: String, default: null },
    time_column: { type: String, default: null },
    time_granularity: { type: String, enum: ['day', 'week', 'month', 'year'], default: 'day' },
    value_column: { type: String, default: null },
    correlation_method: { type: String, enum: ['pearson', 'spearman'], default: 'pearson' },
    outlier_method: { type: String, enum: ['iqr', 'modified_zscore', 'both'], default: 'iqr' },
    top_n: { type: Number, default: 10 },
    // GĐ7 — ghi đè vai trò cột: map key cột → vai trò. Kiểu `Mixed` vì value
    // là enum string; validate ở tầng application (`SaveConfigHandler`).
    column_roles: { type: Schema.Types.Mixed, default: null },
    deleted_at: { type: Date, default: null, index: true },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } },
);
