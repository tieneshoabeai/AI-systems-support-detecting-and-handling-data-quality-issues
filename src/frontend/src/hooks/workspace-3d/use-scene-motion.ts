import { useSyncExternalStore } from 'react'

const query = '(prefers-reduced-motion: reduce)'
// jsdom không cấp matchMedia: thiếu nó thì coi như không reduced, cùng cách guard
// của use-preview-color-scheme và preview-shell.
const reduced = () => typeof window.matchMedia === 'function' && window.matchMedia(query).matches
const hidden = () => document.visibilityState === 'hidden'
const serverReduced = () => true
const subscribeMotion = (notify: () => void) => {
  if (typeof window.matchMedia !== 'function') return () => {}
  const media = window.matchMedia(query)
  media.addEventListener('change', notify)
  return () => media.removeEventListener('change', notify)
}
const subscribeVisibility = (notify: () => void) => {
  document.addEventListener('visibilitychange', notify)
  return () => document.removeEventListener('visibilitychange', notify)
}

export function useSceneMotion() {
  const reducedMotion = useSyncExternalStore(subscribeMotion, reduced, serverReduced)
  const tabHidden = useSyncExternalStore(subscribeVisibility, hidden, serverReduced)
  return { reducedMotion, tabHidden, moving: !reducedMotion && !tabHidden }
}
