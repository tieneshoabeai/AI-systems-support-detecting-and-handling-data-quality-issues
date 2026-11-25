import { useCallback, useRef } from 'react'
import type { HTMLAttributes } from 'react'
import { useDialogFocus } from '../../../../hooks/ui/use-surface'
import styles from './dialog.module.css'

type Props = Omit<HTMLAttributes<HTMLElement>, 'onClose'> & {
  open: boolean
  onClose: () => void
  as?: 'div' | 'form'
  dismissOnBackdrop?: boolean
  busy?: boolean
  noValidate?: boolean
}

// Deliberately inline: Portal and scroll locking are deferred by agreement.
export function Dialog({ open, ...props }: Props) {
  return open ? <DialogSurface {...props} /> : null
}

function DialogSurface({ onClose, as = 'div', dismissOnBackdrop = true, busy = false, className = '', role = 'dialog', ...props }: Omit<Props, 'open'>) {
  const ref = useRef<HTMLElement>(null)
  const close = useCallback(() => { if (!busy) onClose() }, [busy, onClose])
  const setPanel = useCallback((element: HTMLElement | null) => { ref.current = element }, [])
  const Surface = as
  useDialogFocus(ref, close, true)
  return <div className={`${styles['scrim']} preview-dialog-scrim`} onMouseDown={event => {
    if (dismissOnBackdrop && event.target === event.currentTarget) close()
  }}>
    <Surface tabIndex={-1} {...props} ref={setPanel} className={`${styles['panel']} preview-dialog ${className}`.trim()}
      role={role} aria-modal={role === 'dialog' ? true : props['aria-modal']} {...(busy ? { 'aria-busy': true } : {})} />
  </div>
}
