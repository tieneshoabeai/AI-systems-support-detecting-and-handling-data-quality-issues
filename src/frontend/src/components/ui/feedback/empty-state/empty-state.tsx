import styles from './empty-state.module.css'

export function EmptyState({ title, note }: { title: string; note: string }) {
  return <div className={`${styles['root']} empty-hint`} role="status"><p className="empty-title">{title}</p><p>{note}</p></div>
}
