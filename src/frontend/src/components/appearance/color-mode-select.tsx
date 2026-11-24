import { Button } from '../ui/primitives/button'
import { Icon } from '../ui/primitives/icon'
import type { PreviewAppearance } from '../../types'

const modes = [
  { value: 'light', label: 'Sáng', icon: 'sun' },
  { value: 'dark', label: 'Tối', icon: 'moon' },
  { value: 'system', label: 'Theo hệ thống', icon: 'monitor' },
] as const

export function ColorModeSelect({ appearance }: { appearance: PreviewAppearance }) {
  return <div className="auth-color-mode" role="radiogroup" aria-label="Chế độ màu" onKeyDown={event => {
    const current = modes.findIndex(mode => mode.value === appearance.preference)
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? 2
      : event.key === 'ArrowRight' || event.key === 'ArrowDown' ? (current + 1) % modes.length
        : event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? (current + modes.length - 1) % modes.length : null
    if (next === null) return
    event.preventDefault()
    const mode = modes[next]
    if (!mode) return
    appearance.setColorPreference(mode.value)
    event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="radio"]')[next]?.focus()
  }}>
    {modes.map(mode => <Button key={mode.value} role="radio" aria-label={mode.label}
      title={mode.label} aria-checked={appearance.preference === mode.value}
      tabIndex={appearance.preference === mode.value ? 0 : -1}
      className={`auth-color-option${appearance.preference === mode.value ? ' is-active' : ''}`}
      onClick={() => appearance.setColorPreference(mode.value)}>
      <Icon name={mode.icon} />
    </Button>)}
  </div>
}
