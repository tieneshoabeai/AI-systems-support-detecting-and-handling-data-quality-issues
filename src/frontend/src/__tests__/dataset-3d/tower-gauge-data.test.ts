// Phase 1 của kế hoạch gauge v2: toàn bộ logic suy ra ô là hàm thuần, nên nó kiểm được không cần WebGL.
// Hai thứ file này chốt bằng số thay vì bằng comment trong file hình ảnh:
//   * biên 0,6 và 0,85 là `>=` (điểm 0,85 là good, không phải mid);
//   * **số ô mang lỗi luôn bằng `bad`** với cả sáu chiều và mọi count — đây là bất biến mà lớp tô
//     màu Phase 2 dựa vào, và nó từng có nguy cơ vỡ ở consistency (đánh dấu theo cặp).
// Vị trí ô lỗi cũng bị khoá thành mảng index cụ thể: cùng một điểm số phải cho ra cùng một cột ô ở
// mọi lần chạy, kể cả sau khi ai đó đổi thuật toán phân bố.
import { describe, expect, it } from 'vitest'
import {
  CONTEXT_GAUGES,
  DIMENSIONS,
  GAUGE_THRESHOLD,
  GAUGE_COLOR,
  CELL_GAIN,
  HERO_CELL_COUNT,
  HERO_GAUGES,
  stateOf,
} from '../../graphics/holographic-core/tower-gauge-config'
import {
  MOCK_QUALITY_SCORES,
  createMockQualityScoreSource,
  deriveCells,
  litCount,
  type CellKind,
} from '../../graphics/holographic-core/tower-gauge-data'
import { TOWER_IDS } from '../../graphics/holographic-core/tower-config'

const ERROR_KIND: Record<string, CellKind> = {
  completeness: 'off',
  validity: 'invalid',
  uniqueness: 'duplicate',
  timeliness: 'stale',
  consistency: 'mismatch',
  accuracy: 'unverified',
}

const errorCells = (dimension: string, cells: CellKind[]) =>
  cells.filter(cell => cell === ERROR_KIND[dimension]).length

const indicesOf = (cells: CellKind[], kind: CellKind) =>
  cells.map((cell, index) => (cell === kind ? index : -1)).filter(index => index >= 0)

describe('stateOf', () => {
  it('keeps critical source luminance above bloom threshold with the new palette', () => {
    const luminance = (hex: string) => {
      const channels = [1, 3, 5].map(index => parseInt(hex.slice(index, index + 2), 16) / 255)
        .map(value => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4)
      return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722
    }
    expect(GAUGE_COLOR.good).toBe('#34d399')
    expect(GAUGE_COLOR.mid).toBe('#f59e0b')
    expect(GAUGE_COLOR.poor).toBe('#f43f5e')
    expect(GAUGE_COLOR.handled).toBe('#a78bfa')
    expect(luminance(GAUGE_COLOR.good) * CELL_GAIN.good).toBeLessThan(1)
    expect(luminance(GAUGE_COLOR.mid) * CELL_GAIN.mid).toBeLessThan(1)
    expect(luminance(GAUGE_COLOR.poor) * CELL_GAIN.poor).toBeGreaterThan(1)
  })

  it('reads its boundaries as >= and never above them', () => {
    expect(GAUGE_THRESHOLD).toEqual({ good: 0.85, mid: 0.6 })
    expect(stateOf(1)).toBe('good')
    expect(stateOf(0.85)).toBe('good')
    expect(stateOf(0.8499)).toBe('mid')
    expect(stateOf(0.6)).toBe('mid')
    expect(stateOf(0.5999)).toBe('poor')
    expect(stateOf(0)).toBe('poor')
  })
})

describe('litCount', () => {
  it('rounds to the nearest cell and stays inside the column', () => {
    expect(litCount(0.72, 10)).toBe(7)
    expect(litCount(0.75, 10)).toBe(8)
    expect(litCount(0.94, 10)).toBe(9)
    expect(litCount(1, 10)).toBe(10)
    expect(litCount(0, 10)).toBe(0)
    expect(litCount(1.4, 10)).toBe(10)
    expect(litCount(-0.2, 10)).toBe(0)
  })
})

