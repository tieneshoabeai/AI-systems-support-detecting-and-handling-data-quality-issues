// Lucian UX/UI Prompt #432 · MIT License (c) 2026 Seokwoooo · https://lucianlabs.dev/uxui-prompt/#432
import { useId, useRef, useState } from 'react'
import type { DragEvent } from 'react'
import styles from './project-csv-drop-zone.module.css'

type Props = {
  file: File | null
  phase: 'idle' | 'pending' | 'success'
  disabled: boolean
  descriptionId: string
  onSelect: (file: File | null) => void
}

export function ProjectCsvDropZone({ file, phase, disabled, descriptionId, onSelect }: Props) {
  const input = useRef<HTMLInputElement>(null)
  const dragDepth = useRef(0)
  const [dragging, setDragging] = useState(false)
  const inputId = useId()
  const fileLabelId = useId()
  const isFileDrag = (event: DragEvent) => Array.from(event.dataTransfer.types).includes('Files')
  const activeDrag = dragging && !disabled
  const status = phase === 'pending' ? 'Đang tải lên và chờ máy chủ xác nhận.'
    : phase === 'success' ? 'Đã tải lên thành công.'
      : file ? `Đã chọn ${file.name}.` : ''

  return <div className={styles['u432']} data-phase={phase} data-dragging={activeDrag} data-selected={file !== null}
    onDragEnter={event => {
      if (!isFileDrag(event)) return
      event.preventDefault()
      if (disabled) return
      dragDepth.current += 1
      setDragging(true)
    }}
    onDragOver={event => {
      if (!isFileDrag(event)) return
      event.preventDefault()
      event.dataTransfer.dropEffect = disabled ? 'none' : 'copy'
    }}
    onDragLeave={() => {
      dragDepth.current = Math.max(0, dragDepth.current - 1)
      if (!dragDepth.current) setDragging(false)
    }}
    onDrop={event => {
      if (!isFileDrag(event) && !event.dataTransfer.files.length) return
      event.preventDefault()
      dragDepth.current = 0
      setDragging(false)
      if (!disabled && event.dataTransfer.files[0]) onSelect(event.dataTransfer.files[0])
    }}>
    <button type="button" className={styles['zone']} disabled={disabled} aria-label="Chọn tệp CSV"
      aria-describedby={file && !activeDrag ? `${descriptionId} ${fileLabelId}` : descriptionId} onClick={() => input.current?.click()}>
      {file && !activeDrag ? <span className={styles['selected']} key={`${file.name}-${file.lastModified}`}>
        <span className={styles['stage']} aria-hidden="true">
          {phase !== 'idle' && <svg className={styles['ring']} viewBox="0 0 100 100">
            <circle className={styles['track']} cx="50" cy="50" r="46" />
            <circle className={styles['arc']} cx="50" cy="50" r="46" />
          </svg>}
          <svg className={styles['document']} viewBox="0 0 50 62">
            <path className={styles['paper']} d="M6 1h26l15 15v39a6 6 0 0 1-6 6H6a6 6 0 0 1-6-6V7a6 6 0 0 1 6-6z" />
            <path className={styles['fold']} d="M32 1v10a5 5 0 0 0 5 5h10z" />
            <rect className={styles['inkLine']} x="9" y="22" width="24" height="3" rx="1.5" />
            <rect className={styles['inkLine']} x="9" y="29" width="30" height="3" rx="1.5" />
            <rect className={styles['tag']} x="-4" y="40" width="28" height="14" rx="3.5" />
            <text x="10" y="50" textAnchor="middle">CSV</text>
          </svg>
          {phase === 'success' && <span className={styles['check']}>
            <svg viewBox="0 0 24 24"><path d="m5 12.5 4.5 4.5L19 7.5" /></svg>
          </span>}
        </span>
        <span id={fileLabelId} className={styles['filename']}>{file.name}</span>
      </span> : <span className={styles['idle']}>
        <span className={styles['uploadIcon']} aria-hidden="true">
          <svg viewBox="0 0 24 24"><path d="M12 16V5M7 9.5 12 4.5l5 5M5 15v2.5A2.5 2.5 0 0 0 7.5 20h9a2.5 2.5 0 0 0 2.5-2.5V15" /></svg>
        </span>
        <strong>{activeDrag ? 'Thả tệp để chọn' : 'Kéo thả CSV vào đây'}</strong>
        <small>{activeDrag ? 'CSV UTF-8' : 'Hoặc bấm để chọn tệp'}</small>
      </span>}
    </button>
    <label htmlFor={inputId} className="visually-hidden">Chọn tệp dữ liệu</label>
    <input ref={input} id={inputId} className={styles['file']} type="file" accept=".csv,text/csv" tabIndex={-1}
      aria-describedby={descriptionId} disabled={disabled} onChange={event => {
        onSelect(event.currentTarget.files?.[0] ?? null)
        event.currentTarget.value = ''
      }} />
    <span role="status" className="visually-hidden">{status}</span>
  </div>
}
