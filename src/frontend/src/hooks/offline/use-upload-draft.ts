import { useContext, useEffect, useRef, useState } from 'react'
import { AuthContext } from '../auth/auth-context'
import { useLocalData } from './use-local-data'
import type { LocalUploadDraftRef, UploadDraft } from '../../types/datasets/upload-draft.types'

const reference = (draft: UploadDraft): LocalUploadDraftRef => ({ id: draft.id, scope: draft.projectId,
  ...(draft.targetProjectId ? { targetProjectId: draft.targetProjectId } : {}),
  ...(draft.targetProjectName ? { targetProjectName: draft.targetProjectName } : {}),
})

export function useUploadDraft(scope: string) {
  const repository = useLocalData()?.drafts
  const accountId = useContext(AuthContext)?.snapshot.accountId
  const [entry, setEntry] = useState<UploadDraft | null>(null)
  const [savingScope, setSavingScope] = useState<string | null>(null)
  const [notice, setNotice] = useState('')
  const current = useRef<UploadDraft | null>(null)
  const revision = useRef(0)
  const lifecycle = useRef({ active: false })
  const queue = useRef<Promise<void>>(Promise.resolve())
  useEffect(() => {
    let active = true
    const owner = { active: true }
    lifecycle.current = owner
    const ticket = ++revision.current
    current.current = null
    if (repository && scope && accountId) {
      void repository.cleanupUploaded().catch(() => {}).then(() => repository.list()).then(rows => {
        if (!active || ticket !== revision.current) return
        const latest = rows.filter(row => row.projectId === scope && row.status === 'pending').sort((a, b) => b.createdAtMs - a.createdAtMs)[0] ?? null
        current.current = latest; setEntry(latest)
      }).catch(() => { if (active) setNotice('Không đọc được bản nháp trên thiết bị.') })
    }
    return () => { active = false; owner.active = false; revision.current++ }
  }, [repository, scope, accountId])

  const save = (file: File) => {
    if (!repository || !scope) return Promise.resolve()
    const ticket = ++revision.current
    const owner = lifecycle.current
    const previous = current.current
    current.current = null
    const savingKey = `${accountId}:${scope}:${ticket}`
    setSavingScope(savingKey); setNotice('')
    queue.current = queue.current.catch(() => {}).then(async () => {
      try {
        const draft = await repository.save({ projectId: scope, file })
        // Closing the dialog must keep a completed save for the next visit.
        if (!owner.active) return
        if (ticket !== revision.current) { await repository.remove(draft.id).catch(() => {}); return }
        current.current = draft; setEntry(draft)
        if (previous && !previous.targetProjectId) await repository.remove(previous.id).catch(() => {})
        setNotice('Đã lưu file nháp trên thiết bị.')
      } catch { if (owner.active && ticket === revision.current) setNotice('Chưa lưu được file nháp. File đang chọn chỉ còn trong trang này.') }
      finally { if (owner.active) setSavingScope(value => value === savingKey ? null : value) }
    })
    return queue.current
  }
  const restore = async () => {
    const draft = current.current
    const owner = lifecycle.current
    const ticket = revision.current
    if (!repository || !draft || draft.projectId !== scope) return null
    try {
      const blob = await repository.readFile(draft.id)
      if (!owner.active || ticket !== revision.current) return null
      return new File([blob], draft.fileName, { type: draft.mimeType, lastModified: draft.lastModified })
    } catch { if (owner.active) setNotice('Không khôi phục được file nháp. Hãy chọn lại tệp.'); return null }
  }
  const remove = async () => {
    const owner = lifecycle.current
    const draft = current.current
    ++revision.current
    await queue.current
    try {
      if (repository && draft?.projectId === scope) await repository.remove(draft.id)
      if (owner.active) { current.current = null; setEntry(null); setNotice(''); setSavingScope(null) }
    } catch { if (owner.active) setNotice('Không xóa được bản nháp. Hãy thử lại.') }
  }
  return {
    entry: entry?.projectId === scope && entry.accountId === accountId ? entry : null,
    saving: savingScope?.startsWith(`${accountId}:${scope}:`) ?? false,
    notice: repository ? notice : '', save, restore, remove,
    flush: async () => { await queue.current; return current.current?.projectId === scope ? reference(current.current) : undefined },
  }
}
