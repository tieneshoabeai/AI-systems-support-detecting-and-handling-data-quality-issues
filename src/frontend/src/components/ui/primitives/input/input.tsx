import type { ComponentPropsWithRef } from 'react'
import styles from './input.module.css'

export type InputProps = ComponentPropsWithRef<'input'> & { error?: boolean }
export function Input({ error, className = '', ...props }: InputProps) {
  return <input {...props} aria-invalid={error || props['aria-invalid']} className={`${styles['root']} ${className}`.trim()} />
}
