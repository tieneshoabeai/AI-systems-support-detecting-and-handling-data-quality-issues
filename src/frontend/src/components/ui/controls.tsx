import type { ComponentProps } from 'react'
import { Button as DesignButton } from './primitives/button'
export { Input } from './primitives/input'
export { Select } from './form/select'
export { Textarea } from './primitives/textarea'

export function Button({ type = 'button', busy, disabled, ...props }: ComponentProps<'button'> & { busy?: boolean }) {
  return <DesignButton {...props} variant="plain" type={type} disabled={disabled || busy} loading={Boolean(busy)} />
}
export function Table(props: ComponentProps<'table'>) { return <table {...props} /> }
