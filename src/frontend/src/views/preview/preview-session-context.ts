import { createContext, useContext } from 'react'
import type { PreviewSessionModel } from '../../hooks/preview/use-preview-session'

// Context của frame tách khỏi provider (preview-session.tsx) vì eslint bắt
// react-refresh/only-export-components: một file vừa export component vừa export
// hook/hàm thì Fast Refresh bị tắt toàn bộ file đó. Provider là component, còn đây
// là hạ tầng thuần nên ở .ts và không export component nào.

export const PreviewSessionContext = createContext<PreviewSessionModel | null>(null)

export const usePreviewSession = (): PreviewSessionModel => {
  const value = useContext(PreviewSessionContext)
  if (!value) throw new Error('usePreviewSession chỉ dùng được bên trong <PreviewSessionProvider>')
  return value
}
