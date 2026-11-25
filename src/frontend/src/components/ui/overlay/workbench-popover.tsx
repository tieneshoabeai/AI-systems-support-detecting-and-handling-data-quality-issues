import type { ComponentProps } from 'react'
import { Popover } from './popover'
import { useSurfaceNavigation } from '../../../hooks/ui/use-workbench-surface'

export function PreviewPopover(props: ComponentProps<typeof Popover>) {
  useSurfaceNavigation(props.open && props.trigger !== null, props.onClose)
  return <Popover {...props} />
}
