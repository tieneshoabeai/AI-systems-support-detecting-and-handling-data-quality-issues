import type { ComponentProps } from 'react'
import { Popover } from '../../../components/ui/overlay/popover'
import { useSurfaceNavigation } from './preview-surface'

export function PreviewPopover(props: ComponentProps<typeof Popover>) {
  useSurfaceNavigation(props.open && props.trigger !== null, props.onClose)
  return <Popover {...props} />
}
