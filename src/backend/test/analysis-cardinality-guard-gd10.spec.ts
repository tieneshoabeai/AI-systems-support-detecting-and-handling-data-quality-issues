/**
 * GĐ10 — Guard theo cardinality cho ma trận tương quan.
 *
 * Bối cảnh: GĐ8 đã dùng bảng contingency **thưa** nên Cramér V không còn
 * nổ heap. Nhưng GĐ9 (lọc theo vai trò cột) là heuristic — một cặp cột lọt
 * qua vẫn có thể có cardinality khổng lồ. GĐ10 là **lưới an toàn cuối**:
 * chặn cặp có `distinct(A) × distinct(B)` vượt ngưỡng và báo rõ lý do thay
 * vì để bộ nhớ tăng vô hạn.
 */
import {
  buildCorrelationMatrix,
  exceedsCardinalityGuard,
  MAX_CORRELATION_CELLS,
} from '../src/modules/analysis/domain/correlation.util';

describe('GĐ10 — exceedsCardinalityGuard', () => {
  it('cặp nhỏ -> an toàn (null)', () => {
    expect(exceedsCardinalityGuard(2, 2)).toBeNull();
    expect(exceedsCardinalityGuard(20, 20)).toBeNull();
  });

  it('cặp vừa đúng ngưỡng -> an toàn', () => {
    expect(exceedsCardinalityGuard(1000, 10_000)).toBeNull();
  });

  it('cặp vượt ngưỡng -> trả lý do có số liệu', () => {
    const reason = exceedsCardinalityGuard(100_000, 100_000);
    expect(reason).not.toBeNull();
    expect(reason).toMatch(/cardinality_guard_exceeded/);
    expect(reason).toMatch(/100000/);
    expect(reason).toMatch(/10\.000\.000/);
  });

  it('một bên có < 2 mức -> không chặn (không đáng kể)', () => {
    expect(exceedsCardinalityGuard(1, 100_000_000)).toBeNull();
    expect(exceedsCardinalityGuard(0, 100_000_000)).toBeNull();
  });

  it('ngưỡng mặc định là 10.000.000 ô', () => {
    expect(MAX_CORRELATION_CELLS).toBe(10_000_000);
  });

  it('cho phép ghi đè ngưỡng', () => {
    expect(exceedsCardinalityGuard(100, 100, 100)).toMatch(/cardinality_guard_exceeded/);
    expect(exceedsCardinalityGuard(100, 100, 100_000)).toBeNull();
  });
});

describe('GĐ10 — buildCorrelationMatrix chặn cặp cardinality quá lớn', () => {
  it('cặp phân loại vượt ngưỡng -> computable=false, coef=null, có lý do', () => {
    const rows = Array.from({ length: 200 }, (_, i) => ({
      id_a: `a-${i}`,
      id_b: `b-${i}`,
      cat: i % 3 === 0 ? 'p' : 'q',
    }));
    const analyzable = [
      { key: 'id_a', role: 'categorical' as const, reason: null },
      { key: 'id_b', role: 'categorical' as const, reason: null },
      { key: 'cat', role: 'categorical' as const, reason: null },
    ];
    // 200 × 200 = 40.000 ô -> dưới ngưỡng -> vẫn tính được
    const ok = buildCorrelationMatrix(analyzable, rows, 'pearson');
    const cellA = ok.cells.find((c) => c.colA === 'id_a' && c.colB === 'id_b');
    expect(cellA?.computable).toBe(true);

    // Siết ngưỡng xuống 1000 -> cặp bị chặn
    const guarded = buildCorrelationMatrix(analyzable, rows, 'pearson', { maxCells: 1000 });
    const cellB = guarded.cells.find((c) => c.colA === 'id_a' && c.colB === 'id_b');
    expect(cellB?.computable).toBe(false);
    expect(cellB?.coef).toBeNull();
    expect(cellB?.reason).toMatch(/cardinality_guard_exceeded/);
  });

  it('notes có nói rõ cặp nào bị bỏ qua', () => {
    const rows = Array.from({ length: 50 }, (_, i) => ({
      id_a: `a-${i}`,
      id_b: `b-${i}`,
    }));
    const analyzable = [
      { key: 'id_a', role: 'categorical' as const, reason: null },
      { key: 'id_b', role: 'categorical' as const, reason: null },
    ];
    const { notes } = buildCorrelationMatrix(analyzable, rows, 'pearson', { maxCells: 100 });
    expect(notes.join(' ')).toMatch(/cardinality/);
    expect(notes.join(' ')).toMatch(/id_a x id_b/);
  });

  it('cặp numeric × categorical KHÔNG bị guard (không dựng contingency)', () => {
    // 40 dòng, `id_a` có 20 mức → 20 × 20 = 400 ô > ngưỡng 10.
    // Nhưng cặp numeric × categorical dùng eta² (không dựng contingency)
    // → KHÔNG được chặn.
    const rows = Array.from({ length: 40 }, (_, i) => ({
      num: i,
      id_a: `a-${i % 20}`,
    }));
    const analyzable = [
      { key: 'num', role: 'numeric' as const, reason: null },
      { key: 'id_a', role: 'categorical' as const, reason: null },
    ];
    const { cells } = buildCorrelationMatrix(analyzable, rows, 'pearson', { maxCells: 10 });
    const cell = cells.find((c) => c.colA === 'num' && c.colB === 'id_a');
    expect(cell?.computable).toBe(true);
    expect(cell?.kind).toBe('eta_squared');
  });

  it('cặp numeric × numeric KHÔNG bị guard', () => {
    const rows = Array.from({ length: 100 }, (_, i) => ({ x: i, y: i * 2 }));
    const analyzable = [
      { key: 'x', role: 'numeric' as const, reason: null },
      { key: 'y', role: 'numeric' as const, reason: null },
    ];
    const { cells } = buildCorrelationMatrix(analyzable, rows, 'pearson', { maxCells: 1 });
    const cell = cells.find((c) => c.colA === 'x' && c.colB === 'y');
    expect(cell?.computable).toBe(true);
    expect(cell?.coef).toBeCloseTo(1, 4);
  });

  it('đường chéo (cùng cột) vẫn được xử lý như trước', () => {
    const rows = Array.from({ length: 20 }, (_, i) => ({ cat: i % 2 === 0 ? 'p' : 'q' }));
    const analyzable = [{ key: 'cat', role: 'categorical' as const, reason: null }];
    const { cells } = buildCorrelationMatrix(analyzable, rows, 'pearson', { maxCells: 1 });
    expect(cells).toHaveLength(1);
    expect(cells[0]?.colA).toBe('cat');
    expect(cells[0]?.colB).toBe('cat');
  });
});
