import { requireDefined } from '../../../utils/required-value'
import type { ReactNode } from 'react'
import type { CoverHue, DatasetStatus, ProjectStatus, TrendStat, WorkspaceStatus } from '../../../types'
import { Icon as PreviewIcon } from '../../ui/primitives/icon'
import { SelectedResourceArt } from '../avatar/resource-avatar'
import { useResourceAvatar } from '../../../hooks/resource/use-resource-avatar'
import { AdaptiveArt } from '../artwork/adaptive-art'
import { Badge } from '../../ui/primitives/badge'
import { Tabs } from '../../ui/data-display/tabs'
import { Panel as UiPanel } from '../../ui/layout/panel'
import { EmptyState } from '../../ui/feedback/empty-state'
import { Pagination as UiPagination } from '../../ui/data-display/pagination'

const workspaceLabels: Record<WorkspaceStatus, string> = { active: 'Đang hoạt động', paused: 'Tạm dừng', archived: 'Đã lưu trữ' }
const projectLabels: Record<ProjectStatus, string> = {
  active: 'Đang hoạt động', paused: 'Tạm dừng', processing: 'Đang xử lý', completed: 'Đã hoàn thành', archived: 'Đã lưu trữ',
}
const datasetLabels: Record<DatasetStatus, string> = { processed: 'Đã xử lý', processing: 'Đang xử lý', queued: 'Trong hàng đợi', failed: 'Lỗi' }

export function StatusBadge({ status }: { status: WorkspaceStatus | ProjectStatus | DatasetStatus }) {
  const label = workspaceLabels[status as WorkspaceStatus]
    ?? projectLabels[status as ProjectStatus]
    ?? datasetLabels[status as DatasetStatus]
  const tone = status === 'active' || status === 'processed' ? 'ok'
    : status === 'completed' ? 'done'
      : status === 'archived' ? 'muted'
        : status === 'failed' ? 'danger'
          : 'warn'
  return <Badge tone={tone}>{label}</Badge>
}

// Icon của thẻ số liệu chọn theo TONE, không theo tên tone: bản cũ truyền thẳng `stat.tone`
// vào PreviewIcon, mà 'brand'/'accent' không phải tên icon có thật → PreviewIcon rơi về
// hình dự phòng (hình trụ dữ liệu) và hai thẻ Workspaces/Projects âm thầm hiện sai icon.
// Cách cũ còn đoán icon theo tiền tố id ('ws'/'pj') — đổi id là đổi hình, không ai báo.
const toneIcons: Record<TrendStat['tone'], string> = {
  brand: 'workspaces', accent: 'projects', violet: 'data-views', cyan: 'datasets', green: 'check', orange: 'clock',
}

export function StatCard({ stat }: { stat: TrendStat }) {
  return <article className={`stat-card stat-tone-${stat.tone}`}>
    <span className="stat-icon" aria-hidden="true"><PreviewIcon name={stat.icon ?? toneIcons[stat.tone] ?? toneIcons.brand} /></span>
    <span className="stat-value">{stat.value}</span>
    <span className="stat-label">{stat.label}</span>
    {stat.delta && <span className="stat-delta">{stat.delta}</span>}
  </article>
}

export function StatRow({ stats }: { stats: readonly TrendStat[] }) {
  return <div className="stat-row">{stats.map(stat => <StatCard key={stat.id} stat={stat} />)}</div>
}

export type TabItem<T extends string> = { id: T; label: string }

export function FilterTabs<T extends string>({ tabs, active, onChange, label }: {
  tabs: readonly TabItem<T>[]
  active: T
  onChange: (id: T) => void
  label: string
}) {
  return <Tabs tabs={tabs} active={active} onChange={onChange} label={label} />
}

export function DetailTabs<T extends string>({ tabs, active, onChange, label }: {
  tabs: readonly TabItem<T>[]
  active: T
  onChange: (id: T) => void
  label: string
}) {
  return <Tabs tabs={tabs} active={active} onChange={onChange} label={label} variant="detail" />
}

