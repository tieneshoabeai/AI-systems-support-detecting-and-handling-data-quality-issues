import { Dialog } from '../../ui/overlay/dialog'
import { CreationOrbit } from '../../ui/feedback/creation-orbit'
import creationStyles from '../../ui/feedback/creation-orbit.module.css'
import { ProjectSteps } from './project-steps'
import { ProjectWorkspacePicker } from './project-workspace-picker'
import { WorkspaceCreateDialog } from '../../workspace/dialogs/workspace-create-dialog'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { DatasetSummary, Person } from '../../../types'
import { defaultProjectRole, emailForPerson, formatDataSize, formatRows, projectRoleOptions } from '../../../hooks/workbench/workbench-presentation'
import { useProjectCsvParser } from '../../../hooks/project/use-project-csv-parser'
import { Icon as PreviewIcon } from '../../ui/primitives/icon'
import { Avatar } from '../../resource'
import { usePreviewSession } from '../../../hooks/workbench/workbench-session-context'
import { useManagementStore } from '../../../hooks/management/use-management-store'
import { useUploadDraft } from '../../../hooks/datasets/use-upload-draft'
import type { UploadDraft, WizardDraftMember } from '../../../types'

// Four-step 2D import flow. The selected CSV is previewed locally, then uploaded by the
// manager store. Only members of the selected workspace can be added to the project.
// The confirmation screen opens after the store acknowledges successful persistence.

const steps = ['Thông tin Project', 'Import Dataset', 'Thành viên', 'Xác nhận'] as const
const nameMax = 100
const descMax = 500

// Ba dòng ghi chú ảnh vẽ trong khung thông tin ở bước 3 — viết lại đúng chữ của ảnh, không thêm
// quy tắc nào ảnh không nêu.
const memberStepNotes: readonly string[] = [
  'Chỉ có thể chọn thành viên đã thuộc Workspace này.',
  'Không thể thêm tài khoản bên ngoài Workspace.',
  'Bạn có thể thêm nhiều thành viên và phân quyền sau khi tạo Project.',
]

// Bấm nền tối = hủy (đặt trên scrim, tự kiểm target → panel không phải stopPropagation).

// Một dòng chọn thành viên: Person (đi vào project) + vai trò gán cho project đó. Vai trò nằm
// trong Person.role — project.members là Person[] nên không cần bảng phụ thứ hai.
type MemberPick = { person: Person; role: string }

// Những gì đọc được từ tệp người dùng vừa chọn. `rows`/`columns` là số ĐO TỪ NỘI DUNG, không phải
// con số viết tay; `delimiter` chỉ dùng để nói cho người dùng biết parser tự nhận ký tự gì.
type PickedCsv = {
  file?: File
  draftId: string
  fileHash?: string
  status?: UploadDraft['status']
  sizeBytes: number
  fileName: string
  format: DatasetSummary['format']
  rows: number
  columns: number
  sizeMb: number
  delimiter: string
}

const delimiterLabel = (delimiter: string): string =>
  delimiter === '|' ? 'Dấu gạch đứng' : delimiter === '\t' ? 'Tab' : delimiter === ';' ? 'Dấu chấm phẩy' : 'Dấu phẩy'

