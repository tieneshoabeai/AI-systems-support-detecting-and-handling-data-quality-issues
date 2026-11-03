import { useSyncExternalStore } from 'react'
import type { PreviewStoreState, Project, Workspace } from '../../types/preview/preview.types'
import { previewMockStore } from '../../services/preview/preview-mock.service'

// Cầu nối React ↔ mock store. useSyncExternalStore là cách chuẩn để đọc một store
// ngoài React mà không cần copy state vào useState (copy sẽ lệch khi tab khác đổi).
// getServerSnapshot = cùng một hàm: preview chỉ chạy trên browser nhưng React 19
// yêu cầu đủ 3 tham số nếu sau này bật SSR.
export const usePreviewStore = (): PreviewStoreState =>
  useSyncExternalStore(previewMockStore.subscribe, previewMockStore.getState, previewMockStore.getState)

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
