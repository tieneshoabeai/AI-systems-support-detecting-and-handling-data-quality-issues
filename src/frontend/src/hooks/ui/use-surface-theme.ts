import { useSyncExternalStore } from 'react'

// Theme của surface đang hiển thị: `data-preview='2d'` mang data-theme, và có thể đổi bất cứ
// lúc nào từ bảng chọn Sáng/Tối trên topbar hoặc Settings → System → Color. Scene 3D và các
// lớp phủ cần biết ngay khi đổi để không giữ tông của theme cũ.
const selector = '[data-preview="2d"], [data-theme]'

const read = (): 'light' | 'dark' => {
  if (typeof document === 'undefined') return 'light'
  const surface = document.querySelector('[data-preview="2d"]')
  const themed = surface ?? document.querySelector('[data-theme]')
  return themed?.getAttribute('data-theme') === 'dark' ? 'dark' : 'light'
}

const subscribe = (notify: () => void) => {
  if (typeof MutationObserver === 'undefined') return () => {}
  const observer = new MutationObserver(notify)
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['data-theme'],
    subtree: true,
  })
  return () => observer.disconnect()
}

const serverTheme = () => 'light' as const

export function useSurfaceTheme(): 'light' | 'dark' {
  return useSyncExternalStore(subscribe, read, serverTheme)
}

export { selector as surfaceThemeSelector }
