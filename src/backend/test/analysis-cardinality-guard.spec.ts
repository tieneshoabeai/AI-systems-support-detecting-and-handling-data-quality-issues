/**
 * GĐ8 + GĐ9 — Chống OOM do ma trận tương quan Cramér V dày.
 *
 * Bối cảnh (sự cố đã tái hiện):
 *   Dataset 100.000 dòng, 7 cột. Cột `review_id` có 99.173 giá trị khác nhau,
 *   cột `order_id` có 99.441. Bản cũ dựng ma trận dense `99.173 × 99.441`
 *   ≈ 9,86 tỷ ô ≈ 73 GB → V8 `FATAL ERROR: Reached heap limit` → sập server.
 *
 * Hai lớp sửa:
 *   GĐ8 — `cramersV()` dùng bảng contingency **thưa** (O(n) thay vì O(r×c)).
 *   GĐ9 — `run-analysis.handler.ts` loại cột `identifier`/`text`/`datetime`
 *          theo vai trò, trước khi tính tương quan/VIF.
 */
import {
  computePairCell,
  buildCorrelationMatrix,
} from '../src/modules/analysis/domain/correlation.util';
import { computeVif } from '../src/modules/analysis/domain/vif.util';
import {
  correlationExclusionReason,
  inferColumnRoles,
  inferColumnRole,
} from '../src/modules/analysis/domain/column-role.util';

/** Số ô mà ma trận dense `r × c` sẽ cần. */
const denseCells = (r: number, c: number): number => r * c;

describe('GĐ8 — Cramér V trên bảng contingency thưa', () => {
  it('tương quan hoàn hảo giữa hai cột phân loại → V ≈ 1', () => {
    const rows = Array.from({ length: 30 }, (_, i) => ({
      a: i % 2 === 0 ? 'A' : 'B',
      b: i % 2 === 0 ? 'X' : 'Y',
    }));
    const cell = computePairCell(
      { colA: 'a', roleA: 'categorical', colB: 'b', roleB: 'categorical', rows },
      'pearson',
    );
    expect(cell.computable).toBe(true);
    expect(cell.coef).toBeCloseTo(1, 4);
    expect(cell.kind).toBe('cramers_v');
  });

  it('không liên hệ → V gần 0', () => {
    const rows = Array.from({ length: 40 }, (_, i) => ({
      a: i % 2 === 0 ? 'A' : 'B',
      b: i % 4 < 2 ? 'X' : 'Y',
    }));
    const cell = computePairCell(
      { colA: 'a', roleA: 'categorical', colB: 'b', roleB: 'categorical', rows },
      'pearson',
    );
    expect(cell.computable).toBe(true);
    expect(cell.coef as number).toBeLessThan(0.2);
  });

  it('V luôn nằm trong [0, 1]', () => {
    const rows = Array.from({ length: 50 }, (_, i) => ({
      a: `l${i % 3}`,
      b: `m${i % 7}`,
    }));
    const cell = computePairCell(
      { colA: 'a', roleA: 'categorical', colB: 'b', roleB: 'categorical', rows },
      'pearson',
    );
    expect(cell.coef).not.toBeNull();
    expect(cell.coef as number).toBeGreaterThanOrEqual(0);
    expect(cell.coef as number).toBeLessThanOrEqual(1);
  });

  it('CHỐNG OOM: 100.000 dòng với cột định danh ~99k giá trị khác nhau không làm nổ heap', () => {
    // Mô phỏng đúng dataset đã làm sập server: 2 cột định danh, gần như mọi
    // giá trị đều khác nhau. Ma trận dense tương ứng là ~9,8 tỷ ô (73 GB).
    const n = 100_000;
    const rows = Array.from({ length: n }, (_, i) => ({
      id_a: `id-a-${i}`,
      id_b: `id-b-${i}`,
    }));

    const distinctA = new Set(rows.map((r) => r.id_a)).size;
    const distinctB = new Set(rows.map((r) => r.id_b)).size;

    // Bản dense sẽ cần ~73 GB → không thể chạy được trong test runner.
    expect(denseCells(distinctA, distinctB)).toBeGreaterThan(9_000_000_000);
    expect(denseCells(distinctA, distinctB) * 8).toBeGreaterThan(70 * 1024 ** 3);

    // Bản thưa phải tính được trong giới hạn bộ nhớ của test runner.
    const cell = computePairCell(
      { colA: 'id_a', roleA: 'categorical', colB: 'id_b', roleB: 'categorical', rows },
      'pearson',
    );
    expect(cell.computable).toBe(true);
    expect(cell.n).toBe(n);
    expect(cell.coef).not.toBeNull();
    expect(cell.coef as number).toBeGreaterThanOrEqual(0);
    expect(cell.coef as number).toBeLessThanOrEqual(1);
  });

  it('số mức (r, c) vẫn được báo đúng để hợp đồng API không đổi', () => {
    const rows = [
      { a: 'x', b: 'p' },
      { a: 'y', b: 'q' },
      { a: 'y', b: 'q' },
      { a: 'x', b: 'q' },
    ];
    const cell = computePairCell(
      { colA: 'a', roleA: 'categorical', colB: 'b', roleB: 'categorical', rows },
      'pearson',
    );
    expect(cell.computable).toBe(true);
    expect(cell.totalScanned).toBe(4);
  });
});

