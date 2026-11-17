import { useCallback, useRef, useState } from 'react'
import type { ConfirmedProjectResult } from '../../types'
import { validateResultReview } from '../../services/processing'

export function useResultReview(result: ConfirmedProjectResult, onClose: () => void, onSaved: () => void) {
  const inFlight = useRef(false)
  const [rating, setRating] = useState(0)
  const [comment, setComment] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const close = useCallback(() => { if (!inFlight.current) onClose() }, [onClose])
  const submit = async () => {
    if (inFlight.current) return
    const review = { rating, comment: comment.trim() }
    const invalid = validateResultReview(review)
    if (invalid) { setError(invalid); return }
    inFlight.current = true
    setSaving(true)
    setError(null)
    try {
      await result.save(review)
      onSaved()
    } catch {
      setError('Chưa lưu được đánh giá và kết quả vào hệ thống. Nội dung của bạn vẫn được giữ; hãy thử lại.')
    } finally {
      inFlight.current = false
      setSaving(false)
    }
  }
  return { rating, setRating, comment, setComment, saving, error, setError, close, submit }
}
