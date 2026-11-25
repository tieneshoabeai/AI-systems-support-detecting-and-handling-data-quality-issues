import { createContext, useContext, useSyncExternalStore } from 'react'
import type { PreviewStoreState, Project, Workspace } from '../../types'

import type { ManagementStore } from '../../services/management/management.types'
export type { ManagementStore } from '../../services/management/management.types'
export const ManagementStoreContext = createContext<ManagementStore | null>(null)
export function useManagementStore(): ManagementStore {
  const store = useContext(ManagementStoreContext)
  if (store === null) throw new Error('ManagementStoreContext requires a provider.')
  return store
}
export const usePreviewStore = (): PreviewStoreState => {
  const store = useManagementStore()
  return useSyncExternalStore(store.subscribe, store.getState, store.getState)
}

// Hai selector nhỏ để trang khỏi lặp .find(...) khắp nơi. Trả về null chứ không throw:
// sau thao tác xóa/xem tất cả, id trong selection có thể không còn tồn tại ở phạm vi hiện tại.
export const findWorkspace = (state: PreviewStoreState, workspaceId: string): Workspace | null =>
  state.workspaces.find(item => item.id === workspaceId) ?? null

export const findProject = (state: PreviewStoreState, projectId: string): Project | null =>
  state.projects.find(item => item.id === projectId) ?? null

// Dự án của một workspace, giữ nguyên thứ tự mock (mới cập nhật ở trên) để
// "Dự án gần đây" trên card và panel chi tiết không hai thứ tự khác nhau.
export const projectsOfWorkspace = (state: PreviewStoreState, workspaceId: string): Project[] =>
  state.projects.filter(project => project.workspaceId === workspaceId)