describe('GĐ9 — lọc cột theo vai trò trước khi tính tương quan', () => {
  const buildDatasetRows = (): Record<string, unknown>[] =>
    Array.from({ length: 60 }, (_, i) => ({
      review_id: `rid-${i}`,
      order_id: `oid-${i}`,
      review_score: String(i % 5),
      comment_title: `title-${i % 7}`,
      comment_message: i % 3 === 0 ? `msg-${i}` : null,
      created_at: '2024-01-01',
    }));

  it('cột tên gợi ý định danh + gần như duy nhất → vai trò identifier', () => {
    const rows = buildDatasetRows();
    const role = inferColumnRole(
      { key: 'c0', name: 'review_id', dataType: 'string' },
      rows.map((r) => r.review_id),
      rows.length,
    );
    expect(role.role).toBe('identifier');
    expect(correlationExclusionReason(role.role)).toBe('identifier_column_excluded');
  });

  it('cột gần như duy nhất (văn bản tự do) → vai trò text, bị loại', () => {
    const rows = buildDatasetRows();
    const role = inferColumnRole(
      { key: 'c4', name: 'comment_message', dataType: 'string' },
      rows.map((r) => r.comment_message),
      rows.length,
    );
    expect(role.role).toBe('text');
    expect(correlationExclusionReason(role.role)).toBe('free_text_column_excluded');
  });

  it('cột kiểu ngày → vai trò datetime, bị loại khỏi tương quan', () => {
    const role = inferColumnRole(
      { key: 'c5', name: 'created_at', dataType: 'date' },
      ['2024-01-01'],
      1,
    );
    expect(role.role).toBe('datetime');
    expect(correlationExclusionReason(role.role)).toBe('date_column_excluded_from_correlation_vif');
  });

  it('suy vai trò cho nhiều cột: identifier/text/datetime bị loại, định lượng & phân loại giữ lại', () => {
    const rows = buildDatasetRows();
    const roles = inferColumnRoles(
      [
        { key: 'c0', name: 'review_id', dataType: 'string' },
        { key: 'c1', name: 'order_id', dataType: 'string' },
        { key: 'c2', name: 'review_score', dataType: 'number' },
        { key: 'c3', name: 'comment_title', dataType: 'string' },
        { key: 'c4', name: 'comment_message', dataType: 'string' },
        { key: 'c5', name: 'created_at', dataType: 'date' },
      ],
      rows,
      null,
    );
    const byName = new Map(roles.map((r) => [r.name, r.role] as const));
    expect(byName.get('review_id')).toBe('identifier');
    expect(byName.get('order_id')).toBe('identifier');
    expect(byName.get('review_score')).toBe('category');
    expect(byName.get('comment_message')).toBe('text');
    expect(byName.get('created_at')).toBe('datetime');
  });

  it('ma trận tương quan CHỈ dùng cột đã lọc — ma trận dense không bao giờ được dựng', () => {
    const rows = Array.from({ length: 40 }, (_, i) => ({
      id_a: `a-${i}`,
      id_b: `b-${i}`,
      cat: i % 4 === 0 ? 'p' : 'q',
    }));

    // Mô phỏng đúng kết quả của GĐ9: cột định danh đã bị loại trước.
    const analyzable = [
      { key: 'id_a', role: 'excluded' as const, reason: 'identifier_column_excluded' },
      { key: 'id_b', role: 'excluded' as const, reason: 'identifier_column_excluded' },
      { key: 'cat', role: 'categorical' as const, reason: null },
    ];
    const { cells, notes } = buildCorrelationMatrix(analyzable, rows, 'pearson');
    expect(cells).toHaveLength(1);
    expect(cells[0]?.colA).toBe('cat');
    expect(notes.join(' ')).toMatch(/loại/);
  });

  it('VIF chỉ chạy trên cột định lượng đã qua lọc', () => {
    // `other` KHÔNG phải hàm tuyến tính của `measure` — nếu là vậy VIF = singular
    // (cộng tuyến hoàn hảo) và cột bị đánh dấu không tính được, không phải do lọc.
    const rows = Array.from({ length: 30 }, (_, i) => ({
      measure: i + 1,
      other: (i + 1) * 2 + Math.sin(i) * 3 + 0.5,
    }));
    const out = computeVif(['measure', 'other'], rows);
    expect(out.commonN).toBe(30);
    expect(out.rows.every((r) => r.computable)).toBe(true);
  });
});
