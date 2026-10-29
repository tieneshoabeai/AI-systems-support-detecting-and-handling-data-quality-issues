import { useEffect, useMemo, useRef, useState } from 'react'
import type { ChangeEvent } from 'react'
import { Workspace3DView } from './workspace-3d.view'
import { extendedPreviewResources, previewResources } from './preview-resources'
import { localCsvResources, parseLocalCsv } from '../../math/workspace-3d/local-csv'
import type { LocalCsvDocument } from '../../types/workspace-3d/local-csv.types'
import { LocalCsvViewer } from './local-csv-viewer'

export function Workspace3DPreview() {
  const [extended, setExtended] = useState(false)
  const [documents, setDocuments] = useState<LocalCsvDocument[]>([])
  const [openId, setOpenId] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const request = useRef(0)
  useEffect(() => () => { request.current++ }, [])
  const resources = useMemo(() => documents.length ? localCsvResources(documents) : extended ? extendedPreviewResources : previewResources, [documents, extended])
  const opened = documents.find(document => document.id === openId)
  const chooseFiles = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.currentTarget.files ?? [])
    event.currentTarget.value = ''
    if (!files.length) return
    const captured = ++request.current
    setBusy(true); setError('')
    try {
      const loaded = await Promise.all(files.map(async file => {
        if (!/\.csv$/i.test(file.name)) throw new Error(`${file.name}: bản thử chỉ đọc file .csv.`)
        let text: string
        try { text = new TextDecoder('utf-8', { fatal: true }).decode(await file.arrayBuffer()) }
        catch { throw new Error(`${file.name}: không đọc được UTF-8. File gốc chưa bị thay đổi.`) }
        try { return { ...parseLocalCsv(text), name: file.name, id: `local-dataset:${crypto.randomUUID()}` } }
        catch (problem) { throw new Error(`${file.name}: ${problem instanceof Error ? problem.message : 'Không đọc được CSV.'}`) }
      }))
      if (request.current !== captured) return
      setDocuments(loaded); setOpenId(null)
    } catch (problem) {
      if (request.current === captured) setError(problem instanceof Error ? problem.message : 'Không đọc được file.')
    } finally { if (request.current === captured) setBusy(false) }
  }
  return <>
    <section className="local-csv-picker" aria-label="Thử xem file CSV trên máy" aria-busy={busy}>
      <label htmlFor="local-csv-files">Thử xem file CSV trên máy</label>
      <input id="local-csv-files" type="file" accept=".csv,text/csv" multiple disabled={busy} onChange={chooseFiles} />
      <p>Chọn một hoặc nhiều CSV UTF-8. Mỗi file có một Project và một Dataset thử nghiệm. Bấm khối, rồi bấm tên file hoặc “Xem dữ liệu”.</p>
      <p>Chỉ giữ trong bộ nhớ tab; tải lại trang sẽ xóa lựa chọn. File không được gửi lên máy chủ hoặc lưu vào storage.</p>
      {busy && <p role="status">Đang đọc file trên máy…</p>}
      {error && <p role="alert" className="feedback-error">{error}</p>}
    </section>
    <Workspace3DView key={documents.length ? documents.map(document => document.id).join('|') : String(extended)} resources={resources}
      localFileMode={documents.length > 0} onOpenDataset={documents.length ? setOpenId : undefined} />
    {!documents.length && <div className="resource-fixture-control"><button type="button" className="button-secondary" onClick={() => setExtended(value => !value)}>
      {extended ? 'Xem demo chuẩn · 6 tài nguyên' : 'Xem demo mở rộng · 30 tài nguyên'}
    </button></div>}
    {documents.length > 0 && <div className="resource-fixture-control"><button type="button" className="button-secondary" onClick={() => {
      request.current++; setDocuments([]); setOpenId(null); setError(''); setBusy(false)
    }}>Đóng file cục bộ, quay lại demo</button></div>}
    {opened && <LocalCsvViewer key={opened.id} document={opened} onClose={() => setOpenId(null)} />}
  </>
}
