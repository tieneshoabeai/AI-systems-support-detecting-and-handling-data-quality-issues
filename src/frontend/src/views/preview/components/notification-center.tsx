import { useMemo, useRef, useState } from 'react'
import type { NotificationFilterTab, PreviewNotification } from '../../../types/preview/preview.types'
import {
  matchNotificationQuery, matchNotificationTab, notificationIcon, notificationKindLabels,
  notificationTabsFor, noticeDetailReason, previewNoteIds, previewReasons,
} from '../preview-data'
import type { NoticeOpenGap } from '../preview-data'
import { PreviewIcon } from './preview-icons'
import { FilterTabs, Pagination } from './preview-primitives'
import { usePreviewSession } from '../preview-session-context'

// Trung tâm thông báo chạy HOÀN TOÀN trong ô popover chuông, theo đặc tả
// `UI-UX/Global Application Shell/đặc tả.txt` dòng 5: "hiện thông báo chưa đọc trong 1 ô khi
// mở, có thể xem tất cả thông báo nhưng chỉ trong ô đó không hiển thị cả trang, tất cả này có
// thể chuyển trang nhưng chỉ trên ô đó". Ba trạng thái của Design Board nhóm 01
// (1.1 dropdown · 1.2 danh sách · 1.3 chi tiết) vì thế là ba VIEW nội bộ của cùng một popover,
// không phải ba route. Bấm "Xem tất cả" hay một dòng KHÔNG ghi hash nữa — khung shell đứng
// yên phía sau, chỉ cái ô đổi nội dung.
//
// Vì sao vẫn giữ màn đầy đủ (`notifications-2d.view.tsx`) làm deep-link: nó đã có 330 dòng test
// chốt hành vi, và ô này dùng lại đúng bộ lọc/đếm đã trích ra `preview-data` nên hai surface
// không lệch logic. Việc xóa màn đầy đủ thuộc batch dọn dẹp, chờ ô này được duyệt.

// 10 dòng/trang khớp chân trang Design Board 1.2 ("Hiển thị 1-10 / 36"). Ô có vùng cuộn riêng
// nên 10 dòng không đẩy footer (chọn hàng loạt + phân trang) ra khỏi tầm nhìn.
const perPage = 10

// Số bản chưa đọc hiển thị ngay ở dropdown (Design Board 1.1 vẽ 5 dòng).
const quickLimit = 5

type CenterView = 'quick' | 'list' | 'detail'

// Một dòng ở dropdown nhanh: icon · tiêu đề · bối cảnh · thời gian · chấm chưa đọc.
// Bấm dòng KHÔNG tự đánh dấu đã đọc — Design Board 1.3 đặt nút "Đánh dấu đã đọc" riêng, nghĩa
// là vào tới nơi bản ghi vẫn phải còn chưa đọc.
function QuickRow({ item, onOpen }: { item: PreviewNotification; onOpen: () => void }) {
  return <button type="button" className={`notice-row${item.unread ? ' is-unread' : ''}`} onClick={onOpen}>
    <span className={`notice-icon tone-${item.tone}`} aria-hidden="true"><PreviewIcon name={notificationIcon(item)} /></span>
    <span className="notice-body"><strong>{item.title}</strong><small>{item.context}</small></span>
    <span className="notice-at">{item.at}</span>
    {item.unread && <span className="notice-dot" role="img" aria-label="Chưa đọc" />}
  </button>
}

// Một dòng ở danh sách đầy đủ trong ô: thêm ô vuông chọn để thao tác hàng loạt (Design Board 1.2).
// Checkbox và nút mở là hai control rời — tích ô không mở chi tiết, bấm dòng không tích.
function InboxRow({ item, picked, onToggle, onOpen }: {
  item: PreviewNotification
  picked: boolean
  onToggle: () => void
  onOpen: () => void
}) {
  return <div className={`inbox-row${item.unread ? ' is-unread' : ''}${picked ? ' is-picked' : ''}`}>
    <label className="check-target">
      <input type="checkbox" checked={picked} aria-label={`Chọn: ${item.title}`} onChange={onToggle} />
    </label>
    <span className={`notice-icon tone-${item.tone}`} aria-hidden="true"><PreviewIcon name={notificationIcon(item)} /></span>
    <button type="button" className="inbox-open" onClick={onOpen}>
      <span className="notice-body"><strong>{item.title}</strong><small>{item.context}</small></span>
    </button>
    <span className="notice-at">{item.at}</span>
    {item.unread && <span className="notice-dot" role="img" aria-label="Chưa đọc" />}
  </div>
}

