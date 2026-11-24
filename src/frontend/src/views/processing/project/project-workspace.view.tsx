import { Button } from '../../../components/ui/controls'
import { Icon } from '../../../components/ui/primitives/icon'
import { useCallback, useContext, useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import type { ProjectModuleId } from '../../../types'
import type { CubeFocus, NeonCubeThemeId } from '../../../types'
import {
  formatCount, formatDataSize, formatRows, projectModules,
} from '../../preview/preview-data'
import { PreviewShell } from '../../preview/components/preview-shell'
import { ResourceBreadcrumb } from '../../preview/components/resource-breadcrumb'
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
import moduleStyles from './sections/module-content.module.css'
import { ModuleNotice } from './sections/module-notice'
import { ProjectPanelResize, useProjectPanelMove } from './sections/project-panel-controls'

type DetectionResponse = { datasetId: string; value?: SavedAnalysisResult | null; error?: string }
const number = new Intl.NumberFormat('vi-VN')

function SavedDetectionStatus({ response, onRetry }: { response: DetectionResponse | null; onRetry: () => void }) {
  if (!response) return <ModuleNotice tone="loading">Đang tải kết quả Detection…</ModuleNotice>
  if (response.error) return <>
    <ModuleNotice tone="error">{response.error}</ModuleNotice>
    <div className={moduleStyles['actions']}><Button className="button-secondary" type="button" onClick={onRetry}><Icon name="reset" /> Thử lại</Button></div>
  </>
  if (!response.value) return <ModuleNotice>Chưa có kết quả Detection đã lưu.</ModuleNotice>
  const assessment = response.value.dq05
  const violations = assessment?.status !== 'unassessed' && Array.isArray(assessment?.violations) ? assessment.violations.length : null
  const label = assessment?.status === 'unassessed' ? 'Chưa đánh giá quy tắc'
    : violations !== null ? `${number.format(violations)} vi phạm` : null
  return <div className={moduleStyles['datasetName']} role="status">
    <span className={moduleStyles['iconTile']}><Icon name={violations === 0 ? 'check-circle' : violations ? 'alert' : 'file'} /></span>
    <div>
      <h3>{label ? `Kết quả đã lưu · ${label}` : 'Kết quả đã lưu'}</h3>
      <p className={moduleStyles['muted']}>{violations !== null ? 'Số vi phạm trong lần kiểm tra quy tắc đã lưu.' : 'Kết quả chưa có số vi phạm để hiển thị.'}</p>
    </div>
  </div>
}

// Project chrome and actions stay in this view; Dataset3DView owns scene interactions.
const MODULE_CUBES = {
  overview: 'violet', 'data-view': 'blue', 'data-analysis': 'cyan', detection: 'orange',
} satisfies Record<ProjectModuleId, NeonCubeThemeId>

// Temporarily disable the project panel while comparing page-load performance.
const PROJECT_PANEL_ENABLED = true
const panelSurfaces = [
  { id: 'glass', label: 'Kính', icon: 'glass' },
  { id: 'solid', label: 'Nền trắng', icon: 'solid' },
] as const
type PanelSurface = typeof panelSurfaces[number]['id']

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
  const stage = useRef<HTMLElement>(null)
  const [glassPanel, setGlassPanel] = useState<HTMLElement | null>(null)
  const [panelSurface, setPanelSurface] = useState<PanelSurface>('glass')
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
  const panelMove = useProjectPanelMove(panelOpen ? glassPanel : null)
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
  const activeModule = projectModules.find(module => MODULE_CUBES[module.id] === panelFocus?.theme)
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
      <ResourceBreadcrumb parents={[
        { label: 'Workspaces', icon: 'workspaces', onClick: () => session.openSection('workspaces') },
        { label: project.workspaceName, onClick: () => session.openSection('workspaces', { workspaceId: project.workspaceId }) },
      ]} current={{ label: project.name, icon: 'projects' }} />
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

    <section key="project-stage" ref={stage} className="pj-stage" aria-label={project ? `Vũ trụ dữ liệu của ${project.name}` : 'Vũ trụ dữ liệu'}>
      {scene ?? <Dataset3DView embedded fullscreenTarget={stage} colorMode={session.appearance.resolved} focus={focus}
        glassPanel={panelSurface === 'glass' ? glassPanel : null}
        onFocusChange={next => selectFocus(next)} onDetachedChange={value => { setDetached(value); setCompletedFocus(null) }}
        onFocusComplete={completeFocus} />}
      {PROJECT_PANEL_ENABLED && panelFocus && <aside ref={setGlassPanel} className="project-module-panel" aria-labelledby="project-module-title"
        {...panelMove?.pointerProps} data-panel-drag-area
        data-has-content="true"
        data-surface={panelSurface}
        data-open={panelOpen} data-instant={instant} data-module={activeModule?.id}
        aria-hidden={!panelOpen} inert={!panelOpen}>
        <div className="project-module-content" data-panel-drag-area>
          <header data-panel-drag-area>
            <div className={styles['panelTitleArea']} data-panel-drag-title>
              <h2 id="project-module-title" className={styles['panelTitle']}>
                {activeModule && <span className={styles['panelIcon']}><Icon name={activeModule.icon} /></span>}
                <span>{activeModule?.label}</span>
              </h2>
            </div>
            <div className={styles['panelHeaderActions']} data-panel-drag-area>
              <div className={styles['panelSurfaceSwitch']} role="group" aria-label="Kiểu nền bảng">
                {panelSurfaces.map(({ id, label, icon }) => <Button key={id} type="button" className={styles['panelSurfaceOption']}
                  aria-label={label} title={label} aria-pressed={panelSurface === id}
                  onClick={() => setPanelSurface(id)}><Icon name={icon} /></Button>)}
              </div>
              <Button type="button" className="icon-button" aria-label="Khôi phục vị trí và kích thước mặc định"
                title="Khôi phục vị trí và kích thước mặc định. Dùng phím mũi tên để di chuyển."
                onClick={panelMove?.reset} onKeyDown={panelMove?.onKeyDown}>
                <Icon name="reset" />
              </Button>
              <Button ref={panelClose} type="button" className="icon-button" aria-label="Đóng bảng module"
                onClick={event => selectFocus(null, event.detail === 0)}><Icon name="close" /></Button>
            </div>
          </header>
          <div className="project-module-body" role="region" aria-label="Nội dung module" tabIndex={0} data-panel-drag-area>
            {!project ? <ModuleNotice tone={processing?.error ? 'error' : 'loading'}>{processing?.error ?? 'Đang tải thông tin project…'}</ModuleNotice>
            : panelFocus.theme === 'blue' || panelFocus.theme === 'violet'
              ? prefetch && !currentPreview ? <ModuleNotice tone="loading">Đang tải dữ liệu từ máy chủ…</ModuleNotice>
                : <LiveDatasetPanel key={`${project.id}:${dataset?.id ?? ''}:${panelFocus.theme}`} project={project}
                    overview={panelFocus.theme === 'violet'} initialPreview={currentPreview?.value ?? null}
                    onInvalidatePreview={invalidatePreview} />
              : panelFocus.theme === 'cyan' ? <LiveAnalysisPanel key={`${project.id}:${datasetId ?? ''}`}
                  project={project} canExecute={project.canComplete === true} onAnalysisRun={retryAnalysis} />
              : panelFocus.theme === 'orange' && <div className={`project-module-review ${moduleStyles['stack']}`}>
                  {processing && !result ? <section className={moduleStyles['card']} aria-label="Kết quả phát hiện">
                    {!datasetId ? <ModuleNotice>Project chưa có tập dữ liệu.</ModuleNotice>
                      : <SavedDetectionStatus response={currentAnalysis} onRetry={retryAnalysis} />}
                    {dataset?.status === 'processed' && project.canComplete && store.runAnalysis &&
                      <div className={moduleStyles['actions']}>
                        <Button type="button" className="button-primary" busy={runningAnalysis}
                          disabled={!currentAnalysis || Boolean(currentAnalysis.error)}
                          onClick={() => { void runAnalysis() }}><Icon name={runningAnalysis ? 'clock' : 'alert'} /> {runningAnalysis ? 'Đang chạy…' : 'Chạy Detection'}</Button>
                      </div>}
                  </section> : <ProjectResultActions result={result} reviewOnly />}
                </div>}
          </div>
        </div>
        {panelOpen && <ProjectPanelResize panel={glassPanel} />}
      </aside>}

      {/* Nav and cube clicks update the same focus object, including repeat selections. */}
      <nav ref={nav} className="pj-modules" aria-label="Bốn module của project">
        {projectModules.map(module => {
          const current = selected === module.id
          return <Button type="button" key={module.id} data-tone={module.tone} data-module={module.id}
            className={`pj-module${current ? ' is-active' : ''}`} aria-current={current ? 'true' : undefined}
            disabled={detached} title={detached ? 'Lắp lại mô hình để chọn module' : undefined}
            onClick={event => {
              setPanelSurface('glass')
              selectFocus({ theme: MODULE_CUBES[module.id] }, event.detail === 0)
            }}>
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
