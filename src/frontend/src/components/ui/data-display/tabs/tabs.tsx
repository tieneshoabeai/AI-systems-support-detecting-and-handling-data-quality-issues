import styles from './tabs.module.css'

export type TabItem<T extends string> = { id: T; label: string }
export function Tabs<T extends string>({ tabs, active, onChange, label, variant = 'filter' }: {
  tabs: readonly TabItem<T>[]
  active: T
  onChange: (id: T) => void
  label: string
  variant?: 'filter' | 'detail'
}) {
  // Preserve the existing click/tab semantics; keyboard behavior is not expanded in this extraction.
  return <div className={`${styles['root']} ${variant}-tabs`} role="tablist" aria-label={label}>
    {tabs.map(tab => <button type="button" key={tab.id} role="tab" aria-selected={tab.id === active}
      className={`${variant}-tab${tab.id === active ? ' is-active' : ''}`} onClick={() => onChange(tab.id)}>{tab.label}</button>)}
  </div>
}
