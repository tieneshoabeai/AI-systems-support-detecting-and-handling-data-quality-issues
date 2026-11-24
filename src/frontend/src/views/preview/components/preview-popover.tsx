import type { ComponentProps } from 'react'
import { Popover } from '../../../components/ui/overlay/popover'
import { useSurfaceNavigation } from './preview-surface'

export function PreviewPopover(props: Omit<ComponentProps<typeof Popover>, 'portalHost'>) {
  useSurfaceNavigation(props.open && props.trigger !== null, props.onClose)
  // Keep viewport coordinates and theme tokens, outside any scrolling or filtered panel.
  const portalHost = props.trigger?.closest<HTMLElement>('[data-preview="2d"]') ?? null
  return <Popover {...props} portalHost={portalHost} />
}