export function NotificationCenter() {
  const session = usePreviewSession()
  const { state, unreadNotifications } = session

  const [view, setView] = useState<CenterView>('quick')
  // Nơi quay lại khi bấm "←" ở màn chi tiết: vào từ dropdown thì về dropdown, vào từ danh
  // sách thì về danh sách — một nút back phải đưa ta về đúng chỗ vừa đi.
  const [detailReturn, setDetailReturn] = useState<CenterView>('quick')
  const [tab, setTab] = useState<NotificationFilterTab>('all')
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)
  const [picked, setPicked] = useState<string[]>([])
  const [detailId, setDetailId] = useState<string | null>(null)
  const listRef = useRef<HTMLUListElement>(null)

  // Danh sách có vùng cuộn RIÊNG còn footer + phân trang nằm ngoài (xem .inbox-list trong CSS),
  // nên khi lật trang phải KÉO Ô VỀ ĐẦU: trang mới nằm ở phía trên tầm mắt, còn ô thì nhớ chỗ
  // đã cuộn. Không kéo thì người bấm "2" vẫn thấy nguyên footer quen thuộc và tưởng trang
  // không đổi — đúng cái chủ sở hữu batch báo ở khung "Xem tất cả thông báo".
  const goToPage = (next: number): void => {
    setPage(next)
    if (listRef.current) listRef.current.scrollTop = 0
  }

  const unreadList = state.notifications.filter(item => item.unread)
  const quickShown = unreadList.slice(0, quickLimit)

  const filtered = useMemo(
    () => state.notifications.filter(item => matchNotificationTab(item, tab) && matchNotificationQuery(item, query)),
    [state.notifications, tab, query],
  )
  const pageCount = Math.max(1, Math.ceil(filtered.length / perPage))
  const safePage = Math.min(page, pageCount)
  const visible = filtered.slice((safePage - 1) * perPage, safePage * perPage)

  // id đã chọn nhưng không còn trong store (bị xóa, hoặc "Khôi phục dữ liệu mẫu") phải rơi khỏi
  // danh sách thao tác, nếu không báo "Đã chọn 3" mà chỉ 2 dòng biến mất. Dẫn xuất, không ghi ngược.
  const alive = useMemo(() => new Set(state.notifications.map(item => item.id)), [state.notifications])
  const chosen = picked.filter(id => alive.has(id))
  const chosenSet = new Set(chosen)
  const visibleChosen = visible.filter(item => chosenSet.has(item.id)).length
  // Chọn xuyên trang/tab là thật (nên `chosen` lưu id, không lưu dòng đang hiện), nhưng nó tạo
  // cái bẫy: tích vài dòng rồi đổi bộ lọc, con số vẫn hiện trong khi chẳng dòng nào được tích.
  // Số nằm ngoài tầm nhìn phải được nói thẳng thay vì để im.
  const chosenElsewhere = chosen.length - visibleChosen

  const detail = detailId ? state.notifications.find(item => item.id === detailId) ?? null : null
  const detailProject = detail ? state.projects.find(item => item.id === detail.projectId) ?? null : null
  const detailGap: NoticeOpenGap = detailProject ? 'ok' : detail?.projectId ? 'project-removed' : 'no-project'

  const openDetail = (id: string, from: CenterView): void => { setDetailId(id); setDetailReturn(from); setView('detail') }
  const goList = (): void => setView('list')
  const backFromDetail = (): void => setView(detailReturn)
  const backFromList = (): void => { setView('quick'); setQuery(''); goToPage(1) }

  const toggleOne = (id: string): void =>
    setPicked(current => current.includes(id) ? current.filter(item => item !== id) : [...current, id])

  const clearPicked = (): void => setPicked([])

  const applyRead = (ids: readonly string[]): void => { session.markNotificationsRead(ids); clearPicked() }
  const applyDelete = (ids: readonly string[]): void => { session.deleteNotifications(ids); clearPicked() }

  return <div className="notice-center">
    {view === 'quick' && <>
      <div className="popover-head">
        <strong>Thông báo</strong>
        <div className="center-head-actions">
          {unreadNotifications > 0 && <span className="center-chip">{unreadNotifications} chưa đọc</span>}
          <button type="button" className="text-link" disabled={unreadNotifications === 0}
            aria-describedby={unreadNotifications === 0 ? previewNoteIds.notifications : undefined}
            onClick={session.readAllNotifications}>
            Đánh dấu tất cả đã đọc
          </button>
        </div>
      </div>

      {quickShown.length === 0
        ? <p className="notice-empty">Không còn thông báo chưa đọc. Bấm “Xem tất cả” để xem lại toàn bộ hộp thư.</p>
        : <ul className="notice-list">{quickShown.map(item => <li key={item.id}>
          <QuickRow item={item} onOpen={() => openDetail(item.id, 'quick')} />
        </li>)}</ul>}

      <div className="popover-foot">
        <button type="button" className="text-link" onClick={goList}>Xem tất cả thông báo</button>
      </div>
      <p className="popover-note" id={previewNoteIds.notifications}>{previewReasons.notificationInbox}</p>
    </>}

    {view === 'list' && <>
      <div className="popover-head">
        <button type="button" className="back-link" onClick={backFromList}>
          <span className="back-arrow" aria-hidden="true">←</span> Tất cả thông báo
        </button>
      </div>

      <FilterTabs tabs={notificationTabsFor(state.notifications)} active={tab}
        onChange={id => { setTab(id); goToPage(1) }} label="Lọc thông báo" />

      <div className="popover-search">
        <span aria-hidden="true"><PreviewIcon name="search" /></span>
        <input role="searchbox" aria-label="Tìm kiếm thông báo" value={query} autoFocus
          placeholder="Tìm kiếm thông báo…"
          onChange={event => { setQuery(event.target.value); goToPage(1) }} />
      </div>

      {visible.length === 0
        ? <p className="notice-empty">Không có thông báo khớp bộ lọc hoặc từ khóa “{query}”.</p>
        : <ul className="inbox-list" ref={listRef}>{visible.map(item => <li key={item.id}>
          <InboxRow item={item} picked={chosenSet.has(item.id)}
            onToggle={() => toggleOne(item.id)} onOpen={() => openDetail(item.id, 'list')} />
        </li>)}</ul>}

      <div className="center-foot">
        <span className="bulk-count">{chosen.length === 0 ? 'Chưa chọn thông báo nào'
          : chosenElsewhere === 0 ? `Đã chọn ${chosen.length}`
            : `Đã chọn ${chosen.length} · ${chosenElsewhere} mục nằm ngoài danh sách đang hiện`}</span>
        <div className="bulk-actions">
          <button type="button" className="button-secondary" disabled={chosen.length === 0}
            aria-describedby={previewNoteIds.notifications} onClick={() => applyRead(chosen)}>Đánh dấu đã đọc</button>
          <button type="button" className="button-danger" disabled={chosen.length === 0}
            aria-describedby={previewNoteIds.notifications} onClick={() => applyDelete(chosen)}>
            <PreviewIcon name="trash" /> Xóa</button>
          <button type="button" className="text-link" disabled={chosen.length === 0}
            aria-describedby={previewNoteIds.notifications} onClick={clearPicked}>Bỏ chọn</button>
        </div>
      </div>

      {/* KHÔNG truyền `unit`: chủ batch 03/11 bỏ dòng "Hiển thị 1–10 của 16 thông báo" trong Ô.
          Số trang + nút lật vẫn đủ để biết mình đang ở đâu, còn dòng đếm chỉ chỉn chu trên trang
          hộp thư đầy đủ (nơi người dùng thật sự đổi được số dòng mỗi trang). */}
      <Pagination label="Phân trang thông báo" total={filtered.length} page={safePage} perPage={perPage}
        onPage={goToPage} hideWhenEmpty />
      <p className="popover-note" id={previewNoteIds.notifications}>{previewReasons.notificationInbox}</p>
    </>}

    {view === 'detail' && <>
      <div className="popover-head">
        <button type="button" className="back-link" onClick={backFromDetail}>
          <span className="back-arrow" aria-hidden="true">←</span> Chi tiết thông báo
        </button>
      </div>

      {detail === null
        ? <p className="notice-empty">Thông báo này không còn trong hộp thư mẫu — có thể nó vừa bị xóa.</p>
        : <div className="detail-body">
          <div className="detail-hero">
            <span className={`notice-icon tone-${detail.tone}`} aria-hidden="true"><PreviewIcon name={notificationIcon(detail)} /></span>
            <strong>{detail.title}</strong>
          </div>
          <dl className="detail-meta">
            <div><dt>Thời gian</dt><dd>{detail.atFull}</dd></div>
            <div><dt>Loại</dt><dd>{notificationKindLabels[detail.kind]}</dd></div>
            <div><dt>Liên quan</dt><dd>{detail.context}</dd></div>
            <div><dt>Trạng thái</dt><dd>{detail.unread ? 'Chưa đọc' : 'Đã đọc'}</dd></div>
          </dl>
          <h3 className="notice-desc-head">Mô tả chi tiết</h3>
          <p className="notice-desc">{detail.description}</p>
          {/* "Mở Project" = vào trang Project Workspace Overview (ảnh Overview_v1), KHÔNG phải
              thẳng sang scene 3D: mọi lối đi vào project đều phải qua trang đó. Popover tự đóng khi
              hash đổi — quy tắc dùng chung cho mọi surface nổi (xem useSurfaceDismiss). */}
          <div className="detail-actions">
            <button type="button" className="button-primary" disabled={detailGap !== 'ok'}
              aria-describedby={previewNoteIds.notificationDetail}
              onClick={() => {
                if (detailProject) session.openSection('projects', { workspaceId: detailProject.workspaceId, projectId: detailProject.id })
              }}>
              Mở Project <span aria-hidden="true">↗</span></button>
            <button type="button" className="button-secondary" disabled={!detail.unread}
              aria-describedby={previewNoteIds.notificationDetail}
              onClick={() => applyRead([detail.id])}>
              <PreviewIcon name="check" /> Đánh dấu đã đọc</button>
          </div>
          <p className="popover-note" id={previewNoteIds.notificationDetail}>
            {noticeDetailReason(detailGap, !detail.unread)}
          </p>
        </div>}
    </>}
  </div>
}
