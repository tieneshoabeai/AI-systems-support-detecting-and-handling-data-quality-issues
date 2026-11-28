import { ManagementStoreContext } from '../../hooks/management/use-management-store'
import { AuthContext } from '../../hooks/auth/auth-context'
import type { ReactNode } from 'react'
import { render, screen } from '@testing-library/react'
import { expect } from 'vitest'
import { PreviewSessionProvider } from '../../views/application/workbench-session'
import { previewMockStore } from './management-mock-store'
import type { PreviewRouteIds } from '../../types'
import type { AuthContextValue, UploadDraft, UploadDraftPort } from '../../types'
import type { ManagementStore } from '../../services/management/management.types'

const createUploadDraftFixture = (): UploadDraftPort => {
  const drafts: UploadDraft[] = []
  const files = new Map<string, File>()
  let sequence = 0
  const get = (id: string) => {
    const draft = drafts.find(item => item.id === id)
    if (!draft) throw new Error('Test draft was not found.')
    return draft
  }
  return {
    async save(input) {
      const id = `test-draft-${++sequence}`
      const draft: UploadDraft = {
        id, accountId: 'workbench-test', kind: input.projectId ? 'project-upload' : 'project-wizard',
        projectId: input.projectId ?? null, ...(input.workspaceId ? { workspaceId: input.workspaceId } : {}),
        ...(input.projectName ? { projectName: input.projectName } : {}),
        ...(input.projectDescription === undefined ? {} : { projectDescription: input.projectDescription }),
        ...(input.selectedMembers === undefined ? {} : { selectedMembers: input.selectedMembers.map(member => ({ ...member })) }),
        fileName: input.file.name, mimeType: input.file.type, sizeBytes: input.file.size,
        lastModified: input.file.lastModified, createdAtMs: Date.now(), fileHash: 'a'.repeat(64), status: 'pending',
      }
      drafts.push(draft)
      files.set(id, input.file)
      return draft
    },
    async list() { return drafts.map(draft => ({ ...draft })) },
    async readFile(id) {
      const file = files.get(id)
      if (!file) throw new Error('Test draft file was not found.')
      return file
    },
    async remove(id) { const index = drafts.findIndex(draft => draft.id === id); if (index >= 0) drafts.splice(index, 1); files.delete(id) },
    async updateWizardMetadata(id, input) {
      const draft = get(id)
      Object.assign(draft, input, input.selectedMembers ? { selectedMembers: input.selectedMembers.map(member => ({ ...member })) } : {})
      return { ...draft }
    },
    async attachToProject(id, projectId) { const draft = get(id); draft.projectId = projectId; return { ...draft } },
    async markQueued(id, queueId) { const draft = get(id); draft.status = 'queued'; draft.queueId = queueId; return { ...draft } },
    async markUnqueued(id, queueId) { const draft = get(id); if (draft.queueId === queueId) { draft.status = 'pending'; delete draft.queueId }; return { ...draft } },
    async markUploadStarted(id) { const draft = get(id); draft.status = 'uploading'; return { ...draft } },
    async markUploadAcknowledged(id) { const draft = get(id); draft.status = 'acknowledged'; return { ...draft } },
    async confirmUploaded(id, confirmation) {
      const draft = get(id)
      draft.status = 'uploaded'
      draft.datasetId = confirmation.datasetId
      files.delete(id)
      return confirmation.retainMetadata ? { cleaned: true, metadataRetained: true } : { cleaned: true }
    },
    async cleanupUploaded() { return 0 },
  }
}

const createAuthFixture = (uploadDrafts: UploadDraftPort): AuthContextValue => ({
  snapshot: {
    phase: 'authenticated', generation: 1, sessionEnded: false, accountId: 'workbench-test',
    expiresAtMs: Number.MAX_SAFE_INTEGER, user: { source: 'login', value: { id: 'workbench-test', email: 'test@example.test', role: 'analyst' } },
    error: null, cleanupError: null,
  },
  configurationError: null, uploadDrafts,
  signIn: async () => {},
  signOut: async () => ({ serverRevoked: true, revokeError: null, cleanupError: null }),
  confirmRenewal: async () => {},
})

// Khung test chung cho ba suite của batch 2D (shell · views · interactions).
// File không có đuôi .test nên vitest không coi nó là một suite; tsc -b vẫn kiểm tra.

// Mock store là singleton cấp module. Thao tác chuột giờ SỬA dữ liệu thật (yêu thích,
// đổi tên, xóa, đánh dấu đã đọc) nên mọi test phải reset — nếu không số đếm của test
// sau lệch theo thay đổi mà test trước để lại, và lỗi chỉ hiện khi chạy cả file.
export const resetPreviewStore = (): void => { previewMockStore.reset() }

