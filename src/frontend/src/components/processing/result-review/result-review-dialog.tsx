import { useId } from 'react'
import type { ConfirmedProjectResult } from '../../../types'
import { useResultReview } from '../../../hooks/processing/use-result-review'
import { Icon as PreviewIcon } from '../../ui/primitives/icon'
import { Dialog } from '../../ui/overlay/dialog'
import styles from './result-review.module.css'

export function ResultReviewDialog({ result, onClose, onSaved }: {
  result: ConfirmedProjectResult
  onClose: () => void
  onSaved: () => void
}) {
  const { rating, setRating, comment, setComment, saving, error, setError, close, submit } = useResultReview(result, onClose, onSaved)
  const id = useId()

  return <Dialog open className={styles['screen']} onClose={close} dismissOnBackdrop={false} busy={saving} as="form" aria-labelledby={`${id}-title`}
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
  </Dialog>
}
