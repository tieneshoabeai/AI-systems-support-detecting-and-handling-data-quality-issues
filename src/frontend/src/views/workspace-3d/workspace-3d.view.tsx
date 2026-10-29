import { useEffect, useMemo, useState } from 'react'
import type { CameraCommand, ResourceKind, ResourceMapProps } from '../../types/workspace-3d/resource-map.types'
import { layoutResources, resourceTrail, validateResources } from '../../math/workspace-3d/resource-layout'
import { ResourceScene } from '../../graphics/workspace-3d/resource-scene'
import { useSceneMotion } from '../../hooks/workspace-3d/use-scene-motion'
import logo from '../../assets/8DA AI Network Logo.png'
import './workspace-3d.css'

const kindLabels: Record<ResourceKind, string> = { workspace: 'Workspace', project: 'Project', dataset: 'Dataset' }
const kindMarks: Record<ResourceKind, string> = { workspace: '⬡', project: '▣', dataset: '◉' }

export function ResourceMap({ resources, selectedId, onSelect, onOpenDataset, localFileMode = false }: ResourceMapProps) {
  const validation = useMemo(() => validateResources(resources), [resources])
  const [scopeId, setScopeId] = useState<string | null>(null)
  const [resetKey, setResetKey] = useState(0)
  const [focusedId, setFocusedId] = useState<string | null>(null)
  const [cameraCommand, setCameraCommand] = useState<CameraCommand>()
  const issueCamera = (type: CameraCommand['type'], resourceId?: string) => setCameraCommand(previous => ({ sequence: (previous?.sequence ?? 0) + 1, type, resourceId }))
  const selectAndFocus = (id: string) => { onSelect(id); issueCamera('focus', id) }
  const { moving, reducedMotion, tabHidden } = useSceneMotion()
  const validResources = useMemo(() => validation.ok ? validation.resources : [], [validation])
  // Derived selection prevents stale details even if a controlled caller keeps an old ID.
  const selected = validResources.find(node => node.id === selectedId) ?? null
  useEffect(() => {
    if (selectedId !== null && !validResources.some(node => node.id === selectedId)) onSelect(null)
  }, [selectedId, validResources, onSelect])
  const activeScope = validResources.some(node => node.id === scopeId) ? scopeId : null
  const layout = useMemo(() => layoutResources(validResources, activeScope), [validResources, activeScope])
  const trail = resourceTrail(validResources, activeScope)
  const selectedTrail = resourceTrail(validResources, selected?.id ?? null)
  const changeScope = (id: string | null) => { setScopeId(id); onSelect(id) }

  return <>
    <nav className="resource-breadcrumb" aria-label="Đường dẫn tài nguyên">
      <button type="button" onClick={() => changeScope(null)} aria-current={activeScope === null ? 'location' : undefined}>Tổng quan</button>
      {trail.map(node => <span key={node.id}><span aria-hidden="true">/</span>
        <button type="button" onClick={() => changeScope(node.id)} aria-current={node.id === activeScope ? 'location' : undefined}>{node.name}</button>
      </span>)}
    </nav>
    {!validation.ok ? <p className="feedback-error" role="alert">{validation.message}</p>
      : !validResources.length ? <div className="resource-empty"><h2>Chưa có tài nguyên</h2><p>Bản đồ sẽ xuất hiện khi có Workspace.</p></div>
        : <div className="resource-map-layout">
          <section className="resource-scene-panel" aria-labelledby="scene-heading">
            <header className="resource-scene-toolbar"><div><span className="eyebrow">RESOURCE MAP</span><h2 id="scene-heading">{trail.at(-1)?.name ?? 'Không gian tài nguyên'}</h2></div>
              <button type="button" className="button-secondary" onClick={() => setResetKey(value => value + 1)}>Đặt lại góc nhìn</button></header>
            <ResourceScene layout={layout} selectedId={selected?.id ?? null} focusedId={focusedId} onSelect={selectAndFocus} moving={moving} tabHidden={tabHidden} resetKey={resetKey} command={cameraCommand} reducedMotion={reducedMotion} />
            <div className="resource-camera-actions" role="group" aria-label="Điều khiển camera">
              {([['left', '←', 'Di chuyển trái'], ['forward', '↑', 'Di chuyển tới trước'], ['back', '↓', 'Di chuyển ra sau'], ['right', '→', 'Di chuyển phải'], ['near', '+', 'Nhìn gần hơn'], ['far', '−', 'Nhìn xa hơn']] as const).map(([type, mark, label]) =>
                <button type="button" key={type} aria-label={label} title={label} onClick={() => issueCamera(type)}>{mark}</button>)}
              <button type="button" disabled={!selected} onClick={() => selected && issueCamera('focus', selected.id)}>Tới khối đã chọn</button>
            </div>
            <div className="resource-scene-caption"><span>Kéo trái: xoay · Kéo phải / Shift+kéo: di chuyển · Cuộn: gần/xa</span><span>{reducedMotion ? 'Chuyển động đã giảm' : 'Dòng màu chỉ minh họa liên kết'}</span></div>
            <p className="resource-label-hint">Cảm ứng: một ngón xoay · hai ngón di chuyển hoặc chụm để zoom. Chọn khối để nhìn gần.</p>
            <p className="resource-label-hint">Nhãn tự động: ưu tiên Workspace/Project khi đông tài nguyên. Rê chuột hoặc chọn Dataset để xem tên.</p>
          </section>
          <aside className="resource-details" aria-labelledby="details-heading">
            <span className="eyebrow">THÔNG TIN TÀI NGUYÊN</span>
            <h2 id="details-heading">{selected ? selected.name : 'Chọn một tài nguyên'}</h2>
            {selected ? <>
              <span className={`resource-kind resource-kind-${selected.kind}`}><span aria-hidden="true">{kindMarks[selected.kind]}</span> {kindLabels[selected.kind]}</span>
              <dl><dt>Tên</dt><dd>{selected.kind === 'dataset' && onOpenDataset
                ? <button type="button" className="text-link" onClick={() => onOpenDataset(selected.id)}>{selected.name}</button> : selected.name}</dd>
                <dt>Đường dẫn</dt><dd>{selectedTrail.map(node => node.name).join(' / ')}</dd><dt>Nguồn</dt><dd>{localFileMode ? 'File trên máy · Chưa upload' : 'Dữ liệu demo'}</dd></dl>
              {selected.kind === 'dataset' && onOpenDataset && <button type="button" className="button-primary" onClick={() => onOpenDataset(selected.id)}>Xem dữ liệu</button>}
              {selected.kind !== 'dataset' && <button type="button" className="button-primary" onClick={() => changeScope(selected.id)}>Khám phá {kindLabels[selected.kind]} <span aria-hidden="true">→</span></button>}
              <button type="button" className="text-link" onClick={() => onSelect(null)}>Bỏ chọn</button>
            </> : <p>Chọn khối trên bản đồ hoặc dùng danh sách bên dưới để xem thông tin.</p>}
            <div className="resource-legend"><h3>Nhận biết hình dạng</h3>
              {(['workspace', 'project', 'dataset'] as const).map(kind => <div key={kind}><span aria-hidden="true">{kindMarks[kind]}</span><span>{kindLabels[kind]}</span><small>{kind === 'workspace' ? 'Hub tròn' : kind === 'project' ? 'Module đứng' : 'Cartridge'}</small></div>)}
            </div>
          </aside>
          <section className="resource-directory" aria-labelledby="directory-heading">
            <header><h2 id="directory-heading">Danh sách tài nguyên</h2><span>{layout.nodes.length} tài nguyên trong góc nhìn</span></header>
            <p>Cùng dữ liệu với bản đồ. Dùng Tab để chọn bằng bàn phím.</p>
            <ul>{layout.nodes.map(({ resource }) => <li key={resource.id}>
              <button type="button" aria-label={`${resource.name} ${kindLabels[resource.kind]} · ${resourceTrail(validResources, resource.id).slice(0, -1).map(node => node.name).join(' / ') || 'Cấp gốc'}`}
                aria-pressed={resource.id === selected?.id} onFocus={() => setFocusedId(resource.id)} onBlur={() => setFocusedId(null)}
                onClick={() => selectAndFocus(resource.id)} className={resource.id === selected?.id ? 'is-selected' : ''}>
                <span className="resource-directory-mark" aria-hidden="true">{kindMarks[resource.kind]}</span>
                <span><strong>{resource.name}</strong><small>{kindLabels[resource.kind]} · {resourceTrail(validResources, resource.id).slice(0, -1).map(node => node.name).join(' / ') || 'Cấp gốc'}</small></span>
                <span aria-hidden="true">↗</span>
              </button>
            </li>)}</ul>
          </section>
        </div>}
  </>
}

export function Workspace3DView({ resources, onOpenDataset, localFileMode = false }: Pick<ResourceMapProps, 'resources' | 'onOpenDataset' | 'localFileMode'>) {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  return <main className="resource-page">
    <header className="resource-page-header"><a href="/" className="resource-brand" aria-label="Về ứng dụng"><img src={logo} alt="8DA AI Network" width="48" height="48" /><span>Resource explorer</span></a><span className="resource-demo-badge">DEMO · CHỈ XEM THỬ</span></header>
    <div className="resource-intro"><div><span className="eyebrow"><span className="brand-dot" /> WORKSPACE 3D</span><h1>Bản đồ tài nguyên</h1></div><p>Khám phá Workspace, Project và Dataset.<br />{localFileMode ? 'Đọc file cục bộ trong tab, chưa gửi lên máy chủ.' : 'Dữ liệu minh họa, không kết nối máy chủ.'}</p></div>
    <ResourceMap resources={resources} selectedId={selectedId} onSelect={setSelectedId} onOpenDataset={onOpenDataset} localFileMode={localFileMode} />
    <footer className="resource-footer">Preview phát triển · Không upload hoặc thay đổi dữ liệu thật</footer>
  </main>
}