export function CoverArt({ hue, seed, kind = 'workspace' }: { hue: CoverHue; seed: string | number; kind?: 'workspace' | 'project' }) {
  const avatar = useResourceAvatar(kind, String(seed))
  // ID ổn định giữ ảnh nhất quán giữa danh sách, chi tiết và hộp sửa;
  // không chọn ảnh theo vị trí hiện tại hay tên có thể đổi của bản ghi.
  const hash = Array.from(String(seed)).reduce((value, char) => (Math.imul(value, 31) + char.charCodeAt(0)) >>> 0, 0)
  const motif = requireDefined((kind === 'workspace' ? ['network', 'orbits', 'lattice'] : ['flow', 'scan', 'branches'])[hash % 3], 'cover motif')
  return avatar ? <SelectedResourceArt value={avatar} /> : <span className={`cover-art adaptive-cover cover-${hue} cover-kind-${kind}`} aria-hidden="true" data-seed={seed} data-art={hash % 3}><AdaptiveArt motif={motif} tone={hue} /></span>
}

export function Panel({ title, action, children, className }: {
  title: string
  action?: ReactNode
  children: ReactNode
  className?: string
}) {
  return <UiPanel title={title} action={action} {...(className === undefined ? {} : { className })}>{children}</UiPanel>
}

export function TextLink({ children, onClick, disabled, describedBy }: {
  children: ReactNode
  onClick?: () => void
  disabled?: boolean
  describedBy?: string
}) {
  return <button type="button" className="text-link" disabled={disabled} aria-describedby={describedBy} onClick={onClick}>{children} <span aria-hidden="true">→</span></button>
}

// Dòng lý do cho control đang tắt. Shared UI yêu cầu lý do nằm trong text ngữ cảnh,
// không chỉ tooltip khi hover → note render luôn nhìn thấy, nút tắt trỏ aria-describedby về đây.
export function ActionNote({ id, children }: { id: string; children: ReactNode }) {
  return <p className="action-note" id={id}>{children}</p>
}

export function EmptyHint({ title, note }: { title: string; note: string }) {
  return <EmptyState title={title} note={note} />
}

/* ---------- Phân trang dùng chung ----------
   Sáu chỗ từng tự viết lại đúng một khối nav.pagination (Home · trang Projects · danh sách
   Workspaces · bảng project của workspace · roster thành viên · hai màn thông báo). Một
   khuôn duy nhất ở đây để luật lệ về nhãn/nút (aria-label 'Trang trước'/'Trang sau',
   aria-current='page') không lệch nhau giữa hai trang — đó đúng là loại lỗi mà cả sáu bản
   copy đang mang: sửa một trang thì năm trang kia im lặng giữ kiểu cũ.

   `unit` thiếu → không vẽ dòng "Hiển thị…" (hai khung gần đây trên Home tự lướt nên chủ
   batch bỏ dòng đó). `perPageOptions` thiếu → không vẽ ô "Số dòng". */
export type PaginationProps = {
  /** aria-label của nav, ví dụ 'Phân trang dự án'. */
  label: string
  /** Số bản ghi SAU bộ lọc — chính là tổng mà dòng "của N …" báo. */
  total: number
  page: number
  perPage: number
  onPage: (page: number) => void
  /** Đơn vị ở dòng "Hiển thị 1–28 của 40 Workspace". */
  unit?: string
  perPageOptions?: readonly number[]
  onPerPage?: (size: number) => void
  /** Danh sách rỗng → ẩn cả thanh (hai màn thông báo): EmptyHint đã nói hết rồi. */
  hideWhenEmpty?: boolean
  /** Một trang duy nhất → ẩn hẳn (Home): một nút "1" đứng một mình không nói thêm gì. */
  hideWhenSinglePage?: boolean
}

