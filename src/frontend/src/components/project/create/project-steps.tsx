// Lucian UX/UI Prompt #444 · MIT License (c) 2026 Seokwoooo · https://lucianlabs.dev/uxui-prompt/#444
import { useRef } from 'react'
import type { CSSProperties } from 'react'
import styles from './project-steps.module.css'

export function ProjectSteps({ labels, step, previousStep, pending, onStep }: {
  labels: readonly string[]
  step: number
  previousStep: number
  pending: boolean
  onStep: (step: number) => boolean
}) {
  const buttons = useRef<Array<HTMLButtonElement | null>>([])
  return <ol className={styles['u444']} aria-label="Các bước tạo project">
    {labels.map((label, index) => {
      const done = index < step
      const forward = done && index >= previousStep
      const backward = !done && index < previousStep
      const lineDelay = forward ? (index - previousStep) * .26 : backward ? (previousStep - 1 - index) * .26 * .6 : 0
      const checkDelay = forward ? (index - previousStep + 1) * .26 : 0
      return <li key={label} aria-current={index === step ? 'step' : undefined} data-done={done}
        style={{ '--line-delay': `${lineDelay}s`, '--check-delay': `${checkDelay}s` } as CSSProperties}>
        <button type="button" ref={element => { buttons.current[index] = element }}
          disabled={pending} tabIndex={index === step ? 0 : -1}
          aria-label={index < step ? `${label}, đã hoàn tất` : label}
          onClick={() => { if (onStep(index)) buttons.current[index]?.focus() }}
          onKeyDown={event => {
            const direction = event.key === 'ArrowLeft' ? -1 : event.key === 'ArrowRight' ? 1 : 0
            if (!direction) return
            event.preventDefault()
            const next = index + direction
            if (next >= 0 && next < labels.length && onStep(next)) buttons.current[next]?.focus()
          }}>
          <b aria-hidden="true">{index + 1}</b>
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5.5 12.5 4 4 9-9.5" /></svg>
        </button>
        <span aria-hidden="true">{label}</span>
      </li>
    })}
  </ol>
}
