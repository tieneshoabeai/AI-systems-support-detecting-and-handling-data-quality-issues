import type { ComponentPropsWithRef } from 'react'
import styles from './badge.module.css'

export type BadgeTone = 'ok' | 'done' | 'muted' | 'danger' | 'warn'
export function Badge({ tone = 'muted', children, className = '', ...props }: ComponentPropsWithRef<'span'> & { tone?: BadgeTone }) {
  return <span {...props} className={`${styles['root']} status-badge status-${tone} ${className}`.trim()}>
    <span className="status-dot" aria-hidden="true" />{children}
  </span>
}
