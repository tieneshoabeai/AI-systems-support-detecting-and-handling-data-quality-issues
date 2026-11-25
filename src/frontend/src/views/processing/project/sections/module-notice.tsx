import type { ReactNode } from 'react'
import { Icon } from '../../../../components/ui/primitives/icon'
import styles from './module-content.module.css'

export function ModuleNotice({ tone = 'info', children }: { tone?: 'info' | 'loading' | 'error'; children: ReactNode }) {
  return <p className={styles['notice']} data-tone={tone} role={tone === 'error' ? 'alert' : tone === 'loading' ? 'status' : undefined}>
    <Icon name={tone === 'error' ? 'alert' : tone === 'loading' ? 'clock' : 'info'} />
    <span>{children}</span>
  </p>
}
