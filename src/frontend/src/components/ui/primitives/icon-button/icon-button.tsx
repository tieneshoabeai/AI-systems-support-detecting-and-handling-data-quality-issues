import type { ComponentPropsWithRef } from 'react'
import styles from './icon-button.module.css'

type Props = ComponentPropsWithRef<'button'> & { 'aria-label': string; loading?: boolean }
export function IconButton({ className = '', type = 'button', loading = false, disabled, ...props }: Props) {
  return <button {...props} type={type} disabled={disabled || loading} aria-busy={loading || props['aria-busy']}
    className={`${styles['root']} icon-button ${className}`.trim()} />
}
