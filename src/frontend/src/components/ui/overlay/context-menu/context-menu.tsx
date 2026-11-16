import { useRef } from 'react'
import type { ReactNode } from 'react'
import { useRovingFocus, useSurfaceDismiss, useSurfacePosition } from '../../../../hooks/ui/use-surface'
import type { SurfaceAnchor } from '../../../../hooks/ui/use-surface'
import styles from './context-menu.module.css'

export function ContextMenu({ label, anchor, anchored, onClose, children }: {
  label: string
  anchor: SurfaceAnchor
  anchored: boolean
  onClose: () => void
  children: ReactNode
}) {
  const ref = useRef<HTMLDivElement>(null)
  const point = useSurfacePosition(ref, anchor)
  useSurfaceDismiss(true, onClose, ref)
  useRovingFocus(true, ref)
  return <div ref={ref} className={`${styles['root']} preview-menu`} role="menu" aria-label={label}
    data-trigger={anchored ? 'anchor' : 'pointer'} data-side={point.flipped ? 'top' : 'bottom'}
    style={{ left: point.x, top: point.y }}>{children}</div>
}
