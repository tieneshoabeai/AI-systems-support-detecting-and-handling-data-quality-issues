/**
 * D2 (Phan 2 v10 muc 3.42, Phan 8 v7 muc 3.15) — tham chieu cot bang key bat bien `c{i}`
 * va fingerprint dau vao gom metadata cot, de phat hien ket qua loi thoi khi dataset/cot doi.
 */
import * as crypto from 'crypto';

export const FINGERPRINT_VERSION = 2;

export interface FingerprintColumn {
  key: string;
  name: string;
  originalName?: string | null;
  dataType: string;
  isPii?: boolean | null;
}

export interface FingerprintDataset {
  id: string;
  fileChecksum: string;
  rowCount: number;
  columns: FingerprintColumn[];
}

/** Cau hinh da phan giai — moi cot tham chieu bang KEY. */
export interface ResolvedRunConfig {
  selectedKeys: string[];
  labelKey: string | null;
  timeKey: string | null;
  valueKey: string | null;
  correlationMethod: string;
  outlierMethod: string;
  topN: number;
  timeGranularity: string;
}

/** Tim cot theo key → ten hien tai → ten goc (thu tu uu tien). */
export function resolveColumnRef(
  ref: string | null | undefined,
  columns: FingerprintColumn[],
): FingerprintColumn | null {
  if (ref === null || ref === undefined || ref === '') return null;
  return (
    columns.find((c) => c.key === ref) ??
    columns.find((c) => c.name === ref) ??
    columns.find((c) => c.originalName === ref) ??
    null
  );
}

export function computeInputFingerprint(dataset: FingerprintDataset, cfg: ResolvedRunConfig): string {
  const used = new Set<string>([
    ...cfg.selectedKeys,
    ...[cfg.labelKey, cfg.timeKey, cfg.valueKey].filter((k): k is string => typeof k === 'string'),
  ]);
  const columns = [...used]
    .sort()
    .map((key) => {
      const c = dataset.columns.find((x) => x.key === key);
      return c ? [c.key, c.name, c.dataType, Boolean(c.isPii)] : [key, null, null, null];
    });
  const parts = {
    v: FINGERPRINT_VERSION,
    dataset_id: dataset.id,
    file_checksum: dataset.fileChecksum,
    row_count: dataset.rowCount,
    columns,
    config: {
      selected: cfg.selectedKeys,
      label: cfg.labelKey,
      time: cfg.timeKey,
      value: cfg.valueKey,
      correlation_method: cfg.correlationMethod,
      outlier_method: cfg.outlierMethod,
      top_n: cfg.topN,
      time_granularity: cfg.timeGranularity,
    },
  };
  return crypto.createHash('sha256').update(JSON.stringify(parts)).digest('hex');
}

/** Doc lai ResolvedRunConfig tu `analysis_run.config` (chi co voi fingerprint_version 2). */
export function readResolvedRunConfig(config: Record<string, unknown> | null | undefined): ResolvedRunConfig | null {
  if (!config || config.fingerprint_version !== FINGERPRINT_VERSION) return null;
  const str = (v: unknown): string | null => (typeof v === 'string' ? v : null);
  const keys = Array.isArray(config.selected_column_keys) ? (config.selected_column_keys as unknown[]).map(String) : [];
  return {
    selectedKeys: keys,
    labelKey: str(config.label_column_key),
    timeKey: str(config.time_column_key),
    valueKey: str(config.value_column_key),
    correlationMethod: String(config.correlation_method ?? ''),
    outlierMethod: String(config.outlier_method ?? ''),
    topN: typeof config.top_n === 'number' ? config.top_n : 0,
    timeGranularity: String(config.time_granularity ?? 'day'),
  };
}
