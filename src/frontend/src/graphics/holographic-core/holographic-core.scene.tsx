import { Component, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import type { ThreeEvent } from '@react-three/fiber'
import { Vector2, Vector3, setConsoleFunction } from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js'
import { createHolographicCoreProductModel } from './holographic-core.model'
import { HolographicEnvironment } from './holographic-core.environment'
import { createNeonCubeCluster } from '../neon-cube/neon-cube.cluster'
import type { HolographicPartInfo } from '../../types/dataset-3d/holographic-part.types'

type HolographicCoreCanvasProps = {
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
// Human-approved review pose: azimuth ~46°, elevation ~23.5°, distance ~17.3.
const INITIAL_CAMERA_POSITION = [11.45, 9, 11.45] as const
const CAMERA_TARGET = [0, 2.1, 0.5] as const

class SceneBoundary extends Component<{ children: ReactNode; onFailure(): void }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  componentDidCatch() { this.props.onFailure() }
  render() { return this.state.failed ? null : this.props.children }
}

function CameraControls({ reducedMotion }: { reducedMotion: boolean }) {
  const { camera, gl, invalidate } = useThree()
  useEffect(() => {
    const controls = new OrbitControls(camera, gl.domElement)
    controls.target.set(...CAMERA_TARGET)
    controls.minDistance = 4.4
    controls.maxDistance = 25
    controls.maxPolarAngle = Math.PI / 2.02
    controls.enableDamping = !reducedMotion
    controls.dampingFactor = 0.07
    const update = () => invalidate()
    controls.addEventListener('change', update)
    controls.update()
    return () => {
      controls.removeEventListener('change', update)
      controls.dispose()
    }
  }, [camera, gl, invalidate, reducedMotion])
  return null
}

// three.js objects are imperative by design, so DOM cursor writes stay in a plain helper
// instead of a render/hook body where the react-hooks immutability rule rejects them.
function setCanvasCursor(element: HTMLCanvasElement, value: string) {
  element.style.cursor = value
}

type CoreStructureProps = {
  reducedMotion: boolean
  detached: boolean
  selectedId: string | null
  onSelectPart(part: HolographicPartInfo | null): void
}

function CoreStructure({ reducedMotion, detached, selectedId, onSelectPart }: CoreStructureProps) {
  const { gl } = useThree()
  const productModel = useMemo(() => createHolographicCoreProductModel(), [])
  useEffect(() => () => productModel.dispose(), [productModel])
  useEffect(() => { productModel.setDetached(detached) }, [detached, productModel])
  useEffect(() => { productModel.setSelected(selectedId) }, [productModel, selectedId])
  useEffect(() => {
    const element = gl.domElement
    const resetCursor = () => setCanvasCursor(element, '')
    if (!detached) {
      resetCursor()
      return
    }
    element.addEventListener('pointerleave', resetCursor)
    return () => {
      element.removeEventListener('pointerleave', resetCursor)
      resetCursor()
    }
  }, [detached, gl])
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
      part = productModel.resolvePart(hit.object)
      if (part) break
    }
    event.stopPropagation()
    onSelectPart(part)
  }
  const handlePointerMove = (event: ThreeEvent<PointerEvent>) => {
    if (!detached) return
    const selectable = event.intersections.some(hit => productModel.resolvePart(hit.object))
    setCanvasCursor(gl.domElement, selectable ? 'pointer' : 'default')
  }
  return <primitive object={productModel.model} onClick={handleClick} onPointerMove={handlePointerMove} />
}

function NeonCubeNodes() {
  const cluster = useMemo(() => createNeonCubeCluster(), [])
  useEffect(() => () => cluster.dispose(), [cluster])
  return <primitive object={cluster.group} />
}

function Lifecycle({ onContextLost }: { onContextLost(): void }) {  const { gl } = useThree()
  useEffect(() => {
    const handleContextLost = (event: Event) => { event.preventDefault(); onContextLost() }
    gl.domElement.addEventListener('webglcontextlost', handleContextLost)
    return () => gl.domElement.removeEventListener('webglcontextlost', handleContextLost)
  }, [gl, onContextLost])
  return null
}

function HolographicBloom({ enabled }: { enabled: boolean }) {
  const { camera, gl, scene, size } = useThree()
  const pipeline = useMemo(() => {
    const composer = new EffectComposer(gl)
    // Product canvas has denser emissive linework than the isolated review scene.
    // Keep bloom limited to hotspots instead of whitening every cyan contour.
    const bloom = new UnrealBloomPass(new Vector2(size.width, size.height), 0.4, 0.45, 1)
    bloom.enabled = enabled
    composer.addPass(new RenderPass(scene, camera))
    composer.addPass(bloom)
    return composer
  }, [camera, enabled, gl, scene, size.height, size.width])
  useEffect(() => {
    pipeline.setSize(size.width, size.height)
    return () => pipeline.dispose()
  }, [pipeline, size.height, size.width])
  useFrame(() => pipeline.render(), 1)
  return null
}

type HolographicSceneProps = CoreStructureProps & { onContextLost(): void }

function HolographicScene({ reducedMotion, detached, selectedId, onSelectPart, onContextLost }: HolographicSceneProps) {
  const { camera } = useThree()
  useEffect(() => {
    camera.position.set(...INITIAL_CAMERA_POSITION)
    camera.lookAt(new Vector3(...CAMERA_TARGET))
  }, [camera])
  return <>
    <fogExp2 attach="fog" args={['#02101a', 0.011]} />
    <Lifecycle onContextLost={onContextLost} />
    <ambientLight color="#266bc9" intensity={0.28} />
    <pointLight color="#35e9ff" intensity={20} distance={9} position={[0, 3.5, 1.5]} />
    <pointLight color="#9a55ff" intensity={10} distance={8} position={[0, 1.1, -3]} />
    <pointLight color="#3f7dff" intensity={12} distance={10} position={[-5, 4.5, -5]} />
    <HolographicEnvironment reducedMotion={reducedMotion} />
    <NeonCubeNodes />
    <CoreStructure reducedMotion={reducedMotion} detached={detached} selectedId={selectedId} onSelectPart={onSelectPart} />
    <CameraControls reducedMotion={reducedMotion} />
    <HolographicBloom enabled={!reducedMotion} />
  </>
}

export function HolographicCoreCanvas({ reducedMotion, detached, selectedId, onSelectPart }: HolographicCoreCanvasProps) {
  const [failed, setFailed] = useState(false)
  if (failed) return <div className="dataset-3d-fallback" role="status"><strong>Không thể hiển thị mô hình 3D</strong><p>WebGL không khả dụng hoặc renderer đã mất context. Hãy tải lại trang để thử lại.</p></div>
  return <SceneBoundary onFailure={() => setFailed(true)}>
    <Canvas className="dataset-3d-canvas" dpr={[1, 1.5]} camera={{ fov: 34, near: 0.1, far: 100 }}
      onPointerMissed={() => { if (detached) onSelectPart(null) }}
      fallback={<div className="dataset-3d-fallback" role="status"><strong>Trình duyệt không hỗ trợ WebGL</strong><p>Không thể mở không gian Dataset 3D trên trình duyệt này.</p></div>}>
      <HolographicScene reducedMotion={reducedMotion} detached={detached} selectedId={selectedId}
        onSelectPart={onSelectPart} onContextLost={() => setFailed(true)} />
    </Canvas>
  </SceneBoundary>
}
