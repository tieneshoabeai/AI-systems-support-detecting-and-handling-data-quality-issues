import { Component, useEffect, useMemo, useRef, useState } from 'react'
import type { ChangeEvent, PointerEvent as ReactPointerEvent, ReactNode, RefObject } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import type { ThreeEvent } from '@react-three/fiber'
import { PerspectiveCamera, Vector2 } from 'three'
import type { Group, Mesh, Object3D } from 'three'
import { authGlassConfig, authGlassViews } from '../../../graphics/auth-glass/auth-glass.config'
import type { AuthGlassView } from '../../../graphics/auth-glass/auth-glass.config'
import type { AuthGlassPanel } from '../../../types/auth/auth-glass.types'
import { alignPanelAtSeam, createAuthGlassGeometry, findPanelFootprintCenter } from '../../../graphics/auth-glass/auth-glass.geometry'
import { createAuthArtwork } from '../../../graphics/auth-glass/auth-glass.artwork'
import { faceHeight, faceWidth, faceZ, projectAuthForm } from '../../../graphics/auth-glass/auth-glass.form'
import { createAuthFallbackMaterial } from '../../../graphics/auth-glass/auth-glass.materials'
import { AuthGlassBackdrop } from './auth-glass.backdrop'
import { useAuthGlassRender } from './auth-glass.render'
import { DisplayBase } from './display-base/display-base'
import { displayBaseOptions } from '../../../graphics/auth-glass/display-base/display-base.config'
import './auth-glass.css'

const { camera: cameraConfig, viewport, panels, seamPosition, slab, dragThreshold } = authGlassConfig
type FormRef = RefObject<HTMLElement | null>
type SceneStatusListener = (status: 'ready' | 'failed') => void

type StartAssemblyDrag = (event: ThreeEvent<PointerEvent>, invalidate: () => void) => void

type AssemblyDrag = {
  pointerId: number
  startX: number
  startY: number
  yaw: number
  panel?: AuthGlassPanel
  moved: boolean
}

class GlassSceneBoundary extends Component<{ children: ReactNode; onSceneStatus?: SceneStatusListener }, { failed: boolean }> {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  componentDidCatch() {
    this.props.onSceneStatus?.('failed')
  }

  render() {
    return this.state.failed ? <GlassFallback /> : this.props.children
  }
}

function GlassFallback() {
  return <p className="auth-glass-fallback">Thiết bị không hiển thị được khối 3D.</p>
}

