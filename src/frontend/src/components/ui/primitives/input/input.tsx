import type { ComponentPropsWithRef } from 'react'
import styles from './input.module.css'

export type InputProps = ComponentPropsWithRef<'input'> & { error?: boolean }

// Ô nhập chữ nhận style mặt kính; radio/checkbox/file… vẫn là control native.
const nonTextTypes = new Set(['checkbox', 'radio', 'range', 'hidden', 'file', 'color', 'image', 'submit', 'button', 'reset'])

export function Input({ error, type = 'text', className = '', ...props }: InputProps) {
  return <input {...props} type={type} data-field={nonTextTypes.has(type) ? undefined : 'text'}
    aria-invalid={error || props['aria-invalid']} className={`${styles['root']} ${className}`.trim()} />
}
