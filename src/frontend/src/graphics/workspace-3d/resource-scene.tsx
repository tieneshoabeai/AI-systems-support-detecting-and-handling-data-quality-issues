import { Component, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Matrix4, Vector3 } from 'three'
import type { Mesh } from 'three'
import type { CameraCommand, ResourceLayout } from '../../types/workspace-3d/resource-map.types'
import { advanceFlow } from '../../math/workspace-3d/resource-layout'
import { shouldShowResourceLabel } from '../../math/workspace-3d/resource-label-policy'
import { ResourceHardware } from './resource-hardware'
import { HardwareLighting } from './hardware-lighting'
import { ResourceCameraController } from './resource-camera-controller'
import { routeCurve } from '../../math/workspace-3d/resource-routing'

type Props = {
  layout: ResourceLayout
  selectedId: string | null
  focusedId?: string | null
  onSelect(id: string): void
  moving: boolean
  tabHidden: boolean
  resetKey: number
  command?: CameraCommand
  reducedMotion?: boolean
}

class SceneBoundary extends Component<{ children: ReactNode; onFailure(): void }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  componentDidCatch() { this.props.onFailure() }
  render() { return this.state.failed ? null : this.props.children }
}

function DataPipe({ edge, moving }: { edge: ResourceLayout['edges'][number]; moving: boolean }) {
  const first = useRef<Mesh>(null)
  const second = useRef<Mesh>(null)
  const phase = useRef(0)
  const resumed = useRef(true)
  useEffect(() => { resumed.current = true }, [moving])
  const curve = useMemo(() => routeCurve(edge.route), [edge.route])
  const point = useMemo(() => new Vector3(), [])
  const heading = useMemo(() => new Vector3(), [])
  useFrame((_, delta) => {
    if (moving && !resumed.current) phase.current = advanceFlow(phase.current, delta)
    resumed.current = false
    curve.getPoint(phase.current, point)
    first.current?.position.copy(point)
    heading.copy(point).add(curve.getTangent(phase.current))
    first.current?.lookAt(heading)
    curve.getPoint((phase.current + 0.5) % 1, point)
    second.current?.position.copy(point)
    heading.copy(point).add(curve.getTangent((phase.current + 0.5) % 1))
    second.current?.lookAt(heading)
  })
  return <group>
    <mesh renderOrder={1}>
      <tubeGeometry args={[curve, 100, edge.route.radius, 10, false]} />
      <meshPhysicalMaterial color="#8fbfae" transparent opacity={0.23} roughness={0.12} metalness={0.05} depthWrite={false} />
    </mesh>
    <mesh>
      <tubeGeometry args={[curve, 100, edge.route.radius * 0.12, 6, false]} />
      <meshBasicMaterial color="#77ab98" />
    </mesh>
    <mesh ref={first} scale={[1, 1, 3]}>
      <sphereGeometry args={[edge.route.radius * 0.55, 10, 8]} /><meshBasicMaterial color="#00a878" />
    </mesh>
    <mesh ref={second} scale={[1, 1, 3]}>
      <sphereGeometry args={[edge.route.radius * 0.55, 10, 8]} /><meshBasicMaterial color="#268fdd" />
    </mesh>
  </group>
}

export function SceneController({ layout, labels, lines, selectedId, hoveredId = null, focusedId = null, active }: {
  layout: ResourceLayout; labels: Map<string, HTMLButtonElement>
  lines: Map<string, SVGLineElement>; selectedId: string | null; active: boolean
  hoveredId?: string | null; focusedId?: string | null
}) {
  const { camera, invalidate, size } = useThree()
  const projected = useMemo(() => new Vector3(), [])
  const lastCamera = useMemo(() => new Matrix4(), [])
  const labelsDirty = useRef(true)
  useEffect(() => { labelsDirty.current = true; invalidate() }, [layout, selectedId, hoveredId, focusedId, active, size.width, size.height, invalidate])
  useFrame(() => {
    if (!active && !labelsDirty.current) return
    camera.updateMatrixWorld()
    if (!labelsDirty.current && lastCamera.equals(camera.matrixWorld)) return
    labelsDirty.current = false
    lastCamera.copy(camera.matrixWorld)
    const placed: { x: number; y: number }[] = []
    const pinned = [selectedId, hoveredId, focusedId]
    const ordered = [...layout.nodes].sort((a, b) => Number(pinned.includes(b.resource.id)) - Number(pinned.includes(a.resource.id)))
    for (const node of ordered) {
      const label = labels.get(node.resource.id)
      if (!label) continue
      const height = node.resource.kind === 'project' ? 1.85 : node.resource.kind === 'workspace' ? 1.55 : 0.85
      projected.set(node.position[0], height, node.position[2]).project(camera)
      const x = (projected.x + 1) * size.width / 2
      const y = (1 - projected.y) * size.height / 2
      const visible = shouldShowResourceLabel(node.resource, layout.nodes.length, size.width, pinned)
        && projected.z > -1 && projected.z < 1 && x > 0 && x < size.width && y > 0 && y < size.height
      label.style.visibility = visible ? 'visible' : 'hidden'
      label.setAttribute('aria-hidden', String(!visible))
      const line = lines.get(node.resource.id)
      if (line) line.style.visibility = visible ? 'visible' : 'hidden'
      if (!visible) continue
      const anchor = { x: Math.max(60, Math.min(size.width - 60, x)), y: Math.max(32, Math.min(size.height - 8, y)) }
      const candidates = [0, -116, 116, -232, 232].flatMap(dx => [0, -32, 32, -64, 64, -96, 96, -128, 128].map(dy => ({ x: anchor.x + dx, y: anchor.y + dy })))
      // Last resort: a free label slot, still connected to its exact projected anchor.
      for (let row = 32; row < size.height - 8; row += 32) for (let col = 60; col < size.width - 59; col += 116) candidates.push({ x: col, y: row })
      const slot = candidates.find(candidate => candidate.x >= 60 && candidate.x <= size.width - 60
        && candidate.y >= 32 && candidate.y <= size.height - 8
        && placed.every(other => Math.abs(other.x - candidate.x) >= 116 || Math.abs(other.y - candidate.y) >= 32)) ?? anchor
      placed.push(slot)
      label.style.transform = `translate(-50%, -100%) translate(${slot.x}px, ${slot.y}px)`
      if (line) {
        line.setAttribute('x1', String(x)); line.setAttribute('y1', String(y + 8))
        line.setAttribute('x2', String(slot.x)); line.setAttribute('y2', String(slot.y))
      }
    }
  })
  return null
}

