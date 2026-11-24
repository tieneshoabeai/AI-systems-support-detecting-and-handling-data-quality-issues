import { useId, useRef } from 'react'
import type { KeyboardEvent, ReactNode } from 'react'
import type { ResourceAvatarChoice } from '../../../hooks/resource/use-resource-avatar'
import { ResourceAvatarEditor } from '../../resource/avatar/resource-avatar'
import { Button } from '../../ui/controls'
import { Icon } from '../../ui/primitives/icon'

export function WorkspaceAvatarField({
  cover, children, value, onSave, open, onOpenChange, disabled = false, readOnly = false, staged = false,
}: {
  cover: ReactNode
  children: ReactNode
  value: ResourceAvatarChoice
  onSave: (choice: ResourceAvatarChoice) => void
  open: boolean
  onOpenChange: (open: boolean) => void
  disabled?: boolean
  readOnly?: boolean
  staged?: boolean
}) {
  const id = useId()
  const trigger = useRef<HTMLButtonElement>(null)
  const close = () => {
    onOpenChange(false)
    trigger.current?.focus({ preventScroll: true })
  }
  const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (!open || event.key !== 'Escape') return
    event.preventDefault()
    event.stopPropagation()
    close()
  }

  return <div className="workspace-avatar-grid">
    {readOnly
      ? <div className="workspace-avatar-art" aria-hidden="true">{cover}</div>
      : <Button ref={trigger} type="button" className="workspace-avatar-trigger" disabled={disabled}
          aria-label="Chọn ảnh đại diện" aria-expanded={open} aria-controls={open ? id : undefined}
          onKeyDown={onKeyDown} onClick={() => { if (open) close(); else onOpenChange(true) }}>
          <span className="workspace-avatar-art" aria-hidden="true">{cover}</span>
          <span className="workspace-avatar-label" aria-hidden="true"><Icon name="pencil" /> Đổi ảnh</span>
        </Button>}
    {open && !readOnly
      ? <section className="workspace-avatar-editor" id={id} aria-labelledby={`${id}-title`} onKeyDown={onKeyDown}>
          <header className="workspace-avatar-head">
            <h3 id={`${id}-title`}>Ảnh đại diện Workspace</h3>
            <Button type="button" className="icon-button" aria-label="Đóng bộ chọn ảnh" onClick={close}>
              <Icon name="close" />
            </Button>
          </header>
          <ResourceAvatarEditor kind="workspace" initial={value} staged={staged} onSave={choice => {
            onSave(choice)
            close()
          }} />
        </section>
      : children}
  </div>
}
