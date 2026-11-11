import type { ResultReviewInput } from '../../types/processing/result-review.types'

export const validateResultReview = (review: ResultReviewInput): string | null => {
  if (!Number.isInteger(review.rating) || review.rating < 1 || review.rating > 5) return 'Vui lòng chọn từ 1 đến 5 sao.'
  if (!review.comment.trim()) return 'Vui lòng nhập nội dung đánh giá.'
  return null
}
