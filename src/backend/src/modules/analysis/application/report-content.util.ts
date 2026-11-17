/**
 * REPORT-01 — dung noi dung "PDF FULL" (Phan 2 v9 muc 6.5–6.6, Phan 2 v10 muc 3.41):
 * Tong ket + top phat hien (toi da top_n) + khuyen nghi + ma tran tuong quan + VIF + nhan xet AI
 * + phu luc thong ke mo ta / mat can bang / thoi gian / bang chung (che PII) / nguong ap dung.
 * Ham thuan (khong I/O) de test duoc doc lap voi worker.
 */
import type { PdfSection } from './pdf-builder.util';
import type {
  AnalysisResultRecord,
  CellEvidenceRecord,
  ProjectSaveRecord,
} from '../domain/ports/analysis.repository.port';

export interface ReportContentInput {
  projectId: string;
  save: ProjectSaveRecord;
  result: AnalysisResultRecord | null;
  evidences: CellEvidenceRecord[];
  topN: number;
}

const fmt = (v: unknown, digits = 4): string => {
  if (v === null || v === undefined) return '-';
  if (typeof v === 'number') return Number.isFinite(v) ? String(Number(v.toFixed(digits))) : '-';
  return String(v);
};
const pct = (v: unknown): string => (typeof v === 'number' && Number.isFinite(v) ? `${(v * 100).toFixed(2)}%` : '-');
const arr = <T>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);
const obj = (v: unknown): Record<string, unknown> | null =>
  v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null;

const KIND_LABEL: Record<string, string> = {
  missing: 'Thiếu (DQ-01)',
  duplicate: 'Trùng (DQ-02)',
  invalid_type: 'Sai kiểu (DQ-03)',
  outlier: 'Ngoại lệ (DQ-04)',
};

