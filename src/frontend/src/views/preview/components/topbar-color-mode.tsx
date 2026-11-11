import { useId, useRef, useState } from 'react'
import type { PreviewColorPreference } from '../../../types/preview/preview-session.types'
import { usePreviewSession } from '../preview-session-context'
import { PreviewIcon } from './preview-icons'
import { PreviewPopover } from './preview-popover'

const modes: readonly { value: PreviewColorPreference; label: string; icon: string }[] = [
  { value: 'light', label: 'Sáng', icon: 'sun' },
  { value: 'dark', label: 'Tối', icon: 'moon' },
  { value: 'system', label: 'Theo hệ thống', icon: 'monitor' },
]

export function TopbarColorMode() {
  const { appearance } = usePreviewSession()
  const triggerRef = useRef<HTMLButtonElement>(null)
  const [trigger, setTrigger] = useState<HTMLElement | null>(null)
  const [open, setOpen] = useState(false)
  const name = useId()
  const selected = modes.find(mode => mode.value === appearance.preference)!
  return <>
    <button type="button" ref={triggerRef} className="icon-button" aria-label="Chế độ màu"
      title={`Chế độ màu: ${selected.label}`} aria-haspopup="dialog" aria-expanded={open}
      onClick={() => { setTrigger(triggerRef.current); setOpen(value => !value) }}>
      <PreviewIcon name={selected.icon} />
    </button>
    <PreviewPopover open={open} label="Chế độ màu" trigger={trigger} align="end" onClose={() => setOpen(false)}>
      <fieldset className="topbar-color-options" onKeyDown={event => {
        if (event.key !== 'Escape') return
        event.stopPropagation()
        setOpen(false)
        triggerRef.current?.focus()
      }}>
        <legend>Chế độ màu</legend>
        {modes.map(mode => <label key={mode.value} className="topbar-color-option">
          <input type="radio" name={name} value={mode.value} checked={appearance.preference === mode.value}
            autoFocus={appearance.preference === mode.value}
            onChange={() => appearance.setColorPreference(mode.value)} />
          <PreviewIcon name={mode.icon} />
          <span>{mode.label}</span>
        </label>)}
      </fieldset>
    </PreviewPopover>
  </>
}
