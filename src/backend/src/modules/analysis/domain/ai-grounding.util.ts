import { z } from 'zod';
export interface CorrCell { colA: string; colB: string; coef: number | null; kind: string; n: number; totalScanned: number; missingAOnly: number; missingBOnly: number; missingBoth: number; computable: boolean; reason: string | null; }
export interface VifRow { column: string; vif: number | null; flag: 'ok' | 'review' | 'high'; computable: boolean; reason: string | null; }
export type ICorrelationCell = CorrCell;
export type IVifRow = VifRow;

/** v8: Zod strict cho corr-v1 — thiếu trường/sai kiểu → failed, không suy diễn. */
const NotablePairSchema = z
  .object({
    colA: z.string().min(1),
    colB: z.string().min(1),
    coef: z.number().finite(),
    kind: z.string().optional(),
    n: z.number().int().nonnegative().optional(),
  })
  .strict();

const CorrV1RawSchema = z
  .object({
    notablePairs: z.array(NotablePairSchema).optional().default([]),
    highVif: z.array(z.string().min(1)).optional().default([]),
    limits: z.array(z.string()).optional().default([]),
    nextSteps: z.array(z.string()).optional().default([]),
  })
  .strict();

export type CorrV1Raw = z.infer<typeof CorrV1RawSchema>;
export type CorrV1Strict = CorrV1Raw;

export interface CorrV1Context {
  columns: { key: string; role: string; usedRows: number; excludedRows: number }[];
  cells: ICorrelationCell[];
  vif: {
    columns: string[];
    rows: IVifRow[];
    commonN: number;
    totalScanned: number;
    commonNRate: number | null;
    lossWarning: string | null;
    excluded: { column: string; reason: string }[];
  } | null;
  maskedSamples: Record<string, string[]>;
  method: 'pearson' | 'spearman';
  excludedColumns: { column: string; reason: string }[];
  /** Phan 12 v8 §3.16.4: khoi "Cac truong hop da biet" tu RAG (co the rong) */
  fewShotBlock?: string;
}

export interface RawAiAssessment {
  notablePairs?: { colA: string; colB: string; coef: number; kind?: string; n?: number }[];
  highVif?: string[];
  limits?: string[];
  nextSteps?: string[];
}

export interface GroundedAssessment {
  status: 'succeeded' | 'failed';
  notablePairs: { colA: string; colB: string; coef: number; kind: string; n: number }[];
  highVif: string[];
  limits: string[];
  nextSteps: string[];
  modelId: string | null;
  promptVersion: 'corr-v1';
  error: string | null;
  droppedClaims: string[];
}

function pairKey(a: string, b: string): string {
  return [a, b].sort().join('||');
}

export function buildCorrV1Prompt(ctx: CorrV1Context): string {
  const lines: string[] = [];
  lines.push('Bạn là trợ lý phân tích chất lượng dữ liệu. Chỉ diễn giải số liệu đã cho.');
  lines.push('Nghiêm cấm: tính lại hệ số, bịa số, kết luận nhân quả, kết luận vi phạm DQ-05, yêu cầu xóa cột.');
  lines.push(`Phương pháp số–số: ${ctx.method}. Cramér's V và eta_squared nằm trong [0,1], không có dấu âm.`);
  lines.push('Mọi nhận định phải trích đúng ô ma trận / dòng VIF kèm n.');
  lines.push(`Cột: ${JSON.stringify(ctx.columns)}`);
  lines.push(`Ma trận (cells): ${JSON.stringify(ctx.cells)}`);
  lines.push(`VIF: ${JSON.stringify(ctx.vif)}`);
  if (ctx.vif?.lossWarning) {
    lines.push(`CANH BAO MAT MAU VIF: ${ctx.vif.lossWarning} (commonN=${ctx.vif.commonN}/${ctx.vif.totalScanned}).`);
  }
  lines.push('Moi o ma tran kem n + totalScanned + missingAOnly/missingBOnly/missingBoth: doc mat mau theo tung cot, khong suy dien.');
  if (ctx.excludedColumns.length > 0) {
    lines.push(`Cot bi loai khoi tuong quan/VIF (khong suy dien, khong dua vao DQ-05): ${JSON.stringify(ctx.excludedColumns)}. Cot date bi loai vi chua co dinh nghia tuong quan thoi gian duoc chot.`);
  }
  lines.push(`Mẫu đã che PII (tối đa 20 ô/cột): ${JSON.stringify(ctx.maskedSamples)}`);
  if (ctx.fewShotBlock && ctx.fewShotBlock.trim().length > 0) {
    lines.push(ctx.fewShotBlock);
  }
  lines.push(
    'Trả về duy nhất một JSON hợp lệ với các khóa: notablePairs[{colA,colB,coef,kind,n}], highVif[string], limits[string], nextSteps[string].',
  );
  return lines.join('\n');
}

