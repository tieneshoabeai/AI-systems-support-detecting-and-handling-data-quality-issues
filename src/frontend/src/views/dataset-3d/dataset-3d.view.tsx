import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router'
import { HolographicCoreCanvas } from '../../components/graphics/holographic-core/holographic-core.scene'
import type { CubeFocus } from '../../types/dataset-3d/cube-focus.types'
import { NEON_CUBE_LABELS } from '../../graphics/neon-cube/neon-cube-label.config'
import type { NeonCubeThemeId } from '../../types/dataset-3d/cube-focus.types'
import type { HolographicPartInfo } from '../../types/dataset-3d/holographic-part.types'
import './dataset-3d.css'

function useReducedMotion() {
  const [reducedMotion, setReducedMotion] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches)

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    const update = () => setReducedMotion(media.matches)
    media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
  }, [])

  return reducedMotion
}

const MODULE_THEMES = Object.keys(NEON_CUBE_LABELS) as NeonCubeThemeId[]

function formatDimensions({ width, height, depth, units }: HolographicPartInfo['dimensions']) {
  const format = (value: number) => value.toFixed(2).replace(/\.?0+$/, '')
  return `${format(width)} × ${format(height)} × ${format(depth)} · ${units}`
}

export function Dataset3DView() {
  const reducedMotion = useReducedMotion()
  const [detached, setDetached] = useState(false)
  const [legendOpen, setLegendOpen] = useState(false)
  const [part, setPart] = useState<HolographicPartInfo | null>(null)
  const [cubeFocus, setCubeFocus] = useState<CubeFocus | null>(null)
  const overviewButton = useRef<HTMLButtonElement>(null)
  const legendButton = useRef<HTMLButtonElement>(null)
  const selectedId = detached ? part?.id ?? null : null

  const toggleDetached = () => {
    setDetached(value => !value)
    setPart(null)
    setCubeFocus(null)
  }

  const focusCube = (theme: NeonCubeThemeId) => {
    if (detached) return
    setCubeFocus({ theme })
    setLegendOpen(false)
  }

  const returnToOverview = () => {
    setCubeFocus(null)
    legendButton.current?.focus({ preventScroll: true })
  }

  useEffect(() => {
    if (cubeFocus) overviewButton.current?.focus({ preventScroll: true })
  }, [cubeFocus])

  useEffect(() => {
    if (!detached && !cubeFocus) return
    const handleKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      if (detached) setPart(null)
      else returnToOverview()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [cubeFocus, detached])

  return <main className="dataset-3d-page">
    <header className="dataset-3d-header">
      <div>
        <Link className="dataset-3d-back" to="/workspaces">Không gian làm việc</Link>
        <h1 id="page-heading" tabIndex={-1}>Dataset 3D</h1>
      </div>
      <p>{reducedMotion ? 'Chuyển động tự động đã tắt theo cài đặt thiết bị.' : 'Kéo để xoay, cuộn để phóng to hoặc thu nhỏ.'}</p>
    </header>
    <section className="dataset-3d-stage" aria-label="Không gian trực quan Dataset 3D">
      <HolographicCoreCanvas reducedMotion={reducedMotion} detached={detached}
        selectedId={selectedId} onSelectPart={setPart} cubeFocus={cubeFocus} onFocusCube={focusCube} />
      <div className="dataset-3d-overlay">
        <aside className="dataset-3d-legend" aria-label="Bản đồ module" data-expanded={legendOpen}>
          <header className="dataset-3d-legend-header">
            <p className="dataset-3d-legend-title" hidden={!legendOpen}>BẢN ĐỒ MODULE</p>
            <button ref={legendButton} className="dataset-3d-legend-toggle" type="button"
              aria-label={legendOpen ? 'Thu gọn bản đồ module' : 'Mở bản đồ module'}
              title={legendOpen ? 'Thu gọn bản đồ module' : 'Mở bản đồ module'}
              aria-expanded={legendOpen} aria-controls="dataset-3d-legend-content"
              onClick={() => setLegendOpen(value => !value)}>
              <span aria-hidden="true">{legendOpen ? '‹' : '›'}</span>
            </button>
          </header>
          <div id="dataset-3d-legend-content" className="dataset-3d-legend-content" hidden={!legendOpen}>
            <ul>
              <li data-tone="core"><i aria-hidden="true" /><span>Nhân dữ liệu</span><small>1 bộ dữ liệu</small></li>
              {MODULE_THEMES.map(theme => (
                <li key={theme} data-tone={theme}>
                  <i aria-hidden="true" />
                  <button className="dataset-3d-legend-focus" type="button" disabled={detached}
                    onClick={() => focusCube(theme)} aria-label={`Focus ${NEON_CUBE_LABELS[theme].label}`}>
                    {NEON_CUBE_LABELS[theme].label}
                  </button>
                  <small>{NEON_CUBE_LABELS[theme].detail}</small>
                </li>
              ))}
            </ul>
            <p className="dataset-3d-legend-note">
              <i aria-hidden="true" data-tone="issue" />Hạt cam: vấn đề chất lượng → Detection
            </p>
          </div>
        </aside>
        {cubeFocus && <button ref={overviewButton} type="button" className="dataset-3d-overview" onClick={returnToOverview}>
          Về góc tổng quan
        </button>}
        <button className="dataset-3d-detach" type="button" aria-pressed={detached}
          aria-controls="dataset-3d-part-panel" onClick={toggleDetached}>
          {detached ? 'Lắp lại mô hình' : 'Tách mô hình'}
        </button>
        {detached && (
          <aside id="dataset-3d-part-panel" className="dataset-3d-detail" aria-live="polite"
            data-part-id={part?.id ?? ''}>
            <header>
              <p>THÔNG TIN BỘ PHẬN</p>
              <button type="button" aria-label="Đóng bảng thông tin" onClick={() => setPart(null)}>×</button>
            </header>
            {part ? (
              <>
                <h2>{part.name}</h2>
                <dl>
                  <dt>id</dt><dd>{part.id}</dd>
                  <dt>role</dt><dd>{part.role}</dd>
                  <dt>material</dt><dd>{part.material}</dd>
                  <dt>dimensions</dt><dd>{formatDimensions(part.dimensions)}</dd>
                  <dt>level</dt><dd>{part.level}</dd>
                </dl>
              </>
            ) : <p className="dataset-3d-detail-empty">Chạm vào một bộ phận trên mô hình để xem thông tin.</p>}
          </aside>
        )}
      </div>
    </section>
    <p className="dataset-3d-boundary">Nhân trung tâm là một bộ dữ liệu; bốn khối neon là bốn module. Hạt cyan/violet là bản ghi sạch lưu chuyển, hạt cam là vấn đề chất lượng được đẩy sang Detection. Đây là minh hoạ khái niệm, chưa nối dữ liệu thật.</p>
  </main>
}
