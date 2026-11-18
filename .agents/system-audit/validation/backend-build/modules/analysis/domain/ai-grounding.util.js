"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildCorrV1Prompt = buildCorrV1Prompt;
exports.groundAiAssessment = groundAiAssessment;
const zod_1 = require("zod");
const NotablePairSchema = zod_1.z
    .object({
    colA: zod_1.z.string().min(1),
    colB: zod_1.z.string().min(1),
    coef: zod_1.z.number().finite(),
    kind: zod_1.z.string().optional(),
    n: zod_1.z.number().int().nonnegative().optional(),
})
    .strict();
const CorrV1RawSchema = zod_1.z
    .object({
    notablePairs: zod_1.z.array(NotablePairSchema).optional().default([]),
    highVif: zod_1.z.array(zod_1.z.string().min(1)).optional().default([]),
    limits: zod_1.z.array(zod_1.z.string()).optional().default([]),
    nextSteps: zod_1.z.array(zod_1.z.string()).optional().default([]),
})
    .strict();
function pairKey(a, b) {
    return [a, b].sort().join('||');
}
function buildCorrV1Prompt(ctx) {
    const lines = [];
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
    lines.push('Trả về duy nhất một JSON hợp lệ với các khóa: notablePairs[{colA,colB,coef,kind,n}], highVif[string], limits[string], nextSteps[string].');
    return lines.join('\n');
}
function groundAiAssessment(raw, cells, vifRows, modelId) {
    const dropped = [];
    const cellMap = new Map();
    for (const c of cells) {
        if (c.computable && c.coef !== null)
            cellMap.set(pairKey(c.colA, c.colB), c);
    }
    const vifMap = new Map();
    for (const r of vifRows) {
        if (r.computable && r.vif !== null)
            vifMap.set(r.column, r);
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
    const notablePairs = [];
    for (const p of r.notablePairs) {
        const cell = cellMap.get(pairKey(p.colA, p.colB));
        if (!cell || cell.coef === null || Math.abs(cell.coef - p.coef) > 0.01) {
            dropped.push(`cặp ${p.colA}–${p.colB} coef=${String(p.coef)} không tồn tại trong ma trận`);
            continue;
        }
        notablePairs.push({ colA: cell.colA, colB: cell.colB, coef: cell.coef, kind: cell.kind, n: cell.n });
    }
    notablePairs.sort((a, b) => Math.abs(b.coef) - Math.abs(a.coef));
    const vifValue = new Map();
    for (const row of vifRows) {
        if (row.computable && row.vif !== null)
            vifValue.set(row.column, row.vif);
    }
    const highVif = [];
    for (const col of r.highVif) {
        const row = vifMap.get(col);
        if (!row || row.flag === 'ok') {
            dropped.push(`VIF cột ${String(col)} không tồn tại hoặc không vượt ngưỡng`);
            continue;
        }
        highVif.push(col);
    }
    highVif.sort((a, b) => (vifValue.get(b) ?? 0) - (vifValue.get(a) ?? 0));
    const strList = (v) => Array.isArray(v) ? v.filter((x) => typeof x === 'string') : [];
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
//# sourceMappingURL=ai-grounding.util.js.map