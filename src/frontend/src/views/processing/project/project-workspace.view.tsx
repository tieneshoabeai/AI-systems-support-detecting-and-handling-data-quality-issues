import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
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
import { isShoppingDemo } from '../../../mocks/shopping-trends/demo-mode'
import { useShoppingDetection } from '../../../hooks/preview/use-shopping-detection'
import { ShoppingContent } from '../../preview/components/shopping-demo-content'
import { ResultReviewDialog } from '../../preview/components/result-review-dialog'
import { downloadShopping } from '../../../mocks/shopping-trends/data'

// Project chrome and actions stay in this view; Dataset3DView owns scene interactions.
const MODULE_CUBES = {
  overview: 'violet', 'data-view': 'blue', 'data-analysis': 'cyan', detection: 'orange',
} satisfies Record<ProjectModuleId, NeonCubeThemeId>

// Temporarily disable the project panel while comparing page-load performance.
const PROJECT_PANEL_ENABLED = true

export function ProjectWorkspaceView({ projectId, scene, result = null }: { projectId: string; scene?: ReactNode; result?: ConfirmedProjectResult | null }) {
  const session = usePreviewSession()
  // No selected module until the user chooses a nav button or a scene cube.
  const [focus, setFocus] = useState<CubeFocus | null>(null)
  const [completedFocus, setCompletedFocus] = useState<CubeFocus | null>(null)
  const panelClose = useRef<HTMLButtonElement>(null)
  const [panelFocus, setPanelFocus] = useState<CubeFocus | null>(null)
  const [instant, setInstant] = useState(false)
  const nav = useRef<HTMLElement>(null)
  const [glassPanel, setGlassPanel] = useState<HTMLElement | null>(null)
  const demo = isShoppingDemo() && projectId === 'shopping-trends'
  const flow = useShoppingDetection(demo)
  const { start, cancel, needsReview, save } = flow
  const [reviewing, setReviewing] = useState(false)
  const pendingFocus = useRef<{ next: CubeFocus | null; immediate: boolean } | null>(null)
  const applyFocus = useCallback((next: CubeFocus | null, immediate = false) => {
    setInstant(immediate)
    setCompletedFocus(null)
    setFocus(next)
    if (demo) { setPanelFocus(next); setCompletedFocus(next) }
  }, [demo])
  const selectFocus = useCallback((next: CubeFocus | null, immediate = false) => {
    if (demo && needsReview && next?.theme !== 'orange') {
      pendingFocus.current = { next, immediate }
      setReviewing(true)
      return
    }
    if (demo && next?.theme !== 'orange') cancel()
    applyFocus(next, immediate)
    if (demo && next?.theme === 'orange') start()
  }, [demo, needsReview, cancel, applyFocus, start])
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
      if (event.key === 'Escape' && !reviewing) { selectFocus(null, true); event.stopPropagation(); document.querySelector<HTMLButtonElement>('.pj-module.is-active')?.focus() }
    }
    window.addEventListener('keydown', close)
    return () => window.removeEventListener('keydown', close)
  }, [panelFocus, reviewing, selectFocus])
  useEffect(() => {
    if (!demo || !panelOpen) return
    const outside = (event: Event) => {
      if (reviewing && event.target instanceof Element && event.target.closest('[role="dialog"]')) return
      if (!(event.target instanceof Node) || glassPanel?.contains(event.target)
        || nav.current?.contains(event.target)) return
      if (needsReview) { event.preventDefault(); event.stopPropagation() }
      selectFocus(null, true)
    }
    document.addEventListener('pointerdown', outside, true)
    document.addEventListener('click', outside, true)
    return () => { document.removeEventListener('pointerdown', outside, true); document.removeEventListener('click', outside, true) }
  }, [demo, panelOpen, reviewing, glassPanel, needsReview, selectFocus])
  const [detached, setDetached] = useState(false)
  const selected = projectModules.find(module => MODULE_CUBES[module.id] === focus?.theme)?.id ?? null
  const [uploading, setUploading] = useState(false)
  const project = session.state.projects.find(item => item.id === projectId) ?? null

  // Id không còn trong store (vừa bị xóa) → về danh sách thay vì vẽ trang trống.
  if (!project) return <PreviewShell active="workspaces" area="processing">
    <EmptyHint title="Không tìm thấy project" note="Project không còn tồn tại. Hãy chọn project khác trong danh sách." />
    <button type="button" className="button-secondary" onClick={() => session.openSection('projects')}>Về danh sách Project</button>
  </PreviewShell>

  const dataset = project.dataset
  const menuButton = (element: HTMLElement) =>
    session.openMenu({ ...projectDatasetMenu(project), origin: { kind: 'anchor', element } })

  return <PreviewShell active="workspaces" area="processing" contentClassName={`project-processing-content ${styles['screen']}`}
    headerAction={<ProjectResultDownload result={demo && flow.state.status === 'reviewed'
      ? { id: 'shopping-detection', save, download: () => downloadShopping('report') } : result} />}>
    <h1 id="page-heading" tabIndex={-1} className="visually-hidden">{project.name}</h1>
    <div className="pj-head-row">
      <nav className="ws-crumb" aria-label="Path điều hướng">
        <button type="button" className="crumb-link" onClick={() => session.openSection('workspaces')}>Workspaces</button>
        <span className="crumb-sep" aria-hidden="true">›</span>
        <button type="button" className="crumb-link" onClick={() => session.openSection('workspaces', { workspaceId: project.workspaceId })}>{project.workspaceName}</button>
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
            ? `${formatDataSize(dataset.sizeMb)} | ${demo ? dataset.rows.toLocaleString('vi-VN') + ' dòng' : formatRows(dataset.rows)} | ${formatCount(dataset.columns)} cột`
            : 'Project chưa có tập dữ liệu.'}</span>
        </div>
        {!dataset && <button type="button" className="button-primary" onClick={() => setUploading(true)}>Upload data</button>}
        <button type="button" className="icon-button pj-dataset-menu" aria-label={`Thao tác với ${project.name}`}
          aria-haspopup="menu" onClick={event => menuButton(event.currentTarget)}>
          <PreviewIcon name="more" />
        </button>
      </div>
    </div>

    <section className="pj-stage" aria-label={`Vũ trụ dữ liệu của ${project.name}`}>
      {scene ?? <Dataset3DView embedded colorMode={session.appearance.resolved} focus={focus}
        glassPanel={glassPanel}
        onFocusChange={next => selectFocus(next)} onDetachedChange={value => { setDetached(value); if (!demo) setCompletedFocus(null) }}
        onFocusComplete={completeFocus} />}
      {PROJECT_PANEL_ENABLED && panelFocus && <aside ref={setGlassPanel} className="project-module-panel" aria-labelledby="project-module-title"
        data-has-content={demo || panelFocus.theme === 'orange'}
        data-open={panelOpen} data-instant={instant} data-module={projectModules.find(module => MODULE_CUBES[module.id] === panelFocus.theme)?.id}
        aria-hidden={!panelOpen} inert={!panelOpen}>
        <div className="project-module-content">
          <header>
            <h2 id="project-module-title">{projectModules.find(module => MODULE_CUBES[module.id] === panelFocus.theme)?.label}</h2>
            <button ref={panelClose} type="button" className="icon-button" aria-label="Đóng bảng module"
              onClick={event => selectFocus(null, event.detail === 0)}>×</button>
          </header>
          {demo ? <ShoppingContent module={projectModules.find(module => MODULE_CUBES[module.id] === panelFocus.theme)!.id}
            flow={flow} onReview={() => { pendingFocus.current = null; setReviewing(true) }} />
            : panelFocus.theme === 'orange' && <div className="project-module-review"><ProjectResultActions result={result} reviewOnly /></div>}
        </div>
      </aside>}

      {/* Nav and cube clicks update the same focus object, including repeat selections. */}
      <nav ref={nav} className="pj-modules" aria-label="Bốn module của project">
        {projectModules.map(module => {
          const current = selected === module.id
          return <button type="button" key={module.id} data-tone={module.tone} data-module={module.id}
            className={`pj-module${current ? ' is-active' : ''}`} aria-current={current ? 'true' : undefined}
            disabled={detached} title={detached ? 'Lắp lại mô hình để chọn module' : undefined}
            onClick={event => selectFocus({ theme: MODULE_CUBES[module.id] }, event.detail === 0)}>
            <span className="pj-module-icon" aria-hidden="true"><PreviewIcon name={module.icon} /></span>
            <span className="pj-module-label">{module.label}</span>
          </button>
        })}
      </nav>
    </section>

    {uploading && !dataset && <ProjectUploadDialog onClose={() => setUploading(false)} />}
    {demo && reviewing && <ResultReviewDialog result={{ id: 'shopping-detection', save }}
      onClose={() => { setReviewing(false); pendingFocus.current = null }}
      onSaved={() => {
        setReviewing(false)
        const pending = pendingFocus.current
        pendingFocus.current = null
        if (pending) { applyFocus(pending.next, pending.immediate); if (pending.next?.theme === 'orange') start() }
      }} />}

    {/* Trang không còn dải lý do cho "Quản lý thành viên" hay các control của trang Projects:
        mục đó đã BẬT THẬT và chính modal của nó mang ghi chú ở chân (id `projectMembersPage`).
        Để note trùng id ở đây là hai phần tử cùng một id trong DOM khi modal mở. */}
  </PreviewShell>
}
