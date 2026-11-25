// Lucian UX/UI Prompt #413 · MIT License (c) 2026 Seokwoooo · https://lucianlabs.dev/uxui-prompt/#413
import { useEffect, useId, useRef, useState } from 'react'
import type { CSSProperties, KeyboardEvent } from 'react'
import type { Workspace } from '../../../types'
import { Icon } from '../../ui/primitives/icon'
import styles from './project-workspace-picker.module.css'

export function ProjectWorkspacePicker({ workspaces, workspaceId, invalid, restoreFocus, onSelect, onCreate }: {
  workspaces: readonly Workspace[]
  workspaceId: string
  invalid: boolean
  restoreFocus: boolean
  onSelect: (id: string) => void
  onCreate: () => void
}) {
  const labelId = useId()
  const menuId = useId()
  const valueId = useId()
  const root = useRef<HTMLDivElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const items = useRef<Array<HTMLButtonElement | null>>([])
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const hoverOpenedAt = useRef(-Infinity)
  const focusOnOpen = useRef<number | null>(null)
  const [open, setOpen] = useState(false)
  const [highlight, setHighlight] = useState<number | null>(null)
  const selected = workspaces.find(workspace => workspace.id === workspaceId)
  const last = workspaces.length

  useEffect(() => () => clearTimeout(timer.current), [])
  useEffect(() => {
    if (!restoreFocus) return
    const frame = requestAnimationFrame(() => trigger.current?.focus())
    return () => cancelAnimationFrame(frame)
  }, [restoreFocus])
  useEffect(() => {
    if (!open) return
    if (focusOnOpen.current !== null) {
      items.current[focusOnOpen.current]?.focus()
      focusOnOpen.current = null
    }
    const dismiss = (event: PointerEvent) => {
      if (event.target instanceof Node && !root.current?.contains(event.target)) {
        clearTimeout(timer.current)
        setOpen(false)
        setHighlight(null)
      }
    }
    document.addEventListener('pointerdown', dismiss)
    return () => document.removeEventListener('pointerdown', dismiss)
  }, [open])

  const close = (restoreFocus = false): void => {
    clearTimeout(timer.current)
    hoverOpenedAt.current = -Infinity
    setOpen(false)
    setHighlight(null)
    if (restoreFocus) trigger.current?.focus()
  }
  const openAt = (index: number): void => {
    clearTimeout(timer.current)
    if (open) items.current[index]?.focus()
    else {
      focusOnOpen.current = index
      setOpen(true)
    }
  }
  const handleKey = (event: KeyboardEvent<HTMLDivElement>): void => {
    if (event.key === 'Escape' && open) {
      event.preventDefault()
      event.stopPropagation()
      close(true)
      return
    }
    const index = items.current.findIndex(item => item === event.target)
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      const next = event.key === 'ArrowDown' ? (index + 1) % (last + 1) : index <= 0 ? last : index - 1
      openAt(next)
    } else if (open && (event.key === 'Home' || event.key === 'End')) {
      event.preventDefault()
      openAt(event.key === 'Home' ? 0 : last)
    }
  }

  return <div className={styles['u413']} ref={root} data-open={open} onKeyDown={handleKey}
    onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) close() }}
    onPointerEnter={event => {
      if (event.pointerType !== 'mouse') return
      clearTimeout(timer.current)
      if (!open) timer.current = setTimeout(() => {
        hoverOpenedAt.current = performance.now()
        setOpen(true)
      }, 120)
    }}
    onPointerLeave={event => {
      if (event.pointerType !== 'mouse') return
      clearTimeout(timer.current)
      if (!root.current?.contains(document.activeElement)) timer.current = setTimeout(() => close(), 240)
    }}>
    <span id={labelId}>Workspace <em className="field-required" aria-hidden="true">*</em></span>
    <button className={styles['trigger']} type="button" ref={trigger} aria-labelledby={labelId}
      aria-haspopup="menu" aria-expanded={open} aria-controls={menuId}
      aria-invalid={invalid || undefined} aria-describedby={invalid ? `${valueId} pv-wizard-error` : valueId}
      onClick={event => {
        if (open && event.detail !== 0) {
          if (performance.now() - hoverOpenedAt.current >= 500) close()
        } else openAt(0)
      }}>
      <Icon name="workspaces" />
      <span id={valueId}>{selected?.name ?? 'Chọn Workspace'}</span>
      <span className={styles['caret']} aria-hidden="true" />
    </button>
    <div className={styles['panel']} id={menuId} role="menu" aria-labelledby={labelId} aria-hidden={!open}
      onPointerLeave={() => setHighlight(null)}>
      <div className={styles['list']}>
        <span className={styles['highlight']} aria-hidden="true" data-visible={highlight !== null}
          style={{ '--row': highlight ?? 0 } as CSSProperties} />
        {workspaces.map((workspace, index) => <button key={workspace.id} type="button" role="menuitemradio"
          className={styles['item']} tabIndex={-1} aria-checked={workspace.id === workspaceId} disabled={!open}
          style={{ '--index': index } as CSSProperties}
          ref={element => { items.current[index] = element }}
          onFocus={() => setHighlight(index)} onPointerEnter={() => setHighlight(index)}
          onClick={() => { onSelect(workspace.id); close(true) }}>
          <span className={styles['icon']}><Icon name="workspaces" /></span>
          <span className={styles['name']}>{workspace.name}</span>
          {workspace.id === workspaceId && <Icon name="check" />}
        </button>)}
        <button type="button" role="menuitem" className={styles['item']} tabIndex={-1} disabled={!open}
          style={{ '--index': last } as CSSProperties}
          ref={element => { items.current[last] = element }}
          onFocus={() => setHighlight(last)} onPointerEnter={() => setHighlight(last)}
          onClick={() => { close(); onCreate() }}>
          <span className={styles['icon']}><Icon name="plus" /></span>
          <span className={styles['name']}>Tạo Workspace</span>
        </button>
      </div>
    </div>
  </div>
}
