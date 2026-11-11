import { Component, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import type { ThreeEvent } from '@react-three/fiber'
import { DepthTexture, Euler, PerspectiveCamera, Vector2, Vector3, setConsoleFunction, Line, LineBasicMaterial, NormalBlending } from 'three'
import type { Object3D } from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js'
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js'
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js'
import { createHolographicCoreProductModel, type HolographicCoreProductModel } from '../../../graphics/holographic-core/holographic-core.model'
import { HolographicEnvironment } from './holographic-core.environment'
import { HolographicDecor } from './holographic-core.decor'
import { createNeonCubeCluster } from '../../../graphics/neon-cube/neon-cube.cluster'
import type { NeonCubeThemeId } from '../../../types/dataset-3d/cube-focus.types'
import type { HolographicPartInfo } from '../../../types/dataset-3d/holographic-part.types'
import { heroLabelForId } from '../../../graphics/holographic-core/tower-gauge-config'
import { CubeLabels } from './cube-label'
import { createCubeConnectionFocus } from '../../../graphics/holographic-core/cube-connection-focus'
import type { CubeFocus } from '../../../types/dataset-3d/cube-focus.types'
import { createGlassFrame, LiquidGlassPass, type GlassFrame } from '../../../graphics/holographic-core/liquid-glass-pass'
import { HOLOGRAPHIC_CAMERA } from '../../../graphics/holographic-core/core-visual-config'
import { bindProjectGlassPass, createProjectGlassPass } from '../../../graphics/holographic-core/project-glass-pass'
import { HolographicBloomPass } from '../../../graphics/holographic-core/holographic-bloom-pass'

type CubeFocusProps = {
  glassPanel?: HTMLElement | null
  onFocusComplete?: (theme: NeonCubeThemeId) => void
  cubeFocus: CubeFocus | null
  onFocusCube(theme: NeonCubeThemeId): void
}

type HolographicCoreCanvasProps = CubeFocusProps & {
  colorMode?: 'light' | 'dark'
  cameraToolbar?: HTMLDivElement | null
  reducedMotion: boolean
  detached: boolean
  selectedId: string | null
  onSelectPart(part: HolographicPartInfo | null): void
}
// @react-three/fiber 9.8.2 still builds a THREE.Clock internally; three r183+ warns about it.
// Filter only that deprecation notice and pass every other three.js message through.
setConsoleFunction((type, message, ...params) => {
  if (type === 'warn' && String(message).startsWith('THREE.Clock: This module has been deprecated')) return
  console[type](message, ...params)
})
class SceneBoundary extends Component<{ children: ReactNode; onFailure(): void }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  componentDidCatch() { this.props.onFailure() }
  render() { return this.state.failed ? null : this.props.children }
}

type CameraEditorProps = {
  cameraEditing: boolean
  onCameraSnapshot(value: string): void
}

