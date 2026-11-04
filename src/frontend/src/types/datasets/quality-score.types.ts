// Hợp đồng nguồn 18 điểm chất lượng, độc lập với số tower đang hiển thị.
//
// File này chỉ có kiểu: nó là chỗ duy nhất hình dung "một điểm số" là gì, để Phase 2–3 tô màu
// không phải đoán. Backend đang được setup nên ba câu hỏi dưới đây **chưa có câu trả lời**, và
// mỗi câu đều đổi một thứ khác nhau — vì vậy chúng ghi ở đây chứ không nằm trong một comment
// của file hình ảnh:
//   1. `score` là tỉ lệ **đạt** hay tỉ lệ **lỗi**? Mã giả định tỉ lệ đạt (ô sáng = đạt), vì
//      `on = round(score × cellCount)`. Nếu API trả tỉ lệ lỗi thì chỉ `normalize` đổi, không đổi hình.
//   2. Một "slice" là gì: hai bảng, hai nguồn, hay hai nhóm cột? `sliceA`/`sliceB` chỉ là nhãn.
//   3. Điểm cập nhật theo mỗi lần phân tích hay realtime? Quyết định `animate` của `applyScores`.

export type DqDimension =
  | 'completeness'
  | 'uniqueness'
  | 'validity'
  | 'accuracy'
  | 'consistency'
  | 'timeliness'

export type ScoreScope = 'overall' | 'sliceA' | 'sliceB'

// 0..1, KHÔNG dùng 0..100: mọi ngưỡng trong hệ gauge (0,6 và 0,85) viết theo thang này.
export type DimensionScore = {
  dimension: DqDimension
  scope: ScoreScope
  score: number
}

export type QualityScoreSource = {
  // 18 bản ghi: 6 overall + 6 sliceA + 6 sliceB.
  read(): Promise<DimensionScore[]>
  // Có thì mới bật đường cập nhật realtime; không có thì caller đọc một lần.
  subscribe?(next: (rows: DimensionScore[]) => void): () => void
}
