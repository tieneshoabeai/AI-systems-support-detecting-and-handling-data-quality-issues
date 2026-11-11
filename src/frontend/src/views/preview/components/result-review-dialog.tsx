import { useCallback, useId, useRef, useState } from 'react'
import type { ConfirmedProjectResult } from '../../../types/processing/result-review.types'
import { validateResultReview } from '../../../services/processing/result-review'
import { PreviewIcon } from './preview-icons'
import { useDialogFocus } from './preview-surface'

export function ResultReviewDialog({ result, onClose, onSaved }: {
  result: ConfirmedProjectResult
  onClose: () => void
  onSaved: () => void
}) {
  const ref = useRef<HTMLFormElement>(null)
  const inFlight = useRef(false)
  const [rating, setRating] = useState(0)
  const [comment, setComment] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const id = useId()
  const close = useCallback(() => { if (!inFlight.current) onClose() }, [onClose])
  useDialogFocus(ref, close)

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

  return <div className="preview-dialog-scrim">
    <form ref={ref} className="preview-dialog" role="dialog" aria-modal="true" aria-labelledby={`${id}-title`}
      aria-busy={saving} noValidate onSubmit={event => { event.preventDefault(); void submit() }}>
      <h2 id={`${id}-title`}>Đánh giá trước khi lưu kết quả</h2>
      <p>Chọn số sao và nhập nội dung đánh giá. Kết quả phải lưu vào hệ thống; tải file về máy là tùy chọn sau khi lưu.</p>
      <fieldset className="result-rating" disabled={saving} aria-describedby={error ? `${id}-error` : undefined}>
        <legend>Số sao (bắt buộc)</legend>
        <div className="result-rating-options">
          {[1, 2, 3, 4, 5].map(value => <label key={value} className={`result-rating-option${value <= rating ? ' is-filled' : ''}`}>
            <input type="radio" name={`${id}-rating`} value={value} checked={rating === value} required
              aria-label={`${value} sao`} onChange={() => { setRating(value); setError(null) }} />
            <PreviewIcon name="star" />
          </label>)}
        </div>
      </fieldset>
      <label className="dialog-field"><span>Nội dung đánh giá (bắt buộc)</span>
        <textarea value={comment} rows={4} required disabled={saving} aria-describedby={error ? `${id}-error` : undefined}
          onChange={event => { setComment(event.target.value); setError(null) }} />
      </label>
      {error && <p className="form-error" id={`${id}-error`} role="alert">{error}</p>}
      <div className="dialog-actions">
        <button type="button" className="button-secondary" disabled={saving} onClick={close}>Hủy</button>
        <button type="submit" className="button-primary" disabled={saving}>{saving ? 'Đang lưu…' : 'Gửi đánh giá và lưu vào hệ thống'}</button>
      </div>
    </form>
  </div>
}
