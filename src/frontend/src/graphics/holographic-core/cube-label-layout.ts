import { Vector3 } from 'three'
import { NEON_CUBE_CLUSTER_LAYOUT } from '../neon-cube/neon-cube.cluster'
import { NEON_CUBE } from '../neon-cube/neon-cube.model'
import type { NeonCubeThemeId } from '../../types/dataset-3d/cube-focus.types'
import { HOLOGRAPHIC_CAMERA } from './core-visual-config'

export const CUBE_LABEL_ASPECT = 3.4

export const CUBE_LABEL_LAYOUT = NEON_CUBE_CLUSTER_LAYOUT.map(({ position: [x, y, z], scale, theme }) => {
  const height = 0.8 * scale
  const roof = y + NEON_CUBE.cubeTopY * scale
  const labelBottom = roof + 0.36 * scale
  const [cameraX, , cameraZ] = HOLOGRAPHIC_CAMERA.position
  const front = new Vector3(cameraX - x, 0, cameraZ - z).normalize()
  return {
    theme, height, width: height * CUBE_LABEL_ASPECT, roof,
    center: new Vector3(x, labelBottom + height / 2, z),
    yaw: Math.atan2(front.x, front.z),
    front,
  }
})

export function cubeLabelFocusPose(theme: NeonCubeThemeId, verticalFov: number, aspect: number) {
  const label = CUBE_LABEL_LAYOUT.find(candidate => candidate.theme === theme)
  if (!label) return null
  const verticalSlope = Math.tan(verticalFov * Math.PI / 360)
  const distance = Math.max(1.8, Math.max(
    label.width / (verticalSlope * aspect),
    label.height / verticalSlope,
  ) / 1.42)
  return {
    position: label.front.clone().setY(0.12).normalize().multiplyScalar(distance).add(label.center),
    target: label.center,
  }
}
