import { useRef, useState } from 'react'
import type { KeyboardEvent, MouseEvent } from 'react'
import type { Person } from '../../../types/preview/preview.types'
import { personFromEmail } from '../preview-data'
import { PreviewIcon } from './preview-icons'
import { useDialogFocus } from './preview-surface'
import { Avatar } from './preview-shell'
import { CoverArt } from './preview-primitives'
import { usePreviewSession } from '../preview-session-context'

// Khung 2 + 3 của ảnh "DataVerse Workspace Creation with Email Suggestions": form nhập
// thông tin (tên · mô tả · thành viên ban đầu) rồi MÀN HÌNH THÀNH CÔNG.
// Nút "Tạo Workspace" ở đầu trang Workspaces từng tắt; mở ra đây là đường duy nhất nó có.
//
// KHÁC ẢNH, THEO YÊU CẦU CHỦ BATCH 03/11: ảnh vẽ một danh sách GỢI Ý người có sẵn dưới ô nhập,
// còn chủ batch muốn "chỗ thêm thành viên chỉ được điền bằng email chứ không gợi ý thành viên
// có sẵn". Ở đây gõ email → hiện đúng email đó trong danh sách chip đã chọn, không có ô nào liệt
// kê danh bạ mẫu. Lý do nghiệp vụ đằng sau cũng cùng phía: workspace mới là ranh giới truy cập
// riêng, lời mời phải nhắm tới một địa chỉ cụ thể chứ không phải chọn bừa một người trùng tên.
//
// Không có bước trung gian nào ngoài đúng những gì ảnh vẽ: thêm một tab "nâng cao" hay ô
// chọn màu/logo (mock không vẽ) là thêm module không có giá trị.
//
// Mọi ghi ở đây là optimistic + Hoàn tác trên toast (cùng khuôn với wizard "Tạo Project") vì bản
// ghi sống trong bộ nhớ tab của khung xem trước — tải lại trang là danh sách về ban đầu. Tên trùng
// bị chặn ngay trong form vì mỗi workspace phải phân biệt được với nhau.

const nameMax = 100
const descMax = 500

// Email phải có dạng thật trước khi được thêm: một dòng "abc" trong danh sách thành viên thì
// không mời được ai, và chip hiện ra sẽ nói dối rằng đã có người nhận lời mời.
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

// Giới hạn của form, nói thẳng một lần ở chân dialog thay vì để người dùng đoán.
const previewNote = 'Mỗi email thêm vào sẽ thành một dòng thành viên của Workspace này; người tạo là chủ sở hữu và luôn thuộc Workspace. '
  + 'Workspace vừa tạo chưa chứa project nào — muốn làm dữ liệu thì tạo project trong chính workspace đó ở trang chi tiết.'

// Bấm nền tối = hủy (đặt trên scrim, tự kiểm target → panel không phải stopPropagation).
const scrimMouseDown = (onClose: () => void) => ({
  onMouseDown: (event: MouseEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget) onClose()
  },
})

// Người được chọn + email hiển thị của họ. Email gõ tay được GIỮ NGUYÊN thay vì bị "khúc"
// về @acmecorp: nói sai dữ liệu của người dùng vẫn là sai, kể cả trong bản mẫu.
type MemberPick = { person: Person; email: string }

