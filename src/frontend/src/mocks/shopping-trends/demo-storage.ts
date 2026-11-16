import type { PreviewStoreState } from '../../types'
const key = 'shopping-demo.project-state.v1'
let issue: string | null = null
export const getDemoStorageIssue = () => issue
export const restoreDemoState = (seed: PreviewStoreState): PreviewStoreState => {
  try {
    const raw = sessionStorage.getItem(key)
    if (!raw) return seed
    const parsed = JSON.parse(raw) as { version?: number; state?: PreviewStoreState }
    const s = parsed.state
    if (parsed.version !== 1 || !s || !Array.isArray(s.projects) || !Array.isArray(s.workspaces)
      || !Array.isArray(s.notifications) || !Array.isArray(s.reports) || !s.selection || !s.profile
      || !Array.isArray(s.sessions) || !s.notificationPrefs) throw new Error('Invalid saved state')
    return s
  } catch {
    issue = 'Không đọc được trạng thái demo đã lưu. Đang dùng dữ liệu ban đầu.'
    return seed
  }
}
export const persistDemoState = (state: PreviewStoreState) => {
  try { sessionStorage.setItem(key, JSON.stringify({ version: 1, state })) }
  catch { throw new Error('Không lưu được trạng thái demo trong trình duyệt.') }
}
export const clearDemoProject = () => {
  sessionStorage.removeItem(key)
  sessionStorage.removeItem('shopping-demo.detection.v1')
}