function GlassScene({ onStartDrag, pageElement, formElement, registerElement, activePanel, low, dragLight, lensDebug, lensThickness, onSceneStatus }: {
  onStartDrag?: StartAssemblyDrag
  pageElement?: FormRef
  formElement?: FormRef
  registerElement?: FormRef
  activePanel: AuthGlassPanel
  low: boolean
  dragLight?: RefObject<Vector2>
  lensDebug?: number
  lensThickness?: number
  onSceneStatus?: SceneStatusListener
}) {
  const invalidate = useThree(state => state.invalidate)
  const canvas = useThree(state => state.gl.domElement)
  const loginArtwork = useRef<Mesh>(null)
  const registerArtwork = useRef<Mesh>(null)
  const turntable = useRef<Group>(null)
  const framing = useRef<'desktop' | AuthGlassPanel | null>(null)
  const previousPanel = useRef(activePanel)
  const reportedReady = useRef(false)
  const resources = useMemo(() => {
    const geometry = createAuthGlassGeometry()
    const resolution = low ? 512 : 1024
    const layout = panels.map(({ name, yaw, seamSide }) => ({
      name,
      yaw,
      position: alignPanelAtSeam(geometry, yaw, seamSide),
    }))
    const footprint = findPanelFootprintCenter(geometry, layout)
    return {
      geometry,
      layout,
      footprint,
      footlights: {
        panels: layout.map(({ position, yaw }) => ({ x: position[0] - footprint.x, z: position[2] - footprint.z, yaw })),
        width: slab.width,
        depth: slab.depth,
      },
      fallback: createAuthFallbackMaterial(),
      loginFront: createAuthArtwork('login', false, resolution),
      loginBack: createAuthArtwork('login', true, resolution / 2),
      registerFront: createAuthArtwork('register', false, resolution),
      registerBack: createAuthArtwork('register', true, resolution / 2),
    }
  }, [low])

  useEffect(() => () => {
    resources.geometry.dispose()
    resources.fallback.dispose()
    for (const texture of [resources.loginFront, resources.loginBack, resources.registerFront, resources.registerBack]) {
      texture?.dispose()
    }
  }, [resources])

  useEffect(() => {
    const detachForm = () => {
      for (const form of [formElement?.current, registerElement?.current]) {
        form?.removeAttribute('data-on-panel')
        form?.style.removeProperty('--auth-glass-form-transform')
      }
    }
    const restoreForm = () => invalidate()
    const loseContext = () => {
      detachForm()
      onSceneStatus?.('failed')
    }
    canvas.addEventListener('webglcontextlost', loseContext)
    canvas.addEventListener('webglcontextrestored', restoreForm)
    return () => {
      canvas.removeEventListener('webglcontextlost', loseContext)
      canvas.removeEventListener('webglcontextrestored', restoreForm)
      detachForm()
    }
  }, [canvas, formElement, registerElement, invalidate, onSceneStatus])

  useEffect(() => invalidate(), [activePanel, invalidate])

  const { assembly: root, loginGroup, registerGroup, loginMesh, registerMesh } =
    useAuthGlassRender(resources.fallback, low, dragLight, lensDebug, lensThickness)

  useFrame(({ camera, size, gl }) => {
    const registering = activePanel === 'register'
    const form = registering ? registerElement?.current : formElement?.current
    const panel = registering ? registerGroup.current : loginGroup.current
    if (!form || !panel || !turntable.current || size.width <= 0 || size.height <= 0 || gl.getContext().isContextLost()) return
    const switched = previousPanel.current !== activePanel
    if (switched) {
      turntable.current.rotation.set(0, panelYaw(activePanel), 0)
      previousPanel.current = activePanel
    }

    // On narrow screens center the chosen panel while keeping the two slabs joined.
    const compact = size.width / size.height < cameraConfig.compact.maxAspect
    const nextFraming = compact ? activePanel : 'desktop'
    if (camera instanceof PerspectiveCamera && framing.current !== nextFraming) {
      const settings = cameraConfig.compact
      camera.position.set(...(compact ? settings.position : cameraConfig.loginPosition))
      if (compact) {
        const [x, , z] = resources.layout[registering ? 1 : 0].position
        const yaw = panelYaw(activePanel)
        const frameX = seamPosition[0] + (x - resources.footprint.x) * Math.cos(yaw)
          + (z - resources.footprint.z) * Math.sin(yaw)
        camera.position.setX(frameX)
        camera.lookAt(frameX, settings.target[1], settings.target[2])
      } else {
        camera.lookAt(...cameraConfig.loginTarget)
      }
      camera.fov = compact ? settings.fov : cameraConfig.loginFov
      camera.updateProjectionMatrix()
      framing.current = nextFraming
    }

    camera.updateMatrixWorld()
    panel.updateWorldMatrix(true, false)
    const transform = projectAuthForm(camera, panel, size.width, size.height)
    if (transform) {
      form.style.setProperty('--auth-glass-form-transform', transform)
      form.setAttribute('data-on-panel', 'true')
    } else if (form.hasAttribute('data-on-panel')) {
      form.removeAttribute('data-on-panel')
    }
    if (loginArtwork.current) loginArtwork.current.visible = registering || !transform
    if (registerArtwork.current) registerArtwork.current.visible = !registering || !transform
    if (transform && !reportedReady.current) {
      reportedReady.current = true
      onSceneStatus?.('ready')
    }
    if (switched && transform) focusPanelField(form, activePanel)
  })

  // Keep the seam as a separate coordinate frame for refraction ordering.
  const panelAssembly = (
    <group
      ref={root}
      name="PanelSeam"
      position={formElement
        ? [-resources.footprint.x, slab.height / 2 - displayBaseOptions.sockets.embed, -resources.footprint.z]
        : [0, seamPosition[1], 0]}
    >
      {resources.layout.map(({ name, position, yaw }) => {
        const login = name === 'LoginPanel'
        const front = login ? resources.loginFront : resources.registerFront
        const rear = login ? resources.loginBack : resources.registerBack
        return <group ref={login ? loginGroup : registerGroup} key={name} name={name} position={position} rotation-y={yaw}>
          <mesh
            ref={login ? loginMesh : registerMesh}
            name="GlassBody"
            geometry={resources.geometry}
            material={resources.fallback}
          />
          {front && <mesh ref={login ? loginArtwork : registerArtwork} name="UIFace" position={[0, slab.height / 2, faceZ]}>
            <planeGeometry args={[faceWidth, faceHeight]} />
            <meshBasicMaterial map={front} transparent depthWrite={false} toneMapped={false} />
          </mesh>}
          {rear && <mesh name="RearArtwork" position={[0, slab.height / 2, -faceZ]} rotation-y={Math.PI}>
            <planeGeometry args={[faceWidth, faceHeight]} />
            <meshBasicMaterial map={rear} transparent depthWrite={false} toneMapped={false} />
          </mesh>}
        </group>
      })}
    </group>
  )

  return <>
    <AuthGlassBackdrop pageElement={pageElement} />
    <ambientLight intensity={1.1} />
    <directionalLight position={[-3, 6, 5]} intensity={2.0} />
    <directionalLight position={[4, -2, 3]} intensity={1.3} color="#84cfff" />
    <group position={[seamPosition[0], 0, seamPosition[2]]}>
      {formElement ? <DisplayBase low={low} footlights={resources.footlights} turntable={{
        ref: turntable,
        onPointerDown: onStartDrag ? event => onStartDrag(event, invalidate) : undefined,
      }}>
        {panelAssembly}
      </DisplayBase> : panelAssembly}
    </group>
  </>
}

