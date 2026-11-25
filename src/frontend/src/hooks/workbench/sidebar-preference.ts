export const sidebarPreferenceKey = 'data-quality.preview.sidebar.v1'

export function readSidebarCollapsed(): boolean {
  try {
    return window.localStorage.getItem(sidebarPreferenceKey) === 'compact'
  } catch {
    return false
  }
}
