import type { ReactNode } from 'react'
import styles from './brand-lockup.module.css'

export function BrandLockup({ logo, children, className = '' }: { logo: ReactNode; children: ReactNode; className?: string }) {
  return <div className={`${styles['root']} brand-lockup ${className}`.trim()}>{logo}<span>{children}</span></div>
}
