import { useEffect, useRef, useState } from 'react'
import type { LocalCsvDocument } from '../../types/workspace-3d/local-csv.types'

const pageSize = 50

export function LocalCsvViewer({ document: csv, onClose }: { document: LocalCsvDocument; onClose(): void }) {
  const dialog = useRef<HTMLDialogElement>(null)
  const [page, setPage] = useState(0)
  const pages = Math.max(1, Math.ceil(csv.rows.length / pageSize))
  useEffect(() => {
    const element = dialog.current!
    element.showModal()
    return () => element.close()
  }, [])
  const start = page * pageSize
  return <dialog ref={dialog} className="local-csv-dialog" aria-labelledby="local-csv-title"
    onCancel={event => { event.preventDefault(); onClose() }}>
    <header><div><span className="eyebrow">CSV TRÊN MÁY · CHỈ ĐỌC</span><h2 id="local-csv-title">{csv.name}</h2></div>
      <button type="button" className="button-secondary" onClick={onClose}>Đóng bảng dữ liệu</button></header>
    <p>{csv.rows.length} dòng dữ liệu · {csv.headers.length} cột · Phân cách: {csv.delimiter === '\t' ? 'Tab' : csv.delimiter}</p>
    <div className="local-csv-table" tabIndex={0} role="region" aria-label={`Bảng dữ liệu ${csv.name}`}>
      <table><caption className="local-csv-caption">Nội dung file {csv.name}</caption><thead><tr><th scope="col">Dòng</th>
        {csv.headers.map((header, index) => <th scope="col" key={index}>{header || `Cột ${index + 1} (không tên)`}</th>)}
      </tr></thead><tbody>
        {csv.rows.slice(start, start + pageSize).map((row, index) => <tr key={start + index}>
          <th scope="row">{start + index + 1}</th>{row.map((value, col) => <td key={col}>{value === '' ? <span className="local-csv-empty">(trống)</span> : value}</td>)}
        </tr>)}
      </tbody></table>
      {!csv.rows.length && <p>File có tiêu đề nhưng chưa có dòng dữ liệu.</p>}
    </div>
    <footer><button type="button" className="button-secondary" disabled={page === 0} onClick={() => setPage(value => value - 1)}>Trang trước</button>
      <span role="status">Trang {page + 1}/{pages} · {csv.rows.length ? `${start + 1}–${Math.min(start + pageSize, csv.rows.length)}` : '0'} / {csv.rows.length} dòng</span>
      <button type="button" className="button-secondary" disabled={page + 1 >= pages} onClick={() => setPage(value => value + 1)}>Trang sau</button></footer>
    <p>Đọc từ file bạn chọn trong tab này. Chưa upload hoặc lưu vào trình duyệt. Bấm Escape để đóng.</p>
  </dialog>
}
