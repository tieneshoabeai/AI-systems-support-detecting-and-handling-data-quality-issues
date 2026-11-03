import { useMemo, useState } from 'react'
import type { PreviewReport, ReportAttachment, ReportFilterTab, ReportIssueType, ReportStatus } from '../../../types/preview/preview.types'
import {
  matchReportQuery, matchReportTab, previewNoteIds, previewReasons,
  reportIssueTypeLabels, reportIssueTypeOptions, reportStatusMeta, reportTabsFor,
} from '../preview-data'
import { PreviewIcon } from './preview-icons'
import { FilterTabs, Pagination } from './preview-primitives'
import { usePreviewSession } from '../preview-session-context'

// Trung tâm báo cáo vấn đề chạy HOÀN TOÀN trong ô popover của nút "?" trên topbar, theo đặc tả
// `UI-UX/Global Application Shell/đặc tả.txt` dòng 7: bấm "?" có 2 nút (tạo báo cáo mới · xem tất
// cả báo cáo); form tạo có 4 trường (loại vấn đề · tiêu đề · mô tả chi tiết · tệp đính kèm tùy
// chọn); "hủy thì về trang home", "gửi báo cáo thì thông báo gửi thành công"; "xem tất cả" phân
// trang 6 cái; bấm một báo cáo xem chi tiết + trạng thái xử lý — "chỉ hiển thị trên ô nhỏ không
// hiển thị cả trang". Bốn khung 02/03.1/03.2/03.3 của Design Board vì thế là bốn VIEW nội bộ của
// cùng một popover, không phải bốn route. Không thao tác nào ghi hash.
//
// Icon: nút topbar dùng glyph "?" (đúng đặc tả), còn hero trong ô dùng glyph "report" (ngọn cờ
// báo hiệu) — hai chỗ hai việc, không phải hai bản sao của cùng một nút.

// 6 dòng/trang theo đúng con số đặc tả nêu ("chuyển trang hiển thị 6 cái là được").
const perPage = 6

type CenterView = 'landing' | 'create' | 'list' | 'detail'

// Định dạng dung lượng tệp người dùng vừa chọn. Frame không đọc nội dung tệp (chưa có API upload)
// nên chỉ hiển thị tên + cỡ do trình duyệt báo lại — không bịa "đã tải lên".
const formatSize = (bytes: number): string =>
  bytes >= 1_048_576 ? `${(bytes / 1_048_576).toFixed(1)} MB`
    : bytes >= 1024 ? `${Math.round(bytes / 1024)} KB`
      : `${bytes} B`

// Chip trạng thái xử lý (khung 3.4). Bốn tone khớp bốn màu trong ảnh, dùng lại họ màu của shell.
function ReportStatusChip({ status }: { status: ReportStatus }) {
  const meta = reportStatusMeta[status]
  return <span className={`report-chip tone-${meta.tone}`}>{meta.label}</span>
}

// Một dòng ở danh sách "Báo cáo của tôi" (3.2). Ảnh vẽ bảng 5 cột, nhưng ô chỉ ~440px nên
// dồn thành dòng: trái = tiêu đề + mã·loại, phải = chip trạng thái + thời gian cập nhật.
function ReportRow({ item, onOpen }: { item: PreviewReport; onOpen: () => void }) {
  return <button type="button" className="report-row" onClick={onOpen}>
    <span className="report-row-main">
      <strong>{item.title}</strong>
      <small>{item.code} · {reportIssueTypeLabels[item.issueType]}</small>
    </span>
    <span className="report-row-side">
      <ReportStatusChip status={item.status} />
      <span className="report-row-at">{item.updatedAt}</span>
    </span>
  </button>
}

