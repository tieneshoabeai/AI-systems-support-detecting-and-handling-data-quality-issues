import { useRef, useState } from 'react'
import type { ReactNode } from 'react'
import type { PreviewNotification, PreviewSectionId, PreviewStoreState, SettingsSectionId } from '../../../types/preview/preview.types'
import { accountInfo } from '../preview-data'
import { NotificationCenter } from './notification-center'
import { ReportCenter } from './report-center'
import { PreviewIcon } from './preview-icons'
import { PreviewPopover } from './preview-popover'
import { usePreviewSession } from '../preview-session-context'

// Topbar theo "UI-UX/Global Application Shell" (Design Board + đặc tả.txt dòng 11), thứ tự trái
// sang phải đúng như DOM — (1) toggle sidebar, (2) combobox Workspace, (3) combobox Projects,
// (4) chuông + popover thông báo, (5) báo cáo vấn đề (icon "?"), (6) avatar + dropdown tài khoản.
// Ô tìm kiếm toàn cục của vùng (4) trong đặc tả ĐÃ BỎ theo yêu cầu chủ batch 03/11: việc tìm
// workspace/project thuộc về chính trang chứa danh sách đó (ô tìm trong toolbar), nên một ô nằm
// trên đầu mọi trang tìm thứ mà trang đó không liệt kê.
// Nhãn hai ô phạm vi là "Workspace"/"Projects" (product noun, chủ batch chốt): toàn bộ frame
// gọi hai thứ đó bằng tên Anh ở nav, stat card, thẻ project — một thanh lọc đứng đầu mọi trang
// mà gọi "Không gian"/"Dự án" là tên thứ năm cho cùng một object.
// Chuông và báo cáo cùng một mô hình: bấm vào là NỘI DUNG hiện ra TRONG Ô popover, không điều
// hướng sang trang (đặc tả dòng 5 + 7). Đặc tả dòng 11 nói rõ nút báo cáo lấy icon "?" và KHÔNG
// có nút Trợ giúp riêng — nên glyph "?" (help) nay mở ReportCenter, không còn nút thứ tám nữa.
//
// Hai combobox là khác biệt lớn nhất so với khung cũ: trước đây chúng là <select> tắt vì
// chưa có API. Nay chúng đổi PHẠM VI làm việc thật của frame (danh sách project trên trang
// Projects · trang chi tiết workspace · wizard "Tạo Project"), nên được bật. Bất biến vẫn giữ,
// chỉ đổi cách đạt: control nào không có nghiệp vụ phía sau thì bỏ hẳn khỏi thanh (đăng xuất đã
// ra khỏi menu tài khoản theo cách đó) thay vì để một nút tắt chờ giải thích.

export type ScopeOption = { id: string; label: string; meta?: string }

const allId = ''

// Chọn một KHÔNG GIAN ở topbar trước đây luôn kèm `openSection('projects')`, đo thật trên
// trình duyệt: đang đọc hộp thư mà bấm chip "Data Engineering" là bị đá sang trang Dự án
// (#/preview/notifications → #/preview/projects/ws-dataeng). Cùng một dải, hai hành vi:
// chip Dự án thì chỉ đổi phạm vi tại chỗ (nó gọi run('detail')), chip Không gian thì đổi
// màn hình. Người dùng đọc ô đó là "bộ lọc phạm vi" (đúng phản hồi của user về thanh này)
// nên nó không được quyền đưa đi đâu. Phạm vi vẫn ghi xuống store nên khi mở Dự án bằng
// sidebar, danh sách đã đúng chỗ họ chọn; riêng hai trang mang được phạm vi trong URL
// (projects · workspaces) thì hash vẫn cập nhật, để F5 không mất phạm vi
// mà người dùng đang thấy trên chip. 'home'/'notifications' thì hash giữ nguyên vì hai màn
// đó không có chỗ nào cho workspaceId. Màn hình nào đang hiện là do shell biết (`active`),
// không đoán từ URL: URL do hash router ghi, còn nội dung thật thì shell đang cầm.
const scopeCarryingSections: readonly PreviewSectionId[] = ['projects', 'workspaces']

