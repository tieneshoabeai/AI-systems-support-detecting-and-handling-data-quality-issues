import { useEffect } from 'react'
import type { RefObject } from 'react'
import { useSurfaceDismiss as useUiSurfaceDismiss } from '../ui/use-surface'
import { previewNavigateEvent } from '../../services/preview/preview-route'

export { anchorFromElement, anchorFromOrigin, useSurfacePosition, useRovingFocus, useDialogFocus } from '../ui/use-surface'
export type { PreviewPoint, SurfacePoint, SurfaceAnchor } from '../ui/use-surface'

// Application navigation stays outside UI hooks and UI components.
export function useSurfaceNavigation(open: boolean, onClose: () => void) {
  useEffect(() => {
    if (!open) return
    window.addEventListener(previewNavigateEvent, onClose)
    return () => window.removeEventListener(previewNavigateEvent, onClose)
  }, [open, onClose])
}

export function useSurfaceDismiss(open: boolean, onClose: () => void, surfaceRef: RefObject<HTMLElement | null>, triggerRef?: RefObject<HTMLElement | null>) {
  useUiSurfaceDismiss(open, onClose, surfaceRef, triggerRef)
  useSurfaceNavigation(open, onClose)
}