function CameraControls({ reducedMotion, cubeFocus, productModel, cameraEditing, onCameraSnapshot, onFocusComplete }: CameraEditorProps & {
  onFocusComplete?: (theme: NeonCubeThemeId) => void
  reducedMotion: boolean; cubeFocus: CubeFocus | null; productModel: HolographicCoreProductModel
}) {
  const { camera, gl, invalidate } = useThree()
  const controlsRef = useRef<OrbitControls | null>(null)
  const sequence = useRef<ReturnType<typeof createCubeConnectionFocus> | null>(null)
  const completion = useRef(onFocusComplete)
  useLayoutEffect(() => { completion.current = onFocusComplete }, [onFocusComplete])
  const flightKeys = useRef(new Set<string>())
  const flightTargetDistance = useRef(1)
  useEffect(() => {
    camera.position.set(...HOLOGRAPHIC_CAMERA.position)
    const controls = new OrbitControls(camera, gl.domElement)
    controlsRef.current = controls
    controls.target.set(...HOLOGRAPHIC_CAMERA.target)
    controls.minDistance = 4.4
    controls.maxDistance = 25
    controls.maxPolarAngle = Math.PI / 2.02
    controls.dampingFactor = 0.07
    const update = () => invalidate()
    controls.addEventListener('change', update)
    controls.update()
    if (camera instanceof PerspectiveCamera) sequence.current = createCubeConnectionFocus(camera, controls, productModel.setConnection, theme => completion.current?.(theme))
    return () => {
      sequence.current?.dispose()
      sequence.current = null
      controls.removeEventListener('change', update)
      controls.dispose()
      controlsRef.current = null
    }
  }, [camera, gl, invalidate, productModel])
  useEffect(() => {
    const controls = controlsRef.current
    if (!controls) return
    controls.enableDamping = !reducedMotion
    controls.update()
  }, [camera, gl, reducedMotion])
  useEffect(() => {
    const controls = controlsRef.current
    if (!controls) return
    if (cameraEditing) {
      sequence.current?.dispose()
      sequence.current = null
      controls.enabled = false
      flightTargetDistance.current = Math.max(1, camera.position.distanceTo(controls.target))
      controls.minDistance = 0.1
      controls.maxDistance = 200
      controls.minPolarAngle = 0
      controls.maxPolarAngle = Math.PI
      controls.enablePan = true
      // Keep the selected connection visible while the user chooses its camera.
      productModel.setConnection(cubeFocus?.theme ?? null, 1)
    } else {
      controls.minDistance = 4.4
      controls.maxDistance = 25
      controls.maxPolarAngle = Math.PI / 2.02
      if (camera instanceof PerspectiveCamera) {
        sequence.current ??= createCubeConnectionFocus(camera, controls, productModel.setConnection, theme => completion.current?.(theme))
        sequence.current.select(cubeFocus?.theme ?? null, reducedMotion)
      }
    }
  }, [camera, cameraEditing, cubeFocus, gl, productModel, reducedMotion])
  useEffect(() => {
    if (!cameraEditing) return
    const canvas = gl.domElement
    const previousTabIndex = canvas.getAttribute('tabindex')
    canvas.setAttribute('tabindex', '0')
    let dragging = false
    let pointerId: number | null = null
    const syncTarget = () => {
      const controls = controlsRef.current
      if (!controls) return
      controls.target.copy(camera.position).addScaledVector(camera.getWorldDirection(new Vector3()), flightTargetDistance.current)
      controls.dispatchEvent({ type: 'change' })
      invalidate()
    }
    const down = (event: PointerEvent) => {
      canvas.focus({ preventScroll: true })
      if (event.button !== 2) return
      dragging = true
      pointerId = event.pointerId
      canvas.setPointerCapture(event.pointerId)
      event.preventDefault()
    }
    const move = (event: PointerEvent) => {
      if (!dragging) return
      const angles = new Euler().setFromQuaternion(camera.quaternion, 'YXZ')
      angles.y -= event.movementX * 0.003
      angles.x = Math.max(-Math.PI / 2 + 0.01, Math.min(Math.PI / 2 - 0.01, angles.x - event.movementY * 0.003))
      camera.quaternion.setFromEuler(angles)
      syncTarget()
    }
    const stop = () => {
      dragging = false
      flightKeys.current.clear()
      if (pointerId !== null && canvas.hasPointerCapture(pointerId)) canvas.releasePointerCapture(pointerId)
      pointerId = null
    }
    const keydown = (event: KeyboardEvent) => {
      if (!['KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyQ', 'KeyE'].includes(event.code)) return
      if (event.ctrlKey || event.metaKey || event.altKey) return
      event.preventDefault()
      flightKeys.current.add(event.code)
      invalidate()
    }
    const keyup = (event: KeyboardEvent) => { flightKeys.current.delete(event.code) }
    const contextmenu = (event: Event) => event.preventDefault()
    canvas.addEventListener('pointerdown', down)
    canvas.addEventListener('pointermove', move)
    canvas.addEventListener('pointerup', stop)
    canvas.addEventListener('pointercancel', stop)
    canvas.addEventListener('lostpointercapture', stop)
    canvas.addEventListener('keydown', keydown)
    canvas.addEventListener('keyup', keyup)
    canvas.addEventListener('blur', stop)
    canvas.addEventListener('contextmenu', contextmenu)
    window.addEventListener('blur', stop)
    return () => {
      canvas.removeEventListener('lostpointercapture', stop)
      stop()
      canvas.removeEventListener('pointerdown', down)
      canvas.removeEventListener('pointermove', move)
      canvas.removeEventListener('pointerup', stop)
      canvas.removeEventListener('pointercancel', stop)
      canvas.removeEventListener('keydown', keydown)
      canvas.removeEventListener('keyup', keyup)
      canvas.removeEventListener('blur', stop)
      canvas.removeEventListener('contextmenu', contextmenu)
      window.removeEventListener('blur', stop)
      if (previousTabIndex === null) canvas.removeAttribute('tabindex')
      else canvas.setAttribute('tabindex', previousTabIndex)
    }
  }, [camera, cameraEditing, gl, invalidate])
  useEffect(() => {
    const controls = controlsRef.current
    if (!cameraEditing || !controls || !(camera instanceof PerspectiveCamera)) return
    const rounded = (values: number[]) => values.map(value => Number(value.toFixed(4)))
    const publish = () => onCameraSnapshot(JSON.stringify({
      cube: cubeFocus?.theme ?? null,
      position: rounded(camera.position.toArray()),
      target: rounded(controls.target.toArray()),
      fov: camera.fov,
      aspect: Number(camera.aspect.toFixed(4)),
      viewport: [gl.domElement.clientWidth, gl.domElement.clientHeight],
    }, null, 2))
    publish()
    controls.addEventListener('change', publish)
    return () => controls.removeEventListener('change', publish)
  }, [camera, cameraEditing, cubeFocus, gl, onCameraSnapshot])
  useFrame((_state, delta) => {
    if (!cameraEditing) {
      sequence.current?.update(delta)
      return
    }
    const keys = flightKeys.current
    const controls = controlsRef.current
    if (!keys.size || !controls) return
    const forward = camera.getWorldDirection(new Vector3())
    const right = new Vector3(1, 0, 0).applyQuaternion(camera.quaternion)
    const movement = new Vector3()
      .addScaledVector(forward, Number(keys.has('KeyW')) - Number(keys.has('KeyS')))
      .addScaledVector(right, Number(keys.has('KeyD')) - Number(keys.has('KeyA')))
    movement.y += Number(keys.has('KeyE')) - Number(keys.has('KeyQ'))
    movement.normalize().multiplyScalar(Math.min(delta, 0.05) * 4)
    camera.position.add(movement)
    controls.target.copy(camera.position).addScaledVector(forward, flightTargetDistance.current)
    controls.dispatchEvent({ type: 'change' })
    invalidate()
  }, -1)
  return null
}

