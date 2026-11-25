import type { ReactNode } from 'react'
import styles from './panel.module.css'

export function Panel({ title, action, children, className = '' }: { title: string; action?: ReactNode; children: ReactNode; className?: string }) {
  return <section className={`${styles['root']} panel ${className}`.trim()}>
    <header className="panel-head"><h2>{title}</h2>{action}</header>{children}
  </section>
}