describe('deriveCells', () => {
  it('marks exactly the bad cells for every dimension, at every height', () => {
    for (const dimension of DIMENSIONS) {
      for (const count of [3, 5, 6, 9, 10, 12, 16]) {
        for (const score of [0, 0.05, 0.38, 0.5, 0.6, 0.66, 0.72, 0.82, 0.85, 0.9, 0.94, 1]) {
          const cells = deriveCells(dimension, score, count)
          const bad = count - litCount(score, count)
          expect(cells).toHaveLength(count)
          expect(errorCells(dimension, cells)).toBe(bad)
        }
      }
    }
  })

  it('puts what is missing or old at the TOP of the column', () => {
    // index 0 là ô dưới cùng, nên phần thiếu phải là những ô cuối mảng.
    expect(deriveCells('completeness', 0.72, 10)).toEqual([
      'on', 'on', 'on', 'on', 'on', 'on', 'on', 'off', 'off', 'off',
    ])
    expect(deriveCells('timeliness', 0.72, 10)).toEqual([
      'on', 'on', 'on', 'on', 'on', 'on', 'on', 'stale', 'stale', 'stale',
    ])
    expect(deriveCells('accuracy', 0.72, 10)).toEqual([
      'verified', 'verified', 'verified', 'verified', 'verified', 'verified', 'verified',
      'unverified', 'unverified', 'unverified',
    ])
  })

  it('spreads validity and uniqueness instead of stacking them at one end', () => {
    expect(indicesOf(deriveCells('validity', 0.72, 10), 'invalid')).toEqual([2, 5, 9])
    expect(indicesOf(deriveCells('uniqueness', 0.72, 10), 'duplicate')).toEqual([0, 3, 6])
    // Hai chiều cùng điểm không được trùng vị trí, nếu không tháp validity và uniqueness đọc giống nhau.
    expect(deriveCells('validity', 0.7, 10)).not.toEqual(deriveCells('uniqueness', 0.7, 10))
  })

  it('breaks consistency in adjacent pairs and never drops a cell', () => {
    expect(indicesOf(deriveCells('consistency', 0.5, 10), 'mismatch')).toEqual([0, 1, 3, 4, 6])
    expect(indicesOf(deriveCells('consistency', 0.6, 10), 'mismatch')).toEqual([0, 1, 5, 6])
    // Vệt ba ô chỉ bị cấm khi cột còn chỗ chèn một ô lành; cột gần như tắt hết thì thà liền mạch.
    expect(indicesOf(deriveCells('consistency', 0.05, 10), 'mismatch')).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8])
    for (const count of [3, 5, 6, 9, 10, 12, 16]) {
      for (let bad = 0; bad <= count; bad += 1) {
        const marked = indicesOf(deriveCells('consistency', (count - bad) / count, count), 'mismatch')
        expect(marked.length).toBe(bad)
        expect(new Set(marked).size).toBe(marked.length)
        expect(marked.every((index, i) => i === 0 || index > marked[i - 1]!)).toBe(true)
        if (count - bad >= Math.ceil(bad / 2)) {
          for (let i = 0; i + 2 < count; i += 1) {
            expect(marked.includes(i) && marked.includes(i + 1) && marked.includes(i + 2)).toBe(false)
          }
        }
      }
    }
  })

  it('is a pure function of (dimension, score, count) — no seed, no drift', () => {
    for (const dimension of DIMENSIONS) {
      expect(deriveCells(dimension, 0.63, 10)).toEqual(deriveCells(dimension, 0.63, 10))
    }
  })

  it('collapses to the two extremes without inventing cells', () => {
    for (const dimension of DIMENSIONS) {
      const full = deriveCells(dimension, 1, HERO_CELL_COUNT)
      expect(full).not.toContain('off')
      expect(errorCells(dimension, full)).toBe(0)
      const empty = deriveCells(dimension, 0, HERO_CELL_COUNT)
      expect(empty.every(cell => cell === ERROR_KIND[dimension] || cell === 'verified')).toBe(true)
    }
    expect(deriveCells('completeness', 0, HERO_CELL_COUNT).every(cell => cell === 'off')).toBe(true)
  })
})

describe('hero and context assignment', () => {
  it('covers all 14 active towers exactly once', () => {
    const ids = [...HERO_GAUGES, ...CONTEXT_GAUGES].map(target => target.towerId)
    expect(new Set(ids).size).toBe(14)
    expect([...ids].sort()).toEqual([...TOWER_IDS].sort())
  })

  it('gives each hero one distinct dimension, reading overall', () => {
    expect(HERO_GAUGES).toHaveLength(6)
    expect(HERO_GAUGES.every(target => target.scope === 'overall')).toBe(true)
    expect(HERO_GAUGES.map(target => target.dimension).sort()).toEqual([...DIMENSIONS].sort())
    expect(HERO_GAUGES.every(target => target.role === 'hero')).toBe(true)
  })

  it('preserves remaining context assignments without replacing removed towers', () => {
    expect(CONTEXT_GAUGES).toHaveLength(8)
    expect(CONTEXT_GAUGES.every(target => target.role === 'context')).toBe(true)
    for (const dimension of DIMENSIONS) {
      const rows = CONTEXT_GAUGES.filter(target => target.dimension === dimension)
      const removedSliceA = ['completeness', 'uniqueness', 'validity'].includes(dimension)
      expect(rows.map(row => row.scope).sort()).toEqual(removedSliceA ? ['sliceB'] : dimension === 'consistency' ? ['sliceA'] : ['sliceA', 'sliceB'])
    }
    // Same dimension twice => never on the same tower.
    expect(new Set(CONTEXT_GAUGES.map(target => target.towerId)).size).toBe(8)
  })

  it('keeps the six hero rulers on one scale', () => {
    expect(HERO_CELL_COUNT).toBe(10)
  })
})

describe('MOCK_QUALITY_SCORES', () => {
  it('is the 18 records the source contract promises', () => {
    expect(MOCK_QUALITY_SCORES).toHaveLength(18)
    const keys = MOCK_QUALITY_SCORES.map(row => `${row.scope}/${row.dimension}`)
    expect(new Set(keys).size).toBe(18)
  })

  it('stays inside 0..1 and shows all three states on every scope', () => {
    for (const row of MOCK_QUALITY_SCORES) {
      expect(row.score).toBeGreaterThan(0)
      expect(row.score).toBeLessThanOrEqual(1)
    }
    for (const scope of ['overall', 'sliceA', 'sliceB'] as const) {
      const states = MOCK_QUALITY_SCORES.filter(row => row.scope === scope).map(row => stateOf(row.score))
      expect([...new Set(states)].sort()).toEqual(['good', 'mid', 'poor'])
    }
  })

  it('reads through the real contract and hands out copies', async () => {
    const source = createMockQualityScoreSource()
    expect(source.subscribe).toBeUndefined()
    const first = await source.read()
    expect(first).toHaveLength(18)
    first[0]!.score = 0.01
    const second = await source.read()
    expect(second[0]!.score).toBeCloseTo(0.94, 6)
  })
})