// three.js objects are imperative by design, so DOM cursor writes stay in a plain helper
// instead of a render/hook body where the react-hooks immutability rule rejects them.
function setCanvasCursor(element: HTMLCanvasElement, value: string) {
  if (element.style.cursor !== value) element.style.cursor = value
}

type HeroHover = { id: string; label: string; x: number; y: number }

type CoreStructureProps = {
  reducedMotion: boolean
  detached: boolean
  selectedId: string | null
  onSelectPart(part: HolographicPartInfo | null): void
  onHeroHover(hover: HeroHover | null): void
}

function CoreStructure({ reducedMotion, detached, selectedId, onSelectPart, onHeroHover, productModel }: CoreStructureProps & { productModel: HolographicCoreProductModel }) {
  const { gl } = useThree()
  useEffect(() => { productModel.setDetached(detached) }, [detached, productModel])
  useEffect(() => { productModel.setSelected(selectedId) }, [productModel, selectedId])
  useEffect(() => {
    const element = gl.domElement
    const clearHover = () => {
      setCanvasCursor(element, '')
      onHeroHover(null)
    }
    const dismiss = (event: KeyboardEvent) => { if (event.key === 'Escape') clearHover() }
    element.addEventListener('pointerleave', clearHover)
    element.addEventListener('pointerdown', clearHover)
    window.addEventListener('keydown', dismiss)
    return () => {
      element.removeEventListener('pointerleave', clearHover)
      element.removeEventListener('pointerdown', clearHover)
      window.removeEventListener('keydown', dismiss)
      clearHover()
    }
  }, [gl, onHeroHover])
  useFrame(({ clock }, delta) => {
    if (reducedMotion) {
      productModel.resetMotion()
      // Reduced motion turns the explode into an instant snap instead of an eased move.
      productModel.snapDetach()
      return
    }
    productModel.update(clock.elapsedTime, delta)
  })
  const handleClick = (event: ThreeEvent<MouseEvent>) => {
    if (!detached || event.delta > 6) return
    let part: HolographicPartInfo | null = null
    for (const hit of event.intersections) {
      if (!isVisibleInScene(hit.object)) continue
      part = productModel.resolvePart(hit.object)
      if (part) break
    }
    event.stopPropagation()
    onSelectPart(part)
  }
  const handlePointerMove = (event: ThreeEvent<PointerEvent>) => {
    if (event.pointerType === 'touch' || event.buttons !== 0) {
      onHeroHover(null)
      return
    }
    // Match click occlusion: never label a hero through another visible component.
    let part: HolographicPartInfo | null = null
    for (const hit of event.intersections) {
      if (!isVisibleInScene(hit.object)) continue
      part = productModel.resolvePart(hit.object)
      if (part) break
    }
    const label = part ? heroLabelForId(part.id) : null
    setCanvasCursor(gl.domElement, detached && part ? 'pointer' : label ? 'help' : '')
    if (!label || !part) { onHeroHover(null); return }
    const rect = gl.domElement.getBoundingClientRect()
    onHeroHover({
      id: part.id, label,
      x: Math.max(8, Math.min(event.clientX - rect.left + 12, rect.width - 248)),
      y: Math.max(8, Math.min(event.clientY - rect.top + 14, rect.height - 54)),
    })
  }
  return <primitive object={productModel.model} onClick={handleClick} onPointerMove={handlePointerMove} onPointerOut={() => onHeroHover(null)} />
}

