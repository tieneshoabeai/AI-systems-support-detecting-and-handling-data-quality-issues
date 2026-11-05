import { useRef } from 'react'
import type { PreviewInfoRequest, PreviewMenuOrigin, PreviewSurfaceSide, Project } from '../../../types/preview/preview.types'
import { formatCount, formatDataSize, formatRows, pluralEn } from '../preview-data'
import { StatusBadge } from './preview-primitives'
import { anchorFromOrigin, useSurfaceDismiss, useSurfacePosition } from './preview-surface'

// Thẻ "Xem thông tin" của project — bản tóm tắt xem nhanh, không phải màn chi tiết.
//
// Nó tồn tại theo CON TRỎ đang lia trên item "Xem thông tin" trong menu ⋯ (đặc tả Home của chủ
// sở hữu batch): lia vào item là thẻ bay ra cạnh item, rời item là thẻ tắt. Bấm item thì menu
// đóng và thẻ ở lại cạnh nút ⋯ — bàn phím không có hover nên phải còn một lối vào không phụ
// thuộc con trỏ. Vì vậy thẻ KHÔNG nhận chuột (pointer-events: none trong CSS): nhận chuột thì nó
// chiếm ngay chỗ con trỏ đang đứng trên item, con trỏ không còn ở trên item nữa, thẻ tắt, rồi
// lại bật — nháy liên tục.
//
// Thẻ là phần XEM NHANH THỊ GIÁC: mọi chữ trong nó (tên · mô tả · workspace · trạng thái ·
// chủ sở hữu · cập nhật · tệp) đã có sẵn trên chính dòng bảng, nên người dùng bàn phím hay
// screen reader không mất thông tin nào khi thẻ không hiện — và nó không cần là một dialog
// nhận focus. Muốn đọc đủ thì đã có "Mở Project".

// Wrapper return null trước khi có hook (đúng khuôn PreviewContextMenu): component surface
// bên dưới được mount mới mỗi lần mở nên useSurfacePosition đo lại từ đầu.
export function ProjectInfoCard({ request, projects, onClose }: {
  request: PreviewInfoRequest | null
  projects: readonly Project[]
  onClose: () => void
}) {
  const project = request === null ? undefined : projects.find(item => item.id === request.projectId)
  // Item của menu vừa bị đóng (hoặc dòng vừa bị gỡ khỏi danh sách) khi thẻ còn neo vào nó:
  // origin trỏ vào phần tử không còn trên DOM, getBoundingClientRect của nó trả toàn 0 → thẻ
  // nổi góc màn hình.
  const detached = request !== null && request.origin.kind === 'anchor' && !request.origin.element.isConnected
  if (request === null || project === undefined || detached) return null
  return <InfoSurface project={project} origin={request.origin} side={request.side} onClose={onClose} />
}

function InfoSurface({ project, origin, side, onClose }: {
  project: Project
  origin: PreviewMenuOrigin
  side: PreviewSurfaceSide
  onClose: () => void
}) {
  const ref = useRef<HTMLDivElement>(null)
  const point = useSurfacePosition(ref, anchorFromOrigin(origin), 'start', side)
  // Surface không nhận chuột nên mỗi cú bấm đều là "bấm ra ngoài" → thẻ đóng. Thêm Esc và
  // cuộn/thay cỡ (thẻ fixed sẽ trôi khỏi dòng nó neo vào) theo đúng bộ quy tắc của menu.
  useSurfaceDismiss(true, onClose, ref)

  const dataset = project.dataset

  return <div ref={ref} className="pv-info-card" data-side={point.flipped ? 'top' : 'bottom'}
    style={{ left: point.x, top: point.y }}>
    <div className="info-card-head">
      <span className="info-card-name">{project.name}</span>
      <StatusBadge status={project.status} />
    </div>
    <p className="info-card-code">{project.code}</p>

    <dl className="info-card-facts">
      <dt>Workspace</dt><dd>{project.workspaceName}</dd>
      <dt>Chủ sở hữu</dt><dd>{project.owner.name}</dd>
      <dt>Thành viên</dt><dd>{pluralEn(project.members.length, 'member')}</dd>
      {/* 'chưa có' là trạng thái thật của project mới tạo; xóa dòng này đi thì người đọc
          không phân biệt được "chưa nạp" với "số liệu bằng 0". */}
      <dt>Tập dữ liệu</dt>
      <dd>{dataset === null
        ? 'chưa có tập dữ liệu'
        : <>
          <span className="info-card-file">{dataset.fileName}</span>
          {' · '}{formatRows(dataset.rows)} · {formatDataSize(dataset.sizeMb)} · {formatCount(dataset.columns)} cột
        </>}</dd>
      <dt>Tạo lúc</dt><dd>{project.createdAt}</dd>
      <dt>Cập nhật</dt><dd>{project.updatedAt}</dd>
    </dl>

    {/* Mô tả dài nhất 500 ký tự (descMax trong project-wizard.tsx). Thẻ xem nhanh không được
        cao hơn màn hình nên kẹp ba dòng; bản đầy đủ nằm trong trang Project. */}
    {project.description !== '' && <p className="info-card-desc">{project.description}</p>}
    {/* Hint không được gọi tên một mục menu hay một nút: thẻ này mở ra từ hai menu có NHÃN khác
        nhau ("Xem thông tin" ở danh sách project · "Thông tin Project" ở ⋯ của dataset trong
        trang Project), và trang Project thì không có mục "Mở Project" — người dùng đang đứng ở
        đó rồi. Cách đóng viết theo tín hiệu thật (bấm ra ngoài · Esc), không theo con trỏ. */}
    <p className="info-card-hint">Bản xem nhanh — bấm ra ngoài hoặc Esc để đóng thẻ · Trang Project là bản đầy đủ</p>
  </div>
}
