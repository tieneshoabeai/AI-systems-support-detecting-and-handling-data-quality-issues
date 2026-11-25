// Lucian UX/UI Prompt #438 · MIT License (c) 2026 Seokwoooo · https://lucianlabs.dev/uxui-prompt/#438
import { Button, type ButtonProps } from './button'
import { Icon } from '../icon'
import styles from './completion-button.module.css'

type CompletionButtonProps = Omit<ButtonProps, 'loading' | 'variant'> & {
  state: 'idle' | 'pending' | 'success'
  pendingLabel: string
  successLabel: string
}

export function CompletionButton({
  state, pendingLabel, successLabel, children, disabled, className = '', ...props
}: CompletionButtonProps) {
  return <Button {...props} disabled={disabled || state !== 'idle'} aria-busy={state === 'pending'}
    aria-label={state === 'pending' ? pendingLabel : state === 'success' ? successLabel : props['aria-label']}
    className={`${styles['root']} ${className}`} data-completion={state}>
    <span className={styles['label']}>{children}</span>
    <span className={styles['indicator']} aria-hidden="true">
      {state === 'success' ? <Icon name="check" /> : state === 'pending' ? <span className={styles['spinner']} /> : null}
    </span>
  </Button>
}