export function groundAiAssessment(
  raw: unknown,
  cells: ICorrelationCell[],
  vifRows: IVifRow[],
  modelId: string | null,
): GroundedAssessment {
  const dropped: string[] = [];
  const cellMap = new Map<string, ICorrelationCell>();
  for (const c of cells) {
    if (c.computable && c.coef !== null) cellMap.set(pairKey(c.colA, c.colB), c);
  }
  const vifMap = new Map<string, IVifRow>();
  for (const r of vifRows) {
    if (r.computable && r.vif !== null) vifMap.set(r.column, r);
  }

  if (!raw || typeof raw !== 'object') {
    return {
      status: 'failed',
      notablePairs: [],
      highVif: [],
      limits: ['AI trả về không phải JSON object'],
      nextSteps: [],
      modelId,
      promptVersion: 'corr-v1',
      error: 'invalid_ai_json',
      droppedClaims: ['toàn bộ phản hồi AI'],
    };
  }
  const parsed = CorrV1RawSchema.safeParse(raw);
  if (!parsed.success) {
    const details = parsed.error.errors
      .map((e) => `${e.path.join('.') || '(root)'}: ${e.message}`)
      .join('; ');
    return {
      status: 'failed',
      notablePairs: [],
      highVif: [],
      limits: [],
      nextSteps: [],
      modelId,
      promptVersion: 'corr-v1',
      error: `invalid_corr_v1_shape: ${details}`.slice(0, 500),
      droppedClaims: ['toàn bộ phản hồi AI (sai schema corr-v1)'],
    };
  }
  const r = parsed.data;

  const notablePairs: GroundedAssessment['notablePairs'] = [];
  for (const p of r.notablePairs) {
    const cell = cellMap.get(pairKey(p.colA, p.colB));
    if (!cell || cell.coef === null || Math.abs(cell.coef - p.coef) > 0.01) {
      dropped.push(`cặp ${p.colA}–${p.colB} coef=${String(p.coef)} không tồn tại trong ma trận`);
      continue;
    }
    notablePairs.push({ colA: cell.colA, colB: cell.colB, coef: cell.coef, kind: cell.kind, n: cell.n });
  }
  // v8: backend xếp sẵn theo |coef| giảm dần để client phân trang đúng thứ tự ưu tiên
  notablePairs.sort((a, b) => Math.abs(b.coef) - Math.abs(a.coef));

  const vifValue = new Map<string, number>();
  for (const row of vifRows) {
    if (row.computable && row.vif !== null) vifValue.set(row.column, row.vif);
  }
  const highVif: string[] = [];
  for (const col of r.highVif) {
    const row = vifMap.get(col);
    if (!row || row.flag === 'ok') {
      dropped.push(`VIF cột ${String(col)} không tồn tại hoặc không vượt ngưỡng`);
      continue;
    }
    highVif.push(col);
  }
  // v8: xếp VIF giảm dần theo giá trị hệ thống
  highVif.sort((a, b) => (vifValue.get(b) ?? 0) - (vifValue.get(a) ?? 0));

  // v8: GIỮ TOÀN BỘ limits/nextSteps, không cắt ở backend; phân trang ở client
  const strList = (v: unknown): string[] =>
    Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];

  return {
    status: 'succeeded',
    notablePairs,
    highVif,
    limits: strList(r.limits),
    nextSteps: strList(r.nextSteps),
    modelId,
    promptVersion: 'corr-v1',
    error: null,
    droppedClaims: dropped,
  };
}