export function ResourceScene({ layout, selectedId, focusedId = null, onSelect, moving, tabHidden, resetKey, command, reducedMotion = false }: Props) {
  const [failed, setFailed] = useState(false)
  const [labels] = useState(() => new Map<string, HTMLButtonElement>())
  const [lines] = useState(() => new Map<string, SVGLineElement>())
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const onFailure = useMemo(() => () => setFailed(true), [])
  return <div className="resource-canvas" aria-label="Bản đồ tài nguyên 3D">
    {failed ? <div className="resource-canvas-fallback" role="status">
      <strong>Không thể hiển thị 3D</strong>
      <p>Bạn vẫn có thể chọn và khám phá tài nguyên trong danh sách bên dưới.</p>
    </div> : <SceneBoundary onFailure={onFailure}>
      <Canvas shadows="percentage" dpr={[1, 1.5]} frameloop={moving ? 'always' : 'demand'} camera={{ fov: 40, near: 0.1, far: 500 }}
        fallback={<div className="resource-canvas-fallback" role="status">Trình duyệt không hỗ trợ WebGL. Hãy dùng danh sách tài nguyên bên dưới.</div>}>
        <color attach="background" args={['#f3f7f4']} />
        <HardwareLighting />
        <ambientLight intensity={0.65} />
        <directionalLight position={[8, 18, 4]} intensity={2} castShadow shadow-mapSize={[1024, 1024]}
          shadow-camera-left={-25} shadow-camera-right={25} shadow-camera-top={25} shadow-camera-bottom={-25} shadow-bias={-0.001} />
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[layout.center[0], -0.81, layout.center[2]]}>
          <planeGeometry args={[layout.span * 4, layout.span * 4]} />
          <meshBasicMaterial color="#f0f5f1" toneMapped={false} />
        </mesh>
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[layout.center[0], -0.8, layout.center[2]]} receiveShadow>
          <planeGeometry args={[layout.span * 4, layout.span * 4]} /><shadowMaterial transparent opacity={0.16} />
        </mesh>
        <gridHelper args={[Math.max(30, layout.span * 2), Math.max(30, Math.ceil(layout.span * 2)), '#d2e0d8', '#e4ece7']}
          position={[layout.center[0], -0.79, layout.center[2]]} />
        {layout.edges.map(edge => <DataPipe key={edge.id} edge={edge} moving={moving} />)}
        {layout.nodes.map(node => <ResourceHardware key={node.resource.id} node={node} selected={node.resource.id === selectedId} onSelect={onSelect} onHover={setHoveredId} />)}
        <ResourceCameraController layout={layout} resetKey={resetKey} command={command} reducedMotion={reducedMotion} active={!tabHidden} onContextLost={onFailure} />
        <SceneController layout={layout} labels={labels} lines={lines} selectedId={selectedId} hoveredId={hoveredId} focusedId={focusedId} active={!tabHidden} />
      </Canvas>
    </SceneBoundary>}
    {!failed && <div className="resource-scene-labels">
      <svg className="resource-label-leaders" aria-hidden="true">{layout.nodes.map(({ resource }) => <line key={resource.id}
        ref={element => { if (element) lines.set(resource.id, element); else lines.delete(resource.id) }} />)}</svg>
      {layout.nodes.map(({ resource }) => <button type="button" key={resource.id}
        ref={element => { if (element) labels.set(resource.id, element); else labels.delete(resource.id) }}
        className={`resource-scene-label${resource.id === selectedId ? ' is-selected' : ''}`}
        title={resource.name}
        onPointerEnter={() => setHoveredId(resource.id)} onPointerLeave={() => setHoveredId(null)}
        aria-pressed={resource.id === selectedId} tabIndex={-1} onClick={() => onSelect(resource.id)}>
        {resource.name}
      </button>)}
    </div>}
  </div>
}
