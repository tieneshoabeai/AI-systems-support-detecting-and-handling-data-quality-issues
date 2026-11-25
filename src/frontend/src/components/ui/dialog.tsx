import { useId, type ReactNode } from 'react'
import { Dialog as DialogSurface } from './overlay/dialog'
import { Button } from './controls'

export function Dialog({ title, children, onClose, busy = false }: { title: string; children: ReactNode; onClose: () => void; busy?: boolean }) {
  const id = useId()
  const close = () => { if (!busy) onClose() }
  return <DialogSurface open onClose={close} busy={busy} aria-labelledby={id}>
    <header className="dialog-head"><h2 id={id}>{title}</h2><Button className="icon-button" aria-label="Đóng hộp thoại" disabled={busy} onClick={close}>×</Button></header>
    {children}
  </DialogSurface>
}
