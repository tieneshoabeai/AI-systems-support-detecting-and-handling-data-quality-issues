import type { ComponentProps } from 'react'
import { Button as DesignButton } from './primitives/button'
export { Input } from './primitives/input'
export { Select } from './form/select'
export { Textarea } from './primitives/textarea'

export function Button({ type = 'button', busy, loading, variant = 'plain', disabled, ...props }: ComponentProps<'button'> & {
  busy?: boolean; loading?: boolean; variant?: 'primary' | 'secondary' | 'danger' | 'plain' | 'glass'
}) {
  const pending = Boolean(busy || loading)
  return <DesignButton {...props} variant={variant} type={type} disabled={disabled || pending} loading={pending} />
}
export function Table(props: ComponentProps<'table'>) { return <table {...props} /> }
