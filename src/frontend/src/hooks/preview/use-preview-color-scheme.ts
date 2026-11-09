import { useCallback, useEffect, useState, useSyncExternalStore } from 'react'

export type PreviewColorPreference = 'light' | 'dark' | 'system'
export const previewColorKey = 'data-quality.preview.color.v1'
const darkQuery = '(prefers-color-scheme: dark)'
const normalize = (value: string | null): PreviewColorPreference =>
  value === 'light' || value === 'system' ? value : 'dark'

const readPreference = (): PreviewColorPreference => {
  try { return normalize(window.localStorage.getItem(previewColorKey)) }
  catch { return 'dark' }
}
const readSystemDark = (): boolean =>
  typeof window.matchMedia === 'function' ? window.matchMedia(darkQuery).matches : true
const subscribeSystem = (notify: () => void): (() => void) => {
  if (typeof window.matchMedia !== 'function') return () => {}
  const media = window.matchMedia(darkQuery)
  media.addEventListener('change', notify)
  return () => media.removeEventListener('change', notify)
}

export function usePreviewColorScheme() {
  const [preference, setPreference] = useState(readPreference)
  const systemDark = useSyncExternalStore(subscribeSystem, readSystemDark, () => true)

  useEffect(() => {
    const sync = (event: StorageEvent) => {
      if (event.key !== previewColorKey && event.key !== null) return
      setPreference(readPreference())
    }
    window.addEventListener('storage', sync)
    return () => window.removeEventListener('storage', sync)
  }, [])

  const setColorPreference = useCallback((value: PreviewColorPreference) => {
    setPreference(value)
    try { window.localStorage.setItem(previewColorKey, value) }
    catch { /* Storage unavailable: keep the choice for this session. */ }
  }, [])

  const resolved: 'light' | 'dark' = preference === 'system' ? (systemDark ? 'dark' : 'light') : preference
  return { preference, resolved, setColorPreference }
}