// `personFromEmail` suy id từ phần TRƯỚC dấu @, nên hai địa chỉ cùng handle nhưng khác miền
// ('linh@corp.io' và 'linh@corp.vn') sẽ cho ra MỘT id — bảng thành viên sau đó không gỡ riêng
// từng người được. Id ở đây khóa theo CẢ địa chỉ.
const personFromInvitedEmail = (email: string): Person => ({
  ...personFromEmail(email),
  id: `u-${email.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
})

export function WorkspaceCreateDialog({ existingNames, onClose }: {
  existingNames: readonly string[]
  onClose: () => void
}) {
  const session = usePreviewSession()
  const ref = useRef<HTMLDivElement>(null)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [text, setText] = useState('')
  const [selected, setSelected] = useState<MemberPick[]>([])
  const [error, setError] = useState<string | null>(null)
  const [createdName, setCreatedName] = useState('')
  useDialogFocus(ref, onClose)

  const done = createdName !== ''
  const typed = text.trim()
  // Ô trống không "sai", nó chỉ chưa có gì — báo lỗi khi người dùng còn chưa gõ xong chữ @
  // đầu tiên là gióng một tiếng chuông không ai gây ra.
  const emailLooksBroken = typed !== '' && !emailPattern.test(typed)

  const removePerson = (email: string): void =>
    setSelected(list => list.filter(item => item.email !== email))

  // Thêm người = thêm MỘT EMAIL. Không có danh sách gợi ý ai có sẵn bên dưới ô nhập —
  // xem ghi chú đầu file, đây là điểm chủ batch 03/11 yêu cầu khác ảnh mockup.
  const addTyped = (): void => {
    if (!typed) { setError('Nhập email của người bạn muốn thêm vào Workspace.'); return }
    if (!emailPattern.test(typed)) {
      setError(`“${typed}” không phải một địa chỉ email hợp lệ. Dạng đầy đủ gồm phần tên, dấu @ và tên miền (vd: linh.do@corp.io).`)
      return
    }
    if (selected.some(item => item.email.toLowerCase() === typed.toLowerCase())) {
      setError(`${typed} đã có trong danh sách thành viên của Workspace này.`)
      return
    }
    setSelected(list => [...list, { person: personFromInvitedEmail(typed), email: typed }])
    setText('')
    setError(null)
  }

  // Enter = thêm đúng địa chỉ đang gõ, rồi dọn ô nhập để gõ tiếp người kế.
  const onTextKeyDown = (event: KeyboardEvent<HTMLInputElement>): void => {
    if (event.key !== 'Enter') return
    event.preventDefault()
    addTyped()
  }

  const submit = (): void => {
    const trimmed = name.trim()
    if (!trimmed) { setError('Tên Workspace không được để trống.'); return }
    const clash = existingNames.find(item => item.toLowerCase() === trimmed.toLowerCase())
    if (clash) { setError(`Đã có Workspace “${clash}” trùng tên này. Tên workspace phải phân biệt được với nhau.`); return }
    session.createWorkspace({ name: trimmed, description: description.trim(), members: selected.map(item => item.person) })
    setCreatedName(trimmed)
    setError(null)
  }

  const reset = (): void => {
    setName(''); setDescription(''); setText(''); setSelected([])
    setError(null); setCreatedName('')
  }

  // "Xem Workspace" = điều hướng THẬT tới bản ghi vừa tạo. createWorkspace là optimistic nên
  // nó đã nằm trong store; tìm lại theo tên để lấy id thay vì bịa id.
  const viewWorkspace = (): void => {
    const created = session.state.workspaces.find(item => item.name === createdName)
    if (created) session.run('open', { kind: 'workspace', id: created.id, name: created.name })
    // LUÔN đóng, kể cả khi không tìm lại được bản ghi: `creating` là state của danh sách chứ
    // không phải của dialog, nên để nó bật thì quay về trang Workspaces là modal tự mở lại và
    // scrim phủ lên chặn hết trang.
    onClose()
  }

  return <div className="preview-dialog-scrim" {...scrimMouseDown(onClose)}>
    <div ref={ref} className="preview-dialog is-wide" role="dialog" aria-modal="true" aria-labelledby="pv-create-title">
      <header className="dialog-head">
        <span className="dialog-head-icon" aria-hidden="true"><PreviewIcon name="workspaces" /></span>
        <div className="dialog-head-text">
          <h2 id="pv-create-title">Tạo Workspace</h2>
          {!done && <p>Workspace mới là một ranh giới truy cập riêng, chứa project · tập dữ liệu · thành viên của nó.</p>}
        </div>
        <button type="button" className="icon-button dialog-close" aria-label="Đóng hộp thoại" onClick={onClose}>
          <PreviewIcon name="close" />
        </button>
      </header>

      {done ? <div className="pv-wizard-success">
        <span className="pv-success-icon" aria-hidden="true"><PreviewIcon name="check" /></span>
        <h3>Tạo Workspace thành công!</h3>
        <p>Workspace “{createdName}” đã được tạo và sẵn sàng sử dụng, với {selected.length + 1} thành viên (gồm chủ sở hữu).</p>
        <p className="dialog-note">Bản ghi sống trong bộ nhớ tab của trình duyệt nên tải lại trang là danh sách về ban đầu; toast vừa rồi luôn có Hoàn tác. {previewNote}</p>
        <footer className="dialog-actions">
          <button type="button" className="button-secondary" onClick={reset}>Tạo Workspace khác</button>
          <button type="button" className="button-primary" onClick={viewWorkspace}><PreviewIcon name="arrow" /> Xem Workspace</button>
        </footer>
      </div> : <>
        <div className="pv-create-grid">
          <aside className="pv-create-aside" aria-hidden="true">
            <span className="pv-create-art"><CoverArt hue="blue" seed={5} /></span>
            <p>Tạo một Workspace mới để nhóm hóa Projects, quản lý thành viên và cộng tác hiệu quả.</p>
          </aside>

          <div className="ws-edit-fields">
            <div className="ws-edit-field">
              <label className="dialog-field">
                <span>Tên Workspace <em className="field-required" aria-hidden="true">*</em></span>
                <input value={name} onChange={event => { setName(event.target.value); setError(null) }}
                  maxLength={nameMax} placeholder="VD: Product Analytics" autoComplete="off"
                  aria-invalid={error && !name.trim() ? 'true' : undefined} aria-describedby={error ? 'pv-create-error' : undefined} />
              </label>
              <span className="dialog-counter">{name.length} / {nameMax}</span>
            </div>

            <div className="ws-edit-field">
              <label className="dialog-field">
                <span>Mô tả</span>
                <textarea value={description} onChange={event => setDescription(event.target.value)}
                  maxLength={descMax} rows={3} placeholder="Workspace này dùng để làm gì…" />
              </label>
              <span className="dialog-counter">{description.length} / {descMax}</span>
            </div>

            <div className="ws-edit-field">
              <span className="dialog-field-label" id="pv-create-members-label">Thành viên ban đầu (tùy chọn)</span>
              <div className="pv-people-box">
                <ul className="pv-selected-chips">
                  {selected.map(item => <li key={item.email} className="pv-chip is-on">
                    <Avatar initials={item.person.initials} size="sm" />
                    <span className="pv-chip-text"><span className="pv-chip-name">{item.person.name}</span><span className="pv-chip-email">{item.email}</span></span>
                    <button type="button" className="pv-chip-remove" aria-label={`Gỡ ${item.email} khỏi Workspace`}
                      onClick={() => removePerson(item.email)}>
                      <PreviewIcon name="close" />
                    </button>
                  </li>)}
                </ul>
                {/* Chỉ MỘT ô nhập email, không có ô tìm người có sẵn. Vòng focus của cả hộp
                    do `:focus-within` trong CSS lo — state `listOpen` cũ chỉ để bật vòng focus
                    cho danh sách gợi ý, và danh sách đó đã bị gỡ theo yêu cầu 03/11. */}
                <input value={text} onChange={event => { setText(event.target.value); setError(null) }}
                  onKeyDown={onTextKeyDown} aria-labelledby="pv-create-members-label"
                  placeholder={selected.length ? 'Thêm email khác…' : 'Nhập email thành viên…'}
                  autoComplete="off" inputMode="email"
                  aria-invalid={emailLooksBroken ? 'true' : undefined}
                  aria-describedby={error ? 'pv-create-error' : undefined} />
                <button type="button" className="button-secondary pv-people-add" onClick={addTyped}>
                  <PreviewIcon name="plus" /> Thêm
                </button>
              </div>
              <span className="dialog-counter">{selected.length === 0
                ? 'Chưa thêm ai — chủ sở hữu luôn thuộc Workspace này.'
                : `Đã thêm ${selected.length} email`}</span>
            </div>
          </div>
        </div>

        {error && <p className="dialog-error" id="pv-create-error" role="alert">{error}</p>}
        <p className="dialog-note">{previewNote}</p>
        <footer className="dialog-actions pv-wizard-foot">
          <button type="button" className="button-secondary" onClick={onClose}>Hủy</button>
          <button type="button" className="button-primary" onClick={submit}><PreviewIcon name="plus" /> Tạo Workspace</button>
        </footer>
      </>}
    </div>
  </div>
}
