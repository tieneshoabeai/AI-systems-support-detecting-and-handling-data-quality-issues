// Suy ra trạng thái từng ô từ một điểm số (kế hoạch v2, mục 4) và nguồn điểm giả của Phase 1.
// Thuần: không THREE, không DOM, không random — unit test chạy ngay.
//
// Vì sao không cần seed: v1 lấy vị trí ô lỗi bằng `createRandom(seed)` + shuffle. Một infographic
// đọc được cần ô lỗi **đều nhau** chứ không cần ngẫu nhiên, và phân bố đều thì kiểm được bằng số
// (test chốt đúng mảng index), nên mỗi chiều dùng một quy tắc chia bucket tất định.
import type {
  DimensionScore,
  DqDimension,
  QualityScoreSource,
  ScoreScope,
} from '../../types/datasets/quality-score.types'

// `on` = sáng, `off` = tắt hẳn (thiếu dữ liệu), còn lại là ô sáng mang một dạng lỗi.
// `unverified` là kind mới so với danh sách của v1: accuracy cần phân biệt "đã kiểm" và "chưa kiểm"
// mà không dùng mark hình học, nên nó phải là một kind để lớp tô màu tra theo bảng, không phải một
// nhánh if trong Phase 2.
export type CellKind =
  | 'on'
  | 'off'
  | 'invalid'
  | 'duplicate'
  | 'stale'
  | 'mismatch'
  | 'verified'
  | 'unverified'

export const litCount = (score: number, count: number) =>
  Math.min(count, Math.max(0, Math.round(score * count)))

// Một marker cho mỗi bucket, lấy ở **đỉnh** bucket: tăng ngặt, phân bố đều, không trùng.
// count 10 / marks 3 -> [2, 5, 9]
function bucketTops(count: number, marks: number): number[] {
  const out: number[] = []
  for (let k = 0; k < marks; k += 1) out.push(Math.floor(((k + 1) * count) / marks) - 1)
  return out
}

// count 10 / marks 3 -> [0, 3, 6]
function bucketBottoms(count: number, marks: number): number[] {
  const out: number[] = []
  for (let k = 0; k < marks; k += 1) out.push(Math.floor((k * count) / marks))
  return out
}

// Consistency đánh dấu theo **cặp ô liền kề** (bad/2 cặp, lẻ thì một ô đơn). Có chỗ trống thì chèn
// một ô tắt giữa hai cặp để không thành vệt ba ô; không đủ chỗ thì xếp sát nhau — thà liền mạch còn
// hơn mất ô. count 10 / bad 5 -> [0, 1, 3, 4, 6]
function mismatchIndices(count: number, marks: number): number[] {
  const groups = Math.ceil(marks / 2)
  const gap = count - marks >= groups - 1 ? 1 : 0
  const out: number[] = []
  let minStart = 0
  for (let g = 0; g < groups; g += 1) {
    const size = marks % 2 === 1 && g === groups - 1 ? 1 : 2
    const ideal = Math.floor((g * count) / groups)
    const start = Math.min(Math.max(ideal, minStart), count - size)
    out.push(start)
    if (size === 2) out.push(start + 1)
    minStart = start + size + gap
  }
  return out
}

// Index 0 là ô **dưới cùng** của cột: phần thiếu của completeness và phần cũ của timeliness nằm trên
// cao, đúng mục 4 của v2.
export function deriveCells(dimension: DqDimension, score: number, count: number): CellKind[] {
  const on = litCount(score, count)
  const bad = count - on
  const cells: CellKind[] = Array.from({ length: count }, () => 'on')

  switch (dimension) {
    case 'completeness': {
      for (let i = on; i < count; i += 1) cells[i] = 'off'
      break
    }
    case 'validity': {
      for (const index of bucketTops(count, bad)) cells[index] = 'invalid'
      break
    }
    case 'uniqueness': {
      for (const index of bucketBottoms(count, bad)) cells[index] = 'duplicate'
      break
    }
    case 'timeliness': {
      for (let i = count - bad; i < count; i += 1) cells[i] = 'stale'
      break
    }
    case 'consistency': {
      for (const index of mismatchIndices(count, bad)) cells[index] = 'mismatch'
      break
    }
    case 'accuracy': {
      for (let i = 0; i < on; i += 1) cells[i] = 'verified'
      for (let i = on; i < count; i += 1) cells[i] = 'unverified'
      break
    }
  }

  return cells
}

// ---------------------------------------------------------------------------
// Nguồn điểm giả. Đây là một `QualityScoreSource` thật về mặt kiểu, nên Phase 2–3 nối vào model
// đúng đường của API; đổi nguồn chỉ là thay chỗ đọc rows, không đổi một dòng tô màu.
// Ba câu hỏi để ngỏ ở quality-score.types.ts **chưa** được trả lời — mock giả định `score` là tỉ lệ
// đạt, và `subscribe` không có vì chưa ai biết điểm cập nhật theo lần phân tích hay realtime.
// Mỗi scope phủ cả ba mức để sáu hero không cùng một màu; A/B của cùng một chiều lệch nhau rõ.
// ---------------------------------------------------------------------------

const MOCK_SCORES: Readonly<Record<DqDimension, Record<ScoreScope, number>>> = {
  completeness: { overall: 0.94, sliceA: 0.97, sliceB: 0.71 },
  uniqueness: { overall: 0.88, sliceA: 0.82, sliceB: 0.55 },
  validity: { overall: 0.73, sliceA: 0.86, sliceB: 0.41 },
  accuracy: { overall: 0.64, sliceA: 0.53, sliceB: 0.92 },
  consistency: { overall: 0.48, sliceA: 0.66, sliceB: 0.38 },
  timeliness: { overall: 0.57, sliceA: 0.71, sliceB: 0.9 },
}

const MOCK_SCOPES: readonly ScoreScope[] = ['overall', 'sliceA', 'sliceB']

// 18 bản ghi: 6 overall + 6 sliceA + 6 sliceB, thứ tự ổn định theo scope rồi dimension.
export const MOCK_QUALITY_SCORES: readonly DimensionScore[] = MOCK_SCOPES.flatMap(scope =>
  (Object.keys(MOCK_SCORES) as DqDimension[]).map(dimension => ({
    dimension,
    scope,
    score: MOCK_SCORES[dimension][scope],
  })),
)

export function createMockQualityScoreSource(
  rows: readonly DimensionScore[] = MOCK_QUALITY_SCORES,
): QualityScoreSource {
  return {
    read: async () => rows.map(row => ({ ...row })),
  }
}
