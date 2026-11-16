import { useCallback, useEffect, useRef, useState } from 'react'
import { validateResultReview } from '../../services/processing'
import type { ResultReviewInput } from '../../types'
const key = 'shopping-demo.detection.v1'
export const detectionSteps = ['Đang đọc cấu trúc dữ liệu…', 'Đang kiểm tra missing và kiểu dữ liệu…',
  'Đang đối chiếu phân bố và nhóm giá trị…', 'Đang tổng hợp bằng chứng dòng/cột…', 'Đang hoàn thiện kết quả…']
type State = { status: 'idle' | 'running' | 'complete' | 'reviewed'; review?: ResultReviewInput }
const initial = (enabled: boolean): State => {
  if (!enabled) return { status: 'idle' }
  try {
    const raw = sessionStorage.getItem(key)
    const s = raw ? JSON.parse(raw) as State : null
    if (s?.status === 'complete') return { status: 'complete' }
    if (s?.status === 'reviewed' && s.review && !validateResultReview(s.review)) return s
  } catch { /* Invalid stored result is discarded; no completed result is claimed. */ }
  return { status: 'idle' }
}
export const useShoppingDetection = (enabled: boolean) => {
  const [state, setState] = useState<State>(() => initial(enabled))
  const [step, setStep] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const timers = useRef<ReturnType<typeof setTimeout>[]>([])
  const clear = useCallback(() => { timers.current.forEach(clearTimeout); timers.current = [] }, [])
  useEffect(() => () => { timers.current.forEach(clearTimeout) }, [])
  const persist = useCallback((next: State) => {
    sessionStorage.setItem(key, JSON.stringify(next))
    setState(next)
  }, [])
  const start = useCallback(() => {
    if (!enabled || state.status !== 'idle') return
    clear()
    setStep(0)
    setError(null)
    setState({ status: 'running' })
    ;[800, 1600, 2400, 3200].forEach((ms, i) => {
      timers.current.push(setTimeout(() => setStep(i + 1), ms))
    })
    timers.current.push(setTimeout(() => {
      try { persist({ status: 'complete' }) }
      catch { setError('Không lưu được kết quả. Hãy cho phép sessionStorage rồi thử lại.'); setState({ status: 'idle' }) }
    }, 4000))
  }, [enabled, state.status, clear, persist])
  const cancel = useCallback(() => {
    clear()
    if (state.status === 'running') setState({ status: 'idle' })
  }, [clear, state.status])
  const save = useCallback(async (review: ResultReviewInput) => {
    const invalid = validateResultReview(review)
    if (invalid) throw new Error(invalid)
    persist({ status: 'reviewed', review: { rating: review.rating, comment: review.comment.trim() } })

    return Promise.resolve()
  }, [persist])
  return { state, step, error, start, cancel, save, needsReview: state.status === 'complete' }
}
