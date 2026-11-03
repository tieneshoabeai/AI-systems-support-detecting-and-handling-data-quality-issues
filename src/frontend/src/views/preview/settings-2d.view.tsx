import { Fragment, useState } from 'react'
import type { ReactNode } from 'react'
import type {
  DeviceSession, SettingsNavLeaf, SettingsNavItem, SettingsSectionId,
} from '../../types/preview/preview.types'
import { isSettingsNavGroup } from '../../types/preview/preview.types'
import {
  notificationPrefRows, previewNotice, previewNoteIds, previewReasons, settingsModules,
} from './preview-data'
import { PreviewShell } from './components/preview-shell'
import { PreviewIcon } from './components/preview-icons'
import { ActionNote, Panel } from './components/preview-primitives'
import { usePreviewSession } from './preview-session-context'

// Màn Settings theo Design Board nhóm 04 (đặc tả Shell dòng 9). Khác chuông/báo cáo: hai mục
// "Hồ sơ cá nhân" và "Cài đặt tài khoản" ĐIỀU HƯỚNG sang đây (màn thật, có hash riêng
// '#/preview/settings/<mục>'), không chạy "trong ô".
//
// ĐẶC TẢ dòng 9 chốt bố cục: bấm "hồ sơ cá nhân"/"cài đặt tài khoản" ở menu tài khoản →
// chuyển sang NHÁNH "Accounts" của Settings (thanh bar bên trái), "các nhánh còn lại để sau".
// Vì thế rail trái là cây MODULE (settingsModules ở tầng data — thêm module System / Time &
// Language / Update sau này là thêm một phần tử vào mảng, không sửa view), hiện mới có một:
//   Accounts
//     · Hồ sơ cá nhân            (4.2)
//     · Cài đặt tài khoản        (4.3–4.5) → Bảo mật · Đăng nhập & phiên · Thông báo
// Ảnh 4.2 vẽ Hồ sơ như màn RIÊNG không sidebar, nhưng đặc tả + yêu cầu nhóm trưởng muốn nó
// nằm trong rail "Accounts" → rail hiện trên CẢ màn Hồ sơ (đặc tả thắng ảnh ở đây).
//
// Hai chỗ ảnh và ĐẶC TẢ chủ đích khác nhau (đặc tả = yêu cầu, ảnh = mockup có chỗ sai):
//   · 2FA: ảnh 4.3 vẽ "Xác thực hai bước (2FA)" nhưng đặc tả dòng 9 ghi "xác thực 2 bước trong
//     ảnh bỏ nha" → BỎ, màn Bảo mật chỉ còn "Đổi mật khẩu".
//   · Đơn vị: ảnh 4.2 vẽ ổ khóa (chỉ đọc) nhưng đặc tả dòng 9 liệt kê rõ "sửa tên, đơn vị, số
//     điện thoại, giới thiệu" → ĐƠN VỊ SỬA ĐƯỢC, chỉ email + chức vụ bị khóa.

// '#/preview/settings' TRẦN (không kèm mục con) = MÀN TỔNG QUAN: rail mở Accounts nhưng thân
// trang chưa chọn mục nào. Trước đây một hằng số `defaultSection = 'security'` khiến cả hai lối
// vào — "Settings" trên sidebar lẫn "Cài đặt tài khoản" trong menu cá nhân — đều rơi thẳng vào
// tab Bảo mật; hai đường đi khác nhau mà cùng một đích thì người dùng đọc thành "bấm nhầm".
// 'profile' (4.2) và ba mục của 'Cài đặt tài khoản' (4.3–4.5) vẫn tới được qua
// '#/preview/settings/<mục>'.
function SettingsOverview() {
  // Nội dung SUY từ settingsModules, không liệt kê tay: thêm module System / Time & Language /
  // Update sau này thì màn này tự nói thêm một dòng, không phải sửa view.
  const describeItem = (item: SettingsNavItem): string =>
    isSettingsNavGroup(item) ? `${item.label} (${item.children.map(child => child.label).join(' · ')})` : item.label

  // Thân trang CHỈ hướng dẫn, không lặp lại nút của rail: hai control cho một việc là hai chỗ
  // phải sửa khi thêm mục. Rail bên trái đã là lối vào duy nhất.
  return <div className="settings-screen">
    <Panel title="Chuyên mục">
      <p className="settings-hint">Chọn một mục ở thanh bên để bắt đầu.</p>
      <dl className="settings-overview">
        {settingsModules.map(module => <Fragment key={module.id}>
          <dt><span className="settings-nav-icon" aria-hidden="true"><PreviewIcon name={module.icon} /></span>{module.label}</dt>
          <dd>{module.items.map(describeItem).join(' · ')}</dd>
        </Fragment>)}
      </dl>
    </Panel>
  </div>
}

