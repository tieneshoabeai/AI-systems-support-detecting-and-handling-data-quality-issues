import { Button } from '../../../components/ui/controls'
import { useCallback, useContext, useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import type { ProjectModuleId } from '../../../types'
import type { CubeFocus, NeonCubeThemeId } from '../../../types'
import {
  formatCount, formatDataSize, formatRows, projectModules,
} from '../../preview/preview-data'
import { PreviewShell } from '../../preview/components/preview-shell'
import { PreviewIcon } from '../../preview/components/preview-icons'
import { EmptyHint } from '../../preview/components/preview-primitives'
import { usePreviewSession } from '../../preview/preview-session-context'
import { projectDatasetMenu } from '../../preview/preview-menu'
import { ProjectResultActions, ProjectUploadDialog, ProjectResultDownload } from './sections/project-data-actions'
import { Dataset3DView } from '../../dataset-3d/dataset-3d.view'
import type { ConfirmedProjectResult } from '../../../types'
import { bindProjectGlassMotion } from '../../../graphics/holographic-core'
import styles from './project-workspace.module.css'
import { LiveDatasetPanel } from './sections/live-dataset-panel'
import { LiveAnalysisPanel } from './sections/live-analysis-panel'
import { Dialog } from '../../../components/ui/overlay/dialog'
import { firstRecordQuery, type DatasetPreview } from '../../../services/processing/dataset.service'
import { ProcessingDataContext } from '../../application/processing-data-context'
import { useManagementStore } from '../../../hooks/preview/use-preview-store'
import type { SavedAnalysisResult } from '../../../services/management/management.types'

type DetectionResponse = { datasetId: string; value?: SavedAnalysisResult | null; error?: string }

function SavedDetectionStatus({ response, onRetry }: { response: DetectionResponse | null; onRetry: () => void }) {
  if (!response) return <p role="status">Đang tải kết quả Detection…</p>
  if (response.error) return <><p role="alert">{response.error}</p><Button type="button" onClick={onRetry}>Thử lại</Button></>
  if (!response.value) return <p>Chưa có kết quả Detection đã lưu.</p>
  const assessment = response.value.dq05
  if (assessment?.status === 'unassessed') return <p>Kết quả đã lưu · Chưa đánh giá quy tắc</p>
  return <p>Kết quả đã lưu{Array.isArray(assessment?.violations) && ` · ${assessment.violations.length} vi phạm`}</p>
}

// Project chrome and actions stay in this view; Dataset3DView owns scene interactions.
const MODULE_CUBES = {
  overview: 'violet', 'data-view': 'blue', 'data-analysis': 'cyan', detection: 'orange',
} satisfies Record<ProjectModuleId, NeonCubeThemeId>

// Temporarily disable the project panel while comparing page-load performance.
const PROJECT_PANEL_ENABLED = true

export function ProjectWorkspaceView({ projectId, scene, result = null }: { projectId: string; scene?: ReactNode; result?: ConfirmedProjectResult | null }) {
  const session = usePreviewSession()
  const processing = useContext(ProcessingDataContext)
  const liveProject = processing !== null
  const store = useManagementStore()
  // No selected module until the user chooses a nav button or a scene cube.
  const [focus, setFocus] = useState<CubeFocus | null>(null)
  const [completedFocus, setCompletedFocus] = useState<CubeFocus | null>(null)
  const panelClose = useRef<HTMLButtonElement>(null)
  const [panelFocus, setPanelFocus] = useState<CubeFocus | null>(null)
  const [instant, setInstant] = useState(false)
  const nav = useRef<HTMLElement>(null)
  const [glassPanel, setGlassPanel] = useState<HTMLElement | null>(null)
  const selectFocus = useCallback((next: CubeFocus | null, immediate = false) => {
    setInstant(immediate)
    setCompletedFocus(null)
    setFocus(next)
    if (liveProject) { setPanelFocus(next); setCompletedFocus(next) }
  }, [liveProject])
  const completeFocus = useCallback((theme: NeonCubeThemeId) => {
    if (focus?.theme === theme) { setPanelFocus(focus); setCompletedFocus(focus) }
  }, [focus])
  const panelOpen = focus !== null && completedFocus === focus
  useLayoutEffect(() => {
    if (!glassPanel) return
    const ready = () => panelClose.current?.focus({ preventScroll: true })
    glassPanel.addEventListener('project-glass-ready', ready)
    const closed = () => { if (glassPanel.dataset['open'] !== 'true') setPanelFocus(null) }
    glassPanel.addEventListener('project-glass-closed', closed)
    const cleanup = bindProjectGlassMotion(glassPanel)
    return () => {
      glassPanel.removeEventListener('project-glass-ready', ready)
      glassPanel.removeEventListener('project-glass-closed', closed)
      cleanup()
    }
  }, [glassPanel])
  useLayoutEffect(() => {
    const element = nav.current
    const stage = element?.parentElement
    if (!element || !stage) return
    const measure = () => stage.style.setProperty('--project-nav-height', `${element.offsetHeight}px`)
    measure()
    if (typeof ResizeObserver !== 'function') return
    const observer = new ResizeObserver(measure)
    observer.observe(element)
    return () => observer.disconnect()
  }, [])
  useEffect(() => {
    if (!panelFocus) return
    const close = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { selectFocus(null, true); event.stopPropagation(); document.querySelector<HTMLButtonElement>('.pj-module.is-active')?.focus() }
    }
    window.addEventListener('keydown', close)
    return () => window.removeEventListener('keydown', close)
  }, [panelFocus, selectFocus])
  const [detached, setDetached] = useState(false)
  const selected = projectModules.find(module => MODULE_CUBES[module.id] === focus?.theme)?.id ?? null
  const [uploading, setUploading] = useState(false)
  const project = processing?.loading || processing?.error
    ? null : session.state.projects.find(item => item.id === projectId) ?? null
  const dataset = project?.dataset
  const datasetId = dataset?.id
  const [preview, setPreview] = useState<{ datasetId: string; value: DatasetPreview | null } | null>(null)
  const [analysis, setAnalysis] = useState<DetectionResponse | null>(null)
  const [analysisAttempt, setAnalysisAttempt] = useState(0)
  const [runningAnalysis, setRunningAnalysis] = useState(false)
  const prefetch = Boolean(processing && datasetId)
  useEffect(() => {
    const service = store.datasetService
    if (!prefetch || !datasetId || !service) return
    const controller = new AbortController()
    const { signal } = controller
    void Promise.all([service.schema(datasetId, signal), service.records(datasetId, firstRecordQuery, signal)])
      .then(([columns, page]) => { if (!signal.aborted) setPreview({ datasetId, value: { columns, page } }) })
      .catch(() => { if (!signal.aborted) setPreview({ datasetId, value: null }) })
    return () => controller.abort()
  }, [datasetId, prefetch, store])
  useEffect(() => {
    if (!prefetch || !datasetId || !store.readAnalysisResult) return
    const controller = new AbortController()
    const { signal } = controller
    void store.readAnalysisResult(projectId, signal)
      .then(value => { if (!signal.aborted) setAnalysis({ datasetId, value }) })
      .catch(() => { if (!signal.aborted) setAnalysis({ datasetId, error: 'Không tải được kết quả Detection.' }) })
    return () => controller.abort()
  }, [analysisAttempt, datasetId, prefetch, projectId, store])
  const currentPreview = preview?.datasetId === datasetId ? preview : null
  const invalidatePreview = () => { if (datasetId) setPreview({ datasetId, value: null }) }
  const currentAnalysis = analysis?.datasetId === datasetId ? analysis : null
  const retryAnalysis = () => { setAnalysis(null); setAnalysisAttempt(value => value + 1) }
  const runAnalysis = async () => {
    if (!datasetId || !store.runAnalysis || runningAnalysis) return
    setRunningAnalysis(true)
    try {
      const value = await store.runAnalysis(projectId)
      setAnalysis({ datasetId, value })
    } catch {
      setAnalysis({ datasetId, error: 'Không thể chạy Detection. Hãy kiểm tra kết quả mới nhất trước khi thử lại.' })
    } finally {
      setRunningAnalysis(false)
    }
  }

  // Id không còn trong store (vừa bị xóa) → về danh sách thay vì vẽ trang trống.
  if ((!processing && !project) || processing?.missing) return <PreviewShell active="workspaces" area="processing">
    <EmptyHint title="Không tìm thấy project" note="Project không còn tồn tại. Hãy chọn project khác trong danh sách." />
    <Button type="button" className="button-secondary" onClick={() => session.openSection('projects')}>Về danh sách Project</Button>
  </PreviewShell>

  const menuButton = (element: HTMLElement) =>
    { if (project) session.openMenu({ ...projectDatasetMenu(project), origin: { kind: 'anchor', element } }) }

  return <PreviewShell active="workspaces" area="processing" contentClassName={`project-processing-content ${styles['screen']}`}
    headerAction={<ProjectResultDownload result={result} />}>
    <h1 id="page-heading" tabIndex={-1} className="visually-hidden">{project?.name ?? 'Project'}</h1>
    {!project && (processing?.error
      ? <div role="alert">{processing.error} <Button type="button" onClick={processing.retry}>Thử lại</Button></div>
      : <p role="status">Đang tải thông tin project…</p>)}
    {project && <div className="pj-head-row">
      <nav className="ws-crumb" aria-label="Path điều hướng">
        <Button type="button" className="crumb-link" onClick={() => session.openSection('workspaces')}>Workspaces</Button>
        <span className="crumb-sep" aria-hidden="true">›</span>
        <Button type="button" className="crumb-link" onClick={() => session.openSection('workspaces', { workspaceId: project.workspaceId })}>{project.workspaceName}</Button>
        <span className="crumb-sep" aria-hidden="true">›</span>
        <span className="crumb-current" aria-current="page">{project.name}</span>
      </nav>
      <div className="pj-dataset">
        <span className="pj-dataset-icon" aria-hidden="true"><PreviewIcon name="file" /></span>
        <div className="pj-dataset-text">
          <strong>{dataset ? `Dataset: ${dataset.fileName}` : 'Dataset'}</strong>
          {/* "dung lượng bao gồm luôn shape()" = kích thước tệp + số dòng + số cột, đúng ba vế
              ảnh vẽ: '124.6 MB | 1,250,000 dòng | 24 cột'. */}
          <span>{dataset
            ? `${formatDataSize(dataset.sizeMb)} | ${formatRows(dataset.rows)} | ${formatCount(dataset.columns)} cột`
            : 'Project chưa có tập dữ liệu.'}</span>
        </div>
        {!dataset && project.canUpload !== false && <Button type="button" className="button-primary" onClick={() => setUploading(true)}>Upload data</Button>}
        {project.status === 'processing' && project.canComplete && store.completeProject &&
          <CompleteProjectAction key={project.id} onComplete={async () => {
            const response = await store.completeProject!(project.id)
            session.notify(response.message, 'success')
          }} />}
        <Button type="button" className="icon-button pj-dataset-menu" aria-label={`Thao tác với ${project.name}`}
          aria-haspopup="menu" onClick={event => menuButton(event.currentTarget)}>
          <PreviewIcon name="more" />
        </Button>
      </div>
    </div>}

    <section key="project-stage" className="pj-stage" aria-label={project ? `Vũ trụ dữ liệu của ${project.name}` : 'Vũ trụ dữ liệu'}>
      {scene ?? <Dataset3DView embedded colorMode={session.appearance.resolved} focus={focus}
        glassPanel={glassPanel}
        onFocusChange={next => selectFocus(next)} onDetachedChange={value => { setDetached(value); setCompletedFocus(null) }}
        onFocusComplete={completeFocus} />}
      {PROJECT_PANEL_ENABLED && panelFocus && <aside ref={setGlassPanel} className="project-module-panel" aria-labelledby="project-module-title"
        data-has-content={panelFocus.theme === 'orange' || panelFocus.theme === 'blue' || panelFocus.theme === 'violet'}
        data-open={panelOpen} data-instant={instant} data-module={projectModules.find(module => MODULE_CUBES[module.id] === panelFocus.theme)?.id}
        aria-hidden={!panelOpen} inert={!panelOpen}>
        <div className="project-module-content">
          <header>
            <h2 id="project-module-title">{projectModules.find(module => MODULE_CUBES[module.id] === panelFocus.theme)?.label}</h2>
            <Button ref={panelClose} type="button" className="icon-button" aria-label="Đóng bảng module"
              onClick={event => selectFocus(null, event.detail === 0)}>×</Button>
          </header>
          {!project ? <p role="status">{processing?.error ?? 'Đang tải thông tin project…'}</p>
            : panelFocus.theme === 'blue' || panelFocus.theme === 'violet'
              ? prefetch && !currentPreview ? <p role="status">Đang tải dữ liệu từ máy chủ.</p>
                : <LiveDatasetPanel key={`${project.id}:${dataset?.id ?? ''}:${panelFocus.theme}`} project={project}
                    overview={panelFocus.theme === 'violet'} initialPreview={currentPreview?.value ?? null}
                    onInvalidatePreview={invalidatePreview} />
              : panelFocus.theme === 'cyan' ? <LiveAnalysisPanel key={`${project.id}:${datasetId ?? ''}`}
                  project={project} canExecute={project.canComplete === true} onAnalysisRun={retryAnalysis} />
              : panelFocus.theme === 'orange' && <div className="project-module-review">
                  {processing && !result ? !datasetId ? <p>Project chưa có tập dữ liệu.</p>
                    : <SavedDetectionStatus response={currentAnalysis} onRetry={retryAnalysis} />
                    : <ProjectResultActions result={result} reviewOnly />}
                  {processing && !result && dataset?.status === 'processed' &&
                    project.canComplete && store.runAnalysis &&
                    <Button type="button" disabled={!currentAnalysis || Boolean(currentAnalysis.error) || runningAnalysis}
                      onClick={() => { void runAnalysis() }}>{runningAnalysis ? 'Đang chạy…' : 'Chạy Detection'}</Button>}
                </div>}
        </div>
      </aside>}

      {/* Nav and cube clicks update the same focus object, including repeat selections. */}
      <nav ref={nav} className="pj-modules" aria-label="Bốn module của project">
        {projectModules.map(module => {
          const current = selected === module.id
          return <Button type="button" key={module.id} data-tone={module.tone} data-module={module.id}
            className={`pj-module${current ? ' is-active' : ''}`} aria-current={current ? 'true' : undefined}
            disabled={detached} title={detached ? 'Lắp lại mô hình để chọn module' : undefined}
            onClick={event => selectFocus({ theme: MODULE_CUBES[module.id] }, event.detail === 0)}>
            <span className="pj-module-icon" aria-hidden="true"><PreviewIcon name={module.icon} /></span>
            <span className="pj-module-label">{module.label}</span>
          </Button>
        })}
      </nav>
    </section>

    {uploading && project && !dataset && <ProjectUploadDialog onClose={() => setUploading(false)} />}

    {/* Trang không còn dải lý do cho "Quản lý thành viên" hay các control của trang Projects:
        mục đó đã BẬT THẬT và chính modal của nó mang ghi chú ở chân (id `projectMembersPage`).
        Để note trùng id ở đây là hai phần tử cùng một id trong DOM khi modal mở. */}
  </PreviewShell>
}

function CompleteProjectAction({ onComplete }: { onComplete: () => Promise<void> }) {
  const [open, setOpen] = useState(false)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  const close = () => { setOpen(false); setError('') }
  return <>
    <Button type="button" className="button-secondary" onClick={() => setOpen(true)}>Hoàn thành Project</Button>
    <Dialog open={open} onClose={close} busy={pending} aria-labelledby="complete-project-title">
      <h2 id="complete-project-title">Hoàn thành Project</h2>
      <p>Lưu trạng thái hiện tại và đánh dấu Project là đã hoàn thành.</p>
      {error && <p role="alert">{error}</p>}
      <div className="form-actions">
        <Button type="button" className="button-secondary" onClick={close} disabled={pending}>Hủy</Button>
        <Button type="button" className="button-primary" disabled={pending} onClick={() => {
          setPending(true); setError('')
          void onComplete().then(close).catch((cause: unknown) => {
            setError(cause instanceof Error ? cause.message : 'Không lưu được trạng thái Project.')
          }).finally(() => setPending(false))
        }}>Xác nhận hoàn thành</Button>
      </div>
    </Dialog>
  </>
}