function panelYaw(panel: AuthGlassPanel) {
  return panel === 'register' ? -panels[1].yaw : 0
}

function focusPanelField(form: HTMLElement, panel: AuthGlassPanel) {
  const input = panel === 'register' ? 'familyName' : 'email'
  const target = form.querySelector<HTMLInputElement>(`input[name="${input}"]:enabled`)
    ?? form.querySelector<HTMLElement>('[tabindex="-1"]')
  target?.focus({ preventScroll: true })
}

export function AuthGlassStage({
  view = 'hero', interactive = false, formElement, registerElement, activePanel = 'login', onPanelChange, onRotateStart, low = false,
  lensDebug, lensThickness, onSceneStatus, pageElement,
}: {
  view?: AuthGlassView
  interactive?: boolean
  pageElement?: FormRef
  formElement?: FormRef
  registerElement?: FormRef
  activePanel?: AuthGlassPanel
  onPanelChange?: (panel: AuthGlassPanel) => void
  onRotateStart?: () => void
  low?: boolean
  lensDebug?: number
  lensThickness?: number
  onSceneStatus?: SceneStatusListener
}) {
  const stage = useRef<HTMLDivElement>(null)
  const drag = useRef<AssemblyDrag | null>(null)
  const dragLight = useRef(new Vector2())
  const assembly = useRef<{ group: Object3D; invalidate: () => void } | null>(null)

  const camera = useMemo(() => {
    const perspective = new PerspectiveCamera(cameraConfig.fov, viewport.width / viewport.height, cameraConfig.near, cameraConfig.far)
    perspective.position.set(...cameraConfig.positions[view])
    perspective.lookAt(...cameraConfig.target)
    return perspective
  }, [view])

  function startDrag(event: ThreeEvent<PointerEvent>, invalidate: () => void) {
    const surface = stage.current
    if (!surface || drag.current || event.button !== 0) return
    event.stopPropagation()
    surface.setPointerCapture(event.pointerId)
    const group = event.eventObject
    assembly.current = { group, invalidate }
    const picked = event.object.parent?.name
    drag.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      yaw: group.rotation.y,
      panel: picked === 'RegisterPanel' ? 'register' : picked === 'LoginPanel' ? 'login' : undefined,
      moved: false,
    }
  }

  function moveDrag(event: ReactPointerEvent<HTMLDivElement>) {
    const active = drag.current
    const target = assembly.current
    if (!active || !target || event.pointerId !== active.pointerId) return
    const dx = event.clientX - active.startX
    if (!active.moved) {
      if (Math.abs(dx) < dragThreshold) return
      active.moved = true
      onRotateStart?.()
    }
    const speed = authGlassConfig.dragRadiansPerPixel
    target.group.rotation.y = active.yaw + dx * speed
    const bounds = event.currentTarget.getBoundingClientRect()
    dragLight.current.set(
      Math.min(1, Math.max(-1, 2 * (event.clientX - bounds.left) / bounds.width - 1)),
      Math.min(1, Math.max(-1, 1 - 2 * (event.clientY - bounds.top) / bounds.height)),
    )
    target.invalidate()
  }

  function endDrag(event: ReactPointerEvent<HTMLDivElement>) {
    const active = drag.current
    if (!active || event.pointerId !== active.pointerId) return
    drag.current = null
    if (active.moved) {
      dragLight.current.set(0, 0)
      assembly.current?.invalidate()
    }
    const distance = Math.hypot(event.clientX - active.startX, event.clientY - active.startY)
    if (event.type === 'pointerup' && active.panel && !active.moved && distance < dragThreshold) {
      openPanel(active.panel)
    }
  }

  function openPanel(panel: AuthGlassPanel) {
    const pointerId = drag.current?.pointerId
    const surface = stage.current
    drag.current = null
    dragLight.current.set(0, 0)
    if (surface && pointerId !== undefined && surface.hasPointerCapture(pointerId)) {
      surface.releasePointerCapture(pointerId)
    }
    const target = assembly.current
    if (panel !== activePanel) {
      onPanelChange?.(panel)
      return
    }
    target?.group.rotation.set(0, panelYaw(panel), 0)
    const form = panel === 'register' ? registerElement?.current : formElement?.current
    if (form) {
      // Keep focus in the original click/tap so mobile can open the keyboard.
      if (form.style.getPropertyValue('--auth-glass-form-transform')) {
        form.setAttribute('data-on-panel', 'true')
      }
      focusPanelField(form, panel)
    }
    target?.invalidate()
  }

  const supportsWebGL = typeof WebGL2RenderingContext !== 'undefined'
  const canRotate = interactive && supportsWebGL
  return <div className={interactive ? 'auth-glass-interactive' : undefined}>
    <div
      ref={stage}
      className={canRotate ? 'auth-glass-stage auth-glass-stage--draggable' : 'auth-glass-stage'}
      role="img"
      aria-label="Hai khối 3D Đăng nhập và Đăng ký"
      onPointerMove={canRotate ? moveDrag : undefined}
      onPointerUp={canRotate ? endDrag : undefined}
      onPointerCancel={canRotate ? endDrag : undefined}
      onLostPointerCapture={canRotate ? endDrag : undefined}
    >
      {!supportsWebGL ? <GlassFallback /> : (
        <GlassSceneBoundary onSceneStatus={onSceneStatus}>
          <Canvas key={view} camera={camera} frameloop="demand" dpr={low ? 1 : [1, 1.5]} fallback={<GlassFallback />}>
            <GlassScene
              onStartDrag={canRotate ? startDrag : undefined}
              pageElement={pageElement}
              formElement={formElement}
              registerElement={registerElement}
              activePanel={activePanel}
              low={low}
              dragLight={dragLight}
              lensDebug={lensDebug}
              lensThickness={lensThickness}
              onSceneStatus={onSceneStatus}
            />
          </Canvas>
        </GlassSceneBoundary>
      )}
    </div>
    {canRotate && <div className="auth-glass-interaction">
      <span>Kéo ngang để xoay · Chạm panel để nhập</span>
      <button type="button" onClick={() => openPanel(activePanel === 'login' ? 'register' : 'login')}>
        {activePanel === 'login' ? 'Đăng ký' : 'Đăng nhập'}
      </button>
      <button type="button" onClick={() => openPanel(activePanel)}>Về góc nhập liệu</button>
    </div>}
  </div>
}