// ---------- 4.2 Hồ sơ cá nhân ----------
// SỬA: tên · đơn vị · số điện thoại · giới thiệu. CHỈ ĐỌC (khóa): email · chức vụ — đúng
// đặc tả dòng 9. Ba trường chỉ đọc luôn lấy từ store để không bao giờ lệch với menu tài khoản.
function ProfileSection() {
  const session = usePreviewSession()
  const profile = session.state.profile
  const [name, setName] = useState(profile.name)
  const [organization, setOrganization] = useState(profile.organization)
  const [phone, setPhone] = useState(profile.phone)
  const [bio, setBio] = useState(profile.bio)
  const [error, setError] = useState('')
  const [savedProfile, setSavedProfile] = useState(profile)

  // Bản nháp (4 trường editable) phải đồng bộ lại khi store đổi dưới chân nó — tức sau
  // "Hoàn tác" (tải lại trang thì component mount lại từ đầu, không cần đồng bộ). Nếu không, khối nhận dạng (đọc thẳng store)
  // revert về tên cũ trong khi ô nhập vẫn giữ giá trị vừa bị hoàn tác: hai chỗ của CÙNG một
  // màn lệch nhau, nhìn như bug. Theo đúng mẫu "điều chỉnh state khi prop đổi" của React:
  // so với snapshot đã lưu, khác thì set lại NGAY TRONG RENDER (không dùng useEffect —
  // setState trong effect bị React Compiler chặn vì gây render dây chuyền). Gõ phím không đổi
  // tham chiếu `profile` nên khối này chạy trống, không phá nội dung đang soạn.
  if (profile !== savedProfile) {
    setSavedProfile(profile)
    setName(profile.name); setOrganization(profile.organization); setPhone(profile.phone); setBio(profile.bio)
  }

  const save = (): void => {
    // Validate khi bấm "Lưu" thay vì tắt nút: nút luôn bật, thiếu tên thì nói ngay trong form
    // (khớp dấu * ở ảnh) — không có control tắt không lý do.
    if (!name.trim()) { setError('Họ và tên không được để trống.'); return }
    setError('')
    session.updateProfile({ name: name.trim(), organization: organization.trim(), phone: phone.trim(), bio: bio.trim() })
  }

  return <div className="settings-screen">
    <div className="profile-grid">
      <div className="profile-id">
        <span className="avatar avatar-lg" aria-hidden="true">{profile.name.split(' ').slice(-1)[0]?.[0] ?? '?'}</span>
        <strong>{profile.name}</strong>
        <span className="profile-role">{profile.role}</span>
      </div>

      <Panel title="Thông tin cá nhân">
        <div className="settings-form">
          <label className="field">
            <span className="field-label">Họ và tên <span className="req" aria-hidden="true">*</span></span>
            <span className="field-control">
              <input type="text" value={name} maxLength={60} aria-label="Họ và tên"
                onChange={event => setName(event.target.value)} />
              <span className="field-affordance" aria-hidden="true"><PreviewIcon name="pencil" /></span>
            </span>
          </label>

          <div className="field">
            <span className="field-label">Email</span>
            <span className="field-control is-readonly">
              <input type="text" value={profile.email} readOnly aria-readonly="true" aria-label="Email (không đổi được)" />
              <span className="field-affordance" aria-hidden="true"><PreviewIcon name="lock" /></span>
            </span>
          </div>

          <div className="field">
            <span className="field-label">Chức vụ</span>
            <span className="field-control is-readonly">
              <input type="text" value={profile.role} readOnly aria-readonly="true" aria-label="Chức vụ (không đổi được)" />
              <span className="field-affordance" aria-hidden="true"><PreviewIcon name="lock" /></span>
            </span>
          </div>

          <label className="field">
            <span className="field-label">Đơn vị</span>
            <span className="field-control">
              <input type="text" value={organization} maxLength={80} aria-label="Đơn vị"
                onChange={event => setOrganization(event.target.value)} />
              <span className="field-affordance" aria-hidden="true"><PreviewIcon name="pencil" /></span>
            </span>
          </label>

          <label className="field">
            <span className="field-label">Số điện thoại</span>
            <span className="field-control">
              <input type="tel" value={phone} maxLength={20} aria-label="Số điện thoại"
                onChange={event => setPhone(event.target.value)} />
              <span className="field-affordance" aria-hidden="true"><PreviewIcon name="pencil" /></span>
            </span>
          </label>

          <label className="field">
            <span className="field-label">Giới thiệu</span>
            <span className="field-control">
              <textarea rows={3} value={bio} maxLength={240} aria-label="Giới thiệu"
                onChange={event => setBio(event.target.value)} />
              <span className="field-affordance" aria-hidden="true"><PreviewIcon name="pencil" /></span>
            </span>
          </label>

          {error !== '' && <p className="form-error" role="alert">{error}</p>}
          <div className="form-actions">
            {/* Đặc tả dòng 9 nói rõ: "hủy thì về trang chính" → Hủy điều hướng về Home (không
                phải chỉ xóa nháp tại chỗ). Ảnh 4.2 vẽ đúng hai nút Hủy / Lưu thay đổi. */}
            <button type="button" className="button-secondary" onClick={() => session.openSection('home')}>Hủy</button>
            <button type="button" className="button-primary" onClick={save}>Lưu thay đổi</button>
          </div>
        </div>
      </Panel>
    </div>
  </div>
}

