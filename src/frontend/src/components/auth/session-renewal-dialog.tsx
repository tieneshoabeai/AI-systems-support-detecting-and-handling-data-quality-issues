import { requireDefined } from '../../utils/required-value'
import { useEffect, useRef } from 'react'
import { useAuth } from '../../hooks/auth/use-auth'

export const SessionRenewalDialog = () => {
  const { snapshot, confirmRenewal } = useAuth()
  const dialog = useRef<HTMLElement>(null)
  const cancel = useRef<HTMLButtonElement>(null)
  const pending = snapshot.phase === 'refreshing'
  const open = snapshot.phase === 'awaiting-consent' || pending

  useEffect(() => {
    if (!open) return
    const previous = document.activeElement
    const focusInside = () => {
      const first = dialog.current?.querySelector<HTMLButtonElement>('button:not([disabled])')
      ;(first ?? dialog.current)?.focus()
    }
    const guardFocus = (event: FocusEvent) => {
      if (event.target instanceof Node && !dialog.current?.contains(event.target)) focusInside()
    }
    cancel.current?.focus()
    document.addEventListener('focusin', guardFocus)
    return () => {
      document.removeEventListener('focusin', guardFocus)
      if (previous instanceof HTMLElement && previous.isConnected) previous.focus()
      else document.getElementById('page-heading')?.focus()
    }
  }, [open])

  useEffect(() => { if (pending) dialog.current?.focus() }, [pending])

  if (!open) return null
  const decide = (accepted: boolean) => {
    // Lỗi operation được coordinator đưa vào snapshot và hiển thị trên login.
    void confirmRenewal(accepted).catch(() => {})
  }
  return <div className="dialog-backdrop" data-testid="renewal-backdrop">
    <section ref={dialog} className="dialog-panel" role="dialog" aria-modal="true"
      aria-labelledby="renewal-title" tabIndex={-1}
      aria-busy={pending} onKeyDown={event => {
        if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); if (!pending) decide(false) }
        if (event.key !== 'Tab') return
        const buttons = Array.from(dialog.current?.querySelectorAll<HTMLButtonElement>('button:not([disabled])') ?? [])
        const first = buttons[0]
        const last = buttons[buttons.length - 1]
        if (!first) { event.preventDefault(); dialog.current?.focus(); return }
        if (event.shiftKey && (document.activeElement === first || document.activeElement === dialog.current)) { event.preventDefault(); requireDefined(last, 'session-renewal-dialog.tsx:48').focus() }
        else if (!event.shiftKey && (document.activeElement === last || document.activeElement === dialog.current)) { event.preventDefault(); first.focus() }
      }}>
      <h2 id="renewal-title">PHIÊN LÀM VIỆC ĐÃ HẾT HẠN, BẠN CÓ MUỐN TIẾP TỤC KHÔNG</h2>
      <div className="dialog-actions">
        <button ref={cancel} className="button-secondary" disabled={pending} onClick={() => decide(false)}>Hủy</button>
        <button className="button-primary" disabled={pending} onClick={() => decide(true)}>{pending ? 'Đang gia hạn…' : 'Tiếp tục phiên'}</button>
      </div>
    </section>
  </div>
}