function NeonCubeNodes({ onFocus }: { onFocus?: (theme: NeonCubeThemeId) => void }) {
  const cluster = useMemo(() => createNeonCubeCluster(), [])
  useEffect(() => () => cluster.dispose(), [cluster])
  const handleClick = (event: ThreeEvent<MouseEvent>) => {
    if (!onFocus || event.delta > 6) return
    let object: Object3D | null = event.object
    while (object && object.parent !== cluster.group) object = object.parent
    const theme = cluster.cubes.find(cube => cube.group === object)?.theme.id
    if (theme) { event.stopPropagation(); onFocus(theme) }
  }
  return <primitive object={cluster.group} onClick={handleClick} />
}

function Lifecycle({ onContextLost }: { onContextLost(): void }) {  const { gl } = useThree()
  useEffect(() => {
    const handleContextLost = (event: Event) => { event.preventDefault(); onContextLost() }
    gl.domElement.addEventListener('webglcontextlost', handleContextLost)
    return () => gl.domElement.removeEventListener('webglcontextlost', handleContextLost)
  }, [gl, onContextLost])
  return null
}

function renderHolographicFrame(
  pipeline: { composer: EffectComposer; glass: LiquidGlassPass; bloom: UnrealBloomPass; output: OutputPass },
  bloomEnabled: boolean, glassEnabled: boolean,
) {
  pipeline.glass.enabled = glassEnabled
  pipeline.bloom.enabled = bloomEnabled
  // Bloom already outputs the legacy base + additive glow appearance. Only the
  // no-bloom glass path needs a separate output conversion.
  pipeline.output.enabled = glassEnabled && !bloomEnabled
  pipeline.composer.render()
}

function setBloomMode(bloom: UnrealBloomPass, light: boolean) {
  bloom.strength = light ? 0.12 : 0.4
  bloom.threshold = light ? 1.4 : 1
}

function setLightConnections(root: Object3D) {
  const restores: (() => void)[] = []
  const visited = new Set<LineBasicMaterial>()
  root.traverse(object => {
    if (!(object instanceof Line) || !object.name.startsWith('connection-lane-') || !(object.material instanceof LineBasicMaterial)) return
    const material = object.material
    if (visited.has(material)) return
    visited.add(material)
    const color = material.color.clone()
    const blending = material.blending
    material.color.copy(color).multiplyScalar(0.38)
    material.blending = NormalBlending
    material.needsUpdate = true
    restores.push(() => { material.color.copy(color); material.blending = blending; material.needsUpdate = true })
  })
  return () => restores.forEach(restore => restore())
}

