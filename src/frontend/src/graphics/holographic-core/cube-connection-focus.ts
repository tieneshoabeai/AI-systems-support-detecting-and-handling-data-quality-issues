import { PerspectiveCamera, Vector3 } from 'three'
import type { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import type { NeonCubeThemeId } from '../../types/dataset-3d/cube-focus.types'
import { cubeConnectionOverview } from './cube-connection-paths'

type Pose = { position: Vector3; target: Vector3 }
type Stage = 'idle' | 'overview' | 'drawing' | 'focused'

export const CONNECTION_REVEAL_SECONDS = 1.2

// One frame-driven sequence owns camera and reveal progress. Retargeting replaces
// its destination immediately; no timeout can later zoom back to a stale cube.
export function createCubeConnectionFocus(
  camera: PerspectiveCamera,
  controls: OrbitControls,
  setConnection: (theme: NeonCubeThemeId | null, progress: number) => void,
  onComplete?: (theme: NeonCubeThemeId) => void,
) {
  let theme: NeonCubeThemeId | null = null
  let stage: Stage = 'idle'
  let returnPose: Pose | null = null
  let destination: Pose | null = null
  let progress = 0
  let aspect = camera.aspect
  let reduced = false
  const originalMaxPolarAngle = controls.maxPolarAngle

  function allowPose(pose: Pose) {
    const distance = pose.position.distanceTo(pose.target)
    controls.maxDistance = Math.max(25, distance * 1.5)
    camera.far = Math.max(100, distance * 2)
    camera.updateProjectionMatrix()
  }

  function snap(pose: Pose) {
    // Flush pending OrbitControls damping before writing the new pose.
    const damping = controls.enableDamping
    controls.enableDamping = false
    controls.update()
    camera.position.copy(pose.position)
    controls.target.copy(pose.target)
    controls.update()
    controls.enableDamping = damping
  }

  function select(next: NeonCubeThemeId | null, reducedMotion: boolean) {
    if (theme === next && reduced === reducedMotion) {
      if (next && stage === 'focused') onComplete?.(next)
      return
    }
    reduced = reducedMotion
    theme = next
    progress = 0
    setConnection(next, 0)
    controls.enabled = true
    if (!next) {
      stage = 'idle'
      if (returnPose) snap(returnPose)
      returnPose = null
      controls.minDistance = 4.4
      controls.maxPolarAngle = originalMaxPolarAngle
      return
    }
    returnPose ??= { position: camera.position.clone(), target: controls.target.clone() }
    controls.minDistance = 1.35
    // Portrait overview may need a greater distance than the old orbit limit.
    controls.maxPolarAngle = Math.PI / 2
    allowPose(cubeConnectionOverview(next))
    if (reduced) {
      snap(cubeConnectionOverview(next))
      setConnection(next, 1)
      stage = 'focused'
      onComplete?.(next)
      return
    }
    destination = cubeConnectionOverview(next)
    stage = 'overview'
    controls.enabled = false
    snap({ position: camera.position.clone(), target: controls.target.clone() })
  }

  return {
    select,
    get stage() { return stage },
    update(delta: number) {
      if (theme && aspect !== camera.aspect) {
        aspect = camera.aspect
        destination = cubeConnectionOverview(theme)
        if (destination) {
          allowPose(destination)
          if (stage === 'drawing') snap(destination)
        }
      }
      const step = Number.isFinite(delta) ? Math.min(Math.max(delta, 0), 0.1) : 0
      if (stage === 'overview') {
        if (!destination) return
        const blend = 1 - Math.exp(-9 * step)
        camera.position.lerp(destination.position, blend)
        controls.target.lerp(destination.target, blend)
        controls.update()
        if (camera.position.distanceToSquared(destination.position) > 0.0009
          || controls.target.distanceToSquared(destination.target) > 0.0009) return
        snap(destination)
        stage = 'drawing'
      } else if (stage === 'drawing' && theme) {
        progress = Math.min(1, progress + step / CONNECTION_REVEAL_SECONDS)
        setConnection(theme, progress)
        if (progress === 1) {
          stage = 'focused'
          controls.enabled = true
          onComplete?.(theme)
        }
      } else controls.update()
    },
    dispose() {
      setConnection(null, 0)
      controls.enabled = true
      controls.maxPolarAngle = originalMaxPolarAngle
    },
  }
}
