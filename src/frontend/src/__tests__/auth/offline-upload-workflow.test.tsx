/// <reference types="node" />
import 'fake-indexeddb/auto'
import { Blob as NodeBlob, File as NodeFile } from 'node:buffer'
import { act, cleanup, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { AuthContext } from '../../hooks/auth/auth-context'
import { useUploadDraft } from '../../hooks/offline/use-upload-draft'
import { createUploadDraftRepository } from '../../repositories/datasets/upload-draft.repository'
import { UploadDraftDatabase } from '../../repositories/datasets/upload-draft.database'
import { OfflineReadDatabase } from '../../repositories/offline/offline-read.database'
import { createOfflineReadRepository } from '../../repositories/offline/offline-read.repository'
import { createOfflineDataService } from '../../services/offline/offline-data.service'
import { ManagementStoreContext } from '../../hooks/preview/use-preview-store'
import { previewMockStore } from '../../services/preview/preview-mock.service'
import { PreviewSessionProvider } from '../../views/preview/preview-session'
import { ProjectUploadDialog } from '../../views/processing/project/sections/project-data-actions'
import { ProjectWizard } from '../../components/project/create/project-wizard'
import type { AuthContextValue } from '../../types/auth/auth-context.types'

const resources: { drafts: UploadDraftDatabase; reads: OfflineReadDatabase; offline: ReturnType<typeof createOfflineDataService> }[] = []
beforeEach(() => { vi.stubGlobal('File', NodeFile); vi.stubGlobal('Blob', NodeBlob); previewMockStore.reset() })
afterEach(async () => {
  cleanup()
  for (const resource of resources.splice(0)) { resource.offline.dispose(); await resource.drafts.delete(); await resource.reads.delete() }
  vi.unstubAllGlobals()
})
const file = () => new File(['a,b\n1,2'], 'draft.csv', { type: 'text/csv', lastModified: 10 })
const setup = () => {
  const drafts = new UploadDraftDatabase(`draft-ui-${crypto.randomUUID()}`)
  const reads = new OfflineReadDatabase(`read-ui-${crypto.randomUUID()}`)
  const access = { read: () => ({ accountId: 'u1', generation: 1, expiresAtMs: 4_000_000_000_000 }), subscribe: () => () => {} }
  const repository = createUploadDraftRepository({ db: drafts, access, estimate: () => Promise.resolve({}) })
  const offline = createOfflineDataService({ cache: createOfflineReadRepository({ db: reads, access, namespace: 'test' }), access })
  resources.push({ drafts, reads, offline })
  const auth: AuthContextValue = {
    snapshot: { phase: 'authenticated', accountId: 'u1', generation: 1, expiresAtMs: 4_000_000_000_000, sessionEnded: false,
      user: { source: 'login', value: { id: 'u1', email: 'u1@example.test', role: 'analyst' } }, error: null, cleanupError: null },
    configurationError: null, signIn: () => Promise.resolve(), confirmRenewal: () => Promise.resolve(),
    signOut: () => Promise.resolve({ serverRevoked: true, revokeError: null, cleanupError: null }),
    localData: { drafts: repository, offline, migration: {
      getSnapshot: () => ({ state: 'idle', conflicts: 0, unlistedNamespaces: 0, message: null }), subscribe: () => () => {},
    }, wrapApi: offline.wrapApi },
  }
  const wrapper = ({ children }: { children: ReactNode }) => <AuthContext.Provider value={auth}>{children}</AuthContext.Provider>
  return { drafts, repository, offline, wrapper }
}

it('saves and restores a draft across dialog mounts, then explicitly removes its Blob', async () => {
  const s = setup()
  const first = renderHook(() => useUploadDraft('p'), { wrapper: s.wrapper })
  await act(async () => { await first.result.current.save(file()) })
  expect(first.result.current.entry?.fileName).toBe('draft.csv')
  first.unmount()
  const second = renderHook(() => useUploadDraft('p'), { wrapper: s.wrapper })
  await waitFor(() => expect(second.result.current.entry).not.toBeNull())
  let restored: File | null = null
  await act(async () => { restored = await second.result.current.restore() })
  expect(await (restored as unknown as File).text()).toBe('a,b\n1,2')
  await act(async () => { await second.result.current.remove() })
  expect(await s.repository.list()).toEqual([])
  expect(await s.drafts.files.count()).toBe(0)
})

it('keeps a save that finishes after closing the dialog', async () => {
  const s = setup()
  const original = s.repository.save.bind(s.repository)
  let release!: () => void
  const gate = new Promise<void>(resolve => { release = resolve })
  vi.spyOn(s.repository, 'save').mockImplementation(async input => { await gate; return original(input) })
  const hook = renderHook(() => useUploadDraft('p'), { wrapper: s.wrapper })
  let saving!: Promise<void>
  act(() => { saving = hook.result.current.save(file()) })
  hook.unmount(); release(); await saving
  expect(await s.repository.list()).toHaveLength(1)
})

it('does not associate an older draft with a replacement whose save failed', async () => {
  const s = setup()
  const hook = renderHook(() => useUploadDraft('p'), { wrapper: s.wrapper })
  await act(async () => { await hook.result.current.save(file()) })
  vi.spyOn(s.repository, 'save').mockRejectedValueOnce(new Error('Disk full'))
  await act(async () => { await hook.result.current.save(new File(['x\n2'], 'replacement.csv')) })
  expect(await hook.result.current.flush()).toBeUndefined()
  expect(await s.repository.list()).toHaveLength(1)
  expect(hook.result.current.notice).toContain('Chưa lưu')
})

it('wires upload selection, restore, server failure and offline read-only state into the real dialog', async () => {
  const s = setup()
  const uploadDataset = vi.fn().mockRejectedValue(new Error('Máy chủ chưa hoạt động'))
  const close = vi.fn()
  const tree = <s.wrapper><ManagementStoreContext.Provider value={{ ...previewMockStore, uploadDataset }}>
    <PreviewSessionProvider routeIds={{ projectId: 'prj-empty' }}><ProjectUploadDialog onClose={close} /></PreviewSessionProvider>
  </ManagementStoreContext.Provider></s.wrapper>
  const first = render(tree)
  fireEvent.change(screen.getByLabelText('Chọn tệp dữ liệu'), { target: { files: [file()] } })
  await screen.findByText('Đã lưu file nháp trên thiết bị.')
  first.unmount()
  render(tree)
  fireEvent.click(await screen.findByRole('button', { name: 'Khôi phục file nháp' }))
  await screen.findByText('Đã chọn trên thiết bị: draft.csv')
  fireEvent.click(screen.getByRole('button', { name: 'Upload data' }))
  await screen.findByText('Máy chủ chưa hoạt động')
  expect(close).not.toHaveBeenCalled()
  expect(uploadDataset).toHaveBeenCalledWith('prj-empty', expect.objectContaining({ name: 'draft.csv' }), expect.objectContaining({ scope: 'prj-empty' }))
  expect(await s.repository.list()).toHaveLength(1)
  act(() => { s.offline.useSavedData() })
  expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Upload data' }).disabled).toBe(true)
})

it('saves and restores the wizard CSV inside its selected workspace scope', async () => {
  const s = setup()
  const workspaceId = previewMockStore.getState().workspaces[0]!.id
  const tree = <s.wrapper><PreviewSessionProvider routeIds={{}}><ProjectWizard initialWorkspaceId={workspaceId} onClose={() => {}} /></PreviewSessionProvider></s.wrapper>
  const start = () => {
    fireEvent.change(screen.getByRole('textbox', { name: /Tên Project/ }), { target: { value: 'Offline project' } })
    fireEvent.click(screen.getByRole('button', { name: 'Tiếp theo' }))
  }
  const first = render(tree); start()
  fireEvent.change(screen.getByLabelText('Chọn tập dữ liệu CSV'), { target: { files: [file()] } })
  await screen.findByText('Đã lưu file nháp trên thiết bị.')
  expect((await s.repository.list())[0]?.projectId).toBe(`new-project:${workspaceId}`)
  first.unmount()
  render(tree); start()
  fireEvent.click(await screen.findByRole('button', { name: 'Khôi phục file nháp' }))
  await screen.findByText(/draft.csv \(/)
  expect(screen.getByText('Số bản ghi')).toBeDefined()
})
