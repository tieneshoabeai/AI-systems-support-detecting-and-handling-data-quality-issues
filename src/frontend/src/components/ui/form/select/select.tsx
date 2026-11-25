import type { ComponentPropsWithRef } from 'react'
import styles from './select.module.css'

export function Select({ error, className = '', ...props }: ComponentPropsWithRef<'select'> & { error?: boolean }) {
  return <select {...props} aria-invalid={error || props['aria-invalid']} className={`${styles['root']} ${className}`.trim()} />
}
