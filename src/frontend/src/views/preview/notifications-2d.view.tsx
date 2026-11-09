import { useEffect, useMemo, useRef, useState } from 'react'
import type { NotificationFilterTab, PreviewNotification } from '../../types/preview/preview.types'
import {
  matchNotificationTab, notificationIcon, notificationKindLabels,
  notificationTabsFor, noticeDetailReason,
  previewNoteIds, previewReasons,
} from './preview-data'
import type { NoticeOpenGap } from './preview-data'
import { PreviewShell } from './components/preview-shell'
import { PreviewIcon } from './components/preview-icons'
import { ActionNote, EmptyHint, FilterTabs, Pagination, Panel } from './components/preview-primitives'
import { usePreviewSession } from './preview-session-context'

// Màn Thông báo theo nhóm 01 của UI-UX/Global Application Shell/Design Board:
//   1.1 dropdown chuông (đã có ở topbar) → 1.2 danh sách → 1.3 chi tiết.
// Danh sách và chi tiết dùng chung MỘT URL ('#/preview/notifications[/id]') nên nút
// Quay lại của trình duyệt về đúng danh sách mà không cần route 'danh sách' riêng.
//
// Hai khác biệt so với ảnh, có chủ đích và cần nhóm trưởng xác nhận:
//   · Trang này KHÔNG có ô tìm kiếm. Thanh tìm kiếm chung của topbar đã bị gỡ khỏi mọi trang
//     (yêu cầu 03/11), còn lọc theo từ khóa thuộc về ô popover chuông — nơi đặc tả Shell dòng 5
//     nói là NƠI CHÍNH để xem thông báo. Giữ cả hai là hai nguồn thật sự cho một danh sách.
//   · Icon "phễu" ở góc danh sách không dựng, vì tab lọc đã làm đúng việc đó; thêm nút
//     "Bộ lọc" tắt chỉ cho đủ hình thì phải viết thêm một dòng lý do cho một nút không ai cần.

const perPageChoices = ['8', '16', '32'] as const

// Tiêu đề panel chứa bảng. Bản cũ ghép 'Thông báo' + hậu tố tab → ở tab 'all' nó là
// 'Thông báo', đúng hai chữ mà H1 của cả màn đang mang: máy đọc màn hình nghe tiêu đề
// màn rồi nghe lại cùng một câu và không biết hai chỗ khác nhau việc gì. Panel nói về
// PHẠM VI của bảng, H1 nói về màn hình.
const panelTitleFor = (tab: NotificationFilterTab): string =>
  tab === 'unread' ? 'Chưa đọc' : tab === 'read' ? 'Đã đọc' : 'Toàn bộ hộp thư'

// "Chưa đọc / Đã đọc" dùng lại bộ badge của shell: thêm một kiểu chip riêng cho hai
// trạng thái thì màu sắc trong app thành hai hệ quy chiếu khác nhau.
function ReadBadge({ unread }: { unread: boolean }) {
  return <span className={`status-badge ${unread ? 'status-warn' : 'status-muted'}`}>
    <span className="status-dot" aria-hidden="true" />{unread ? 'Chưa đọc' : 'Đã đọc'}
  </span>
}

function NoticeKind({ item }: { item: PreviewNotification }) {
  return <span className={`notice-kind tone-${item.tone}`}>
    <PreviewIcon name={notificationIcon(item)} />{notificationKindLabels[item.kind]}
  </span>
}

function BackToList() {
  const session = usePreviewSession()
  return <div className="back-row">
    <button type="button" className="back-link" onClick={() => session.openSection('notifications')}>
      <span className="back-arrow" aria-hidden="true">←</span> Danh sách thông báo
    </button>
  </div>
}

