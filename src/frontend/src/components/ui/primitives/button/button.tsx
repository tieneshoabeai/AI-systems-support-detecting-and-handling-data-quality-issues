import type { ComponentPropsWithRef } from 'react'
import styles from './button.module.css'

export type ButtonProps = ComponentPropsWithRef<'button'> & {
  variant?: 'primary' | 'secondary' | 'danger' | 'plain' | 'glass'
  loading?: boolean
}
export function Button({ variant = 'primary', loading = false, disabled, type = 'button', className = '', children, ...props }: ButtonProps) {
  const legacyClass = variant === 'plain' || variant === 'glass' ? '' : `button-${variant}`
  return <button {...props} type={type} data-variant={variant} className={`${styles['root']} ${legacyClass} ${className}`.trim()}
    disabled={disabled || loading} aria-busy={loading || props['aria-busy']}>{children}</button>
}