// ---------- 4.3 Bảo mật ----------
// "Đổi mật khẩu" dạng thu giãn (khớp dấu › trong ảnh). 2FA đã BỎ theo đặc tả dòng 9. Chưa có
// API Auth nên đổi mật khẩu chỉ là xác thực biểu mẫu + toast, không ghi lại ở đâu (nói rõ ở note).
function SecuritySection() {
  const session = usePreviewSession()
  const [open, setOpen] = useState(false)
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')

  const submit = (): void => {
    if (!current || !next || !confirm) { setError('Cần điền đủ mật khẩu hiện tại, mật khẩu mới và nhập lại mật khẩu mới.'); return }
    if (next.length < 8) { setError('Mật khẩu mới cần tối thiểu 8 ký tự.'); return }
    if (next !== confirm) { setError('Mật khẩu mới và nhập lại không khớp.'); return }
    setError('')
    setCurrent(''); setNext(''); setConfirm(''); setOpen(false)
    session.notify('Đã đổi mật khẩu (dữ liệu mẫu — không ghi lại).', 'success')
  }

  return <div className="settings-screen">
    <Panel title="Bảo mật tài khoản">
      <div className="security-list">
        <button type="button" className="security-row" aria-expanded={open}
          onClick={() => { setOpen(value => !value); setError('') }}>
          <span className="security-icon" aria-hidden="true"><PreviewIcon name="key" /></span>
          <span className="security-text">
            <strong>Đổi mật khẩu</strong>
            <small>Cập nhật mật khẩu đăng nhập</small>
          </span>
          <span className="security-caret" aria-hidden="true"><PreviewIcon name={open ? 'chevron-down' : 'chevron'} /></span>
        </button>

        {open && <div className="password-form">
          <label className="field">
            <span className="field-label">Mật khẩu hiện tại</span>
            <input type="password" value={current} aria-label="Mật khẩu hiện tại" onChange={event => setCurrent(event.target.value)} />
          </label>
          <label className="field">
            <span className="field-label">Mật khẩu mới</span>
            <input type="password" value={next} aria-label="Mật khẩu mới" onChange={event => setNext(event.target.value)} />
          </label>
          <label className="field">
            <span className="field-label">Nhập lại mật khẩu mới</span>
            <input type="password" value={confirm} aria-label="Nhập lại mật khẩu mới" onChange={event => setConfirm(event.target.value)} />
          </label>
          {error !== '' && <p className="form-error" role="alert">{error}</p>}
          <div className="form-actions">
            <button type="button" className="button-secondary" onClick={() => { setOpen(false); setError('') }}>Hủy</button>
            <button type="button" className="button-primary" onClick={submit}>Đổi mật khẩu</button>
          </div>
        </div>}
      </div>
    </Panel>
  </div>
}