export function buildReportSections(input: ReportContentInput): PdfSection[] {
  const { save, result, evidences, topN } = input;
  const summary = (save.summary ?? {}) as Record<string, unknown>;
  const issues = arr<Record<string, unknown>>(summary.issues);
  const recommendations = arr<unknown>(summary.recommendations).map((r) => String(r));
  const overview = typeof summary.overview === 'string' ? summary.overview : 'Tổng kết chất lượng dữ liệu.';
  const sections: PdfSection[] = [];

  sections.push({
    heading: '1. Tổng quan',
    lines: [
      `Project: ${input.projectId}`,
      `Bản Tổng kết: ${save.id} (${save.isStale ? 'ĐÃ LỖI THỜI — dữ liệu/cấu hình đã đổi sau Tổng kết' : 'hiện hành'})`,
      `Lần phân tích: ${save.analysisRunId ?? '-'} · fingerprint ${String(save.inputFingerprint ?? '').slice(0, 16)}`,
      `Tóm tắt: ${overview}`,
      `Số nhóm vấn đề hiển thị: ${Math.min(issues.length, topN)} / ${issues.length} (top_n = ${topN})`,
      `Số bằng chứng lưu: ${fmt(summary.evidence_refs)}`,
      'Thời gian cột không có múi giờ được hiểu là UTC.',
    ],
  });

  sections.push({
    heading: `2. Top phát hiện (tối đa ${topN})`,
    table: {
      headers: ['#', 'Nhóm', 'Cột', 'Số lượng', 'Tỷ lệ'],
      widths: [0.06, 0.14, 0.44, 0.18, 0.18],
      rows: issues.slice(0, topN).map((it, i) => [
        String(i + 1),
        String(it.dq ?? it.rule ?? 'DQ'),
        it.column === null || it.column === undefined ? '(toàn bảng)' : String(it.column),
        fmt(it.count, 0),
        pct(it.rate),
      ]),
    },
  });

  sections.push({
    heading: '3. Khuyến nghị xử lý tại nguồn',
    lines: recommendations.length > 0 ? recommendations.slice(0, 20).map((r) => `• ${r}`) : ['(chưa có khuyến nghị)'],
  });

  if (!result) {
    sections.push({
      heading: '4. Kết quả phân tích chi tiết',
      lines: ['Không tìm thấy kết quả phân tích gắn với bản Tổng kết này — chỉ in phần Tổng kết.'],
    });
    return sections;
  }

  const corr = result.correlationMatrix ?? result.correlation ?? null;
  const corrLines: string[] = [];
  if (corr) {
    corrLines.push(`Phương pháp số–số: ${corr.method}; số–phân loại: η²; phân loại–phân loại: Cramér's V.`);
    corrLines.push(`Tổng dòng quét: ${fmt(corr.totalScanned, 0)}.`);
    for (const ex of arr<{ column: string; reason: string }>(corr.excludedColumns)) {
      corrLines.push(`Cột bị loại: ${ex.column} — ${ex.reason}`);
    }
  }
  sections.push({
    heading: '4. Ma trận tương quan',
    lines: corr ? corrLines : ['(không có dữ liệu tương quan)'],
    table: corr
      ? {
          headers: ['Cột A', 'Cột B', 'Hệ số', 'Loại', 'n', 'Ghi chú'],
          widths: [0.22, 0.22, 0.1, 0.14, 0.08, 0.24],
          rows: arr<Record<string, unknown>>(corr.cells).map((c) => [
            String(c.colA),
            String(c.colB),
            fmt(c.coef),
            String(c.kind ?? ''),
            fmt(c.n, 0),
            c.computable ? '' : String(c.reason ?? 'không tính được'),
          ]),
        }
      : undefined,
  });

  const vif = result.vif ?? null;
  sections.push({
    heading: '5. Đa cộng tuyến (VIF)',
    lines: vif
      ? [
          `Số quan sát chung: ${vif.commonN} / ${vif.totalScanned} (${pct(vif.commonNRate)}).`,
          ...(vif.lossWarning ? [`Cảnh báo mất mẫu: ${vif.lossWarning}`] : []),
          ...arr<{ column: string; reason: string }>(vif.excluded).map((e) => `Cột bị loại: ${e.column} — ${e.reason}`),
        ]
      : ['(không có dữ liệu VIF)'],
    table: vif
      ? {
          headers: ['Cột', 'VIF', 'Mức', 'Ghi chú'],
          widths: [0.4, 0.15, 0.15, 0.3],
          rows: vif.rows.map((r) => [
            r.column,
            fmt(r.vif, 2),
            r.flag === 'high' ? 'Cao (>10)' : r.flag === 'review' ? 'Xem lại (>5)' : 'OK',
            r.computable ? '' : String(r.reason ?? ''),
          ]),
        }
      : undefined,
  });

  const ai = obj(result.aiCorrelationAssessment);
  const aiLines: string[] = [];
  if (ai && ai.status === 'succeeded') {
    for (const p of arr<Record<string, unknown>>(ai.notablePairs)) {
      aiLines.push(`Cặp đáng chú ý: ${p.colA} – ${p.colB}: ${fmt(p.coef)} (${p.kind ?? ''}, n=${fmt(p.n, 0)})`);
    }
    for (const c of arr<string>(ai.highVif)) aiLines.push(`VIF cao: ${c}`);
    for (const l of arr<string>(ai.limits)) aiLines.push(`Giới hạn: ${l}`);
    for (const s of arr<string>(ai.nextSteps)) aiLines.push(`Bước tiếp theo: ${s}`);
    aiLines.push(`Model: ${ai.modelId ?? '-'} · prompt ${ai.promptVersion ?? 'corr-v1'}. AI không kết luận nhân quả và không kết luận vi phạm DQ-05.`);
  } else {
    aiLines.push(`Không có nhận xét AI (trạng thái: ${ai?.status ?? 'không có'}). Lỗi AI không chặn kết quả hệ thống.`);
  }
  sections.push({ heading: '6. Nhận xét AI về tương quan / VIF', lines: aiLines });

  const descriptive = arr<Record<string, unknown>>(result.descriptive);
  sections.push({
    heading: 'Phụ lục A — Thống kê mô tả',
    table: {
      headers: ['Cột', 'Kiểu', 'Hợp lệ', 'Thiếu', 'Sai kiểu', 'TB', 'Trung vị', 'Min', 'Max', 'Độ lệch'],
      widths: [0.2, 0.08, 0.08, 0.07, 0.08, 0.1, 0.1, 0.1, 0.1, 0.09],
      rows: descriptive.map((d) => [
        String(d.column),
        String(d.dataType ?? ''),
        fmt(d.count, 0),
        fmt(d.missingCount, 0),
        fmt(d.invalidCount, 0),
        fmt(d.mean, 3),
        fmt(d.median, 3),
        fmt(d.min, 3),
        fmt(d.max, 3),
        fmt(d.stdev, 3),
      ]),
    },
  });

  const imb = obj(result.imbalance);
  sections.push({
    heading: 'Phụ lục B — Mất cân bằng lớp',
    lines: imb
      ? [
          `Cột nhãn: ${imb.labelColumn ?? '(chưa chọn)'} · trạng thái: ${imb.status}`,
          `Imbalance Ratio: ${fmt(imb.imbalanceRatio, 2)}${imb.warning ? ` — ${imb.warning}` : ''} (ngưỡng cảnh báo IR ≥ 3 là quy ước dự án)`,
          `Dòng có nhãn hợp lệ: ${fmt(imb.validRows, 0)}; thiếu nhãn: ${fmt(imb.missingLabelRows, 0)}`,
        ]
      : ['(không có dữ liệu)'],
    table: imb && arr(imb.classes).length > 0
      ? {
          headers: ['Lớp', 'Số dòng', 'Tỷ lệ'],
          widths: [0.6, 0.2, 0.2],
          rows: arr<Record<string, unknown>>(imb.classes).map((c) => [String(c.value), fmt(c.count, 0), pct(c.rate)]),
        }
      : undefined,
  });

  const time = obj(result.timeAnalysis ?? result.temporal);
  sections.push({
    heading: 'Phụ lục C — Phân tích theo thời gian',
    lines: time
      ? [
          `Cột thời gian: ${time.timeColumn ?? '(không có)'} · mức tổng hợp: ${time.granularity} · trạng thái: ${time.status}`,
          `Kỳ trống: ${arr(time.emptyBuckets).length} (chuỗi trống dài nhất: ${fmt(time.longestEmptyRun, 0)}); kỳ biến động: ${arr<string>(time.volatilePeriods).join(', ') || '-'}`,
          'Khoảng trống hoặc biến động không mặc định là lỗi.',
        ]
      : ['(không có dữ liệu)'],
    table: time && arr(time.buckets).length > 0
      ? {
          headers: ['Kỳ', 'Số dòng', 'Hợp lệ', 'Thiếu', 'Sai kiểu', 'TB', 'Trung vị', 'Tổng'],
          widths: [0.2, 0.1, 0.1, 0.1, 0.1, 0.13, 0.13, 0.14],
          rows: arr<Record<string, unknown>>(time.buckets).map((b) => [
            String(b.period),
            fmt(b.recordCount, 0),
            fmt(b.validCount, 0),
            fmt(b.missingCount, 0),
            fmt(b.invalidCount, 0),
            fmt(b.mean, 3),
            fmt(b.median, 3),
            fmt(b.sum, 3),
          ]),
        }
      : undefined,
  });

  sections.push({
    heading: 'Phụ lục D — Bằng chứng (tối đa 20 ô/cột, đã che PII)',
    table: {
      headers: ['Cột', 'Dòng gốc', 'Loại', 'Lý do', 'Giá trị (đã che)'],
      widths: [0.22, 0.1, 0.16, 0.3, 0.22],
      rows: evidences.map((e) => [
        e.column === '__row__' ? '(toàn dòng)' : e.column,
        String(e.rowIndex),
        KIND_LABEL[e.kind ?? ''] ?? String(e.kind ?? ''),
        String(e.reason ?? ''),
        e.valueMasked ?? '-',
      ]),
    },
  });

  const dq05 = obj(result.dq05);
  sections.push({
    heading: 'Phụ lục E — Ngưỡng và quy tắc áp dụng',
    lines: [
      'DQ-01 thiếu dữ liệu: null/undefined/chuỗi rỗng; 0/false/"NA" không tính là thiếu.',
      'DQ-02 trùng lặp: so khớp chính xác trên các cột được chọn; dòng thiếu toàn bộ không gom nhóm.',
      'DQ-03 sai kiểu/định dạng: theo kiểu cột đã suy luận/tinh chỉnh.',
      'DQ-04 ngoại lệ: IQR hàng rào 1.5×IQR; Modified Z-score |z| > 3.5. Ngoại lệ không mặc định là lỗi cần xóa.',
      `DQ-05 mâu thuẫn giữa các cột: ${dq05?.status === 'assessed' ? 'đã đánh giá theo quy tắc được xác nhận' : 'Chưa đánh giá (chưa có quy tắc được xác nhận)'}.`,
      'Tương quan: Pearson/Spearman, Cramér\'s V, η². VIF > 5 cần xem lại, VIF > 10 đa cộng tuyến cao.',
      'Mất mẫu VIF ≥ 20% cảnh báo thận trọng, ≥ 50% VIF kém tin cậy (quy ước dự án).',
      'IR ≥ 3 cảnh báo mất cân bằng (quy ước dự án, không phải chuẩn chung).',
    ],
  });

  return sections;
}
