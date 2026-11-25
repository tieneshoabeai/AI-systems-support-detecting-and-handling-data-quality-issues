import type { ReactNode } from 'react'
import styles from './panel.module.css'

export function Panel({ title, action, children, className = '', surface = 'solid' }: {
  title: string
  action?: ReactNode
  children: ReactNode
  className?: string
  surface?: 'solid' | 'glass'
}) {
  return <section data-surface={surface} className={`${styles['root']} panel ${className}`.trim()}>
    <header className="panel-head"><h2>{title}</h2>{action}</header>{children}
  </section>
}
