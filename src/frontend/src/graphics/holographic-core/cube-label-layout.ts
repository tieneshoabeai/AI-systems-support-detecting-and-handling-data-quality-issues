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
  const node = NEON_CUBE_CLUSTER_LAYOUT.find(candidate => candidate.theme === theme)!
  const eyeHeight = node.position[1] + NEON_CUBE.cubeCenterY * node.scale
  return fitCubeCamera(cubeFramePoints(theme), label.front, verticalFov, aspect, eyeHeight)
}

// World-space corners include the rotated base and the fixed-facing label.
export function cubeFramePoints(theme: NeonCubeThemeId) {
  const node = NEON_CUBE_CLUSTER_LAYOUT.find(candidate => candidate.theme === theme)!
  const label = CUBE_LABEL_LAYOUT.find(candidate => candidate.theme === theme)!
  const origin = new Vector3(...node.position)
  const yaw = Math.atan2(-origin.x, -origin.z)
  const half = (NEON_CUBE.baseSide / 2 + NEON_CUBE.baseBevel) * node.scale
  const points: Vector3[] = []
  for (const x of [-half, half]) for (const z of [-half, half]) {
    for (const y of [0, (NEON_CUBE.cubeTopY + 0.04) * node.scale]) {
      points.push(new Vector3(x, y, z).applyAxisAngle(new Vector3(0, 1, 0), yaw).add(origin))
    }
  }
  const right = new Vector3(label.front.z, 0, -label.front.x)
  for (const x of [-0.5, 0.5]) for (const y of [-0.5, 0.5]) {
    points.push(label.center.clone().addScaledVector(right, x * label.width).add(new Vector3(0, y * label.height, 0)))
  }
  return points
}

// Fit projected corners rather than a bounding sphere: depth and viewport aspect
// both matter, especially for a wide label above a shallow cube.
export function fitCubeCamera(points: Vector3[], direction: Vector3, fov: number, aspect: number, eyeHeight?: number) {
  const back = direction.clone().normalize()
  const right = new Vector3().crossVectors(new Vector3(0, 1, 0), back).normalize()
  const up = new Vector3().crossVectors(back, right)
  const min = new Vector3(Infinity, Infinity, Infinity)
  const max = new Vector3(-Infinity, -Infinity, -Infinity)
  for (const point of points) {
    const projected = new Vector3(point.dot(right), point.dot(up), point.dot(back))
    min.min(projected)
    max.max(projected)
  }
  const center = min.add(max).multiplyScalar(0.5)
  const target = right.clone().multiplyScalar(center.x).addScaledVector(up, center.y).addScaledVector(back, center.z)
  if (eyeHeight !== undefined) target.y = eyeHeight
  const slope = Math.tan(fov * Math.PI / 360) * 0.86
  let distance = 1.8
  for (const point of points) {
    const offset = point.clone().sub(target)
    distance = Math.max(distance, offset.dot(back) + Math.max(
      Math.abs(offset.dot(right)) / (slope * aspect), Math.abs(offset.dot(up)) / slope,
    ))
  }
  return { position: back.multiplyScalar(distance).add(target), target }
}
