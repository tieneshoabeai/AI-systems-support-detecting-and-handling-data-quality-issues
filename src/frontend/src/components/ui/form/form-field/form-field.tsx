import type { ControlProps } from './type'
import { useId } from 'react'
import type { ReactNode } from 'react'
import styles from './form-field.module.css'

export function FormField({ id: suppliedId, label, hint, error, children }: {
  id?: string
  label: ReactNode
  hint?: ReactNode
  error?: string
  children: (props: ControlProps) => ReactNode
}) {
  const generatedId = useId()
  const id = suppliedId ?? generatedId
  const describedBy = [hint ? `${id}-hint` : '', error ? `${id}-error` : ''].filter(Boolean).join(' ')
  return <div className={`${styles['root']} form-field`}>
    <label htmlFor={id}>{label}</label>
    {children({ id, ...(describedBy ? { 'aria-describedby': describedBy } : {}), ...(error ? { 'aria-invalid': true } : {}) })}
    {hint && <p id={`${id}-hint`} className={styles['hint']}>{hint}</p>}
    {error && <p id={`${id}-error`} className={styles['error']} role="alert">{error}</p>}
  </div>
}