// Nút quay lại của màn DANH SÁCH. Người duyệt vào đây từ chuông topbar rồi không còn lối ra
// nào rõ (sidebar vẫn sáng Home vì Thông báo không phải module nav), nên phải có một nút
// "Quay lại" — cùng nghĩa với nút back của trình duyệt. Tab mở thẳng vào URL này thì history
// rỗng, back() sẽ không đưa đi đâu cả: rơi về Home để nút không bao giờ bấm mà im lặng.
function BackOutOfInbox() {
  const session = usePreviewSession()
  return <div className="back-row">
    <button type="button" className="back-link" onClick={() => {
      if (window.history.length > 1) window.history.back()
      else session.openSection('home')
    }}>
      <PreviewIcon name="arrow-left" /> Quay lại
    </button>
  </div>
}

function NotificationDetail({ notification }: { notification: PreviewNotification }) {
  const session = usePreviewSession()
  const project = session.state.projects.find(item => item.id === notification.projectId) ?? null
  const gap: NoticeOpenGap = project ? 'ok' : notification.projectId ? 'project-removed' : 'no-project'

  return <>
    <BackToList />

    <div className="page-head">
      <div className="page-head-text">
        <span className="page-eyebrow">{notification.id} · {notification.context}</span>
        <h1 id="page-heading" tabIndex={-1}>{notification.title}</h1>
        <p>Bản tin hệ thống gửi tới tài khoản của bạn. Nút dưới mở thẳng trang Project của project liên quan (trong đó có lối sang vũ trụ dữ liệu 3D); muốn xem hết hộp thư thì quay lại danh sách.</p>
      </div>
      <NoticeKind item={notification} />
    </div>

    <Panel title="Chi tiết thông báo">
      <dl className="detail-meta">
        <div><dt>Thời gian</dt><dd>{notification.atFull}</dd></div>
        <div><dt>Loại</dt><dd>{notificationKindLabels[notification.kind]}</dd></div>
        <div><dt>Liên quan</dt><dd>{notification.context}</dd></div>
        <div><dt>Trạng thái</dt><dd><ReadBadge unread={notification.unread} /></dd></div>
      </dl>
      <h3 className="notice-desc-head">Mô tả chi tiết</h3>
      {/* Bản tin do hệ thống sinh, mô tả CÓ THỂ rỗng. Để lại một heading với khoảng trắng bên
          dưới thì người đọc nghĩ trang chưa tải xong — nói thẳng là nó không có mô tả. */}
      <p className="notice-desc">{notification.description || 'Bản tin này không kèm mô tả chi tiết.'}</p>
      <div className="detail-actions">
        <button type="button" className="button-primary" disabled={gap !== 'ok'}
          aria-describedby={previewNoteIds.notificationDetail}
          onClick={() => {
            if (!project) return
            // "Đi vào project" = trang Project Workspace Overview (ảnh Overview_v1), không phải
            // thẳng sang scene 3D: trang đó mới là nơi kể cho người đọc project này có gì, và
            // chính nó chứa nút mở 3D. Route mang cả workspace lẫn project nên F5 vẫn đứng trang.
            session.openSection('projects', { workspaceId: project.workspaceId, projectId: project.id })
          }}>
          Mở Project <span aria-hidden="true">↗</span></button>
        <button type="button" className="button-secondary" disabled={!notification.unread}
          aria-describedby={previewNoteIds.notificationDetail}
          onClick={() => session.markNotificationsRead([notification.id])}>
          <PreviewIcon name="check" /> Đánh dấu đã đọc</button>
      </div>
      <ActionNote id={previewNoteIds.notificationDetail}>
        {noticeDetailReason(gap, !notification.unread)}
      </ActionNote>
    </Panel>
  </>
}

