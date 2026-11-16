import type { ComponentPropsWithRef } from 'react'
import styles from './alert.module.css'

export function Alert({ className = '', role = 'alert', ...props }: ComponentPropsWithRef<'div'>) {
  return <div {...props} role={role} className={`${styles['root']} feedback-error ${className}`.trim()} />
}
