import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAuth } from '../auth/use-auth'
import type { SaveUploadDraft, UploadDraft, UploadDraftPort } from '../../types'

type Options = { kind?: 'project-upload' | 'project-wizard'; projectId?: string }

const toFile = (draft: UploadDraft, blob: Blob) => new File([blob], draft.fileName, {
  type: draft.mimeType,
  lastModified: draft.lastModified,
})

export function useUploadDraft(options: Options = {}) {
  const uploadDrafts = useAuth().uploadDrafts ?? null
  const [allDrafts, setAllDrafts] = useState<UploadDraft[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    if (!uploadDrafts) { setAllDrafts([]); setLoading(false); return [] as UploadDraft[] }
    setLoading(true)
    try {
      const rows = await uploadDrafts.list()
      setAllDrafts(rows)
      setError(null)
      return rows
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Không đọc được bản nháp upload.')
      return [] as UploadDraft[]
    } finally { setLoading(false) }
  }, [uploadDrafts])

  useEffect(() => { void refresh() }, [refresh])

  const drafts = useMemo(() => allDrafts.filter(draft => {
    if (options.projectId && draft.projectId !== options.projectId) return false
    if (options.kind === 'project-upload') return draft.kind !== 'project-wizard'
    if (options.kind === 'project-wizard') return draft.kind === 'project-wizard'
    return true
  }).sort((left, right) => right.createdAtMs - left.createdAtMs), [allDrafts, options.kind, options.projectId])

  const withDrafts = useCallback(async <T,>(work: (repository: UploadDraftPort) => Promise<T>) => {
    if (!uploadDrafts) throw new Error('Kho bản nháp upload chưa sẵn sàng.')
    const result = await work(uploadDrafts)
    await refresh()
    return result
  }, [refresh, uploadDrafts])

  const save = useCallback((input: SaveUploadDraft) => withDrafts(repository => repository.save(input)), [withDrafts])
  const restoreFile = useCallback(async (id: string) => withDrafts(async repository => {
    const draft = (await repository.list()).find(item => item.id === id)
    if (!draft) throw new Error('Không tìm thấy bản nháp trong tài khoản hiện tại.')
    return toFile(draft, await repository.readFile(id))
  }), [withDrafts])
  const remove = useCallback((id: string) => withDrafts(repository => repository.remove(id)), [withDrafts])
  const updateWizardMetadata = useCallback((id: string, input: Pick<SaveUploadDraft, 'workspaceId' | 'projectName' | 'projectDescription' | 'selectedMembers'>) =>
    withDrafts(repository => repository.updateWizardMetadata(id, input)), [withDrafts])
  const attachToProject = useCallback((id: string, projectId: string) =>
    withDrafts(repository => repository.attachToProject(id, projectId)), [withDrafts])
  const markQueued = useCallback((id: string, queueId: string) =>
    withDrafts(repository => repository.markQueued(id, queueId)), [withDrafts])
  const markUploadStarted = useCallback((id: string) =>
    withDrafts(repository => repository.markUploadStarted(id)), [withDrafts])
  const markUploadAcknowledged = useCallback((id: string) =>
    withDrafts(repository => repository.markUploadAcknowledged(id)), [withDrafts])
  const confirmUploaded = useCallback((id: string, confirmation: Parameters<UploadDraftPort['confirmUploaded']>[1]) =>
    withDrafts(repository => repository.confirmUploaded(id, confirmation)), [withDrafts])

  return {
    drafts, allDrafts, loading, error, refresh, save, restoreFile, remove,
    updateWizardMetadata, attachToProject, markQueued, markUploadStarted,
    markUploadAcknowledged, confirmUploaded,
  }
}