// ---------- 4.4 Đăng nhập & phiên ----------
function SessionRow({ item }: { item: DeviceSession }) {
  const session = usePreviewSession()
  const [menuOpen, setMenuOpen] = useState(false)
  const [detailOpen, setDetailOpen] = useState(false)

  // Ảnh 4.4: phiên HIỆN TẠI không có ⋮ (đang xem preview mà tự đăng xuất là tự cắt lối vào,
  // và đăng xuất thật thuộc trang auth của bạn T). "Phiên hiện tại" là chữ inline sau vị trí,
  // không phải chip riêng; các phiên khác hiện "Đăng nhập: <mốc>" rồi tới ⋮.
  return <li className="session-item">
    <div className="session-row">
      <span className="session-icon" aria-hidden="true"><PreviewIcon name={item.icon} /></span>
      <span className="session-main">
        <strong>{item.platform} · {item.browser}</strong>
        <small>{item.location}{item.current && <> · <span className="session-current">Phiên hiện tại</span></>}</small>
      </span>
      {!item.current && <span className="session-side"><small className="session-at">Đăng nhập: {item.startedAt}</small></span>}
      {!item.current && <button type="button" className="icon-button sm row-menu" aria-label={`Tùy chọn phiên ${item.platform} · ${item.browser}`}
        aria-expanded={menuOpen} onClick={() => setMenuOpen(value => !value)}>
        <PreviewIcon name="more" />
      </button>}
    </div>

    {menuOpen && <div className="session-menu" role="menu" aria-label={`Tùy chọn phiên ${item.platform}`}>
      <button type="button" role="menuitem" className="session-menu-item" onClick={() => { setDetailOpen(value => !value); setMenuOpen(false) }}>
        <PreviewIcon name="search" /> Xem chi tiết
      </button>
      <button type="button" role="menuitem" className="session-menu-item is-danger"
        onClick={() => { session.revokeSession(item.id); setMenuOpen(false) }}>
        <PreviewIcon name="logout" /> Đăng xuất phiên này
      </button>
    </div>}

    {detailOpen && <dl className="detail-meta session-detail">
      <div><dt>Địa chỉ IP</dt><dd>{item.ip}</dd></div>
      <div><dt>Đăng nhập lúc</dt><dd>{item.startedAt}</dd></div>
      <div><dt>Vị trí</dt><dd>{item.location}</dd></div>
    </dl>}
  </li>
}

function SessionsSection() {
  const session = usePreviewSession()
  const sessions = session.state.sessions
  const others = sessions.filter(item => !item.current).length

  // Ảnh 4.4: nút "Đăng xuất tất cả các phiên khác" nằm ở góc TRÊN PHẢI của đầu màn (đặt trong
  // settings-head của SettingsPreviewView), KHÔNG nằm trong header Panel. Panel chỉ còn tiêu đề.
  return <div className="settings-screen">
    <Panel title={`Các phiên đang hoạt động (${sessions.length})`}>
      {sessions.length === 0
        ? <p className="notice-empty">Không còn phiên nào. Tải lại trang để xem lại danh sách.</p>
        : <ul className="session-list">{sessions.map(item => <SessionRow key={item.id} item={item} />)}</ul>}
      {others === 0 && sessions.length > 0 && <p className="settings-hint">Chỉ còn phiên hiện tại — không còn phiên nào khác để đăng xuất.</p>}
    </Panel>
  </div>
}