function HolographicBloom({ enabled, frame, detached, light, glassPanel }: { enabled: boolean; frame: GlassFrame; detached: boolean; light: boolean; glassPanel?: HTMLElement | null }) {
  const { camera, gl, scene, size, viewport } = useThree()
  const pipeline = useMemo(() => {
    const composer = new EffectComposer(gl)
    composer.renderTarget1.depthTexture = new DepthTexture(1, 1)
    composer.renderTarget2.depthTexture = new DepthTexture(1, 1)
    const render = new RenderPass(scene, camera)
    const glass = new LiquidGlassPass(scene, camera, frame)
    // Product canvas has denser emissive linework than the isolated review scene.
    // Keep bloom limited to hotspots instead of whitening every cyan contour.
    const bloom = new HolographicBloomPass(new Vector2(1, 1), 0.4, 0.45, 1)
    const output = new OutputPass()
    const panelGlass = createProjectGlassPass()
    panelGlass.enabled = false
    composer.addPass(render)
    composer.addPass(glass)
    composer.addPass(bloom)
    composer.addPass(output)
    composer.addPass(panelGlass)
    return { composer, render, glass, bloom, output, panelGlass }
  }, [camera, frame, gl, scene])
  useLayoutEffect(() => {
    setBloomMode(pipeline.bloom, light)
  }, [pipeline, light])
  useLayoutEffect(() => {
    pipeline.composer.setPixelRatio(viewport.dpr)
    pipeline.composer.setSize(size.width, size.height)
  }, [pipeline, size.height, size.width, viewport.dpr])
  useLayoutEffect(() => bindProjectGlassPass(pipeline.panelGlass, gl.domElement, glassPanel, light),
    [pipeline, glassPanel, gl, light, size.width, size.height])
  useEffect(() => () => {
    pipeline.render.dispose()
    pipeline.glass.dispose()
    pipeline.bloom.dispose()
    pipeline.output.dispose()
    pipeline.panelGlass.dispose()
    pipeline.composer.dispose()
  }, [pipeline])
  useFrame(() => renderHolographicFrame(pipeline, enabled, !detached), 1)
  return null
}

type HolographicSceneProps = CoreStructureProps & CubeFocusProps & CameraEditorProps & {
  colorMode: 'light' | 'dark'
  onContextLost(): void
}

function HolographicScene({ colorMode, reducedMotion, detached, selectedId, onSelectPart, onHeroHover, onContextLost, cubeFocus, onFocusCube, onFocusComplete, cameraEditing, onCameraSnapshot, glassPanel }: HolographicSceneProps) {
  const light = colorMode === 'light'
  const [glassFrame] = useState(createGlassFrame)
  const productModel = useMemo(() => createHolographicCoreProductModel(), [])
  useEffect(() => light ? setLightConnections(productModel.model) : undefined, [light, productModel])
  useEffect(() => () => productModel.dispose(), [productModel])
  return <>
    <fogExp2 attach="fog" args={[light ? '#edf5fc' : '#040c22', light ? 0.018 : 0.0095]} />
    <Lifecycle onContextLost={onContextLost} />
    <ambientLight color={light ? '#e6f1ff' : '#266bc9'} intensity={light ? 1.1 : 0.28} />
    <pointLight color="#35e9ff" intensity={20} distance={9} position={[0, 3.5, 1.5]} />
    <pointLight color="#9a55ff" intensity={10} distance={8} position={[0, 1.1, -3]} />
    <pointLight color="#3f7dff" intensity={12} distance={10} position={[-5, 4.5, -5]} />
    <HolographicEnvironment reducedMotion={reducedMotion} colorMode={colorMode} />
    <HolographicDecor reducedMotion={reducedMotion} />
    <NeonCubeNodes onFocus={detached ? undefined : onFocusCube} />
    <CoreStructure productModel={productModel} reducedMotion={reducedMotion} detached={detached} selectedId={selectedId} onSelectPart={onSelectPart} onHeroHover={onHeroHover} />
    <CameraControls productModel={productModel} reducedMotion={reducedMotion} cubeFocus={detached ? null : cubeFocus}
      onFocusComplete={onFocusComplete}
      cameraEditing={cameraEditing} onCameraSnapshot={onCameraSnapshot} />
    {!detached && <CubeLabels frame={glassFrame} onFocus={onFocusCube} colorMode={colorMode} />}
    <HolographicBloom enabled={!reducedMotion} frame={glassFrame} detached={detached} light={light} glassPanel={glassPanel} />
  </>
}