function PreviewScopeSelect({ label, value, options, onSelect }: {
  label: string
  value: string | null
  options: ScopeOption[]
  onSelect: (id: string) => void
}) {
  const triggerRef = useRef<HTMLButtonElement>(null)
  const [trigger, setTrigger] = useState<HTMLElement | null>(null)
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const selected = options.find(option => option.id === value) ?? null
  const needle = query.trim().toLowerCase()
  const visible = needle ? options.filter(option => option.label.toLowerCase().includes(needle)) : options

  return <>
    <button type="button" ref={triggerRef} className="scope-select" role="combobox" aria-haspopup="listbox"
      aria-expanded={open} aria-label={label}
      onClick={() => { setTrigger(triggerRef.current); setQuery(''); setOpen(current => !current) }}>
      <span className="scope-label">{label}</span>
      <span className="scope-value">{selected?.label ?? 'Chưa chọn'}</span>
      <span className="scope-caret" aria-hidden="true"><PreviewIcon name="chevron-down" /></span>
    </button>

    <PreviewPopover open={open} label={`Chọn ${label.toLowerCase()}`} trigger={trigger} onClose={() => setOpen(false)}>
      <div className="popover-head"><strong>{label}</strong></div>
      <div className="popover-search">
        <span aria-hidden="true"><PreviewIcon name="search" /></span>
        {/* Bấm là gõ tiếp được ngay, không phải click lần nữa vào ô tìm (apple-design mục 1). */}
        <input role="searchbox" aria-label={`Tìm trong ${label.toLowerCase()}`} value={query} autoFocus
          placeholder={`Tìm ${label.toLowerCase()}…`} onChange={event => setQuery(event.target.value)}
          onKeyDown={event => {
            if (event.key !== 'Enter') return
            event.preventDefault()
            const first = visible[0]
            if (first) { onSelect(first.id); setOpen(false) }
          }} />
      </div>
      <div role="listbox" aria-label={label} className="option-list">
        {visible.length === 0
          ? <p className="option-empty">Không có mục nào khớp “{query}”.</p>
          : visible.map(option => <button type="button" role="option" key={option.id}
            aria-selected={option.id === value} className={`option-row${option.id === value ? ' is-current' : ''}`}
            onClick={() => { onSelect(option.id); setOpen(false) }}>
            <span className="option-label">{option.label}</span>
            {/* Số đếm chỉ hiện khi ĐANG TÌM: lúc đó người dùng đang so vài dòng với nhau nên
                "3 dự án" là thông tin quyết định. danh sách đóng thì trang đã hiển thị sẵn các
                con số đó, còn trên trigger nó làm ô phình to (phản hồi của user). */}
            {option.meta && needle && <span className="option-meta">{option.meta}</span>}
            {option.id === value && <span className="option-check" aria-hidden="true"><PreviewIcon name="check" /></span>}
          </button>)}
      </div>
    </PreviewPopover>
  </>
}

// Dropdown chuông là NỘI DUNG, không phải lối vào trang (đặc tả Shell dòng 5). Toàn bộ
// nhóm 01 của Design Board — dropdown nhanh · danh sách có tab/tìm/phân trang · chi tiết —
// chạy trong chính ô popover (xem notification-center.tsx). Bấm chuông không ghi hash nữa.
function TopbarBell({ notifications }: { notifications: PreviewNotification[] }) {
  const triggerRef = useRef<HTMLButtonElement>(null)
  const [trigger, setTrigger] = useState<HTMLElement | null>(null)
  const [open, setOpen] = useState(false)
  const unread = notifications.filter(item => item.unread).length

  return <>
    <button type="button" ref={triggerRef} className="icon-button"
      aria-label={`Thông báo${unread ? ` · ${unread} chưa đọc` : ''}`} aria-expanded={open} aria-haspopup="dialog"
      onClick={() => { setTrigger(triggerRef.current); setOpen(current => !current) }}>
      <PreviewIcon name="bell" />
      {unread > 0 && <span className="badge-dot" aria-hidden="true" />}
    </button>
    <PreviewPopover open={open} label="Thông báo" trigger={trigger} align="end" size="inbox"
      onClose={() => setOpen(false)}>
      <NotificationCenter />
    </PreviewPopover>
  </>
}