// ---------- 4.5 Tùy chọn thông báo ----------
// Mỗi dòng là một <button role="switch">: gạt bật/tắt là mutation optimistic (có Hoàn tác),
// cùng khuôn với mọi thao tác khác của frame.
function NotificationPrefsSection() {
  const session = usePreviewSession()
  const prefs = session.state.notificationPrefs

  return <div className="settings-screen">
    <Panel title="Tùy chọn thông báo">
      <div className="pref-list">
        {notificationPrefRows.map(row => <div key={row.key} className="pref-row">
          <span className="pref-icon" aria-hidden="true"><PreviewIcon name={row.icon} /></span>
          <span className="pref-text">
            <strong>{row.label}</strong>
            <small>{row.caption}</small>
          </span>
          <button type="button" role="switch" aria-checked={prefs[row.key]} aria-label={row.label}
            className={`switch${prefs[row.key] ? ' is-on' : ''}`}
            onClick={() => session.setNotificationPref(row.key, !prefs[row.key])}>
            <span className="switch-knob" aria-hidden="true" />
          </button>
        </div>)}
      </div>
    </Panel>
  </div>
}

// Ba mục "Cài đặt tài khoản" (ảnh 4.3–4.5) là mục CON của nhánh Cài đặt, không phải module
// ngang hàng với Hồ sơ — nên chúng chỉ hiện khi đang ở bên trong "Cài đặt tài khoản".
// Danh sách Suy từ settingsModules (mục có `children`) thay vì viết tay một mảng id: đổi bộ
// mục con hay thêm module mới chỉ sửa dữ liệu, rail tự theo.
const isGroupActive = (item: SettingsNavItem, active: SettingsSectionId | null): boolean =>
  isSettingsNavGroup(item) && item.children.some(child => child.id === active)

