import { useRef, useState } from 'react'
import type { MouseEvent } from 'react'
import type { DatasetSummary, Person } from '../../../types/preview/preview.types'
import { defaultProjectRole, emailForPerson, formatDataSize, formatRows, projectRoleOptions } from '../preview-data'
import { parseLocalCsv } from '../../../math/workspace-3d/local-csv'
import { PreviewIcon } from './preview-icons'
import { useDialogFocus } from './preview-surface'
import { Avatar } from './preview-shell'
import { usePreviewSession } from '../preview-session-context'

// Wizard "Tạo Project" 4 bước. BỐN BƯỚC và nhãn của chúng lấy nguyên từ ảnh
// "a_detailed_high_fidelity_ui_screenshot_of_the_sam":
//   1 Thông tin Project · 2 Import Dataset · 3 Thành viên · 4 Xác nhận.
//
// BƯỚC 2 ĐÃ ĐỔI THEO CHỦ BATCH 03/11: "mỗi project phải gắn liền với 1 dataset ngay từ đầu".
// Không còn lựa chọn "tạo project trống" — bước này bắt buộc chọn một tệp .csv trên máy, và số
// liệu hiển thị là SỐ THẬT: parseLocalCsv đếm hàng/cột từ chính nội dung tệp, dung lượng lấy từ
// file.size. Frame không "tải" tệp đi đâu cả (không có endpoint nào để gửi tới), nên bản ghi mới
// mang status 'queued' chứ không nói dối rằng đã xử lý xong.
//
// BƯỚC 3 LÀ ĐIỀU CHỦ BATCH NHẮC LẠI, VÀ NÓ LÀ MỘT BẤT BIẾN NGHIỆP VỤ: chỉ thành viên ĐÃ thuộc
// Workspace mới được chủ sở hữu chọn vào một project trong workspace đó. Vì thế nguồn list ở đây
// là roster của chính workspace (memberPreview), KHÔNG phải danh bạ toàn cục, và ô nhập email để
// thêm người ngoài đã BỊ GỠ — nó đúng ba gạch đầu dòng ảnh vẽ ngay bên phải danh sách.
//
// Wizard là surface CẤP PHIÊN (render một lần trong PreviewSessionProvider) vì nó có hai lối vào:
// "+ Tạo Project" trong trang chi tiết workspace (đã biết workspace) và "Tạo project" ở trang
// Projects — nơi phạm vi có thể là "mọi không gian", lúc đó bước 1 hiện ô chọn Workspace bắt buộc
// thay vì giấu project vào một workspace vô hình.

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
const scrimMouseDown = (onClose: () => void) => ({
  onMouseDown: (event: MouseEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget) onClose()
  },
})

// Một dòng chọn thành viên: Person (đi vào project) + vai trò gán cho project đó. Vai trò nằm
// trong Person.role — project.members là Person[] nên không cần bảng phụ thứ hai.
type MemberPick = { person: Person; role: string }

// Những gì đọc được từ tệp người dùng vừa chọn. `rows`/`columns` là số ĐO TỪ NỘI DUNG, không phải
// con số viết tay; `delimiter` chỉ dùng để nói cho người dùng biết parser tự nhận ký tự gì.
type PickedCsv = {
  fileName: string
  format: DatasetSummary['format']
  rows: number
  columns: number
  sizeMb: number
  delimiter: string
}

const delimiterLabel = (delimiter: string): string =>
  delimiter === '\t' ? 'Tab' : delimiter === ';' ? 'Dấu chấm phẩy' : 'Dấu phẩy'