// Mọi view (Home · Workspaces · Projects) và PreviewShell đều đọc usePreviewSession,
// nên không render được chúng nếu thiếu provider — render trực tiếp sẽ throw.
export const renderFrameWithStore = (
  children: ReactNode,
  store: ManagementStore,
  routeIds: PreviewRouteIds = {},
  authOverrides: Partial<AuthContextValue> = {},
): ReturnType<typeof render> =>
  render(<AuthContext.Provider value={{ ...createAuthFixture(createUploadDraftFixture()), ...authOverrides }}>
    <ManagementStoreContext.Provider value={store}>
      <PreviewSessionProvider routeIds={routeIds}>{children}</PreviewSessionProvider>
    </ManagementStoreContext.Provider>
  </AuthContext.Provider>)

export const renderFrame = (children: ReactNode, routeIds: PreviewRouteIds = {}): ReturnType<typeof render> =>
  renderFrameWithStore(children, previewMockStore, routeIds)

// Bất biến shared-ui: "nút disabled cần lý do dễ tiếp cận trong text/context, không chỉ
// tooltip". Test bắt TOÀN BỘ nút đã tắt, không chọn mẫu — thêm một nút chết im lặng là
// hỏng yêu cầu, và người duyệt không có cách nào biết nếu chỉ kiểm vài nút.
export const disabledButtons = (): HTMLButtonElement[] =>
  Array.from(document.querySelectorAll<HTMLButtonElement>('button[disabled]'))
    // Nút phân trang ở biên (trang đầu/cuối) tắt là trạng thái hợp lệ và tự giải thích
    // bằng số trang đang thấy → không thuộc nhóm "nút chết vì thiếu contract".
    .filter(button => !button.closest('.pagination'))

export const everyDisabledButtonHasVisibleReason = (): void => {
  const list = disabledButtons()
  // KHÔNG assert list.length > 0: Home gọn theo đặc tả đã bỏ mọi nút "sắp có" (quick actions),
  // nên một trang hợp lệ có thể có 0 nút tắt. Bất biến thật là CHIỀU MỘT: nếu có nút tắt thì
  // mọi nút tắt phải có lý do nhìn thấy — thêm một nút chết im lặng vẫn bị bắt.
  for (const button of list) {
    const noteId = button.getAttribute('aria-describedby')
    const who = button.getAttribute('aria-label') ?? button.textContent ?? '?'
    expect(noteId, `nút "${who}" không có aria-describedby`).toBeTruthy()
    const note = document.getElementById(noteId ?? '')
    expect(note, `thiếu note #${noteId} cho nút "${who}"`).not.toBeNull()
    // ">20 ký tự" chặn một cạm cụ thể: aria-describedby trỏ về một id hợp lệ nhưng rỗng
    // (ví dụ note nằm trong popover đang đóng) thì vẫn "có" mà không nói gì.
    expect((note?.textContent ?? '').length, `note #${noteId} quá ngắn để là một lý do`).toBeGreaterThan(20)
  }
}

const byCardHeading = (selector: string, title: string): HTMLElement => {
  // Thẻ là <article role="button"> chứa <h3> tên; bên trong còn nút ★/⋯ nên không tìm
  // theo accessible name của thẻ (sẽ bao gồm cả chữ của nút con).
  const found = Array.from(document.querySelectorAll<HTMLElement>(selector))
    .find(card => card.querySelector('h3')?.textContent === title)
  if (!found) throw new Error(`Không tìm thấy thẻ "${title}" (${selector}) trong dữ liệu mẫu`)
  return found
}

export const cardByTitle = (title: string): HTMLElement => byCardHeading('.resource-card', title)
export const miniCardByTitle = (title: string): HTMLElement => byCardHeading('.mini-card', title)

// Dòng bảng trên Home (project và dataset) — <th> đầu dòng chứa tên, phía sau còn phần
// mô tả nên so khớp mở đầu thay vì bằng tuyệt đối.
export const rowByTitle = (title: string): HTMLTableRowElement => {
  const found = Array.from(document.querySelectorAll<HTMLTableRowElement>('.preview-table tbody tr'))
    .find(row => row.querySelector('th')?.textContent?.startsWith(title) ?? false)
  if (!found) throw new Error(`Không tìm thấy dòng "${title}" trong bảng dữ liệu mẫu`)
  return found
}

// Menu ngữ cảnh tự đặt tên theo bản ghi → một truy vấn đủ định vị, không cần giữ container.
export const menuFor = (name: string): HTMLElement =>
  screen.getByRole('menu', { name: `Thao tác với ${name}` })

export const menuItem = (name: RegExp | string): HTMLElement =>
  screen.getByRole('menuitem', { name })
