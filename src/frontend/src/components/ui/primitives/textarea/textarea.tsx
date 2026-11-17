import type { ComponentPropsWithRef } from 'react'
import styles from './textarea.module.css'

export function Textarea({ error, className = '', ...props }: ComponentPropsWithRef<'textarea'> & { error?: boolean }) {
  return <textarea {...props} aria-invalid={error || props['aria-invalid']} className={`${styles['root']} ${className}`.trim()} />
}