// Nút "?" báo cáo vấn đề (đặc tả Shell dòng 7 + 11). Cùng mô hình với chuông: mọi thứ —
// tạo mới · xem danh sách · chi tiết — chạy trong popover, không điều hướng sang trang. Icon
// là "?" theo đúng đặc tả; glyph "?" đã có sẵn (help) nên không thêm icon mới vào bộ dùng chung.
function TopbarReport() {
  const triggerRef = useRef<HTMLButtonElement>(null)
  const [trigger, setTrigger] = useState<HTMLElement | null>(null)
  const [open, setOpen] = useState(false)

  return <>
    <button type="button" ref={triggerRef} className="icon-button"
      aria-label="Báo cáo vấn đề" aria-expanded={open} aria-haspopup="dialog"
      onClick={() => { setTrigger(triggerRef.current); setOpen(current => !current) }}>
      <PreviewIcon name="help" />
    </button>
    <PreviewPopover open={open} label="Báo cáo vấn đề" trigger={trigger} align="end" size="inbox"
      onClose={() => setOpen(false)}>
      <ReportCenter />
    </PreviewPopover>
  </>
}

function TopbarAccount() {
  const session = usePreviewSession()
  const triggerRef = useRef<HTMLButtonElement>(null)
  const [trigger, setTrigger] = useState<HTMLElement | null>(null)
  const [open, setOpen] = useState(false)

  // Design Board 4.1 vẽ ba mục: Hồ sơ cá nhân · Cài đặt tài khoản · Đăng xuất. Hai mục đầu
  // ĐIỀU HƯỚNG sang nhánh Accounts của Settings (đặc tả dòng 9), không chạy "trong ô".
  // Ảnh 4.1 có gắn nhãn "Settings" nhỏ bên hai mục điều hướng — chủ batch yêu cầu BỎ: đích đến
  // đã hiện rõ khi bấm, còn nhãn thì lặp lại tên một trang bên cạnh hai nhãn việc làm.
  // "Đăng xuất" KHÔNG còn trong menu (chủ batch 03/11): khung preview không có phiên đăng nhập
  // thật nào để kết thúc, nên nó là một mục bấm không làm gì — để lại thì phải kèm một dòng
  // giải thích. Hai mục còn lại đều chạy thật.
  // 'Ngôn ngữ"/"Chủ đề" và cả tiện ích dev "Khôi phục dữ liệu mẫu" đều BỎ để khớp ảnh — reset
  // dữ liệu mẫu giờ bằng cách tải lại trang (store là in-memory, F5 về fixtures ban đầu).
  // 'overview' = '#/preview/settings' trần (màn tổng quan). Chủ batch 03/11 hỏi "tại sao bấm
  // Settings hay bấm 'Cài đặt tài khoản' đều nhảy vào Bảo mật": hàng này vốn trỏ thẳng
  // 'security', tức một NHÓM ba mục bị đại diện bởi một màn con tùy chọn. Từ menu, người dùng
  // mới nói "tôi muốn vào cài đặt tài khoản", chưa nói họ muốn mục nào trong ba mục → về tổng
  // quan để họ chọn; rail đã mở sẵn nhóm nên ba mục con hiện ra ngay tại chỗ.
  const rows: readonly { label: string; icon: string; to: SettingsSectionId | 'overview' }[] = [
    { label: 'Hồ sơ cá nhân', icon: 'users', to: 'profile' },
    { label: 'Cài đặt tài khoản', icon: 'settings', to: 'overview' },
  ]

  const runRow = (row: (typeof rows)[number]): void => {
    setOpen(false)
    if (row.to === 'overview') { session.openSection('settings'); return }
    session.openSection('settings', { settingsSection: row.to })
  }

  return <>
    <button type="button" ref={triggerRef} className="topbar-user is-live" aria-haspopup="dialog" aria-expanded={open}
      aria-label={`Tài khoản ${accountInfo.name}`}
      onClick={() => { setTrigger(triggerRef.current); setOpen(current => !current) }}>
      <span className="avatar avatar-md" aria-hidden="true">{accountInfo.initials}</span>
      <span className="user-text"><strong>{accountInfo.name}</strong><small>{accountInfo.role}</small></span>
      <span className="scope-caret" aria-hidden="true"><PreviewIcon name="chevron-down" /></span>
    </button>
    <PreviewPopover open={open} label={`Tài khoản ${accountInfo.name}`} trigger={trigger} align="end" size="lg" onClose={() => setOpen(false)}>
      <div className="account-head">
        <span className="avatar avatar-lg" aria-hidden="true">{accountInfo.initials}</span>
        <span className="account-id"><strong>{accountInfo.name}</strong><small>{accountInfo.email}</small><small>{accountInfo.role}</small></span>
      </div>
      <ul className="account-list">
        {rows.map(row => <li key={row.label}>
          <button type="button" className="account-row" onClick={() => runRow(row)}>
            <span className="menu-icon" aria-hidden="true"><PreviewIcon name={row.icon} /></span>
            <span className="account-text">
              <span className="account-label">{row.label}</span>
            </span>
          </button>
        </li>)}
      </ul>
    </PreviewPopover>
  </>
}

