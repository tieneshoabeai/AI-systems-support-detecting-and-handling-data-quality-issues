import { Button } from '../../../components/ui/primitives/button'
import { ResourceBreadcrumb } from '../../application/components/resource-breadcrumb'
import { ModuleNotice } from './sections/module-notice'
import { lazy, Suspense, useCallback, useContext, useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import type { ProjectModuleId } from '../../../types'
import type { CubeFocus, NeonCubeThemeId } from '../../../types'
import { formatCount, formatDataSize, formatRows, projectModules } from '../../../hooks/workbench/workbench-presentation'
import { PreviewShell } from '../../application/components/workbench-shell'
import { Icon as PreviewIcon } from '../../../components/ui/primitives/icon'
import { EmptyHint } from '../../../components/resource/presentation/resource-presentation'
import { usePreviewSession } from '../../../hooks/workbench/workbench-session-context'
import { projectDatasetMenu } from '../../../hooks/resource/resource-menu'
import { ProjectUploadDialog, ProjectResultDownload } from './sections/project-data-actions'
import type { ConfirmedProjectResult } from '../../../types'
import { bindProjectGlassMotion } from '../../../graphics/holographic-core'
import styles from './project-workspace.module.css'
import { LiveDatasetPanel } from './sections/live-dataset-panel'
import { LiveAnalysisPanel } from './sections/live-analysis-panel'
import { Dialog } from '../../../components/ui/overlay/dialog'
import { ProjectHeaderSkeleton, ProjectSceneSkeleton } from '../../../components/loading/page-skeleton'
import { firstRecordQuery } from '../../../services/processing/dataset.service'
import type { DatasetPreview } from '../../../types/processing/dataset-records.types'
import { ProcessingDataContext } from '../../application/processing-data-context'
import { ProjectPanelResize, useProjectPanelMove } from './sections/project-panel-controls'
import { useManagementStore } from '../../../hooks/management/use-management-store'

// Project chrome and actions stay in this view; Dataset3DView owns scene interactions.
const Dataset3DView = lazy(() => import('../../dataset-3d/dataset-3d.view').then(module => ({ default: module.Dataset3DView })))

const sceneLoading = <ProjectSceneSkeleton message="Đang mở cảnh 3D…" />

const MODULE_CUBES = {
  overview: 'violet', 'data-view': 'blue', 'data-analysis': 'cyan',
} satisfies Record<Exclude<ProjectModuleId, 'detection'>, NeonCubeThemeId>

const activeModules = projectModules.flatMap(module => module.id === 'detection' ? [] : [{ ...module, id: module.id }])

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
    if (next?.theme === 'orange') return
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
  const panelMoveHintId = useId()
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
      if (event.key === 'Escape' && !event.defaultPrevented) {
        selectFocus(null, true)
        event.stopPropagation()
        document.querySelector<HTMLButtonElement>('.pj-module.is-active')?.focus()
      }
    }
    window.addEventListener('keydown', close)
    return () => window.removeEventListener('keydown', close)
  }, [panelFocus, selectFocus])
  const selected = activeModules.find(module => MODULE_CUBES[module.id] === focus?.theme)?.id ?? null
  const [uploading, setUploading] = useState(false)
  const closeUpload = useCallback(() => setUploading(false), [])
  const [completionProjectId, setCompletionProjectId] = useState<string | null>(null)
  const closeCompletion = useCallback(() => setCompletionProjectId(null), [])
  const project = processing?.loading || processing?.error
    ? null : session.state.projects.find(item => item.id === projectId) ?? null
  const permissionsPending = processing?.permissionsPending === true
  const sceneEligibleProjectId = permissionsPending ? undefined : project?.id
  const [sceneProjectId, setSceneProjectId] = useState<string>()
  useEffect(() => {
    if (scene != null || !sceneEligibleProjectId) return
    // Let the browser paint the enabled project menu before loading the 3D scene.
    let mountFrame = 0
    const paintFrame = requestAnimationFrame(() => {
      mountFrame = requestAnimationFrame(() => setSceneProjectId(sceneEligibleProjectId))
    })
    return () => {
      cancelAnimationFrame(paintFrame)
      cancelAnimationFrame(mountFrame)
    }
  }, [sceneEligibleProjectId, scene])
  const dataset = project?.dataset
  const completeProject = store.completeProject
  const canCompleteProject = project?.status === 'processing' && project.canComplete && completeProject
  const datasetId = dataset?.id
  const [preview, setPreview] = useState<{ datasetId: string; value: DatasetPreview | null } | null>(null)
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
  const currentPreview = preview?.datasetId === datasetId ? preview : null
  const invalidatePreview = () => { if (datasetId) setPreview({ datasetId, value: null }) }
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
      ? <div role="alert">{processing.error} <button type="button" onClick={processing.retry}>Thử lại</button></div>
      : <><p role="status" className="visually-hidden">Đang tải thông tin project…</p><ProjectHeaderSkeleton /></>)}
    {project && <div className="pj-head-row">
      <ResourceBreadcrumb parents={[
        { label: 'Workspaces', icon: 'workspaces', onClick: () => session.openSection('workspaces') },
        { label: project.workspaceName, onClick: () => session.openSection('workspaces', { workspaceId: project.workspaceId }) },
      ]} current={{ label: project.name, icon: 'projects' }} />
      <div className="pj-dataset">
        <span className="pj-dataset-icon" aria-hidden="true"><PreviewIcon name="file" /></span>
        <div className="pj-dataset-text">
          <strong title={dataset?.fileName}>{dataset ? `Dataset: ${dataset.fileName}` : 'Dataset'}</strong>
          {/* "dung lượng bao gồm luôn shape()" = kích thước tệp + số dòng + số cột, đúng ba vế
              ảnh vẽ: '124.6 MB | 1,250,000 dòng | 24 cột'. */}
          <span>{dataset
            ? `${formatDataSize(dataset.sizeMb)} | ${formatRows(dataset.rows)} | ${formatCount(dataset.columns)} cột`
            : 'Project chưa có tập dữ liệu.'}</span>
        </div>
        <div className={styles['datasetActions']}>
          {!dataset && project.canUpload !== false && <button type="button" className="button-primary" onClick={() => setUploading(true)}>Upload data</button>}
          {canCompleteProject && <button type="button" className="button-secondary"
            onClick={() => setCompletionProjectId(project.id)}>Hoàn thành Project</button>}
          <button type="button" className="icon-button pj-dataset-menu" aria-label={`Thao tác với ${project.name}`}
            aria-haspopup="menu" disabled={permissionsPending} onClick={event => menuButton(event.currentTarget)}>
            <PreviewIcon name="more" />
          </button>
        </div>
      </div>
    </div>}

    {!processing?.error && <section key="project-stage" className="pj-stage" aria-label={project ? `Vũ trụ dữ liệu của ${project.name}` : 'Vũ trụ dữ liệu'}>
      {scene ?? (sceneEligibleProjectId && sceneProjectId === sceneEligibleProjectId ? <Suspense fallback={sceneLoading}>
        <Dataset3DView embedded colorMode={session.appearance.resolved} focus={focus}
        glassPanel={glassPanel}
        onFocusChange={next => selectFocus(next)}
        onFocusComplete={completeFocus} />
      </Suspense> : sceneLoading)}
      {PROJECT_PANEL_ENABLED && panelFocus && <aside ref={setGlassPanel} className="project-module-panel" aria-labelledby="project-module-title"
        {...panelMove?.pointerProps}
        data-has-content={panelFocus.theme === 'blue' || panelFocus.theme === 'violet'}
        data-open={panelOpen} data-instant={instant} data-module={activeModules.find(module => MODULE_CUBES[module.id] === panelFocus.theme)?.id}
        aria-hidden={!panelOpen} inert={!panelOpen}>
        <div className="project-module-content">
          <header data-panel-drag-title>
            <h2 id="project-module-title">{activeModules.find(module => MODULE_CUBES[module.id] === panelFocus.theme)?.label}</h2>
            <div className={styles['panelHeaderActions']}>
              <button type="button" className="icon-button" aria-label="Khôi phục vị trí và kích thước mặc định"
                aria-describedby={panelMoveHintId}
                title="Mũi tên để di chuyển, Shift để tăng bước, Home để đặt lại."
                onClick={panelMove?.reset} onKeyDown={panelMove?.onKeyDown}>↺</button>
              <span id={panelMoveHintId} className="visually-hidden">Dùng phím mũi tên để di chuyển. Giữ Shift để tăng bước. Nhấn Home để đặt lại vị trí và kích thước.</span>
              <button ref={panelClose} type="button" className="icon-button" aria-label="Đóng bảng module"
                onClick={event => selectFocus(null, event.detail === 0)}>×</button>
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
                  project={project} canExecute={project.canComplete === true} /> : null}
          </div>
        </div>
        {panelOpen && <ProjectPanelResize panel={glassPanel} />}
      </aside>}

      {/* Nav and cube clicks update the same focus object, including repeat selections. */}
      <nav ref={nav} className="pj-modules" aria-label="Các module của project">
        {activeModules.map(module => {
          const current = selected === module.id
          return <Button type="button" key={module.id} data-tone={module.tone} data-module={module.id}
            className={`pj-module${current ? ' is-active' : ''}`} aria-current={current ? 'true' : undefined}
            onClick={event => selectFocus({ theme: MODULE_CUBES[module.id] }, event.detail === 0)}>
            <span className="pj-module-icon" aria-hidden="true"><PreviewIcon name={module.icon} /></span>
            <span className="pj-module-label">{module.label}</span>
          </Button>
        })}
      </nav>
    </section>}

    {uploading && project && <ProjectUploadDialog onClose={closeUpload} />}
    {project && completionProjectId === project.id && canCompleteProject && <CompleteProjectDialog
      key={project.id} onClose={closeCompletion} onComplete={async () => {
        const response = await canCompleteProject(project.id)
        session.notify(response.message, 'success')
      }} />}

    {/* Trang không còn dải lý do cho "Quản lý thành viên" hay các control của trang Projects:
        mục đó đã BẬT THẬT và chính modal của nó mang ghi chú ở chân (id `projectMembersPage`).
        Để note trùng id ở đây là hai phần tử cùng một id trong DOM khi modal mở. */}
  </PreviewShell>
}

function CompleteProjectDialog({ onClose, onComplete }: { onClose: () => void; onComplete: () => Promise<void> }) {
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  return <Dialog open onClose={onClose} busy={pending} aria-labelledby="complete-project-title">
      <h2 id="complete-project-title">Hoàn thành Project</h2>
      <p>Lưu trạng thái hiện tại và đánh dấu Project là đã hoàn thành.</p>
      {error && <p role="alert">{error}</p>}
      <div className="form-actions">
        <button type="button" className="button-secondary" onClick={onClose} disabled={pending}>Hủy</button>
        <button type="button" className="button-primary" disabled={pending} onClick={() => {
          setPending(true); setError('')
          void onComplete().then(onClose).catch((cause: unknown) => {
            setError(cause instanceof Error ? cause.message : 'Không lưu được trạng thái Project.')
          }).finally(() => setPending(false))
        }}>Xác nhận hoàn thành</button>
      </div>
  </Dialog>
}