// The raycaster still reports hidden legacy meshes, so only visible hits may select a part.
function isVisibleInScene(object: Object3D) {
  let current: Object3D | null = object
  while (current) {
    if (!current.visible) return false
    current = current.parent
  }
  return true
}

export function HolographicCoreCanvas({ colorMode = 'dark', reducedMotion, detached, selectedId, onSelectPart, cubeFocus, onFocusCube, onFocusComplete, cameraToolbar, glassPanel }: HolographicCoreCanvasProps) {
  const [failed, setFailed] = useState(false)
  const [hover, setHover] = useState<HeroHover | null>(null)
  const [cameraEditing, setCameraEditing] = useState(false)
  const [cameraSnapshot, setCameraSnapshot] = useState('')
  const [copyStatus, setCopyStatus] = useState('')
  // Keep the label at its entry point while reading it; no React render on every mouse pixel.
  const onHeroHover = useCallback((next: HeroHover | null) => {
    setHover(previous => previous?.id === next?.id ? previous : next)
  }, [])
  if (failed) return <div className="dataset-3d-fallback" role="status"><strong>Không thể hiển thị mô hình 3D</strong><p>WebGL không khả dụng hoặc renderer đã mất context. Hãy tải lại trang để thử lại.</p></div>
  return <div className="dataset-3d-canvas-shell"><SceneBoundary onFailure={() => setFailed(true)}>
    <Canvas className="dataset-3d-canvas" dpr={[1, 1.5]} camera={{ fov: 34, near: 0.1, far: 100 }}
      onPointerMissed={() => { if (detached) onSelectPart(null) }}
      fallback={<div className="dataset-3d-fallback" role="status"><strong>Trình duyệt không hỗ trợ WebGL</strong><p>Không thể mở không gian Dataset 3D trên trình duyệt này.</p></div>}>
      <HolographicScene colorMode={colorMode} reducedMotion={reducedMotion} detached={detached} selectedId={selectedId}
        glassPanel={glassPanel}
        onSelectPart={onSelectPart} onHeroHover={onHeroHover} onContextLost={() => setFailed(true)}
        cubeFocus={cubeFocus} onFocusCube={onFocusCube} onFocusComplete={onFocusComplete}
        cameraEditing={cameraEditing} onCameraSnapshot={setCameraSnapshot} />
    </Canvas>
  </SceneBoundary>
    {cameraToolbar && createPortal(<button type="button" aria-pressed={cameraEditing} onClick={() => { setCameraEditing(value => !value); setCopyStatus('') }}>
        {cameraEditing ? 'Tắt chỉnh camera' : 'Chỉnh camera'}
      </button>, cameraToolbar)}
    {cameraEditing && <div style={{ position: 'absolute', top: 60, right: 12, zIndex: 20, maxWidth: 'calc(100% - 24px)', maxHeight: '70%', overflow: 'auto', padding: 12, borderRadius: 10, background: '#07152eef', color: '#e5f6ff', fontSize: 13 }}>
      {cameraEditing && <>
        <p>Click vùng 3D để điều khiển.</p>
        <p>W/S: tiến/lùi · A/D: trái/phải · Q/E: xuống/lên</p>
        <p>Giữ chuột phải + kéo: đổi hướng nhìn.</p>
        <p>Chọn cube để đổi đường nối; camera giữ nguyên.</p>
        <textarea aria-label="Thông số camera" readOnly value={cameraSnapshot} rows={14}
          style={{ display: 'block', width: 280, maxWidth: '100%', fontFamily: 'monospace' }} />
        <button type="button" onClick={async () => {
          try {
            await navigator.clipboard.writeText(cameraSnapshot)
            setCopyStatus('Đã copy thông số camera hiện tại.')
          } catch {
            setCopyStatus('Không copy được. Hãy chọn nội dung trong ô và copy thủ công.')
          }
        }}>Copy thông số</button>
        <p role="status">{copyStatus}</p>
      </>}
    </div>}
    {hover && <div className="dataset-3d-hero-tooltip" role="tooltip" data-tower-id={hover.id}
      style={{ transform: `translate3d(${hover.x}px, ${hover.y}px, 0)` }}>{hover.label}</div>}
  </div>
}