export function PreviewTopbar({ active, sidebarToggle, state }: {
  active: PreviewSectionId
  sidebarToggle: ReactNode
  state: PreviewStoreState
}) {
  const session = usePreviewSession()
  const workspace = state.workspaces.find(item => item.id === state.selection.workspaceId) ?? null
  const scopedProjects = workspace ? state.projects.filter(item => item.workspaceId === workspace.id) : state.projects
  const project = scopedProjects.find(item => item.id === state.selection.projectId) ?? null

  return <header className="preview-topbar">
    {sidebarToggle}

    <div className="topbar-chips">
      <PreviewScopeSelect label="Workspace" value={workspace?.id ?? allId}
        options={[
          { id: allId, label: 'Tất cả Workspace', meta: `${state.workspaces.length} workspace` },
          ...state.workspaces.map(item => ({
            id: item.id, label: item.name,
            meta: `${state.projects.filter(entry => entry.workspaceId === item.id).length} project${item.favorite ? ' · ★' : ''}`,
          })),
        ]}
        onSelect={id => {
          const workspaceId = id || allId
          session.selectWorkspace(workspaceId)
          if (scopeCarryingSections.includes(active)) {
            session.openSection(active, { workspaceId: workspaceId || null })
          }
        }} />

      <PreviewScopeSelect label="Projects" value={project?.id ?? allId}
        options={[
          // Một nhãn duy nhất cho hai phạm vi: "trong workspace" dài gấp đôi mà không nói
          // thêm điều gì mới — ô chọn đã đứng ngay cạnh combobox Workspace, và dòng note
          // cuối popover nói rõ phạm vi đang áp dụng là gì.
          { id: allId, label: 'Tất cả Projects', meta: `${scopedProjects.length} project` },
          ...scopedProjects.map(item => ({ id: item.id, label: item.name, meta: item.code })),
        ]}
        onSelect={id => {
          // "Tất cả Projects" phải là một PHẠM VI, không phải một cú đánh lừa: trước đây nó
          // âm thầm chọn lại project đầu tiên, nên nhãn trên chip không bao giờ khớp cái đã
          // bấm. Bỏ chọn là trang Projects tự hiển thị dòng đầu làm chi tiết (xem
          // projects-2d.view.tsx: selected = find(...) ?? filtered[0]) — không có trạng thái
          // trống không lối ra, mà ô chọn thì nói đúng nơi người dùng đang đứng.
          // Nhánh này cũng KHÔNG đổi màn hình nữa: chip Projects và chip Workspace phải cùng
          // một quy tắc (apple-design mục 4 — trông giống nhau thì hành xử giống nhau).
          if (!id) {
            session.clearProject()
            if (scopeCarryingSections.includes(active)) {
              session.openSection(active, { workspaceId: workspace?.id ?? null })
            }
            return
          }
          session.selectProject(id)
          // Chọn project ở topbar = mở chi tiết của nó, giống hệt một click lên thẻ
          // (một hành vi một quy tắc, không phân nhánh theo lối vào).
          session.run('detail', { kind: 'project', id, name: state.projects.find(item => item.id === id)?.name ?? id })
        }} />
    </div>

    <div className="topbar-actions">
      <TopbarBell notifications={state.notifications} />
      <TopbarReport />
      <TopbarAccount />
    </div>
  </header>
}
