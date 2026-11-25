import type { Crumb } from './resource-breadcrumb.types'
import { Button } from '../../../components/ui/primitives/button'
import { Icon } from '../../../components/ui/primitives/icon'
import styles from './resource-breadcrumb.module.css'


export function ResourceBreadcrumb({ parents, current, className = '' }: {
  parents: readonly (Crumb & { onClick: () => void })[]
  current: Crumb
  className?: string
}) {
  return <nav className={`${styles['root']} ${className}`.trim()} aria-label="Path điều hướng">
    <ol>
      {parents.map(({ label, icon, onClick }, index) => <li key={index}>
        {index > 0 && <Icon name="chevron" />}
        <Button type="button" className={styles['link']} title={label} onClick={onClick}>
          {icon && <Icon name={icon} />}<span>{label}</span>
        </Button>
      </li>)}
      <li>
        {parents.length > 0 && <Icon name="chevron" />}
        <span className={styles['current']} aria-current="page" title={current.label}>
          {current.icon && <Icon name={current.icon} />}<span>{current.label}</span>
        </span>
      </li>
    </ol>
  </nav>
}