// Rail KHÔNG có ô tìm kiếm: thanh tìm kiếm chung của topbar đã bị gỡ khỏi mọi trang (yêu cầu
// 03/11) và Settings chỉ có bảy mục trong hai cấp — gập/mở bằng nút trên chính rail là đủ để
// tìm thấy hết. Vì vậy không còn bộ lọc theo nhãn ở đây.
export function SettingsPreviewView({ section }: { section: SettingsSectionId | null }) {
  const session = usePreviewSession()
  // null = '#/preview/settings' trần → màn tổng quan: KHÔNG tự chọn mục hộ người dùng.
  const active = section
  const isProfile = active === 'profile'

  // Cây MODULE của đặc tả dòng 9 + yêu cầu nhóm trưởng: bật Settings → thanh bar kế bên có
  // một nút cho mỗi module (hiện mới có "Accounts"); ấn vào module hiện các mục của nó. Mặc
  // định MỞ để hai mục "Hồ sơ cá nhân" / "Cài đặt tài khoản" hiện ngay (ảnh 4.3 vẽ rail đang
  // mở), người dùng gập thì ghi theo id module — state nằm ở RECORD chứ không phải một useState
  // riêng cho Accounts, vì số module thay đổi theo dữ liệu mà hook thì không gọi trong vòng lặp.
  const [collapsedModules, setCollapsedModules] = useState<Record<string, boolean>>({})
  const toggleModule = (id: string): void =>
    setCollapsedModules(current => ({ ...current, [id]: !current[id] }))
  // Cấp thứ hai của cây (nhóm "Cài đặt tài khoản" bên trong module "Accounts"): cùng khuôn RECORD
  // keyed-by-label ở trên, cũng mặc định mở, cũng không liên quan gì tới hash — gập/mở là chuyện
  // hiển thị của rail, còn đang đứng ở màn nào mới là chuyện của route.
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({})
  const toggleGroup = (label: string): void =>
    setCollapsedGroups(current => ({ ...current, [label]: !current[label] }))

  const railButton = (item: SettingsNavLeaf): ReactNode => {
    const selected = item.id === active
    return <button type="button" key={item.id}
      className={`settings-nav-item${selected ? ' is-active' : ''}`}
      aria-current={selected ? 'page' : undefined}
      onClick={() => session.openSection('settings', { settingsSection: item.id })}>
      <span className="settings-nav-icon" aria-hidden="true"><PreviewIcon name={item.icon} /></span>
      <span>{item.label}</span>
    </button>
  }

  const renderItem = (item: SettingsNavItem): ReactNode => {
    if (!isSettingsNavGroup(item)) return railButton(item)
    const groupActive = isGroupActive(item, active)
    // Nhóm MẶC ĐỊNH MỞ (gống module Accounts ở dưới): ấn vào tên nhóm chỉ GẬP/MỞ nó, tuyệt đối
    // không điều hướng. Trước đây nó nhảy thẳng `entry` = Bảo mật, nên cả ba lối đi (sidebar
    // Settings · menu cá nhân · rail) đều đổ về cùng một màn con — người dùng đọc là "bấm nhầm".
    // Một nhóm ba mục không có quyền tự chọn mục nào trong ba mục đó hộ ai.
    const groupExpanded = !collapsedGroups[item.label]
    return <Fragment key={item.label}>
      <button type="button" className={`settings-nav-item${groupActive ? ' is-active' : ''}`}
        aria-expanded={groupExpanded}
        onClick={() => toggleGroup(item.label)}>
        <span className="settings-nav-icon" aria-hidden="true"><PreviewIcon name={item.icon} /></span>
        <span>{item.label}</span>
        <span className={`settings-nav-caret${groupExpanded ? ' is-open' : ''}`} aria-hidden="true"><PreviewIcon name="chevron" /></span>
      </button>
      {groupExpanded && <div className="settings-nav-sub">{item.children.map(child => railButton(child))}</div>}
    </Fragment>
  }

  return <PreviewShell active="settings" notice={previewNotice}>
    {/* Đầu màn: "← <tên màn>" gọn; ảnh 4.4 đặt "Đăng xuất tất cả các phiên khác" ở góc trên
        phải, ngang hàng tiêu đề, chỉ hiện trên màn Phiên. */}
    <div className="settings-head">
      <button type="button" className="page-back" aria-label="Quay lại trang chính" onClick={() => session.openSection('home')}>
        <span className="back-arrow" aria-hidden="true">←</span>
      </button>
      <h1 id="page-heading" tabIndex={-1}>
        {active === null ? 'Cài đặt' : isProfile ? 'Hồ sơ cá nhân' : 'Cài đặt tài khoản'}
      </h1>
      {active === 'sessions' && <button type="button" className="button-secondary settings-head-action"
        onClick={session.revokeAllSessions}>
        <PreviewIcon name="logout" /> Đăng xuất tất cả các phiên khác</button>}
    </div>

    <div className="settings-layout">
      <nav className="settings-nav" aria-label="Chuyên mục Cài đặt">
        {settingsModules.map(module => {
          const expanded = !collapsedModules[module.id]
          return <Fragment key={module.id}>
            <button type="button" className="settings-nav-item is-group" aria-expanded={expanded}
              aria-controls={`settings-${module.id}-sub`} onClick={() => toggleModule(module.id)}>
              <span className="settings-nav-icon" aria-hidden="true"><PreviewIcon name={module.icon} /></span>
              <span>{module.label}</span>
              <span className={`settings-nav-caret${expanded ? ' is-open' : ''}`} aria-hidden="true"><PreviewIcon name="chevron" /></span>
            </button>
            {expanded && <div className="settings-nav-sub" id={`settings-${module.id}-sub`}>
              {module.items.map(item => renderItem(item))}
            </div>}
          </Fragment>
        })}
      </nav>

      <div className="settings-body">
        {active === null ? <SettingsOverview />
          : isProfile ? <ProfileSection />
            : active === 'security' ? <SecuritySection />
              : active === 'sessions' ? <SessionsSection />
                : <NotificationPrefsSection />}
      </div>
    </div>

    <ActionNote id={previewNoteIds.settings}>{previewReasons.settings}</ActionNote>
  </PreviewShell>
}
