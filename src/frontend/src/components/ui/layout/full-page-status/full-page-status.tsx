import type { ComponentPropsWithRef } from 'react'
import styles from './full-page-status.module.css'

export function FullPageStatus({ className = '', ...props }: ComponentPropsWithRef<'main'>) {
  return <main {...props} className={`${styles['root']} session-wait ${className}`.trim()} />
}