export function ProjectWizard({ initialWorkspaceId, onClose }: {
  initialWorkspaceId: string | null
  onClose: () => void
}) {
  const session = usePreviewSession()
  const ref = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [step, setStep] = useState(0)
  const [workspaceId, setWorkspaceId] = useState(initialWorkspaceId ?? '')
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [file, setFile] = useState<PickedCsv | null>(null)
  const [selected, setSelected] = useState<MemberPick[]>([])
  const [search, setSearch] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [createdName, setCreatedName] = useState('')
  useDialogFocus(ref, onClose)

  // Wizard mở từ trang Projects khi chưa chọn không gian nào thì người dùng PHẢI chỉ định nơi
  // chứa project ở bước 1; các bước sau luôn có workspace thật để đọc roster.
  const workspace = session.state.workspaces.find(item => item.id === workspaceId) ?? null

  // Roster của workspace = chủ sở hữu + memberPreview. Chủ sở hữu KHÔNG nằm trong danh sách chọn:
  // ảnh ghi "Chủ sở hữu luôn thuộc project" nên để họ tự tick là một dòng bỏ đi, và project đã
  // mang owner là người dùng hiện tại trong store.
  const roster = workspace?.memberPreview.filter(person => person.id !== workspace.owner.id) ?? []
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

  // Đọc tệp THẬT trên máy: cùng bộ parse mà trang 3D dùng (math/workspace-3d/local-csv) nên hai
  // nơi nói cùng một tiếng về cùng một định dạng. Mọi lỗi parse/trình giải mã đều đưa thẳng vào
  // dải lỗi của bước — hiện tượng thường gặp nhất là tệp ISO-8859-1/UTF-16 không giải mã được.
  const onPickFile = (files: FileList | null): void => {
    const picked = files?.[0]
    if (!picked) return
    if (!/\.csv$/i.test(picked.name)) {
      setError(`“${picked.name}” không phải .csv. Frame này chỉ đọc CSV — Parquet/Excel/JSON thuộc module Dataset.`)
      return
    }
    void picked.arrayBuffer()
      .then(buffer => parseLocalCsv(new TextDecoder('utf-8', { fatal: true }).decode(buffer)))
      .then(doc => {
        setFile({
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
  }

  const dropFile = (): void => {
    setFile(null)
    // Reset cả input: chọn lại đúng tệp cũ mà input vẫn giữ giá trị thì trình duyệt không bắn
    // change, và người dùng sẽ tưởng nút "Bỏ tệp" không có tác dụng.
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const submit = (): void => {
    if (!workspace || !file) return
    session.createProject({
      workspaceId: workspace.id,
      name: name.trim(),
      description: description.trim(),
      members: selected.map(item => ({ ...item.person, role: item.role })),
      dataset: {
        fileName: file.fileName,
        format: file.format,
        rows: file.rows,
        columns: file.columns,
        sizeMb: file.sizeMb,
      },
    })
    setCreatedName(name.trim())
    setStep(steps.length)
  }

  // Ràng buộc của TỪNG bước dồn về một chỗ để nút "Tiếp theo" không bao giờ đưa người dùng sang
  // một màn mà họ rồi không quay lại được.
  const goNext = (): void => {
    if (step === 0) {
      if (!workspace) { setError('Chọn Workspace sẽ chứa project này trước đã.'); return }
      if (!name.trim()) { setError('Tên project không được để trống.'); return }
    }
    if (step === 1 && !file) {
      setError('Mỗi project phải gắn với một tập dữ liệu ngay khi tạo — hãy chọn tệp .csv.')
      return
    }
    setError(null)
    if (step === steps.length - 1) submit()
    else setStep(value => value + 1)
  }

  const reset = (): void => {
    setStep(0); setName(''); setDescription(''); setSelected([]); setSearch('')
    setFile(null); setError(null); setCreatedName('')
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  // "Xem Project" = điều hướng thật tới project vừa tạo. createProject là optimistic nên bản ghi
  // đã nằm trong store; tìm lại theo (workspace + tên) để lấy id — không bịa id.
  const viewProject = (): void => {
    const created = session.state.projects.find(item =>
      item.workspaceId === workspaceId && item.name === createdName)
    if (created) session.run('open', { kind: 'project', id: created.id, name: created.name })
    else onClose()
  }

  return <div className="preview-dialog-scrim" {...scrimMouseDown(onClose)}>
    <div ref={ref} className="preview-dialog is-wide" role="dialog" aria-modal="true" aria-labelledby="pv-wizard-title">
      <header className="dialog-head">
        <span className="dialog-head-icon" aria-hidden="true"><PreviewIcon name="projects" /></span>
        <div className="dialog-head-text">
          <h2 id="pv-wizard-title">Tạo Project</h2>
          <p>{workspace ? `Trong Workspace “${workspace.name}”.` : 'Chọn Workspace chứa Project ở bước Thông tin Project.'}</p>
        </div>
        <button type="button" className="icon-button dialog-close" aria-label="Đóng hộp thoại" onClick={onClose}>
          <PreviewIcon name="close" />
        </button>
      </header>

      {!isDone && <ol className="pv-wizard-steps" aria-label="Các bước tạo project">
        {steps.map((label, index) => <li key={label}
          className={`pv-wizard-step${index === step ? ' is-active' : ''}${index < step ? ' is-done' : ''}`}
          aria-current={index === step ? 'step' : undefined}>
          <span className="pv-step-dot" aria-hidden="true">{index < step ? <PreviewIcon name="check" /> : index + 1}</span>
          <span className="pv-step-label">{label}</span>
        </li>)}
      </ol>}

      {isDone ? <div className="pv-wizard-success">
        <span className="pv-success-icon" aria-hidden="true"><PreviewIcon name="check" /></span>
        <h3>Tạo Project thành công!</h3>
        <p>Project “{createdName}” đã được thêm vào Workspace “{workspace?.name ?? ''}” cùng {selected.length + 1} thành viên (gồm chủ sở hữu) và tập dữ liệu “{file?.fileName ?? ''}”.</p>
        <footer className="dialog-actions">
          <button type="button" className="button-secondary" onClick={reset}>Tạo Project khác</button>
          <button type="button" className="button-primary" onClick={viewProject}><PreviewIcon name="arrow" /> Xem Project</button>
        </footer>
      </div> : <>
        <div className="pv-wizard-body">
          {step === 0 && <div className="ws-edit-fields">
            {!initialWorkspaceId && <div className="ws-edit-field">
              <label className="dialog-field">
                <span>Workspace <em className="field-required" aria-hidden="true">*</em></span>
                <select value={workspaceId} onChange={event => { setWorkspaceId(event.target.value); setError(null) }}
                  aria-invalid={error !== null && !workspaceId ? 'true' : undefined}
                  aria-describedby={error && !workspaceId ? 'pv-wizard-error' : undefined}>
                  <option value="">— Chọn Workspace —</option>
                  {session.state.workspaces.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
                </select>
              </label>
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
                <input ref={fileInputRef} type="file" className="visually-hidden" accept=".csv,text/csv"
                  aria-label="Chọn tập dữ liệu CSV" onChange={event => onPickFile(event.target.files)} />
                <span className="dropzone-text">Kéo tệp vào đây hoặc <span className="dropzone-pick">Chọn tệp</span></span>
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
                  <div><dt>Số bản ghi</dt><dd>{formatRows(file.rows)}</dd></div>
                  <div><dt>Số cột</dt><dd>{file.columns}</dd></div>
                  <div><dt>Tệp</dt><dd>{file.format} · phân tách bằng {delimiterLabel(file.delimiter)}</dd></div>
                  <div><dt>Dung lượng</dt><dd>{formatDataSize(file.sizeMb)}</dd></div>
                </dl>
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
                          {projectRoleOptions.map(option => <option key={option} value={option}>{option}</option>)}
                        </select>
                      </label>
                    </li>
                  })}
                </ul>}
                {candidates.length === 0 && <p className="panel-sub">{roster.length === 0
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
                ? `${file.fileName} · ${file.format} · ${formatRows(file.rows)} bản ghi · ${file.columns} cột · ${formatDataSize(file.sizeMb)}`
                : '—'}</dd></div>
            <div><dt>Thành viên</dt>
              <dd><span className="pv-review-member"><Avatar initials={workspace?.owner.initials ?? ''} size="sm" /> {workspace?.owner.name ?? '—'} <em className="pv-review-owner-tag">(chủ sở hữu)</em></span>
                {selected.map(item => <span key={item.person.id} className="pv-review-member"><Avatar initials={item.person.initials} size="sm" /> {item.person.name} <em className="pv-review-owner-tag">({item.role})</em></span>)}</dd></div>
          </dl>}
        </div>

        {error && <p className="dialog-error" id="pv-wizard-error" role="alert">{error}</p>}
        <footer className="dialog-actions pv-wizard-foot">
          <button type="button" className="button-secondary" onClick={onClose}>Hủy</button>
          <div className="pv-wizard-nav">
            {step > 0 && <button type="button" className="button-secondary" onClick={() => { setError(null); setStep(value => Math.max(0, value - 1)) }}>Quay lại</button>}
            <button type="button" className="button-primary" onClick={goNext}>
              {step === steps.length - 1
                ? <><PreviewIcon name="check" /> Tạo Project</>
                : <>Tiếp theo <PreviewIcon name="chevron" /></>}
            </button>
          </div>
        </footer>
      </>}
    </div>
  </div>
}