export function ProjectWizard({ initialWorkspaceId, onClose }: {
  initialWorkspaceId: string | null
  onClose: () => void
}) {
  const session = usePreviewSession()
  const { loadProjectWizardRoster } = useManagementStore()
  const uploadDrafts = useUploadDraft({ kind: 'project-wizard' })
  const parseLocalCsv = useProjectCsvParser()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [step, setStep] = useState(0)
  const [previousStep, setPreviousStep] = useState(0)
  const [workspaceId, setWorkspaceId] = useState(initialWorkspaceId ?? '')
  const [creatingWorkspace, setCreatingWorkspace] = useState(false)
  const [restoreWorkspaceFocus, setRestoreWorkspaceFocus] = useState(false)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [file, setFile] = useState<PickedCsv | null>(null)
  const [selected, setSelected] = useState<MemberPick[]>([])
  const [search, setSearch] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [createdName, setCreatedName] = useState('')
  const [pending, setPending] = useState(false)
  const [fileSaving, setFileSaving] = useState(false)
  const [rosterAttempt, setRosterAttempt] = useState(0)
  const [rosterResult, setRosterResult] = useState<{ workspaceId: string; attempt: number; members?: Person[] }>()
  const needsRoster = step === 2
  const activeDraft = file ? uploadDrafts.allDrafts.find(draft => draft.id === file.draftId) : undefined
  useEffect(() => {
    if (!needsRoster || !loadProjectWizardRoster || !workspaceId) return
    const controller = new AbortController()
    void loadProjectWizardRoster(workspaceId, controller.signal).then(members => {
      if (!controller.signal.aborted) setRosterResult({ workspaceId, attempt: rosterAttempt, members })
    }).catch(() => {
      if (!controller.signal.aborted) setRosterResult({ workspaceId, attempt: rosterAttempt })
    })
    return () => controller.abort()
  }, [needsRoster, loadProjectWizardRoster, workspaceId, rosterAttempt])

  // Wizard mở từ trang Projects khi chưa chọn không gian nào thì người dùng PHẢI chỉ định nơi
  // chứa project ở bước 1; các bước sau luôn có workspace thật để đọc roster.
  const workspace = session.state.workspaces.find(item => item.id === workspaceId) ?? null
  const selectWorkspace = (id: string): void => {
    if (id !== workspaceId) {
      setWorkspaceId(id)
      setSelected([])
      setSearch('')
      setRosterResult(undefined)
    }
    setError(null)
  }
  const closeWorkspaceCreation = useCallback(() => {
    setRestoreWorkspaceFocus(true)
    setCreatingWorkspace(false)
  }, [])

  // Roster của workspace = chủ sở hữu + memberPreview. Chủ sở hữu KHÔNG nằm trong danh sách chọn:
  // ảnh ghi "Chủ sở hữu luôn thuộc project" nên để họ tự tick là một dòng bỏ đi, và project đã
  // mang owner là người dùng hiện tại trong store.
  const currentRoster = rosterResult?.workspaceId === workspaceId && rosterResult.attempt === rosterAttempt ? rosterResult : undefined
  const roster = (loadProjectWizardRoster ? currentRoster?.members : workspace?.memberPreview)
    ?.filter(person => person.id !== workspace?.owner.id) ?? []
  const wizardMembers = useCallback((): WizardDraftMember[] => selected.map(({ person, role }) => ({
    id: person.id, name: person.name, email: emailForPerson(person), role,
  })), [selected])

  useEffect(() => {
    if (!file || !workspaceId || !name.trim()) return
    const timer = window.setTimeout(() => {
      void uploadDrafts.updateWizardMetadata(file.draftId, {
        workspaceId, projectName: name.trim(), projectDescription: description,
        selectedMembers: wizardMembers(),
      }).catch(reason => setError(reason instanceof Error ? reason.message : 'Không cập nhật được metadata bản nháp.'))
    }, 250)
    return () => window.clearTimeout(timer)
  }, [file?.draftId, file?.status, workspaceId, name, description, wizardMembers, uploadDrafts.updateWizardMetadata])

  const isSelected = (person: Person): boolean => selected.some(item => item.person.id === person.id)
  const isDone = step >= steps.length
  const needle = search.trim().toLowerCase()
  const candidates = roster.filter(person =>
    !needle || person.name.toLowerCase().includes(needle) || emailForPerson(person).toLowerCase().includes(needle))

  const togglePerson = (person: Person): void =>
    setSelected(list => isSelected(person)
      ? list.filter(item => item.person.id !== person.id)
      : [...list, { person, role: defaultProjectRole }])

  // Đổi vai trò trên dòng CHƯA được tick cũng tick luôn: ảnh vẽ ô vai trò trên MỌI dòng, nên một
  // select bị tắt khi chưa chọn là control chết; "chọn vai trò cho người này" rõ nghĩa hơn.
  const setRole = (person: Person, role: string): void =>
    setSelected(list => isSelected(person)
      ? list.map(item => item.person.id === person.id ? { ...item, role } : item)
      : [...list, { person, role }])

  // Preview CSV độc lập với scene 3D; lỗi định dạng được hiện ngay trong bước import.
  const onPickFile = (files: FileList | null): void => {
    const picked = files?.[0]
    if (!picked) return
    if (!/\.csv$/i.test(picked.name)) {
      setError(`“${picked.name}” không phải .csv. Frame này chỉ đọc CSV — Parquet/Excel/JSON thuộc module Dataset.`)
      return
    }
    if (picked.size > 50 * 1024 * 1024) { setFile(null); setError('Tệp CSV tối đa 50 MB.'); return }
    setFileSaving(true)
    void picked.arrayBuffer()
      .then(buffer => { if (buffer.byteLength > 50 * 1024 * 1024) throw new Error('Tệp CSV tối đa 50 MB.'); return parseLocalCsv(new TextDecoder('utf-8', { fatal: true }).decode(buffer)) })
      .then(async doc => {
        const draft = await uploadDrafts.save({
          workspaceId, projectName: name.trim(), projectDescription: description,
          selectedMembers: wizardMembers(), file: picked,
        })
        setFile({
          draftId: draft.id,
          ...(draft.fileHash ? { fileHash: draft.fileHash } : {}),
          status: draft.status,
          sizeBytes: draft.sizeBytes,
          file: picked,
          fileName: picked.name,
          format: 'CSV',
          rows: doc.rows.length,
          columns: doc.headers.length,
          sizeMb: Number((picked.size / (1024 * 1024)).toFixed(2)),
          delimiter: doc.delimiter,
        })
        setError(null)
      })
      .catch((reason: unknown) => {
        setFile(null)
        setError(reason instanceof Error
          ? reason.message
          : `Không đọc được “${picked.name}”. Kiểm tra tệp còn nguyên và lưu bằng UTF-8.`)
      })
      .finally(() => setFileSaving(false))
  }

  const restoreDraft = async (draft: UploadDraft): Promise<void> => {
    if (!draft.workspaceId || !draft.projectName) { setError('Bản nháp chưa có Workspace hoặc tên project. Chọn lại tệp trong wizard hiện tại.'); return }
    setError(null)
    setFileSaving(true)
    try {
      const selectedMembers = (draft.selectedMembers ?? []).map(member => ({
        person: { id: member.id, name: member.name, email: member.email, initials: member.name.slice(0, 2).toUpperCase(), role: member.role },
        role: member.role,
      }))
      const base = {
        draftId: draft.id, ...(draft.fileHash ? { fileHash: draft.fileHash } : {}), status: draft.status, sizeBytes: draft.sizeBytes,
        fileName: draft.fileName, format: 'CSV' as const, rows: 0, columns: 0,
        sizeMb: Number((draft.sizeBytes / (1024 * 1024)).toFixed(2)), delimiter: ',',
      }
      if (draft.status === 'uploaded') {
        setFile(base)
      } else {
        const restored = await uploadDrafts.restoreFile(draft.id)
        const buffer = await restored.arrayBuffer()
        if (buffer.byteLength > 50 * 1024 * 1024) throw new Error('Tệp CSV tối đa 50 MB.')
        const doc = await parseLocalCsv(new TextDecoder('utf-8', { fatal: true }).decode(buffer))
        setFile({ ...base, file: restored, rows: doc.rows.length, columns: doc.headers.length, delimiter: doc.delimiter })
      }
      setWorkspaceId(draft.workspaceId)
      setName(draft.projectName)
      setDescription(draft.projectDescription ?? '')
      setSelected(selectedMembers)
      setSearch('')
      setStep(draft.projectId ? 2 : 1)
      setPreviousStep(draft.projectId ? 1 : 0)
      setRosterResult(undefined)
      if (fileInputRef.current) fileInputRef.current.value = ''
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Không khôi phục được bản nháp.')
    } finally { setFileSaving(false) }
  }

  const dropFile = (): void => {
    setFile(null)
    // Reset cả input: chọn lại đúng tệp cũ mà input vẫn giữ giá trị thì trình duyệt không bắn
    // change, và người dùng sẽ tưởng nút "Bỏ tệp" không có tác dụng.
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const submit = async (): Promise<void> => {
    if (pending) return
    if (!workspace || !file) return
    setPending(true)
    try {
      await uploadDrafts.updateWizardMetadata(file.draftId, {
        workspaceId: workspace.id, projectName: name.trim(), projectDescription: description,
        selectedMembers: wizardMembers(),
      })
    } catch (reason) {
      setPending(false)
      setError(reason instanceof Error ? reason.message : 'Không thể lưu thông tin wizard vào bản nháp.')
      return
    }
    const success = await session.createProject({
      workspaceId: workspace.id,
      name: name.trim(),
      description: description.trim(),
      members: selected.map(item => ({ ...item.person, role: item.role })),
      uploadDraftId: file.draftId,
      dataset: {
        ...(file.file ? { file: file.file } : {}),
        ...(file.fileHash ? { fileHash: file.fileHash } : {}),
        fileName: file.fileName,
        format: file.format,
        rows: file.rows,
        columns: file.columns,
        sizeMb: file.sizeMb,
        sizeBytes: file.sizeBytes,
      },
    }, setError)
    const latestDraft = (await uploadDrafts.refresh()).find(draft => draft.id === file.draftId)
    if (latestDraft) setFile(current => current?.draftId === latestDraft.id ? { ...current, status: latestDraft.status } : current)
    setPending(false)
    if (!success) return
    setCreatedName(name.trim())
    setStep(steps.length)
  }

  // Ràng buộc của TỪNG bước dồn về một chỗ để nút "Tiếp theo" không bao giờ đưa người dùng sang
  // một màn mà họ rồi không quay lại được.
  const goToStep = (next: number): boolean => {
    if (pending || fileSaving || next === step || next < 0 || next >= steps.length) return false
    if (activeDraft?.projectId && next < 2) {
      setError('Project server đã được tạo và gắn với bản nháp; tiếp tục hoàn thiện thành viên, không quay lại tạo project khác.')
      return false
    }
    if (next > step && next > step + 1) return false
    if (next > step && step === 0) {
      if (!workspace) { setError('Chọn Workspace sẽ chứa project này trước đã.'); return false }
      if (!name.trim()) { setError('Tên project không được để trống.'); return false }
    }
    if (next > step && step === 1 && !file) {
      setError('Mỗi project phải gắn với một tập dữ liệu ngay khi tạo — hãy chọn tệp .csv.')
      return false
    }
    setError(null)
    setRestoreWorkspaceFocus(false)
    setPreviousStep(step)
    setStep(next)
    return true
  }

  const goNext = (): void => {
    if (step < steps.length - 1) { goToStep(step + 1); return }
    setError(null)
    void submit()
  }

  const reset = (): void => {
    setStep(0); setPreviousStep(0); setRestoreWorkspaceFocus(false); setName(''); setDescription(''); setSelected([]); setSearch('')
    setFile(null); setError(null); setCreatedName('')
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  // "Xem Project" = điều hướng thật tới project vừa tạo. createProject là optimistic nên bản ghi
  // đã nằm trong store; tìm lại theo (workspace + tên) để lấy id — không bịa id.
  const viewProject = (): void => {
    const selectedProject = session.state.projects.find(item => item.id === session.state.selection.projectId)
    const created = selectedProject?.workspaceId === workspaceId && selectedProject.name === createdName ? selectedProject : session.state.projects.find(item =>
      item.workspaceId === workspaceId && item.name === createdName)
    if (created) session.run('open', { kind: 'project', id: created.id, name: created.name })
    else onClose()
  }

  if (creatingWorkspace) return <WorkspaceCreateDialog existingNames={session.state.workspaces.map(item => item.name)}
    onClose={closeWorkspaceCreation} onUseWorkspace={id => {
      selectWorkspace(id)
      closeWorkspaceCreation()
    }} />

  return <Dialog open onClose={onClose} busy={pending || fileSaving} className="is-wide" role="dialog" aria-labelledby="pv-wizard-title">
    <header className="dialog-head">
      <span className="dialog-head-icon" aria-hidden="true"><PreviewIcon name="projects" /></span>
      <div className="dialog-head-text">
        <h2 id="pv-wizard-title">Tạo Project</h2>
        <p>{workspace ? `Trong Workspace “${workspace.name}”.` : 'Chọn Workspace chứa Project ở bước Thông tin Project.'}</p>
      </div>
      <button type="button" className="icon-button dialog-close" aria-label="Đóng hộp thoại" disabled={pending || fileSaving} onClick={onClose}>
        <PreviewIcon name="close" />
      </button>
    </header>

    {step === 0 && !file && uploadDrafts.drafts.length > 0 && <section className="pv-import-step" aria-label="Bản nháp wizard đã lưu">
      <strong>Tiếp tục bản nháp đã lưu trên thiết bị</strong>
      <ul>
        {uploadDrafts.drafts.map(draft => <li key={draft.id}>
          <span>{draft.projectName ?? 'Project chưa đặt tên'} · {draft.fileName} · {draft.status === 'uploaded' ? 'Dataset đã được xác nhận' : draft.projectId ? 'Đã có project server, tiếp tục wizard' : draft.status === 'queued' ? 'Đang chờ queue' : draft.status === 'uploading' ? 'Upload chưa rõ kết quả' : draft.status === 'acknowledged' ? 'Đã nhận ACK, chờ xác minh' : 'Bản nháp chưa upload'}</span>{' '}
          <button type="button" className="button-secondary" disabled={pending || fileSaving} onClick={() => { void restoreDraft(draft) }}>Khôi phục</button>{' '}
          <button type="button" className="button-secondary" disabled={pending || fileSaving || ['queued', 'uploading', 'acknowledged'].includes(draft.status)} onClick={() => {
            void uploadDrafts.remove(draft.id).catch(reason => setError(reason instanceof Error ? reason.message : 'Không xóa được bản nháp.'))
          }}>Xóa</button>
        </li>)}
      </ul>
      {uploadDrafts.error && <p role="alert">{uploadDrafts.error}</p>}
    </section>}

    {!isDone && <ProjectSteps labels={steps} step={step} previousStep={previousStep} pending={pending || fileSaving} onStep={goToStep} />}
    {(pending || isDone) && <CreationOrbit completed={isDone}
      label={isDone ? 'Tạo Project thành công!' : 'Đang tạo Project…'} />}

    {isDone ? <div className="pv-wizard-success">
      <p className={creationStyles['creationSummary']}>Project “{createdName}” đã được thêm vào Workspace “{workspace?.name ?? ''}” cùng {selected.length + 1} thành viên (gồm chủ sở hữu) và tập dữ liệu “{file?.fileName ?? ''}”.</p>
      <footer className={`dialog-actions ${creationStyles['creationActions']}`}>
        <button type="button" className="button-secondary" onClick={reset}>Tạo Project khác</button>
        <button type="button" className="button-primary" onClick={viewProject}><PreviewIcon name="arrow" /> Xem Project</button>
      </footer>
    </div> : <>
      {!pending && <div className="pv-wizard-body">
        {step === 0 && <div className="ws-edit-fields">
          {!initialWorkspaceId && <div className="ws-edit-field">
            <ProjectWorkspacePicker workspaces={session.state.workspaces.filter(item => item.canManage !== false)}
              workspaceId={workspaceId} invalid={error !== null && !workspaceId} restoreFocus={restoreWorkspaceFocus}
              onSelect={selectWorkspace} onCreate={() => setCreatingWorkspace(true)} />
          </div>}
          <div className="ws-edit-field">
            <label className="dialog-field">
              <span>Tên Project <em className="field-required" aria-hidden="true">*</em></span>
              <input value={name} onChange={event => { setName(event.target.value); setError(null) }}
                maxLength={nameMax} placeholder="VD: Phân tích churn quý 4" autoComplete="off"
                aria-invalid={error ? 'true' : undefined} aria-describedby={error ? 'pv-wizard-error' : undefined} />
            </label>
            <span className="dialog-counter">{name.length} / {nameMax}</span>
          </div>
          <div className="ws-edit-field">
            <label className="dialog-field">
              <span>Mô tả</span>
              <textarea value={description} onChange={event => setDescription(event.target.value)}
                maxLength={descMax} rows={3} placeholder="Mục tiêu và phạm vi của project…" />
            </label>
            <span className="dialog-counter">{description.length} / {descMax}</span>
          </div>
        </div>}

        {step === 1 && <div className="pv-import-step">
          <span className="pv-step-hint">Mỗi project gắn với đúng một tập dữ liệu, nên phải nạp ngay khi tạo. Tệp được đọc trên máy bạn để lấy số hàng · số cột · dung lượng thật.</span>
          {file === null
            ? <label className="dropzone">
              <input ref={fileInputRef} type="file" className="visually-hidden" accept=".csv,text/csv" disabled={fileSaving}
                aria-label="Chọn tập dữ liệu CSV" onChange={event => onPickFile(event.target.files)} />
              <span className="dropzone-text">{fileSaving ? 'Đang đọc và lưu bản nháp…' : <>Kéo tệp vào đây hoặc <span className="dropzone-pick">Chọn tệp</span></>}</span>
              <small>Hỗ trợ .CSV · dòng đầu tiên phải là tiêu đề cột</small>
            </label>
            : <>
              <div className="attachment">
                <span className="attachment-name"><PreviewIcon name="file" /> {file.fileName} ({formatDataSize(file.sizeMb)})</span>
                <button type="button" className="icon-button sm" aria-label="Bỏ tệp đã chọn" onClick={dropFile}>
                  <PreviewIcon name="close" />
                </button>
              </div>
              <dl className="pv-import-shape">
                {file.status !== 'uploaded' && <><div><dt>Số bản ghi</dt><dd>{formatRows(file.rows)}</dd></div>
                <div><dt>Số cột</dt><dd>{file.columns}</dd></div>
                <div><dt>Tệp</dt><dd>{file.format} · phân tách bằng {delimiterLabel(file.delimiter)}</dd></div></>}
                <div><dt>Dung lượng</dt><dd>{formatDataSize(file.sizeMb)}</dd></div>
              </dl>
              <p className="panel-sub">{file.status === 'uploaded' ? 'Máy chủ đã xác nhận dataset; file nháp đã được dọn.' : 'File đã lưu bản nháp trên thiết bị; chưa được upload lên server.'}</p>
            </>}
        </div>}

        {step === 2 && workspace && <div className="pv-members-step">
          <span className="pv-step-hint">Thêm thành viên vào Project. Chọn thành viên từ Workspace “{workspace.name}” ({workspace.members} thành viên) — chủ sở hữu luôn thuộc project.</span>
          <div className="pv-member-split">
            <div className="pv-member-pick-col">
              {selected.length > 0 && <ul className="pv-selected-chips">
                {selected.map(item => <li key={item.person.id} className="pv-chip is-on">
                  <Avatar initials={item.person.initials} size="sm" />
                  <span className="pv-chip-text"><span className="pv-chip-name">{item.person.name}</span><span className="pv-chip-email">{item.role}</span></span>
                  <button type="button" className="pv-chip-remove" aria-label={`Gỡ ${item.person.name} khỏi project`}
                    onClick={() => togglePerson(item.person)}>
                    <PreviewIcon name="close" />
                  </button>
                </li>)}
              </ul>}
              <label className="members-search">
                <span className="visually-hidden">Tìm kiếm thành viên trong Workspace</span>
                <PreviewIcon name="search" />
                <input value={search} onChange={event => setSearch(event.target.value)}
                  placeholder="Tìm kiếm thành viên trong Workspace…" autoComplete="off" />
              </label>
              {candidates.length > 0 && <ul className="pv-suggest-list pv-member-rows">
                {candidates.map(person => {
                  const picked = selected.find(item => item.person.id === person.id)
                  return <li key={person.id} className="pv-suggest-row">
                    <label className="pv-member-pick">
                      <input type="checkbox" className="pv-member-check" checked={picked !== undefined}
                        aria-label={`Chọn ${person.name} vào project`} onChange={() => togglePerson(person)} />
                      <Avatar initials={person.initials} size="sm" />
                      <span className="pv-chip-text"><span className="pv-chip-name">{person.name}</span><span className="pv-chip-email">{emailForPerson(person)}</span></span>
                    </label>
                    <label className="chip-select inline">
                      <span className="visually-hidden">Vai trò của {person.name} trong project</span>
                      <select value={picked?.role ?? defaultProjectRole} onChange={event => setRole(person, event.target.value)}>
                        {projectRoleOptions.filter(role => session.state.source !== 'api' || role !== 'Admin').map(option => <option key={option} value={option}>{option}</option>)}
                      </select>
                    </label>
                  </li>
                })}
              </ul>}
              {loadProjectWizardRoster && !currentRoster?.members
                ? currentRoster
                  ? <p role="alert">Không tải được thành viên Workspace. <button type="button" onClick={() => setRosterAttempt(value => value + 1)}>Thử lại</button></p>
                  : <p role="status">Đang tải thành viên Workspace…</p>
                : candidates.length === 0 && <p className="panel-sub">{roster.length === 0
                ? 'Workspace này chưa có thành viên nào ngoài chủ sở hữu — thêm người trong “Quản lý thành viên” rồi quay lại bước này.'
                : `Không có thành viên nào của Workspace khớp “${search.trim()}”.`}</p>}
            </div>
            {/* Ba gạch đầu dòng ảnh vẽ bên phải danh sách. Chúng là MÔ TẢ quy tắc (hệ đang
                  enforced: nguồn list đúng là roster), không phải lối tắt thành một ô checkbox. */}
            <div className="pv-member-notes">
              <span className="pv-member-notes-icon" aria-hidden="true"><PreviewIcon name="info" /></span>
              <ul>{memberStepNotes.map(note => <li key={note}>{note}</li>)}</ul>
            </div>
          </div>
        </div>}

        {step === 3 && <dl className="ws-edit-info pv-review">
          <div><dt>Tên Project</dt><dd>{name.trim() || '—'}</dd></div>
          <div><dt>Workspace</dt><dd>{workspace?.name ?? '—'}</dd></div>
          <div><dt>Mô tả</dt><dd>{description.trim() || 'Chưa có mô tả'}</dd></div>
          <div><dt>Tập dữ liệu</dt>
            <dd>{file
              ? file.status === 'uploaded' ? `${file.fileName} · dataset đã xác nhận trên server · ${formatDataSize(file.sizeMb)}` : `${file.fileName} · ${file.format} · ${formatRows(file.rows)} bản ghi · ${file.columns} cột · ${formatDataSize(file.sizeMb)}`
              : '—'}</dd></div>
          <div><dt>Thành viên</dt>
            <dd><span className="pv-review-member"><Avatar initials={workspace?.owner.initials ?? ''} size="sm" /> {workspace?.owner.name ?? '—'} <em className="pv-review-owner-tag">(chủ sở hữu)</em></span>
              {selected.map(item => <span key={item.person.id} className="pv-review-member"><Avatar initials={item.person.initials} size="sm" /> {item.person.name} <em className="pv-review-owner-tag">({item.role})</em></span>)}</dd></div>
        </dl>}
      </div>}

      {error && <p className="dialog-error" id="pv-wizard-error" role="alert">{error}</p>}
      <footer className={`dialog-actions pv-wizard-foot ${creationStyles['creationActions']}`}>
        <button type="button" className="button-secondary" disabled={pending || fileSaving} onClick={onClose}>Hủy</button>
        <div className={`pv-wizard-nav ${creationStyles['creationActions']}`}>
          {step > 0 && <button type="button" className="button-secondary" disabled={pending || fileSaving} onClick={() => { goToStep(step - 1) }}>Quay lại</button>}
          <button type="button" className="button-primary" disabled={pending || fileSaving} onClick={goNext}>
            {step === steps.length - 1
              ? pending ? 'Đang tạo Project…' : <><PreviewIcon name="check" /> Tạo Project</>
              : <>Tiếp theo <PreviewIcon name="chevron" /></>}
          </button>
        </div>
      </footer>
    </>}
  </Dialog>
}
