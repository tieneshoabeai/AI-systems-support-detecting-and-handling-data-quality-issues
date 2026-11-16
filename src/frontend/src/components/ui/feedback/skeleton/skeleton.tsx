import type { ComponentPropsWithRef } from 'react'
import styles from './skeleton.module.css'

export function Skeleton({ className = '', ...props }: ComponentPropsWithRef<'span'>) {
  return <span {...props} aria-hidden="true" className={`${styles['root']} skeleton-block ${className}`.trim()} />
}