const viewLabels: Record<AuthGlassView, string> = {
  hero: 'Hero', left: 'Trái', right: 'Phải', top: 'Trên', bottom: 'Dưới',
}

export function AuthGlassReview({ view, overlay, low }: { view: AuthGlassView; overlay: boolean; low: boolean }) {
  const [referenceUrl, setReferenceUrl] = useState<string>()

  useEffect(() => () => {
    if (referenceUrl) URL.revokeObjectURL(referenceUrl)
  }, [referenceUrl])

  function loadReference(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0]
    setReferenceUrl(file?.type === 'image/png' ? URL.createObjectURL(file) : undefined)
  }

  return <main className="auth-glass-review">
    <nav className="auth-glass-review-controls" aria-label="Góc kiểm tra khối 3D">
      <a href="/auth/login">Về đăng nhập</a>
      {authGlassViews.map(option => (
        <a key={option} href={`?view=${option}${low ? '&quality=low' : ''}`} aria-current={option === view ? 'page' : undefined}>{viewLabels[option]}</a>
      ))}
      <a href={overlay ? '?view=hero' : '?view=hero&overlay=1'}>{overlay ? 'Ẩn ảnh mẫu' : 'Chồng ảnh mẫu'}</a>
      <a href={`?view=${view}${low ? '' : '&quality=low'}`}>{low ? 'Kính khúc xạ' : 'Kính đơn giản'}</a>
      {overlay && <label>Ảnh hero PNG <input type="file" accept="image/png" onChange={loadReference} /></label>}
    </nav>
    <div className="auth-glass-review-frame">
      <AuthGlassStage view={view} low={low} />
      {overlay && referenceUrl && <img className="auth-glass-overlay" src={referenceUrl} alt="Ảnh hero tham chiếu" />}
    </div>
  </main>
}