export function Pagination({
  label, total, page, perPage, onPage, unit, perPageOptions, onPerPage, hideWhenEmpty, hideWhenSinglePage,
}: PaginationProps) {
  return <UiPagination label={label} total={total} page={page} perPage={perPage} onPage={onPage}
    {...(unit === undefined ? {} : { unit })}
    {...(perPageOptions === undefined ? {} : { perPageOptions })}
    {...(onPerPage === undefined ? {} : { onPerPage })}
    {...(hideWhenEmpty === undefined ? {} : { hideWhenEmpty })}
    {...(hideWhenSinglePage === undefined ? {} : { hideWhenSinglePage })} />
}

// Hai biểu đồ dựng bằng CSS thuần (không thêm thư viện — ảnh chỉ cần cột + nhãn + số, và
// donut + legend). Tái dùng cho cả Home và trang chi tiết workspace để một nguồn một kiểu.
// Số in ra là text thật nên máy đọc màn hình đọc được; donut không có chữ nên aria-hidden.
const statusPalette = ['var(--pv-orange)', 'var(--pv-cyan)', 'var(--pv-green)']

export type ChartRow = { id?: string; label: string; value: number }

export function ProgressBar({ data, emptyTitle = 'Chưa có dữ liệu', emptyNote = 'Biểu đồ sẽ hiển thị khi có dữ liệu.' }: {
  data: readonly ChartRow[]
  emptyTitle?: string
  emptyNote?: string
}) {
  // Cột KHÔNG có bản ghi nào thì phải nói rõ bằng chữ, không trả về một khung rỗng:
  // panel "Projects per Workspace" của bộ dữ liệu trống từng vẽ 0px chữ và người xem
  // không phân biệt được "chưa có" với "biểu đồ bị lỗi".
  if (data.length === 0) return <EmptyHint title={emptyTitle} note={emptyNote} />
  const max = Math.max(1, ...data.map(item => item.value))
  return <div className="pv-bars">
    {/* Key lấy theo id khi bản ghi có id (hai workspace trùng tên là trạng thái hợp lệ của
        dữ liệu thật); nhãn chỉ là chữ vẽ ra nên không đủ để định danh một cột. */}
    {data.map((item, index) => <div className="pv-col" key={item.id ?? `${item.label}-${index}`}>
      <div className="pv-bar-track"><span className="pv-bar" style={{ height: `${Math.max(2, Math.round(item.value / max * 100))}%` }} /></div>
      <span className="pv-bar-value">{item.value}</span>
      <span className="pv-bar-label" title={item.label}>{item.label}</span>
    </div>)}
  </div>
}

export function StatusDonut({ total, rows, unit = 'project', emptyTitle = 'Chưa có project', emptyNote = 'Chưa có project để thống kê.' }: {
  total: number
  rows: readonly { label: string; value: number }[]
  unit?: string
  emptyTitle?: string
  emptyNote?: string
}) {
  if (total === 0) return <EmptyHint title={emptyTitle} note={emptyNote} />
  const stops = rows.map((row, index) => {
    const before = rows.slice(0, index).reduce((sum, item) => sum + item.value, 0) / total * 360
    const until = before + row.value / total * 360
    return `${statusPalette[index % statusPalette.length]} ${before.toFixed(1)}deg ${until.toFixed(1)}deg`
  }).join(', ')
  return <div className="share-chart">
    <span className="donut" aria-hidden="true" style={{ background: `conic-gradient(${stops})` }}>
      <span className="donut-hole"><strong>{total}</strong><small>{unit}</small></span>
    </span>
    <ul className="legend">
      {/* Chấm màu legend PHẢI lấy đúng màu lát cắt tương ứng. CSS của .legend-dot vẽ sẵn
          một gradient xanh-tím cố định, nên ba dòng legend từng ba màu giống hệt nhau
          trong khi donut có ba lát khác màu → không đọc được dòng nào là phần nào. */}
      {rows.map((row, index) => <li key={row.label}>
        <span className="legend-dot" aria-hidden="true" style={{ background: statusPalette[index % statusPalette.length] }} />
        <span>{row.label}</span>
        <span className="legend-value">{row.value} ({(row.value / total * 100).toFixed(1)}%)</span>
      </li>)}
    </ul>
  </div>
}
