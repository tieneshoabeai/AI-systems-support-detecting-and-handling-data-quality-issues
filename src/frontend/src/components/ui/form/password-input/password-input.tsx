import { useState } from 'react'
import { Input } from '../../primitives/input'
import type { InputProps } from '../../primitives/input'
import styles from './password-input.module.css'

export function PasswordInput({ revealLabel = 'Hiện mật khẩu', hideLabel = 'Ẩn mật khẩu', disabled, ...props }: Omit<InputProps, 'type'> & {
  revealLabel?: string
  hideLabel?: string
}) {
  const [visible, setVisible] = useState(false)
  return <div className={`${styles['root']} password-field`}>
    <Input {...props} disabled={disabled} type={visible ? 'text' : 'password'} />
    <button type="button" disabled={disabled} className={`${styles['toggle']} password-toggle`}
      aria-label={visible ? hideLabel : revealLabel} aria-pressed={visible} onClick={() => setVisible(value => !value)}>
      <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
        <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" /><circle cx="12" cy="12" r="3" />
      </svg>
    </button>
  </div>
}
