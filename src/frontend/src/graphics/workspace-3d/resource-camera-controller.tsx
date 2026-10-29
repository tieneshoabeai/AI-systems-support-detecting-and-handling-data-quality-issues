import { useEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Vector3 } from 'three'
import type { PerspectiveCamera } from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import type { CameraCommand, ResourceLayout } from '../../types/workspace-3d/resource-map.types'
import { clampTarget, fitPose, overviewPose, panPose, updateCameraProjection } from '../../math/workspace-3d/resource-camera'
import type { CameraPose } from '../../math/workspace-3d/resource-camera'

type Props = { layout: ResourceLayout; command?: CameraCommand; resetKey: number; reducedMotion: boolean; active: boolean; onContextLost(): void }
type Transition = { from: CameraPose; to: CameraPose; elapsed: number }

export function ResourceCameraController({ layout, command, resetKey, reducedMotion, active, onContextLost }: Props) {
  const { camera, gl, size, invalidate } = useThree()
  const controlsRef = useRef<OrbitControls | null>(null)
  const transition = useRef<Transition | null>(null)
  const lastLayout = useRef<ResourceLayout | null>(null)
  const handled = useRef<number | null>(null)
  const previousAspect = useRef<number | null>(null)
  const wasHidden = useRef(false)
  const projection = camera as PerspectiveCamera

  useEffect(() => {
    const controls = new OrbitControls(camera, gl.domElement)
    controlsRef.current = controls
    controls.enablePan = true
    controls.screenSpacePanning = false
    controls.enableDamping = false
    controls.minPolarAngle = 0.15
    controls.maxPolarAngle = Math.PI / 2 - 0.06
    controls.minDistance = 4
    const redraw = () => invalidate()
    const interrupt = () => { transition.current = null }
    const lost = (event: Event) => { event.preventDefault(); onContextLost() }
    controls.addEventListener('change', redraw)
    controls.addEventListener('start', interrupt)
    gl.domElement.addEventListener('webglcontextlost', lost)
    return () => {
      controls.removeEventListener('change', redraw)
      controls.removeEventListener('start', interrupt)
      gl.domElement.removeEventListener('webglcontextlost', lost)
      controls.dispose()
      controlsRef.current = null
      transition.current = null
    }
  }, [camera, gl, invalidate, onContextLost])

  // Reset and scope/layout changes fit the scene. Resizing alone preserves the user's pose.
  useEffect(() => {
    const controls = controlsRef.current
    if (!controls) return
    transition.current = null
    handled.current = command?.sequence ?? null
    const pose = overviewPose(layout, projection.fov, size.width / Math.max(1, size.height))
    camera.position.copy(pose.position)
    controls.target.copy(pose.target)
    controls.maxDistance = Math.max(30, pose.position.distanceTo(pose.target) * 2.5)
    updateCameraProjection(projection, size.width / Math.max(1, size.height), Math.max(500, controls.maxDistance * 2))
    previousAspect.current = size.width / Math.max(1, size.height)
    controls.update()
    lastLayout.current = layout
    invalidate()
    // command and viewport changes are handled separately below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layout, resetKey, camera, projection, invalidate])

  useEffect(() => {
    const controls = controlsRef.current
    if (!controls || !command || handled.current === command.sequence || lastLayout.current !== layout) return
    handled.current = command.sequence
    const from = { position: camera.position.clone(), target: controls.target.clone() }
    let to: CameraPose
    if (command.type === 'focus') {
      const node = layout.nodes.find(value => value.resource.id === command.resourceId)
      if (!node) { transition.current = null; return }
      to = fitPose([node], new Vector3(...node.position), camera.position.clone().sub(controls.target), projection.fov, size.width / Math.max(1, size.height))
    } else if (command.type === 'reset') to = overviewPose(layout, projection.fov, size.width / Math.max(1, size.height))
    else if (command.type === 'near' || command.type === 'far') {
      const offset = camera.position.clone().sub(controls.target)
      const distance = Math.max(controls.minDistance, Math.min(controls.maxDistance, offset.length() * (command.type === 'near' ? 0.8 : 1.25)))
      to = { target: controls.target.clone(), position: offset.setLength(distance).add(controls.target) }
    } else to = panPose(from, command.type, layout)
    transition.current = { from, to, elapsed: 0 }
    invalidate()
  }, [command, layout, camera, projection, size.width, size.height, invalidate])

  useEffect(() => {
    // A preference/visibility change must wake demand rendering, without accumulating hidden time.
    if (!active) wasHidden.current = true
    if (active && wasHidden.current) {
      if (transition.current) transition.current.elapsed = 0.35
      wasHidden.current = false
    }
    if (active) invalidate()
  }, [active, reducedMotion, invalidate])

  useEffect(() => {
    const controls = controlsRef.current
    if (!controls) return
    const aspect = size.width / Math.max(1, size.height)
    const oldAspect = previousAspect.current ?? aspect
    previousAspect.current = aspect
    updateCameraProjection(projection, aspect, projection.far)
    if (oldAspect > aspect) {
      const offset = camera.position.clone().sub(controls.target)
      camera.position.copy(offset.multiplyScalar(Math.min(3, oldAspect / aspect)).add(controls.target))
      transition.current = null
    }
    controls.update()
    invalidate()
  }, [size.width, size.height, camera, projection, invalidate])

  useFrame((_, delta) => {
    const controls = controlsRef.current
    if (!controls || !active) return
    const motion = transition.current
    if (motion) {
      motion.elapsed += Math.min(delta, 0.05)
      const t = reducedMotion ? 1 : Math.min(1, motion.elapsed / 0.35)
      const eased = 1 - (1 - t) ** 3
      camera.position.lerpVectors(motion.from.position, motion.to.position, eased)
      controls.target.lerpVectors(motion.from.target, motion.to.target, eased)
      if (t === 1) transition.current = null
      else invalidate()
    }
    const target = clampTarget(controls.target, layout)
    camera.position.add(target.clone().sub(controls.target))
    controls.target.copy(target)
    controls.update()
  })
  return null
}