export function NotificationsPreviewView({ notificationId }: { notificationId: string | null }) {
  const session = usePreviewSession()
  const [tab, setTab] = useState<NotificationFilterTab>('all')
  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState(8)
  const [picked, setPicked] = useState<string[]>([])
  const headRef = useRef<HTMLInputElement>(null)
  const { state, unreadNotifications } = session

  const notification = notificationId ? state.notifications.find(item => item.id === notificationId) ?? null : null

  // Tab đếm trên TOÀN BỘ hộp thư. Danh sách này chỉ lọc bằng tab (Chưa đọc · Đã đọc · Toàn bộ)
  // — từ khóa thuộc ô popover chuông, xem ghi chú ở đầu file.
  const filtered = useMemo(() => state.notifications
    .filter(item => matchNotificationTab(item, tab)), [state.notifications, tab])
  const pageCount = Math.max(1, Math.ceil(filtered.length / perPage))
  const safePage = Math.min(page, pageCount)
  const visible = filtered.slice((safePage - 1) * perPage, safePage * perPage)

  // id đã chọn nhưng không còn trong store (bản thân nó bị xóa, hoặc "Khôi phục dữ liệu mẫu"
  // đưa bộ khác vào) phải rơi khỏi danh sách thao tác — nếu không nút Xóa báo "đã xóa 3" mà
  // chỉ 2 dòng biến mất. Pruning ở đây là dẫn xuất, không ghi ngược lại state.
  const alive = useMemo(() => new Set(state.notifications.map(item => item.id)), [state.notifications])
  const chosen = picked.filter(id => alive.has(id))
  const chosenSet = new Set(chosen)
  const visibleChosen = visible.filter(item => chosenSet.has(item.id)).length
  const allVisibleChosen = visible.length > 0 && visibleChosen === visible.length
  // Phần đã chọn NHẰM duy trì khi đổi tab/tìm kiếm/đổi trang (chọn xuyên trang là lý do
  // `chosen` lưu id chứ không lưu dòng đang hiện). Nhưng nó tạo một cái bẫy thật đã đo
  // trên trình duyệt: tích 3 dòng rồi xóa tab lọc, băng "Đã chọn 3" vẫn hiện trong khi
  // 0 dòng nào được tích, và nút Xóa vẫn bật — bấm là xóa 3 bản ghi không nhìn thấy ở
  // đâu trên màn hình. Con số thừa đó phải được nói thẳng thay vì để im.
  const chosenElsewhere = chosen.length - visibleChosen

  // Ô "chọn tất cả" ở trạng thái ba (một phần) chỉ biểu đạt được bằng property DOM, không
  // có thuộc tính HTML nào tương ứng → phải qua ref. Bỏ nó thì header hiện ô trống trong
  // khi đã có vài dòng được tích, tức là nói dối.
  useEffect(() => {
    if (headRef.current) headRef.current.indeterminate = visibleChosen > 0 && !allVisibleChosen
  }, [visibleChosen, allVisibleChosen])

  const toggleOne = (id: string): void =>
    setPicked(current => current.includes(id) ? current.filter(item => item !== id) : [...current, id])

  const toggleAll = (): void => setPicked(current => {
    const ids = visible.map(item => item.id)
    return allVisibleChosen
      ? current.filter(id => !ids.includes(id))
      : [...new Set([...current, ...ids])]
  })

  if (notificationId !== null) {
    return <PreviewShell active="notifications">
      {notification
        ? <NotificationDetail key={notification.id} notification={notification} />
        : <> {/* id không tồn tại (vừa bị xóa / người review gõ tay trên URL): nói rõ thay vì im lặng trả về trang trắng */}
          <EmptyHint title="Không tìm thấy thông báo"
            note={`Hộp thư mẫu không có bản ghi “${notificationId}” — có thể nó vừa bị xóa, hoặc id trong URL không đúng.`} />
          <BackToList />
        </>}
    </PreviewShell>
  }

  return <PreviewShell active="notifications">
    <BackOutOfInbox />
    <div className="page-head">
      <div className="page-head-text">
        <span className="page-eyebrow">Hộp thư · {unreadNotifications} chưa đọc · {state.notifications.length} thông báo</span>
        <h1 id="page-heading" tabIndex={-1}>Thông báo</h1>
        <p>Chuông trên topbar liệt kê năm bản gần nhất; đây là toàn bộ hộp thư. Bấm tên một dòng để mở chi tiết,
          tích ô vuông để đánh dấu đã đọc hoặc xóa hàng loạt.</p>
      </div>
    </div>

    <div className="toolbar">
      <FilterTabs tabs={notificationTabsFor(state.notifications)} active={tab}
        onChange={id => { setTab(id); setPage(1) }} label="Lọc thông báo" />
      <div className="toolbar-right">
        <button type="button" className="button-secondary" disabled={unreadNotifications === 0}
          aria-describedby={previewNoteIds.notificationList} onClick={session.readAllNotifications}>
          <PreviewIcon name="check" /> Đánh dấu tất cả đã đọc
        </button>
      </div>
    </div>

    <div className="bulk-bar">
      <span className="bulk-count">{chosen.length === 0 ? 'Chưa chọn thông báo nào'
        : chosenElsewhere === 0 ? `Đã chọn ${chosen.length}`
          : `Đã chọn ${chosen.length} · ${chosenElsewhere} mục nằm ngoài danh sách đang hiện`}</span>
      <div className="bulk-actions">
        <button type="button" className="button-secondary" disabled={chosen.length === 0}
          aria-describedby={previewNoteIds.notificationList}
          onClick={() => session.markNotificationsRead(chosen)}>Đánh dấu đã đọc</button>
        <button type="button" className="button-danger" disabled={chosen.length === 0}
          aria-describedby={previewNoteIds.notificationList}
          onClick={() => { session.deleteNotifications(chosen); setPicked([]) }}>
          <PreviewIcon name="trash" /> Xóa</button>
        <button type="button" className="text-link" disabled={chosen.length === 0}
          aria-describedby={previewNoteIds.notificationList} onClick={() => setPicked([])}>Bỏ chọn</button>
      </div>
    </div>

    {visible.length === 0
      ? <EmptyHint title="Không có kết quả" note="Đổi tab lọc ở trên để xem nhóm thông báo khác; tải lại trang sẽ trả hộp thư về danh sách ban đầu." />
      : <Panel title={panelTitleFor(tab)}>
        <div className="table-scroll">
          <table className="preview-table notice-table">
            <thead><tr>
              <th scope="col" className="check-cell">
                <label className="check-target"><input ref={headRef} type="checkbox"
                  aria-label="Chọn tất cả thông báo trên trang này"
                  checked={allVisibleChosen} onChange={toggleAll} /></label>
              </th>
              <th scope="col">Nội dung</th>
              <th scope="col">Loại</th>
              <th scope="col">Thời gian</th>
              <th scope="col">Trạng thái</th>
            </tr></thead>
            <tbody>{visible.map(item => <tr key={item.id} className={chosenSet.has(item.id) ? 'is-selected' : undefined}>
              <td className="check-cell">
                <label className="check-target"><input type="checkbox" checked={chosenSet.has(item.id)}
                  aria-label={`Chọn: ${item.title}`} onChange={() => toggleOne(item.id)} /></label>
              </td>
              <th scope="row">
                <button type="button" className="row-link" onClick={() => session.openSection('notifications', { notificationId: item.id })}>
                  {item.title}</button>
                <span className="row-sub">{item.context}</span>
              </th>
              <td><NoticeKind item={item} /></td>
              <td>{item.at}<span className="row-sub">{item.atFull}</span></td>
              <td><ReadBadge unread={item.unread} /></td>
            </tr>)}
            </tbody>
          </table>
        </div>
        <ActionNote id={previewNoteIds.notificationList}>{previewReasons.notificationList}</ActionNote>
      </Panel>}

    {/* Không có dòng nào thì không có gì để phân trang: `hideWhenEmpty` để nguyên thanh nghỉ,
        vì bản cũ vẫn in "Hiển thị 0–0 của 0" kèm một nút "1" đang bật — nói dối bằng số học
        (0–0 không phải một khoảng) và mời người dùng bấm vào chính trang họ đang đứng.
        EmptyHint phía trên đã nói cách ra khỏi tình huống này. */}
    <Pagination label="Phân trang thông báo" total={filtered.length} page={safePage} perPage={perPage}
      unit="thông báo" perPageOptions={perPageChoices.map(Number)} onPage={setPage}
      onPerPage={size => { setPerPage(size); setPage(1) }} hideWhenEmpty />
  </PreviewShell>
}
