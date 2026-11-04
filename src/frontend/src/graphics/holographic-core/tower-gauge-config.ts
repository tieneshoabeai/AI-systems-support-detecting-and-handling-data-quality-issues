// Bảng số của gauge chất lượng: palette, gain, ngưỡng và gán chiếu 14 tháp đang hiển thị.
// Thuần dữ liệu — chỉ có type-only import nên file này không kéo theo THREE, và vì thế unit test
// chạy được không cần WebGL (Phase 1).
//
// Palette mới do human chốt: đạt xanh lá, cảnh báo hổ phách, nghiêm trọng đỏ hồng.
// Màu AI đã xử lý chỉ được khai báo; không suy diễn trạng thái này từ điểm số.
import type { DqDimension, ScoreScope } from '../../types/datasets/quality-score.types'

export const DIMENSIONS: readonly DqDimension[] = [
  'completeness',
  'uniqueness',
  'validity',
  'accuracy',
  'consistency',
  'timeliness',
]

export const GAUGE_COLOR = {
  good: '#34d399',
  mid: '#f59e0b',
  poor: '#f43f5e',
  off: '#2a2150',
  handled: '#a78bfa',
  body: '#0b1430',
  edge: '#6b7fb3',
} as const

// Rec.709 luminance trước ánh sáng/opacity: good≈0.844, mid≈0.790, poor≈1.109.
// Gain cũ làm mid sáng hơn poor sau đổi palette. Bloom thật vẫn phải kiểm bằng ảnh render.
export const CELL_GAIN = { good: 1.7, mid: 1.8, poor: 4.7, off: 0.35 } as const

// Biên thuộc về `>=`: 0,85 là good, 0,6 là mid.
export const GAUGE_THRESHOLD = { good: 0.85, mid: 0.6 } as const

export type GaugeState = keyof typeof CELL_GAIN

export const stateOf = (score: number): GaugeState =>
  score >= GAUGE_THRESHOLD.good
    ? 'good'
    : score >= GAUGE_THRESHOLD.mid
      ? 'mid'
      : 'poor'

export type GaugeRole = 'hero' | 'context'

export type GaugeTarget = {
  towerId: string
  dimension: DqDimension
  scope: ScoreScope
  role: GaugeRole
}

export type HeroGaugeTarget = GaugeTarget & { shape: 'octagon' }

// Hero chốt theo id (mục 0 của v2), không chạy `pickHeroes` của v1: thuật toán đó trả về 3 tháp
// vòng trong và để 210° lệch tới 28,5°, nghĩa là phải dời tháp — trái C2. Sáu hero ở vòng ngoài,
// mỗi chiều đúng một lần, đọc điểm `overall`.
export const HERO_GAUGES: readonly HeroGaugeTarget[] = [
  { towerId: 'tower-10', dimension: 'completeness', scope: 'overall', role: 'hero', shape: 'octagon' },
  { towerId: 'tower-12', dimension: 'uniqueness', scope: 'overall', role: 'hero', shape: 'octagon' },
  { towerId: 'tower-13', dimension: 'validity', scope: 'overall', role: 'hero', shape: 'octagon' },
  { towerId: 'tower-14', dimension: 'accuracy', scope: 'overall', role: 'hero', shape: 'octagon' },
  { towerId: 'tower-17', dimension: 'consistency', scope: 'overall', role: 'hero', shape: 'octagon' },
  { towerId: 'tower-18', dimension: 'timeliness', scope: 'overall', role: 'hero', shape: 'octagon' },
]

// Eight context towers remain after removing 05, 06, 11 and 15. Their sliceA completeness,
// validity/uniqueness and sliceB consistency scores stay in the source contract without a tower.
// Existing window panels display proportions rather than an exact cell count.
export const CONTEXT_GAUGES: readonly GaugeTarget[] = [
  { towerId: 'tower-07', dimension: 'accuracy', scope: 'sliceA', role: 'context' },
  { towerId: 'tower-08', dimension: 'consistency', scope: 'sliceA', role: 'context' },
  { towerId: 'tower-09', dimension: 'timeliness', scope: 'sliceA', role: 'context' },
  { towerId: 'tower-01-back-high', dimension: 'completeness', scope: 'sliceB', role: 'context' },
  { towerId: 'tower-16', dimension: 'uniqueness', scope: 'sliceB', role: 'context' },
  { towerId: 'tower-02', dimension: 'validity', scope: 'sliceB', role: 'context' },
  { towerId: 'tower-03', dimension: 'accuracy', scope: 'sliceB', role: 'context' },
  { towerId: 'tower-04', dimension: 'timeliness', scope: 'sliceB', role: 'context' },
]

export const GAUGE_TARGETS: readonly GaugeTarget[] = [...HERO_GAUGES, ...CONTEXT_GAUGES]

export const DIMENSION_LABELS: Readonly<Record<DqDimension, string>> = {
  completeness: 'Completeness — Đầy đủ',
  uniqueness: 'Uniqueness — Duy nhất',
  validity: 'Validity — Hợp lệ',
  accuracy: 'Accuracy — Chính xác',
  consistency: 'Consistency — Nhất quán',
  timeliness: 'Timeliness — Kịp thời',
}

export function heroLabelForId(id: string): string | null {
  const target = HERO_GAUGES.find(target => target.towerId === id)
  return target ? DIMENSION_LABELS[target.dimension] : null
}

// Hero dùng 10 ô **cố định**, không theo `floorCount` của tháp: sáu cây thước phải cùng thang thì
// số ô mới so được với nhau, trong khi floorCount của sáu hero là 10/10/6/9/6/10.
export const HERO_CELL_COUNT = 10

// Composite hero: a square core, four L by L/4 glass arms, four metal corner fillers.
// Keep the approved cap profile as reference, independent of the new, tighter cell spacing.
// Half of that cap stays solid; its freed upper half holds the crown within the old envelope.
const CAP_REFERENCE = { cellGap: 0.025, endInset: 0.08 } as const
export const HERO_FORM = {
  coreRatio: 2 / 3,
  armRatio: 1 / 4,
  capTopRatio: 3 / 4,
  cellGap: 0.005,
  bottomInset: 0.016,
  coreGain: 0.5,
  clockPeriodSeconds: 60,
} as const

export function heroGaugeDimensions(width: number, height: number, depth: number) {
  const referenceCapHeight = (height - 2 * CAP_REFERENCE.endInset - (HERO_CELL_COUNT - 1) * CAP_REFERENCE.cellGap) / (HERO_CELL_COUNT + 1)
  const capHeight = referenceCapHeight / 2
  const bodyHeight = height - referenceCapHeight
  const cellHeight = (bodyHeight - HERO_FORM.bottomInset - (HERO_CELL_COUNT - 1) * HERO_FORM.cellGap) / HERO_CELL_COUNT
  return {
    coreWidth: width * HERO_FORM.coreRatio,
    coreDepth: depth * HERO_FORM.coreRatio,
    armWidth: width * HERO_FORM.coreRatio * HERO_FORM.armRatio,
    armDepth: depth * HERO_FORM.coreRatio * HERO_FORM.armRatio,
    cellHeight,
    capHeight,
    crownHeight: referenceCapHeight / 2,
    capTopY: height / 2 - capHeight,
    bodyHeight,
    bodyCenterY: -referenceCapHeight / 2,
    bodyTopY: height / 2 - referenceCapHeight,
    cellPitch: cellHeight + HERO_FORM.cellGap,
    cellBottom: -height / 2 + HERO_FORM.bottomInset,
  }
}
