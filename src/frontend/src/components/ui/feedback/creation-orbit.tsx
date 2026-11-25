// Lucian UX/UI Prompt #080 · MIT License (c) 2026 Seokwoooo · https://lucianlabs.dev/uxui-prompt/#080
import type { CSSProperties } from 'react'
import styles from './creation-orbit.module.css'

const orbits = [
  { diameter: 210, tilt: -18, period: 5.5, size: 12, color: 'var(--pv-green)' },
  { diameter: 150, tilt: 24, period: 3.6, size: 10, color: 'var(--pv-pink)' },
  { diameter: 100, tilt: -58, period: 2.2, size: 9, color: 'var(--pv-orange)' },
]

export function CreationOrbit({ completed, label }: { completed: boolean; label: string }) {
  return <div className={styles['u080']} data-complete={completed}>
    <div className={styles['system']} aria-hidden="true">
      {orbits.map(({ diameter, tilt, period, size, color }) => <span key={diameter} className={styles['orbit']}
        style={{ '--diameter': `${diameter}px`, '--tilt': `${tilt}deg`, '--period': `${period}s`, '--size': `${size}px`, '--planet': color } as CSSProperties} />)}
      <span className={styles['wave']} />
      <span className={styles['core']}><svg viewBox="0 0 34 34"><path d="M9 17.5l5.5 5.5L25.5 12" /></svg></span>
    </div>
    <h3 aria-live="polite" aria-atomic="true">{label}</h3>
  </div>
}