export function ReportCenter() {
  const session = usePreviewSession()
  const { state } = session

  const [view, setView] = useState<CenterView>('landing')
  const [tab, setTab] = useState<ReportFilterTab>('all')
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)
  const [detailId, setDetailId] = useState<string | null>(null)

  // Trường của form tạo (3.1). issueType rỗng = chưa chọn → bắt buộc trước khi gửi.
  const [issueType, setIssueType] = useState<'' | ReportIssueType>('')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [attachment, setAttachment] = useState<ReportAttachment | null>(null)
  const [error, setError] = useState('')

  const filtered = useMemo(
    () => state.reports.filter(item => matchReportTab(item, tab) && matchReportQuery(item, query)),
    [state.reports, tab, query],
  )
  const pageCount = Math.max(1, Math.ceil(filtered.length / perPage))
  const safePage = Math.min(page, pageCount)
  const visible = filtered.slice((safePage - 1) * perPage, safePage * perPage)

  const detail = detailId ? state.reports.find(item => item.id === detailId) ?? null : null

  const resetForm = (): void => { setIssueType(''); setTitle(''); setDescription(''); setAttachment(null); setError('') }
  const goCreate = (): void => { resetForm(); setView('create') }
  const goList = (): void => { setView('list') }
  const backToLanding = (): void => { setView('landing'); setQuery(''); setPage(1) }
  const openDetail = (id: string): void => { setDetailId(id); setView('detail') }

  const onPickFile = (files: FileList | null): void => {
    const file = files?.[0]
    if (!file) return
    // Chỉ ghi nhận tên + cỡ. Chưa có API nên không "đọc" hay "tải" tệp — nói rõ ở footnote.
    setAttachment({ name: file.name, sizeLabel: formatSize(file.size) })
  }

  const submit = (): void => {
    // Validate khi bấm gửi thay vì tắt nút: nút "Gửi báo cáo" luôn bật (khớp ảnh), thiếu trường
    // thì nói ngay trong form — không có control tắt không lý do.
    if (!issueType || !title.trim() || !description.trim()) {
      const missing: string[] = []
      if (!issueType) missing.push('loại vấn đề')
      if (!title.trim()) missing.push('tiêu đề')
      if (!description.trim()) missing.push('mô tả chi tiết')
      setError(`Cần điền ${missing.join(', ')} trước khi gửi báo cáo.`)
      return
    }
    // Qua được nhánh trên thì issueType chắc chắn là một loại hợp lệ (bỏ được ''), nên TS thu hẹp
    // đúng kiểu cho createReport.
    session.createReport({ issueType, title, description, attachment })
    resetForm()
    // Sau khi gửi, nhảy sang danh sách để người dùng thấy ngay bản ghi vừa thêm ở đầu.
    setTab('all'); setPage(1); setView('list')
  }

  return <div className="notice-center report-center">
    {view === 'landing' && <>
      <div className="report-hero">
        <span className="report-hero-icon" aria-hidden="true"><PreviewIcon name="report" /></span>
        <strong>Báo cáo vấn đề</strong>
        <p>Gửi phản hồi về sự cố, lỗi hoặc vấn đề khác liên quan đến hệ thống DataVerse.</p>
      </div>
      <div className="report-hero-actions">
        <button type="button" className="button-primary" onClick={goCreate}>
          <PreviewIcon name="plus" /> Tạo báo cáo mới</button>
        <button type="button" className="button-secondary" onClick={goList}>
          <PreviewIcon name="list" /> Xem các báo cáo của tôi</button>
      </div>
      <p className="popover-note" id={previewNoteIds.report}>{previewReasons.report}</p>
    </>}

    {view === 'create' && <>
      <div className="popover-head">
        <button type="button" className="back-link" onClick={backToLanding}>
          <span className="back-arrow" aria-hidden="true">←</span> Tạo báo cáo mới
        </button>
      </div>

      <div className="report-form">
        <label className="field">
          <span className="field-label">Loại vấn đề <span className="req" aria-hidden="true">*</span></span>
          <select value={issueType} onChange={event => setIssueType(event.target.value as ReportIssueType)}>
            <option value="">— Chọn loại vấn đề —</option>
            {reportIssueTypeOptions.map(option => <option key={option} value={option}>{reportIssueTypeLabels[option]}</option>)}
          </select>
        </label>

        <label className="field">
          <span className="field-label">Tiêu đề <span className="req" aria-hidden="true">*</span></span>
          <input type="text" value={title} maxLength={120} placeholder="Tóm tắt ngắn gọn vấn đề gặp phải"
            onChange={event => setTitle(event.target.value)} />
        </label>

        <label className="field">
          <span className="field-label">Mô tả chi tiết <span className="req" aria-hidden="true">*</span></span>
          <textarea rows={4} value={description} placeholder="Chuyện gì xảy ra, khi nào, ở dự án/tập dữ liệu nào…"
            onChange={event => setDescription(event.target.value)} />
        </label>

        <div className="field">
          <span className="field-label">Tệp đính kèm (tùy chọn)</span>
          {attachment === null
            ? <label className="dropzone">
              <input type="file" className="visually-hidden" aria-label="Chọn tệp đính kèm"
                onChange={event => onPickFile(event.target.files)} />
              <span className="dropzone-text">Kéo tệp vào đây hoặc <span className="dropzone-pick">Chọn tệp</span></span>
              <small>Hỗ trợ .JPG, .PNG, .PDF, .ZIP (tối đa 20 MB)</small>
            </label>
            : <div className="attachment">
              <span className="attachment-name"><PreviewIcon name="file" /> {attachment.name} ({attachment.sizeLabel})</span>
              <button type="button" className="icon-button sm" aria-label="Bỏ tệp đính kèm" onClick={() => setAttachment(null)}>
                <PreviewIcon name="close" />
              </button>
            </div>}
        </div>

        {error !== '' && <p className="form-error" role="alert">{error}</p>}

        <div className="form-actions">
          <button type="button" className="button-secondary" onClick={backToLanding}>Hủy</button>
          <button type="button" className="button-primary" onClick={submit}>Gửi báo cáo</button>
        </div>
      </div>
      <p className="popover-note" id={previewNoteIds.report}>{previewReasons.report}</p>
    </>}

    {view === 'list' && <>
      <div className="popover-head">
        <button type="button" className="back-link" onClick={backToLanding}>
          <span className="back-arrow" aria-hidden="true">←</span> Báo cáo của tôi
        </button>
        <button type="button" className="text-link" onClick={goCreate}>Tạo báo cáo mới</button>
      </div>

      <FilterTabs tabs={reportTabsFor(state.reports)} active={tab}
        onChange={id => { setTab(id); setPage(1) }} label="Lọc báo cáo" />

      <div className="popover-search">
        <span aria-hidden="true"><PreviewIcon name="search" /></span>
        <input role="searchbox" aria-label="Tìm kiếm báo cáo" value={query} autoFocus
          placeholder="Tìm kiếm báo cáo…"
          onChange={event => { setQuery(event.target.value); setPage(1) }} />
      </div>

      {visible.length === 0
        ? <p className="notice-empty">Không có báo cáo khớp bộ lọc hoặc từ khóa “{query}”.</p>
        : <ul className="report-list">{visible.map(item => <li key={item.id}>
          <ReportRow item={item} onOpen={() => openDetail(item.id)} />
        </li>)}</ul>}

      {/* Khuôn phân trang DÙNG CHUNG (preview-primitives) thay vì tự viết lại nav.pagination:
          bản cũ chép tay đúng 60 dòng markup của Pagination, nên mỗi lần luật nút đổi là ô báo
          cáo lệch âm thầm mà không ai biết. Không truyền `unit` — chủ batch 03/11 bỏ dòng
          "Hiển thị 1–6 của 8 báo cáo" trong Ô; trang vẫn lật được bằng nút số. */}
      <Pagination label="Phân trang báo cáo" total={filtered.length} page={safePage} perPage={perPage}
        onPage={setPage} hideWhenEmpty />
      <p className="popover-note" id={previewNoteIds.report}>{previewReasons.report}</p>
    </>}

    {view === 'detail' && <>
      <div className="popover-head">
        <button type="button" className="back-link" onClick={goList}>
          <span className="back-arrow" aria-hidden="true">←</span> Chi tiết báo cáo
        </button>
      </div>

      {detail === null
        ? <p className="notice-empty">Báo cáo này không còn trong danh sách mẫu — có thể vừa bị Hoàn tác.</p>
        : <div className="detail-body">
          <div className="report-detail-head">
            <code className="report-code">{detail.code}</code>
            <ReportStatusChip status={detail.status} />
          </div>
          <strong className="report-detail-title">{detail.title}</strong>
          <dl className="detail-meta">
            <div><dt>Loại vấn đề</dt><dd>{reportIssueTypeLabels[detail.issueType]}</dd></div>
            <div><dt>Thời gian tạo</dt><dd>{detail.createdAt}</dd></div>
            <div><dt>Cập nhật cuối</dt><dd>{detail.updatedAt}</dd></div>
          </dl>
          <h3 className="notice-desc-head">Mô tả chi tiết</h3>
          <p className="notice-desc">{detail.description}</p>
          <h3 className="notice-desc-head">Tệp đính kèm ({detail.attachment ? 1 : 0})</h3>
          {detail.attachment
            ? <div className="attachment static">
              <span className="attachment-name"><PreviewIcon name="file" /> {detail.attachment.name} ({detail.attachment.sizeLabel})</span>
            </div>
            : <p className="notice-empty">Báo cáo này không kèm tệp.</p>}
        </div>}
      <p className="popover-note" id={previewNoteIds.report}>{previewReasons.report}</p>
    </>}
  </div>
}
